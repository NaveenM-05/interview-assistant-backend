from database import SessionLocal
from models import ProblemRubric
from validator import validate_dsa_answer


db = SessionLocal()

rubric = db.query(ProblemRubric).first()

if not rubric:
    print("No rubric found in database.")
    db.close()
    exit()

print("\nRUBRIC")
print("----------------------------")
print("Paradigm :", rubric.optimal_paradigm)
print("Time     :", rubric.optimal_time_complexity)
print("Space    :", rubric.optimal_space_complexity)


# Simulate Gemini output
extracted = {
    "algorithmic_paradigm": "Hash Map",
    "time_complexity": "O(N)",
    "space_complexity": "O(N)"
}


result = validate_dsa_answer(
    extracted,
    rubric
)

print("\nVALIDATION RESULT")
print("----------------------------")
print(result)

db.close()