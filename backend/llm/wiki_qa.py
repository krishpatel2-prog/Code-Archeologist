from __future__ import annotations

import ast
import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from dotenv import load_dotenv
from groq import Groq

from backend.analysis.impact import analyze_impact
from backend.memory.vector_store import query_wiki


load_dotenv()
logger = logging.getLogger(__name__)
client = None
SYNTHESIS_MODEL = os.getenv("GROQ_SYNTHESIS_MODEL", "llama-3.1-8b-instant")

CONFIG_FILE_NAMES = {
    ".env",
    ".env.example",
    "requirements.txt",
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
    "package.json",
    "docker-compose.yml",
    "docker-compose.yaml",
    "Dockerfile",
}
CONFIG_SUFFIXES = {".toml", ".ini", ".cfg", ".yaml", ".yml", ".json"}
DATABASE_IMPORTS = {
    "chromadb": "ChromaDB",
    "sqlalchemy": "SQLAlchemy",
    "sqlite3": "SQLite",
    "psycopg2": "PostgreSQL",
    "asyncpg": "PostgreSQL",
    "pymongo": "MongoDB",
    "redis": "Redis",
    "mysql": "MySQL",
    "faiss": "FAISS",
}
LLM_IMPORTS = {
    "groq": "Groq",
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "langchain": "LangChain",
    "langgraph": "LangGraph",
}


@dataclass(frozen=True)
class Evidence:
    tool: str
    file: str
    line: int | None
    detail: str


def ask_wiki(job_id: str, question: str, analysis_result: dict | None = None) -> str:
    if not analysis_result:
        chunks = query_wiki(job_id, question)
        if not chunks:
            return _missing_answer()
        evidence = [
            Evidence("architecture_wiki_lookup", "architecture wiki", None, chunk.strip())
            for chunk in chunks
            if chunk.strip()
        ]
        ranked = _rank_evidence(question, "general", evidence, None)
        return _synthesize_answer(job_id, question, "general", ranked, None)

    intent = _detect_intent(question)
    tool_results = _run_tools(question, analysis_result)
    evidence = _dedupe_evidence(
        item for items in tool_results.values() for item in items
    )
    validated = _validate_evidence(question, intent, evidence, analysis_result)
    ranked = _rank_evidence(question, intent, validated, analysis_result)

    if not ranked:
        return _missing_answer()

    return _synthesize_answer(job_id, question, intent, ranked, analysis_result)


def _detect_intent(question: str) -> str:
    normalized = question.lower()
    if "database" in normalized or "db" in normalized:
        return "database"
    if "embed" in normalized or "embedding" in normalized:
        return "embedding"
    if "auth" in normalized or "login" in normalized or "permission" in normalized:
        return "authentication"
    if "chunk" in normalized and ("store" in normalized or "stored" in normalized):
        return "chunk_storage"
    if "prompt" in normalized:
        return "prompt"
    if "llm" in normalized or "model" in normalized:
        return "llm_integration"
    if "hotspot" in normalized:
        return "hotspot"
    if "risk" in normalized:
        return "risk"
    if "safe" in normalized and ("modify" in normalized or "change" in normalized or "refactor" in normalized):
        return "safe_modify"
    if "refactor" in normalized:
        return "refactor"
    if "architecture" in normalized or "boundar" in normalized or "layer" in normalized:
        return "architecture"
    if "impact" in normalized or "depend" in normalized:
        return "impact"
    return "general"


