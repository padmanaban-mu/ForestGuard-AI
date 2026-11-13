# ForestGuard AI — Forest Fire Risk Prediction

ForestGuard AI is a machine-learning-based forest fire risk prediction project focused on district-level risk awareness in Uttarakhand. It combines historical environmental data, weather forecasts, geospatial district information, and a trained model behind a FastAPI service and React interface.

> **Live demo:** https://forestguard-ai-n78g.onrender.com  
> The free-tier service may take time to wake after inactivity.

## Problem

Forest fire risk is influenced by interacting environmental conditions such as temperature, humidity, precipitation, vegetation, and recent dry periods. ForestGuard AI explores how historical observations and forecast inputs can support a district-level risk estimate and make the underlying conditions easier to inspect.

The system is a decision-support prototype, not an official warning service. Predictions should not replace local authorities, field observations, or emergency guidance.

## System overview

```text
Historical & forecast data
          |
          v
Feature preparation and validation
          |
          v
Trained ML model bundle
          |
          v
FastAPI prediction and data endpoints
          |
          v
React dashboard, maps and analytics
```

## Key components

- **Risk prediction:** model inference through a dedicated model service.
- **District context:** district metadata and GeoJSON boundaries.
- **Weather context:** forecast retrieval, caching, and source status.
- **Recent fire detections:** NASA FIRMS integration when configured.
- **Dashboard:** map-based views, risk summaries, historical context, and analytics.
- **Transparency:** model metrics, thresholds, reliability notes, and documented limitations.

The API includes health, zones, prediction, forecast, recent-fire, and model-metrics routes.

## Technology

| Layer | Technologies |
| --- | --- |
| Frontend | React, Vite, Leaflet / React Leaflet, Recharts |
| Backend | Python, FastAPI |
| ML/data | scikit-learn ecosystem, NumPy, pandas, joblib |
| Geospatial | Shapely, GeoJSON |
| External data | Weather service, NASA FIRMS (optional) |

## Repository structure

```text
.
├── backend/
│   ├── main.py
│   ├── model_service.py
│   ├── weather_service.py
│   ├── schemas.py
│   ├── config.py
│   ├── tests/
│   └── static/
├── frontend/
│   ├── src/
│   └── public/data/
├── docs/
│   └── METHODOLOGY.md
├── DEPLOY.md
└── README.md
```

The deployed backend serves the built frontend from `backend/static`. The frontend source remains in `frontend/`.

## Run locally

Check `DEPLOY.md`, `backend/README.md`, and the frontend environment example for the current deployment-specific details.

Typical development setup:

### Backend

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Configure the required backend environment variables using `backend/.env.example`, then run:

```bash
uvicorn backend.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Use the configured API base URL and the local Vite URL shown in the terminal.

## Model evaluation and responsible interpretation

The project README and methodology documentation describe the dataset splits, model selection, validation metrics, thresholds, and operational caveats. Consult those reports before quoting a performance number. A model score is not a guarantee of real-world fire prediction accuracy.

Some displayed condition explanations are explicitly heuristic indicators rather than model feature attribution. Forecast lead time, geographic coverage, data freshness, and missing external credentials can affect the output.

## Tests and quality checks

The backend includes API, bounds, and single-page-app tests under `backend/tests/`. Run the test commands documented in `backend/README.md` and `DEPLOY.md` after installing the backend requirements.

## Security and operations

Keep external API keys in environment variables, never in committed files. Review CORS origins, rate limits, input validation, logging, model-artifact provenance, and third-party data availability before production use.

## License

A license badge is present in the repository README, but verify the actual license file and its terms before redistribution.
