"""Shared feature-building functions for training and FastAPI serving.

This module is the single source of truth for feature engineering in ForestGuard AI.
It ensures 100% train-serving parity with zero leakage.

Includes:
1. Dynamic weather and antecedent dryness features (temperature, humidity, rain deficit, VPD, ET0).
2. Soil moisture (daily mean volumetric soil moisture in m³/m³ from Open-Meteo).
3. Static location features (centroid latitude, longitude, elevation, and one-hot district indicators).
4. Climatology anomaly features (temperature, humidity, 30-day rain anomalies vs training-years district-month baseline).
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

ML_DIR = Path(__file__).resolve().parent

ALL_DISTRICTS = [
    "Almora",
    "Bageshwar",
    "Chamoli",
    "Champawat",
    "Dehradun",
    "Haridwar",
    "Nainital",
    "Pauri Garhwal",
    "Pithoragarh",
    "Rudraprayag",
    "Tehri Garhwal",
    "Udham Singh Nagar",
    "Uttarkashi",
]

DISTRICT_METADATA = {
    "Almora": {"latitude": 29.6952, "longitude": 79.4890, "elevation": 1489.0},
    "Bageshwar": {"latitude": 29.9970, "longitude": 79.8460, "elevation": 2448.0},
    "Chamoli": {"latitude": 30.4985, "longitude": 79.5583, "elevation": 3016.0},
    "Champawat": {"latitude": 29.3031, "longitude": 80.0617, "elevation": 1449.0},
    "Dehradun": {"latitude": 30.4686, "longitude": 77.9598, "elevation": 2040.0},
    "Haridwar": {"latitude": 29.8773, "longitude": 77.9887, "elevation": 256.0},
    "Nainital": {"latitude": 29.3168, "longitude": 79.4550, "elevation": 1271.0},
    "Pauri Garhwal": {"latitude": 29.8987, "longitude": 78.7567, "elevation": 909.0},
    "Pithoragarh": {"latitude": 30.1119, "longitude": 80.3336, "elevation": 2322.0},
    "Rudraprayag": {"latitude": 30.5948, "longitude": 79.0985, "elevation": 2262.0},
    "Tehri Garhwal": {"latitude": 30.4429, "longitude": 78.5698, "elevation": 1368.0},
    "Udham Singh Nagar": {"latitude": 29.0430, "longitude": 79.4992, "elevation": 246.0},
    "Uttarkashi": {"latitude": 30.9782, "longitude": 78.5892, "elevation": 5023.0},
}

DISTRICT_FEATURE_NAMES = [f"dist_{d.lower().replace(' ', '_')}" for d in ALL_DISTRICTS]

STATIC_LOCATION_FEATURES = [
    "latitude",
    "longitude",
    "elevation",
] + DISTRICT_FEATURE_NAMES

WEATHER_FEATURE_NAMES = [
    "temp_max",
    "humidity_mean",
    "wind_speed_max",
    "rain_sum",
    "et0",
    "soil_moisture_mean",
    "rain_3d",
    "rain_7d",
    "rain_30d",
    "days_since_rain",
    "temp_mean_7d",
    "humidity_mean_7d",
    "month",
    "vpd_proxy",
]

ANOMALY_FEATURE_NAMES = [
    "temp_anomaly",
    "humidity_anomaly",
    "rain_30d_anomaly",
]

# Canonical 34-feature list in strict order
FEATURE_NAMES = WEATHER_FEATURE_NAMES + STATIC_LOCATION_FEATURES + ANOMALY_FEATURE_NAMES

# Legacy weather-only subset (for ablation comparison)
WEATHER_ONLY_FEATURE_NAMES = [f for f in WEATHER_FEATURE_NAMES if f != "soil_moisture_mean"]


def calculate_vpd_proxy(temp_c: float, rh_pct: float) -> float:
    """Calculate Vapor Pressure Deficit (VPD) in kPa as an atmospheric dryness proxy."""
    if temp_c is None or rh_pct is None:
        return 1.0
    es = 0.61078 * np.exp((17.27 * temp_c) / (temp_c + 237.3))
    ea = es * (max(0.0, min(100.0, rh_pct)) / 100.0)
    return round(float(max(0.0, es - ea)), 3)


def load_climatology_table(climatology_path: Optional[Path] = None) -> Dict[str, Any]:
    """Load precomputed training-years climatology dictionary."""
    if climatology_path is None:
        climatology_path = ML_DIR / "data" / "processed" / "climatology_district_month.json"
    if climatology_path.exists():
        try:
            with open(climatology_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def compute_features_for_timeseries(
    df: pd.DataFrame,
    district_name: Optional[str] = None,
    climatology: Optional[Dict[str, Any]] = None,
) -> pd.DataFrame:
    """Compute all rolling, static location, and anomaly features for a daily DataFrame."""
    out = df.copy()
    out["date"] = pd.to_datetime(out["date"])
    out = out.sort_values("date").reset_index(drop=True)

    # 1. Base weather cleaning
    out["temp_max"] = out["temp_max"].ffill().bfill()
    out["humidity_mean"] = out["humidity_mean"].ffill().bfill().clip(0, 100)
    out["wind_speed_max"] = out["wind_speed_max"].ffill().bfill().clip(lower=0)
    out["rain_sum"] = out["rain_sum"].fillna(0.0).clip(lower=0)

    if "et0" not in out.columns or out["et0"].isna().all():
        out["et0"] = (out["temp_max"] * 0.1).clip(lower=0)
    else:
        out["et0"] = out["et0"].ffill().bfill().clip(lower=0)

    # Daily soil moisture (Open-Meteo volumetric m³/m³)
    if "soil_moisture_mean" not in out.columns or out["soil_moisture_mean"].isna().all():
        out["soil_moisture_mean"] = 0.20  # Typical regional baseline default
    else:
        out["soil_moisture_mean"] = out["soil_moisture_mean"].ffill().bfill().clip(0.0, 1.0)

    # 2. Rolling rainfall sums
    out["rain_3d"] = out["rain_sum"].rolling(window=3, min_periods=1).sum().round(2)
    out["rain_7d"] = out["rain_sum"].rolling(window=7, min_periods=1).sum().round(2)
    out["rain_30d"] = out["rain_sum"].rolling(window=30, min_periods=1).sum().round(2)

    # 3. Days since significant rainfall (> 1.0 mm)
    rain_mask = out["rain_sum"] > 1.0
    days_since = []
    current_count = 0  # starts at 0 on 2017-10-01 (accumulates over 92-day lookback buffer)
    for has_rain in rain_mask:
        if has_rain:
            current_count = 0
        else:
            current_count = min(90, current_count + 1)
        days_since.append(current_count)
    out["days_since_rain"] = days_since

    # 4. 7-day rolling means
    out["temp_mean_7d"] = out["temp_max"].rolling(window=7, min_periods=1).mean().round(2)
    out["humidity_mean_7d"] = out["humidity_mean"].rolling(window=7, min_periods=1).mean().round(2)

    # 5. Month of the year
    out["month"] = out["date"].dt.month

    # 6. Vapor Pressure Deficit proxy
    out["vpd_proxy"] = [
        calculate_vpd_proxy(t, h)
        for t, h in zip(out["temp_max"], out["humidity_mean"])
    ]

    # 7. Static Location Features
    meta = DISTRICT_METADATA.get(district_name, {})
    out["latitude"] = float(meta.get("latitude", 30.0))
    out["longitude"] = float(meta.get("longitude", 79.0))
    out["elevation"] = float(meta.get("elevation", 1500.0))

    # One-hot district indicators
    for d in ALL_DISTRICTS:
        col_name = f"dist_{d.lower().replace(' ', '_')}"
        out[col_name] = 1.0 if d == district_name else 0.0

    # 8. Climatology Anomaly Features
    if climatology and district_name in climatology:
        dist_clim = climatology[district_name]
        temp_anoms, rh_anoms, r30_anoms = [], [], []
        for m, t_val, rh_val, r30_val in zip(out["month"], out["temp_max"], out["humidity_mean"], out["rain_30d"]):
            m_key = str(int(m))
            c_entry = dist_clim.get(m_key, {})
            t_ref = c_entry.get("temp_max_mean", t_val)
            rh_ref = c_entry.get("humidity_mean_mean", rh_val)
            r30_ref = c_entry.get("rain_30d_mean", r30_val)
            temp_anoms.append(round(float(t_val - t_ref), 2))
            rh_anoms.append(round(float(rh_val - rh_ref), 2))
            r30_anoms.append(round(float(r30_val - r30_ref), 2))
        out["temp_anomaly"] = temp_anoms
        out["humidity_anomaly"] = rh_anoms
        out["rain_30d_anomaly"] = r30_anoms
    else:
        out["temp_anomaly"] = 0.0
        out["humidity_anomaly"] = 0.0
        out["rain_30d_anomaly"] = 0.0

    return out


def build_feature_row(
    history_records: List[Dict[str, Any]],
    today_record: Dict[str, Any],
    district_name: Optional[str] = None,
    climatology: Optional[Dict[str, Any]] = None,
) -> Dict[str, float]:
    """Construct a single feature dictionary for real-time inference in FastAPI serving."""
    if district_name is None:
        district_name = today_record.get("district", "Nainital")
    if climatology is None:
        climatology = load_climatology_table()

    records = list(history_records) + [today_record]
    df = pd.DataFrame(records)
    feat_df = compute_features_for_timeseries(df, district_name=district_name, climatology=climatology)
    last_row = feat_df.iloc[-1]

    feature_dict = {}
    for col in FEATURE_NAMES:
        feature_dict[col] = float(last_row[col])

    return feature_dict
