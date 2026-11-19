"""Offline tests for Verified practice (no API key, no database needed).

    python -m pytest test_verified.py -q
"""
import pytest

import verified_service as svc
from ia.schemas import DSAExtraction, STARComponent, STARExtraction


class FakeExtractor:
    """Stands in for the LLM: returns a fixed extraction."""

    def __init__(self, dsa=None, star=None, valid=True):
        self.dsa, self.star, self.valid = dsa, star, valid

    def _meta(self):
        return {"llm_ms": 12.0, "valid": self.valid, "attempts": 1}

    def extract_dsa(self, question, transcript):
        return self.dsa, self._meta()

    def extract_star(self, question, transcript):
        return self.star, self._meta()


TWO_SUM = "I would use a hash map to store each number's index. That makes it O(n) time and O(n) space."


def test_questions_listed_with_app_topics():
    qs = svc.list_questions()
    assert len(qs["dsa"]) == 20
    assert all(q["topic"] for q in qs["dsa"] + qs["behavioral"])
    assert "codeswitch" not in {q["id"] for q in qs["behavioral"]}
    assert set(svc.DSA_TOPIC) == set(svc.problems())


def test_optimal_answer_is_final_and_recorded():
    ext = DSAExtraction(paradigm="hashing", paradigm_evidence="use a hash map",
                        time_complexity="O(n)", time_evidence="O(n) time",
                        space_complexity="O(n)", space_evidence="O(n) space")
    r = svc.assess("dsa", "two_sum", TWO_SUM, extractor=FakeExtractor(dsa=ext))
    assert r["grade"]["verdict"] == "optimal"
    assert r["is_final"] and r["next"]["type"] == "done"
    assert r["score_01"] == 1.0
    assert svc.attempt_fields(r) == {"kind": "dsa", "question_id": "two_sum", "topic": "Arrays & Hashing",
                                     "score": 1.0, "verdict": "optimal"}


def test_missing_complexity_asks_followup_then_stops():
    ext = DSAExtraction(paradigm="hashing", paradigm_evidence="use a hash map")
    r = svc.assess("dsa", "two_sum", "I would use a hash map.", extractor=FakeExtractor(dsa=ext))
    assert r["grade"]["verdict"] == "incomplete"
    assert r["next"]["type"] == "followup" and "time complexity" in r["next"]["prompt"].lower()
    r2 = svc.assess("dsa", "two_sum", "I would use a hash map.", followups_asked=svc.MAX_FOLLOWUPS,
                    extractor=FakeExtractor(dsa=ext))
    assert r2["is_final"] and r2["next"]["type"] == "done"


def test_unsupported_quote_is_dropped_by_grounding():
    # The extractor claims O(n) but the candidate never said it.
    ext = DSAExtraction(paradigm="hashing", paradigm_evidence="use a hash map",
                        time_complexity="O(n)", time_evidence="it runs in linear time O(n)")
    r = svc.assess("dsa", "two_sum", "I would use a hash map.", extractor=FakeExtractor(dsa=ext))
    assert r["extraction"]["time_complexity"] is None
    assert r["grounding_rejected"]


def test_star_scoring_and_followup():
    txt = "In my second year our team missed a deadline. I reorganised the tasks and we shipped a week later."
    ext = STARExtraction(
        situation=STARComponent(present=True, evidence="our team missed a deadline"),
        task=STARComponent(present=False),
        action=STARComponent(present=True, evidence="I reorganised the tasks"),
        result=STARComponent(present=True, evidence="we shipped a week later"),
    )
    r = svc.assess("star", "deadline", txt, extractor=FakeExtractor(star=ext))
    assert r["score_01"] == pytest.approx(0.85)
    assert r["grade"]["missing"] == ["task"]
    assert r["next"]["type"] == "followup"
    assert r["topic"] == "Time Management"
    assert svc.attempt_fields(r)["verdict"] == "partial"


def test_bad_input_and_invalid_llm_output():
    with pytest.raises(svc.VerifiedError) as e:
        svc.assess("dsa", "two_sum", "   ", extractor=FakeExtractor())
    assert e.value.status == 400
    with pytest.raises(svc.VerifiedError) as e:
        svc.assess("dsa", "no_such_problem", "hello", extractor=FakeExtractor())
    assert e.value.status == 404
    with pytest.raises(svc.VerifiedError) as e:
        svc.assess("dsa", "two_sum", "hash map", extractor=FakeExtractor(dsa=DSAExtraction(), valid=False))
    assert e.value.status == 502


def test_llm_config_reuses_gemini_key(monkeypatch):
    monkeypatch.delenv("VERIFIED_LLM_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "abc")
    cfg = svc.llm_config()
    assert cfg.api_key == "abc" and "generativelanguage" in cfg.base_url


def test_gate_unlocks_at_threshold_and_ignores_other_topics():
    p = svc.compute_progress([], threshold=0.7)
    assert "Arrays & Hashing" in p["topics"] and not p["topics"]["Arrays & Hashing"]["unlocked"]
    assert "Tries" not in p["topics"]  # no warm-up questions -> never locked
    p = svc.compute_progress([
        {"topic": "Arrays & Hashing", "score": 0.6},
        {"topic": "Arrays & Hashing", "score": 0.7},
        {"topic": "Stack", "score": 0.5},
        {"topic": "Not a topic", "score": 1.0},
    ], threshold=0.7)
    a, st = p["topics"]["Arrays & Hashing"], p["topics"]["Stack"]
    assert a == {"best_score": 0.7, "attempts": 2, "unlocked": True}
    assert st == {"best_score": 0.5, "attempts": 1, "unlocked": False}


def test_every_gated_topic_has_questions():
    qs = svc.list_questions()
    topics_with_questions = {q["topic"] for q in qs["dsa"]}
    assert set(svc.gated_topics()) == topics_with_questions
    assert qs["unlock_threshold"] == svc.UNLOCK_THRESHOLD
