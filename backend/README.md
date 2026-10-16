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
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Allowed browser frontend origins |
| `FIRMS_MAP_KEY` | *(empty)* | Optional NASA FIRMS map key for active fire proxy |
| `PORT` | `8000` | Port for the Uvicorn server |

To pre-generate or refresh the static forecast cache manually:
```bash
python backend/export_static_forecast.py
```

---

## 3. API Endpoints & Usage Examples

### 1. `GET /health`
Returns service status, model name, model load state, and in-memory/static cache availability.

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

> **Crucial Date Semantics:**
> In every item, `weather_date` represents the observation day (day $t$), while `risk_for_date` ($t+1$) clearly labels the day for which the pre-ignition fire risk applies.

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
