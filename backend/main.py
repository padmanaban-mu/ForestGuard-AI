"""ForestGuard AI Production FastAPI Backend.

Provides:
- GET /health: Health status (ok | degraded | error), separate weather source and cache telemetry.
- GET /zones: 13 Uttarakhand districts with centroid, elevation, GeoJSON polygon, and lowland caveats.
- POST /predict: Single-district prediction with key_conditions (heuristic, not model attribution).
- GET /forecast: 1-7 day forecast with lead time, reliability notes, and date attribution (risk_for_date = weather_date + 1).
- GET /fires/recent: NASA FIRMS active fire detections proxy with transparent not_configured fallback.
- GET /model/metrics: Reconciled validation metrics (raw tau* vs calibrated tau=0.50), thresholds, and report URLs.
"""

import csv
from datetime import datetime, timezone
import io
import json
import logging
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import requests

from backend.config import (
    BBOX,
    CACHE_TTL_SECONDS,
    CORS_ORIGINS,
    FIRMS_MAP_KEY,
    LOWLAND_CAVEAT_DISTRICTS,
    METRICS_PATH,
    NASA_FIRMS_BASE_URL,
    REPORTS_DIR,
    STATIC_FORECAST_CACHE,
    ZONES_GEOJSON_PATH,
    ZONES_JSON_PATH,
)
from backend.model_service import model_service
from backend.schemas import (
    BaseEnvelope,
    FiresResponse,
    FireDetection,
    ForecastResponse,
    HealthResponse,
    ModelMetricsResponse,
    PredictRequest,
    PredictResponse,
    ZoneDetail,
    ZonesResponse,
)
from backend.weather_service import _forecast_memory_cache, weather_service

# Ensure ml directory is on sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
ML_DIR = ROOT_DIR / "ml"
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

from ml.features import DISTRICT_METADATA, build_feature_row

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("forestguard-api")

app = FastAPI(
    title="ForestGuard AI Backend",
    version="1.0.0",
    description="Machine Learning pre-ignition forest fire risk prediction API for Uttarakhand, India.",
)

# CORS Middleware with explicit origin restrictions
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file mount for ML evaluation reports ONLY (no directory listing)
if REPORTS_DIR.exists():
    app.mount(
        "/reports",
        StaticFiles(directory=str(REPORTS_DIR), html=False),
        name="reports",
    )


@app.get("/health", response_model=HealthResponse)
def get_health():
    """Health check endpoint exposing ok/degraded/error state, weather source, and cache status."""
    now_utc = datetime.now(timezone.utc)
    now_iso = now_utc.isoformat()

    # Determine static cache file age and staleness
    static_cache_age_hours: Optional[float] = None
    is_cache_stale = False
    static_available = STATIC_FORECAST_CACHE.exists()

    if static_available:
        try:
            with open(STATIC_FORECAST_CACHE, "r", encoding="utf-8") as f:
                cdata = json.load(f)
            gen_str = cdata.get("generated_at", now_iso)
            gen_dt = datetime.fromisoformat(gen_str.replace("Z", "+00:00"))
            static_cache_age_hours = round(max(0.0, (now_utc - gen_dt).total_seconds() / 3600.0), 2)
            if static_cache_age_hours > 24.0:
                is_cache_stale = True
        except Exception:
            is_cache_stale = True

    # Determine weather source and health status
    if not model_service.is_loaded:
        health_status = "error"
        weather_source = "none"
        served_cache_age = None
        served_stale = False
    elif len(_forecast_memory_cache) > 0:
        health_status = "ok"
        weather_source = "live"
        served_cache_age = 0.0
        served_stale = False
    else:
        weather_source = "cached"
        served_cache_age = static_cache_age_hours
        served_stale = is_cache_stale
        health_status = "degraded" if is_cache_stale else "ok"

    cache_state = {
        "in_memory_cached_entries": len(_forecast_memory_cache),
        "static_cache_available": static_available,
        "static_cache_age_hours": static_cache_age_hours,
        "cache_age_hours": served_cache_age,
        "stale": served_stale,
        "ttl_seconds": CACHE_TTL_SECONDS,
    }

    return HealthResponse(
        model=model_service.best_model_name,
        weather_source=weather_source,
        generated_at=now_iso,
        status=health_status,
        model_name=model_service.best_model_name,
        model_loaded=model_service.is_loaded,
        cache_age_hours=served_cache_age,
        static_cache_age_hours=static_cache_age_hours,
        stale=served_stale,
        cache_state=cache_state,
    )


