"""
MarkItDown UI – FastAPI backend
Converts uploaded documents to Markdown using Microsoft MarkItDown.
"""

import base64
import json
import logging
import logging.config
import os
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List

import aiofiles
from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from markitdown import MarkItDown
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

_LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG").upper()

logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
                "datefmt": "%Y-%m-%dT%H:%M:%S",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "default",
            },
        },
        "loggers": {
            "markitdownui": {"level": _LOG_LEVEL, "handlers": ["console"], "propagate": False},
            "uvicorn.access": {"level": "INFO", "handlers": ["console"], "propagate": False},
            "uvicorn.error": {"level": "INFO", "handlers": ["console"], "propagate": False},
        },
        "root": {"level": _LOG_LEVEL, "handlers": ["console"]},
    }
)

log = logging.getLogger("markitdownui")
log.info("Logging initialised at level %s", _LOG_LEVEL)

# ---------------------------------------------------------------------------
# Directories & persistence
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "storage" / "uploads"
OUTPUT_DIR = BASE_DIR / "storage" / "outputs"
DB_FILE = BASE_DIR / "db.json"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

log.debug("BASE_DIR   : %s", BASE_DIR)
log.debug("UPLOAD_DIR : %s", UPLOAD_DIR)
log.debug("OUTPUT_DIR : %s", OUTPUT_DIR)
log.debug("DB_FILE    : %s", DB_FILE)

# Supported MIME types / extensions (MarkItDown handles the heavy lifting)
ALLOWED_EXTENSIONS = {
    ".pdf", ".docx", ".doc", ".pptx", ".ppt",
    ".xlsx", ".xls", ".csv",
    ".html", ".htm", ".xml",
    ".txt", ".md", ".rst",
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp",
    ".mp3", ".wav", ".m4a",
    ".zip",
    ".json", ".yaml", ".yml",
    ".epub",
}

# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------


def _load_db() -> List[dict]:
    if not DB_FILE.exists():
        log.debug("DB file not found, returning empty list")
        return []
    with open(DB_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    log.debug("DB loaded: %d record(s)", len(data))
    return data


def _save_db(records: List[dict]) -> None:
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
    log.debug("DB saved: %d record(s)", len(records))


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ConversionRecord(BaseModel):
    id: str
    original_filename: str
    output_filename: str
    file_size: int
    status: str  # "success" | "error"
    error_message: str | None = None
    created_at: str
    markdown_preview: str | None = None  # first 500 chars
    llm_tokens: dict | None = None       # {input_tokens, output_tokens, total_tokens}


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="MarkItDown UI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

md_converter = MarkItDown()
log.info("MarkItDown converter ready")

# ---------------------------------------------------------------------------
# Optional LLM vision converter (used for images when ANTHROPIC_API_KEY is set)
# ---------------------------------------------------------------------------

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}


class _Choice:
    """Mimics openai.types.chat.ChatCompletionMessage hierarchy."""
    class _Message:
        def __init__(self, content: str):
            self.content = content

    def __init__(self, content: str):
        self.message = self._Message(content)


class _CompletionResponse:
    """Mimics openai.types.chat.ChatCompletion – has .choices[0].message.content."""
    def __init__(self, content: str):
        self.choices = [_Choice(content)]


class _TokenUsage:
    """Accumulated token usage for a single conversion call."""
    def __init__(self, input_tokens: int = 0, output_tokens: int = 0):
        self.input_tokens  = input_tokens
        self.output_tokens = output_tokens

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    def to_dict(self) -> dict:
        return {
            "input_tokens":  self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens":  self.total_tokens,
        }


