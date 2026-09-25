# init_db.py
from database import engine, SessionLocal
from models import Base, ProblemRubric

def init_db():
    # Generate the tables in PostgreSQL
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # Check if we already have mock data
    if not db.query(ProblemRubric).first():
        print("Inserting mock DSA question...")
        dsa_problem = ProblemRubric(
            category="DSA",
            skill="Two Sum",
            question_text="Given an array of integers, return indices of the two numbers such that they add up to a specific target.",
            optimal_paradigm="Hash Map",
            optimal_time_complexity="O(N)",
            optimal_space_complexity="O(N)"
        )
        db.add(dsa_problem)
        db.commit()
        print("Database initialized successfully!")
    else:
        print("Database already contains data.")
        
    db.close()

if __name__ == "__main__":
    init_db()