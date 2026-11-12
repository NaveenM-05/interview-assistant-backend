# llm_parser.py
import asyncio
import os
import json
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

PRO_MODELS = ["gemini-3.1-pro-preview", "gemini-2.5-flash"]
FAST_MODELS = ["gemini-3.1-pro-preview", "gemini-2.5-flash"]


def _generate_json(prompt: str, models_list=None) -> dict:
    models_to_try = models_list or FAST_MODELS
    last_error = None
    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                ),
            )
            return json.loads(response.text)
        except Exception as e:
            last_error = e
            print(f"Model {model_name} failed: {e}")
    raise RuntimeError(f"All Gemini models failed. Last error: {last_error}")


async def _stream_text(prompt: str, models_list=None):
    """
    Async generator that streams plain text chunks from Gemini using
    native async client.aio.models.generate_content_stream.
    """
    models_to_try = models_list or PRO_MODELS
    last_error = None
    for model_name in models_to_try:
        try:
            stream = await client.aio.models.generate_content_stream(
                model=model_name,
                contents=prompt,
            )
            yielded_any = False
            async for chunk in stream:
                text = getattr(chunk, "text", None)
                if text:
                    yielded_any = True
                    yield text
            if yielded_any:
                return
        except Exception as e:
            last_error = e
            print(f"Streaming model {model_name} failed: {e}")
    raise RuntimeError(f"All Gemini streaming models failed. Last error: {last_error}")


def generate_interview_question(
    topic: str, difficulty: str = "Medium", interview_type: str = "DSA"
) -> dict:
    normalized_type = (interview_type or "DSA").strip().upper()

    if normalized_type == "BEHAVIORAL":
        prompt = f"""
        Generate a unique, realistic behavioral interview question for a software engineer based on the topic: "{topic}".
        The hidden evaluation rubric strictly requires all 4 STAR components:
        - Situation (S): Context and background
        - Task (T): Specific challenge or responsibility
        - Action (A): Concrete steps taken by the candidate
        - Result (R): Measurable outcome and lessons learned

        Return a JSON object with this exact schema:
        {{
            "generated_question": "string (the behavioral interview question)",
            "optimal_solution_text": "string (a strong example STAR response breaking down Situation, Task, Action, and Result for this question)"
        }}
        """
        try:
            data = _generate_json(prompt, models_list=PRO_MODELS)
            return {
                "generated_question": (
                    data.get("generated_question")
                    or data.get("question_text")
                    or f"Tell me about a time you demonstrated {topic} during a challenging software engineering project."
                ),
                "optimal_paradigm": "BEHAVIORAL",
                "optimal_time": "STAR",
                "optimal_space": "S,T,A,R",
                "optimal_solution_text": (
                    data.get("optimal_solution_text")
                    or (
                        f"A strong STAR response for {topic} should clearly outline:\n"
                        "• Situation: The project context and team environment.\n"
                        "• Task: The specific obstacle or responsibility you owned.\n"
                        "• Action: The concrete steps you took to address the issue.\n"
                        "• Result: The measurable impact on the team, product, or timeline."
                    )
                ),
            }
        except Exception as e:
            print(
                f"Failed to generate behavioral question via LLM, using fallback: {e}"
            )
            return {
                "generated_question": (
                    f"Tell me about a challenging situation where you had to demonstrate {topic} "
                    "while working on a critical software engineering deliverable. How did you handle it and what was the outcome?"
                ),
                "optimal_paradigm": "BEHAVIORAL",
                "optimal_time": "STAR",
                "optimal_space": "S,T,A,R",
                "optimal_solution_text": (
                    f"Structure your answer using the STAR framework for {topic}:\n"
                    "• Situation: Describe the context and engineering stakes.\n"
                    "• Task: Explain your specific responsibility or goal.\n"
                    "• Action: Detail the specific actions and communication steps you took.\n"
                    "• Result: Share the quantifiable outcome and what you learned."
                ),
            }

    prompt = f"""
    Generate a unique, realistic software engineering interview question about {topic} at {difficulty} difficulty.
    Do not copy exact LeetCode questions.
    Return a JSON object containing: the question text, the optimal algorithmic paradigm, optimal time complexity, optimal space complexity, and a detailed optimal solution.

    Return a JSON object with this exact schema:
    {{
        "generated_question": "string (the full problem description and constraints)",
        "optimal_paradigm": "string (e.g., Dynamic Programming, BFS, Dijkstra, Two Pointers, Sliding Window)",
        "optimal_time": "string (e.g., O(N), O(V + E), O(N log N))",
        "optimal_space": "string (e.g., O(1), O(N), O(V))",
        "optimal_solution_text": "string (clear step-by-step explanation of the optimal algorithm and complexity analysis)"
    }}
    """

    try:
        data = _generate_json(prompt, models_list=PRO_MODELS)
        return {
            "generated_question": (
                data.get("generated_question")
                or data.get("question_text")
                or f"Design an efficient algorithm for a {difficulty} problem involving {topic}."
            ),
            "optimal_paradigm": (
                data.get("optimal_paradigm")
                or data.get("algorithmic_paradigm")
                or topic
            ),
            "optimal_time": (
                data.get("optimal_time")
                or data.get("optimal_time_complexity")
                or "O(N)"
            ),
            "optimal_space": (
                data.get("optimal_space")
                or data.get("optimal_space_complexity")
                or "O(N)"
            ),
            "optimal_solution_text": (
                data.get("optimal_solution_text")
                or data.get("optimal_solution")
                or "Use the optimal paradigm to achieve linear time and space complexity."
            ),
        }
    except Exception as e:
        print(f"Failed to generate dynamic question via LLM, using fallback: {e}")
        return {
            "generated_question": (
                f"[{difficulty} - {topic}] You are designing a distributed job scheduler "
                f"where tasks have dependencies and execution weights. Using {topic}, "
                f"determine the minimum time required to complete all tasks or detect if a bottleneck exists."
            ),
            "optimal_paradigm": topic,
            "optimal_time": "O(N)",
            "optimal_space": "O(N)",
            "optimal_solution_text": (
                f"Apply an optimal {topic} approach to process elements in a single pass, "
                f"achieving O(N) time complexity and O(N) auxiliary space."
            ),
        }


