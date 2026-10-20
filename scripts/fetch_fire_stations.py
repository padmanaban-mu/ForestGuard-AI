#!/usr/bin/env python3
"""scripts/fetch_fire_stations.py

Downloads real OpenStreetMap fire stations (amenity=fire_station) inside the
Uttarakhand bounding box (W, S, E, N = 77.6, 28.7, 81.1, 31.5) from public
Overpass API mirrors and saves them to frontend/public/data/fire_stations.geojson.

Strict Data Honesty Rule:
If Overpass returns nothing or fails, leaves fire_stations.geojson as an empty
FeatureCollection. Does NOT create or synthesize station records by hand.
"""

from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import urllib.parse
import urllib.request

# Project paths
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
OUTPUT_FILE = ROOT_DIR / "frontend" / "public" / "data" / "fire_stations.geojson"

# Bounding box: [west, south, east, north]
BBOX_W, BBOX_S, BBOX_E, BBOX_N = 77.6, 28.7, 81.1, 31.5
OVERPASS_BBOX = f"{BBOX_S},{BBOX_W},{BBOX_N},{BBOX_E}"

QUERY = (
    f"[out:json][timeout:25];"
    f"("
    f'node["amenity"="fire_station"]({OVERPASS_BBOX});'
    f'way["amenity"="fire_station"]({OVERPASS_BBOX});'
    f'relation["amenity"="fire_station"]({OVERPASS_BBOX});'
    f");"
    f"out center tags;"
)

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def elements_to_features(elements: list[dict]) -> list[dict]:
    features = []
    for item in elements:
        tags = item.get("tags") or {}
        lat = item.get("lat") if item.get("lat") is not None else item.get("center", {}).get("lat")
        lon = item.get("lon") if item.get("lon") is not None else item.get("center", {}).get("lon")
        if lat is None or lon is None:
            continue
        try:
            lat_f = float(lat)
            lon_f = float(lon)
        except (ValueError, TypeError):
            continue

        address_parts = [tags.get("addr:street"), tags.get("addr:city")]
        address = ", ".join([p for p in address_parts if p]) or None

        features.append({
            "type": "Feature",
            "id": f"osm-{item.get('type')}-{item.get('id')}",
            "geometry": {
                "type": "Point",
                "coordinates": [lon_f, lat_f]
            },
            "properties": {
                "osmType": item.get("type"),
                "osmId": item.get("id"),
                "name": tags.get("name") or "Unnamed OSM fire station",
                "type": "station",
                "amenity": "fire_station",
                "district": tags.get("addr:district") or tags.get("is_in:district"),
                "phone": tags.get("phone") or tags.get("contact:phone"),
                "operator": tags.get("operator"),
                "address": address
            }
        })
    return features


def fetch_from_overpass() -> tuple[list[dict], list[dict]]:
    """Attempts to fetch from configured Overpass mirrors.

    Returns (features, log_attempts).
    """
    post_data = ("data=" + urllib.parse.quote(QUERY)).encode("utf-8")
    headers = {
        "User-Agent": "ForestGuard-AI/1.0 (Student Research, Uttarakhand fire engine readiness; contact: support@forestguard.ai)",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "Accept": "application/json",
    }

    attempts = []
    for mirror in MIRRORS:
        start_time = datetime.now(timezone.utc)
        req = urllib.request.Request(mirror, data=post_data, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                status = resp.status
                raw = resp.read().decode("utf-8")
                data = json.loads(raw)
                elements = data.get("elements", [])
                features = elements_to_features(elements)
                attempts.append({
                    "mirror": mirror,
                    "status": status,
                    "elements_count": len(elements),
                    "features_count": len(features),
                    "error": None,
                    "timestamp": start_time.isoformat()
                })
                if features:
                    return features, attempts
        except Exception as e:
            attempts.append({
                "mirror": mirror,
                "status": getattr(e, "code", None),
                "elements_count": 0,
                "features_count": 0,
                "error": str(e),
                "timestamp": start_time.isoformat()
            })

    return [], attempts


def write_geojson(features: list[dict]) -> None:
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)


def main():
    run_date = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{run_date}] fetch_fire_stations.py starting...")
    print(f"Bounding box: W={BBOX_W}, S={BBOX_S}, E={BBOX_E}, N={BBOX_N}")
    print(f"Target: {OUTPUT_FILE}")

    features, attempts = fetch_from_overpass()

    for att in attempts:
        if att["error"]:
            print(f"  [{att['timestamp']}] {att['mirror']} -> FAILED: {att['error']}")
        else:
            print(f"  [{att['timestamp']}] {att['mirror']} -> SUCCESS: HTTP {att['status']}, {att['features_count']} stations")

    write_geojson(features)

    if features:
        print(f"[{run_date}] Downloaded and saved {len(features)} OSM fire stations.")
    else:
        print(f"[{run_date}] Notice: Overpass mirrors returned 0 stations or timed out.")
        print(f"[{run_date}] Per Data Honesty rules, no synthetic records were created.")
        print(f"[{run_date}] Preserved {OUTPUT_FILE} as an empty FeatureCollection (0 stations).")

    print(f"Stations downloaded: {len(features)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
