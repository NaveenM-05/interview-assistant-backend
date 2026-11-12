from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
import asyncio
import time
import json
import uuid

from database import engine, SessionLocal, get_db
from models import (
    Base,
    ProblemRubric,
    PerformanceRecord,
    DynamicSession,
    MessageHistory,
)
from llm_parser import (
    extract_dsa_schema,
    extract_star_schema,
    generate_interview_question,
    generate_interviewer_turn,
    generate_teacher_evaluation,
    stream_interviewer_turn,
    extract_interviewer_metrics,
    stream_teacher_evaluation,
    extract_teacher_metrics,
)
from validator import (
    VALID_DSA_TOPICS,
    VALID_BEHAVIORAL_TOPICS,
    validate_dsa_answer,
    validate_behavioral_answer,
    validate_dynamic_turn,
    validate_final_evaluation,
)
from recommendation_service import get_user_recommendations

# Ensure all tables (including dynamic_sessions and message_history) exist
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Interview Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateQuestionRequest(BaseModel):
    topic: str = VALID_DSA_TOPICS[0]
    difficulty: str = "Medium"
    interview_type: str = "DSA"


# ============================================================
# GENERATIVE QUESTION ENDPOINT
# ============================================================


@app.post("/generate_question")
def create_dynamic_question(
    payload: GenerateQuestionRequest,
    db: Session = Depends(get_db),
):
    topic = payload.topic.strip()
    interview_type = (payload.interview_type or "DSA").strip().upper()
    difficulty = (
        "Behavioral"
        if interview_type == "BEHAVIORAL"
        else (payload.difficulty.strip() or "Medium")
    )

    if not topic:
        raise HTTPException(status_code=400, detail="Topic is required.")

    generated = generate_interview_question(
        topic=topic,
        difficulty=difficulty,
        interview_type=interview_type,
    )
    new_session_id = str(uuid.uuid4())

    dynamic_session = DynamicSession(
        session_id=new_session_id,
        topic=topic,
        difficulty=difficulty,
        generated_question=generated["generated_question"],
        optimal_paradigm=generated["optimal_paradigm"],
        optimal_time=generated["optimal_time"],
        optimal_space=generated["optimal_space"],
        optimal_solution_text=generated["optimal_solution_text"],
    )
    db.add(dynamic_session)
    db.flush()

    history = MessageHistory(
        session_id=new_session_id,
        messages=[],
    )
    db.add(history)
    db.commit()
    db.refresh(dynamic_session)

    return {
        "session_id": dynamic_session.session_id,
        "interview_type": interview_type,
        "topic": dynamic_session.topic,
        "difficulty": dynamic_session.difficulty,
        "generated_question": dynamic_session.generated_question,
    }


# ============================================================
# DASHBOARD & RECOMMENDATION API
# ============================================================


def _build_dashboard_payload(db: Session, user_id: str) -> dict:
    recs = get_user_recommendations(
        db=db,
        user_id=user_id,
        top_n=None,
    )
    if not recs:
        return {
            "user_id": user_id,
            "average_accuracy": 0,
            "weakest_skill": None,
            "top_priority_skill": None,
            "total_skills": 0,
            "recommendations": [],
        }

    avg_acc = round(
        sum(float(r.get("accuracy") or 0) for r in recs) / len(recs)
    )
    weakest = min(
        recs,
        key=lambda r: (float(r.get("accuracy") or 0), -(r.get("attempts") or 0)),
    )
    top_priority = max(
        recs,
        key=lambda r: (float(r.get("priority") or 0), r.get("last_attempt", "")),
    )

    return {
        "user_id": user_id,
        "average_accuracy": avg_acc,
        "weakest_skill": weakest,
        "top_priority_skill": top_priority,
        "total_skills": len(recs),
        "recommendations": recs,
    }


@app.get("/api/dashboard/{user_id}")
def get_dashboard(
    user_id: str,
    db: Session = Depends(get_db),
):
    return _build_dashboard_payload(db=db, user_id=user_id)


