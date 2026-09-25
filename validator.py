def validate_dsa_answer(extracted, rubric):
    """
    Compare LLM-extracted answer against the database rubric.

    The LLM only extracts.
    This function performs the actual deterministic evaluation.
    """

    paradigm_correct = (
        extracted.get("algorithmic_paradigm", "").strip().lower()
        == rubric.optimal_paradigm.strip().lower()
    )

    time_complexity_correct = (
        extracted.get("time_complexity", "").strip().lower()
        == rubric.optimal_time_complexity.strip().lower()
    )

    space_complexity_correct = (
        extracted.get("space_complexity", "").strip().lower()
        == rubric.optimal_space_complexity.strip().lower()
    )

    correct_count = sum([
        paradigm_correct,
        time_complexity_correct,
        space_complexity_correct
    ])

    score = correct_count / 3

    return {
        "paradigm_correct": paradigm_correct,
        "time_complexity_correct": time_complexity_correct,
        "space_complexity_correct": space_complexity_correct,
        "score": round(score, 3)
    }