def extract_dsa_schema(transcript_text: str) -> dict:
    prompt = f"""
    You are an information extraction engine. Do not evaluate or grade the answer.
    Extract the algorithmic paradigm, time complexity, and space complexity from the candidate's answer.
    
    Candidate Answer: "{transcript_text}"
    
    Return a JSON object with this schema:
    {{
        "algorithmic_paradigm": "string (e.g., Hash Map, Sliding Window, None)",
        "time_complexity": "string (e.g., O(N), O(N^2), None)",
        "space_complexity": "string (e.g., O(1), O(N), None)"
    }}
    """

    try:
        return _generate_json(prompt, models_list=FAST_MODELS)
    except Exception as e:
        print(f"Failed to parse LLM output: {e}")
        return {
            "algorithmic_paradigm": "None",
            "time_complexity": "None",
            "space_complexity": "None",
        }


def _normalize_behavioral_metrics(data: dict) -> dict:
    s_ok = bool(data.get("situation_covered", data.get("S", False)))
    t_ok = bool(data.get("task_covered", data.get("T", False)))
    a_ok = bool(data.get("action_covered", data.get("A", False)))
    r_ok = bool(data.get("result_covered", data.get("R", False)))

    raw_score = data.get("score")
    if isinstance(raw_score, (int, float)):
        score_int = int(round(raw_score * 100)) if 0 < raw_score <= 1.0 else int(round(raw_score))
    else:
        score_int = sum([s_ok, t_ok, a_ok, r_ok]) * 25

    score_int = max(0, min(100, score_int))
    if not (s_ok and t_ok and a_ok and r_ok):
        score_int = min(score_int, 85)
    if not a_ok or not r_ok:
        score_int = min(score_int, 60)

    data["S"] = s_ok
    data["T"] = t_ok
    data["A"] = a_ok
    data["R"] = r_ok
    data["situation_covered"] = s_ok
    data["task_covered"] = t_ok
    data["action_covered"] = a_ok
    data["result_covered"] = r_ok
    data["score"] = score_int
    data["paradigm"] = data.get("paradigm", "STAR Method")
    data["algorithmic_paradigm"] = data["paradigm"]
    data["time_complexity"] = data.get("time_complexity", "N/A")
    data["space_complexity"] = data.get("space_complexity", "N/A")
    return data


