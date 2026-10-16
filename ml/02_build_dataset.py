"""Build supervised ML dataset for pre-ignition forest fire risk prediction.

Aligns daily weather and environmental features for each Uttarakhand district with genuine
NASA FIRMS active fire detections on the NEXT day (t + 1).

Label definitions:
  target_fire_next_day:
    1 if >= 1 nominal/high confidence FIRMS detection occurs inside district on day t+1
    0 otherwise
  target_fire_next_day_ge3 (Label Sensitivity Analysis):
    1 if >= 3 nominal/high confidence FIRMS detections occur on day t+1
    0 otherwise

Features are computed strictly using observations up to and including day t.
Climatology anomalies are computed using mean baselines from TRAINING years (2018-2022) only.
Zero future information is present in the feature columns (zero data leakage).
"""

from collections import defaultdict
import csv
from datetime import datetime, timedelta
import json
from pathlib import Path
import sys
import numpy as np
import pandas as pd
from shapely.geometry import Point, shape
from shapely.prepared import prep

# Ensure ml directory is on sys.path
ML_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ML_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from config import PROCESSED_DATA_DIR, RAW_DATA_DIR, START_YEAR, TRAIN_YEARS
from features import (
    FEATURE_NAMES,
    compute_features_for_timeseries,
)


def load_district_geometries():
    """Load district polygons from zones.geojson and prepare for spatial queries."""
    geojson_path = ML_DIR.parent / "frontend" / "public" / "data" / "zones.geojson"
    with open(geojson_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    districts = {}
    for feat in data["features"]:
        name = feat["properties"]["name"]
        geom = shape(feat["geometry"])
        districts[name] = {
            "geom": geom,
            "prepared": prep(geom),
            "bbox": feat["properties"]["bbox"],
        }
    return districts


def map_fires_to_districts(districts):
    """Map FIRMS detections to districts and group by (district, acq_date)."""
    fires_path = RAW_DATA_DIR / "fires" / "fires_uttarakhand.csv"
    if not fires_path.exists():
        raise FileNotFoundError(f"Missing {fires_path}. Run 01_download_data.py first.")

    print("Mapping active fire detections to authentic district boundaries...")
    district_date_fires = defaultdict(int)
    total_processed = 0
    matched_fires = 0

    with open(fires_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_processed += 1
            # Confidence filter: nominal ('n') or high ('h'), or numeric >= 50
            conf = str(row.get("confidence", "")).strip().lower()
            if conf.isdigit():
                if int(conf) < 50:
                    continue
            elif conf in ["l", "low"]:
                continue

            try:
                lat = float(row["latitude"])
                lon = float(row["longitude"])
                acq_date = row["acq_date"].strip()
                pt = Point(lon, lat)

                for name, dinfo in districts.items():
                    bbox = dinfo["bbox"]  # minx, miny, maxx, maxy
                    if bbox[0] <= lon <= bbox[2] and bbox[1] <= lat <= bbox[3]:
                        if dinfo["prepared"].contains(pt):
                            district_date_fires[(name, acq_date)] += 1
                            matched_fires += 1
                            break
            except (ValueError, KeyError):
                continue

    print(f"Mapped {matched_fires} confident detections (out of {total_processed} candidates) into districts.")
    return district_date_fires


def compute_training_climatology(raw_dfs: dict) -> dict:
    """Compute district-month baseline means strictly from TRAINING years (2018-2022)."""
    print("\nComputing training-years baseline climatology (2018-2022)...")
    climatology = {}

    for district, df in raw_dfs.items():
        df_train = df[df["date"].dt.year.isin(TRAIN_YEARS)].copy()
        df_train["month"] = df_train["date"].dt.month
        climatology[district] = {}

        for m, grp in df_train.groupby("month"):
            m_key = str(int(m))
            climatology[district][m_key] = {
                "temp_max_mean": round(float(grp["temp_max"].mean()), 2),
                "humidity_mean_mean": round(float(grp["humidity_mean"].mean()), 2),
                "rain_30d_mean": round(float(grp["rain_30d"].mean()), 2),
            }

    clim_path = PROCESSED_DATA_DIR / "climatology_district_month.json"
    with open(clim_path, "w", encoding="utf-8") as f:
        json.dump(climatology, f, indent=2)
    print(f"[OK] Saved training climatology table to {clim_path}")
    return climatology


def build_dataset():
    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
    districts = load_district_geometries()
    district_date_fires = map_fires_to_districts(districts)

    zones_file = ML_DIR / "zones.json"
    with open(zones_file, "r", encoding="utf-8") as f:
        zones = json.load(f)

    # 1. First pass: load raw weather time series and compute base rolling features
    raw_dfs = {}
    print("\nLoading raw weather and soil moisture for all 13 districts...")
    for zone in zones:
        name = zone["name"]
        clean_name = name.lower().replace(" ", "_")
        weather_file = RAW_DATA_DIR / "weather" / f"{clean_name}.json"

        if not weather_file.exists():
            print(f" [Warning] Missing weather for {name}. Skipping.")
            continue

        with open(weather_file, "r", encoding="utf-8") as f:
            wdata = json.load(f)

        daily = wdata.get("daily", {})
        sm_list = daily.get("soil_moisture_0_to_7cm_mean", [0.20] * len(daily["time"]))

        df_weather = pd.DataFrame({
            "date": daily["time"],
            "temp_max": daily["temperature_2m_max"],
            "humidity_mean": daily["relative_humidity_2m_mean"],
            "wind_speed_max": daily["wind_speed_10m_max"],
            "rain_sum": daily["precipitation_sum"],
            "et0": daily.get("et0_fao_evapotranspiration", [0.0] * len(daily["time"])),
            "soil_moisture_mean": sm_list,
        })
        base_df = compute_features_for_timeseries(df_weather, district_name=name)
        raw_dfs[name] = base_df

    # 2. Compute training-only climatology baseline
    climatology = compute_training_climatology(raw_dfs)

    # 3. Second pass: compute anomalies and target labels
    all_rows = []
    print("\nComputing anomaly features and aligning with day t + 1 fire occurrences...")
    for zone in zones:
        name = zone["name"]
        if name not in raw_dfs:
            continue

        base_df = raw_dfs[name]
        feat_df = compute_features_for_timeseries(base_df, district_name=name, climatology=climatology)

        # Build forward labels (day t + 1)
        labels = []
        labels_ge3 = []
        fire_counts = []
        dates_list = feat_df["date"].tolist()

        for dt in dates_list:
            next_date_str = (dt + timedelta(days=1)).strftime("%Y-%m-%d")
            f_count = district_date_fires.get((name, next_date_str), 0)
            labels.append(1 if f_count > 0 else 0)
            labels_ge3.append(1 if f_count >= 3 else 0)
            fire_counts.append(f_count)

        feat_df["district"] = name
        feat_df["target_fire_next_day"] = labels
        feat_df["target_fire_next_day_ge3"] = labels_ge3
        feat_df["fire_count_next_day"] = fire_counts

        # Drop the last day (day t+1 has no future observation)
        feat_df = feat_df.iloc[:-1]
        all_rows.append(feat_df)
        print(f"  [OK] {name}: {len(feat_df)} district-days (>=1 fire: {sum(labels)}, >=3 fires: {sum(labels_ge3)}).")

    full_dataset = pd.concat(all_rows, ignore_index=True)
    full_dataset = full_dataset[full_dataset["date"].dt.year >= START_YEAR].copy().reset_index(drop=True)
    full_dataset["date"] = full_dataset["date"].dt.strftime("%Y-%m-%d")

    # Column ordering
    cols = [
        "district",
        "date",
        "target_fire_next_day",
        "target_fire_next_day_ge3",
        "fire_count_next_day",
    ] + FEATURE_NAMES
    full_dataset = full_dataset[cols]

    out_csv = PROCESSED_DATA_DIR / "dataset.csv"
    full_dataset.to_csv(out_csv, index=False)
    print(f"\n[OK] Full dataset saved to {out_csv}")
    print(f"     Total rows: {len(full_dataset)}")
    pos_count = int(full_dataset["target_fire_next_day"].sum())
    pos_ge3_count = int(full_dataset["target_fire_next_day_ge3"].sum())
    neg_count = len(full_dataset) - pos_count
    print(f"     Target >=1 fire: {pos_count} days ({pos_count/len(full_dataset)*100:.2f}%)")
    print(f"     Target >=3 fires: {pos_ge3_count} days ({pos_ge3_count/len(full_dataset)*100:.2f}%)")

    # Save a trimmed sample for lightweight inspection
    sample_csv = PROCESSED_DATA_DIR / "dataset_sample.csv"
    full_dataset.head(1000).to_csv(sample_csv, index=False)
    print(f"[OK] Sample dataset saved to {sample_csv}")


if __name__ == "__main__":
    build_dataset()
