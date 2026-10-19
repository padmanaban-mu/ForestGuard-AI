#!/usr/bin/env bash
# run.sh — One-command launcher for ForestGuard AI (macOS / Linux).
# Creates .venv if missing, installs runtime requirements, and starts the server.
# Press Ctrl+C to stop.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$REPO_ROOT/.venv"
REQ="$REPO_ROOT/requirements-serve.txt"
ENV_EXAMPLE="$REPO_ROOT/backend/.env.example"
ENV_FILE="$REPO_ROOT/backend/.env"
URL="http://127.0.0.1:8000"

echo ""
echo " ============================================================"
echo "  ForestGuard AI — single-server launcher"
echo " ============================================================"
echo ""

# ---------------------------------------------------------------
# 1. Verify Python 3.13
# ---------------------------------------------------------------
PY=""
if command -v python3.13 &>/dev/null; then
    PY="python3.13"
elif command -v python3 &>/dev/null; then
    # Verify the exact minor version
    _minor=$(python3 -c "import sys; print(sys.version_info.minor)")
    _major=$(python3 -c "import sys; print(sys.version_info.major)")
    if [ "$_major" = "3" ] && [ "$_minor" = "13" ]; then
        PY="python3"
    fi
fi

if [ -z "$PY" ]; then
    echo " ERROR: Python 3.13 is not installed or not on PATH."
    echo "        Install it from https://python.org/downloads/"
    echo "        Other Python minor versions are NOT accepted."
    exit 1
fi

echo " Python : $($PY --version)"

# ---------------------------------------------------------------
# 2. Create virtual environment if missing
# ---------------------------------------------------------------
if [ ! -f "$VENV/bin/python" ]; then
    echo " Creating virtual environment at .venv ..."
    "$PY" -m venv "$VENV"
fi

# ---------------------------------------------------------------
# 3. Install / upgrade runtime requirements
# ---------------------------------------------------------------
echo " Installing requirements-serve.txt ..."
"$VENV/bin/pip" install --quiet --upgrade pip
"$VENV/bin/pip" install --quiet -r "$REQ"

# ---------------------------------------------------------------
# 4. Copy .env.example to backend/.env if .env is missing
# ---------------------------------------------------------------
if [ ! -f "$ENV_FILE" ] && [ -f "$ENV_EXAMPLE" ]; then
    echo " Copying backend/.env.example → backend/.env (no key values; add FIRMS_MAP_KEY later)"
    cp "$ENV_EXAMPLE" "$ENV_FILE"
fi

# ---------------------------------------------------------------
# 5. Open browser in background after a short delay
# ---------------------------------------------------------------
(sleep 3 && {
    if command -v open &>/dev/null; then
        open "$URL"            # macOS
    elif command -v xdg-open &>/dev/null; then
        xdg-open "$URL"        # Linux with desktop environment
    fi
}) &

# ---------------------------------------------------------------
# 6. Start uvicorn in the FOREGROUND (Ctrl+C stops it)
# ---------------------------------------------------------------
echo ""
echo " Starting server at $URL — press Ctrl+C to stop."
echo ""
exec "$VENV/bin/python" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
