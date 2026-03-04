# backend/llm/summarizer.py
import os
import json
from groq import Groq
from dotenv import load_dotenv
import re

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def extract_json(text: str):
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError("No JSON found")

def summarize_file(file_path: str, parsed_data: dict) -> dict:
    prompt = f"""
You are analyzing a Python backend file.

File path:
{file_path}

AST metadata:
Imports: {parsed_data.get("imports", [])}
Classes: {parsed_data.get("classes", [])}
Functions: {parsed_data.get("functions", [])}
Function Calls: {parsed_data.get("calls", [])}

Return ONLY valid JSON in this format:

{{
  "role": "short architectural role label",
  "responsibility": "1-2 sentence explanation",
  "key_dependencies": ["list", "of", "important", "internal", "modules"],
  "risk_level": "low | medium | high"
}}
"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": "You are a precise software architecture analyst."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )

    content = response.choices[0].message.content

    try:
        return extract_json(content)
    except Exception:
        return {
            "role": "unknown",
            "responsibility": content,
            "key_dependencies": [],
            "risk_level": "unknown",
        }