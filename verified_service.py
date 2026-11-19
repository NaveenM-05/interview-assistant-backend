"""Verified practice: the grading pipeline from our CSCT 2026 paper as an app feature.

How it differs from the main interview flow (main.py / llm_parser.py):
  * the LLM only EXTRACTS fields from the answer (approach, Big-O, STAR parts),
    each with a verbatim quote from the answer;
  * every quote is checked against the transcript, and unsupported fields are dropped;
  * the verdict, score and follow-up question come from a deterministic rule
    engine and a fixed rubric (data/rubric/), so the same answer always gets the
    same grade.

Warm-up gate: a DSA topic's coding interview unlocks once the candidate's best
finished warm-up answer in that topic scores >= UNLOCK_THRESHOLD (default 0.7).
Topics without warm-up questions in the rubric are never locked.

This module has no FastAPI or database imports so it can be unit-tested on its
own; verified_router.py exposes it over HTTP and verified_store.py saves attempts.
"""
from __future__ import annotations

import os
import time
from functools import lru_cache

from ia import pipeline, rubric
from ia.llm import LLMClient, LLMConfig, LLMExtractor
from ia.rubric import BehavioralQuestion, Problem
from ia.state import Session

MAX_FOLLOWUPS = 2
UNLOCK_THRESHOLD = float(os.getenv("VERIFIED_UNLOCK_THRESHOLD", "0.7"))
GEMINI_OPENAI_URL = "https://generativelanguage.googleapis.com/v1beta/openai"

# Rubric problems -> the topic names used by the rest of the app (frontend/src/lib/topics.js),
# so verified attempts are grouped under the same skills on the dashboard.
DSA_TOPIC = {
    "two_sum": "Arrays & Hashing",
    "contains_duplicate": "Arrays & Hashing",
    "product_except_self": "Arrays & Hashing",
    "merge_intervals": "Arrays & Hashing",
    "valid_parentheses": "Stack",
    "stock_profit": "Greedy",
    "max_subarray": "1D Dynamic Programming",
    "climbing_stairs": "1D Dynamic Programming",
    "coin_change": "1D Dynamic Programming",
    "longest_unique_substring": "Sliding Window",
    "sliding_window_max": "Sliding Window",
    "search_sorted": "Binary Search",
    "kth_largest": "Heaps / Priority Queues",
    "number_of_islands": "Graphs (BFS/DFS)",
    "course_schedule": "Advanced Graphs (Union-Find, Dijkstra, Topological Sort)",
    "network_delay": "Advanced Graphs (Union-Find, Dijkstra, Topological Sort)",
    "reverse_linked_list": "Linked Lists",
    "linked_list_cycle": "Linked Lists",
    "level_order": "Trees (including BSTs)",
    "trapping_rain_water": "Two Pointers",
}
STAR_TOPIC = {
    "conflict": "Conflict Resolution",
    "deadline": "Time Management",
    "failure": "Handling Failure",
    "leadership": "Leadership",
    "learning": "Adaptability",
}
# "codeswitch" was a robustness-test prompt for the paper, not a practice question.
HIDDEN_STAR = {"codeswitch"}


class VerifiedError(Exception):
    """Raised with an HTTP status code and a user-facing message."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


@lru_cache(maxsize=1)
def problems() -> dict[str, Problem]:
    return rubric.load_problems()


@lru_cache(maxsize=1)
def behavioral() -> dict[str, BehavioralQuestion]:
    return {k: v for k, v in rubric.load_behavioral().items() if k not in HIDDEN_STAR}


def list_questions() -> dict:
    return {
        "dsa": [
            {"id": p.id, "title": p.title, "question": p.question, "topic": DSA_TOPIC.get(p.id, "Arrays & Hashing")}
            for p in problems().values()
        ],
        "behavioral": [
            {"id": q.id, "title": STAR_TOPIC.get(q.id, q.id.title()), "question": q.question,
             "topic": STAR_TOPIC.get(q.id, "Leadership")}
            for q in behavioral().values()
        ],
        "max_followups": MAX_FOLLOWUPS,
        "unlock_threshold": UNLOCK_THRESHOLD,
    }


def llm_config() -> LLMConfig:
    """Reuses the app's GEMINI_API_KEY unless VERIFIED_LLM_* overrides are set."""
    return LLMConfig(
        base_url=os.getenv("VERIFIED_LLM_BASE_URL", GEMINI_OPENAI_URL),
        api_key=os.getenv("VERIFIED_LLM_API_KEY") or os.getenv("GEMINI_API_KEY", ""),
        model=os.getenv("VERIFIED_LLM_MODEL", "gemini-2.5-flash"),
        timeout_s=float(os.getenv("VERIFIED_LLM_TIMEOUT_S", "45")),
        max_tokens=int(os.getenv("VERIFIED_LLM_MAX_TOKENS", "4096")),
    )