def _run_tools(question: str, result: dict) -> dict[str, list[Evidence]]:
    normalized = question.lower()
    symbols = _extract_symbols(question)
    tools = {
        "search_code_chunks": search_code_chunks(result, question),
        "search_file_summaries": search_file_summaries(result, question),
        "architecture_wiki_lookup": architecture_wiki_lookup(result, question),
        "dependency_graph_lookup": dependency_graph_lookup(result, question),
        "hotspot_lookup": hotspot_lookup(result, question),
        "impact_analysis_lookup": impact_analysis_lookup(result, question),
        "search_config_files": search_config_files(result, question),
    }

    for symbol in symbols:
        tools.setdefault("grep_symbol", []).extend(grep_symbol(result, symbol))
        tools.setdefault("find_class_definition", []).extend(find_class_definition(result, symbol))
        tools.setdefault("find_function_definition", []).extend(find_function_definition(result, symbol))
        tools.setdefault("find_import_chain", []).extend(find_import_chain(result, symbol))

    if "database" in normalized or "db" in normalized:
        for package in DATABASE_IMPORTS:
            tools.setdefault("grep_symbol", []).extend(grep_symbol(result, package))
            tools.setdefault("find_import_chain", []).extend(find_import_chain(result, package))

    if "llm" in normalized or "prompt" in normalized or "model" in normalized:
        for package in LLM_IMPORTS:
            tools.setdefault("grep_symbol", []).extend(grep_symbol(result, package))
            tools.setdefault("find_import_chain", []).extend(find_import_chain(result, package))
        for symbol in ("prompt", "messages", "chat.completions.create"):
            tools.setdefault("grep_symbol", []).extend(grep_symbol(result, symbol))
        if "prompt" in normalized:
            tools.setdefault("search_code_chunks", []).extend(search_prompt_blocks(result))

    if "embed" in normalized or "embedding" in normalized:
        for symbol in ("embed", "embedding", "embeddings", "embedding_function", "DefaultEmbeddingFunction"):
            tools.setdefault("grep_symbol", []).extend(grep_symbol(result, symbol))
            tools.setdefault("find_import_chain", []).extend(find_import_chain(result, symbol))

    if "auth" in normalized or "login" in normalized or "permission" in normalized:
        for symbol in ("auth", "authenticate", "authorization", "jwt", "token", "oauth", "login", "password", "session"):
            tools.setdefault("grep_symbol", []).extend(grep_symbol(result, symbol))
            tools.setdefault("find_import_chain", []).extend(find_import_chain(result, symbol))

    if "chunk" in normalized:
        for symbol in ("chunk", "chunks", "collection.add", "documents", "ids", "metadatas"):
            tools.setdefault("grep_symbol", []).extend(grep_symbol(result, symbol))

    if "refactor" in normalized:
        tools.setdefault("dependency_graph_lookup", []).extend(refactor_candidate_lookup(result))

    if "safe" in normalized and ("modify" in normalized or "change" in normalized or "refactor" in normalized):
        tools.setdefault("dependency_graph_lookup", []).extend(safe_modify_lookup(result))

    return {name: _dedupe_evidence(items) for name, items in tools.items()}


def search_code_chunks(result: dict, query: str, limit: int = 8) -> list[Evidence]:
    terms = _query_terms(query)
    if not terms:
        return []

    evidence = []
    for display_path, source_path in _source_file_pairs(result):
        text = _read_text(source_path)
        if not text:
            continue
        for line_no, line in enumerate(text.splitlines(), start=1):
            lowered = line.lower()
            if any(term in lowered for term in terms):
                evidence.append(Evidence("search_code_chunks", display_path, line_no, line.strip()))
                if len(evidence) >= limit:
                    return evidence
    return evidence


def search_file_summaries(result: dict, query: str, limit: int = 8) -> list[Evidence]:
    terms = _query_terms(query)
    evidence = []
    for file_path, summary in result.get("file_summaries", {}).items():
        text = " ".join(
            str(value)
            for value in (
                summary.get("role"),
                summary.get("responsibility"),
                summary.get("key_dependencies"),
                summary.get("risk_level"),
            )
        ).lower()
        if any(term in text or term in str(file_path).lower() for term in terms):
            evidence.append(
                Evidence(
                    "search_file_summaries",
                    file_path,
                    None,
                    f"{summary.get('role', 'unknown')}: {summary.get('responsibility', '')}",
                )
            )
            if len(evidence) >= limit:
                break
    return evidence


