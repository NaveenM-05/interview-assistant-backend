"""LLM client for an OpenAI-compatible chat-completions endpoint.

Works with: Groq, Google Gemini (OpenAI-compatible endpoint), OpenAI, OpenRouter,
Together, and local Ollama / llama.cpp / vLLM servers.  Configure with env vars:

    LLM_BASE_URL   e.g. https://api.groq.com/openai/v1
                        https://generativelanguage.googleapis.com/v1beta/openai
                        http://localhost:11434/v1          (Ollama, for local-only mode)
    LLM_API_KEY    (any non-empty string for Ollama)
    LLM_MODEL      e.g. llama-3.3-70b-versatile, gemini-2.5-flash, qwen2.5:7b-instruct

Only the Python standard library is used for HTTP.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass

from pydantic import ValidationError

from . import prompts
from .schemas import DSAExtraction, STARExtraction


@dataclass
class LLMConfig:
    base_url: str = os.environ.get("LLM_BASE_URL", "https://api.groq.com/openai/v1")
    api_key: str = os.environ.get("LLM_API_KEY", "")
    model: str = os.environ.get("LLM_MODEL", "llama-3.3-70b-versatile")
    temperature: float = 0.0
    max_retries: int = 2          # schema-repair retries
    timeout_s: float = 120.0
    max_tokens: int = int(os.environ.get("LLM_MAX_TOKENS", "8192"))
    json_mode: bool = True


class LLMError(RuntimeError):
    pass


class LLMConfigError(RuntimeError):
    """Setup problem (e.g. key not loaded): must stop the run, never be recorded as a result."""


class LLMClient:
    def __init__(self, cfg: LLMConfig | None = None):
        self.cfg = cfg or LLMConfig()

    def chat(self, system: str, user: str, temperature: float | None = None) -> tuple[str, float]:
        if not self.cfg.api_key and "localhost" not in self.cfg.base_url and "127.0.0.1" not in self.cfg.base_url:
            raise LLMConfigError(f"LLM_API_KEY is not set (LLM_BASE_URL={self.cfg.base_url}). Load your .env into this terminal first.")
        body = {
            "model": self.cfg.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": self.cfg.temperature if temperature is None else temperature,
            # cap runaway generations (normal answers use well under 2k tokens); a truncated reply
            # fails JSON validation and goes through the normal repair retry
            "max_tokens": self.cfg.max_tokens,
        }
        if self.cfg.json_mode:
            body["response_format"] = {"type": "json_object"}
        req = urllib.request.Request(
            self.cfg.base_url.rstrip("/") + "/chat/completions",
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json", "User-Agent": "interview-assistant/1.0",
                     "Authorization": f"Bearer {self.cfg.api_key or 'none'}"},
        )
        t0 = time.perf_counter()
        for attempt in range(5):  # transport-level retry for 429/5xx, timeouts and dropped connections
            try:
                with urllib.request.urlopen(req, timeout=self.cfg.timeout_s) as r:
                    data = json.loads(r.read())
                break
            except urllib.error.HTTPError as e:
                if e.code in (429, 500, 502, 503, 504) and attempt < 4:
                    time.sleep(2 ** attempt * 2)
                    t0 = time.perf_counter()  # do not count back-off in latency
                    continue
                raise LLMError(f"HTTP {e.code}: {e.read()[:300]!r}") from e
            except (TimeoutError, ConnectionError, urllib.error.URLError) as e:
                if attempt < 4:
                    print(f"  network problem ({e.__class__.__name__}); retrying in {2 ** attempt * 2}s", flush=True)
                    time.sleep(2 ** attempt * 2)
                    t0 = time.perf_counter()
                    continue
                raise LLMError(f"network error after 5 attempts: {e}") from e
        ms = (time.perf_counter() - t0) * 1000
        return data["choices"][0]["message"]["content"], ms


def _parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[text.find("{"):]
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < 0:
        raise ValueError("no JSON object in output")
    return json.loads(text[start:end + 1])


class LLMExtractor:
    """Schema-constrained extraction with validation + bounded repair retries."""

    name = "llm"

    def __init__(self, client: LLMClient | None = None):
        self.client = client or LLMClient()

    def _extract(self, system, user, model_cls):
        meta = {"attempts": 0, "llm_ms": 0.0, "valid_first_try": False, "valid": False,
                "errors": [], "raw": None}
        msg = user
        for attempt in range(self.client.cfg.max_retries + 1):
            meta["attempts"] += 1
            raw, ms = self.client.chat(system, msg)
            meta["llm_ms"] += ms
            meta["raw"] = raw
            try:
                obj = model_cls.model_validate(_parse_json(raw))
                meta["valid"] = True
                meta["valid_first_try"] = attempt == 0
                return obj, meta
            except (ValueError, ValidationError) as e:
                meta["errors"].append(str(e)[:300])
                msg = user + f"\n\nYour previous output was invalid ({str(e)[:200]}). Return ONLY valid JSON matching the schema."
        return model_cls(), meta  # empty extraction: everything null / absent

    def extract_dsa(self, question: str, transcript: str):
        return self._extract(prompts.DSA_SYSTEM, prompts.dsa_user(question, transcript), DSAExtraction)

    def extract_star(self, question: str, transcript: str):
        return self._extract(prompts.STAR_SYSTEM, prompts.star_user(question, transcript), STARExtraction)


class LLMJudge:
    """BASELINE: the LLM grades directly (no extraction, no rules)."""

    def __init__(self, client: LLMClient | None = None, temperature: float = 0.0):
        self.client = client or LLMClient()
        self.temperature = temperature

    def judge_dsa(self, question: str, transcript: str) -> tuple[dict, float]:
        raw, ms = self.client.chat(prompts.JUDGE_DSA_SYSTEM, prompts.dsa_user(question, transcript),
                                   temperature=self.temperature)
        try:
            d = _parse_json(raw)
            v = str(d.get("verdict", "")).lower()
            d["verdict"] = v if v in ("optimal", "suboptimal", "incorrect", "incomplete") else "invalid"
            d["score"] = float(d.get("score", float("nan")))
        except Exception:
            d = {"verdict": "invalid", "score": float("nan")}
        return d, ms

    def judge_star(self, question: str, transcript: str) -> tuple[dict, float]:
        raw, ms = self.client.chat(prompts.JUDGE_STAR_SYSTEM, prompts.star_user(question, transcript),
                                   temperature=self.temperature)
        try:
            d = _parse_json(raw)
            for k in ("situation", "task", "action", "result"):
                d[k] = bool(d.get(k, False))
            d["quality"] = float(d.get("quality", float("nan")))
        except Exception:
            d = {"situation": False, "task": False, "action": False, "result": False, "quality": float("nan")}
        return d, ms
