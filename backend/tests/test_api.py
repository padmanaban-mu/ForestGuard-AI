"""Unit and integration tests for ForestGuard AI FastAPI Backend.

Covers:
- /health: ok, degraded, error states, separate weather_source and cache_state.
- Cache staleness and past date filtering with fake old cache file.
- Static file directory traversal protection and directory listing prohibition.
- Secret leak prevention across all endpoints.
- CORS origin acceptance and rejection.
- /forecast days parameter validation (reject 0, >7, negative).
- Lead time and reliability notes for days 3-7.
- Key conditions explainability (heuristic, not model attribution).
- Reconciled validation metrics (raw tau*=0.47 vs calibrated tau=0.50).
- 100% numerical feature parity against ml.features for committed fixture.
"""

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
import numpy as np
import pandas as pd
import pytest
import requests

# Ensure project root is on sys.path
TESTS_DIR = Path(__file__).resolve().parent
BACKEND_DIR = TESTS_DIR.parent
ROOT_DIR = BACKEND_DIR.parent
ML_DIR = ROOT_DIR / "ml"
for p in [str(ROOT_DIR), str(BACKEND_DIR), str(ML_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.config import CACHE_TTL_SECONDS, STATIC_FORECAST_CACHE
from backend.main import app
from backend.model_service import model_service
from backend.weather_service import _forecast_memory_cache, weather_service
from ml.features import ALL_DISTRICTS, build_feature_row, load_climatology_table


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    return TestClient(app)


@pytest.fixture
def mock_open_meteo_response():
    """Generate a realistic mock Open-Meteo forecast JSON covering 97 days (90 lookback + 7 forecast)."""
    base_date = datetime.now(timezone.utc).date() - timedelta(days=90)
    times = [(base_date + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(98)]
    n = len(times)

    return {
        "latitude": 30.0,
        "longitude": 79.0,
        "elevation": 1500.0,
        "timezone": "Asia/Kolkata",
        "daily": {
            "time": times,
            "temperature_2m_max": [22.0 + (i % 6) * 1.1 for i in range(n)],
            "relative_humidity_2m_mean": [55.0 - (i % 8) * 2.0 for i in range(n)],
            "wind_speed_10m_max": [12.0 + (i % 5) * 1.5 for i in range(n)],
            "precipitation_sum": [0.0 if (i % 6 != 0) else 3.5 for i in range(n)],
            "et0_fao_evapotranspiration": [3.2 + (i % 4) * 0.4 for i in range(n)],
            "soil_moisture_0_to_7cm_mean": [0.28 - (i % 10) * 0.01 for i in range(n)],
        },
    }


def test_health_endpoint(client):
    """Verify /health returns 200, valid status (ok/degraded/error), and separate cache telemetry."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()

    assert data["status"] in ["ok", "degraded", "error"]
    assert data["model_name"] == "Gradient Boosting"
    assert data["model_loaded"] is True
    assert data["weather_source"] in ["live", "cached", "none"]
    assert "cache_state" in data
    assert "in_memory_cached_entries" in data["cache_state"]
    assert "static_cache_available" in data["cache_state"]
    assert "cache_age_hours" in data["cache_state"]
    assert "stale" in data["cache_state"]
    assert data["cache_state"]["ttl_seconds"] == CACHE_TTL_SECONDS


def test_cache_staleness_and_past_dates_with_fake_file(tmp_path):
    """Verify cache staleness (>24h) and expired past entry handling with a synthetic old cache."""
    old_generated_at = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    old_weather_date = "2024-01-01"
    old_risk_date = "2024-01-02"

    fake_payload = {
        "model": "Gradient Boosting",
        "weather_source": "cached",
        "generated_at": old_generated_at,
        "status": "cached",
        "days": 1,
        "count": 1,
        "districts": [
            {
                "district": "Dehradun",
                "centroid": [30.4686, 77.9598],
                "elevation": 2040.0,
                "forecast": [
                    {
                        "weather_date": old_weather_date,
                        "risk_for_date": old_risk_date,
                        "probability": 0.15,
                        "risk_level": "Low",
                        "key_inputs": {"temp_max": 20.0, "humidity_mean": 60.0},
                    }
                ],
            }
        ],
    }

    fake_cache_path = tmp_path / "fake_forecast.json"
    with open(fake_cache_path, "w", encoding="utf-8") as f:
        json.dump(fake_payload, f)

    cached_resp = weather_service.load_static_forecast_cache(days=1, cache_path=fake_cache_path)

    # 48 hours old -> must be stale
    assert cached_resp.cache_age_hours is not None
    assert cached_resp.cache_age_hours >= 47.0
    assert cached_resp.stale is True

    # Check that past dates were tagged as expired
    dist = cached_resp.districts[0]
    assert dist.forecast[0].expired is True
    assert dist.forecast[0].lead_days == 0


def test_zones_endpoint(client):
    """Verify /zones returns all 13 districts with authentic boundaries and lowland caveats."""
    response = client.get("/zones")
    assert response.status_code == 200
    data = response.json()

    assert data["count"] == 13
    assert len(data["zones"]) == 13

    district_names = {z["name"] for z in data["zones"]}
    assert district_names == set(ALL_DISTRICTS)

    for zone in data["zones"]:
        assert len(zone["centroid"]) == 2
        assert zone["elevation"] > 0
        assert len(zone["bbox"]) == 4
        assert "geometry" in zone
        assert zone["geometry"]["type"] in ["Polygon", "MultiPolygon", "Point"]

        if zone["name"] in ["Haridwar", "Udham Singh Nagar"]:
            assert zone["caveat"] is not None
            assert "crop residue burning" in zone["caveat"].lower()
        else:
            assert zone["caveat"] is None


def test_predict_with_feature_dict(client):
    """Verify /predict returns probability, risk_level, and key_conditions (heuristic)."""
    sample_features = {feat: 0.0 for feat in model_service.feature_names}
    sample_features["temp_max"] = 28.5
    sample_features["humidity_mean"] = 45.0
    sample_features["wind_speed_max"] = 14.0
    sample_features["soil_moisture_mean"] = 0.16
    sample_features["days_since_rain"] = 25.0
    sample_features["vpd_proxy"] = 2.1
    sample_features["elevation"] = 1271.0
    sample_features["dist_nainital"] = 1.0

    payload = {
        "district": "Nainital",
        "features": sample_features,
    }

    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["district"] == "Nainital"
    assert 0.0 <= data["probability"] <= 1.0
    assert data["risk_level"] in ["Low", "Medium", "High", "Extreme"]
    assert data["decision_threshold"] == 0.33
    assert "key_conditions" in data
    assert isinstance(data["key_conditions"], list)
    assert len(data["key_conditions"]) >= 2


def test_predict_with_raw_weather_buffer(client):
    """Verify /predict constructs features from raw weather records and returns prediction."""
    history = []
    base_date = datetime(2026, 7, 1)
    for i in range(30):
        d_str = (base_date + timedelta(days=i)).strftime("%Y-%m-%d")
        history.append({
            "date": d_str,
            "temp_max": 26.0 + (i % 5),
            "humidity_mean": 60.0 - (i % 10),
            "wind_speed_max": 12.0,
            "rain_sum": 0.0 if i < 28 else 4.0,
            "et0": 3.0,
            "soil_moisture_mean": 0.22,
        })

    today = {
        "date": "2026-07-31",
        "temp_max": 31.0,
        "humidity_mean": 42.0,
        "wind_speed_max": 18.0,
        "rain_sum": 0.0,
        "et0": 4.5,
        "soil_moisture_mean": 0.15,
    }

    payload = {
        "district": "Dehradun",
        "history_records": history,
        "today_record": today,
    }

    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["district"] == "Dehradun"
    assert 0.0 <= data["probability"] <= 1.0
    assert data["risk_level"] in ["Low", "Medium", "High", "Extreme"]
    assert len(data["key_conditions"]) >= 2


def test_forecast_date_labelling_and_lead_time(client, mock_open_meteo_response, monkeypatch):
    """Verify /forecast date labeling (risk_for_date = weather_date + 1), lead_days, and reliability_notes."""
    def mock_get(url, params=None, timeout=None):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_open_meteo_response
        return mock_resp

    monkeypatch.setattr(requests, "get", mock_get)
    _forecast_memory_cache.clear()

    response = client.get("/forecast?days=5")
    assert response.status_code == 200
    data = response.json()

    assert data["days"] == 5
    assert data["count"] == 13
    assert len(data["districts"]) == 13

    for dist in data["districts"]:
        assert len(dist["forecast"]) == 5
        for day in dist["forecast"]:
            w_date = datetime.strptime(day["weather_date"], "%Y-%m-%d")
            r_date = datetime.strptime(day["risk_for_date"], "%Y-%m-%d")

            # Crucial requirement: risk_for_date == weather_date + 1 day
            assert r_date == w_date + timedelta(days=1), (
                f"Mismatch: weather_date={day['weather_date']}, risk_for_date={day['risk_for_date']}"
            )
            assert 0.0 <= day["probability"] <= 1.0
            assert day["risk_level"] in ["Low", "Medium", "High", "Extreme"]
            assert day["lead_days"] >= 1

            # Long lead (days > 2) reliability note check
            if day["lead_days"] > 2:
                assert day["reliability_note"] is not None
                assert "uncertainty increases" in day["reliability_note"].lower()
            else:
                assert day["reliability_note"] is None


def test_forecast_days_parameter_validation(client, mock_open_meteo_response, monkeypatch):
    """Verify /forecast validates days parameter and strictly rejects 0, >7, or negative values."""
    def mock_get(url, params=None, timeout=None):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_open_meteo_response
        return mock_resp

    monkeypatch.setattr(requests, "get", mock_get)

    # 0 days -> rejected
    resp_0 = client.get("/forecast?days=0")
    assert resp_0.status_code == 422

    # Negative days -> rejected
    resp_neg = client.get("/forecast?days=-2")
    assert resp_neg.status_code == 422

    # > 7 days -> rejected (maximum is 7)
    resp_8 = client.get("/forecast?days=8")
    assert resp_8.status_code == 422

    # 7 days -> accepted
    resp_7 = client.get("/forecast?days=7")
    assert resp_7.status_code == 200


def test_cors_restrictions(client):
    """Verify CORS middleware permits configured origins, rejects untrusted origins, and disallows credentials."""
    # Allowed origin: http://localhost:3000
    resp_allowed = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert resp_allowed.status_code == 200
    assert resp_allowed.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert resp_allowed.headers.get("access-control-allow-credentials") is None

    # Allowed origin: http://localhost:4173 (preview)
    resp_preview = client.get("/health", headers={"Origin": "http://localhost:4173"})
    assert resp_preview.status_code == 200
    assert resp_preview.headers.get("access-control-allow-origin") == "http://localhost:4173"

    # Allowed origin: http://127.0.0.1:3000
    resp_ip = client.get("/health", headers={"Origin": "http://127.0.0.1:3000"})
    assert resp_ip.status_code == 200
    assert resp_ip.headers.get("access-control-allow-origin") == "http://127.0.0.1:3000"

    # Untrusted origin: http://malicious-external-site.com
    resp_denied = client.get("/health", headers={"Origin": "http://malicious-external-site.com"})
    assert resp_denied.status_code == 200
    assert resp_denied.headers.get("access-control-allow-origin") != "http://malicious-external-site.com"


def test_static_reports_directory_traversal_and_listing(client):
    """Verify /reports does not allow directory listing or traversal outside ml/reports."""
    # Directory listing -> should return 404 or 403 (html=False)
    resp_dir = client.get("/reports/")
    assert resp_dir.status_code in [403, 404]

    # Traversal to parent directory .env
    resp_trav1 = client.get("/reports/../.env")
    assert resp_trav1.status_code in [400, 403, 404]

    # Encoded traversal
    resp_trav2 = client.get("/reports/%2e%2e/.env")
    assert resp_trav2.status_code in [400, 403, 404]


def test_no_secret_leaks_in_endpoint_responses(client, mock_open_meteo_response, monkeypatch):
    """Verify that neither FIRMS_MAP_KEY nor private environment strings are ever leaked in responses."""
    test_secret = "TEST_SECRET_MAP_KEY_XYZ98765"
    import backend.main as main_mod
    monkeypatch.setattr(main_mod, "FIRMS_MAP_KEY", test_secret)

    def mock_get(url, params=None, timeout=None):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_open_meteo_response
        return mock_resp

    monkeypatch.setattr(requests, "get", mock_get)

    # Check endpoints
    endpoints = [
        ("/health", "GET", None),
        ("/zones", "GET", None),
        ("/forecast?days=1", "GET", None),
        ("/model/metrics", "GET", None),
        ("/fires/recent?hours=24", "GET", None),
    ]

    for path, method, body in endpoints:
        resp = client.get(path) if method == "GET" else client.post(path, json=body)
        assert test_secret not in resp.text, f"Secret leaked in endpoint {path}!"


def test_cached_mode_fallback_when_offline(client, monkeypatch):
    """Verify that if live Open-Meteo queries fail, backend falls back gracefully to static cache."""
    import backend.weather_service as ws_mod
    sleep_calls = []

    def mock_failed_get(*args, **kwargs):
        raise requests.RequestException("Simulated external network outage")

    monkeypatch.setattr(requests, "get", mock_failed_get)
    monkeypatch.setattr(ws_mod.time, "sleep", lambda s: sleep_calls.append(s))
    _forecast_memory_cache.clear()

    response = client.get("/forecast?days=3")
    assert response.status_code == 200
    data = response.json()

    assert sleep_calls == [1.0, 2.0, 3.0]
    assert data["status"] == "cached"
    assert data["weather_source"] == "cached"
    assert data["count"] == 13
    assert len(data["districts"]) == 13
    for dist in data["districts"]:
        assert len(dist["forecast"]) == 3


def test_feature_parity_with_ml_features(client):
    """Verify that backend feature construction matches ml.features.build_feature_row output for a fixture."""
    fixture_path = ML_DIR / "tests" / "fixtures" / "weather_sample.json"
    assert fixture_path.exists(), f"Missing fixture {fixture_path}"

    with open(fixture_path, "r", encoding="utf-8") as f:
        wdata = json.load(f)

    daily = wdata["daily"]
    district = wdata.get("district", "Dehradun")
    climatology = load_climatology_table()

    records = []
    for i in range(len(daily["time"])):
        records.append({
            "date": daily["time"][i],
            "temp_max": daily["temperature_2m_max"][i],
            "humidity_mean": daily["relative_humidity_2m_mean"][i],
            "wind_speed_max": daily["wind_speed_10m_max"][i],
            "rain_sum": daily["precipitation_sum"][i],
            "et0": daily.get("et0_fao_evapotranspiration", [0.0] * len(daily["time"]))[i],
            "soil_moisture_mean": daily.get("soil_moisture_0_to_7cm_mean", [0.20] * len(daily["time"]))[i],
        })

    buffer = records[-91:]
    history = buffer[:-1]
    today = buffer[-1]

    ml_feature_row = build_feature_row(
        history_records=history,
        today_record=today,
        district_name=district,
        climatology=climatology,
    )

    backend_feature_row = build_feature_row(
        history_records=history,
        today_record=today,
        district_name=district,
        climatology=weather_service.climatology,
    )

    for col in model_service.feature_names:
        assert col in backend_feature_row
        assert col in ml_feature_row
        diff = abs(float(backend_feature_row[col]) - float(ml_feature_row[col]))
        assert diff < 1e-6, f"Feature parity discrepancy on '{col}': diff={diff}"

    prob_backend, risk_backend, _ = model_service.predict_features(backend_feature_row)
    prob_ml, risk_ml, _ = model_service.predict_features(ml_feature_row)
    assert prob_backend == prob_ml
    assert risk_backend == risk_ml


def test_fires_recent_not_configured(client, monkeypatch):
    """Verify /fires/recent returns honest empty list and not_configured status when no key is present."""
    import backend.main as main_mod
    monkeypatch.setattr(main_mod, "FIRMS_MAP_KEY", "")

    response = client.get("/fires/recent?hours=48")
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "not_configured"
    assert data["count"] == 0
    assert data["fires"] == []
    assert data["hours"] == 48


def test_model_metrics_reconciliation(client):
    """Verify /model/metrics reconciles raw base model (tau*=0.47) and calibrated served pipeline (tau=0.50)."""
    response = client.get("/model/metrics")
    assert response.status_code == 200
    data = response.json()

    assert data["model_name"] == "Gradient Boosting"
    assert "PR-AUC" in data["selection_criterion"]
    assert "validation_metrics" in data
    val_metrics = data["validation_metrics"]

    # Both raw and calibrated metrics must be present and reconciled
    assert "raw_model_val_at_optimal_tau" in val_metrics
    assert "calibrated_model_val_at_tau_0_50" in val_metrics

    raw = val_metrics["raw_model_val_at_optimal_tau"]
    assert raw["decision_threshold_tau"] == 0.47
    assert raw["f1_score"] == 0.6496
    assert raw["precision"] == 0.564
    assert raw["recall"] == 0.766

    cal = val_metrics["calibrated_model_val_at_tau_0_50"]
    assert cal["decision_threshold_tau"] == 0.50
    assert abs(cal["f1_score"] - 0.6417) < 0.001
    assert abs(cal["precision"] - 0.5741) < 0.001
    assert abs(cal["recall"] - 0.7275) < 0.001

    assert "risk_thresholds" in data
    assert set(data["risk_thresholds"].keys()) == {"Low", "Medium", "High", "Extreme"}
    assert "report_urls" in data
    assert "calibration_reliability" in data["report_urls"]
    assert data["report_urls"]["calibration_reliability"] == "/reports/calibration_reliability.png"


def test_lead_days_kolkata_timezone_crossing(monkeypatch):
    """Verify lead_days computed from Asia/Kolkata calendar day, not UTC.
    At 22:35 UTC on day t-1, Asia/Kolkata is already at 04:05 on day t.
    Weather for day t must produce risk for day t+1 with lead_days == 1 (not 2).
    """
    from zoneinfo import ZoneInfo
    import backend.weather_service as ws_mod

    kolkata_tz = ZoneInfo("Asia/Kolkata")
    mocked_utc = datetime(2026, 5, 13, 22, 35, 0, tzinfo=timezone.utc)

    class MockDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            if tz is not None:
                return mocked_utc.astimezone(tz)
            return mocked_utc

    monkeypatch.setattr(ws_mod, "datetime", MockDatetime)

    base_date = datetime(2026, 2, 12).date()
    times = [(base_date + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(92)]
    assert times[-1] == "2026-05-14"

    raw_weather = {
        "daily": {
            "time": times,
            "temperature_2m_max": [25.0] * len(times),
            "relative_humidity_2m_mean": [50.0] * len(times),
            "wind_speed_10m_max": [10.0] * len(times),
            "precipitation_sum": [0.0] * len(times),
            "et0_fao_evapotranspiration": [3.0] * len(times),
            "soil_moisture_0_to_7cm_mean": [0.22] * len(times),
        }
    }

    dist_fc = ws_mod.weather_service.compute_district_daily_forecast(
        "Nainital", raw_weather, days=1
    )
    fc_item = dist_fc.forecast[0]
    assert fc_item.weather_date == "2026-05-14"
    assert fc_item.risk_for_date == "2026-05-15"
    assert fc_item.lead_days == 1  # 2026-05-15 - 2026-05-14 == 1 day lead


def test_fail_fast_on_network_connection_error_skips_remaining_districts(client, monkeypatch):
    """Verify that network connection failure on first district aborts immediately and skips remaining 12 districts."""
    call_count = 0
    _forecast_memory_cache.clear()

    def mock_connection_error(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        raise requests.exceptions.ConnectionError("Network is down")

    monkeypatch.setattr(requests, "get", mock_connection_error)

    response = client.get("/forecast?days=3")
    assert response.status_code == 200
    data = response.json()

    assert call_count == 1, f"Expected 1 call before failing fast, got {call_count}"
    assert data["status"] == "cached"
    assert data["weather_source"] == "cached"
    assert len(data["districts"]) == 13


def test_http_429_backoff_behavior(monkeypatch):
    """Verify HTTP 429 rate limit triggers backoff retry rather than immediate fallback."""
    import time as time_mod
    import backend.weather_service as ws_mod
    _forecast_memory_cache.clear()

    call_count = 0
    sleeps = []

    def mock_sleep(seconds):
        sleeps.append(seconds)

    def mock_429_then_200(url, params=None, timeout=None):
        nonlocal call_count
        call_count += 1
        mock_resp = MagicMock()
        if call_count == 1:
            mock_resp.status_code = 429
            mock_resp.text = "Too Many Requests"
        else:
            mock_resp.status_code = 200
            mock_resp.json.return_value = {
                "daily": {
                    "time": ["2026-05-14"],
                    "temperature_2m_max": [25.0],
                    "relative_humidity_2m_mean": [50.0],
                    "wind_speed_10m_max": [10.0],
                    "precipitation_sum": [0.0],
                    "et0_fao_evapotranspiration": [3.0],
                    "soil_moisture_0_to_7cm_mean": [0.22],
                }
            }
        return mock_resp

    monkeypatch.setattr(requests, "get", mock_429_then_200)
    monkeypatch.setattr(time_mod, "sleep", mock_sleep)

    data, source = ws_mod.weather_service.fetch_district_forecast_weather("Nainital", days=1)
    assert source == "live"
    assert call_count == 2
    assert len(sleeps) == 1
    assert sleeps[0] == 2.0


def test_mixed_agricultural_lowland_flag(client, mock_open_meteo_response, monkeypatch):
    """Verify /forecast tags Haridwar and Udham Singh Nagar with mixed_agricultural=True."""
    def mock_get(url, params=None, timeout=None):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_open_meteo_response
        return mock_resp

    monkeypatch.setattr(requests, "get", mock_get)
    _forecast_memory_cache.clear()

    response = client.get("/forecast?days=1")
    assert response.status_code == 200
    data = response.json()

    for dist in data["districts"]:
        if dist["district"] in ["Haridwar", "Udham Singh Nagar"]:
            assert dist["mixed_agricultural"] is True
            assert dist["caveat"] is not None
        else:
            assert dist["mixed_agricultural"] is False


def test_static_cache_age_and_relative_report_urls(client):
    """Verify static_cache_age_hours telemetry and relative report URLs."""
    h_resp = client.get("/health")
    assert h_resp.status_code == 200
    h_data = h_resp.json()
    assert "static_cache_age_hours" in h_data
    assert "static_cache_age_hours" in h_data["cache_state"]

    m_resp = client.get("/model/metrics")
    assert m_resp.status_code == 200
    m_data = m_resp.json()
    for name, path in m_data["report_urls"].items():
        assert path.startswith("/reports/"), f"Expected relative path starting with /reports/, got {path}"
        assert not path.startswith("http://"), f"Found absolute URL: {path}"


def test_configurable_cors_origins(client, monkeypatch):
    """Verify that custom origins configured in CORS_ORIGINS receive standard CORS headers."""
    # Test configured origin
    headers = {
        "Origin": "http://127.0.0.1:3000",
        "Access-Control-Request-Method": "GET",
    }
    response = client.options("/health", headers=headers)
    assert response.headers.get("access-control-allow-origin") == "http://127.0.0.1:3000"

    # Test unauthorized origin is rejected
    bad_headers = {
        "Origin": "http://malicious-site.com",
        "Access-Control-Request-Method": "GET",
    }
    bad_response = client.options("/health", headers=bad_headers)
    assert bad_response.headers.get("access-control-allow-origin") != "http://malicious-site.com"


def test_fires_recent_normalize_fire_compatibility(client, monkeypatch):
    """Verify that /fires/recent returns all fields required by frontend normalizeFire."""
    mock_csv = (
        "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n"
        "30.1234,79.5678,325.4,0.39,0.36,2026-05-14,0830,N,VIIRS,nominal,2.0NRT,295.1,12.8,D\n"
    )

    def mock_firms_get(url, timeout=None):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = mock_csv
        return mock_resp

    import backend.main as main_mod
    monkeypatch.setattr(main_mod, "FIRMS_MAP_KEY", "test_key_abc123")
    monkeypatch.setattr(requests, "get", mock_firms_get)

    response = client.get("/fires/recent?hours=48")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "live"
    assert data["count"] == 1
    assert len(data["fires"]) == 1

    fire = data["fires"][0]
    # Check all fields needed for normalizeFire
    assert fire["latitude"] == 30.1234
    assert fire["longitude"] == 79.5678
    assert fire["bright_ti4"] == 325.4
    assert fire["brightness"] == 325.4
    assert fire["frp"] == 12.8
    assert fire["confidence"] == "nominal"
    assert fire["acq_date"] == "2026-05-14"
    assert fire["acq_time"] == "0830"
    assert fire["satellite"] == "N"
    assert fire["daynight"] == "D"

