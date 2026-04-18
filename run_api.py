#!/usr/bin/env python3
"""Run the HexStrike FastAPI server from the repository root (no `cd apps/api`)."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parent
    api_dir = root / "apps" / "api"
    if not (api_dir / "app" / "main.py").is_file():
        print("Expected apps/api/app/main.py — run from hex-be repo root.", file=sys.stderr)
        sys.exit(1)
    venv_py = api_dir / ".venv" / "bin" / "python3"
    exe = str(venv_py) if venv_py.is_file() else sys.executable
    os.chdir(api_dir)
    cmd = [
        exe,
        "-m",
        "uvicorn",
        "app.main:app",
        "--reload",
        "--host",
        "0.0.0.0",
        "--port",
        "8000",
    ]
    raise SystemExit(subprocess.call(cmd))


if __name__ == "__main__":
    main()
