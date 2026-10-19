"""scripts/check_setup.py - Pre-flight environment check for ForestGuard AI.

Run from the repo root:
    python scripts/check_setup.py

Prints a color-coded checklist and exits 0 if all required local components
are present, 1 if any required item is missing. Network checks (Open-Meteo
reachability) are informational only and never cause a non-zero exit.
"""

import socket
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows consoles if possible
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# -- ANSI colours -----------------------------------------------------------
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

def ok(msg):    print(f"  {GREEN}[OK]  {RESET} {msg}")
def fail(msg):  print(f"  {RED}[FAIL]{RESET} {msg}"); return False
def info(msg):  print(f"  {YELLOW}[INFO]{RESET} {msg}")

# -- Repo root (the directory that contains this script's parent) ------------
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT  = SCRIPT_DIR.parent

# -- Required files ---------------------------------------------------------
REQUIRED_FILES = {
    "ML model":          REPO_ROOT / "ml/models/risk_model.joblib",
    "Climatology JSON":  REPO_ROOT / "ml/data/processed/climatology_district_month.json",
    "Zones JSON":        REPO_ROOT / "ml/zones.json",
    "Zones GeoJSON":     REPO_ROOT / "frontend/public/data/zones.geojson",
    "Forecast cache":    REPO_ROOT / "backend/cache/forecast_latest.json",
    "Static index.html": REPO_ROOT / "backend/static/index.html",
    "Metrics JSON":      REPO_ROOT / "ml/reports/metrics.json",
    "Backend .env.example": REPO_ROOT / "backend/.env.example",
}

all_ok = True

print()
print(f"{BOLD}  ForestGuard AI - setup checklist{RESET}")
print("  " + "-" * 54)

# 1. Python version
major, minor = sys.version_info.major, sys.version_info.minor
if major == 3 and minor == 13:
    ok(f"Python {sys.version.split()[0]} (3.13 OK)")
else:
    fail(f"Python {sys.version.split()[0]} - need 3.13 (got {major}.{minor})")
    all_ok = False

# 2. Required files
print()
print("  Required files:")
for label, path in REQUIRED_FILES.items():
    rel = path.relative_to(REPO_ROOT)
    if path.exists():
        size_kb = path.stat().st_size // 1024
        ok(f"{label} ({rel}) - {size_kb} KB")
    else:
        fail(f"{label} MISSING: {rel}")
        all_ok = False

# 3. Port 8000 free
print()
print("  Network:")
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("127.0.0.1", 8000))
    s.close()
    ok("Port 8000 is free")
except OSError:
    fail("Port 8000 is already in use - stop the existing process or change the port")
    all_ok = False

# 4. backend/.env present (informational)
env_path = REPO_ROOT / "backend" / ".env"
if env_path.exists():
    ok("backend/.env exists")
else:
    info("backend/.env not found - run.bat/run.sh will copy .env.example automatically")

# 5. Open-Meteo reachability (informational, never fails)
print()
print("  External services (informational only):")
try:
    sock = socket.create_connection(("api.open-meteo.com", 443), timeout=3)
    sock.close()
    ok("Open-Meteo API reachable - live weather forecasts available")
except Exception as exc:
    info(f"Open-Meteo not reachable ({type(exc).__name__}) - server will use cached forecast")

# 6. Summary
print()
print("  " + "-" * 54)
if all_ok:
    print(f"  {GREEN}{BOLD}All checks passed.{RESET}  Run run.bat (Windows) or ./run.sh to start.")
else:
    print(f"  {RED}{BOLD}One or more checks failed.{RESET}  See FAIL items above.")
print()

sys.exit(0 if all_ok else 1)
