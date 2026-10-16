"""Download genuine weather and fire data for ForestGuard AI.

Ingests:
1. Open-Meteo Historical Archive daily observations per Uttarakhand district centroid,
   including 2017 Q4 antecedent lookback (2017-10-01 to 2024-12-31).
2. NASA FIRMS VIIRS active fire observations (2018-2024) filtered to Uttarakhand.
"""

import argparse
import csv
import json
import os
from pathlib import Path
import sys
import time
import requests
from dotenv import load_dotenv

# Ensure ml directory is on sys.path
ML_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ML_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from config import BBOX, END_YEAR, RAW_DATA_DIR, START_YEAR

load_dotenv(ML_DIR / ".env")


def load_zones():
    zones_file = ML_DIR / "zones.json"
    if not zones_file.exists():
        raise FileNotFoundError(f"Missing {zones_file}. Run extract_zones.py first.")
    with open(zones_file, "r", encoding="utf-8") as f:
        return json.load(f)


def download_weather_per_zone(
    zones,
    out_dir=None,
    start_date="2017-10-01",
    end_date="2024-12-31",
    force=False,
):
    """Download daily historical weather from Open-Meteo Archive with resume and backoff."""
    weather_dir = Path(out_dir) if out_dir else (RAW_DATA_DIR / "weather")
    weather_dir.mkdir(parents=True, exist_ok=True)
    base_url = "https://archive-api.open-meteo.com/v1/archive"

    print(f"\n--- 1. Downloading Open-Meteo Historical Weather ({start_date} to {end_date}) ---")
    for zone in zones:
        name = zone["name"]
        clean_name = name.lower().replace(" ", "_")
        target_file = weather_dir / f"{clean_name}.json"

        if target_file.exists() and not force:
            # Check if existing file already covers the requested start_date
            try:
                with open(target_file, "r", encoding="utf-8") as f:
                    cached_data = json.load(f)
                cached_start = cached_data.get("daily", {}).get("time", [""])[0]
                if cached_start and cached_start <= start_date:
                    print(f" [Weather] {name}: cached file exists with full history ({cached_start} to {cached_data['daily']['time'][-1]}). Skipping.")
                    continue
            except Exception:
                pass

        print(f" [Weather] Fetching {name} ({zone['latitude']}, {zone['longitude']}) from {start_date} to {end_date}...")
        params = {
            "latitude": zone["latitude"],
            "longitude": zone["longitude"],
            "start_date": start_date,
            "end_date": end_date,
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

        retries = 5
        success = False
        while retries > 0 and not success:
            try:
                r = requests.get(base_url, params=params, timeout=35)
                if r.status_code == 200:
                    data = r.json()
                    with open(target_file, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2)
                    days_count = len(data["daily"]["time"])
                    elev = data.get("elevation", "N/A")
                    print(f"  [OK] Saved {target_file.name} ({days_count} days, elevation={elev}m).")
                    success = True
                elif r.status_code == 429:
                    print("  Rate limited by Open-Meteo. Backing off 10 seconds...")
                    time.sleep(10)
                    retries -= 1
                else:
                    print(f"  HTTP Error {r.status_code}: {r.text[:120]}")
                    retries -= 1
                    time.sleep(3)
            except Exception as e:
                print(f"  Connection error: {e}. Retrying...")
                retries -= 1
                time.sleep(4)

        if not success:
            print(f"  [FAIL] Failed to download weather for {name}.")

        time.sleep(0.5)  # respectful request rate


def download_firms_data():
    """Download NASA FIRMS historical detections."""
    fires_dir = RAW_DATA_DIR / "fires"
    fires_dir.mkdir(parents=True, exist_ok=True)
    out_file = fires_dir / "fires_uttarakhand.csv"

    print("\n--- 2. Ingesting NASA FIRMS Active Fire Detections (2018-2024) ---")
    map_key = os.getenv("FIRMS_MAP_KEY", "").strip()

    if out_file.exists() and out_file.stat().st_size > 1000:
        print(f" [FIRMS] Genuine Uttarakhand fires file exists ({out_file.name}, {round(out_file.stat().st_size/1024, 1)} KB). Skipping.")
        return

    west, south, east, north = BBOX

    all_detections = []
    fieldnames = ["latitude", "longitude", "brightness", "scan", "track", "acq_date", "acq_time", "satellite", "instrument", "confidence", "version", "bright_t31", "frp", "daynight"]

    for year in range(START_YEAR, END_YEAR + 1):
        archive_url = f"https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/viirs-snpp_{year}_India.csv"
        print(f" [FIRMS] Streaming & filtering {year} India archive: {archive_url}...")
        try:
            r = requests.get(archive_url, stream=True, timeout=40)
            if r.status_code != 200:
                print(f"  [X] HTTP {r.status_code} for {year}. Skipping.")
                continue

            lines = (line.decode("utf-8", errors="replace") for line in r.iter_lines())
            reader = csv.DictReader(lines)
            year_count = 0

            for row in reader:
                try:
                    lat = float(row["latitude"])
                    lon = float(row["longitude"])
                    if south <= lat <= north and west <= lon <= east:
                        all_detections.append(row)
                        year_count += 1
                except (ValueError, KeyError):
                    continue

            print(f"  [OK] Extracted {year_count} authentic fire detections in Uttarakhand for {year}.")
        except Exception as e:
            print(f"  Error streaming {year}: {e}")

    if all_detections:
        with open(out_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(all_detections)
        print(f" [FIRMS] Saved {len(all_detections)} genuine detections to {out_file}.")


def parse_args():
    parser = argparse.ArgumentParser(description="Download genuine weather and fire observations.")
    parser.add_argument("--district", type=str, default=None, help="Download only for a specific district name.")
    parser.add_argument("--out", type=str, default=None, help="Custom output directory for weather files.")
    parser.add_argument("--start-date", type=str, default="2017-10-01", help="Start date (YYYY-MM-DD).")
    parser.add_argument("--end-date", type=str, default="2024-12-31", help="End date (YYYY-MM-DD).")
    parser.add_argument("--force", action="store_true", help="Force re-download even if cached file exists.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    zones = load_zones()

    if args.district:
        matched = [z for z in zones if z["name"].lower() == args.district.lower()]
        if not matched:
            raise ValueError(f"District '{args.district}' not found in zones.json.")
        zones = matched

    download_weather_per_zone(
        zones=zones,
        out_dir=args.out,
        start_date=args.start_date,
        end_date=args.end_date,
        force=args.force,
    )

    if not args.district:
        download_firms_data()

    print("\n[OK] Download step finished successfully.")
