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
