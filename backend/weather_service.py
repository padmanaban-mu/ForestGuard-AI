"""Weather forecasting and feature pipeline service for ForestGuard AI FastAPI Backend."""

from datetime import datetime, timedelta, timezone
import json
import logging
from pathlib import Path
import sys
import time
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo
from cachetools import TTLCache
import pandas as pd
import requests

from backend.config import (
    CACHE_DIR,
    CACHE_TTL_SECONDS,
    CLIMATOLOGY_PATH,
    LOWLAND_CAVEAT_DISTRICTS,
    OPEN_METEO_FORECAST_URL,
    STATIC_FORECAST_CACHE,
    WEATHER_MAX_RETRIES,
    WEATHER_REQUEST_TIMEOUT,
)
from backend.model_service import model_service
from backend.schemas import DistrictForecast, ForecastDay, ForecastResponse

# Ensure ml directory is on sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
ML_DIR = ROOT_DIR / "ml"
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

from ml.features import (
    ALL_DISTRICTS,
    DISTRICT_METADATA,
    build_feature_row,
    compute_features_for_timeseries,
    load_climatology_table,
)

logger = logging.getLogger(__name__)

# In-memory cache for live forecasts: 30-minute TTL
_forecast_memory_cache = TTLCache(maxsize=100, ttl=CACHE_TTL_SECONDS)

KOLKATA_TZ = ZoneInfo("Asia/Kolkata")

LONG_LEAD_RELIABILITY_NOTE = (
    "Numerical weather forecast uncertainty increases significantly beyond 48 hours (days 3-7). "
    "Operational skill is validated primarily for short-lead forecasts (days 1-2)."
)


