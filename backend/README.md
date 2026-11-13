# ForestGuard AI — FastAPI Backend

Machine Learning pre-ignition forest fire risk prediction backend for Uttarakhand, India.

---

## 1. Quick Start

### Environment Requirements
- **Python Version:** Project standard is **Python `3.13`** (see `.python-version`).
- The backend shares library versions with the ML training pipeline (`scikit-learn 1.8.0`, `numpy 2.4.1`, `pandas 3.0.2`, `joblib 1.5.3`).

### Installation
```bash
pip install -r backend/requirements.txt
```

### Running the Server
```bash
uvicorn backend.main:app --reload --port 8000
```
The interactive Swagger API documentation will be available at:
`http://localhost:8000/docs`

---

## 2. Configuration & Offline Operability

The backend runs **out of the box without any `.env` file**.

- If no `.env` is configured or the system is completely offline, all endpoints operate transparently using the pre-generated static cache at [`backend/cache/forecast_latest.json`](cache/forecast_latest.json) (marked with `"weather_source": "cached"` and `"status": "cached"`).
- Optional private credentials (e.g. `FIRMS_MAP_KEY`) should only be configured in `backend/.env`. Never commit credentials to source control. A clean template is provided at [`backend/.env.example`](.env.example).

| Environment Variable | Default | Purpose |
| :--- | :--- | :--- |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173,http://localhost:4173,http://127.0.0.1:3000` | Allowed browser frontend origins (CORS `allow_credentials=False`) |
| `FIRMS_MAP_KEY` | *(empty)* | Optional NASA FIRMS map key for active fire proxy |
| `PORT` | `8000` | Port for the Uvicorn server |

### Adding Custom LAN Frontend Origins
To allow other devices on your local network to connect to the backend (e.g., from `http://192.168.1.50:3000`):
1. Copy `backend/.env.example` to `backend/.env`.
2. Append your IP/port to `CORS_ORIGINS`:
   ```bash
   CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:4173,http://127.0.0.1:3000,http://192.168.1.50:3000
   ```
3. Restart Uvicorn with `--host 0.0.0.0`.

### The Five Operating Forecast States
The ForestGuard UI and backend handle five distinct forecast states transparently:
1. **Live:** Backend is running, Open-Meteo external API is reachable. Returns `status="live"`, `weather_source="open-meteo"`, `cache_age_hours=0.0`. Frontend displays `Live` badge.
   - *How to reproduce:* Run backend normally with an active internet connection.
2. **Cached:** Backend is running, but network fails or Open-Meteo is unreachable. Backend immediately falls back to static cache `backend/cache/forecast_latest.json`. Returns `status="cached"`, `weather_source="cached"`. Frontend displays `Cached` badge.
   - *How to reproduce:* Disconnect your network or block `api.open-meteo.com` in hosts.
3. **Offline-with-Memory:** Frontend previously loaded a forecast successfully, but the backend server goes down or becomes unreachable (`Failed to fetch`). The frontend retains the forecast in memory.
   - *Banner displayed:* `"Cannot reach the ForestGuard server. Showing the last forecast received at <time>."`
   - *Card badges:* Display `Offline` (or `Stale`).
   - *Auto-retry:* Automatically retries every 60s while the browser tab is active, pausing when hidden, and recovering when the backend returns.
   - *How to reproduce:* Start backend, load dashboard in browser, then kill the backend process.
4. **Forecast Expired:** The forecast in memory is older than 24 hours (`generated_at` > 24h old) OR `risk_for_date` is no longer in the future in `Asia/Kolkata`.
   - *Behavior:* Does not label predictions as "tomorrow", suppresses/hides early warnings, displays `"Forecast expired"`. Auto-retry ceases until user action.
   - *How to reproduce:* In `backend/cache/forecast_latest.json`, set `generated_at` to a timestamp 30 hours ago and `risk_for_date` to yesterday's date.
5. **No Data:** Initial load occurs when the backend is unreachable and no prior forecast is in browser memory. Displays graceful `EmptyState` / retry controls.
   - *How to reproduce:* Clear browser session/localStorage, ensure backend is stopped, and visit the page.

To pre-generate or refresh the static forecast cache manually:
```bash
python backend/export_static_forecast.py
```

---

## 3. API Endpoints & Usage Examples

### 1. `GET /health`
Returns service status, model name, model load state, separate weather source telemetry, and cache diagnostics.
- `static_cache_age_hours`: age of the pre-generated static cache file on disk.
- `cache_age_hours` & `stale`: describe the data actually being served (`0.0` and `false` when serving live forecast; reflective of cache age when in cached/fallback mode).

**cURL:**
```bash
curl -X GET "http://localhost:8000/health"
```

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get | ConvertTo-Json -Depth 4
```

---

### 2. `GET /zones`
Returns all 13 Uttarakhand administrative districts with authentic GADM/Census boundary polygons, centroid coordinates, elevations, and lowland agricultural caveats.

**cURL:**
```bash
curl -X GET "http://localhost:8000/zones"
```

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/zones" -Method Get | ConvertTo-Json -Depth 3
```

