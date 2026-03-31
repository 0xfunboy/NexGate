#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3001}"

echo "[nexgate] stopping previous dev processes..."
pkill -f "tsx watch src/index.ts" 2>/dev/null || true
pkill -f "node dist/index.js" 2>/dev/null || true

if command -v lsof >/dev/null 2>&1; then
  PORT_PIDS="$(lsof -ti tcp:${PORT} || true)"
  if [[ -n "${PORT_PIDS}" ]]; then
    kill ${PORT_PIDS} 2>/dev/null || true
  fi
fi

cd "${ROOT_DIR}"

echo "[nexgate] starting dev server on port ${PORT}..."
exec npm run dev
