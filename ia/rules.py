"""Deterministic rule engine.  No LLM is involved in grading.

Given the structured extraction and the problem rubric, produce a verdict,
a 0-10 score, the reasons, and the follow-up prompt(s).  Same input -> same
output, always.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Optional

from . import bigo
from .rubric import Problem
from .schemas import DSAExtraction, STARExtraction, STAR_KEYS

DSA_VERDICTS = ["optimal", "suboptimal", "incorrect", "incomplete", "unverifiable"]
DEFAULT_STAR_WEIGHTS = {"situation": 0.15, "task": 0.15, "action": 0.40, "result": 0.30}


@dataclass
class DSAGrade:
    verdict: str
    score: float
    paradigm_status: str
    time_status: str
    space_status: str
    reasons: list[str] = field(default_factory=list)
    followups: list[str] = field(default_factory=list)

    def to_dict(self):
        return asdict(self)


@dataclass
class STARGrade:
    score: float
    components: dict
    missing: list[str]
    followups: list[str]

    def to_dict(self):
        return asdict(self)


def _paradigm_status(p: Optional[str], prob: Problem) -> tuple[str, list[str]]:
    """Returns (status, expected_times_for_that_paradigm)."""
    if p is None:
        return "missing", []
    if p in prob.accepted_paradigms:
        return "accepted", []
    if p in prob.incorrect_paradigms:
        return "inapplicable", []
    exp = [s["time"] for s in prob.acceptable_suboptimal if s["paradigm"] == p]
    if exp:
        return "suboptimal", exp
    return "unlisted", []


def grade_dsa(ext: DSAExtraction, prob: Problem) -> DSAGrade:
    reasons, follow = [], []
    p_status, expected_t = _paradigm_status(ext.paradigm, prob)
    t = ext.time_complexity

    # --- time complexity status, relative to the paradigm the candidate chose
    if t is None:
        t_status = "missing"
    elif p_status == "suboptimal":
        if t in expected_t:
            t_status = "consistent_suboptimal"
        else:
            rel = bigo.compare(t, expected_t)
            t_status = {"better_than_possible": "wrong_for_approach", "worse": "wrong_for_approach",
                        "unverifiable": "unverifiable"}.get(rel, rel)
    else:
        t_status = bigo.compare(t, prob.optimal_time)

    s = ext.space_complexity
    if s is None:
        s_status = "missing"
    else:
        s_status = "optimal" if s in prob.optimal_space else "non_optimal"

    # --- verdict
    if p_status == "inapplicable":
        verdict = "incorrect"
    elif p_status == "missing" or t_status == "missing":
        verdict = "incomplete"
    elif t_status in ("better_than_possible", "wrong_for_approach"):
        verdict = "incorrect"
    elif p_status == "unlisted" or t_status == "unverifiable":
        verdict = "unverifiable"
    elif p_status == "accepted" and t_status == "optimal":
        verdict = "optimal"
    else:  # accepted+worse, or listed suboptimal with consistent analysis
        verdict = "suboptimal"

    # --- score (0-10)
    score = {"accepted": 4, "suboptimal": 2}.get(p_status, 0)
    score += {"optimal": 4, "consistent_suboptimal": 2, "worse": 2}.get(t_status, 0)
    score += {"optimal": 2, "non_optimal": 1}.get(s_status, 0)

    # --- reasons + follow-ups (priority order; state manager asks the first)
    if p_status == "missing":
        reasons.append("No algorithmic approach was identified.")
        follow.append("Could you describe the overall approach or algorithm you would use?")
    if t_status == "missing":
        reasons.append("Time complexity was not stated.")
        follow.append("What is the time complexity of that approach?")
    if t_status == "better_than_possible":
        reasons.append(f"Claimed {t} is better than the best known bound {prob.optimal_time[0]}.")
        follow.append(f"You said {t}. Can you walk me through the cost of each step to double-check that?")
    if t_status == "wrong_for_approach":
        reasons.append(f"Claimed {t}, but this approach runs in {' or '.join(expected_t)}.")
        follow.append(f"Let's re-check the analysis: what does each step of your approach cost? (Hint: it is not {t}.)")
    if p_status == "inapplicable":
        reasons.append(f"Approach '{ext.paradigm}' does not solve this problem correctly in general.")
        follow.append(f"Does '{ext.paradigm.replace('_', ' ')}' always give the correct answer here? Can you think of a counter-example?")
    if verdict == "suboptimal":
        reasons.append(f"Correct but not optimal; optimal time is {prob.optimal_time[0]}.")
        follow.append(f"That works. Can you improve on {t}? {prob.hint}".strip())
    if p_status == "unlisted":
        reasons.append(f"Approach '{ext.paradigm}' is not in the rubric; flagged for human review.")
    if s_status == "missing" and verdict in ("optimal", "suboptimal"):
        follow.append("And what is the space complexity?")
    if verdict == "optimal":
        reasons.append("Approach and time complexity match the optimal rubric entry.")

    return DSAGrade(verdict, float(score), p_status, t_status, s_status, reasons, follow)


STAR_FOLLOWUPS = {
    "situation": "Could you briefly set the scene - where and when did this happen?",
    "task": "What specifically were you responsible for in that situation?",
    "action": "What exact steps did you personally take?",
    "result": "What was the outcome, and can you quantify it or say what you learned?",
}


def star_score(flags: dict, weights: dict | None = None) -> float:
    w = weights or DEFAULT_STAR_WEIGHTS
    return float(sum(w[k] * (1 if flags[k] else 0) for k in STAR_KEYS))


def grade_star(ext: STARExtraction, weights: dict | None = None) -> STARGrade:
    w = weights or DEFAULT_STAR_WEIGHTS
    flags = {k: bool(getattr(ext, k).present) for k in STAR_KEYS}
    missing = [k for k in sorted(STAR_KEYS, key=lambda k: -w[k]) if not flags[k]]
    return STARGrade(star_score(flags, w), flags, missing, [STAR_FOLLOWUPS[k] for k in missing])
