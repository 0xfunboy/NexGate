#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${1:-${ROOT_DIR}/nexgate-state-${STAMP}.tar.gz}"

cd "${ROOT_DIR}"

echo "[nexgate] stopping running browser/server processes before backup..."
pkill -f "tsx watch src/index.ts" 2>/dev/null || true
pkill -f "node dist/index.js" 2>/dev/null || true
pkill -f "chrome.*frontend-llm-gateway" 2>/dev/null || true
sleep 1

mkdir -p "$(dirname "${OUT_FILE}")"

echo "[nexgate] creating state archive: ${OUT_FILE}"
tar -czf "${OUT_FILE}" \
  --exclude='.playwright/**/Cache' \
  --exclude='.playwright/**/Code Cache' \
  --exclude='.playwright/**/GPUCache' \
  --exclude='.playwright/**/GrShaderCache' \
  --exclude='.playwright/**/GraphiteDawnCache' \
  --exclude='.playwright/**/ShaderCache' \
  .playwright \
  accounts.config.json \
  providers.config.json \
  .env

echo "[nexgate] backup completed"
