"""Structured-extraction schemas (what the LLM must return)."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator

from . import bigo, paradigms


class DSAExtraction(BaseModel):
    paradigm: Optional[str] = Field(None, description="primary algorithmic paradigm, from the closed vocabulary")
    paradigm_evidence: Optional[str] = Field(None, description="verbatim quote from the transcript")
    data_structures: list[str] = Field(default_factory=list)
    time_complexity: Optional[str] = Field(None, description="Big-O the candidate STATED for time")
    time_evidence: Optional[str] = None
    space_complexity: Optional[str] = Field(None, description="Big-O the candidate STATED for space")
    space_evidence: Optional[str] = None

    @field_validator("paradigm", mode="before")
    @classmethod
    def _norm_paradigm(cls, v):
        return paradigms.normalize(v)

    @field_validator("time_complexity", "space_complexity", mode="before")
    @classmethod
    def _norm_bigo(cls, v):
        return bigo.canonicalize(v)

    @field_validator("data_structures", mode="before")
    @classmethod
    def _norm_ds(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            v = [v]
        return sorted({str(x).strip().lower() for x in v if str(x).strip()})


class STARComponent(BaseModel):
    present: bool = False
    evidence: Optional[str] = None


class STARExtraction(BaseModel):
    situation: STARComponent = Field(default_factory=STARComponent)
    task: STARComponent = Field(default_factory=STARComponent)
    action: STARComponent = Field(default_factory=STARComponent)
    result: STARComponent = Field(default_factory=STARComponent)


STAR_KEYS = ("situation", "task", "action", "result")

DSA_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "paradigm": {"type": ["string", "null"], "enum": paradigms.PARADIGMS + [None]},
        "paradigm_evidence": {"type": ["string", "null"]},
        "data_structures": {"type": "array", "items": {"type": "string"}},
        "time_complexity": {"type": ["string", "null"]},
        "time_evidence": {"type": ["string", "null"]},
        "space_complexity": {"type": ["string", "null"]},
        "space_evidence": {"type": ["string", "null"]},
    },
    "required": ["paradigm", "paradigm_evidence", "data_structures", "time_complexity",
                 "time_evidence", "space_complexity", "space_evidence"],
}

_COMP = {"type": "object", "properties": {"present": {"type": "boolean"},
                                          "evidence": {"type": ["string", "null"]}},
         "required": ["present", "evidence"]}
STAR_JSON_SCHEMA = {"type": "object", "properties": {k: _COMP for k in STAR_KEYS},
                    "required": list(STAR_KEYS)}