class _AnthropicAdapter:
    """
    Wraps anthropic.Anthropic so it looks like the OpenAI client that
    MarkItDown expects:  client.chat.completions.create(model, messages)
    """

    def __init__(self, api_key: str, model: str):
        try:
            import anthropic  # lazy import – only needed when key present
        except ImportError as exc:
            raise RuntimeError(
                "anthropic package not installed. Run: uv pip install anthropic"
            ) from exc
        self._client = anthropic.Anthropic(api_key=api_key)
        self._default_model = model
        self.last_usage: _TokenUsage | None = None
        log.info("AnthropicAdapter initialised (model=%s)", model)

        # Build the nested namespace MarkItDown expects:
        # client.chat.completions.create(...)
        adapter = self

        class _Completions:
            def create(self, model: str, messages: list, **_: Any) -> Any:  # noqa: ANN401
                return adapter._complete(model, messages)

        class _Chat:
            completions = _Completions()

        self.chat = _Chat()

    def _complete(self, model: str, messages: list) -> _Choice:
        """Convert OpenAI-format messages → Anthropic format and call the API."""
        anthropic_messages = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if isinstance(content, str):
                anthropic_messages.append({"role": role, "content": content})
            elif isinstance(content, list):
                parts: list = []
                for part in content:
                    if part.get("type") == "image_url":
                        url: str = part["image_url"]["url"]
                        # Parse  data:<media_type>;base64,<data>
                        m = re.match(r"data:([^;]+);base64,(.+)", url, re.DOTALL)
                        if m:
                            media_type, b64_data = m.group(1), m.group(2)
                            parts.append({
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": b64_data,
                                },
                            })
                        else:
                            # Fall back to URL source
                            parts.append({
                                "type": "image",
                                "source": {"type": "url", "url": url},
                            })
                    elif part.get("type") == "text":
                        parts.append({"type": "text", "text": part["text"]})
                anthropic_messages.append({"role": role, "content": parts})

        log.debug("AnthropicAdapter: calling model=%s messages=%d", model, len(anthropic_messages))
        response = self._client.messages.create(
            model=model or self._default_model,
            max_tokens=4096,
            messages=anthropic_messages,
        )
        text = response.content[0].text if response.content else ""
        # Capture token usage
        usage = getattr(response, "usage", None)
        if usage:
            self.last_usage = _TokenUsage(
                input_tokens=getattr(usage, "input_tokens", 0),
                output_tokens=getattr(usage, "output_tokens", 0),
            )
            log.debug(
                "AnthropicAdapter: tokens in=%d out=%d",
                self.last_usage.input_tokens, self.last_usage.output_tokens,
            )
        log.debug("AnthropicAdapter: response %d chars", len(text))
        return _CompletionResponse(text)


# Build vision converter if key is available
# Priority: ANTHROPIC_API_KEY → OPENAI_API_KEY → plain MarkItDown
_ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
_CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-haiku-4-5-20251001")
_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
_OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5-mini")

md_converter_vision: MarkItDown | None = None
_vision_provider: str = "none"
_vision_model: str = ""

if _ANTHROPIC_API_KEY:
    try:
        _adapter = _AnthropicAdapter(_ANTHROPIC_API_KEY, _CLAUDE_MODEL)
        md_converter_vision = MarkItDown(llm_client=_adapter, llm_model=_CLAUDE_MODEL)
        _vision_provider = "anthropic"
        _vision_model = _CLAUDE_MODEL
        log.info("Vision converter ready (provider=anthropic model=%s)", _CLAUDE_MODEL)
    except Exception as exc:  # noqa: BLE001
        log.warning("Could not initialise Anthropic vision converter: %s", exc)
elif _OPENAI_API_KEY:
    try:
        from openai import OpenAI  # lazy import

        class _OpenAIAdapter:
            """Thin wrapper around openai.OpenAI that tracks token usage."""
            def __init__(self, client: Any, model: str):
                self._client   = client
                self._model    = model
                self.last_usage: _TokenUsage | None = None
                log.info("OpenAIAdapter initialised (model=%s)", model)

                adapter = self

                class _Completions:
                    def create(self, model: str, messages: list, **kw: Any) -> Any:  # noqa: ANN401
                        resp = adapter._client.chat.completions.create(
                            model=model or adapter._model,
                            messages=messages,
                            **kw,
                        )
                        usage = getattr(resp, "usage", None)
                        if usage:
                            adapter.last_usage = _TokenUsage(
                                input_tokens=getattr(usage, "prompt_tokens", 0),
                                output_tokens=getattr(usage, "completion_tokens", 0),
                            )
                            log.debug(
                                "OpenAIAdapter: tokens in=%d out=%d",
                                adapter.last_usage.input_tokens,
                                adapter.last_usage.output_tokens,
                            )
                        return resp  # real OpenAI response already has .choices

                class _Chat:
                    completions = _Completions()

                self.chat = _Chat()

        _raw_openai = OpenAI(api_key=_OPENAI_API_KEY)
        _adapter    = _OpenAIAdapter(_raw_openai, _OPENAI_MODEL)
        md_converter_vision = MarkItDown(llm_client=_adapter, llm_model=_OPENAI_MODEL)
        _vision_provider = "openai"
        _vision_model    = _OPENAI_MODEL
        log.info("Vision converter ready (provider=openai model=%s)", _OPENAI_MODEL)
    except Exception as exc:  # noqa: BLE001
        log.warning("Could not initialise OpenAI vision converter: %s", exc)