def default_extractor():
    return LLMExtractor(LLMClient(llm_config()))


def _find_question(kind: str, question_id: str):
    if kind == "dsa":
        q = problems().get(question_id)
    elif kind == "star":
        q = behavioral().get(question_id)
    else:
        raise VerifiedError(400, "kind must be 'dsa' or 'star'.")
    if q is None:
        raise VerifiedError(404, f"Unknown {kind} question '{question_id}'.")
    return q


def assess(kind: str, question_id: str, transcript: str, followups_asked: int = 0, extractor=None) -> dict:
    """Grade one answer (the original answer plus any follow-up answers, joined).

    Stateless: the client sends the whole answer so far and how many follow-ups
    were already asked.  Returns the grade, the evidence quotes, and what the
    interviewer says next (another follow-up, or closing feedback).
    """
    transcript = (transcript or "").strip()
    if not transcript:
        raise VerifiedError(400, "The answer is empty. Speak or type an answer first.")
    if len(transcript) > 12000:
        raise VerifiedError(400, "The answer is too long (max 12,000 characters).")
    q = _find_question(kind, question_id)

    t0 = time.perf_counter()
    turn = pipeline.process_turn(transcript, q, extractor or default_extractor())
    total_ms = (time.perf_counter() - t0) * 1000
    if not turn.llm_meta.get("valid", True):
        raise VerifiedError(502, "The language model did not return a valid extraction. Please try again.")

    grade = turn.grade
    pending = list(grade.get("followups") or [])
    is_final = not pending or followups_asked >= MAX_FOLLOWUPS
    if is_final:
        next_step = {"type": "done", "prompt": Session._feedback(turn)}
    else:
        next_step = {"type": "followup", "prompt": pending[0]}

    if kind == "dsa":
        topic, title = DSA_TOPIC.get(q.id, "Arrays & Hashing"), q.title
        score_01 = round(grade["score"] / 10.0, 3)
        rubric_info = {"optimal_time": q.optimal_time, "optimal_space": q.optimal_space}
    else:
        topic = STAR_TOPIC.get(q.id, "Leadership")
        title = topic
        score_01 = round(grade["score"], 3)
        rubric_info = {}

    return {
        "kind": kind,
        "question_id": q.id,
        "title": title,
        "topic": topic,
        "transcript": transcript,
        "extraction": turn.extraction,
        "grade": grade,
        "score_01": score_01,
        "grounding_rejected": turn.grounding_rejected,
        "next": next_step,
        "is_final": is_final,
        "rubric": rubric_info,
        "timings_ms": {
            "llm_ms": round(turn.timings_ms.get("llm_ms", 0.0), 1),
            "rules_ms": round(turn.timings_ms.get("val_ms", 0.0), 2),
            "total_ms": round(total_ms, 1),
        },
        "llm": {"attempts": turn.llm_meta.get("attempts"), "model": llm_config().model},
    }


def gated_topics() -> list[str]:
    """DSA topics that have warm-up questions, in the order they appear in the rubric."""
    seen = []
    for pid in problems():
        t = DSA_TOPIC.get(pid)
        if t and t not in seen:
            seen.append(t)
    return seen


def compute_progress(attempts: list[dict], threshold: float | None = None) -> dict:
    """attempts: finished DSA warm-ups as dicts with 'topic' and 'score' (0-1).

    Returns {threshold, topics: {topic: {best_score, attempts, unlocked}}} for every
    gated topic.  Topics not listed here have no warm-up and are always open.
    """
    th = UNLOCK_THRESHOLD if threshold is None else threshold
    topics = {t: {"best_score": None, "attempts": 0, "unlocked": False} for t in gated_topics()}
    for a in attempts:
        info = topics.get(a.get("topic"))
        if info is None:
            continue
        score = float(a.get("score") or 0.0)
        info["attempts"] += 1
        info["best_score"] = score if info["best_score"] is None else max(info["best_score"], score)
    for info in topics.values():
        info["unlocked"] = info["best_score"] is not None and info["best_score"] >= th - 1e-9
    return {"threshold": th, "topics": topics}


def attempt_fields(result: dict) -> dict:
    """What verified_store saves for a finished warm-up."""
    g = result["grade"]
    return {
        "kind": result["kind"],
        "question_id": result["question_id"],
        "topic": result["topic"],
        "score": result["score_01"],
        "verdict": g.get("verdict") if result["kind"] == "dsa" else ("complete" if not g.get("missing") else "partial"),
    }
