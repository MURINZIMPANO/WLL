#!/usr/bin/env python3
"""
Create the Python virtual environment and install dependencies.

Native install only — no containers, per the project's deployment rules.

Tiers:
  core  FastAPI, uvicorn and the HTTP surface. Small, and what the service
        needs to boot and report its own health.
  ml    Adds faster-whisper (ctranslate2 + tokenizers). This is the large
        download and is deferred to Phase 3, when transcription actually ships.

Python version selection
------------------------
ctranslate2 (the engine behind faster-whisper) publishes prebuilt wheels for a
narrower set of interpreters than CPython itself, so pinning matters. This
script therefore does NOT hardcode a version: it uses whatever the launcher
resolves by default and prints exactly what it picked, so the choice is never a
surprise. Pass `--python 3.12` to override.

Usage:
    python bootstrap.py                  # core tier
    python bootstrap.py --tier ml        # core + faster-whisper
    python bootstrap.py --python 3.12    # pin an interpreter
"""

from __future__ import annotations

import argparse
import pathlib
import subprocess
import sys
import venv

HERE = pathlib.Path(__file__).resolve().parent
VENV_DIR = HERE / ".venv"

# fmt: off
CORE_REQUIREMENTS = [
    "fastapi>=0.115,<1.0",
    "uvicorn[standard]>=0.32,<1.0",
    "pydantic>=2.9,<3.0",
    "python-multipart>=0.0.12",   # multipart uploads
]

ML_REQUIREMENTS = [
    "faster-whisper>=1.1.0,<2.0", # ctranslate2 + tokenizers, prebuilt wheels
]
# fmt: on

# Interpreters known to have ctranslate2 wheels for Windows and macOS.
KNOWN_GOOD = ("3.9", "3.10", "3.11", "3.12", "3.13")


def default_interpreter() -> list[str]:
    """The launcher command for this platform, preferring the Windows launcher
    because the bare `python` alias is frequently the Microsoft Store stub,
    which exits 0 without doing anything."""
    if sys.platform == "win32":
        return ["py", "-3"]
    return ["python3"]


def interpreter_version(command: list[str]) -> str:
    try:
        result = subprocess.run(
            command + ["--version"],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    if result.returncode != 0:
        return ""
    return result.stdout.strip().split()[-1]


def venv_python() -> pathlib.Path:
    if sys.platform == "win32":
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def run(*args: object) -> None:
    print("+", " ".join(str(arg) for arg in args), flush=True)
    subprocess.check_call([str(arg) for arg in args])


def main() -> int:
    parser = argparse.ArgumentParser(description="Bootstrap the LyricLens speech service.")
    parser.add_argument(
        "--tier",
        choices=["core", "ml"],
        default="core",
        help="core = HTTP surface only; ml = also install faster-whisper",
    )
    parser.add_argument(
        "--python",
        default=None,
        help="Interpreter to build the venv with, e.g. 3.12. Defaults to the launcher.",
    )
    args = parser.parse_args()

    command = default_interpreter()
    if args.python is not None:
        command = [*command[:-1], args.python] if command[-1].startswith("-") else [*command, args.python]

    version = interpreter_version(command)
    if version == "":
        print(f"No usable Python interpreter found via: {' '.join(command)}", file=sys.stderr)
        print("Install one, or pass --python X.Y", file=sys.stderr)
        return 1

    minor = ".".join(version.split(".")[:2])
    print(f"Using Python {version} via `{' '.join(command)}`")

    if args.tier == "ml" and minor not in KNOWN_GOOD:
        print(
            f"\n  Note: Python {minor} is newer than the interpreters ctranslate2 is known to\n"
            f"  publish wheels for {KNOWN_GOOD}. faster-whisper may try to build from\n"
            f"  source and fail without a C toolchain. If that happens, re-run with:\n"
            f"      python bootstrap.py --tier ml --python 3.12\n",
            file=sys.stderr,
        )

    if not VENV_DIR.exists():
        print(f"Creating virtual environment at {VENV_DIR}")
        venv.EnvBuilder(with_pip=True, clear=False).create(VENV_DIR)

    python = venv_python()
    run(python, "-m", "pip", "install", "--upgrade", "pip")
    run(python, "-m", "pip", "install", *CORE_REQUIREMENTS)

    if args.tier == "ml":
        print(
            "\nInstalling faster-whisper. Model weights download on first use\n"
            "and are cached under ~/.cache/huggingface — expect ~150MB for 'tiny'.\n"
        )
        run(python, "-m", "pip", "install", *ML_REQUIREMENTS)

    print(f"\nDone. Run the service with:  {python} -m uvicorn app.main:app --port 4001")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
