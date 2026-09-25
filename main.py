from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
import time
import json

from database import SessionLocal, get_db
from models import ProblemRubric, PerformanceRecord
from llm_parser import extract_dsa_schema
from validator import validate_dsa_answer
from recommendation_service import get_user_recommendations


app = FastAPI(title="Interview Assistant API")


# ============================================================
# RECOMMENDATION API
# ============================================================

@app.get("/recommendations/{user_id}")
def recommendations(
    user_id: str,
    db: Session = Depends(get_db)
):
    result = get_user_recommendations(
        db=db,
        user_id=user_id
    )

    return {
        "user_id": user_id,
        "recommendations": result
    }


# ============================================================
# INTERVIEW WEBSOCKET
# ============================================================

@app.websocket("/ws/interview/{session_id}")
async def interview_websocket(
    websocket: WebSocket,
    session_id: str
):

    await websocket.accept()

    print(f"Session {session_id} connected.")

    # Database connection for this WebSocket session
    db = SessionLocal()

    try:

        while True:

            # ==================================================
            # 1. RECEIVE MESSAGE FROM CLIENT
            # ==================================================

            message = await websocket.receive_text()

            start_time = time.perf_counter()

            print(f"Received message: {message}")

            # --------------------------------------------------
            # Parse JSON request
            # --------------------------------------------------

            try:

                request_data = json.loads(message)

                skill = request_data["skill"]
                text_payload = request_data["transcript"]

            except (json.JSONDecodeError, KeyError):

                await websocket.send_text(
                    json.dumps({
                        "error": (
                            "Invalid request. Expected JSON "
                            "with 'skill' and 'transcript'."
                        )
                    })
                )

                continue

            print(f"Skill: {skill}")
            print(f"Transcript: {text_payload}")


            # ==================================================
            # 2. GEMINI EXTRACTION
            # ==================================================

            t_llm_start = time.perf_counter()

            extracted_json = extract_dsa_schema(
                text_payload
            )

            t_llm_end = time.perf_counter()

            print(
                f"Extracted JSON: {extracted_json}"
            )


            # ==================================================
            # 3. FIND RUBRIC FOR THIS SKILL
            # ==================================================

            rubric = (
                db.query(ProblemRubric)
                .filter(
                    ProblemRubric.category == "DSA",
                    ProblemRubric.skill == skill
                )
                .first()
            )

            if not rubric:

                await websocket.send_text(
                    json.dumps({
                        "error": (
                            f"No DSA rubric found "
                            f"for skill: {skill}"
                        )
                    })
                )

                continue


            # ==================================================
            # 4. DETERMINISTIC VALIDATION
            # ==================================================

            t_val_start = time.perf_counter()

            validation_result = validate_dsa_answer(
                extracted_json,
                rubric
            )

            t_val_end = time.perf_counter()

            t_val_latency_ms = round(
                (t_val_end - t_val_start) * 1000,
                2
            )

            print(
                f"Validation result: "
                f"{validation_result}"
            )


            # ==================================================
            # 5. SAVE PERFORMANCE RECORD
            # ==================================================

            performance_record = PerformanceRecord(

                # Temporary user identification.
                # Later this will come from authentication.
                user_id=session_id,

                skill=rubric.skill,

                paradigm_correct=(
                    validation_result[
                        "paradigm_correct"
                    ]
                ),

                time_complexity_correct=(
                    validation_result[
                        "time_complexity_correct"
                    ]
                ),

                space_complexity_correct=(
                    validation_result[
                        "space_complexity_correct"
                    ]
                ),

                score=validation_result["score"]
            )

            db.add(performance_record)

            db.commit()

            print(
                "Performance record saved."
            )


            # ==================================================
            # 6. CALCULATE LATENCY
            # ==================================================

            t_llm_latency_ms = round(
                (t_llm_end - t_llm_start) * 1000,
                2
            )

            total_latency_ms = round(
                (time.perf_counter() - start_time) * 1000,
                2
            )


            # ==================================================
            # 7. PREPARE RESPONSE
            # ==================================================

            response = {

                # Current simple follow-up prompt
                "barge_in_prompt": (
                    f"Extracted complexity: "
                    f"{extracted_json.get('time_complexity')}"
                ),

                # What Gemini extracted
                "raw_extraction": extracted_json,

                # Deterministic grading result
                "validation": validation_result,

                # Rubric used for grading
                "rubric": {

                    "skill":
                        rubric.skill,

                    "algorithmic_paradigm":
                        rubric.optimal_paradigm,

                    "time_complexity":
                        rubric.optimal_time_complexity,

                    "space_complexity":
                        rubric.optimal_space_complexity
                },

                # Performance metrics
                "metrics": {

                    "T_LLM_ms":
                        t_llm_latency_ms,

                    "T_Validation_ms":
                        t_val_latency_ms,

                    "Total_Cloud_Latency_ms":
                        total_latency_ms
                }
            }


            # ==================================================
            # 8. SEND RESPONSE TO CLIENT
            # ==================================================

            await websocket.send_text(
                json.dumps(response)
            )


    except WebSocketDisconnect:

        print(
            f"Session {session_id} disconnected."
        )

    except Exception as e:

        print(
            f"Unexpected error: {e}"
        )

        try:

            await websocket.send_text(
                json.dumps({
                    "error": str(e)
                })
            )

        except Exception:
            pass

    finally:

        db.close()

        print(
            f"Database connection closed "
            f"for session {session_id}."
        )