# llm_parser.py
import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
import json

load_dotenv()

# Replace the hardcoded API key with the environment variable
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

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
        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Failed to parse LLM output: {e}")
        return {
            "algorithmic_paradigm": "None",
            "time_complexity": "None",
            "space_complexity": "None"
        }