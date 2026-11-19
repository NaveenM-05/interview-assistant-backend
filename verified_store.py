"""Storage for Verified warm-up attempts (its own table: verified_attempts).

Kept separate from performance_records so the existing dashboard and
recommendations are not affected.  The table is created automatically, either
by Base.metadata.create_all in main.py or on first use below.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, String

from database import Base, SessionLocal, engine


class VerifiedAttempt(Base):
    __tablename__ = "verified_attempts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True, nullable=False)
    kind = Column(String, nullable=False)          # 'dsa' or 'star'
    question_id = Column(String, nullable=False)
    topic = Column(String, index=True, nullable=False)
    score = Column(Float, nullable=False)           # 0-1
    verdict = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


_table_ready = False


def _ensure_table():
    global _table_ready
    if not _table_ready:
        VerifiedAttempt.__table__.create(bind=engine, checkfirst=True)
        _table_ready = True


def save_attempt(user_id: str, fields: dict) -> None:
    _ensure_table()
    with SessionLocal() as db:
        db.add(VerifiedAttempt(user_id=user_id, **fields))
        db.commit()


def load_dsa_attempts(user_id: str) -> list[dict]:
    _ensure_table()
    with SessionLocal() as db:
        rows = (
            db.query(VerifiedAttempt.topic, VerifiedAttempt.score)
            .filter(VerifiedAttempt.user_id == user_id, VerifiedAttempt.kind == "dsa")
            .all()
        )
    return [{"topic": t, "score": s} for t, s in rows]
