#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE_PATH="${1:-}"

if [[ -z "${ARCHIVE_PATH}" ]]; then
  echo "usage: ./restore-state.sh /path/to/nexgate-state.tar.gz" >&2
  exit 1
fi

if [[ ! -f "${ARCHIVE_PATH}" ]]; then
  echo "[nexgate] archive not found: ${ARCHIVE_PATH}" >&2
  exit 1
fi

cd "${ROOT_DIR}"

echo "[nexgate] stopping running browser/server processes before restore..."
pkill -f "tsx watch src/index.ts" 2>/dev/null || true
pkill -f "node dist/index.js" 2>/dev/null || true
pkill -f "chrome.*frontend-llm-gateway" 2>/dev/null || true
sleep 1

echo "[nexgate] restoring state from ${ARCHIVE_PATH}"
tar -xzf "${ARCHIVE_PATH}" -C "${ROOT_DIR}"

echo "[nexgate] restore completed"
echo "[nexgate] start the app with: ./run-dev.sh"