def extract_star_schema(transcript_text: str) -> dict:
    prompt = f"""
    You are a strict behavioral interview evaluation engine.
    Determine whether the candidate's behavioral answer robustly satisfies each component of the STAR method:
    - situation_covered / S (Situation): Specific context or background of the event.
    - task_covered / T (Task): The specific responsibility or challenge faced.
    - action_covered / A (Action): Only set action_covered: true if the candidate provides specific, technical, or concrete steps they personally took. Vague statements like 'I worked hard' or 'I read docs' must result in false.
    - result_covered / R (Result): Only set result_covered: true if the candidate provides measurable, quantified, or highly specific business outcomes. Statements like 'the client was happy' must result in false.
    - score: Integer 0-100. Cap the score strictly at 50-60 if Action or Result are missing or evaluate to false. Do not give 100 unless all 4 STAR components are robustly satisfied.

    Candidate Answer: "{transcript_text}"

    Return ONLY a raw JSON object with this exact schema:
    {{
        "score": 50,
        "situation_covered": true,
        "task_covered": true,
        "action_covered": false,
        "result_covered": false,
        "S": true,
        "T": true,
        "A": false,
        "R": false
    }}
    """

    try:
        return _normalize_behavioral_metrics(
            _generate_json(prompt, models_list=FAST_MODELS)
        )
    except Exception as e:
        print(f"Failed to parse behavioral LLM output: {e}")
        return _normalize_behavioral_metrics(
            {"score": 0, "S": False, "T": False, "A": False, "R": False}
        )


def generate_interviewer_turn(
    question_text: str,
    optimal_paradigm: str,
    optimal_time: str,
    optimal_space: str,
    chat_history: list,
    latest_transcript: str,
    code: str = "",
) -> dict:
    if (optimal_paradigm or "").strip().upper() == "BEHAVIORAL":
        prompt = f"""
        You are a strict behavioral interviewer conducting a multi-turn software engineering interview using the STAR method.

        Behavioral Question:
        "{question_text}"

        Past Conversation History:
        {json.dumps(chat_history, indent=2)}

        Candidate's Latest Response:
        "{latest_transcript}"

        Instructions:
        1. Evaluate the candidate's cumulative responses across the conversation so far for the 4 STAR components:
           - S (Situation): Did they establish the context/background?
           - T (Task): Did they explain their specific responsibility or challenge?
           - A (Action): Did they describe the concrete steps they personally took?
           - R (Result): Did they share the specific outcome, impact, or measurable result?
        2. If ANY of S, T, A, or R are missing or vague, generate a concise, probing follow-up question (`followup_question`) asking specifically for the missing component (e.g., "What was the specific result or measurable impact of that action?").
        3. If all 4 STAR components (S, T, A, and R) have been clearly provided, acknowledge their complete STAR story and invite them to click "Finalize & Evaluate".

        Return a JSON object with this exact schema:
        {{
            "S": true,
            "T": true,
            "A": true,
            "R": false,
            "followup_question": "string (your probing interviewer follow-up question)"
        }}
        """
        try:
            return _generate_json(prompt, models_list=FAST_MODELS)
        except Exception as e:
            print(f"Failed to generate behavioral interviewer turn: {e}")
            star = extract_star_schema(latest_transcript)
            star["followup_question"] = (
                "Could you elaborate on the specific actions you took and the measurable result?"
            )
            return star

    prompt = f"""
    You are a strict technical software engineering interviewer conducting a multi-turn DSA interview.

    Interview Question:
    "{question_text}"

    Target Optimal Rubric (DO NOT reveal these directly to the candidate):
    - Optimal Paradigm: {optimal_paradigm}
    - Optimal Time Complexity: {optimal_time}
    - Optimal Space Complexity: {optimal_space}

    Past Conversation History:
    {json.dumps(chat_history, indent=2)}

    Candidate's Latest Spoken/Typed Response:
    "{latest_transcript}"

    Candidate's Current Code in Editor:
    ```
    {code}
    ```

    Instructions:
    1. Extract the candidate's cumulative proposed algorithmic_paradigm, time_complexity, and space_complexity across both their spoken explanation and their code so far.
    2. The candidate may provide code. Analyze their code for syntax errors, logical bugs, or deviations from the optimal approach. If you detect errors or inefficiencies in the code, act as an interviewer and ask a probing question to make them realize their mistake.
    3. If the candidate's approach or complexities do NOT match or meet the optimal paradigm ({optimal_paradigm}), optimal time complexity ({optimal_time}), or optimal space complexity ({optimal_space}), ask a sharp, probing follow-up question challenging their bottleneck or bug without giving away the answer.
    4. If both their explanation and their code are bug-free and achieve the optimal paradigm, time complexity, and space complexity, acknowledge their solution and invite them to finalize their evaluation.

    Return a JSON object with this exact schema:
    {{
        "algorithmic_paradigm": "string (extracted paradigm or 'None')",
        "time_complexity": "string (extracted time complexity or 'None')",
        "space_complexity": "string (extracted space complexity or 'None')",
        "followup_question": "string (your probing interviewer response)"
    }}
    """

    try:
        return _generate_json(prompt, models_list=FAST_MODELS)
    except Exception as e:
        print(f"Failed to generate multi-turn interviewer response: {e}")
        extracted = extract_dsa_schema(latest_transcript)
        extracted["followup_question"] = (
            "Can you walk me through your code and clarify its time and space complexity?"
        )
        return extracted


