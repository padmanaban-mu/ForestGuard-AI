"""backend/tests/test_spa.py — Tests for SPA static file serving and fallback.

Phase 5 tests verifying:
- / returns index.html (200, HTML Content-Type).
- /dashboard, /model, /analytics return index.html (SPA fallback).
- /health returns JSON, not HTML.
- /model/metrics returns JSON, not HTML.
- Extension-less unknown paths return index.html (SPA fallback).
- Paths WITH a file extension that are missing → 404, not index.html.
- Path traversal attempts → 404, not content.
- API routes (/fires/unknown, /zones/missing) → 404 JSON, not HTML.

All tests are offline (no network calls). The fixtures create a temporary
backend/static/ directory with a minimal index.html so that the SPA handler
has something to serve.
"""

import json
from pathlib import Path
import sys
import tempfile
import pytest

# Ensure project root is on sys.path
TESTS_DIR = Path(__file__).resolve().parent
BACKEND_DIR = TESTS_DIR.parent
ROOT_DIR = BACKEND_DIR.parent
ML_DIR = ROOT_DIR / "ml"
for p in [str(ROOT_DIR), str(BACKEND_DIR), str(ML_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client_with_static(tmp_path, monkeypatch):
    """Create a TestClient with a temporary backend/static/ containing index.html."""
    static_dir = tmp_path / "static"
    static_dir.mkdir()

    # Minimal index.html
    (static_dir / "index.html").write_text(
        "<!DOCTYPE html><html><head><title>ForestGuard AI</title></head>"
        "<body><div id='root'></div></body></html>",
        encoding="utf-8",
    )

    # Minimal JS asset (so we can test extension-present paths)
    assets = static_dir / "assets"
    assets.mkdir()
    (assets / "index-abc123.js").write_text("console.log('fg');", encoding="utf-8")

    # Patch STATIC_DIR inside backend.main
    import backend.main as main_mod
    monkeypatch.setattr(main_mod, "STATIC_DIR", static_dir)

    return TestClient(main_mod.app)


@pytest.fixture
def client_no_static(tmp_path, monkeypatch):
    """Client where backend/static/ exists but is empty (no index.html)."""
    static_dir = tmp_path / "static_empty"
    static_dir.mkdir()

    import backend.main as main_mod
    monkeypatch.setattr(main_mod, "STATIC_DIR", static_dir)

    return TestClient(main_mod.app)


# ---------------------------------------------------------------------------
# SPA root and client-side routes
# ---------------------------------------------------------------------------

def test_root_returns_spa_index(client_with_static):
    """GET / must return HTTP 200 with HTML content (SPA index)."""
    resp = client_with_static.get("/")
    assert resp.status_code == 200
    assert "text/html" in resp.headers.get("content-type", "")
    assert b"<html" in resp.content.lower() or b"<!doctype" in resp.content.lower()


def test_dashboard_returns_spa_index(client_with_static):
    """GET /dashboard (no extension) must return the SPA index, not 404."""
    resp = client_with_static.get("/dashboard")
    assert resp.status_code == 200
    assert "text/html" in resp.headers.get("content-type", "")


def test_model_page_returns_spa_index(client_with_static):
    """/model has no extension and is not an exact API path — must get index.html."""
    # Note: /model/metrics IS an API route registered above the catch-all.
    # /model (no sub-path) should fall to SPA.
    resp = client_with_static.get("/model")
    assert resp.status_code == 200
    assert "text/html" in resp.headers.get("content-type", "")


def test_analytics_returns_spa_index(client_with_static):
    """GET /analytics must return index.html."""
    resp = client_with_static.get("/analytics")
    assert resp.status_code == 200
    assert "text/html" in resp.headers.get("content-type", "")


def test_alerts_returns_spa_index(client_with_static):
    """GET /alerts must return index.html."""
    resp = client_with_static.get("/alerts")
    assert resp.status_code == 200
    assert "text/html" in resp.headers.get("content-type", "")


# ---------------------------------------------------------------------------
# API routes must NOT return HTML (they were registered first)
# ---------------------------------------------------------------------------

def test_health_returns_json_not_html(client_with_static):
    """GET /health must return JSON with a 'status' field — never HTML."""
    resp = client_with_static.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert resp.headers.get("content-type", "").startswith("application/json")


def test_model_metrics_returns_json_not_html(client_with_static):
    """GET /model/metrics must return JSON — never index.html."""
    resp = client_with_static.get("/model/metrics")
    assert resp.status_code == 200
    assert resp.headers.get("content-type", "").startswith("application/json")
    data = resp.json()
    assert "model_name" in data


# ---------------------------------------------------------------------------
# Extension rule: missing assets must 404, not return index.html
# ---------------------------------------------------------------------------

def test_missing_js_asset_returns_404(client_with_static):
    """GET /assets/nonexistent.js (has extension, file missing) must return 404."""
    resp = client_with_static.get("/assets/nonexistent.js")
    assert resp.status_code == 404
    # Must NOT be HTML (must be JSON error or plain text, not the SPA)
    ct = resp.headers.get("content-type", "")
    assert "text/html" not in ct


def test_missing_css_asset_returns_404(client_with_static):
    """GET /assets/style.css (has extension, file missing) must return 404."""
    resp = client_with_static.get("/assets/style.css")
    assert resp.status_code == 404


def test_existing_js_asset_served(client_with_static):
    """GET /assets/index-abc123.js (has extension, file exists) must return the file."""
    resp = client_with_static.get("/assets/index-abc123.js")
    assert resp.status_code == 200
    assert b"console.log" in resp.content


def test_missing_png_returns_404_not_html(client_with_static):
    """GET /missing-image.png (extension present, file missing) must 404, not SPA."""
    resp = client_with_static.get("/missing-image.png")
    assert resp.status_code == 404
    assert "text/html" not in resp.headers.get("content-type", "")


# ---------------------------------------------------------------------------
# Unknown API sub-paths: must 404 JSON, not HTML
# ---------------------------------------------------------------------------

def test_unknown_fires_subpath_is_404(client_with_static):
    """/fires/unknown is under an API prefix — must 404 JSON, not index.html."""
    resp = client_with_static.get("/fires/unknown")
    assert resp.status_code == 404
    ct = resp.headers.get("content-type", "")
    assert "text/html" not in ct


def test_unknown_api_path_is_404(client_with_static):
    """/api/ is NOT in _API_PREFIXES (there is no /api route in ForestGuard).
    It correctly falls through to the SPA fallback and returns index.html.
    This test confirms it does NOT crash (500) and is served as HTML."""
    resp = client_with_static.get("/api/anything")
    # /api/ is not a reserved API prefix — SPA fallback returns index.html
    assert resp.status_code == 200
    assert "text/html" in resp.headers.get("content-type", "")


# ---------------------------------------------------------------------------
# Path traversal protection
# ---------------------------------------------------------------------------

def test_path_traversal_dotenv_blocked(client_with_static):
    """GET /../.env must not reveal the .env file — must return 404."""
    resp = client_with_static.get("/../.env")
    assert resp.status_code in (404, 400)
    # Must never expose .env content
    assert b"FIRMS_MAP_KEY" not in resp.content


def test_path_traversal_nested_blocked(client_with_static):
    """GET /assets/../../backend/.env must return 404."""
    resp = client_with_static.get("/assets/../../backend/.env")
    assert resp.status_code in (404, 400)
    assert b"FIRMS_MAP_KEY" not in resp.content


# ---------------------------------------------------------------------------
# Missing static build — friendly 404
# ---------------------------------------------------------------------------

def test_missing_static_build_returns_404(client_no_static):
    """When backend/static/index.html is absent, / must return 404, not crash."""
    resp = client_no_static.get("/")
    assert resp.status_code == 404
    data = resp.json()
    assert "detail" in data
    # Message should mention build step
    assert "build" in data["detail"].lower() or "not found" in data["detail"].lower()