@app.get("/zones", response_model=ZonesResponse)
def get_zones():
    """Return all 13 Uttarakhand administrative districts with authentic GADM boundaries and lowland caveats."""
    zones: List[ZoneDetail] = []

    # Priority 1: Load authentic GeoJSON boundaries
    if ZONES_GEOJSON_PATH.exists():
        try:
            with open(ZONES_GEOJSON_PATH, "r", encoding="utf-8") as f:
                geojson_data = json.load(f)

            for feat in geojson_data.get("features", []):
                props = feat.get("properties", {})
                name = props.get("name") or props.get("district", "Unknown")
                meta = DISTRICT_METADATA.get(name, {})

                centroid = props.get("centroid") or [meta.get("latitude", 30.0), meta.get("longitude", 79.0)]
                elevation = float(props.get("elevation", meta.get("elevation", 1500.0)))
                bbox = props.get("bbox") or [
                    centroid[1] - 0.3,
                    centroid[0] - 0.3,
                    centroid[1] + 0.3,
                    centroid[0] + 0.3,
                ]

                zones.append(
                    ZoneDetail(
                        name=name,
                        district=name,
                        centroid=[float(centroid[0]), float(centroid[1])],
                        elevation=elevation,
                        bbox=bbox,
                        caveat=LOWLAND_CAVEAT_DISTRICTS.get(name),
                        geometry=feat.get("geometry", {}),
                    )
                )
        except Exception as e:
            logger.error(f"Error parsing zones.geojson: {e}", exc_info=True)

    # Priority 2: Fallback to ml/zones.json if GeoJSON was unreadable
    if not zones and ZONES_JSON_PATH.exists():
        with open(ZONES_JSON_PATH, "r", encoding="utf-8") as f:
            zones_data = json.load(f)
        for item in zones_data:
            name = item["name"]
            meta = DISTRICT_METADATA.get(name, {})
            zones.append(
                ZoneDetail(
                    name=name,
                    district=name,
                    centroid=[float(item["latitude"]), float(item["longitude"])],
                    elevation=float(item.get("elevation", meta.get("elevation", 1500.0))),
                    bbox=item.get("bbox", [77.6, 28.7, 81.1, 31.5]),
                    caveat=LOWLAND_CAVEAT_DISTRICTS.get(name),
                    geometry={"type": "Point", "coordinates": [item["longitude"], item["latitude"]]},
                )
            )

    return ZonesResponse(
        model=model_service.best_model_name,
        weather_source="cached",
        generated_at=datetime.now(timezone.utc).isoformat(),
        status="live",
        count=len(zones),
        zones=zones,
    )


@app.post("/predict", response_model=PredictResponse)
def predict_risk(req: PredictRequest):
    """Predict next-day (day t+1) fire risk from either a 33-feature dict or raw weather history records.
    key_conditions provides physical and meteorological indicators (heuristic, not model attribution).
    """
    if not model_service.is_loaded:
        raise HTTPException(status_code=503, detail="Model is not loaded.")

    district = req.district or "Nainital"

    # Branch 1: Precomputed 33-feature dictionary supplied
    if req.features:
        feat_dict = req.features
        weather_source = "cached"
    # Branch 2: Raw weather records supplied -> construct features via build_feature_row
    elif req.today_record:
        history = req.history_records or []
        feat_dict = build_feature_row(
            history_records=history,
            today_record=req.today_record,
            district_name=district,
            climatology=weather_service.climatology,
        )
        weather_source = "forecast"
    else:
        raise HTTPException(
            status_code=400,
            detail="Request must provide either 'features' (dict) or 'today_record' (with optional 'history_records').",
        )

    prob, risk_level, key_conditions = model_service.predict_features(feat_dict)
    decision_threshold = 0.33  # Standard validation-tuned operating threshold (tau*)

    return PredictResponse(
        model=model_service.best_model_name,
        weather_source=weather_source,
        generated_at=datetime.now(timezone.utc).isoformat(),
        status="live",
        district=district,
        probability=prob,
        risk_level=risk_level,
        decision_threshold=decision_threshold,
        key_conditions=key_conditions,
        caveat=LOWLAND_CAVEAT_DISTRICTS.get(district),
    )


@app.get("/forecast", response_model=ForecastResponse)
def get_forecast(
    days: int = Query(default=7, ge=1, le=7, description="Number of forecast days (strictly 1 to 7)"),
):
    """Multi-district daily risk forecast for upcoming days (1-7 days).
    weather_date represents observation day (t); risk_for_date represents pre-ignition risk day (t+1).
    Lead times > 2 days carry reliability notes documenting higher forecast uncertainty.
    """
    return weather_service.get_forecast(days=days)


