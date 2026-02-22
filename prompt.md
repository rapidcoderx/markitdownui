# prompt.md – Original Design Brief

> This file records the original user request that generated this codebase,
> preserved verbatim for reference and continuity.

---

## Original Request (February 21, 2026)

> Lets work on a UI project, which helps to convert the artifacts into markdown
> using microsoft markitdown use context7 to make sure to refer latest documentation.
> UI should use all modern constructs, react/vite/shadcn tailwind. modern font.
> user should be able to upload document and the convert that into markdown.
> support bulk upload as well. also provide cli utility. keep track of converted document

---

## Interpreted Requirements

| # | Requirement | Implementation |
|---|-------------|----------------|
| 1 | Convert any document to Markdown | Microsoft MarkItDown library (Python) |
| 2 | Web UI with modern stack | React 19 + Vite 6 + TypeScript |
| 3 | ShadCN + Tailwind | Hand-crafted Radix UI primitives + TW v3 |
| 4 | Modern font | Inter (Google Fonts) |
| 5 | Upload single document | Drag-and-drop DropZone + file input |
| 6 | Bulk upload | Multi-file queue → `/api/convert/bulk` |
| 7 | Track conversions | `db.json` history with preview/download/delete |
| 8 | CLI utility | Click + Rich CLI (`cli/markitdownui.py`) |
| 9 | Latest MarkItDown documentation | Fetched via Context7 (`/microsoft/markitdown`) |

---

## Documentation Sources Used

- Context7 library: `/microsoft/markitdown` (official Microsoft repo)
- MarkItDown API: `MarkItDown().convert(path) → result.markdown`
- Supported extras: `markitdown[all]` (core + optional format handlers)

---

## Follow-up Requests

### February 21, 2026 – Continuity Docs

> If there is issue in testing, finish the coding, and create quickstart.md,
> I'll do the test. Create prompt.md, AGENTS.md and context.md with project
> details for continuity.

**Actions taken:**
- Fixed `enable_plugins=False` argument (not supported in installed markitdown version)
- Fixed `requirements.txt` to use loose version pins for Python 3.14 compat
- Fixed `dev.sh` to quote `uvicorn[standard]` and avoid shell glob expansion
- Created `QUICKSTART.md` — end-user setup guide
- Created `AGENTS.md` — AI agent continuity guide
- Created `prompt.md` — this file
- Created `context.md` — detailed technical state snapshot

### February 21, 2026 – Phase 2 UX (2.1–2.4) + docs

**Actions taken:**
- Updated all docs to **Python 3.14** (AGENTS.md, FEATURES.md, README, QUICKSTART, context.md, dev.sh)
- **2.1 URL → Markdown:** `POST /api/convert/url`, DropZone URL tab, `convertUrl()` in api.ts
- **2.2 Copy to clipboard:** Already shipped in MarkdownPreview.tsx; marked in FEATURES.md
- **2.3 Search/filter history:** Client-side filter by filename in ConversionHistory.tsx
- **2.4 Mini stats strip:** StatsStrip.tsx (files, MB processed, session tokens) between hero and grid in App.tsx
- Updated README features and API table; FEATURES.md shipped table and Phase 2 entries

---

### February 21, 2026 – Vercel Deployment (1.3)

**Goal:** Enable `vercel deploy` with frontend as static build and backend as Python serverless function.

**Actions taken:**
- Checked out new `vercel` git branch
- Created `api/index.py` — Vercel entry point that re-exports `app` from `backend/main.py`
- Created `vercel.json` — build config (`frontend/dist`), `/api/*` rewrite → `api/index.py`, `python3.12` runtime, 60 s max duration
- Created root `requirements.txt` — `-r backend/requirements.txt` for Vercel's Python builder
- Patched `backend/main.py`:
  - Added `_VERCEL = bool(os.getenv("VERCEL"))` flag and `_mem_store: list[dict]`
  - `UPLOAD_DIR` / `OUTPUT_DIR` now resolve to `/tmp/markitdownui/…` when `_VERCEL=True`
  - `_load_db` / `_save_db` have in-memory branches so history is per-invocation (ephemeral)
  - CORS widened to `["*"]` (with `allow_credentials=False`) on Vercel
  - `/api/config` now exposes `"vercel": true` flag
- Updated `FEATURES.md` — 1.3 marked ✅
- Updated `README.md` and `QUICKSTART.md` with Vercel deploy instructions

---

## Next Session

Possible next steps (see FEATURES.md for full backlog):
- **1.1 SQLite persistence** — replace `db.json` with `aiosqlite` for durable local history
- **1.2 Docker** — `docker compose up --build` for production stack (Nginx + FastAPI)
- **3.1 Custom LLM prompt** — per-conversion AI instruction textarea in DropZone
- **3.2 Bulk ZIP export** — multi-select + download selected as ZIP