def architecture_wiki_lookup(result: dict, query: str) -> list[Evidence]:
    del query
    wiki = result.get("wiki") or {}
    architecture = wiki.get("architecture") or result.get("architecture_summary") or {}
    evidence = []
    if architecture.get("architecture_style"):
        evidence.append(
            Evidence(
                "architecture_wiki_lookup",
                "architecture_summary",
                None,
                f"Style: {architecture.get('architecture_style')}",
            )
        )
    if architecture.get("core_flow"):
        evidence.append(
            Evidence(
                "architecture_wiki_lookup",
                "architecture_summary",
                None,
                f"Core flow: {architecture.get('core_flow')}",
            )
        )
    for layer in architecture.get("layers", [])[:8]:
        if isinstance(layer, dict):
            evidence.append(
                Evidence(
                    "architecture_wiki_lookup",
                    ", ".join(str(item) for item in layer.get("evidence", [])[:3]) or "architecture_summary",
                    None,
                    f"{layer.get('name')}: {layer.get('responsibility')}",
                )
            )
        elif isinstance(layer, str):
            evidence.append(Evidence("architecture_wiki_lookup", "architecture_summary", None, layer))
    return evidence


def dependency_graph_lookup(result: dict, query: str, limit: int = 8) -> list[Evidence]:
    graph = result.get("dependency_graph")
    if graph is None:
        return []

    terms = _query_terms(query)
    evidence = []
    for node in graph.nodes:
        if terms and not any(term in str(node).lower() for term in terms):
            continue
        imports = list(graph.successors(node))
        imported_by = list(graph.predecessors(node))
        if imports or imported_by:
            evidence.append(
                Evidence(
                    "dependency_graph_lookup",
                    node,
                    None,
                    f"imports={len(imports)}, imported_by={len(imported_by)}",
                )
            )
            if len(evidence) >= limit:
                break
    if evidence:
        return evidence

    for node, degree in sorted(graph.in_degree, key=lambda item: (-item[1], str(item[0])))[:limit]:
        evidence.append(
            Evidence("dependency_graph_lookup", node, None, f"imported_by={degree}")
        )
    return evidence


def hotspot_lookup(result: dict, query: str, limit: int = 5) -> list[Evidence]:
    del query
    hotspots = result.get("hotspots") or []
    evidence = []
    for file_path, score in hotspots[:limit]:
        evidence.append(Evidence("hotspot_lookup", file_path, None, f"hotspot_score={score}"))
    return evidence


def impact_analysis_lookup(result: dict, query: str, limit: int = 5) -> list[Evidence]:
    graph = result.get("dependency_graph")
    if graph is None:
        return []

    targets = _matching_files(result, query)
    if not targets:
        targets = [file_path for file_path, _ in (result.get("hotspots") or [])[:limit]]

    evidence = []
    for target in targets[:limit]:
        impact = analyze_impact(target, graph)
        if "error" in impact:
            continue
        evidence.append(
            Evidence(
                "impact_analysis_lookup",
                target,
                None,
                (
                    f"direct_dependents={len(impact['direct_dependents'])}, "
                    f"indirect_dependents={len(impact['indirect_dependents'])}, "
                    f"total_impact_radius={impact['total_impact_radius']}"
                ),
            )
        )
    return evidence


def safe_modify_lookup(result: dict, limit: int = 8) -> list[Evidence]:
    graph = result.get("dependency_graph")
    if graph is None:
        return []

    candidates = []
    for node in graph.nodes:
        imported_by = graph.in_degree(node)
        imports = graph.out_degree(node)
        if imported_by == 0:
            candidates.append((imports, str(node), node))

    evidence = []
    for imports, _, node in sorted(candidates)[:limit]:
        evidence.append(
            Evidence(
                "dependency_graph_lookup",
                node,
                None,
                f"safe_modify_candidate=true, imports={imports}, imported_by=0",
            )
        )
    return evidence


