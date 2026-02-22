# MarkItDown UI – Quick Start

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| uv | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | bundled with Node |

> **`uv` manages Python for you** — running `uv python install 3.14` downloads and pins CPython 3.14  
> in seconds. No system Python required.

---

## Option A – One command (recommended)

```bash
git clone <repo-url> markitdownui
cd markitdownui
chmod +x dev.sh
./dev.sh
```

Open **http://localhost:5173** in your browser.

---

## Option B – Manual setup

### 1. Backend (FastAPI + MarkItDown)

```bash
cd backend

# Install Python 3.14 and create a virtual environment
uv python install 3.14
uv venv --python 3.14

# Install dependencies
uv pip install fastapi "uvicorn[standard]" python-multipart aiofiles pydantic python-dotenv markitdown

# Start API server
.venv/bin/uvicorn main:app --app-dir . --reload --port 8000
```

API is now live at **http://localhost:8000**  
Interactive docs: **http://localhost:8000/docs**

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

UI is now live at **http://localhost:5173**

---

## Option C – CLI only (no server needed)

```bash
cd cli

# Create a throwaway venv for the CLI
uv python install 3.14
uv venv --python 3.14
uv pip install markitdown rich click

# Convert a single file
.venv/bin/python markitdownui.py convert report.pdf

# Bulk convert
python markitdownui.py convert *.docx -d ./output

# View history
python markitdownui.py history

# Help
python markitdownui.py --help
```

---

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/convert` | Convert single file |
| POST | `/api/convert/bulk` | Convert many files |
| POST | `/api/convert/url` | Convert URL to Markdown |
| GET | `/api/history` | List all conversions |
| GET | `/api/history/{id}` | Single record + full markdown |
| GET | `/api/download/{id}` | Download `.md` file |
| DELETE | `/api/history/{id}` | Delete one record |
| DELETE | `/api/history` | Clear all history |

---

## Supported File Formats

```
Documents  : .pdf  .docx  .doc  .pptx  .ppt
Spreadsheet: .xlsx  .xls  .csv
Web        : .html  .htm  .xml
Text       : .txt  .md  .rst  .json  .yaml  .yml
Images     : .png  .jpg  .jpeg  .gif  .bmp  .webp
Audio      : .mp3  .wav  .m4a
Archives   : .zip
Other      : .epub
```

---

## Troubleshooting

### Install `uv` first
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env   # or restart your shell
```

### MarkItDown install issues
```bash
# Use Python 3.14 via uv
uv python install 3.14
uv venv --python 3.14
uv pip install markitdown
```

### Port already in use
```bash
# Kill whatever is on 8000
lsof -ti :8000 | xargs kill -9
# Kill whatever is on 5173
lsof -ti :5173 | xargs kill -9
```

### CORS errors in browser
Ensure the backend is running on port 8000 and the frontend on 5173.  
The Vite dev server proxies `/api` → `http://localhost:8000` automatically.

### Frontend build errors
```bash
cd frontend
rm -rf node_modules
npm install
npm run dev
```
