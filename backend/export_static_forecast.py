"""Pre-generate backend/cache/forecast_latest.json for offline and zero-.env operability.

Fetches the Open-Meteo operational forecast for all 13 districts, computes daily features
via ml/features.py and calibrated predictions via model_service, and saves the verified
7-day payload to backend/cache/forecast_latest.json.
"""

from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import sys

# Ensure backend and ml directories are on sys.path
BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
ML_DIR = ROOT_DIR / "ml"
for p in [str(BACKEND_DIR), str(ROOT_DIR), str(ML_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from backend.config import CACHE_DIR, STATIC_FORECAST_CACHE
from backend.model_service import model_service
from backend.weather_service import weather_service
from ml.features import ALL_DISTRICTS

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def export_static_forecast(days: int = 7):
    """Fetch live forecast and export clean static JSON cache."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Generating static forecast cache for {len(ALL_DISTRICTS)} districts ({days} days)...")

    district_forecasts = []
    for district in ALL_DISTRICTS:
        logger.info(f"  Fetching Open-Meteo forecast for {district}...")
        raw_data, _ = weather_service.fetch_district_forecast_weather(district, days=days)
        if not raw_data:
            logger.error(f"Failed to fetch weather for {district}.")
            raise RuntimeError(f"Could not retrieve weather data for {district}")

        dist_fc = weather_service.compute_district_daily_forecast(district, raw_data, days=days)
        district_forecasts.append(dist_fc.model_dump())

    payload = {
        "model": model_service.best_model_name,
        "weather_source": "cached",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": "cached",
        "days": days,
        "count": len(district_forecasts),
        "districts": district_forecasts,
    }

    with open(STATIC_FORECAST_CACHE, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    logger.info(f"[SUCCESS] Static forecast cache saved to {STATIC_FORECAST_CACHE}")
    print(f"[OK] Static forecast cache exported to {STATIC_FORECAST_CACHE} ({len(district_forecasts)} districts, {days} days)")


if __name__ == "__main__":
    export_static_forecast(days=7)
