import json
import re
from groq import Groq
import os
from dotenv import load_dotenv
from collections import Counter

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def extract_json(text: str):
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError("No JSON found")


def _path_tokens(file_summaries: dict) -> list[str]:
    tokens = []
    for file_path in file_summaries:
        normalized = str(file_path).replace("\\", "/").lower()
        tokens.extend(part for part in normalized.split("/") if part and part.endswith(".py") is False)
    return tokens


def _compact_file_summaries(file_summaries: dict, limit: int = 40) -> list[dict]:
    compact = []
    for file_path, summary in list(file_summaries.items())[:limit]:
        compact.append({
            "file": file_path,
            "role": summary.get("role"),
            "responsibility": summary.get("responsibility"),
            "key_dependencies": summary.get("key_dependencies", []),
            "risk_level": summary.get("risk_level"),
        })
    return compact


def _normalize_architecture(payload: dict) -> dict:
    layers = []
    for item in payload.get("layers", []):
        if isinstance(item, str):
            layers.append({
                "name": item,
                "responsibility": "Identified from repository structure.",
                "evidence": [],
            })
        elif isinstance(item, dict):
            layers.append({
                "name": item.get("name") or item.get("layer") or "Unnamed layer",
                "responsibility": item.get("responsibility") or item.get("description") or "",
                "evidence": item.get("evidence") or item.get("files") or [],
            })

    return {
        "architecture_style": payload.get("architecture_style") or "unknown",
        "layers": layers,
        "core_flow": payload.get("core_flow") or "",
        "observations": payload.get("observations") or [],
    }


def detect_architecture(
    file_summaries: dict,
    hotspots: list,
    leaf_nodes: list,
    cycles: list,
    total_files: int
) -> dict:
    directory_signals = Counter(_path_tokens(file_summaries)).most_common(20)
    compact_summaries = _compact_file_summaries(file_summaries)
    prompt = f"""
    You are analyzing one repository. Produce architecture findings only from
    the structural facts below. Do not reuse a generic layered template.

    Structural facts:
    - Total files: {total_files}
    - Circular dependencies detected: {len(cycles)}
    - Hotspot modules (most imported): {hotspots[:5]}
    - Leaf modules (no internal dependencies): {leaf_nodes}
    - Frequent directory/package tokens: {directory_signals}

    File summaries, roles, responsibilities, and dependency hints:
    {compact_summaries}

    Important constraints:

    1. Each layer name must be repository-specific and supported by file paths,
       roles, responsibilities, directory names, or dependency hotspots.
    2. Do not output generic layers such as "Presentation Layer",
       "Business Logic Layer", "Domain Model Layer", "Data Access Layer", or
       "Infrastructure Layer" unless those exact concepts are clearly present
       in the file paths or summaries.
    3. Use domain-specific names when evidence exists, such as API, routes,
       ingestion, analysis, graph, memory, LLM, tools, agents, data processing,
       feature engineering, model training, components, state, or services.
    4. If evidence is thin, say what is known from the files instead of filling
       gaps with a standard template.
    5. Base every observation on the current repository facts above.

    Return ONLY raw JSON in this format:

    {{
      "architecture_style": "...",
      "layers": [
        {{
          "name": "repository-specific layer name",
          "responsibility": "grounded responsibility",
          "evidence": ["file or directory evidence"]
        }}
      ],
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
        return _normalize_architecture(extract_json(content))
    except Exception:
        return {"architecture_style": "unknown", "raw": content}