def refactor_candidate_lookup(result: dict, limit: int = 8) -> list[Evidence]:
    graph = result.get("dependency_graph")
    if graph is None:
        return []

    candidates = []
    for node in graph.nodes:
        imported_by = graph.in_degree(node)
        imports = graph.out_degree(node)
        total_radius = analyze_impact(node, graph).get("total_impact_radius", 0)
        candidates.append((total_radius, imported_by, imports, str(node), node))

    evidence = []
    for total_radius, imported_by, imports, _, node in sorted(candidates)[:limit]:
        evidence.append(
            Evidence(
                "dependency_graph_lookup",
                node,
                None,
                (
                    "refactor_candidate=true, "
                    f"imports={imports}, imported_by={imported_by}, "
                    f"total_impact_radius={total_radius}"
                ),
            )
        )
    return evidence


def grep_symbol(result: dict, symbol: str, limit: int = 12) -> list[Evidence]:
    if not symbol:
        return []
    evidence = []
    lowered_symbol = symbol.lower()
    for display_path, source_path in _source_file_pairs(result):
        text = _read_text(source_path)
        if not text:
            continue
        for line_no, line in enumerate(text.splitlines(), start=1):
            if lowered_symbol in line.lower():
                evidence.append(Evidence("grep_symbol", display_path, line_no, line.strip()))
                if len(evidence) >= limit:
                    return evidence
    return evidence


def search_config_files(result: dict, query: str, limit: int = 12) -> list[Evidence]:
    terms = _query_terms(query)
    evidence = []
    for display_path, source_path in _config_file_pairs(result):
        text = _read_text(source_path)
        if not text:
            continue
        lines = text.splitlines()
        for line_no, line in enumerate(lines, start=1):
            lowered = line.lower()
            if not terms or any(term in lowered for term in terms) or _contains_known_package(lowered):
                evidence.append(Evidence("search_config_files", display_path, line_no, line.strip()))
                if len(evidence) >= limit:
                    return evidence
    return evidence


def search_prompt_blocks(result: dict, limit: int = 6) -> list[Evidence]:
    evidence = []
    for display_path, source_path in _source_file_pairs(result):
        text = _read_text(source_path)
        if not text:
            continue
        lines = text.splitlines()
        for index, line in enumerate(lines):
            if re.search(r"\bprompt\s*=", line, re.IGNORECASE):
                snippet = _prompt_snippet(lines, index)
                evidence.append(
                    Evidence("search_code_chunks", display_path, index + 1, snippet)
                )
                if len(evidence) >= limit:
                    return evidence
    return evidence


def find_class_definition(result: dict, class_name: str) -> list[Evidence]:
    return _find_ast_definition(result, class_name, ast.ClassDef, "find_class_definition")


def find_function_definition(result: dict, function_name: str) -> list[Evidence]:
    return _find_ast_definition(result, function_name, (ast.FunctionDef, ast.AsyncFunctionDef), "find_function_definition")


def find_import_chain(result: dict, symbol: str, limit: int = 12) -> list[Evidence]:
    symbol_lower = symbol.lower()
    evidence = []
    for file_path, parsed in result.get("parsed_files", {}).items():
        imports = parsed.get("imports", [])
        matches = [item for item in imports if symbol_lower in str(item).lower()]
        if matches:
            evidence.append(
                Evidence("find_import_chain", file_path, None, f"imports: {', '.join(matches)}")
            )
            if len(evidence) >= limit:
                break
    return evidence


