from datetime import datetime, timedelta

from recommendation import generate_recommendations


records = [

    # -----------------------------
    # Binary Search
    # -----------------------------

    {
        "skill": "Binary Search",
        "paradigm_correct": True,
        "time_complexity_correct": False,
        "space_complexity_correct": True,
        "score": 2 / 3,
        "created_at": datetime.utcnow() - timedelta(days=2)
    },

    {
        "skill": "Binary Search",
        "paradigm_correct": True,
        "time_complexity_correct": False,
        "space_complexity_correct": True,
        "score": 2 / 3,
        "created_at": datetime.utcnow() - timedelta(days=5)
    },

    {
        "skill": "Binary Search",
        "paradigm_correct": True,
        "time_complexity_correct": False,
        "space_complexity_correct": False,
        "score": 1 / 3,
        "created_at": datetime.utcnow() - timedelta(days=10)
    },

    # -----------------------------
    # Hash Map
    # -----------------------------

    {
        "skill": "Hash Map",
        "paradigm_correct": True,
        "time_complexity_correct": True,
        "space_complexity_correct": True,
        "score": 1,
        "created_at": datetime.utcnow() - timedelta(days=3)
    },

    {
        "skill": "Hash Map",
        "paradigm_correct": True,
        "time_complexity_correct": True,
        "space_complexity_correct": False,
        "score": 2 / 3,
        "created_at": datetime.utcnow() - timedelta(days=8)
    },

    # -----------------------------
    # Two Pointers
    # -----------------------------

    {
        "skill": "Two Pointers",
        "paradigm_correct": True,
        "time_complexity_correct": True,
        "space_complexity_correct": True,
        "score": 1,
        "created_at": datetime.utcnow() - timedelta(days=20)
    },

    {
        "skill": "Two Pointers",
        "paradigm_correct": True,
        "time_complexity_correct": True,
        "space_complexity_correct": True,
        "score": 1,
        "created_at": datetime.utcnow() - timedelta(days=25)
    }
]


recommendations = generate_recommendations(records)


print("\nRECOMMENDATIONS\n")
print("-" * 60)

for recommendation in recommendations:
    print(f"Skill       : {recommendation['skill']}")
    print(f"Accuracy    : {recommendation['accuracy']}%")
    print(f"Weak Area   : {recommendation['weak_area']}")
    print(f"Priority    : {recommendation['priority']}")
    print(f"Action      : {recommendation['action']}")
    print("-" * 60)