def generate_teacher_evaluation(
    question_text: str,
    optimal_paradigm: str,
    optimal_time: str,
    optimal_space: str,
    optimal_solution_text: str,
    chat_history: list,
    code: str = "",
) -> dict:
    if (optimal_paradigm or "").strip().upper() == "BEHAVIORAL":
        prompt = f"""
        You are an expert Engineering Leadership Coach & Teacher evaluating a candidate's complete behavioral interview session using the STAR framework.

        Behavioral Question:
        "{question_text}"

        Reference STAR Guide:
        "{optimal_solution_text}"

        Full Interview Transcript History:
        {json.dumps(chat_history, indent=2)}

        Instructions:
        1. Determine whether the candidate's cumulative responses across the conversation covered each STAR component:
           - S (Situation)
           - T (Task)
           - A (Action)
           - R (Result)
        2. Provide constructive `teacher_feedback` highlighting which STAR components were strong, which were missing or could be sharpened, and how to make their story more impactful.

        Return a JSON object with this exact schema:
        {{
            "S": true,
            "T": true,
            "A": true,
            "R": true,
            "teacher_feedback": "string"
        }}
        """
        try:
            return _generate_json(prompt, models_list=PRO_MODELS)
        except Exception as e:
            print(f"Failed to generate behavioral teacher evaluation: {e}")
            return {
                "S": False,
                "T": False,
                "A": False,
                "R": False,
                "teacher_feedback": (
                    "Behavioral session concluded. Review the reference STAR breakdown below."
                ),
            }

    prompt = f"""
    You are an expert Computer Science Teacher evaluating a candidate's complete multi-turn interview session and code.

    Problem:
    "{question_text}"

    Optimal Rubric:
    - Optimal Paradigm: {optimal_paradigm}
    - Optimal Time Complexity: {optimal_time}
    - Optimal Space Complexity: {optimal_space}
    - Optimal Solution Reference: {optimal_solution_text}

    Full Interview Transcript History:
    {json.dumps(chat_history, indent=2)}

    Candidate's Final Code in Editor:
    ```
    {code}
    ```

    Instructions:
    Act as a supportive but rigorous Teacher:
    1. Extract the best/final algorithmic_paradigm, time_complexity, and space_complexity the candidate arrived at across their conversation and code.
    2. Evaluate whether each of paradigm_correct, time_complexity_correct, and space_complexity_correct was achieved.
    3. Provide constructive teacher_feedback summarizing what the candidate did well, any bugs or inefficiencies in their code, and how the optimal solution works.
    4. Return a clean, fully implemented optimal_code_snippet in Python (with brief inline comments) that solves the problem with the optimal time ({optimal_time}) and space ({optimal_space}) complexities so it can be compared side-by-side in a Diff Editor against the candidate's code.

    Return a JSON object with this exact schema:
    {{
        "algorithmic_paradigm": "string",
        "time_complexity": "string",
        "space_complexity": "string",
        "paradigm_correct": true,
        "time_complexity_correct": true,
        "space_complexity_correct": false,
        "teacher_feedback": "string",
        "optimal_code_snippet": "string (clean, complete, well-commented Python solution)"
    }}
    """

    try:
        return _generate_json(prompt, models_list=PRO_MODELS)
    except Exception as e:
        print(f"Failed to generate teacher evaluation: {e}")
        return {
            "algorithmic_paradigm": "None",
            "time_complexity": "None",
            "space_complexity": "None",
            "paradigm_correct": False,
            "time_complexity_correct": False,
            "space_complexity_correct": False,
            "teacher_feedback": (
                "Session concluded. Review the optimal solution and code diff."
            ),
            "optimal_code_snippet": (
                f"# Optimal {optimal_paradigm} Solution\n"
                f"# Time Complexity: {optimal_time} | Space Complexity: {optimal_space}\n"
                "def solve(data):\n"
                "    # Implement optimal approach here\n"
                "    pass\n"
            ),
        }