def _rank_evidence(
    question: str,
    intent: str,
    evidence: list[Evidence],
    result: dict | None,
) -> list[Evidence]:
    terms = _query_terms(question)
    intent_tool_weights = {
        "database": {
            "find_import_chain": 40,
            "grep_symbol": 35,
            "search_config_files": 30,
            "search_code_chunks": 25,
            "search_file_summaries": 10,
        },
        "prompt": {
            "search_code_chunks": 45,
            "grep_symbol": 35,
            "find_function_definition": 20,
            "search_file_summaries": 10,
        },
        "llm_integration": {
            "grep_symbol": 40,
            "find_import_chain": 35,
            "search_code_chunks": 25,
            "search_file_summaries": 20,
        },
        "refactor": {
            "dependency_graph_lookup": 45,
            "impact_analysis_lookup": 10,
            "hotspot_lookup": 5,
        },
        "hotspot": {
            "hotspot_lookup": 45,
            "dependency_graph_lookup": 30,
            "impact_analysis_lookup": 25,
        },
        "risk": {
            "impact_analysis_lookup": 40,
            "hotspot_lookup": 35,
            "dependency_graph_lookup": 25,
        },
        "architecture": {
            "architecture_wiki_lookup": 45,
            "search_file_summaries": 25,
            "dependency_graph_lookup": 20,
        },
        "impact": {
            "impact_analysis_lookup": 45,
            "dependency_graph_lookup": 35,
            "hotspot_lookup": 15,
        },
    }
    weights = intent_tool_weights.get(intent, {})

    def score(item: Evidence) -> tuple[int, str]:
        text = f"{item.file} {item.detail}".lower()
        value = weights.get(item.tool, 5)
        value += sum(5 for term in terms if term in text)
        if result:
            short = _short_path(item.file, result)
            value += max(0, 8 - short.count("/"))
        if item.line:
            value += 2
        return value, item.file

    return _dedupe_by_file(
        sorted(_dedupe_evidence(evidence), key=score, reverse=True),
        result,
    )[:12]


def _validate_evidence(
    question: str,
    intent: str,
    evidence: list[Evidence],
    result: dict | None,
) -> list[Evidence]:
    del question
    if not evidence:
        return []

    source_required = {
        "database",
        "embedding",
        "authentication",
        "chunk_storage",
        "prompt",
        "llm_integration",
    }
    graph_allowed = {"refactor", "hotspot", "risk", "impact", "safe_modify"}
    architecture_allowed = {"architecture", "general"}

    validated = []
    for item in evidence:
        if intent in source_required and not _is_direct_source_evidence(item):
            continue
        if intent not in architecture_allowed and item.tool == "architecture_wiki_lookup":
            continue
        if intent in graph_allowed and item.tool in {"architecture_wiki_lookup", "search_file_summaries"}:
            continue
        if _supports_intent(item, intent):
            validated.append(item)

    return _dedupe_by_file(validated, result)


def _supports_intent(item: Evidence, intent: str) -> bool:
    text = f"{item.file} {item.detail}".lower()

    required_terms = {
        "database": set(DATABASE_IMPORTS.keys()),
        "embedding": {"embed", "embedding", "embeddings", "embedding_function", "defaultembeddingfunction"},
        "authentication": {"auth", "authenticate", "authorization", "jwt", "token", "oauth", "login", "password", "session"},
        "chunk_storage": {"chunk", "chunks", "collection.add", "documents", "ids", "metadatas"},
        "prompt": {"prompt", "messages", "chat.completions.create", "return only"},
        "llm_integration": set(LLM_IMPORTS.keys()) | {"chat.completions.create", "messages", "prompt"},
    }

    if intent in required_terms:
        return any(term in text for term in required_terms[intent])
    if intent == "safe_modify":
        return "safe_modify_candidate=true" in text
    if intent == "refactor":
        return "refactor_candidate=true" in text
    if intent in {"hotspot", "risk", "impact"}:
        return item.tool in {"hotspot_lookup", "impact_analysis_lookup", "dependency_graph_lookup"}
    if intent == "architecture":
        return item.tool in {"architecture_wiki_lookup", "search_file_summaries", "dependency_graph_lookup"}
    return item.tool != "architecture_wiki_lookup" or item.file != "architecture_summary"


