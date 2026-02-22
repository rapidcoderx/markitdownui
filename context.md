# context.md – Technical State Snapshot

> Detailed technical context for AI agent continuity.  
> Last updated: **February 21, 2026**

---

## Backend (`backend/main.py`)

### Framework
- **FastAPI** with CORS middleware (origin: `http://localhost:5173`)
- **uvicorn** as ASGI server (`--app-dir backend --port 8000`)
- **aiofiles** for async chunked file writes (1 MB chunks)

### Endpoints

```python
GET  /api/health                  → {"status": "ok"}
POST /api/convert                 → ConversionRecord (201)
POST /api/convert/bulk            → {"results": [...], "total": N} (201)
GET  /api/history                 → List[ConversionRecord]
GET  /api/history/{id}            → ConversionRecordDetail (includes markdown_content)
GET  /api/download/{id}           → FileResponse (.md, Content-Disposition: attachment)
DELETE /api/history/{id}          → 204 No Content
DELETE /api/history               → 204 No Content
```

### Persistence
- **`backend/db.json`** — flat JSON array of `ConversionRecord` dicts, newest first
- Records are prepended (insert at index 0) on each conversion
- Output files: `backend/storage/outputs/{uuid}.md`
- Upload temp files: `backend/storage/uploads/{uuid}{ext}` — deleted immediately after conversion

### ConversionRecord shape (Python + TypeScript aligned)
```json
{
  "id": "uuid4 string",
  "original_filename": "report.pdf",
  "output_filename": "abc123.md",
  "file_size": 204800,
  "status": "success | error",
  "error_message": null,
  "created_at": "2026-02-21T11:30:00+00:00",
  "markdown_preview": "first 500 chars of markdown..."
}
```
`GET /api/history/{id}` additionally returns `"markdown_content"` (full text).

### MarkItDown integration
```python
from markitdown import MarkItDown
md_converter = MarkItDown()           # no enable_plugins – not in this version
result = md_converter.convert(str(path))
markdown = result.markdown            # or result.text_content (deprecated alias)
```

---

## Frontend (`frontend/src/`)

### Component tree
```
App.tsx  (state: history[], previewId, historyLoading)
├── Header.tsx            (sticky top bar with logo + GitHub link)
├── Card (Upload panel)
│   └── DropZone.tsx      (drag/drop + file queue + convert button)
├── Card (History panel)
│   └── ConversionHistory.tsx  (list, delete, clear, view, download)
├── MarkdownPreview.tsx   (Radix Dialog, tabbed preview/raw, copy/download)
└── Toaster.tsx           (Radix Toast notifications)
```

### State flow
1. `App` loads history on mount via `GET /api/history`
2. `DropZone` collects `UploadFile[]`, calls `convertFiles()` → `POST /api/convert/bulk`
3. On success, `onConverted(records)` is called → App prepends new records to `history[]`
4. `ConversionHistory` renders rows with eye/download/trash actions
5. Clicking eye sets `previewId` in App → `MarkdownPreview` dialog opens, fetches `GET /api/history/{id}`

### API client (`lib/api.ts`)
```typescript
convertFile(file)          → ConversionRecord
convertFiles(files[])      → BulkConversionResponse
getHistory()               → ConversionRecord[]
getRecord(id)              → ConversionRecordDetail
deleteRecord(id)           → void
clearHistory()             → void
downloadFile(id, filename) → void (triggers browser download)
```
All requests go to `/api/*` — Vite dev server proxies to `http://localhost:8000`.

### Styling system
- **Dark mode by default** (`<html class="dark">` in `index.html`)
- CSS custom properties on `:root` and `.dark` in `src/index.css`
- Tailwind v3 with `tailwindcss-animate` and `@tailwindcss/typography` plugins
- `cn()` utility from `clsx` + `tailwind-merge`
- Font: Inter 300/400/500/600/700 from Google Fonts