# ============================================================
# STREAMING + PARALLEL METRICS EXTRACTION HELPERS
# ============================================================


async def stream_interviewer_turn(
    question_text: str,
    optimal_paradigm: str,
    optimal_time: str,
    optimal_space: str,
    chat_history: list,
    latest_transcript: str,
    code: str = "",
):
    """
    Streams only the conversational interviewer response in plain text
    using gemini-3.1-pro-preview so tokens appear in the UI immediately.
    """
    if (optimal_paradigm or "").strip().upper() == "BEHAVIORAL":
        prompt = f"""
        You are a strict behavioral interviewer conducting a multi-turn software engineering interview using the STAR method.

        Behavioral Question:
        "{question_text}"

        Past Conversation History:
        {json.dumps(chat_history, indent=2)}

        Candidate's Latest Response:
        "{latest_transcript}"

        Instructions:
        Evaluate the candidate's cumulative responses so far for the 4 STAR components (Situation, Task, Action, Result).
        - If ANY of S, T, A, or R are missing or vague, respond directly to the candidate with a concise, probing follow-up question asking specifically for the missing component.
        - If all 4 STAR components have been clearly provided, acknowledge their complete STAR story and invite them to click "Finalize and evaluate".
        Respond ONLY with your plain-text spoken interviewer reply (no JSON, no markdown code blocks).
        """
    else:
        prompt = f"""
        You are a strict technical software engineering interviewer conducting a multi-turn DSA interview.

        Interview Question:
        "{question_text}"

        Target Optimal Rubric (DO NOT reveal these directly to the candidate):
        - Optimal Paradigm: {optimal_paradigm}
        - Optimal Time Complexity: {optimal_time}
        - Optimal Space Complexity: {optimal_space}

        Past Conversation History:
        {json.dumps(chat_history, indent=2)}

        Candidate's Latest Spoken/Typed Response:
        "{latest_transcript}"

        Candidate's Current Code in Editor:
        ```
        {code}
        ```

        Instructions:
        1. Analyze the candidate's explanation and code for syntax errors, logical bugs, or deviations from the optimal approach ({optimal_paradigm}, {optimal_time} time, {optimal_space} space).
        2. If you detect bugs, inefficiencies, or missing complexity analysis, ask a concise, probing interviewer question to guide them without giving away the answer.
        3. If both their explanation and code are optimal and bug-free, acknowledge their solution and invite them to click "Finalize and evaluate".
        Respond ONLY with your plain-text spoken interviewer reply (no JSON, no markdown code blocks).
        """

    try:
        async for chunk in _stream_text(prompt, models_list=PRO_MODELS):
            yield chunk
    except Exception as e:
        print(f"Streaming interviewer turn failed, yielding fallback: {e}")
        if (optimal_paradigm or "").strip().upper() == "BEHAVIORAL":
            yield "Could you elaborate on the specific actions you took and the measurable result?"
        else:
            yield "Can you walk me through your code and clarify its time and space complexity?"