def _is_direct_source_evidence(item: Evidence) -> bool:
    return item.tool in {
        "search_code_chunks",
        "grep_symbol",
        "search_config_files",
        "find_class_definition",
        "find_function_definition",
        "find_import_chain",
    }


def _synthesize_answer(
    job_id: str,
    question: str,
    intent: str,
    evidence: list[Evidence],
    result: dict | None,
) -> str:
    prompt = _build_synthesis_prompt(question, intent, evidence, result)
    response = _llm_invoke(job_id, intent, prompt)
    return _postprocess_model_response(response)


def _build_synthesis_prompt(
    question: str,
    intent: str,
    evidence: list[Evidence],
    result: dict | None,
) -> str:
    graph = result.get("dependency_graph") if result else None
    graph_metrics = {
        "nodes": len(graph.nodes) if graph is not None else 0,
        "edges": len(graph.edges) if graph is not None else 0,
    }
    evidence_payload = [
        {
            "file": _short_path(item.file, result),
            "line": item.line,
            "signal": item.detail,
            "metrics": _metrics_for_evidence(item, result),
        }
        for item in _dedupe_by_file(evidence, result)[:8]
    ]

    return f"""
You are a senior repository architect answering questions about a codebase.

Generate the final answer from the provided evidence. Do not invent facts.
If the evidence does not support an answer, respond exactly:
I could not find evidence for this in the repository.

Question:
{question}

Intent:
{intent}

Repository metrics:
{graph_metrics}

Evidence:
{evidence_payload}

Output format, exactly:
## Answer

1-3 concise sentences with the direct answer.

## Reasoning

2-5 sentences explaining why the answer follows from the evidence. Synthesize the evidence like an experienced software engineer. Do not mention tool names or retrieval internals.

## Evidence

* filename.py
* another_file.py
* third_file.py

Rules:
- Maximum 3 evidence bullets.
- Evidence bullets must contain only filenames. Do not include directories or absolute paths.
- Do not include raw code lines, metadata dumps, tool names, counts, or intermediate reasoning in Evidence.
- Do not use stock retrieval-intro phrases. Start with the actual engineering conclusion.
- Avoid "likely", "probably", "might", or "appears to" when evidence supports the answer.
- If the evidence names a package, provider, prompt file, hotspot, or boundary, state it directly.
"""


def _llm_invoke(job_id: str, intent: str, prompt: str) -> str:
    logger.info("llm.invoke called for job_id=%s intent=%s model=%s", job_id, intent, SYNTHESIS_MODEL)
    response = _get_client().chat.completions.create(
        model=SYNTHESIS_MODEL,
        temperature=0.1,
        messages=[
            {"role": "system", "content": "You synthesize codebase evidence into concise architecture answers."},
            {"role": "user", "content": prompt},
        ],
    )
    content = response.choices[0].message.content or ""
    logger.info(
        "llm.invoke completed for job_id=%s intent=%s response_chars=%s",
        job_id,
        intent,
        len(content),
    )
    return content


def _get_client():
    global client
    if client is None:
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return client


def _metrics_for_evidence(item: Evidence, result: dict | None) -> dict:
    if not result:
        return {}
    graph = result.get("dependency_graph")
    metrics = {}
    if graph is not None and item.file in graph:
        metrics["imports"] = graph.out_degree(item.file)
        metrics["imported_by"] = graph.in_degree(item.file)
    for file_path, score in result.get("hotspots", []) or []:
        if file_path == item.file:
            metrics["hotspot_score"] = score
            break
    return metrics


