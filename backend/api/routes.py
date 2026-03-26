from pathlib import PureWindowsPath, PurePosixPath

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel
import os

from backend.services.job_manager import (
    start_analysis,
    get_status,
    get_result
)
from backend.llm.wiki_qa import ask_wiki
from backend.analysis.impact import analyze_impact
from backend.ingestion.upload_repo import create_uploaded_repo


router = APIRouter()


class AnalyzeRequest(BaseModel):
    repo_path: str


class AskRequest(BaseModel):
    question: str


class ImpactRequest(BaseModel):
    target_file: str


@router.post("/analyze")
def analyze(request: AnalyzeRequest):
    job_id = start_analysis(request.repo_path)
    return {"job_id": job_id}


def _derive_repo_name(repo_path: str, relative_paths: list[str]) -> str:
    cleaned = repo_path.strip()
    if cleaned:
        windows_name = PureWindowsPath(cleaned).name
        posix_name = PurePosixPath(cleaned).name
        if windows_name:
            return windows_name
        if posix_name:
            return posix_name

    if relative_paths:
        first = relative_paths[0].replace("\\", "/").strip("/")
        if first:
            return first.split("/", 1)[0]

    return "Uploaded Repository"


@router.post("/analyze-upload")
def analyze_upload(
    repo_path: str = Form(...),
    relative_paths: list[str] = Form(...),
    files: list[UploadFile] = File(...),
):
    if not files:
        raise ValueError("No files were uploaded.")
    if len(files) != len(relative_paths):
        raise ValueError("Uploaded files and relative paths must match.")

    upload_dir = create_uploaded_repo(files, relative_paths)
    repo_name = _derive_repo_name(repo_path, relative_paths)
    job_id = start_analysis(
        upload_dir,
        repo_name_override=repo_name,
        display_repo_path=repo_path.strip() or repo_name,
    )
    return {"job_id": job_id}


@router.get("/status/{job_id}")
def status(job_id: str):
    job = get_status(job_id)
    if not job:
        return {"status": "failed", "error": "Job not found"}

    # Never return raw "result" here; it may contain non-serializable objects
    # like dependency graph instances and crash JSON encoding.
    return {
        "status": job.get("status"),
        "error": job.get("error"),
        "started_at": job.get("started_at"),
        "finished_at": job.get("finished_at"),
        "repo_name": job.get("repo_name"),
    }


@router.get("/wiki/{job_id}")
def wiki(job_id: str):
    result = get_result(job_id)
    if not result:
        return {"error": "Job not completed"}

    wiki_payload = result.get("wiki") or {}
    if isinstance(wiki_payload, dict):
        wiki_payload["project_name"] = result.get("repo_name")
    return wiki_payload


@router.post("/ask/{job_id}")
def ask(job_id: str, request: AskRequest):
    result = get_result(job_id)
    if not result:
        return {"error": "Job not completed"}

    answer = ask_wiki(request.question)
    return {"answer": answer}


def _normalize_path(value: str) -> str:
    return value.replace("\\", "/").strip().lower()


def _resolve_target_file(result: dict, target_file: str) -> str | None:
    graph = result.get("dependency_graph")
    if graph is None:
        return None

    nodes = list(graph.nodes)
    if not nodes:
        return None

    target_norm = _normalize_path(target_file)
    node_map = {_normalize_path(node): node for node in nodes}

    # Exact match
    if target_norm in node_map:
        return node_map[target_norm]

    repo_path = result.get("repo_path")
    if isinstance(repo_path, str) and repo_path:
        joined = _normalize_path(os.path.normpath(os.path.join(repo_path, target_file)))
        if joined in node_map:
            return node_map[joined]

    # Suffix match for relative inputs
    suffix = f"/{target_norm}"
    matches = [original for normalized, original in node_map.items() if normalized.endswith(suffix)]
    if len(matches) == 1:
        return matches[0]

    return None


@router.post("/impact/{job_id}")
def impact(job_id: str, request: ImpactRequest):
    result = get_result(job_id)
    if not result:
        return {"error": "Job not completed"}

    graph = result.get("dependency_graph")
    if graph is None:
        return {"error": "Dependency graph unavailable for this job"}

    target = _resolve_target_file(result, request.target_file)
    if not target:
        return {"error": "Target file not found in dependency graph"}

    return analyze_impact(target, graph)