async def extract_interviewer_metrics(
    question_text: str,
    optimal_paradigm: str,
    optimal_time: str,
    optimal_space: str,
    chat_history: list,
    latest_transcript: str,
    code: str = "",
) -> dict:
    """
    Natively async metric extractor using client.aio.models.generate_content
    with a 15-second fallback timeout.
    """
    if (optimal_paradigm or "").strip().upper() == "BEHAVIORAL":
        prompt = f"""
        You are a strict behavioral interview evaluator grading the candidate's cumulative responses across the conversation so far for the 4 STAR components:
        - situation_covered / S (Situation): Specific context or background of the project/team.
        - task_covered / T (Task): Specific responsibility, challenge, or goal owned by the candidate.
        - action_covered / A (Action): Only set action_covered: true (and "A": true) if the candidate provides specific, technical, or concrete steps they personally took. Vague statements like 'I worked hard' or 'I read docs' must result in false.
        - result_covered / R (Result): Only set result_covered: true (and "R": true) if the candidate provides measurable, quantified, or highly specific business outcomes. Statements like 'the client was happy' must result in false.

        Strict Scoring Rules:
        - Cap the score strictly at 50-60 if Action or Result are missing or evaluate to false.
        - Do not give 100% (100) unless all 4 STAR components are robustly satisfied with concrete actions and measurable/specific results.

        Behavioral Question: "{question_text}"
        Past Conversation History: {json.dumps(chat_history, indent=2)}
        Candidate's Latest Response: "{latest_transcript}"

        Return ONLY a raw JSON object with this exact schema:
        {{
            "score": 55,
            "paradigm": "STAR Method",
            "time_complexity": "N/A",
            "space_complexity": "N/A",
            "situation_covered": true,
            "task_covered": true,
            "action_covered": false,
            "result_covered": false,
            "S": true,
            "T": true,
            "A": false,
            "R": false
        }}
        """
        try:
            response = await asyncio.wait_for(
                client.aio.models.generate_content(
                    model="gemini-3.1-pro-preview",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json"
                    ),
                ),
                timeout=15.0,
            )
            data = json.loads(response.text)
            return _normalize_behavioral_metrics(data)
        except Exception as e:
            print(f"Failed or timed out extracting behavioral turn metrics: {e}")
            return _normalize_behavioral_metrics(
                {
                    "score": 0,
                    "paradigm": "STAR Method",
                    "time_complexity": "N/A",
                    "space_complexity": "N/A",
                    "S": False,
                    "T": False,
                    "A": False,
                    "R": False,
                }
            )

    prompt = f"""
    Analyze the candidate's cumulative explanation and code so far against the target optimal rubric.
    Infer the candidate's algorithmic paradigm, time complexity, and space complexity from BOTH their spoken/typed explanation AND their actual code implementation (even if they did not explicitly state Big-O notation in prose).

    Interview Question: "{question_text}"
    Target Optimal Rubric:
    - Optimal Paradigm: {optimal_paradigm}
    - Optimal Time Complexity: {optimal_time}
    - Optimal Space Complexity: {optimal_space}

    Past Conversation History: {json.dumps(chat_history, indent=2)}
    Candidate's Latest Response: "{latest_transcript}"
    Candidate's Code:
    ```
    {code}
    ```

    Return ONLY a raw JSON object with the exact keys:
    - "score": integer from 0 to 100 grading how close the candidate's explanation and code are to the optimal solution
    - "time_complexity": string (e.g., "O(N)", "O(N log N)", "O(N^2)")
    - "space_complexity": string (e.g., "O(1)", "O(N)")
    - "paradigm": string (e.g., "{optimal_paradigm}", "Brute Force", "Two Pointers", "Hash Map", "Dynamic Programming")

    Exact JSON Schema:
    {{
        "score": 85,
        "time_complexity": "O(N)",
        "space_complexity": "O(N)",
        "paradigm": "{optimal_paradigm}"
    }}
    """
    try:
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model="gemini-3.1-pro-preview",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                ),
            ),
            timeout=15.0,
        )
        data = json.loads(response.text)
        paradigm_val = (
            data.get("paradigm")
            or data.get("algorithmic_paradigm")
            or "None"
        )
        data["paradigm"] = paradigm_val
        data["algorithmic_paradigm"] = paradigm_val
        return data
    except Exception as e:
        print(f"Failed or timed out extracting DSA turn metrics: {e}")
        return {
            "score": 0,
            "paradigm": "None",
            "algorithmic_paradigm": "None",
            "time_complexity": "None",
            "space_complexity": "None",
        }


