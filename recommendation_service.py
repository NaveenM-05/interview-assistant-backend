from sqlalchemy.orm import Session

from models import PerformanceRecord
from recommendation import generate_recommendations


def get_user_recommendations(
    db: Session,
    user_id: str,
    top_n: int = 3
):
    records = (
        db.query(PerformanceRecord)
        .filter(PerformanceRecord.user_id == user_id)
        .order_by(PerformanceRecord.created_at.desc())
        .all()
    )

    if not records:
        return []

    record_data = []

    for record in records:
        record_data.append({
            "skill": record.skill,

            "paradigm_correct":
                record.paradigm_correct,

            "time_complexity_correct":
                record.time_complexity_correct,

            "space_complexity_correct":
                record.space_complexity_correct,

            "score": record.score,

            "created_at":
                record.created_at
        })

    return generate_recommendations(
        record_data,
        top_n=top_n
    )