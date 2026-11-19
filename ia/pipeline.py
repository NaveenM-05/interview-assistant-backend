"""(Copied from the CSCT 2026 research code.) One conversational turn: transcript -> extraction -> grounding -> rules -> next prompt.

This exact function is used by the cloud server, by local-only mode, and by the
offline evaluation scripts, so the numbers in the paper come from the code that runs.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

from . import grounding, rules
from .rubric import BehavioralQuestion, Problem


@dataclass
class TurnResult:
    qtype: str
    extraction: dict
    grade: dict
    grounding_rejected: list
    llm_meta: dict
    timings_ms: dict = field(default_factory=dict)

    def to_dict(self):
        return {"qtype": self.qtype, "extraction": self.extraction, "grade": self.grade,
                "grounding_rejected": self.grounding_rejected, "llm_meta": {k: v for k, v in self.llm_meta.items() if k != "raw"},
                "timings_ms": self.timings_ms}


def process_turn(transcript: str, question, extractor, use_grounding: bool = True,
                 star_weights: dict | None = None) -> TurnResult:
    if isinstance(question, Problem):
        ext, meta = extractor.extract_dsa(question.question, transcript)
        t0 = time.perf_counter()
        rejected = []
        if use_grounding:
            ext, rejected = grounding.ground_dsa(ext, transcript)
        g = rules.grade_dsa(ext, question)
        val_ms = (time.perf_counter() - t0) * 1000
        return TurnResult("dsa", ext.model_dump(), g.to_dict(), rejected, meta,
                          {"llm_ms": meta["llm_ms"], "val_ms": val_ms})
    if isinstance(question, BehavioralQuestion):
        ext, meta = extractor.extract_star(question.question, transcript)
        t0 = time.perf_counter()
        rejected = []
        if use_grounding:
            ext, rejected = grounding.ground_star(ext, transcript)
        g = rules.grade_star(ext, star_weights)
        val_ms = (time.perf_counter() - t0) * 1000
        return TurnResult("star", ext.model_dump(), g.to_dict(), rejected, meta,
                          {"llm_ms": meta["llm_ms"], "val_ms": val_ms})
    raise TypeError(f"unknown question type {type(question)}")
