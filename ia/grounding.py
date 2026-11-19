"""Evidence grounding: reject extracted fields whose quote is not in the transcript.

This is the deterministic anti-hallucination check described in the paper.
Every non-null field must carry a verbatim (fuzzy, to tolerate ASR noise and
minor paraphrase) quote from the transcript. If the quote cannot be located,
the field is nulled and the rejection is logged.
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Optional

from .schemas import DSAExtraction, STARExtraction, STAR_KEYS

THRESHOLD = 0.80


def _norm(s: str) -> list[str]:
    s = s.lower()
    s = re.sub(r"[^a-z0-9^()+ ]", " ", s)
    return s.split()


def support(quote: Optional[str], transcript: str) -> float:
    """Best fuzzy match ratio of ``quote`` against any same-length window of transcript.

    LLMs sometimes join non-adjacent spans with an ellipsis ("I listened ... I built a prototype").
    Each segment is then checked separately and the weakest segment decides.
    """
    if not quote:
        return 0.0
    segs = [x.strip() for x in re.split(r"\.{3,}|\u2026", quote) if len(_norm(x)) >= 2]
    if len(segs) > 1:
        return min(_support_one(x, transcript) for x in segs)
    return _support_one(quote, transcript)


def _support_one(quote: str, transcript: str) -> float:
    q, t = _norm(quote), _norm(transcript)
    if not q or not t:
        return 0.0
    qs = " ".join(q)
    if qs in " ".join(t):
        return 1.0
    n = len(q)
    best = 0.0
    for w in (n - 1, n, n + 1):
        if w <= 0:
            continue
        for i in range(0, max(1, len(t) - w + 1)):
            r = SequenceMatcher(None, qs, " ".join(t[i:i + w])).ratio()
            if r > best:
                best = r
                if best >= 0.999:
                    return best
    return best


def ground_dsa(ext: DSAExtraction, transcript: str, threshold: float = THRESHOLD):
    rejected = []
    data = ext.model_dump()
    for field, ev in (("paradigm", "paradigm_evidence"), ("time_complexity", "time_evidence"),
                      ("space_complexity", "space_evidence")):
        if data[field] is not None and support(data[ev], transcript) < threshold:
            rejected.append(field)
            data[field] = None
            data[ev] = None
    return DSAExtraction.model_validate(data), rejected


def ground_star(ext: STARExtraction, transcript: str, threshold: float = THRESHOLD):
    rejected = []
    data = ext.model_dump()
    for k in STAR_KEYS:
        if data[k]["present"] and support(data[k]["evidence"], transcript) < threshold:
            rejected.append(k)
            data[k] = {"present": False, "evidence": None}
    return STARExtraction.model_validate(data), rejected
