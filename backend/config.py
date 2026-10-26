"""Configuration settings for ForestGuard AI FastAPI Backend."""

import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Resolve project paths
BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
ML_DIR = ROOT_DIR / "ml"

# Load backend/.env if present
ENV_PATH = BACKEND_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)

# CORS Origins
raw_cors = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://localhost:4173,http://127.0.0.1:3000",
)
CORS_ORIGINS: List[str] = [origin.strip() for origin in raw_cors.split(",") if origin.strip()]

# API Credentials
FIRMS_MAP_KEY: str = os.getenv("FIRMS_MAP_KEY", "").strip()

# Model and Data Paths
MODEL_PATH: Path = ML_DIR / "models" / "risk_model.joblib"
CLIMATOLOGY_PATH: Path = ML_DIR / "data" / "processed" / "climatology_district_month.json"
METRICS_PATH: Path = ML_DIR / "reports" / "metrics.json"
REPORTS_DIR: Path = ML_DIR / "reports"

# GeoJSON boundaries (authentic Census/GADM boundaries)
ZONES_GEOJSON_PATH: Path = ROOT_DIR / "frontend" / "public" / "data" / "zones.geojson"
ZONES_JSON_PATH: Path = ML_DIR / "zones.json"

# Cache paths
CACHE_DIR: Path = BACKEND_DIR / "cache"
STATIC_FORECAST_CACHE: Path = CACHE_DIR / "forecast_latest.json"

# In-memory cache TTL: 30 minutes (1800 seconds)
CACHE_TTL_SECONDS: int = 1800

# Open-Meteo external request parpyameters
WEATHER_CONNECT_TIMEOUT: float = 5.0
WEATHER_READ_TIMEOUT: float = 15.0
WEATHER_CONCURRENCY: int = 6  # unverified, conservative concurrency of 6
WEATHER_MAX_RETRIES: int = 1  # retry only failed districts once
WEATHER_LIVE_RECOVERY_SECONDS: float = 3600.0
OPEN_METEO_FORECAST_URL: str = "https://api.open-meteo.com/v1/forecast"

# NASA FIRMS external request parameters
FIRMS_CONNECT_TIMEOUT: float = 5.0
FIRMS_READ_TIMEOUT: float = 10.0
FIRMS_FAILURE_CACHE_SECONDS: int = 300  # 5 minutes
NASA_FIRMS_BASE_URL: str = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

# Region settings
REGION_NAME: str = "Uttarakhand, India"
BBOX: List[float] = [77.6, 28.7, 81.1, 31.5]

# Agricultural lowland districts with caveat
LOWLAND_CAVEAT_DISTRICTS = {
    "Haridwar": "Mixed agricultural lowlands with seasonal post-harvest crop residue burning; thermal detections lack a forest canopy mask.",
    "Udham Singh Nagar": "Mixed agricultural lowlands with seasonal post-harvest crop residue burning; thermal detections lack a forest canopy mask.",
}
