from database import engine, SessionLocal
from models import Base, ProblemRubric


def seed_db():
    # Ensure schema matches models.py (includes 'skill' column and 'performance_records' table)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        rubrics = [
            ProblemRubric(
                category="DSA",
                skill="Two Sum",
                question_text="Given an array of integers, return indices of the two numbers such that they add up to a specific target.",
                optimal_paradigm="Hash Map",
                optimal_time_complexity="O(N)",
                optimal_space_complexity="O(N)",
            ),
            ProblemRubric(
                category="DSA",
                skill="Two Pointers",
                question_text="Given a 1-indexed array of integers that is already sorted in non-decreasing order, find two numbers such that they add up to a specific target number.",
                optimal_paradigm="Two Pointers",
                optimal_time_complexity="O(N)",
                optimal_space_complexity="O(1)",
            ),
        ]
        db.add_all(rubrics)
        db.commit()
        print("Database seeded successfully with Two Sum and Two Pointers rubrics!")
    finally:
        db.close()


if __name__ == "__main__":
    seed_db()

