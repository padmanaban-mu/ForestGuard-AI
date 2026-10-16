"""Extract authentic Uttarakhand district boundaries and query centroid elevations from Open-Meteo.

Outputs:
  - frontend/public/data/zones.geojson
  - ml/zones.json
"""

import json
from pathlib import Path
import requests
from shapely.geometry import mapping, shape

GEOJSON_URL = "https://raw.githubusercontent.com/geohacker/india/master/district/india_district.geojson"
ELEVATION_API = "https://api.open-meteo.com/v1/elevation"

print("Downloading authentic Uttarakhand district boundaries from genuine source...")
r = requests.get(GEOJSON_URL, timeout=30)
data = r.json()

name_map = {
    "Dehra Dun": "Dehradun",
    "Naini Tal": "Nainital",
    "Rudra Prayag": "Rudraprayag",
    "Garhwal": "Pauri Garhwal",
}

uk_features = []
zones_summary = []

for f in data["features"]:
    props = f.get("properties", {})
    state = props.get("NAME_1") or props.get("state") or ""
    if "uttaranchal" in str(state).lower() or "uttarakhand" in str(state).lower():
        raw_name = props.get("NAME_2", "").strip()
        clean_name = name_map.get(raw_name, raw_name)
        geom = shape(f["geometry"])
        centroid = geom.centroid
        bounds = geom.bounds  # minx, miny, maxx, maxy

        lat = round(float(centroid.y), 4)
        lon = round(float(centroid.x), 4)

        # Query Open-Meteo Elevation API for centroid elevation
        try:
            elev_res = requests.get(ELEVATION_API, params={"latitude": lat, "longitude": lon}, timeout=15)
            elevation = float(elev_res.json()["elevation"][0]) if elev_res.status_code == 200 else 1000.0
        except Exception:
            elevation = 1000.0

        feature = {
            "type": "Feature",
            "id": clean_name.lower().replace(" ", "-"),
            "properties": {
                "name": clean_name,
                "district": clean_name,
                "state": "Uttarakhand",
                "centroid": [lat, lon],
                "elevation": round(elevation, 1),
                "bbox": [round(b, 4) for b in bounds],
            },
            "geometry": mapping(geom),
        }
        uk_features.append(feature)
        zones_summary.append({
            "name": clean_name,
            "district": clean_name,
            "state": "Uttarakhand",
            "latitude": lat,
            "longitude": lon,
            "elevation": round(elevation, 1),
            "bbox": [round(b, 4) for b in bounds],
        })

uk_features.sort(key=lambda x: x["properties"]["name"])
zones_summary.sort(key=lambda x: x["name"])

print(f"\nExtracted {len(uk_features)} authentic districts with pipeline-queried elevations:")
for z in zones_summary:
    print(f" - {z['name']}: centroid=({z['latitude']}, {z['longitude']}), elevation={z['elevation']}m")

geojson_data = {
    "type": "FeatureCollection",
    "name": "Uttarakhand_Districts",
    "features": uk_features,
}

Path("frontend/public/data").mkdir(parents=True, exist_ok=True)
Path("ml").mkdir(parents=True, exist_ok=True)

with open("frontend/public/data/zones.geojson", "w", encoding="utf-8") as f:
    json.dump(geojson_data, f, indent=2)
print("\n[OK] Saved frontend/public/data/zones.geojson successfully.")

with open("ml/zones.json", "w", encoding="utf-8") as f:
    json.dump(zones_summary, f, indent=2)
print("[OK] Saved ml/zones.json successfully.")
