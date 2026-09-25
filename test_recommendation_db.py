from datetime import datetime, timedelta

from database import SessionLocal
from models import PerformanceRecord


db = SessionLocal()

records = [

    PerformanceRecord(
        user_id="test-user",
        skill="Binary Search",
        paradigm_correct=True,
        time_complexity_correct=False,
        space_complexity_correct=True,
        score=2 / 3,
        created_at=datetime.utcnow() - timedelta(days=2)
    ),

    PerformanceRecord(
        user_id="test-user",
        skill="Binary Search",
        paradigm_correct=True,
        time_complexity_correct=False,
        space_complexity_correct=False,
        score=1 / 3,
        created_at=datetime.utcnow() - timedelta(days=5)
    ),

    PerformanceRecord(
        user_id="test-user",
        skill="Hash Map",
        paradigm_correct=True,
        time_complexity_correct=True,
        space_complexity_correct=False,
        score=2 / 3,
        created_at=datetime.utcnow() - timedelta(days=3)
    )
]

db.add_all(records)
db.commit()

db.close()

print("Test performance records inserted.")