else:
    log.info("No LLM API key set – image files will use plain MarkItDown (no vision)")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _convert_file(upload_path: Path, original_name: str) -> dict:
    """Run MarkItDown conversion and persist the result."""
    record_id = str(uuid.uuid4())
    out_name = f"{record_id}.md"
    out_path = OUTPUT_DIR / out_name
    file_size = upload_path.stat().st_size
    suffix = upload_path.suffix.lower()

    # Use vision-capable converter for images when available
    is_image = suffix in IMAGE_EXTENSIONS
    use_vision = is_image and md_converter_vision is not None
    converter = md_converter_vision if use_vision else md_converter
    converter_label = f"{_vision_provider} vision" if use_vision else "MarkItDown"

    # Reset adapter token counter before each call
    if use_vision and hasattr(_adapter, "last_usage"):
        _adapter.last_usage = None

    log.info(
        "[%s] Converting '%s' (%d bytes) via %s",
        record_id[:8], original_name, file_size, converter_label,
    )

    log.debug("[%s] Upload path: %s", record_id[:8], upload_path)

    t0 = time.monotonic()
    try:
        result = converter.convert(str(upload_path))
        markdown_content = result.text_content
        elapsed = time.monotonic() - t0

        # Collect token usage if LLM was involved
        llm_tokens: dict | None = None
        if use_vision and hasattr(_adapter, "last_usage") and _adapter.last_usage:
            llm_tokens = _adapter.last_usage.to_dict()
            log.info(
                "[%s] Tokens – input=%d output=%d total=%d",
                record_id[:8],
                llm_tokens["input_tokens"],
                llm_tokens["output_tokens"],
                llm_tokens["total_tokens"],
            )

        log.debug(
            "[%s] Conversion done in %.3fs, output %d chars",
            record_id[:8], elapsed, len(markdown_content or ""),
        )

        with open(out_path, "w", encoding="utf-8") as f:
            f.write(markdown_content)

        log.info("[%s] Saved output: %s", record_id[:8], out_name)

        record = {
            "id": record_id,
            "original_filename": original_name,
            "output_filename": out_name,
            "file_size": file_size,
            "status": "success",
            "error_message": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "markdown_preview": markdown_content[:500] if markdown_content else "",
            "llm_tokens": llm_tokens,
        }
    except Exception as exc:  # noqa: BLE001
        elapsed = time.monotonic() - t0
        log.error(
            "[%s] Conversion FAILED after %.3fs: %s",
            record_id[:8], elapsed, exc, exc_info=True,
        )
        record = {
            "id": record_id,
            "original_filename": original_name,
            "output_filename": out_name,
            "file_size": file_size,
            "status": "error",
            "error_message": str(exc),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "markdown_preview": None,
            "llm_tokens": None,
        }
    finally:
        # Remove the temporary upload
        try:
            upload_path.unlink(missing_ok=True)
            log.debug("[%s] Temp upload deleted", record_id[:8])
        except OSError:
            pass

    # Persist to DB
    records = _load_db()
    records.insert(0, record)
    _save_db(records)

    return record


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.middleware("http")
async def _request_logger(request: Request, call_next):
    """Log every request with method, path, status, and duration."""
    t0 = time.monotonic()
    log.debug("→ %s %s", request.method, request.url.path)
    response = await call_next(request)
    ms = (time.monotonic() - t0) * 1000
    log.info("%s %s → %d  (%.1f ms)", request.method, request.url.path, response.status_code, ms)
    return response


@app.get("/api/health")
async def health():
    log.debug("Health check")
    return {"status": "ok"}


