def _normalize(val: str) -> str:
    return (val or "").strip().lower()


STAR_LABELS = {
    "S": "Situation (context and background)",
    "T": "Task (your specific responsibility or challenge)",
    "A": "Action (the concrete steps you personally took)",
    "R": "Result (the measurable outcome or impact)",
}


def validate_dsa_answer(extracted, rubric):
    """
    Compare LLM-extracted answer against the database rubric (ProblemRubric or DynamicSession).

    The LLM only extracts.
    This function performs the actual deterministic evaluation.
    """
    optimal_paradigm = getattr(rubric, "optimal_paradigm", "") or ""
    optimal_time = (
        getattr(rubric, "optimal_time_complexity", None)
        or getattr(rubric, "optimal_time", "")
        or ""
    )
    optimal_space = (
        getattr(rubric, "optimal_space_complexity", None)
        or getattr(rubric, "optimal_space", "")
        or ""
    )

    ext_paradigm = _normalize(extracted.get("algorithmic_paradigm", ""))
    ext_time = _normalize(extracted.get("time_complexity", ""))
    ext_space = _normalize(extracted.get("space_complexity", ""))

    opt_paradigm_norm = _normalize(optimal_paradigm)
    opt_time_norm = _normalize(optimal_time)
    opt_space_norm = _normalize(optimal_space)

    paradigm_correct = bool(
        ext_paradigm
        and ext_paradigm != "none"
        and (
            ext_paradigm == opt_paradigm_norm
            or opt_paradigm_norm in ext_paradigm
            or ext_paradigm in opt_paradigm_norm
        )
    )

    time_complexity_correct = bool(
        ext_time and ext_time != "none" and ext_time == opt_time_norm
    )

    space_complexity_correct = bool(
        ext_space and ext_space != "none" and ext_space == opt_space_norm
    )

    correct_count = sum(
        [
            paradigm_correct,
            time_complexity_correct,
            space_complexity_correct,
        ]
    )

    score = correct_count / 3

    return {
        "paradigm_correct": paradigm_correct,
        "time_complexity_correct": time_complexity_correct,
        "space_complexity_correct": space_complexity_correct,
        "score": round(score, 3),
    }


def validate_behavioral_answer(extracted, rubric=None):
    """
    Compare LLM-extracted STAR components against the behavioral rubric.
    """
    required = getattr(rubric, "required_star_components", None) or {
        "S": True,
        "T": True,
        "A": True,
        "R": True,
    }
    required_keys = [k for k, v in required.items() if v]
    matched_count = sum(1 for k in required_keys if bool(extracted.get(k)))
    missing_keys = [k for k in required_keys if not bool(extracted.get(k))]
    score = matched_count / len(required_keys) if required_keys else 1.0

    return {
        "S": bool(extracted.get("S")),
        "T": bool(extracted.get("T")),
        "A": bool(extracted.get("A")),
        "R": bool(extracted.get("R")),
        "missing_components": missing_keys,
        "score": round(score, 3),
    }


def validate_dynamic_turn(interviewer_output: dict, dynamic_session) -> dict:
    """
    Validate a single multi-turn step against DynamicSession and determine
    the strict interviewer follow-up prompt (for either DSA or BEHAVIORAL).
    """
    is_behavioral = (
        getattr(dynamic_session, "optimal_paradigm", "") or ""
    ).strip().upper() == "BEHAVIORAL"

    if is_behavioral:
        star_val = validate_behavioral_answer(interviewer_output)
        missing = star_val["missing_components"]
        followup = (interviewer_output.get("followup_question") or "").strip()

        if not followup:
            if missing:
                next_missing = missing[0]
                followup = (
                    f"Can you elaborate on the {STAR_LABELS.get(next_missing, next_missing)}?"
                )
            else:
                followup = (
                    "Great job covering Situation, Task, Action, and Result! "
                    "You can click 'Finalize & Evaluate' whenever you are ready."
                )

        return {
            **star_val,
            "is_optimal": len(missing) == 0,
            "followup_question": followup,
        }

    base_validation = validate_dsa_answer(interviewer_output, dynamic_session)
    followup = interviewer_output.get("followup_question") or (
        "Can you walk me through the time and space complexity of your approach?"
    )

    return {
        **base_validation,
        "is_optimal": base_validation["score"] == 1.0,
        "followup_question": followup,
    }


def validate_final_evaluation(teacher_output: dict, dynamic_session) -> dict:
    """
    Compute the final Teacher evaluation and score for a DynamicSession.
    """
    is_behavioral = (
        getattr(dynamic_session, "optimal_paradigm", "") or ""
    ).strip().upper() == "BEHAVIORAL"

    if is_behavioral:
        star_val = validate_behavioral_answer(teacher_output)
        return {
            **star_val,
            "paradigm_correct": star_val["S"] and star_val["T"],
            "time_complexity_correct": star_val["A"],
            "space_complexity_correct": star_val["R"],
            "teacher_feedback": teacher_output.get(
                "teacher_feedback",
                "Great effort on your behavioral response! Review the reference STAR breakdown below.",
            ),
            "optimal_solution_text": dynamic_session.optimal_solution_text,
            "optimal_code_snippet": "",
        }

    det_result = validate_dsa_answer(teacher_output, dynamic_session)

    paradigm_correct = bool(
        det_result["paradigm_correct"] or teacher_output.get("paradigm_correct")
    )
    time_complexity_correct = bool(
        det_result["time_complexity_correct"]
        or teacher_output.get("time_complexity_correct")
    )
    space_complexity_correct = bool(
        det_result["space_complexity_correct"]
        or teacher_output.get("space_complexity_correct")
    )

    correct_count = sum(
        [
            paradigm_correct,
            time_complexity_correct,
            space_complexity_correct,
        ]
    )
    score = round(correct_count / 3, 3)

    return {
        "paradigm_correct": paradigm_correct,
        "time_complexity_correct": time_complexity_correct,
        "space_complexity_correct": space_complexity_correct,
        "score": score,
        "teacher_feedback": teacher_output.get(
            "teacher_feedback",
            "Great effort! Review the optimal solution below.",
        ),
        "optimal_solution_text": dynamic_session.optimal_solution_text,
        "optimal_code_snippet": teacher_output.get(
            "optimal_code_snippet",
            "",
        ),
    }
