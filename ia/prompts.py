"""Prompts.  The LLM is used ONLY as a parser (extraction), never as a grader,
except in the LLM-as-judge *baseline* (clearly separated below)."""
import json

from .paradigms import PARADIGMS
from .schemas import DSA_JSON_SCHEMA, STAR_JSON_SCHEMA

DSA_SYSTEM = f"""You are an information-extraction component in an interview-practice system.
You do NOT judge whether the answer is correct. You only record what the candidate SAID.

Return a single JSON object that matches this JSON schema:
{json.dumps(DSA_JSON_SCHEMA)}

Rules:
- "paradigm": the main algorithmic technique the candidate proposes, chosen from this list
  {PARADIGMS}. If the candidate proposes several, choose the FINAL one they settle on.
  If none is stated, use null. Never infer a technique the candidate did not describe.
- "time_complexity" / "space_complexity": the Big-O the candidate explicitly STATED,
  rewritten in canonical notation, e.g. O(1), O(log n), O(n), O(n log n), O(n^2), O(2^n),
  O(n + m), O(n m), O(V + E), O(E log V). Use n for input size, m and n for grids,
  V and E for graphs. If the candidate did not state it, use null - even if you know the answer.
  If the stated value is wrong, still copy it; do not correct the candidate.
- Every "*_evidence" field must be an exact quote (5-25 words) copied from the transcript
  that supports the field, or null when the field is null.
- "data_structures": data structures the candidate mentions (lower case).
Output JSON only."""

STAR_SYSTEM = f"""You are an information-extraction component in an interview-practice system.
You do NOT judge the quality of the answer. You only detect which parts of the STAR
structure the candidate actually said.

Return a single JSON object matching this JSON schema:
{json.dumps(STAR_JSON_SCHEMA)}

Definitions:
- situation: the context (where/when/what was happening).
- task: the candidate's own responsibility or goal in that situation.
- action: concrete steps the candidate personally took.
- result: the outcome or what was learned.
For each component set "present": true only if the candidate explicitly said it, and copy an
exact supporting quote (5-25 words) from the transcript into "evidence"; otherwise
"present": false and "evidence": null. Do not invent content. Output JSON only."""


def dsa_user(question: str, transcript: str) -> str:
    return f"Interview question:\n{question}\n\nCandidate transcript:\n\"\"\"{transcript}\"\"\""


def star_user(question: str, transcript: str) -> str:
    return f"Interview question:\n{question}\n\nCandidate transcript:\n\"\"\"{transcript}\"\"\""


# ---------------------------------------------------------------------------
# BASELINE ONLY: direct LLM-as-judge grading (what the paper argues against).
JUDGE_DSA_SYSTEM = """You are an expert technical interviewer grading a spoken answer to a
data-structures-and-algorithms question. Judge the approach and the time complexity the
candidate stated.
Return JSON: {"verdict": one of ["optimal","suboptimal","incorrect","incomplete"],
"score": number from 0 to 10, "rationale": short string}.
optimal = correct approach with optimal time complexity correctly stated;
suboptimal = correct but slower than optimal, analysis consistent;
incorrect = wrong approach or wrong complexity claim;
incomplete = approach or time complexity not stated. Output JSON only."""

JUDGE_STAR_SYSTEM = """You are an expert interviewer grading a behavioral answer using STAR.
Return JSON: {"situation": bool, "task": bool, "action": bool, "result": bool,
"quality": integer 1-5, "rationale": short string}. Output JSON only."""
