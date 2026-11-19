"""HTTP endpoints for the Verified warm-up (see verified_service.py).

    GET  /api/verified/questions             -> warm-up questions (20 DSA problems + STAR prompts)
    POST /api/verified/assess                -> grade an answer; returns verdict, evidence, next prompt,
                                                and (when finished) the topic's unlock status
    GET  /api/verified/progress/{user_id}    -> which DSA topics are unlocked for coding

Mounted in main.py with app.include_router(verified_router).  Uses its own
table (verified_attempts); nothing is written to the existing tables.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

import verified_service as svc
import verified_store as store  # importing registers the verified_attempts table before create_all
from ia.llm import LLMConfigError, LLMError

router = APIRouter(prefix="/api/verified", tags=["verified-warmup"])


class AssessRequest(BaseModel):
    kind: str = Field(..., description="'dsa' or 'star'")
    question_id: str
    transcript: str
    followups_asked: int = 0
    user_id: str = "test_user_123"


def _progress(user_id: str) -> dict:
    return svc.compute_progress(store.load_dsa_attempts(user_id))


@router.get("/questions")
def get_questions():
    return svc.list_questions()


@router.get("/progress/{user_id}")
async def get_progress(user_id: str):
    try:
        return await run_in_threadpool(_progress, user_id)
    except Exception as err:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"Could not load warm-up progress: {err}") from err


@router.post("/assess")
async def assess(payload: AssessRequest):
    try:
        # The LLM call is blocking (urllib), so keep it off the event loop.
        result = await run_in_threadpool(
            svc.assess,
            payload.kind.strip().lower(),
            payload.question_id.strip(),
            payload.transcript,
            max(0, payload.followups_asked),
        )
    except svc.VerifiedError as err:
        raise HTTPException(status_code=err.status, detail=err.message) from err
    except LLMConfigError as err:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not set on the server (.env).") from err
    except LLMError as err:
        raise HTTPException(status_code=502, detail=f"The language model request failed: {err}") from err

    result["saved"] = False
    result["unlock"] = None
    if result["is_final"]:
        # Best effort: a database problem must never hide the grade from the user.
        try:
            before = None
            if result["kind"] == "dsa":
                before = (await run_in_threadpool(_progress, payload.user_id))["topics"].get(result["topic"])
            await run_in_threadpool(store.save_attempt, payload.user_id, svc.attempt_fields(result))
            result["saved"] = True
            if result["kind"] == "dsa":
                progress = await run_in_threadpool(_progress, payload.user_id)
                info = progress["topics"].get(result["topic"])
                if info is not None:
                    result["unlock"] = {
                        "topic": result["topic"],
                        "threshold": progress["threshold"],
                        "best_score": info["best_score"],
                        "unlocked": info["unlocked"],
                        "just_unlocked": info["unlocked"] and not (before or {}).get("unlocked", False),
                    }
        except Exception as err:  # noqa: BLE001
            print(f"[verified] could not save warm-up attempt: {err}")
    return result
