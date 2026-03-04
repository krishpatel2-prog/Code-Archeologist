import uuid
import time
from threading import Lock, Thread

from backend.core.langgraph_flow import graph
from backend.ingestion.repo_loader import load_repo


# In-memory job storage
jobs = {}
jobs_lock = Lock()
ANALYSIS_TIMEOUT_SECONDS = 180


def start_analysis(repo_input: str):
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
            result = graph.invoke({
                "repo_path": repo_path
            })
            result["repo_name"] = repo_name
            result["repo_path"] = repo_path
            with jobs_lock:
                # Do not overwrite a timeout/failure terminal state.
                if jobs.get(job_id, {}).get("status") == "processing":
                    jobs[job_id]["result"] = result
                    jobs[job_id]["status"] = "completed"
                    jobs[job_id]["finished_at"] = time.time()
                    jobs[job_id]["repo_name"] = repo_name
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