@app.get("/recommendations/{user_id}")
def recommendations(
    user_id: str,
    db: Session = Depends(get_db),
):
    return _build_dashboard_payload(db=db, user_id=user_id)


# ============================================================
# INTERVIEW WEBSOCKET
# ============================================================


@app.websocket("/ws/interview/{session_id}")
async def interview_websocket(
    websocket: WebSocket,
    session_id: str,
):
    await websocket.accept()
    print(f"Session {session_id} connected.")

    try:
        while True:
            message = await websocket.receive_text()
            start_time = time.perf_counter()
            print(f"Received message: {message}")

            try:
                request_data = json.loads(message)
            except json.JSONDecodeError:
                await websocket.send_text(
                    json.dumps({"error": "Invalid JSON payload."})
                )
                continue

            action = request_data.get("action")
            user_id = request_data.get("user_id", "test_user_123")
            code_payload = request_data.get("code") or ""

            with SessionLocal() as db:
                # Fetch DynamicSession and past MessageHistory from the database if present
                dynamic_session = (
                    db.query(DynamicSession)
                    .filter(DynamicSession.session_id == session_id)
                    .first()
                )

                history_record = None
                if dynamic_session:
                    history_record = (
                        db.query(MessageHistory)
                        .filter(MessageHistory.session_id == session_id)
                        .first()
                    )
                    if not history_record:
                        history_record = MessageHistory(
                            session_id=session_id,
                            messages=[],
                        )
                        db.add(history_record)
                        db.commit()
                        db.refresh(history_record)

                # ==================================================
                # CASE A: DYNAMIC MULTI-TURN SESSION
                # ==================================================
                if dynamic_session:
                    chat_messages = list(history_record.messages or [])

                    async def _stream_chunks(async_gen) -> str:
                        chunks = []
                        async for text_chunk in async_gen:
                            if text_chunk:
                                chunks.append(text_chunk)
                                await websocket.send_json(
                                    {"type": "chunk", "text": text_chunk}
                                )
                        return "".join(chunks).strip()

                    async def _with_timeout(coro, fallback_dict: dict) -> dict:
                        try:
                            return await asyncio.wait_for(coro, timeout=15.0)
                        except Exception as err:
                            print(f"Metrics extraction timed out or failed: {err}")
                            return fallback_dict

                    # 1. Final Evaluation Trigger ("Teacher" mode)
                    if action == "evaluate_final":
                        final_transcript = (
                            request_data.get("transcript") or ""
                        ).strip()
                        if final_transcript or code_payload.strip():
                            chat_messages.append(
                                {
                                    "role": "user",
                                    "content": final_transcript,
                                    "code": code_payload,
                                }
                            )

                        t_llm_start = time.perf_counter()
                        streamed_feedback, teacher_metrics = await asyncio.gather(
                            _stream_chunks(
                                stream_teacher_evaluation(
                                    question_text=dynamic_session.generated_question,
                                    optimal_paradigm=dynamic_session.optimal_paradigm,
                                    optimal_time=dynamic_session.optimal_time,
                                    optimal_space=dynamic_session.optimal_space,
                                    optimal_solution_text=dynamic_session.optimal_solution_text,
                                    chat_history=chat_messages,
                                    code=code_payload,
                                )
                            ),
                            _with_timeout(
                                extract_teacher_metrics(
                                    question_text=dynamic_session.generated_question,
                                    optimal_paradigm=dynamic_session.optimal_paradigm,
                                    optimal_time=dynamic_session.optimal_time,
                                    optimal_space=dynamic_session.optimal_space,
                                    optimal_solution_text=dynamic_session.optimal_solution_text,
                                    chat_history=chat_messages,
                                    code=code_payload,
                                ),
                                {
                                    "score": 0,
                                    "paradigm": "None",
                                    "algorithmic_paradigm": "None",
                                    "time_complexity": "None",
                                    "space_complexity": "None",
                                    "paradigm_correct": False,
                                    "time_complexity_correct": False,
                                    "space_complexity_correct": False,
                                    "optimal_code_snippet": "",
                                },
                            ),
                        )
                        t_llm_end = time.perf_counter()

                        teacher_output = {
                            **teacher_metrics,
                            "teacher_feedback": streamed_feedback
                            or teacher_metrics.get("teacher_feedback")
                            or "Session concluded. Review the optimal solution below.",
                        }

                        t_val_start = time.perf_counter()
                        validation_result = validate_final_evaluation(
                            teacher_output,
                            dynamic_session,
                        )
                        t_val_end = time.perf_counter()

                        # Save final score to PerformanceRecord for the dashboard
                        performance_record = PerformanceRecord(
                            user_id=user_id,
                            skill=dynamic_session.topic,
                            paradigm_correct=validation_result["paradigm_correct"],
                            time_complexity_correct=validation_result[
                                "time_complexity_correct"
                            ],
                            space_complexity_correct=validation_result[
                                "space_complexity_correct"
                            ],
                            score=validation_result["score"],
                        )
                        db.add(performance_record)
                        db.commit()
                        db.refresh(performance_record)

                        teacher_prompt = validation_result["teacher_feedback"]
                        optimal_code_snippet = validation_result.get(
                            "optimal_code_snippet", ""
                        )

                        chat_messages.append(
                            {
                                "role": "teacher",
                                "content": teacher_prompt,
                                "optimal_solution_text": dynamic_session.optimal_solution_text,
                                "optimal_code_snippet": optimal_code_snippet,
                                "score": validation_result["score"],
                            }
                        )
                        history_record.messages = chat_messages
                        flag_modified(history_record, "messages")
                        db.commit()

                        t_llm_latency_ms = round(
                            (t_llm_end - t_llm_start) * 1000, 2
                        )
                        t_val_latency_ms = round(
                            (t_val_end - t_val_start) * 1000, 2
                        )
                        total_latency_ms = round(
                            (time.perf_counter() - start_time) * 1000, 2
                        )

                        response = {
                            "type": "done",
                            "action": "evaluate_final",
                            "is_final": True,
                            "barge_in_prompt": teacher_prompt,
                            "teacher_feedback": teacher_prompt,
                            "optimal_solution_text": dynamic_session.optimal_solution_text,
                            "optimal_code_snippet": optimal_code_snippet,
                            "raw_extraction": teacher_output,
                            "validation": validation_result,
                            "rubric": {
                                "category": (
                                    "BEHAVIORAL"
                                    if (
                                        dynamic_session.optimal_paradigm or ""
                                    ).upper()
                                    == "BEHAVIORAL"
                                    else "DSA"
                                ),
                                "skill": dynamic_session.topic,
                                "difficulty": dynamic_session.difficulty,
                                "algorithmic_paradigm": dynamic_session.optimal_paradigm,
                                "time_complexity": dynamic_session.optimal_time,
                                "space_complexity": dynamic_session.optimal_space,
                            },
                            "chat_history": chat_messages,
                            "metrics": {
                                "T_LLM_ms": t_llm_latency_ms,
                                "T_Validation_ms": t_val_latency_ms,
                                "Total_Cloud_Latency_ms": total_latency_ms,
                            },
                        }
                        await websocket.send_json(response)
                        continue

                    # 2. Standard Multi-Turn Cross-Questioning Step ("Strict Interviewer" mode)
                    text_payload = (request_data.get("transcript") or "").strip()
                    if not text_payload and not code_payload.strip():
                        await websocket.send_json(
                            {
                                "error": "Expected non-empty 'transcript' or 'code', or {'action': 'evaluate_final'}."
                            }
                        )
                        continue

                    t_llm_start = time.perf_counter()
                    streamed_followup, turn_metrics = await asyncio.gather(
                        _stream_chunks(
                            stream_interviewer_turn(
                                question_text=dynamic_session.generated_question,
                                optimal_paradigm=dynamic_session.optimal_paradigm,
                                optimal_time=dynamic_session.optimal_time,
                                optimal_space=dynamic_session.optimal_space,
                                chat_history=chat_messages,
                                latest_transcript=text_payload,
                                code=code_payload,
                            )
                        ),
                        _with_timeout(
                            extract_interviewer_metrics(
                                question_text=dynamic_session.generated_question,
                                optimal_paradigm=dynamic_session.optimal_paradigm,
                                optimal_time=dynamic_session.optimal_time,
                                optimal_space=dynamic_session.optimal_space,
                                chat_history=chat_messages,
                                latest_transcript=text_payload,
                                code=code_payload,
                            ),
                            {
                                "score": 0,
                                "paradigm": "None",
                                "algorithmic_paradigm": "None",
                                "time_complexity": "None",
                                "space_complexity": "None",
                            },
                        ),
                    )
                    t_llm_end = time.perf_counter()

                    interviewer_output = {
                        **turn_metrics,
                        "followup_question": streamed_followup,
                    }

                    t_val_start = time.perf_counter()
                    validation_result = validate_dynamic_turn(
                        interviewer_output,
                        dynamic_session,
                    )
                    t_val_end = time.perf_counter()

                    followup_question = validation_result["followup_question"]
                    is_behavioral_session = (
                        dynamic_session.optimal_paradigm or ""
                    ).upper() == "BEHAVIORAL"

                    turn_performance_record = PerformanceRecord(
                        user_id=user_id,
                        skill=dynamic_session.topic,
                        paradigm_correct=(
                            bool(validation_result.get("S") and validation_result.get("T"))
                            if is_behavioral_session
                            else bool(validation_result.get("paradigm_correct"))
                        ),
                        time_complexity_correct=(
                            bool(validation_result.get("A"))
                            if is_behavioral_session
                            else bool(validation_result.get("time_complexity_correct"))
                        ),
                        space_complexity_correct=(
                            bool(validation_result.get("R"))
                            if is_behavioral_session
                            else bool(validation_result.get("space_complexity_correct"))
                        ),
                        score=validation_result["score"],
                    )
                    db.add(turn_performance_record)
                    db.commit()
                    db.refresh(turn_performance_record)

                    # Append user message (with code snapshot) and interviewer follow-up to MessageHistory
                    chat_messages.append(
                        {
                            "role": "user",
                            "content": text_payload,
                            "code": code_payload,
                        }
                    )
                    chat_messages.append(
                        {
                            "role": "ai",
                            "content": followup_question,
                            "validation": validation_result,
                        }
                    )
                    history_record.messages = chat_messages
                    flag_modified(history_record, "messages")
                    db.commit()

                    t_llm_latency_ms = round((t_llm_end - t_llm_start) * 1000, 2)
                    t_val_latency_ms = round((t_val_end - t_val_start) * 1000, 2)
                    total_latency_ms = round(
                        (time.perf_counter() - start_time) * 1000, 2
                    )

                    response = {
                        "type": "done",
                        "is_final": False,
                        "barge_in_prompt": followup_question,
                        "raw_extraction": interviewer_output,
                        "validation": validation_result,
                        "rubric": {
                            "category": (
                                "BEHAVIORAL"
                                if (dynamic_session.optimal_paradigm or "").upper()
                                == "BEHAVIORAL"
                                else "DSA"
                            ),
                            "skill": dynamic_session.topic,
                            "difficulty": dynamic_session.difficulty,
                            "algorithmic_paradigm": dynamic_session.optimal_paradigm,
                            "time_complexity": dynamic_session.optimal_time,
                            "space_complexity": dynamic_session.optimal_space,
                        },
                        "chat_history": chat_messages,
                        "metrics": {
                            "T_LLM_ms": t_llm_latency_ms,
                            "T_Validation_ms": t_val_latency_ms,
                            "Total_Cloud_Latency_ms": total_latency_ms,
                        },
                    }
                    await websocket.send_json(response)
                    continue

                # ==================================================
                # CASE B: STATIC RUBRIC SESSION (FALLBACK / LEGACY)
                # ==================================================
                try:
                    skill = request_data["skill"]
                    text_payload = request_data["transcript"]
                except KeyError:
                    await websocket.send_text(
                        json.dumps(
                            {
                                "error": (
                                    "Invalid request. Expected a valid dynamic session_id "
                                    "or JSON with 'skill' and 'transcript'."
                                )
                            }
                        )
                    )
                    continue

                rubric = (
                    db.query(ProblemRubric)
                    .filter(ProblemRubric.skill == skill)
                    .first()
                )

                if not rubric:
                    await websocket.send_text(
                        json.dumps(
                            {"error": f"No rubric found for skill: {skill}"}
                        )
                    )
                    continue

                t_llm_start = time.perf_counter()
                if rubric.category == "BEHAVIORAL":
                    extracted_json = extract_star_schema(text_payload)
                else:
                    extracted_json = extract_dsa_schema(text_payload)
                t_llm_end = time.perf_counter()

                t_val_start = time.perf_counter()
                if rubric.category == "BEHAVIORAL":
                    validation_result = validate_behavioral_answer(
                        extracted_json, rubric
                    )
                else:
                    validation_result = validate_dsa_answer(
                        extracted_json, rubric
                    )
                t_val_end = time.perf_counter()

                t_val_latency_ms = round((t_val_end - t_val_start) * 1000, 2)

                performance_record = PerformanceRecord(
                    user_id=session_id,
                    skill=rubric.skill,
                    paradigm_correct=validation_result.get("paradigm_correct"),
                    time_complexity_correct=validation_result.get(
                        "time_complexity_correct"
                    ),
                    space_complexity_correct=validation_result.get(
                        "space_complexity_correct"
                    ),
                    score=validation_result["score"],
                )
                db.add(performance_record)
                db.commit()

                t_llm_latency_ms = round((t_llm_end - t_llm_start) * 1000, 2)
                total_latency_ms = round(
                    (time.perf_counter() - start_time) * 1000, 2
                )

                if rubric.category == "BEHAVIORAL":
                    missing = validation_result.get("missing_components", [])
                    if missing:
                        barge_in_prompt = (
                            f"Good start! Please elaborate on the missing STAR "
                            f"components: {', '.join(missing)}."
                        )
                    else:
                        barge_in_prompt = (
                            "Excellent STAR response! You covered Situation, Task, Action, and Result."
                        )
                else:
                    barge_in_prompt = (
                        f"Extracted complexity: {extracted_json.get('time_complexity')}"
                    )

                response = {
                    "barge_in_prompt": barge_in_prompt,
                    "raw_extraction": extracted_json,
                    "validation": validation_result,
                    "rubric": {
                        "category": rubric.category,
                        "skill": rubric.skill,
                        "algorithmic_paradigm": rubric.optimal_paradigm,
                        "time_complexity": rubric.optimal_time_complexity,
                        "space_complexity": rubric.optimal_space_complexity,
                        "required_star_components": rubric.required_star_components,
                    },
                    "metrics": {
                        "T_LLM_ms": t_llm_latency_ms,
                        "T_Validation_ms": t_val_latency_ms,
                        "Total_Cloud_Latency_ms": total_latency_ms,
                    },
                }

                await websocket.send_text(json.dumps(response))

    except WebSocketDisconnect:
        print(f"Session {session_id} disconnected.")
    except Exception as e:
        print(f"Unexpected error: {e}")
        try:
            await websocket.send_text(json.dumps({"error": str(e)}))
        except Exception:
            pass
    finally:
        print(f"WebSocket connection closed for session {session_id}.")
