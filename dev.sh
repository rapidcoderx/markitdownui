#!/usr/bin/env bash
# dev.sh – Start the backend and frontend dev servers together
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo "──────────────────────────────────────────"
echo "  MarkItDown UI  –  Development Startup"
echo "──────────────────────────────────────────"

# ── Pre-flight: clear stale processes on our ports ───────────────────────────
for port in 8000 5173; do
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "→ Clearing stale process(es) on port $port (PIDs: $(echo $pids | tr '\n' ' '))…"
    echo "$pids" | xargs kill -KILL 2>/dev/null || true
    sleep 0.5
  fi
done

# ── Backend ──────────────────────────────────────────────────────────────────
# Ensure uv is available
if ! command -v uv &>/dev/null; then
  echo "→ Installing uv…"
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

if [ ! -d "$BACKEND/.venv" ]; then
  echo "→ Installing Python 3.13 via uv…"
  uv python install 3.13
  echo "→ Creating virtual environment (Python 3.13)…"
  uv venv --python 3.13 "$BACKEND/.venv"
fi

echo "→ Installing backend dependencies…"
uv pip install --python "$BACKEND/.venv" \
  fastapi "uvicorn[standard]" python-multipart aiofiles python-dotenv pydantic "markitdown[all]" anthropic

# Load .env if present (e.g. ANTHROPIC_API_KEY)
if [ -f "$ROOT/backend/.env" ]; then
  echo "→ Loading backend/.env…"
  set -a; source "$ROOT/backend/.env"; set +a
fi

echo "→ Starting FastAPI backend on http://localhost:8000 …"
"$BACKEND/.venv/bin/uvicorn" main:app \
  --app-dir "$BACKEND" \
  --reload \
  --port 8000 &
BACKEND_PID=$!

# ── Frontend ─────────────────────────────────────────────────────────────────
if [ ! -d "$FRONTEND/node_modules" ]; then
  echo "→ Installing frontend dependencies…"
  (cd "$FRONTEND" && npm install)
fi

echo "→ Starting Vite dev server on http://localhost:5173 …"
(cd "$FRONTEND" && npm run dev) &
FRONTEND_PID=$!

# Save PIDs so stop.sh can cleanly kill them
echo "$BACKEND_PID" > "$ROOT/.backend.pid"
echo "$FRONTEND_PID" > "$ROOT/.frontend.pid"

echo ""
echo "  Backend  →  http://localhost:8000"
echo "  Frontend →  http://localhost:5173"
echo ""
echo "  Press Ctrl+C to stop both servers, or run ./stop.sh"
echo ""

# Graceful shutdown
trap "echo ''; echo 'Shutting down…'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; rm -f '$ROOT/.backend.pid' '$ROOT/.frontend.pid'; exit 0" INT TERM

wait $BACKEND_PID $FRONTEND_PID
