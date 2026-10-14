"""
LyricLens speech service — transcription, alignment and pronunciation scoring.

Runs natively on Python 3.11 with faster-whisper. No containers.

Phase 0 ships the service surface only: it boots, validates its configuration
and reports honestly what it cannot yet do. `faster-whisper` is imported
lazily, so the service starts and answers `/health` on a machine where the ML
tier has never been installed — and says so, rather than crashing on import.

Install:
    python bootstrap.py --tier ml
Run:
    python -m uvicorn app.main:app --port 4001
"""

from __future__ import annotations

import os
import shutil
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

VERSION = "0.1.0"
SUPPORTED_MODELS = ("tiny", "base", "small", "medium")

app = FastAPI(
    title="LyricLens speech service",
    version=VERSION,
    description="Transcription, word-level alignment and pronunciation scoring.",
)


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    version: str
    python: str
    ffmpeg: bool
    faster_whisper_installed: bool
    model_available: bool
    model_size: str
    detail: str | None = None


class TranscribeRequest(BaseModel):
    media_path: str = Field(
        ...,
        description="Absolute path the service may read. The caller is responsible "
        "for placing the file there; the service never fetches a URL.",
    )
    language: str | None = Field(
        default=None, description="ISO 639-1 code. None means auto-detect."
    )
    model_size: Literal["tiny", "base", "small", "medium"] = "tiny"
    word_level_timestamps: bool = True


class Segment(BaseModel):
    start_ms: int
    end_ms: int
    text: str


class TranscribeResponse(BaseModel):
    language: str
    duration_ms: int
    lines: list[Segment]
    words: list[Segment] = Field(default_factory=list)


def faster_whisper_installed() -> bool:
    """True when the ML tier is importable, without importing it eagerly."""
    try:
        import importlib.util

        return importlib.util.find_spec("faster_whisper") is not None
    except (ImportError, ValueError):
        return False


def model_cached(model_size: str) -> bool:
    """
    True when the weights for `model_size` are already on disk.

    HuggingFace caches under HF_HOME / ~/.cache/huggingface. Checking the path
    rather than importing the library keeps /health cheap.
    """
    cache_root = os.environ.get("HF_HOME") or os.path.join(
        os.path.expanduser("~"), ".cache", "huggingface"
    )
    hub = os.path.join(cache_root, "hub")
    if not os.path.isdir(hub):
        return False
    prefix = "models--Systran--faster-whisper-"
    return any(entry.startswith(prefix) and prefix + model_size in entry for entry in os.listdir(hub))


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    installed = faster_whisper_installed()
    model_size = os.environ.get("WHISPER_MODEL", "tiny")

    if not installed:
        return HealthResponse(
            status="degraded",
            version=VERSION,
            python=os.sys.version.split()[0],
            ffmpeg=ffmpeg_available(),
            faster_whisper_installed=False,
            model_available=False,
            model_size=model_size,
            detail=(
                "faster-whisper is not installed. Run `python bootstrap.py --tier ml`. "
                "Transcription is unavailable until then; the rest of LyricLens is unaffected."
            ),
        )

    if not ffmpeg_available():
        return HealthResponse(
            status="degraded",
            version=VERSION,
            python=os.sys.version.split()[0],
            ffmpeg=False,
            faster_whisper_installed=True,
            model_available=model_cached(model_size),
            model_size=model_size,
            detail="ffmpeg was not found on PATH. Audio decoding will fail until it is installed.",
        )

    cached = model_cached(model_size)
    return HealthResponse(
        status="ok" if cached else "degraded",
        version=VERSION,
        python=os.sys.version.split()[0],
        ffmpeg=True,
        faster_whisper_installed=True,
        model_available=cached,
        model_size=model_size,
        detail=None
        if cached
        else f"Model '{model_size}' is not downloaded yet. It downloads on first transcription.",
    )


@app.post("/transcribe", response_model=TranscribeResponse)
def transcribe(request: TranscribeRequest) -> TranscribeResponse:
    if not faster_whisper_installed():
        raise HTTPException(
            status_code=503,
            detail=(
                "Transcription is unavailable: faster-whisper is not installed. "
                "Run `python bootstrap.py --tier ml`."
            ),
        )

    if not os.path.isfile(request.media_path):
        raise HTTPException(status_code=404, detail=f"No such file: {request.media_path}")

    # Imported here, not at module scope, so the service boots without the ML
    # tier and reports that clearly on /health.
    from faster_whisper import WhisperModel  # noqa: PLC0415

    model = WhisperModel(request.model_size, device=os.environ.get("WHISPER_DEVICE", "cpu"))
    segments, info = model.transcribe(
        request.media_path,
        language=request.language,
        word_timestamps=request.word_level_timestamps,
    )

    lines: list[Segment] = []
    words: list[Segment] = []

    for segment in segments:
        lines.append(
            Segment(
                start_ms=int(segment.start * 1000),
                end_ms=int(segment.end * 1000),
                text=segment.text.strip(),
            )
        )
        if request.word_level_timestamps and getattr(segment, "words", None):
            for word in segment.words:
                words.append(
                    Segment(
                        start_ms=int(word.start * 1000),
                        end_ms=int(word.end * 1000),
                        text=word.word.strip(),
                    )
                )

    return TranscribeResponse(
        language=info.language,
        duration_ms=int(info.duration * 1000),
        lines=lines,
        words=words,
    )


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": "lyriclens-speech",
        "version": VERSION,
        "docs": "/docs",
        "health": "/health",
    }
