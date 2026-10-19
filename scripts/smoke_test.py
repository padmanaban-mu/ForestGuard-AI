"""scripts/smoke_test.py - Post-deployment smoke test for ForestGuard AI.

Validates that all critical endpoints and security barriers function correctly.
Can be executed against a local server or a live Render deployment:

    python scripts/smoke_test.py http://127.0.0.1:8000
    python scripts/smoke_test.py https://forestguard-ai.onrender.com

Exits 0 if all checks pass, 1 if any check fails.
"""

from datetime import datetime, timedelta
import json
import sys
import urllib.error
import urllib.request

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

GREEN = "\033[92m"
RED = "\033[91m"
RESET = "\033[0m"
BOLD = "\033[1m"


def ok(msg: str):
    print(f"  {GREEN}[PASS]{RESET} {msg}")


def fail(msg: str):
    print(f"  {RED}[FAIL]{RESET} {msg}")
    return False


def http_get(url: str, timeout: int = 15):
    """Perform HTTP GET request and return (status_code, content_type, body_text)."""
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "ForestGuardSmokeTest/1.0", "Accept": "*/*"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status = resp.status
            ct = resp.headers.get("content-type", "")
            body = resp.read().decode("utf-8", errors="replace")
            return status, ct, body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return e.code, e.headers.get("content-type", ""), body
    except Exception as e:
        return 0, "", str(e)


def run_smoke_test(base_url: str) -> bool:
    base_url = base_url.rstrip("/")
    print()
    print(f"{BOLD}ForestGuard AI — Post-Deploy Smoke Test{RESET}")
    print(f"Target: {base_url}")
    print("-" * 60)

    all_passed = True

    # 1. GET /health
    status, ct, body = http_get(f"{base_url}/health", timeout=20)
    if status == 200 and "application/json" in ct:
        try:
            data = json.loads(body)
            if data.get("model_loaded") is True and data.get("status") in ("ok", "degraded"):
                ok(f"/health responded 200 OK (status='{data.get('status')}', model='{data.get('model_name')}')")
            else:
                all_passed = fail(f"/health payload invalid: status={data.get('status')}, model_loaded={data.get('model_loaded')}")
        except Exception as e:
            all_passed = fail(f"/health JSON decode error: {e}")
    else:
        all_passed = fail(f"/health returned HTTP {status} (expected 200 JSON)")

    # 2. GET /zones
    status, ct, body = http_get(f"{base_url}/zones", timeout=15)
    if status == 200:
        try:
            data = json.loads(body)
            zones = data.get("zones", [])
            if len(zones) == 13:
                ok(f"/zones returned 13 Uttarakhand districts")
            else:
                all_passed = fail(f"/zones returned {len(zones)} districts (expected exactly 13)")
        except Exception as e:
            all_passed = fail(f"/zones JSON decode error: {e}")
    else:
        all_passed = fail(f"/zones returned HTTP {status} (expected 200)")

    # 3. GET /forecast?days=3
    status, ct, body = http_get(f"{base_url}/forecast?days=3", timeout=30)
    if status == 200:
        try:
            data = json.loads(body)
            districts = data.get("districts", [])
            if len(districts) == 13:
                # Validate date attribution: risk_for_date == weather_date + 1 day
                date_attr_ok = True
                total_days_checked = 0
                for dist in districts:
                    fc_list = dist.get("forecast", [])
                    for fc in fc_list:
                        w_dt = datetime.strptime(fc["weather_date"], "%Y-%m-%d").date()
                        r_dt = datetime.strptime(fc["risk_for_date"], "%Y-%m-%d").date()
                        if r_dt != w_dt + timedelta(days=1):
                            date_attr_ok = False
                            break
                        total_days_checked += 1
                if date_attr_ok and total_days_checked > 0:
                    ok(f"/forecast?days=3 validated for all 13 districts (risk_for_date = weather_date + 1 day)")
                else:
                    all_passed = fail(f"/forecast?days=3 date attribution check failed (expected risk_for_date = weather_date + 1)")
            else:
                all_passed = fail(f"/forecast returned {len(districts)} districts (expected 13)")
        except Exception as e:
            all_passed = fail(f"/forecast JSON decode error: {e}")
    else:
        all_passed = fail(f"/forecast returned HTTP {status} (expected 200)")

    # 4. GET /model/metrics
    status, ct, body = http_get(f"{base_url}/model/metrics", timeout=15)
    if status == 200 and "application/json" in ct:
        try:
            data = json.loads(body)
            if "validation_metrics" in data and "risk_thresholds" in data:
                ok(f"/model/metrics returned 200 with reconciled metrics and risk thresholds")
            else:
                all_passed = fail("/model/metrics missing required fields")
        except Exception as e:
            all_passed = fail(f"/model/metrics JSON decode error: {e}")
    else:
        all_passed = fail(f"/model/metrics returned HTTP {status} (expected 200 JSON)")

    # 5. GET / (SPA index)
    status, ct, body = http_get(f"{base_url}/", timeout=15)
    if status == 200 and "text/html" in ct and ("<html" in body.lower() or "<!doctype" in body.lower()):
        ok("/ served frontend SPA index.html (HTTP 200 text/html)")
    else:
        all_passed = fail(f"/ failed to serve HTML index: HTTP {status}, content-type={ct}")

    # 6. GET /dashboard (SPA route fallback)
    status, ct, body = http_get(f"{base_url}/dashboard", timeout=15)
    if status == 200 and "text/html" in ct and ("<html" in body.lower() or "<!doctype" in body.lower()):
        ok("/dashboard route correctly returned SPA index.html (HTTP 200 text/html)")
    else:
        all_passed = fail(f"/dashboard fallback failed: HTTP {status}, content-type={ct}")

    # 7. Security Checks: /.env and /reports/../.env must return 404
    status_env, _, body_env = http_get(f"{base_url}/.env", timeout=10)
    if status_env in (404, 400) and "FIRMS_MAP_KEY" not in body_env:
        ok("/.env blocked (HTTP 404/400, no secrets exposed)")
    else:
        all_passed = fail(f"Security leak: /.env returned HTTP {status_env}!")

    status_trav, _, body_trav = http_get(f"{base_url}/reports/../.env", timeout=10)
    if status_trav in (404, 400) and "FIRMS_MAP_KEY" not in body_trav:
        ok("/reports/../.env path traversal blocked (HTTP 404/400)")
    else:
        all_passed = fail(f"Security leak: /reports/../.env returned HTTP {status_trav}!")

    print("-" * 60)
    if all_passed:
        print(f"{GREEN}{BOLD}All smoke tests PASSED successfully.{RESET}\n")
        return True
    else:
        print(f"{RED}{BOLD}Smoke tests FAILED. See details above.{RESET}\n")
        return False


if __name__ == "__main__":
    target_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
    success = run_smoke_test(target_url)
    sys.exit(0 if success else 1)
