# ForestGuard AI — Forest Fire Risk Prediction

ForestGuard AI is a project that uses machine learning and environmental data to estimate forest-fire risk across districts in Uttarakhand. A FastAPI backend provides prediction and data endpoints, while a React dashboard presents district-level risk information, forecasts, and map views.

**Live demo:** https://forestguard-ai-n78g.onrender.com  
The hosted free-tier service may take a short time to wake after inactivity.

## What the system does

- Estimates next-day fire risk using a trained classification model.
- Retrieves weather forecast data and prepares the features used for inference.
- Displays district-level risk information through maps and dashboard views.
- Includes recent satellite fire detections when the NASA FIRMS integration is configured.
- Exposes model metrics and methodology so the prediction results can be inspected.

This is a decision-support prototype, not an official warning system. It should not replace local authorities, field observations, or emergency guidance.

## Architecture

```text
Weather and environmental data
             |
             v
      Feature preparation
             |
             v
       Trained ML model
             |
             v
        FastAPI backend
             |
             v
      React dashboard
```

The backend serves the built React application from `backend/static/`. The frontend source is kept separately in `frontend/`.

## Technology

- **Frontend:** React, Vite, Leaflet / React Leaflet, Recharts
- **Backend:** Python, FastAPI
- **Machine learning:** scikit-learn, NumPy, pandas, joblib
- **Geospatial data:** GeoJSON, Shapely
- **External data:** Open-Meteo weather APIs and optional NASA FIRMS integration

## Repository layout

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

## Run locally

The repository includes helper scripts for starting the application. The tested Python version is specified in `.python-version`. For deployment-specific details, see [DEPLOY.md](DEPLOY.md) and [backend/README.md](backend/README.md).

### Backend

Create and activate a virtual environment:

```bash
python -m venv .venv

# Windows PowerShell
.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate
```

Install the backend dependencies:

```bash
pip install -r backend/requirements.txt
```

Configure environment variables using `backend/.env.example`, then start FastAPI:

```bash
uvicorn backend.main:app --reload
```

### Frontend development

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Use the API base URL configured for your local frontend environment. The production backend serves the built frontend from `backend/static/`.

## Model evaluation

The project includes model evaluation and methodology reports. See [docs/METHODOLOGY.md](docs/METHODOLOGY.md) for the data split, feature preparation, leakage checks, model comparisons, and reported metrics. Read the evaluation context before quoting a performance number; test-set results are not a guarantee of real-world performance.

## Limitations to keep in mind

- The primary model is trained for day-ahead prediction. Forecast uncertainty increases for longer forecast horizons.
- Weather is sampled at district centroids, which cannot represent every local condition in mountainous terrain.
- Satellite detections can include non-forest sources such as agricultural burning.
- Some dashboard condition explanations are heuristic indicators, not model feature attribution.
- External data availability and API configuration affect what the dashboard can display.

## Data sources

The project uses weather data from [Open-Meteo](https://open-meteo.com/) and satellite fire information from [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/). Review the upstream providers' terms and attribution requirements when reusing the data. District boundary and basemap sources are described in the methodology and deployment documentation.

## License

See the repository's [LICENSE](LICENSE) file for the project license. Upstream datasets and services remain subject to their own terms.