@app.get("/fires/recent", response_model=FiresResponse)
def get_recent_fires(
    hours: int = Query(default=72, ge=1, le=168, description="Time window in hours (1-168)"),
):
    """Proxy active fires from NASA FIRMS.
    If FIRMS_MAP_KEY is missing, returns an honest empty list with status 'not_configured'.
    """
    now_iso = datetime.now(timezone.utc).isoformat()

    # Rule: If key is missing, return empty list with status 'not_configured' (never invent data)
    if not FIRMS_MAP_KEY:
        return FiresResponse(
            model=model_service.best_model_name,
            weather_source="cached",
            generated_at=now_iso,
            status="not_configured",
            hours=hours,
            count=0,
            bbox=BBOX,
            fires=[],
        )

    query_days = max(1, min(10, int((hours + 23) // 24)))
    bbox_str = f"{BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]}"
    url = f"{NASA_FIRMS_BASE_URL}/{FIRMS_MAP_KEY}/VIIRS_SNPP_NRT/{bbox_str}/{query_days}"

    try:
        resp = requests.get(url, timeout=20)
        if resp.status_code != 200:
            logger.warning(f"NASA FIRMS API returned HTTP {resp.status_code}: {resp.text}")
            return FiresResponse(
                model=model_service.best_model_name,
                weather_source="cached",
                generated_at=now_iso,
                status="error",
                hours=hours,
                count=0,
                bbox=BBOX,
                fires=[],
            )

        fires: List[FireDetection] = []
        reader = csv.DictReader(io.StringIO(resp.text))
        for row in reader:
            try:
                lat = float(row.get("latitude", 0.0))
                lon = float(row.get("longitude", 0.0))
                bright_val = float(row["brightness"]) if row.get("brightness") else (float(row["bright_ti4"]) if row.get("bright_ti4") else None)
                bright_ti4_val = float(row["bright_ti4"]) if row.get("bright_ti4") else bright_val
                fires.append(
                    FireDetection(
                        latitude=lat,
                        longitude=lon,
                        brightness=bright_val,
                        scan=float(row["scan"]) if row.get("scan") else None,
                        track=float(row["track"]) if row.get("track") else None,
                        acq_date=row.get("acq_date", ""),
                        acq_time=row.get("acq_time", ""),
                        satellite=row.get("satellite"),
                        confidence=row.get("confidence"),
                        version=row.get("version"),
                        bright_t31=float(row["bright_t31"]) if row.get("bright_t31") else None,
                        bright_ti4=bright_ti4_val,
                        frp=float(row["frp"]) if row.get("frp") else None,
                        daynight=row.get("daynight"),
                    )
                )
            except Exception:
                continue

        return FiresResponse(
            model=model_service.best_model_name,
            weather_source="cached",
            generated_at=now_iso,
            status="live",
            hours=hours,
            count=len(fires),
            bbox=BBOX,
            fires=fires,
        )
    except Exception as e:
        logger.error(f"Error querying NASA FIRMS API: {e}", exc_info=True)
        return FiresResponse(
            model=model_service.best_model_name,
            weather_source="cached",
            generated_at=now_iso,
            status="error",
            hours=hours,
            count=0,
            bbox=BBOX,
            fires=[],
        )


@app.get("/model/metrics", response_model=ModelMetricsResponse)
def get_model_metrics():
    """Retrieve served model metadata, selection criterion, validation metrics, and report figures.
    Reconciles raw base model validation metrics (tau*=0.47) and calibrated served metrics (tau=0.50).
    Returns relative paths for report figures.
    """
    # Load metrics.json if present
    metrics_summary: Dict[str, Any] = {}
    if METRICS_PATH.exists():
        try:
            with open(METRICS_PATH, "r", encoding="utf-8") as f:
                metrics_summary = json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load metrics.json: {e}")

    # Relative paths for all report figures in REPORTS_DIR
    report_urls = {
        rf.stem: f"/reports/{rf.name}"
        for rf in sorted(REPORTS_DIR.glob("*.png"))
    }

    # Reconciled validation metrics structure
    reconciled_validation_metrics = {
        "raw_model_val_at_optimal_tau": {
            "model_type": "HistGradientBoostingClassifier (Raw Uncalibrated)",
            "decision_threshold_tau": 0.47,
            "f1_score": 0.6496,
            "precision": 0.564,
            "recall": 0.766,
            "pr_auc": 0.6436,
            "roc_auc": 0.8524,
            "note": "Documented in model_selection.md Table 2 (threshold tuned strictly on 2023 validation set).",
        },
        "calibrated_model_val_at_tau_0_50": {
            "model_type": "CalibratedClassifierCV(HistGradientBoostingClassifier, method='sigmoid')",
            "decision_threshold_tau": 0.50,
            "f1_score": round(float(model_service.validation_metrics.get("f1", 0.6417)), 4),
            "precision": round(float(model_service.validation_metrics.get("precision", 0.5741)), 4),
            "recall": round(float(model_service.validation_metrics.get("recall", 0.7275)), 4),
            "pr_auc": round(float(model_service.validation_metrics.get("pr_auc", 0.6436)), 4),
            "roc_auc": round(float(model_service.validation_metrics.get("roc_auc", 0.8524)), 4),
            "note": "Serialized in risk_model.joblib bundle (evaluated on calibrated probabilities at tau=0.50).",
        },
    }

    return ModelMetricsResponse(
        model=model_service.best_model_name,
        weather_source="cached",
        generated_at=datetime.now(timezone.utc).isoformat(),
        status="live",
        model_name=model_service.best_model_name,
        architecture="CalibratedClassifierCV(HistGradientBoostingClassifier, method='sigmoid')",
        selection_criterion=model_service.selection_criterion,
        validation_metrics=reconciled_validation_metrics,
        risk_thresholds=model_service.risk_thresholds,
        metrics_summary=metrics_summary,
        report_urls=report_urls,
    )