@app.get("/api/config")
async def config():
    """Expose feature flags to the frontend."""
    return {
        "vision_enabled": md_converter_vision is not None,
        "vision_model": _vision_model or None,
        "vision_provider": _vision_provider if md_converter_vision else None,
    }


@app.post("/api/convert", response_model=ConversionRecord, status_code=status.HTTP_201_CREATED)
async def convert_single(file: UploadFile = File(...)):
    """Convert a single uploaded file to Markdown."""
    suffix = Path(file.filename or "").suffix.lower()
    log.debug("Single-convert request: '%s' (suffix=%s)", file.filename, suffix)
    if suffix not in ALLOWED_EXTENSIONS:
        log.warning("Rejected unsupported file type '%s' for '%s'", suffix, file.filename)
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
        )

    tmp_path = UPLOAD_DIR / f"{uuid.uuid4()}{suffix}"
    async with aiofiles.open(tmp_path, "wb") as out:
        while chunk := await file.read(1024 * 1024):  # 1 MB chunks
            await out.write(chunk)
    log.debug("Uploaded to tmp: %s", tmp_path)

    record = _convert_file(tmp_path, file.filename or "unknown")
    return record


@app.post("/api/convert/bulk", status_code=status.HTTP_201_CREATED)
async def convert_bulk(files: List[UploadFile] = File(...)):
    """Convert multiple uploaded files to Markdown."""
    log.info("Bulk-convert request: %d file(s)", len(files))
    results = []
    for file in files:
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            results.append(
                {
                    "id": str(uuid.uuid4()),
                    "original_filename": file.filename,
                    "output_filename": None,
                    "file_size": 0,
                    "status": "error",
                    "error_message": f"Unsupported file type '{suffix}'",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "markdown_preview": None,
                }
            )
            continue

        tmp_path = UPLOAD_DIR / f"{uuid.uuid4()}{suffix}"
        async with aiofiles.open(tmp_path, "wb") as out:
            while chunk := await file.read(1024 * 1024):
                await out.write(chunk)

        record = _convert_file(tmp_path, file.filename or "unknown")
        results.append(record)

    return {"results": results, "total": len(results)}


@app.get("/api/history", response_model=List[ConversionRecord])
async def get_history():
    """Return all conversion records (most recent first)."""
    records = _load_db()
    log.debug("History requested: %d record(s) returned", len(records))
    return records


@app.get("/api/history/{record_id}")
async def get_record(record_id: str):
    """Return a single conversion record with full markdown content."""
    records = _load_db()
    record = next((r for r in records if r["id"] == record_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    out_path = OUTPUT_DIR / record["output_filename"]
    full_markdown = ""
    if out_path.exists():
        with open(out_path, "r", encoding="utf-8") as f:
            full_markdown = f.read()

    return {**record, "markdown_content": full_markdown}


@app.get("/api/download/{record_id}")
async def download(record_id: str):
    """Download the converted Markdown file."""
    records = _load_db()
    record = next((r for r in records if r["id"] == record_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    out_path = OUTPUT_DIR / record["output_filename"]
    if not out_path.exists():
        raise HTTPException(status_code=404, detail="Output file not found")

    stem = Path(record["original_filename"]).stem
    return FileResponse(
        path=str(out_path),
        media_type="text/markdown",
        filename=f"{stem}.md",
    )


@app.delete("/api/history/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_record(record_id: str):
    """Delete a conversion record and its output file."""
    records = _load_db()
    record = next((r for r in records if r["id"] == record_id), None)
    if not record:
        log.warning("Delete requested for unknown record_id=%s", record_id)
        raise HTTPException(status_code=404, detail="Record not found")

    out_path = OUTPUT_DIR / record["output_filename"]
    out_path.unlink(missing_ok=True)
    log.info("Deleted record %s ('%s')", record_id[:8], record.get("original_filename"))

    _save_db([r for r in records if r["id"] != record_id])


@app.delete("/api/history", status_code=status.HTTP_204_NO_CONTENT)
async def clear_history():
    """Delete all conversion records and output files."""
    records = _load_db()
    log.info("Clearing all history: %d record(s)", len(records))
    for record in records:
        out_path = OUTPUT_DIR / record["output_filename"]
        out_path.unlink(missing_ok=True)
    _save_db([])
    log.info("History cleared")
