import os
import re
import subprocess
from pathlib import Path
from typing import Tuple


GITHUB_REPO_PATTERN = re.compile(
    r"^https?://github\.com/(?P<owner>[^/\s]+)/(?P<repo>[^/\s]+?)(?:\.git)?/?$",
    re.IGNORECASE,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CLONED_REPOS_DIR = PROJECT_ROOT / "cloned_repos"


def is_github_url(url: str) -> bool:
    return bool(GITHUB_REPO_PATTERN.match(url.strip()))


def _parse_github_url(url: str) -> Tuple[str, str]:
    match = GITHUB_REPO_PATTERN.match(url.strip())
    if not match:
        raise ValueError(
            "Invalid GitHub URL. Use format: https://github.com/<owner>/<repo>"
        )
    owner = match.group("owner")
    repo = match.group("repo")
    return owner, repo


def _clone_github_repo(url: str) -> Tuple[str, str]:
    owner, repo = _parse_github_url(url)
    display_name = f"{owner}/{repo}"

    CLONED_REPOS_DIR.mkdir(parents=True, exist_ok=True)
    target_dir = CLONED_REPOS_DIR / f"{owner}__{repo}"

    if target_dir.exists() and target_dir.is_dir():
        return str(target_dir.resolve()), display_name

    try:
        subprocess.run(
            ["git", "clone", "--depth", "1", url, str(target_dir)],
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise ValueError("Git is not installed or not available in PATH.") from exc
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        if "Repository not found" in stderr:
            raise ValueError(
                "Repository not accessible. Check the URL or repository permissions."
            ) from exc
        if "could not read Username" in stderr or "Authentication failed" in stderr:
            raise ValueError(
                "Repository requires authentication and cannot be cloned anonymously."
            ) from exc
        raise ValueError(
            f"Failed to clone repository: {stderr or 'Unknown git clone error.'}"
        ) from exc

    return str(target_dir.resolve()), display_name


def _load_local_repo(path_input: str) -> Tuple[str, str]:
    if not os.path.exists(path_input):
        raise ValueError("Local repository path does not exist.")
    if not os.path.isdir(path_input):
        raise ValueError("Local repository path must point to a directory.")

    absolute = str(Path(path_input).resolve())
    display_name = Path(absolute).name or absolute
    return absolute, display_name


def load_repo(repo_input: str) -> Tuple[str, str]:
    """
    Takes a local path OR GitHub URL.
    Returns:
      - usable local filesystem path
      - display repository name
    """
    cleaned = repo_input.strip()
    if not cleaned:
        raise ValueError("Repository input is required.")

    if is_github_url(cleaned):
        return _clone_github_repo(cleaned)

    if cleaned.startswith("http://") or cleaned.startswith("https://"):
        raise ValueError(
            "Invalid GitHub URL. Use format: https://github.com/<owner>/<repo>"
        )

    return _load_local_repo(cleaned)
