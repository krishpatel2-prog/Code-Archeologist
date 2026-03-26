from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Iterable

from fastapi import UploadFile


def _sanitize_relative_path(relative_path: str) -> Path:
    normalized = relative_path.replace("\\", "/").strip().lstrip("/")
    target = Path(normalized)

    if not normalized or target.is_absolute() or ".." in target.parts:
        raise ValueError("Invalid uploaded file path.")

    return target


def create_uploaded_repo(
    files: Iterable[UploadFile],
    relative_paths: list[str],
) -> str:
    upload_root = Path(tempfile.mkdtemp(prefix="code-archeologist-upload-"))

    for upload, relative_path in zip(files, relative_paths):
        target_relative = _sanitize_relative_path(relative_path)
        target_path = upload_root / target_relative
        target_path.parent.mkdir(parents=True, exist_ok=True)

        with target_path.open("wb") as handle:
            while True:
                chunk = upload.file.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)

        upload.file.close()

    return os.fspath(upload_root)
