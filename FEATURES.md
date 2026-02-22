# MarkItDown UI — Feature Development Roadmap

All planned features for the project, ordered by priority within each tier.
Each entry lists the exact files to touch, implementation steps, and how to verify it works.

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Shipped |
| 🔨 | In progress |
| 📋 | Planned — not started |

---

## ✅ Shipped

| Feature | Notes |
|---------|-------|
| FastAPI backend + MarkItDown integration | `backend/main.py` |
| React 19 + Vite + Tailwind frontend | `frontend/src/` |
| Drag-and-drop bulk file upload | `DropZone.tsx` |
| Conversion history (last 3 inline + dialog) | `ConversionHistory.tsx` |
| Markdown preview (rendered + raw tabs) | `MarkdownPreview.tsx` |
| Anthropic Claude vision adapter | `_AnthropicAdapter` in `main.py` |
| OpenAI GPT-4o vision adapter | `_OpenAIAdapter` in `main.py` |
| LLM token usage tracking per file | `llm_tokens` field on `ConversionRecord` |
| Cumulative session token banner | `ConversionHistory.tsx` + `App.tsx` |
| Light / dark theme toggle | `lib/theme.tsx` + `Header.tsx` |
| Structured backend logging | `logging.config.dictConfig` in `main.py` |
| Frontend logger | `lib/logger.ts` |
| Queue auto-clear after conversion | `DropZone.tsx` |
| Info dialog with author + attribution | `Header.tsx` |
| CLI tool | `cli/markitdownui.py` |
| URL → Markdown conversion | `POST /api/convert/url`, `DropZone.tsx` URL tab, `api.ts` |
| Copy to clipboard (preview dialog) | `MarkdownPreview.tsx` — Copy button, 2s Check feedback |
| Search/filter history | `ConversionHistory.tsx` — client-side filter by filename |
| Mini stats strip | `StatsStrip.tsx` + `App.tsx` — files converted, MB processed, tokens (session) |
| Calendar filter by date | `ConversionHistory.tsx` — calendar picker with bubbles on dates that have conversions; click a date to filter |
| Vercel deployment | `api/index.py`, `vercel.json`, `_VERCEL` flag + in-memory store in `backend/main.py` |
| LLM rate limiting (session + daily) | `_llm_daily` counter + `LLM_SESSION_LIMIT`/`LLM_DAILY_LIMIT` in `main.py`; graceful fallback to plain MarkItDown with UI notice |
| Vercel Analytics | `@vercel/analytics/react` `<Analytics />` in `main.tsx` |

---

## Phase 1 — Infrastructure (Stability + Deployability)

### 1.1 SQLite History Persistence 📋

Replace `db.json` with a proper SQLite database via `aiosqlite`. Zero ORM — raw SQL, simple and fast.

**Why:** `db.json` reads and writes the entire file on every request. SQLite gives concurrent-safe, query-able, indexed storage with no external service.

**Files to change**

| File | Change |
|------|--------|
| `backend/requirements.txt` | Add `aiosqlite>=0.20.0` |
| `backend/main.py` | Replace `_load_db` / `_save_db` with async helpers; add `DB_PATH` env var |
| `backend/.env.example` | Add `# DB_PATH=backend/data/markitdownui.db` |
| `.gitignore` | Add `backend/data/` |

**Implementation**

1. Add `DB_PATH = Path(os.getenv("DB_PATH", str(BASE_DIR / "data" / "markitdownui.db")))` and `DB_PATH.parent.mkdir(parents=True, exist_ok=True)`

2. Add startup handler:
```python
@app.on_event("startup")
async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS conversions (
                id               TEXT PRIMARY KEY,
                original_filename TEXT NOT NULL,
                output_filename  TEXT NOT NULL,
                file_size        INTEGER NOT NULL,
                status           TEXT NOT NULL,
                error_message    TEXT,
                created_at       TEXT NOT NULL,
                markdown_preview TEXT,
                llm_tokens       TEXT   -- JSON-serialised dict or NULL
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_created_at ON conversions (created_at DESC)")
        await db.commit()
```

3. Replace all `_load_db` / `_save_db` call sites with:
```python
async def db_insert(record: dict) -> None: ...
async def db_get_history(limit: int = 200) -> list[dict]: ...
async def db_get(record_id: str) -> dict | None: ...
async def db_delete(record_id: str) -> bool: ...
async def db_clear() -> int: ...   # returns rows deleted
```
`llm_tokens` serialised with `json.dumps` on write, `json.loads` on read.

4. All six endpoint call sites in `main.py` become `await db_…()`.

**Verify**
```bash
# start backend, convert a file, kill it, restart
uvicorn main:app --app-dir backend --port 8000
# history should survive restart
sqlite3 backend/data/markitdownui.db "SELECT id, original_filename, status FROM conversions"
```

---

### 1.2 Docker Container Deployment 📋

One `docker compose up --build` runs the full production stack. Nginx serves the React SPA and proxies `/api/*` to FastAPI. SQLite lives in a named Docker volume.

**Files to create**

