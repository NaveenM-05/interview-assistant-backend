from database import SessionLocal
from models import ProblemRubric


def seed_behavioral():
    db = SessionLocal()
    try:
        existing = (
            db.query(ProblemRubric)
            .filter(
                ProblemRubric.category == "BEHAVIORAL",
                ProblemRubric.skill == "Leadership & Conflict",
            )
            .first()
        )
        if existing:
            print("Behavioral rubric 'Leadership & Conflict' already exists.")
            return

        behavioral_rubric = ProblemRubric(
            category="BEHAVIORAL",
            skill="Leadership & Conflict",
            question_text="Tell me about a time you handled a conflict with a teammate.",
            required_star_components={"S": True, "T": True, "A": True, "R": True},
        )
        db.add(behavioral_rubric)
        db.commit()
        print("Behavioral rubric 'Leadership & Conflict' inserted successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    seed_behavioral()

