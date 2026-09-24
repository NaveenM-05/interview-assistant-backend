# database.py
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

# Replace the hardcoded password with the environment variable
db_pass = os.getenv("DB_PASSWORD")
DATABASE_URL = f"postgresql://postgres:{db_pass}@localhost:5432/interview_db"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()