| File | Purpose |
|------|---------|
| `backend/Dockerfile` | Python 3.14 image, uv venv, uvicorn |
| `frontend/Dockerfile` | Multi-stage: Node build → nginx:alpine serve |
| `frontend/nginx.conf` | SPA routing + `/api/` reverse proxy |
| `docker-compose.yml` | Orchestrates both services + named volumes |
| `backend/.dockerignore` | Exclude `.venv`, `storage/uploads`, `data/` |
| `frontend/.dockerignore` | Exclude `node_modules`, `dist/` |

**`backend/Dockerfile`**
```dockerfile
FROM python:3.14-slim
RUN pip install uv
WORKDIR /app
COPY requirements.txt .
RUN uv venv .venv --python 3.14 && uv pip install --python .venv -r requirements.txt
COPY . .
ENV DB_PATH=/data/markitdownui.db \
    OUTPUT_DIR=/outputs \
    PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**`frontend/Dockerfile`**
```dockerfile
# Stage 1 – build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 – serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**`frontend/nginx.conf`**
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass         http://backend:8000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**`docker-compose.yml`**
```yaml
services:
  backend:
    build: ./backend
    env_file: ./backend/.env
    volumes:
      - markitdown_data:/data
      - markitdown_outputs:/outputs
    expose:
      - "8000"
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  markitdown_data:
  markitdown_outputs:
```

**Verify**
```bash
docker compose up --build
# Open http://localhost — convert a file
docker compose down && docker compose up
# History still present (SQLite in named volume)
```

---

### 1.3 Vercel Deployment ✅

Frontend deployed as static; backend as a Python serverless function. History is **in-memory per invocation** — natural per-user isolation with no auth required.

**Why in-memory on Vercel:** Vercel's filesystem is ephemeral and not shared across invocations. An in-memory store means no user ever sees another user's documents. No database service needed.

**Files to create/change**

| File | Purpose |
|------|---------|
| `api/index.py` | Entry point Vercel uses to find the FastAPI app |
| `vercel.json` | Build config, routes, env var declarations |
| `requirements.txt` (root) | Points to `backend/requirements.txt` for Vercel's Python builder |
| `backend/main.py` | `_VERCEL` flag; in-memory store branch in all db helpers; `/tmp` output path |

**`api/index.py`**
```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
from main import app  # noqa: F401  – Vercel imports 'app'
```

**`vercel.json`**
```json
{
  "buildCommand": "cd frontend && npm ci && npm run build",
  "outputDirectory": "frontend/dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.py" }
  ],
  "functions": {
    "api/index.py": { "runtime": "python3.14", "maxDuration": 60 }
  },
  "env": {
    "VERCEL": "1",
    "LOG_LEVEL": "INFO"
  }
}
```

**Root `requirements.txt`**
```
-r backend/requirements.txt
```

**`backend/main.py` changes**
```python
_VERCEL = bool(os.getenv("VERCEL"))
_mem_store: list[dict] = []          # only used when _VERCEL=True
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR",
    "/tmp/markitdownui/outputs" if _VERCEL else str(BASE_DIR / "storage" / "outputs")))
```
Each `db_*` async function has a two-line in-memory branch at the top:
```python
async def db_insert(record: dict) -> None:
    if _VERCEL:
        _mem_store.insert(0, record); return
    # … SQLite path …
```

**Verify**
```bash
VERCEL=1 uvicorn main:app --app-dir backend --port 8000
# Convert a file; stop and restart; confirm history is gone (expected)
vercel dev   # full local Vercel simulation
vercel deploy --prod
```

---

## Phase 2 — UX Quick Wins

### 2.1 URL → Markdown Conversion ✅

MarkItDown supports `converter.convert("https://...")`. URL tab in DropZone; `POST /api/convert/url`.

**Files**

| File | Change |
|------|--------|
| `backend/main.py` | `POST /api/convert/url` endpoint accepting `{ "url": "https://…" }` |
| `frontend/src/components/DropZone.tsx` | Add URL tab — text input + convert button |
| `frontend/src/lib/api.ts` | `convertUrl(url: string)` typed fetch wrapper |
| `frontend/src/types/index.ts` | No change needed |

**Backend endpoint sketch**
```python
class UrlConvertRequest(BaseModel):
    url: str

@app.post("/api/convert/url", response_model=ConversionRecord, status_code=201)
async def convert_url(body: UrlConvertRequest):
    result = md_converter.convert(body.url)
    # save to OUTPUT_DIR, insert record same as file path
    ...
```

---

### 2.2 Copy to Clipboard ✅

One-click copy in the Markdown preview dialog; button shows Check icon for 2 s after copy.

---

### 2.3 Search/Filter History ✅

Client-side filter by filename in `ConversionHistory.tsx`; search input at top of panel.

---

### 2.4 Mini Stats Strip ✅

Stats strip between hero and grid: files converted, MB processed, tokens (session). `StatsStrip.tsx` + `App.tsx`.

---

## Phase 3 — Power Features

### 3.1 Custom LLM Vision Prompt 📋

Optional per-conversion "Instructions for AI" field. Useful for diagrams, charts, and structured images.

**Files**

