#!/usr/bin/env bash
# scripts/build_frontend.sh — Build the React frontend and copy the output into backend/static/.
# Run from the repo root:  bash scripts/build_frontend.sh
# Requires Node.js 22+ and npm 10+ (not needed at runtime after build).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
STATIC_DIR="$REPO_ROOT/backend/static"

echo "=== ForestGuard AI — Frontend Build ==="
echo "Frontend : $FRONTEND_DIR"
echo "Output   : $STATIC_DIR"
echo ""

# 1. Verify Node/npm availability
if ! command -v node &>/dev/null; then
  echo "ERROR: node not found. Install Node.js 22+ from https://nodejs.org/" >&2
  exit 1
fi
if ! command -v npm &>/dev/null; then
  echo "ERROR: npm not found. Install npm 10+ with Node.js." >&2
  exit 1
fi
echo "Node $(node --version)  npm $(npm --version)"

# 2. Install exact locked dependencies
echo ""
echo "--- npm ci (locked install) ---"
cd "$FRONTEND_DIR"
npm ci

# 3. Production build (VITE_API_URL intentionally left empty → same-origin relative URLs)
echo ""
echo "--- npm run build ---"
npm run build

# 4. Verify dist was produced
if [ ! -f "$FRONTEND_DIR/dist/index.html" ]; then
  echo "ERROR: frontend/dist/index.html not found after build." >&2
  exit 1
fi

# 5. Clear old static files and copy fresh build
mkdir -p "$STATIC_DIR"
# Remove contents but keep the directory itself
find "$STATIC_DIR" -mindepth 1 -delete 2>/dev/null || true

echo ""
echo "--- Copying frontend/dist/ → backend/static/ ---"
cp -r "$FRONTEND_DIR/dist/." "$STATIC_DIR/"

# 6. Verify
if [ ! -f "$STATIC_DIR/index.html" ]; then
  echo "ERROR: backend/static/index.html missing after copy." >&2
  exit 1
fi

FILE_COUNT=$(find "$STATIC_DIR" -type f | wc -l)
echo ""
echo "SUCCESS: $FILE_COUNT files copied to backend/static/"
echo "Production and Render need no Node.js — backend/static/ is committed to git."
