"""Pytest configuration and global isolation fixtures for ForestGuard AI backend tests."""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import socket
import sys
import pytest

# Ensure project root is on sys.path
TESTS_DIR = Path(__file__).resolve().parent
BACKEND_DIR = TESTS_DIR.parent
ROOT_DIR = BACKEND_DIR.parent
ML_DIR = ROOT_DIR / "ml"
for p in [str(ROOT_DIR), str(BACKEND_DIR), str(ML_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

ALLOWED_HOSTS = {"localhost", "127.0.0.1", "::1", "testserver"}


def _is_allowed_host(host) -> bool:
    if host is None or host == "":
        return True
    if host in ALLOWED_HOSTS:
        return True
    if isinstance(host, str) and (host.startswith("127.") or host == "0.0.0.0"):
        return True
    return False


@pytest.fixture(autouse=True)
def block_unmocked_network_calls(monkeypatch):
    """Global socket guard: block socket.connect, socket.create_connection,
    and DNS lookups (socket.getaddrinfo) for any non-localhost host.
    """
    orig_getaddrinfo = socket.getaddrinfo
    orig_connect = socket.socket.connect
    orig_create_connection = socket.create_connection

    def guarded_getaddrinfo(host, port, *args, **kwargs):
        if not _is_allowed_host(host):
            pytest.fail(f"un-mocked network call: DNS lookup for host '{host}' is blocked")
        return orig_getaddrinfo(host, port, *args, **kwargs)

    def guarded_connect(self, address):
        host = address[0] if isinstance(address, tuple) and len(address) > 0 else str(address)
        if not _is_allowed_host(host):
            pytest.fail(f"un-mocked network call: socket connection to host '{host}' is blocked")
        return orig_connect(self, address)

    def guarded_create_connection(address, *args, **kwargs):
        host = address[0] if isinstance(address, tuple) and len(address) > 0 else str(address)
        if not _is_allowed_host(host):
            pytest.fail(f"un-mocked network call: socket.create_connection to host '{host}' is blocked")
        return orig_create_connection(address, *args, **kwargs)

    monkeypatch.setattr(socket, "getaddrinfo", guarded_getaddrinfo)
    monkeypatch.setattr(socket.socket, "connect", guarded_connect)
    monkeypatch.setattr(socket, "create_connection", guarded_create_connection)


@pytest.fixture(autouse=True)
def reset_in_memory_caches():
    """Ensure in-memory caches and failure cooldowns are reset between tests."""
    from backend.weather_service import weather_service, _forecast_memory_cache
    import backend.main as main_mod
    weather_service._last_live_failure_time = 0.0
    _forecast_memory_cache.clear()
    main_mod._firms_failure_cache = None
    yield
    weather_service._last_live_failure_time = 0.0
    _forecast_memory_cache.clear()
    main_mod._firms_failure_cache = None


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