class WeatherService:
    """Handles Open-Meteo forecast fetching, in-memory caching, feature generation, and offline fallback."""

    def __init__(self):
        self.climatology = load_climatology_table(CLIMATOLOGY_PATH)

    def get_static_cache_age_hours(self) -> Optional[float]:
        """Compute the age in hours of the static forecast cache file on disk."""
        if not STATIC_FORECAST_CACHE.exists():
            return None
        try:
            with open(STATIC_FORECAST_CACHE, "r", encoding="utf-8") as f:
                cdata = json.load(f)
            gen_str = cdata.get("generated_at")
            if not gen_str:
                return None
            now_utc = datetime.now(timezone.utc)
            gen_dt = datetime.fromisoformat(gen_str.replace("Z", "+00:00"))
            return round(max(0.0, (now_utc - gen_dt).total_seconds() / 3600.0), 2)
        except Exception:
            return None

    def fetch_district_forecast_weather(
        self, district: str, days: int = 7
    ) -> Tuple[Optional[Dict[str, Any]], str]:
        """Fetch past 90 days + upcoming forecast days for one district with retry and TTL caching."""
        cache_key = f"{district}_{days}"
        if cache_key in _forecast_memory_cache:
            logger.info(f"Serving forecast for {district} from in-memory cache.")
            return _forecast_memory_cache[cache_key], "live"

        meta = DISTRICT_METADATA.get(district)
        if not meta:
            raise ValueError(f"Unknown district: {district}")

        params = {
            "latitude": meta["latitude"],
            "longitude": meta["longitude"],
            "past_days": 90,  # 90-day lookback buffer matching training features
            "forecast_days": max(1, min(7, days)),
            "daily": [
                "temperature_2m_max",
                "relative_humidity_2m_mean",
                "wind_speed_10m_max",
                "precipitation_sum",
                "et0_fao_evapotranspiration",
                "soil_moisture_0_to_7cm_mean",
            ],
            "timezone": "Asia/Kolkata",
        }

        for attempt in range(1, WEATHER_MAX_RETRIES + 1):
            try:
                resp = requests.get(
                    OPEN_METEO_FORECAST_URL,
                    params=params,
                    timeout=WEATHER_REQUEST_TIMEOUT,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    _forecast_memory_cache[cache_key] = data
                    return data, "live"
                elif resp.status_code == 429:
                    logger.warning(f"Open-Meteo rate limit for {district}, retrying attempt {attempt}...")
                    time.sleep(2.0 * attempt)
                else:
                    logger.warning(f"Open-Meteo HTTP {resp.status_code} for {district}: {resp.text}")
            except (requests.exceptions.ConnectionError, requests.exceptions.ConnectTimeout) as e:
                logger.warning(f"Network connection error for {district}: {e}. Failing fast.")
                return None, "connection_failed"
            except Exception as e:
                logger.warning(f"Open-Meteo request error for {district} (attempt {attempt}): {e}")
                time.sleep(1.0 * attempt)

        logger.error(f"Failed to fetch live forecast for {district} after {WEATHER_MAX_RETRIES} attempts.")
        return None, "cached"

    def compute_district_daily_forecast(
        self, district: str, raw_data: Dict[str, Any], days: int = 7
    ) -> DistrictForecast:
        """Process daily weather series into day-by-day risk predictions with strict date alignment."""
        daily = raw_data.get("daily", {})
        times = daily.get("time", [])
        if not times:
            raise ValueError(f"No daily time series found for {district}")

        sm = daily.get("soil_moisture_0_to_7cm_mean")
        has_sm = sm is not None and any(v is not None for v in sm)

        df_weather = pd.DataFrame({
            "date": times,
            "temp_max": daily.get("temperature_2m_max", []),
            "humidity_mean": daily.get("relative_humidity_2m_mean", []),
            "wind_speed_max": daily.get("wind_speed_10m_max", []),
            "rain_sum": daily.get("precipitation_sum", []),
            "et0": daily.get("et0_fao_evapotranspiration", [0.0] * len(times)),
            "soil_moisture_mean": sm if has_sm else [0.20] * len(times),
        })

        feat_df = compute_features_for_timeseries(
            df_weather, district_name=district, climatology=self.climatology
        )

        forecast_slice = feat_df.iloc[-days:].copy()
        today_date = datetime.now(KOLKATA_TZ).date()

        forecast_items: List[ForecastDay] = []
        for _, row in forecast_slice.iterrows():
            feat_dict = {col: float(row[col]) for col in model_service.feature_names}
            prob, risk_level, _ = model_service.predict_features(feat_dict)

            weather_date = pd.to_datetime(row["date"]).strftime("%Y-%m-%d")
            risk_for_dt = pd.to_datetime(row["date"]) + timedelta(days=1)
            risk_for_date = risk_for_dt.strftime("%Y-%m-%d")

            lead_days = max(0, (risk_for_dt.date() - today_date).days)
            reliability_note = LONG_LEAD_RELIABILITY_NOTE if lead_days > 2 else None
            is_expired = risk_for_dt.date() < today_date

            key_inputs = {
                "temp_max": round(float(row["temp_max"]), 1),
                "humidity_mean": round(float(row["humidity_mean"]), 1),
                "wind_speed_max": round(float(row["wind_speed_max"]), 1),
                "rain_sum": round(float(row["rain_sum"]), 1),
                "soil_moisture_mean": round(float(row["soil_moisture_mean"]), 3),
                "days_since_rain": int(row["days_since_rain"]),
                "vpd_proxy": round(float(row["vpd_proxy"]), 2),
            }

            forecast_items.append(
                ForecastDay(
                    weather_date=weather_date,
                    risk_for_date=risk_for_date,
                    lead_days=lead_days,
                    probability=prob,
                    risk_level=risk_level,
                    key_inputs=key_inputs,
                    reliability_note=reliability_note,
                    expired=is_expired,
                )
            )

        meta = DISTRICT_METADATA.get(district, {})
        return DistrictForecast(
            district=district,
            caveat=LOWLAND_CAVEAT_DISTRICTS.get(district),
            mixed_agricultural=(district in LOWLAND_CAVEAT_DISTRICTS),
            centroid=[float(meta.get("latitude", 30.0)), float(meta.get("longitude", 79.0))],
            elevation=float(meta.get("elevation", 1500.0)),
            forecast=forecast_items,
        )

    def load_static_forecast_cache(
        self, days: int = 7, cache_path: Optional[Path] = None
    ) -> ForecastResponse:
        """Load static forecast payload and calculate cache staleness and expired entry filtering."""
        target_path = cache_path or STATIC_FORECAST_CACHE
        if not target_path.exists():
            raise FileNotFoundError(
                f"Static forecast cache not found at {target_path}. "
                "Run 'python backend/export_static_forecast.py' to generate."
            )

        with open(target_path, "r", encoding="utf-8") as f:
            cached_payload = json.load(f)

        now_utc = datetime.now(timezone.utc)
        generated_at_str = cached_payload.get("generated_at", now_utc.isoformat())
        try:
            gen_dt = datetime.fromisoformat(generated_at_str.replace("Z", "+00:00"))
            cache_age_hours = round(max(0.0, (now_utc - gen_dt).total_seconds() / 3600.0), 2)
        except Exception:
            cache_age_hours = 0.0

        is_stale = cache_age_hours > 24.0
        today_date = datetime.now(KOLKATA_TZ).date()

        districts: List[DistrictForecast] = []
        any_expired = False

        for d in cached_payload.get("districts", []):
            valid_forecast_days: List[ForecastDay] = []
            for item in d.get("forecast", []):
                risk_date_str = item["risk_for_date"]
                try:
                    r_dt = datetime.strptime(risk_date_str, "%Y-%m-%d").date()
                except Exception:
                    r_dt = today_date

                # Drop or filter out expired past entries
                if r_dt < today_date:
                    any_expired = True
                    continue

                lead_days = max(0, (r_dt - today_date).days)
                reliability_note = LONG_LEAD_RELIABILITY_NOTE if lead_days > 2 else None

                valid_forecast_days.append(
                    ForecastDay(
                        weather_date=item["weather_date"],
                        risk_for_date=item["risk_for_date"],
                        lead_days=lead_days,
                        probability=item["probability"],
                        risk_level=item["risk_level"],
                        key_inputs=item["key_inputs"],
                        reliability_note=reliability_note,
                        expired=False,
                    )
                )

            # If all entries were in the past, retain flagged expired items so district isn't empty
            if not valid_forecast_days:
                any_expired = True
                for item in d.get("forecast", [])[:days]:
                    valid_forecast_days.append(
                        ForecastDay(
                            weather_date=item["weather_date"],
                            risk_for_date=item["risk_for_date"],
                            lead_days=0,
                            probability=item["probability"],
                            risk_level=item["risk_level"],
                            key_inputs=item["key_inputs"],
                            reliability_note="Expired past cache entry.",
                            expired=True,
                        )
                    )

            districts.append(
                DistrictForecast(
                    district=d["district"],
                    caveat=d.get("caveat"),
                    mixed_agricultural=d.get("mixed_agricultural", d["district"] in LOWLAND_CAVEAT_DISTRICTS),
                    centroid=d["centroid"],
                    elevation=d["elevation"],
                    forecast=valid_forecast_days[:days],
                )
            )

        if any_expired:
            is_stale = True

        return ForecastResponse(
            model=model_service.best_model_name,
            weather_source="cached",
            generated_at=generated_at_str,
            status="cached",
            cache_age_hours=cache_age_hours,
            static_cache_age_hours=cache_age_hours,
            stale=is_stale,
            days=days,
            count=len(districts),
            districts=districts,
        )

    def get_forecast(self, days: int = 7) -> ForecastResponse:
        """Generate forecast for all 13 districts with automatic fallback to static cache."""
        days = max(1, min(7, days))
        district_forecasts: List[DistrictForecast] = []
        any_failed = False

        for district in ALL_DISTRICTS:
            raw_data, source_type = self.fetch_district_forecast_weather(district, days=days)
            if raw_data is None:
                any_failed = True
                logger.warning(
                    f"Failed to fetch weather for {district} (status: {source_type}). Aborting remaining districts to fail fast."
                )
                break

            try:
                dist_fc = self.compute_district_daily_forecast(district, raw_data, days=days)
                district_forecasts.append(dist_fc)
            except Exception as e:
                logger.error(f"Error computing forecast for {district}: {e}", exc_info=True)
                any_failed = True
                break

        # Fall back to static cache if live fetch fails or is incomplete
        if any_failed or len(district_forecasts) < len(ALL_DISTRICTS):
            logger.warning("Live weather unavailable or incomplete. Falling back to static cache.")
            return self.load_static_forecast_cache(days=days)

        static_cache_age = self.get_static_cache_age_hours()
        return ForecastResponse(
            model=model_service.best_model_name,
            weather_source="forecast",
            generated_at=datetime.now(timezone.utc).isoformat(),
            status="live",
            cache_age_hours=0.0,
            static_cache_age_hours=static_cache_age,
            stale=False,
            days=days,
            count=len(district_forecasts),
            districts=district_forecasts,
        )


# Singleton instance
weather_service = WeatherService()
