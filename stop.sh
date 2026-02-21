#!/usr/bin/env bash
# stop.sh – Stop the MarkItDown UI dev servers (backend :8000 + frontend :5173)

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "──────────────────────────────────────────"
echo "  MarkItDown UI  –  Stopping Servers"
echo "──────────────────────────────────────────"

# Kill a PID and all its child processes
kill_tree() {
  local pid="$1"
  if kill -0 "$pid" 2>/dev/null; then
    # Kill all children first
    local children
    children=$(pgrep -P "$pid" 2>/dev/null || true)
    for child in $children; do
      kill_tree "$child"
    done
    kill "$pid" 2>/dev/null || true
  fi
}

# Kill everything on a TCP port: SIGTERM then SIGKILL after 2 s
kill_port() {
  local label="$1"
  local port="$2"
  local pids
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -z "$pids" ]; then
    echo "→ Nothing listening on port $port."
    return
  fi
  echo "→ Stopping $label on port $port (PIDs: $(echo $pids | tr '\n' ' '))…"
  echo "$pids" | xargs kill -TERM 2>/dev/null || true
  # Wait up to 2 s for graceful shutdown, then force-kill
  local waited=0
  while [ $waited -lt 20 ]; do
    sleep 0.1
    pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    [ -z "$pids" ] && return
    waited=$((waited + 1))
  done
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "→ Force-killing $label (SIGKILL) on port $port…"
    echo "$pids" | xargs kill -KILL 2>/dev/null || true
  fi
}

# ── Step 1: kill saved process trees from PID files ──────────────────────────
for pid_file in "$ROOT/.backend.pid" "$ROOT/.frontend.pid"; do
  if [ -f "$pid_file" ]; then
    pid=$(cat "$pid_file")
    kill_tree "$pid"
    rm -f "$pid_file"
  fi
done

# ── Step 2: port-based sweep (catches any orphans) ───────────────────────────
kill_port "FastAPI backend" 8000
kill_port "Vite frontend"   5173

echo ""
echo "  All servers stopped."
echo ""
