# MarkItDown UI

A modern web UI and CLI tool for converting any document to **Markdown** using Microsoft's [MarkItDown](https://github.com/microsoft/markitdown) library.

## Features

- **Drag & drop upload** – single or bulk, with live progress
- **URL → Markdown** – paste a web page URL to convert its content
- **Bulk conversion** – all files converted in one API call
- **Conversion history** – persisted locally in `db.json`, with search by filename and calendar filter by date (bubbles on dates that have conversions)
- **Preview pane** – rendered preview and raw Markdown, with copy-to-clipboard
- **One-click download** – download any `.md` output file
- **Mini stats strip** – files converted, data processed, session token count
- **CLI utility** – convert files from your terminal, with or without the server
- **Vercel deployment** – one-command deploy to Vercel; frontend as static build, backend as serverless Python function
- **Modern stack** – React 19 · Vite 6 · ShadCN UI · Tailwind CSS · FastAPI · MarkItDown 0.1+

## Supported Formats

| Category | Extensions |
|---|---|
| Documents | `.pdf` `.docx` `.doc` `.pptx` `.ppt` |
| Spreadsheets | `.xlsx` `.xls` `.csv` |
| Web | `.html` `.htm` `.xml` |
| Text | `.txt` `.md` `.rst` `.json` `.yaml` `.yml` |
| Images | `.png` `.jpg` `.jpeg` `.gif` `.bmp` `.webp` |
| Audio | `.mp3` `.wav` `.m4a` |
| Other | `.epub` `.zip` |

---

## Quick Start

### One command (both servers)

```bash
chmod +x dev.sh
./dev.sh
```

Open **http://localhost:5173** in your browser.

---

### Manual setup

#### Backend (FastAPI + MarkItDown)

```bash
cd backend

# Install Python 3.14 and create virtual environment
uv python install 3.14
uv venv --python 3.14

# Install dependencies
uv pip install fastapi "uvicorn[standard]" python-multipart aiofiles pydantic python-dotenv markitdown

# Run the API server
.venv/bin/uvicorn main:app --app-dir . --reload --port 8000
```

API docs: **http://localhost:8000/docs**

#### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Opens **http://localhost:5173** — proxies `/api` to the backend automatically.

---

## CLI Utility

The CLI works standalone (local conversion) or against the running server.

### Installation

```bash
cd cli
uv python install 3.14
uv venv --python 3.14
uv pip install markitdown rich click
```

### Usage

```bash
# Convert a single file (outputs to stdout)
python markitdownui.py convert report.pdf

# Save output to a specific file
python markitdownui.py convert report.pdf -o report.md

# Bulk-convert into an output directory
python markitdownui.py convert *.docx *.pdf -d ./output

# Convert via the running UI server (uploads the file)
python markitdownui.py convert report.pdf --server http://localhost:8000

# View conversion history (reads backend/db.json)
python markitdownui.py history

# Show only the last 5 records
python markitdownui.py history -n 5

# Clear all history
python markitdownui.py history --clear

# Help
python markitdownui.py --help
python markitdownui.py convert --help
```

### CLI output example

```
┌──────────────────────────────────────────────────┐
│              Conversion Results                  │
├──────────────┬────────┬───────────────┬──────────┤
│ File         │ Status │ Output        │ Time     │
├──────────────┼────────┼───────────────┼──────────┤
│ report.pdf   │  ✓ OK  │ report.md     │ 1.23s    │
│ slides.pptx  │  ✓ OK  │ slides.md     │ 0.87s    │
│ data.xlsx    │  ✓ OK  │ data.md       │ 0.34s    │
└──────────────┴────────┴───────────────┴──────────┘
  3 succeeded
```

---

## Project Structure

```
markitdownui/
├── api/
│   └── index.py           # Vercel serverless entry point
├── backend/
│   ├── main.py            # FastAPI app (REST API)
│   ├── requirements.txt
│   └── storage/
│       ├── uploads/       # Temporary upload files (auto-deleted)
│       └── outputs/       # Converted .md files
│   └── db.json            # Conversion history (auto-created, local mode)
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ui/        # ShadCN primitives
│   │   │   ├── Header.tsx
│   │   │   ├── DropZone.tsx
│   │   │   ├── ConversionHistory.tsx
│   │   │   ├── MarkdownPreview.tsx
│   │   │   └── StatsStrip.tsx
│   │   ├── lib/
│   │   │   ├── api.ts     # API client
│   │   │   └── utils.ts
│   │   └── types/index.ts
│   └── package.json
│
├── cli/
│   ├── markitdownui.py    # Click-based CLI
│   └── requirements.txt
│
├── api/index.py           # Vercel Python serverless entry
├── vercel.json            # Vercel build + routing config
├── requirements.txt       # Root requirements for Vercel builder
├── dev.sh                 # One-command dev startup
└── README.md
```

---

## Vercel Deployment

The frontend builds to a static site; the backend runs as a serverless Python function.
History is **in-memory per invocation** — ephemeral by design, so each user session is isolated.

### Prerequisites

```bash
npm install -g vercel
```

### Local simulation

```bash
# Simulate Vercel environment locally
VERCEL=1 backend/.venv/bin/uvicorn main:app --app-dir backend --port 8000

# Or use the Vercel CLI
vercel dev
```

### Deploy to Vercel

```bash
# First deploy (creates project)
vercel

# Subsequent deploys to production
vercel deploy --prod
```

> **Note:** Set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in the Vercel dashboard
> (*Project → Settings → Environment Variables*) to enable vision conversion for images.

#### LLM rate limits

To protect against runaway API costs, LLM (vision) calls are limited:

| Limit | Default | Override |
|-------|---------|----------|
| Per browser session | 5 calls | `LLM_SESSION_LIMIT` env var |
| Per day (server-wide) | 100 calls | `LLM_DAILY_LIMIT` env var |

When a limit is hit the file is still converted — plain MarkItDown runs without vision and a notice is shown in the UI. No error is returned.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/config` | Feature flags (`vision_enabled`, `vercel`, etc.) |
| `POST` | `/api/convert` | Convert single file |
| `POST` | `/api/convert/bulk` | Convert multiple files |
| `POST` | `/api/convert/url` | Convert URL to Markdown (body: `{ "url": "https://…" }`) |
| `GET` | `/api/history` | List all conversions |
| `GET` | `/api/history/{id}` | Get record + full markdown |
| `GET` | `/api/download/{id}` | Download `.md` file |
| `DELETE` | `/api/history/{id}` | Delete one record |
| `DELETE` | `/api/history` | Clear all history |

---

## License

MIT – see [Microsoft MarkItDown](https://github.com/microsoft/markitdown) for the underlying library license.
