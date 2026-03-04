import os
from typing import Dict, List, Tuple


EXCLUDED_DIRS = {
    ".venv",
    "venv",
    "__pycache__",
    ".git",
    ".idea",
    "node_modules",
    "dist",
    "build"
}

def scan_repo(repo_path: str) -> Tuple[Dict, List[str]]:
    file_tree = {}
    python_files = []

    for root, dirs, files in os.walk(repo_path):

        # remove excluded dirs from traversal
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]

        # convert absolute path → relative path from repo root
        rel_root = os.path.relpath(root, repo_path)

        file_tree[rel_root] = files

        for file in files:

            if file.startswith("."):
                continue

            if file.endswith(".py"):
                full_path = os.path.join(root, file)
                python_files.append(full_path)

    return file_tree, python_files
