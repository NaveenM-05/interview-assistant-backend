# models.py
from sqlalchemy import Column, String, Text, Float, JSON
from sqlalchemy.dialects.postgresql import UUID
import uuid
from database import Base

class ProblemRubric(Base):
    __tablename__ = "problems_rubric"
    
    problem_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category = Column(String, index=True) # 'DSA' or 'BEHAVIORAL'
    question_text = Column(Text)
    optimal_paradigm = Column(String, nullable=True)
    optimal_time_complexity = Column(String, nullable=True)
    optimal_space_complexity = Column(String, nullable=True)
    required_star_components = Column(JSON, default={"S": True, "T": True, "A": True, "R": True})

class CandidateSession(Base):
    __tablename__ = "candidate_sessions"
    
    session_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    raw_transcript = Column(Text, nullable=True) # The lightweight text payload
    extracted_json = Column(JSON, nullable=True) # The parsed LLM extraction
    t_net = Column(Float, nullable=True) # WebSocket delay
    t_llm = Column(Float, nullable=True) # JSON extraction time
    t_val = Column(Float, nullable=True) # Deterministic evaluation execution time
    l_e2e = Column(Float, nullable=True) # Total latency