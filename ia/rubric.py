"""Problem rubric loading."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from . import bigo, paradigms

DATA = Path(__file__).resolve().parent.parent / "data"


@dataclass
class Problem:
    id: str
    title: str
    question: str
    accepted_paradigms: list[str]
    optimal_time: list[str]
    optimal_space: list[str]
    acceptable_suboptimal: list[dict] = field(default_factory=list)
    incorrect_paradigms: list[str] = field(default_factory=list)
    hint: str = ""
    reference_answer: str = ""

    def __post_init__(self):
        self.accepted_paradigms = [paradigms.normalize(p) for p in self.accepted_paradigms]
        self.optimal_time = [bigo.canonicalize(t) for t in self.optimal_time]
        self.optimal_space = [bigo.canonicalize(t) for t in self.optimal_space]
        self.acceptable_suboptimal = [
            {"paradigm": paradigms.normalize(s["paradigm"]), "time": bigo.canonicalize(s["time"])}
            for s in self.acceptable_suboptimal
        ]
        self.incorrect_paradigms = [paradigms.normalize(p) for p in self.incorrect_paradigms]
        for s in self.acceptable_suboptimal:
            assert s["time"] is not None and s["paradigm"] not in (None, "other"), f"rubric {self.id}: bad suboptimal entry"
        for t in self.optimal_time + self.optimal_space:
            assert t is not None, f"rubric {self.id}: unparsable complexity"


@dataclass
class BehavioralQuestion:
    id: str
    question: str


def load_problems(path: Path | None = None) -> dict[str, Problem]:
    path = path or DATA / "rubric" / "dsa_problems.json"
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    return {p["id"]: Problem(**p) for p in raw["problems"]}


def load_behavioral(path: Path | None = None) -> dict[str, BehavioralQuestion]:
    path = path or DATA / "rubric" / "behavioral_questions.json"
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    return {q["id"]: BehavioralQuestion(id=q["id"], question=q["question"]) for q in raw["questions"]}