| File | Change |
|------|--------|
| `backend/main.py` | Accept optional `llm_prompt: str` on `/api/convert` and `/api/convert/bulk`; pass to `converter.convert(path, llm_prompt=llm_prompt)` |
| `frontend/src/components/DropZone.tsx` | Collapsible "Advanced options" section with a textarea |
| `frontend/src/lib/api.ts` | Add `llm_prompt` to the `FormData` payload |

---

### 3.2 Bulk ZIP Export 📋

Multi-select checkboxes on history rows; "Download selected as ZIP" button uses stdlib `zipfile`.

**Files**

| File | Change |
|------|--------|
| `backend/main.py` | `GET /api/export?ids=id1,id2,…` → streams a ZIP using `zipfile` + `StreamingResponse` |
| `frontend/src/components/ConversionHistory.tsx` | Checkbox per row; "Export" button in header; calls `GET /api/export` |
| `frontend/src/lib/api.ts` | `exportZip(ids: string[])` → triggers browser download |

---

### 3.3 In-Browser Markdown Editor 📋

Edit the converted Markdown result before downloading; persist edits back to server.

**Files**

| File | Change |
|------|--------|
| `backend/main.py` | `PUT /api/history/{id}` — accepts `{ "content": "…" }`, overwrites output file |
| `frontend/src/components/MarkdownPreview.tsx` | "Edit" tab with `<textarea>` (or CodeMirror); "Save" button calls `PUT /api/history/{id}` |
| `frontend/src/lib/api.ts` | `updateRecord(id: string, content: string)` |

---

### 3.4 Paste / Raw Text Input 📋

Third input mode: paste HTML, raw text, or Markdown into a textarea; backend converts via a temp file.

**Files**

| File | Change |
|------|--------|
| `backend/main.py` | `POST /api/convert/text` accepts `{ "content": "…", "filename": "pasted.html" }`; writes to temp file, converts, deletes |
| `frontend/src/components/DropZone.tsx` | "Paste" tab next to Upload / URL |

---

### 3.5 File Type Breakdown Chart 📋

Donut chart of conversions by file type on the history card, built with CSS only (no chart library).

**Files**

| File | Change |
|------|--------|
| `frontend/src/components/ConversionHistory.tsx` | Add `FileTypeChart` sub-component; compute counts from `records`; render as CSS conic-gradient donut |

---

### 3.6 API Key Protection 📋

Single shared `API_KEY` env var; middleware guards all `/api/*` routes except `/api/health`.

**Files**

| File | Change |
|------|--------|
| `backend/main.py` | Add `_API_KEY = os.getenv("API_KEY", "")` + `@app.middleware("http")` that checks `Authorization: Bearer <key>` header when key is set |
| `backend/.env.example` | Add `# API_KEY=change-me-before-sharing` |
| `frontend/src/lib/api.ts` | Read `VITE_API_KEY` env var; add `Authorization` header to all requests |
| `frontend/.env.example` | Add `# VITE_API_KEY=` |

---

### 3.7 Watch Folder CLI Command 📋

`markitdownui watch <dir>` auto-converts any file dropped into a directory.

**Files**

| File | Change |
|------|--------|
| `cli/requirements.txt` | Add `watchdog>=4.0.0` |
| `cli/markitdownui.py` | Add `watch` command using `watchdog.observers.Observer` + `FileSystemEventHandler` |

```bash
markitdownui watch ~/Downloads --out ~/Documents/markdown
# Watches ~/Downloads; converts any new file; saves .md to ~/Documents/markdown
```

---

## Effort + Impact Matrix

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| SQLite persistence | Medium | ⬆⬆⬆ Production-ready | **P1** |
| Docker deployment | Medium | ⬆⬆⬆ Shareable | **P1** |
| Vercel deployment | Medium | ⬆⬆⬆ Zero-ops hosting | **P1** |
| URL → Markdown | Low | ⬆⬆⬆ New file type | **P1** |
| Copy to clipboard | Low | ⬆⬆ Daily friction | **P1** |
| Custom LLM prompt | Low | ⬆⬆⬆ AI power-user | **P2** |
| Bulk ZIP export | Medium | ⬆⬆⬆ Batch workflows | **P2** |
| Search/filter history | Low | ⬆⬆ UX polish | **P2** |
| Mini stats strip | Low | ⬆ Delight | **P2** |
| Markdown editor | High | ⬆⬆⬆ Full workflow | **P3** |
| Raw text / paste input | Medium | ⬆⬆ Power user | **P3** |
| API key protection | Low | ⬆⬆⬆ Security | **P3** |
| File type chart | Medium | ⬆ Visual polish | **P3** |
| Watch folder CLI | Medium | ⬆⬆ Automation | **P3** |

---

## Suggested Sprint Order

```
Sprint 1 (infra)   : SQLite → Docker → Vercel
Sprint 2 (ux)      : URL convert → Copy to clipboard → Custom LLM prompt → Search
Sprint 3 (batch)   : Bulk ZIP export → Stats strip
Sprint 4 (advance) : Markdown editor → Paste input → API key → File type chart → Watch CLI
```
