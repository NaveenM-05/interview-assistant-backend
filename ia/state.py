"""Conversation state manager: decides the next spoken prompt."""
from __future__ import annotations

from dataclasses import dataclass, field

from .rubric import BehavioralQuestion, Problem


@dataclass
class Session:
    questions: list                      # list[Problem | BehavioralQuestion]
    max_followups: int = 2
    idx: int = 0
    followups_asked: int = 0
    history: list = field(default_factory=list)

    @property
    def current(self):
        return self.questions[self.idx] if self.idx < len(self.questions) else None

    def opening(self) -> str:
        q = self.current
        return f"Let's begin. {q.question}" if q else "No questions configured."

    def next_prompt(self, turn) -> str:
        """Given the TurnResult for the current question, return what the assistant says next."""
        self.history.append({"question_id": self.current.id, "turn": turn.to_dict()})
        follow = turn.grade.get("followups", [])
        if follow and self.followups_asked < self.max_followups:
            self.followups_asked += 1
            return follow[0]
        # move on
        feedback = self._feedback(turn)
        self.idx += 1
        self.followups_asked = 0
        nxt = self.current
        if nxt is None:
            return f"{feedback} That completes the practice session. Well done."
        return f"{feedback} Next question. {nxt.question}"

    @staticmethod
    def _feedback(turn) -> str:
        g = turn.grade
        if turn.qtype == "dsa":
            return {"optimal": "Good - that is the optimal approach.",
                    "suboptimal": "That works, though a faster approach exists.",
                    "incorrect": "Let's revisit that analysis later.",
                    "incomplete": "Let's move on for now.",
                    "unverifiable": "That is an approach I can't verify automatically; it's flagged for review."}[g["verdict"]]
        pct = round(100 * g["score"])
        return f"Your answer covered {pct} percent of the STAR structure."