def _postprocess_model_response(response: str) -> str:
    cleaned = response.strip()
    if cleaned == _missing_answer():
        return cleaned

    for phrase in _banned_synthesis_phrases():
        cleaned = cleaned.replace(phrase, "The evidence")

    cleaned = re.sub(r"\b(probably|might|likely|appears to)\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    return _limit_evidence_bullets(cleaned)


def _banned_synthesis_phrases() -> tuple[str, ...]:
    return (
        "I found " + "repository evidence",
        "I combined " + "source search",
        "Based on " + "repository evidence",
    )


def _limit_evidence_bullets(response: str) -> str:
    marker = "## Evidence"
    if marker not in response:
        return response
    before, after = response.split(marker, 1)
    bullets = []
    seen = set()
    for line in after.splitlines():
        stripped = line.strip()
        if not stripped.startswith(("*", "-")):
            continue
        path = _filename_only(stripped.lstrip("*- ").strip())
        key = path.lower()
        if key in seen:
            continue
        seen.add(key)
        bullets.append(path)
        if len(bullets) >= 3:
            break
    normalized = [f"* {path}" for path in bullets]
    return f"{before.rstrip()}\n\n{marker}\n\n" + "\n".join(normalized)


def _short_path(path: str, result: dict | None) -> str:
    if not path:
        return path

    normalized = str(path).replace("\\", "/")
    roots = []
    if result:
        roots.extend(
            str(root).replace("\\", "/").rstrip("/")
            for root in (result.get("repo_path"), result.get("source_repo_path"))
            if root
        )

    for root in roots:
        if normalized.lower().startswith(f"{root.lower()}/"):
            return normalized[len(root) + 1:]

    parts = [part for part in normalized.split("/") if part]
    if len(parts) <= 3:
        return "/".join(parts)
    return "/".join(parts[-3:])


def _filename_only(path: str) -> str:
    normalized = str(path).replace("\\", "/").strip()
    parts = [part for part in normalized.split("/") if part]
    return parts[-1] if parts else normalized


def _missing_answer() -> str:
    return "I could not find evidence for this in the repository."


def _detected_databases(tools: dict[str, list[Evidence]]) -> list[str]:
    found = []
    for item in _dedupe_evidence(item for items in tools.values() for item in items):
        lowered = item.detail.lower()
        for package, name in DATABASE_IMPORTS.items():
            if package in lowered and name not in found:
                found.append(name)
    return found


def _detected_llm_providers(tools: dict[str, list[Evidence]]) -> list[str]:
    found = []
    for item in _dedupe_evidence(item for items in tools.values() for item in items):
        lowered = item.detail.lower()
        for package, name in LLM_IMPORTS.items():
            if package in lowered and name not in found:
                found.append(name)
    return found


def _find_ast_definition(result: dict, symbol: str, node_types, tool_name: str) -> list[Evidence]:
    if not symbol:
        return []
    symbol_lower = symbol.lower()
    evidence = []
    for display_path, source_path in _source_file_pairs(result):
        text = _read_text(source_path)
        if not text:
            continue
        try:
            tree = ast.parse(text)
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            if isinstance(node, node_types) and node.name.lower() == symbol_lower:
                evidence.append(
                    Evidence(tool_name, display_path, getattr(node, "lineno", None), f"{node.__class__.__name__} {node.name}")
                )
    return evidence


def _matching_files(result: dict, query: str) -> list[str]:
    terms = _query_terms(query)
    matches = []
    for file_path in result.get("parsed_files", {}):
        lowered = str(file_path).lower()
        if any(term in lowered for term in terms):
            matches.append(file_path)
    return matches


def _source_file_pairs(result: dict) -> Iterable[tuple[str, Path]]:
    for display_path in result.get("python_files", []) or result.get("parsed_files", {}).keys():
        source_path = _source_path_for(result, display_path)
        if source_path and source_path.exists() and source_path.is_file():
            yield str(display_path), source_path


def _config_file_pairs(result: dict) -> Iterable[tuple[str, Path]]:
    roots = [result.get("source_repo_path"), result.get("repo_path")]
    seen = set()
    for root_value in roots:
        if not root_value:
            continue
        root = Path(str(root_value))
        if not root.exists() or not root.is_dir():
            continue
        for path in root.rglob("*"):
            if not path.is_file() or _is_ignored(path):
                continue
            if path.name in CONFIG_FILE_NAMES or path.suffix.lower() in CONFIG_SUFFIXES:
                key = str(path.resolve())
                if key in seen:
                    continue
                seen.add(key)
                yield _display_path_for(result, path), path


def _source_path_for(result: dict, display_path: str) -> Path | None:
    direct = Path(str(display_path))
    if direct.exists():
        return direct

    source_root = result.get("source_repo_path")
    display_root = result.get("repo_path")
    if source_root and display_root:
        try:
            relative = Path(str(display_path)).relative_to(Path(str(display_root)))
            return Path(str(source_root)) / relative
        except Exception:
            pass

    if source_root:
        candidate = Path(str(source_root)) / str(display_path)
        if candidate.exists():
            return candidate
    return None


def _display_path_for(result: dict, source_path: Path) -> str:
    source_root = result.get("source_repo_path")
    display_root = result.get("repo_path")
    if source_root and display_root:
        try:
            relative = source_path.resolve().relative_to(Path(str(source_root)).resolve())
            return str(Path(str(display_root)) / relative)
        except Exception:
            pass
    return str(source_path)


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return ""


def _prompt_snippet(lines: list[str], start_index: int, max_lines: int = 18) -> str:
    selected = []
    quote_seen = False
    for line in lines[start_index:start_index + max_lines]:
        selected.append(line.rstrip())
        if '"""' in line or "'''" in line:
            quote_seen = not quote_seen
            if not quote_seen and len(selected) > 1:
                break
    return "\\n".join(selected)


def _query_terms(query: str) -> list[str]:
    stopwords = {
        "what", "which", "where", "does", "used", "uses", "use", "the", "this",
        "that", "project", "repository", "repo", "given", "files", "should",
        "first", "about", "with", "from", "into", "code",
    }
    return [
        token for token in re.findall(r"[a-zA-Z_][a-zA-Z0-9_\.]{2,}", query.lower())
        if token not in stopwords
    ]


def _extract_symbols(question: str) -> list[str]:
    quoted = re.findall(r"`([^`]+)`|\"([^\"]+)\"|'([^']+)'", question)
    symbols = [next(part for part in match if part) for match in quoted if any(match)]
    camel_or_snake = re.findall(r"\b[A-Za-z_][A-Za-z0-9_]*\b", question)
    symbols.extend(
        token for token in camel_or_snake
        if "_" in token or any(char.isupper() for char in token[1:])
    )
    return _unique(symbols)


def _contains_known_package(line: str) -> bool:
    packages = set(DATABASE_IMPORTS) | set(LLM_IMPORTS)
    return any(package in line for package in packages)


def _is_ignored(path: Path) -> bool:
    ignored = {".git", ".venv", "venv", "node_modules", "dist", "build", "__pycache__"}
    return any(part in ignored for part in path.parts)


def _dedupe_evidence(items: Iterable[Evidence]) -> list[Evidence]:
    unique = []
    seen = set()
    for item in items:
        key = (item.tool, item.file, item.line, item.detail)
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def _dedupe_by_file(items: Iterable[Evidence], result: dict | None) -> list[Evidence]:
    unique = []
    positions = {}
    for item in items:
        if item.file == "architecture_summary":
            key = item.file
        else:
            key = _short_path(item.file, result).lower().replace("\\", "/")
        if key in positions:
            index = positions[key]
            current = unique[index]
            details = _unique(
                part.strip()
                for part in [current.detail, item.detail]
                if part.strip()
            )
            unique[index] = Evidence(
                current.tool,
                current.file,
                current.line,
                " | ".join(details[:4]),
            )
            continue
        positions[key] = len(unique)
        unique.append(item)
    return unique


def _unique(items: Iterable[str]) -> list[str]:
    result = []
    seen = set()
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result
