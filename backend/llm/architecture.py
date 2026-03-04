import json
import re
from groq import Groq
import os
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def extract_json(text: str):
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError("No JSON found")


def detect_architecture(
    file_summaries: dict,
    hotspots: list,
    leaf_nodes: list,
    cycles: list,
    total_files: int
) -> dict:
    prompt = f"""
    You are analyzing a Python backend system.

    Structural facts:
    - Total files: {total_files}
    - Circular dependencies detected: {len(cycles)}
    - Hotspot modules (most imported): {hotspots[:5]}
    - Leaf modules (no internal dependencies): {leaf_nodes}

    File summaries:
    {file_summaries}

    Important constraints:

    1. Only classify as "Microservices" if there are clearly multiple independently deployable services communicating over network boundaries.
    2. If this appears to be a single deployable codebase with layered separation, classify as "Layered Monolith".
    3. If unclear, prefer conservative classification over buzzwords.
    4. Base your reasoning on structural evidence and summaries.

    Return ONLY raw JSON in this format:

    {{
      "architecture_style": "...",
      "layers": ["..."],
      "core_flow": "...",
      "observations": ["..."]
    }}
    """

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": "You are a software architecture expert."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )

    content = response.choices[0].message.content

    try:
        return extract_json(content)
    except:
        return {"architecture_style": "unknown", "raw": content}