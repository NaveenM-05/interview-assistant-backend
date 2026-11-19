"""Verified grading core from the CSCT 2026 paper (Paper 259).

The LLM only *extracts* fields from the answer, each backed by a verbatim quote
that is checked against the transcript (grounding.py).  All grading is done by
the deterministic rule engine (rules.py) against the rubric in data/rubric/.
Used by verified_service.py / verified_router.py.
"""