async def stream_teacher_evaluation(
    question_text: str,
    optimal_paradigm: str,
    optimal_time: str,
    optimal_space: str,
    optimal_solution_text: str,
    chat_history: list,
    code: str = "",
):
    """
    Streams the Teacher's constructive feedback in plain text using gemini-3.1-pro-preview.
    """
    if (optimal_paradigm or "").strip().upper() == "BEHAVIORAL":
        prompt = f"""
        You are an expert Engineering Leadership Coach & Teacher evaluating a candidate's behavioral interview session using the STAR framework.

        Behavioral Question: "{question_text}"
        Reference STAR Guide: "{optimal_solution_text}"
        Full Interview Transcript History: {json.dumps(chat_history, indent=2)}

        Provide constructive, encouraging plain-text teacher feedback highlighting which STAR components (Situation, Task, Action, Result) were strong, which were missing or could be sharpened, and how to make their story more impactful.
        Respond ONLY with plain text (no JSON).
        """
    else:
        prompt = f"""
        You are an expert Computer Science Teacher evaluating a candidate's multi-turn DSA interview session and code.

        Problem: "{question_text}"
        Optimal Paradigm: {optimal_paradigm} | Optimal Time: {optimal_time} | Optimal Space: {optimal_space}
        Optimal Solution Reference: "{optimal_solution_text}"
        Full Interview Transcript History: {json.dumps(chat_history, indent=2)}
        Candidate's Final Code:
        ```
        {code}
        ```

        Provide constructive plain-text teacher feedback summarizing what the candidate did well, any bugs or inefficiencies in their code, and how the optimal solution achieves {optimal_time} time and {optimal_space} space.
        Respond ONLY with plain text (no JSON).
        """

    try:
        async for chunk in _stream_text(prompt, models_list=PRO_MODELS):
            yield chunk
    except Exception as e:
        print(f"Streaming teacher feedback failed, yielding fallback: {e}")
        if (optimal_paradigm or "").strip().upper() == "BEHAVIORAL":
            yield "Behavioral session concluded. Review the reference STAR breakdown below."
        else:
            yield "Session concluded. Review the optimal solution and code diff."