> **Note on Lowland Districts:** Haridwar and Udham Singh Nagar include an explicit `caveat` field explaining that thermal detections in agricultural lowlands reflect post-harvest crop residue burning without a forest canopy mask.

---

### 3. `POST /predict`
Evaluates pre-ignition fire probability for day $t+1$ for a single district. Accepts either a precomputed 33-feature dictionary OR a raw weather buffer.

> **Explainability Notice (`key_conditions`):**
> The `key_conditions` array reports physical meteorological and moisture indicators (e.g., prolonged drought, low topsoil moisture, high VPD). These are **heuristic, not model attribution** (i.e. rule-based flags on physical thresholds, not SHAP or tree-path feature importance).

#### Option A: Raw Weather Buffer (Online Serving Flow)
**cURL:**
```bash
curl -X POST "http://localhost:8000/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "district": "Nainital",
    "today_record": {
      "date": "2026-05-15",
      "temp_max": 31.5,
      "humidity_mean": 38.0,
      "wind_speed_max": 18.0,
      "rain_sum": 0.0,
      "et0": 4.8,
      "soil_moisture_mean": 0.14
    },
    "history_records": []
  }'
```

**PowerShell:**
```powershell
$body = @{
    district = "Nainital"
    today_record = @{
        date = "2026-05-15"
        temp_max = 31.5
        humidity_mean = 38.0
        wind_speed_max = 18.0
        rain_sum = 0.0
        et0 = 4.8
        soil_moisture_mean = 0.14
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/predict" -Method Post -Body $body -ContentType "application/json" | ConvertTo-Json -Depth 4
```

---

### 4. `GET /forecast?days=7`
Fetches the Open-Meteo operational forecast (with a 90-day lookback buffer) for all 13 districts, computes daily features using `ml/features.build_feature_row`, and generates pre-ignition risk predictions.

> **Date Semantics & Lead Time:**
> - `weather_date`: observation day ($t$).
> - `risk_for_date`: pre-ignition risk target day ($t+1$).
> - `lead_days`: computed as days from today in `Asia/Kolkata` (UTC+5:30) to `risk_for_date`. Weather for today = lead 0, risk for tomorrow = lead 1.
> - **Lower confidence badge (`reliability_note`):** Entries with `lead_days > 2` (days 3–7) carry a reliability note documenting higher numerical forecast uncertainty beyond 48 hours.
> - `mixed_agricultural`: boolean field (`true` for Haridwar and Udham Singh Nagar, `false` for the 11 forest districts).
> - **Concurrent Weather Fetching:** District forecasts are fetched concurrently with 6 worker threads (an unverified, conservative concurrency of 6 to respect potential upstream throttling while minimizing latency). Connect timeout: 5 s; read timeout: 15 s.
> - **Single Retry for Failed Districts:** If any district requests fail or time out on the first pass, only the failed districts are retried once.
> - **Strict All-Live or All-Cached Fallback:** If any district is still missing after retry, the service falls back completely to the pre-generated static cache. The API never returns a hybrid mix of live and cached districts.
> - **In-Memory Live Recovery Cooldown:** When a live fetch fails, an in-memory marker pauses outbound live requests for 60 seconds (serving cached forecast) before attempting live fetching again. The marker is stored in server memory only (a server restart resets it immediately).

**cURL:**
```bash
curl -X GET "http://localhost:8000/forecast?days=3"
```

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/forecast?days=3" -Method Get | ConvertTo-Json -Depth 4
```

---

### 5. `GET /fires/recent?hours=72`
Proxies NASA FIRMS active fire detections for Uttarakhand (bbox `77.6, 28.7, 81.1, 31.5`).
- If `FIRMS_MAP_KEY` is not set in `backend/.env`, returns an honest empty list with `"status": "not_configured"`.
- **Polygon Containment Filtering:** Thermal detections are filtered via `shapely` point-in-polygon containment against the 13 district boundaries from `zones.geojson`. Detections outside Uttarakhand boundaries are discarded. Each detection includes its assigned `district` and `mixed_agricultural` flag.
- **Robust Error Handling (Never 500):** Network timeouts, connection errors, HTTP errors (401/403/429/5xx), and CSV parse errors return HTTP 200 with `status="error"`, an empty fire list, and `message="NASA FIRMS unreachable"`. Failed lookups are cached for 5 minutes.
- **Key Redaction Security:** The NASA FIRMS map key is strictly redacted from all server log records, exception messages, and client responses via a dedicated `logging.Filter`. Safe HTTP requests log only exception class and host name.

**cURL:**
```bash
curl -X GET "http://localhost:8000/fires/recent?hours=48"
```

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/fires/recent?hours=48" -Method Get | ConvertTo-Json -Depth 3
```

---

### 6. `GET /model/metrics`
Exposes the served model's selection criterion, validation metrics, dynamically configured risk thresholds from `ml/models/risk_model.joblib`, and direct URLs to the evaluation curves.

**cURL:**
```bash
curl -X GET "http://localhost:8000/model/metrics"
```

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/model/metrics" -Method Get | ConvertTo-Json -Depth 4
```

---

## 4. Running Tests
Run the test suite with external APIs mocked:
```bash
pytest backend/tests/test_api.py -v
```
