# AGENTS.md – AI Agent Continuity Guide

## Project: MarkItDown UI

This file helps an AI agent (GitHub Copilot, Claude, GPT-4, etc.) quickly understand the project state
and continue work without re-discovering context.

---

## What This Project Is

A full-stack web application + CLI tool that converts any document to Markdown using
**Microsoft MarkItDown** (`pip install markitdown`). The UI allows drag-and-drop uploads,
bulk conversions, preview/download of results, and keeps a local conversion history.

---

## Repository Layout

```
markitdownui/
├── backend/                  FastAPI REST API (Python)
│   ├── main.py               ← All API routes, MarkItDown integration, file handling
│   ├── requirements.txt      ← Python dependencies (loose pins for broad Python compat)
│   ├── .venv/                ← Python virtual env (not committed)
│   ├── db.json               ← Conversion history (auto-created, not committed)
│   └── storage/
│       ├── uploads/          ← Temp upload files (immediately deleted after conversion)
│       └── outputs/          ← Converted .md files (persisted, ID-keyed)
│
├── frontend/                 React 19 + Vite 6 + TypeScript
│   ├── src/
│   │   ├── App.tsx           ← Root layout, state orchestration
│   │   ├── main.tsx          ← React entry point
│   │   ├── index.css         ← Tailwind base + CSS variables (dark mode default)
│   │   ├── components/
│   │   │   ├── Header.tsx    ← Top navigation bar
│   │   │   ├── DropZone.tsx  ← File upload + queue + convert button
│   │   │   ├── ConversionHistory.tsx  ← History list; filter by filename + calendar (bubbles on dates with conversions)
│   │   │   ├── MarkdownPreview.tsx    ← Dialog: rendered preview + raw tabs
│   │   │   └── ui/           ← ShadCN-style primitives (button, badge, card, dialog,
│   │   │                         progress, scroll-area, separator, tabs, toast, toaster,
│   │   │                         use-toast.ts)
│   │   ├── lib/
│   │   │   ├── api.ts        ← Typed fetch wrappers for all API endpoints
│   │   │   └── utils.ts      ← cn(), formatBytes(), formatDate(), getFileIcon()
│   │   └── types/index.ts    ← Shared TypeScript interfaces
│   ├── tailwind.config.js    ← Dark theme + typography + animate plugins
│   ├── vite.config.ts        ← /api proxy → localhost:8000
│   └── package.json
│
├── cli/
│   ├── markitdownui.py       ← Click-based CLI (convert, history commands)
│   └── requirements.txt      ← markitdown + rich + click
│
├── dev.sh                    ← One-command startup (creates venv, installs, runs both servers)
├── QUICKSTART.md             ← End-user setup guide
├── README.md                 ← Full project documentation
├── AGENTS.md                 ← This file
├── prompt.md                 ← Original design brief
└── context.md                ← Detailed technical context for agent continuity
```

---

## Tech Stack Decisions

| Layer | Choice | Why |
|-------|--------|-----|
| Backend | FastAPI | Async, auto-docs, multipart support |
| Conversion | markitdown (Microsoft) | Supports 20+ formats |
| Frontend | React 19 + Vite 6 | Latest, fast HMR |
| UI | Hand-rolled ShadCN-style on Radix UI | No CLI/registry needed, full control |
| Styling | Tailwind CSS v3 + dark mode | Utility-first, consistent design tokens |
| Font | Inter (Google Fonts) | Modern, clean |
| CLI | Click + Rich | Beautiful terminal output |

---

## Known Constraints

1. **Python version** – use **Python 3.14** via `uv`. `uv python install 3.14` pins the
   correct interpreter automatically.
2. **`uv` preferred over `pip`** – always create venvs with `uv venv --python 3.14` and install
   with `uv pip install`. This ensures reproducible envs and avoids system-Python conflicts.
3. **No database** – history is stored in `backend/db.json` (flat JSON array). Sufficient for
   local use; swap with SQLite/Postgres for production.
4. **No auth** – bare API, no authentication. Not suited for public internet without a gateway.
5. **File retention** – upload temp files are deleted immediately; output `.md` files persist
   under `backend/storage/outputs/` with UUID-named files.
6. **`enable_plugins` removed** – the installed version of markitdown does not expose
   `enable_plugins` in `__init__`. Removed from both `backend/main.py` and `cli/markitdownui.py`.

---

## Active Ports

| Service | Port | Notes |
|---------|------|-------|
| FastAPI backend | 8000 | `backend/.venv/bin/uvicorn main:app --app-dir backend --port 8000` |
| Vite frontend | 5173 | `npm run dev` (proxies /api → :8000) |

## Python Environment Setup (canonical)

```bash
# Run once per machine / fresh clone
uv python install 3.14

# Backend
uv venv --python 3.14 backend/.venv
uv pip install --python backend/.venv fastapi "uvicorn[standard]" \
 python-multipart aiofiles pydantic python-dotenv markitdown

# CLI (optional standalone venv)
uv venv --python 3.14 cli/.venv
uv pip install --python cli/.venv markitdown rich click
```

---

## Where to Continue

- **Add auth** → Add `python-jose` + JWT middleware in `backend/main.py`
- **SQLite history** → Replace `db.json` with `sqlmodel` + `sqlite`
- **Drag-to-reorder queue** → Add `@dnd-kit/core` to frontend
- **Progress streaming** → Switch single-file endpoint to SSE for real upload %
- **Docker** → `Dockerfile` + `docker-compose.yml` wrapping backend + frontend build
- **Tests** → `pytest` + `httpx` for backend; `vitest` for frontend