async def extract_teacher_metrics(
    question_text: str,
    optimal_paradigm: str,
    optimal_time: str,
    optimal_space: str,
    optimal_solution_text: str,
    chat_history: list,
    code: str = "",
) -> dict:
    """
    Natively async Teacher metric extractor using client.aio.models.generate_content
    with a 15-second fallback timeout.
    """
    if (optimal_paradigm or "").strip().upper() == "BEHAVIORAL":
        prompt = f"""
        You are a strict behavioral interview evaluator grading the candidate's cumulative responses across the full conversation for the 4 STAR components (S, T, A, R) and assigning a final score from 0 to 100.

        Strict Grading Rules:
        - situation_covered / S (Situation): True only if the candidate established clear, specific context.
        - task_covered / T (Task): True only if the candidate stated their specific responsibility or challenge.
        - action_covered / A (Action): Only set action_covered: true (and "A": true) if the candidate provides specific, technical, or concrete steps they personally took. Vague statements like 'I worked hard' or 'I read docs' must result in false.
        - result_covered / R (Result): Only set result_covered: true (and "R": true) if the candidate provides measurable, quantified, or highly specific business outcomes. Statements like 'the client was happy' must result in false.
        - Cap the score strictly at 50-60 if Action or Result are missing or evaluate to false. Do not give 100% (100) unless all 4 STAR components are robustly satisfied.

        Behavioral Question: "{question_text}"
        Full Interview Transcript History: {json.dumps(chat_history, indent=2)}

        Return ONLY a raw JSON object with this exact schema:
        {{
            "score": 55,
            "paradigm": "STAR Method",
            "time_complexity": "N/A",
            "space_complexity": "N/A",
            "situation_covered": true,
            "task_covered": true,
            "action_covered": false,
            "result_covered": false,
            "S": true,
            "T": true,
            "A": false,
            "R": false
        }}
        """
        try:
            response = await asyncio.wait_for(
                client.aio.models.generate_content(
                    model="gemini-3.1-pro-preview",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json"
                    ),
                ),
                timeout=15.0,
            )
            data = json.loads(response.text)
            return _normalize_behavioral_metrics(data)
        except Exception as e:
            print(f"Failed or timed out extracting behavioral teacher metrics: {e}")
            return _normalize_behavioral_metrics(
                {"score": 0, "S": False, "T": False, "A": False, "R": False}
            )

    prompt = f"""
    Evaluate the candidate's final DSA interview session and code against the optimal rubric.
    Infer the candidate's algorithmic paradigm, time complexity, and space complexity from BOTH their conversation and their final code.

    Problem: "{question_text}"
    Optimal Paradigm: {optimal_paradigm} | Optimal Time: {optimal_time} | Optimal Space: {optimal_space}
    Optimal Solution Reference: {optimal_solution_text}
    Full Interview Transcript History: {json.dumps(chat_history, indent=2)}
    Candidate's Final Code:
    ```
    {code}
    ```

    Return ONLY a raw JSON object with the exact required keys:
    - "score" (integer 0-100)
    - "time_complexity" (string)
    - "space_complexity" (string)
    - "paradigm" (string)
    - "paradigm_correct" (boolean)
    - "time_complexity_correct" (boolean)
    - "space_complexity_correct" (boolean)
    - "optimal_code_snippet" (string: clean, complete, well-commented Python solution)

    Exact JSON Schema:
    {{
        "score": 90,
        "time_complexity": "O(N)",
        "space_complexity": "O(N)",
        "paradigm": "{optimal_paradigm}",
        "paradigm_correct": true,
        "time_complexity_correct": true,
        "space_complexity_correct": true,
        "optimal_code_snippet": "string (clean, complete, well-commented Python solution)"
    }}
    """
    try:
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model="gemini-3.1-pro-preview",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                ),
            ),
            timeout=15.0,
        )
        data = json.loads(response.text)
        paradigm_val = (
            data.get("paradigm")
            or data.get("algorithmic_paradigm")
            or "None"
        )
        data["paradigm"] = paradigm_val
        data["algorithmic_paradigm"] = paradigm_val
        return data
    except Exception as e:
        print(f"Failed or timed out extracting DSA teacher metrics: {e}")
        return {
            "score": 0,
            "paradigm": "None",
            "algorithmic_paradigm": "None",
            "time_complexity": "None",
            "space_complexity": "None",
            "paradigm_correct": False,
            "time_complexity_correct": False,
            "space_complexity_correct": False,
            "optimal_code_snippet": (
                f"# Optimal {optimal_paradigm} Solution\n"
                f"# Time Complexity: {optimal_time} | Space Complexity: {optimal_space}\n"
                "def solve(data):\n"
                "    # Implement optimal approach here\n"
                "    pass\n"
            ),
        }
