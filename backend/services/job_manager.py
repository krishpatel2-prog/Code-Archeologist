import uuid
import time
from threading import Lock, Thread
from pathlib import Path

import networkx as nx

from backend.core.langgraph_flow import graph
from backend.ingestion.repo_loader import load_repo


# In-memory job storage
jobs = {}
jobs_lock = Lock()
ANALYSIS_TIMEOUT_SECONDS = 180


def _rewrite_result_paths(result: dict, source_root: str, display_root: str) -> dict:
    source_root_path = Path(source_root).resolve()
    display_root_path = Path(display_root)

    def rewrite_path(value: str) -> str:
        try:
            candidate = Path(value).resolve()
            relative = candidate.relative_to(source_root_path)
        except Exception:
            return value

        return str(display_root_path / relative)

    def rewrite_graph(graph_obj):
        if graph_obj is None:
            return None

        mapping = {}
        for node in list(graph_obj.nodes):
            rewritten = rewrite_path(node)
            if rewritten != node:
                mapping[node] = rewritten

        if not mapping:
            return graph_obj

        return nx.relabel_nodes(graph_obj, mapping, copy=True)

    rewritten = dict(result)
    rewritten["repo_path"] = display_root
    rewritten["python_files"] = [rewrite_path(path) for path in result.get("python_files", [])]
    rewritten["parsed_files"] = {
        rewrite_path(path): parsed
        for path, parsed in result.get("parsed_files", {}).items()
    }
    rewritten["file_summaries"] = {
        rewrite_path(path): summary
        for path, summary in result.get("file_summaries", {}).items()
    }
    rewritten["hotspots"] = [
        (rewrite_path(path), score) for path, score in result.get("hotspots", [])
    ]
    rewritten["leaf_nodes"] = [rewrite_path(path) for path in result.get("leaf_nodes", [])]
    rewritten["cycles"] = [
        [rewrite_path(path) for path in cycle]
        for cycle in result.get("cycles", [])
    ]
    rewritten["dependency_graph"] = rewrite_graph(result.get("dependency_graph"))

    wiki = dict(result.get("wiki") or {})
    modules = []
    for module in wiki.get("modules", []):
        next_module = dict(module)
        if isinstance(next_module.get("file"), str):
            next_module["file"] = rewrite_path(next_module["file"])
        modules.append(next_module)
    wiki["modules"] = modules
    wiki["hotspots"] = [
        {
            **item,
            "file": rewrite_path(item["file"]) if isinstance(item, dict) and isinstance(item.get("file"), str) else item.get("file"),
        }
        for item in wiki.get("hotspots", [])
        if isinstance(item, dict)
    ]
    wiki["dead_code_candidates"] = [
        rewrite_path(path) for path in wiki.get("dead_code_candidates", [])
        if isinstance(path, str)
    ]
    wiki["refactor_safe_zones"] = [
        rewrite_path(path) for path in wiki.get("refactor_safe_zones", [])
        if isinstance(path, str)
    ]
    rewritten["wiki"] = wiki
    return rewritten


def start_analysis(
    repo_input: str,
    repo_name_override: str | None = None,
    display_repo_path: str | None = None,
):
    job_id = str(uuid.uuid4())

    with jobs_lock:
        jobs[job_id] = {
            "status": "processing",
            "result": None,
            "error": None,
            "started_at": time.time(),
            "finished_at": None,
            "repo_name": None,
        }

    def run():
        try:
            repo_path, repo_name = load_repo(repo_input)
            final_repo_name = repo_name_override or repo_name
            result = graph.invoke({
                "repo_path": repo_path
            })
            if display_repo_path:
                result = _rewrite_result_paths(result, repo_path, display_repo_path)
            result["repo_name"] = final_repo_name
            result["repo_path"] = display_repo_path or repo_path
            with jobs_lock:
                # Do not overwrite a timeout/failure terminal state.
                if jobs.get(job_id, {}).get("status") == "processing":
                    jobs[job_id]["result"] = result
                    jobs[job_id]["status"] = "completed"
                    jobs[job_id]["finished_at"] = time.time()
                    jobs[job_id]["repo_name"] = final_repo_name
        except Exception as exc:
            with jobs_lock:
                jobs[job_id]["status"] = "failed"
                jobs[job_id]["error"] = str(exc) or "Analysis pipeline crashed."
                jobs[job_id]["finished_at"] = time.time()

    Thread(target=run, daemon=True).start()

    return job_id


def get_status(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
        if not job:
            return None

        if job["status"] == "processing":
            started_at = job.get("started_at") or time.time()
            if (time.time() - started_at) > ANALYSIS_TIMEOUT_SECONDS:
                job["status"] = "failed"
                job["error"] = (
                    "Analysis timed out after 3 minutes. Check backend logs; "
                    "the LLM call or repository processing may be hanging."
                )
                job["finished_at"] = time.time()

        return dict(job)


def get_result(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
        if job:
            return job["result"]
    return None
