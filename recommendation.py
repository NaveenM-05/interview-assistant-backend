import math
from datetime import datetime


def calculate_weakness_score(accuracy, failures, days_since_last_attempt):
    error_rate = 1 - accuracy

    # No errors means no weakness
    if error_rate <= 0:
        return 0.0

    recency = math.exp(-days_since_last_attempt / 30)
    frequency = min(failures / 5, 1)

    weakness_score = error_rate * (
        0.50 +
        0.30 * recency +
        0.20 * frequency
    )

    return round(weakness_score, 3)


def generate_recommendations(records, top_n=3):
    """
    Generate skill recommendations from performance records.

    records: list of dictionaries
    """

    skill_data = {}

    # --------------------------------
    # 1. Group records by skill
    # --------------------------------
    for record in records:

        skill = record["skill"]

        if skill not in skill_data:
            skill_data[skill] = {
                "attempts": 0,
                "total_score": 0,
                "failures": 0,
                "paradigm_errors": 0,
                "time_errors": 0,
                "space_errors": 0,
                "last_attempt": record["created_at"]
            }

        data = skill_data[skill]

        data["attempts"] += 1
        data["total_score"] += record["score"]

        if record["score"] < 1:
            data["failures"] += 1

        if record.get("paradigm_correct") is False:
            data["paradigm_errors"] += 1

        if record.get("time_complexity_correct") is False:
            data["time_errors"] += 1

        if record.get("space_complexity_correct") is False:
            data["space_errors"] += 1

        if record["created_at"] > data["last_attempt"]:
            data["last_attempt"] = record["created_at"]

    recommendations = []

    # --------------------------------
    # 2. Calculate weakness
    # --------------------------------
    for skill, data in skill_data.items():

        accuracy = data["total_score"] / data["attempts"]

        days_since_last_attempt = (
            datetime.utcnow() - data["last_attempt"]
        ).days

        priority = calculate_weakness_score(
            accuracy,
            data["failures"],
            days_since_last_attempt
        )

        # --------------------------------
        # 3. Find weakest sub-skill
        # --------------------------------
        errors = {
            "Algorithmic Paradigm": data["paradigm_errors"],
            "Time Complexity": data["time_errors"],
            "Space Complexity": data["space_errors"]
        }

        if max(errors.values()) == 0:
            weak_area = "No major weakness"
        else:
            weak_area = max(errors, key=errors.get)

        # --------------------------------
        # 4. Generate action
        # --------------------------------
        if weak_area == "No major weakness":
            action = f"Continue practicing {skill} to maintain your current performance."

        elif weak_area == "Algorithmic Paradigm":
            action = (
                f"Practice 3 {skill} problems focusing on "
                f"choosing the correct algorithmic approach."
            )

        elif weak_area == "Time Complexity":
            action = (
                f"Practice 3 {skill} problems focusing on "
                f"identifying time complexity."
            )

        else:
            action = (
                f"Practice 3 {skill} problems focusing on "
                f"identifying space complexity."
            )

        recommendation = {
            "skill": skill,
            "accuracy": round(accuracy * 100, 1),
            "weak_area": weak_area,
            "priority": priority,
            "action": action
        }

        recommendations.append(recommendation)

    # --------------------------------
    # 5. Sort by priority
    # --------------------------------
    recommendations.sort(
        key=lambda x: x["priority"],
        reverse=True
    )

    return recommendations[:top_n]