### UI primitives (all hand-crafted, no shadcn CLI needed)
| Component | File | Source |
|-----------|------|--------|
| Button | `ui/button.tsx` | CVA variants |
| Badge | `ui/badge.tsx` | CVA variants (success/error/warning variants added) |
| Card | `ui/card.tsx` | Pure Tailwind |
| Dialog | `ui/dialog.tsx` | `@radix-ui/react-dialog` |
| Progress | `ui/progress.tsx` | `@radix-ui/react-progress` |
| ScrollArea | `ui/scroll-area.tsx` | `@radix-ui/react-scroll-area` |
| Separator | `ui/separator.tsx` | `@radix-ui/react-separator` |
| Tabs | `ui/tabs.tsx` | `@radix-ui/react-tabs` |
| Toast | `ui/toast.tsx` | `@radix-ui/react-toast` |
| Toaster | `ui/toaster.tsx` | Uses `use-toast.ts` hook |
| use-toast | `ui/use-toast.ts` | In-memory reducer + listeners |

---

## CLI (`cli/markitdownui.py`)

### Commands
```
markitdownui convert <files...>  [options]
  -o, --output FILE      Single output file path
  -d, --dir DIR          Output directory for bulk conversion
  --server URL           Upload to running UI backend instead of converting locally
  --print / --no-print   Print markdown to stdout

markitdownui history  [options]
  --clear                Delete all records in db.json
  --db PATH              Override db.json path
  -n, --limit INT        Max rows to display (default: 20)
```

### Local conversion flow
- Uses `MarkItDown().convert(path)` directly
- Shows Rich progress bar
- Without `-o`/`-d`: writes `{stem}.md` next to source file

### Server conversion flow
- POSTs each file to `{server}/api/convert`
- Reports back record IDs (can be used for download)

---

## Development Environment

### Recommended setup (February 21, 2026)
- **Python** — managed by **`uv`**: `uv python install 3.14` then `uv venv --python 3.14`
- **Node** v18+ / npm 9+ — `node_modules/` installed, `vite build` passes (1926 modules, 4.93s)
- **TypeScript** — `tsc --noEmit` passes with zero errors
- **Backend** — FastAPI starts, `/api/health` → `{"status":"ok"}`, `/api/history` → `[]`

### Install uv (once per machine)
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env   # or restart shell
```

### Backend venv (canonical)
```bash
uv python install 3.14
uv venv --python 3.14 backend/.venv
uv pip install --python backend/.venv \
  fastapi "uvicorn[standard]" python-multipart aiofiles pydantic python-dotenv markitdown
```

### Start backend
```bash
backend/.venv/bin/uvicorn main:app --app-dir backend --reload --port 8000
```

### Known issues resolved
| Issue | Fix Applied |
|-------|-------------|
| Python version | Use `uv python install 3.14` and `uv venv --python 3.14` |
| `MarkItDown(enable_plugins=False)` TypeError | Removed arg in `main.py` and `cli/markitdownui.py` |
| `@radix-ui/react-badge` package doesn't exist | Removed from `package.json`, Badge is self-contained |
| `uvicorn[standard]` shell glob expansion in zsh | Quoted in `dev.sh` and `uv pip install` |
| `requirements.txt` strict version pins breaking pip | Changed to `>=` loose pins |

---

## Pending / Nice-to-have

| Feature | Effort | Where |
|---------|--------|-------|
| Progress via SSE (real upload %) | Medium | backend `main.py` + `DropZone.tsx` |
| SQLite / SQLModel history | Medium | `backend/main.py` (drop-in for db.json) |
| Docker Compose | Low | new `Dockerfile` + `docker-compose.yml` |
| JWT auth | High | `backend/main.py` + frontend |
| Drag-to-reorder queue | Low | `DropZone.tsx` + `@dnd-kit/core` |
| Vitest unit tests | Medium | `frontend/src/__tests__/` |
| pytest integration tests | Medium | `backend/tests/` |
| Output file cleanup cron | Low | `backend/main.py` background task |
| Dark/light toggle | Low | `App.tsx` + theme context |
