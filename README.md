# ForestGuard AI — ML-Based Forest Fire Risk Prediction System

[![Python Version](https://img.shields.io/badge/python-3.13-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Framework](https://img.shields.io/badge/FastAPI-0.115.11-009688.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://react.dev)

> **Live Demo:** `https://forestguard-ai-n78g.onrender.com`  
> *(Note: Free-tier instances spin down during inactivity and may require 30–60 seconds to wake up on the first request.)*

---

## 1. Problem Statement

Forest fires in the Western Himalayas pose severe threats to biodiversity, local livelihoods, infrastructure, and carbon sequestration. In Uttarakhand, India—encompassing 13 diverse administrative districts ranging from lowland agricultural plains (Haridwar, Udham Singh Nagar) to high-altitude alpine terrain (Chamoli, Uttarkashi)—wildfires exhibit extreme seasonal spikes during the pre-monsoon dry months (March through June).

Most conventional forest fire management platforms operate purely **reactively**: they display thermal satellite detections (e.g., MODIS/VIIRS) hours after an active fire has already ignited and spread. 

**ForestGuard AI** is designed to shift wildland fire management from reactive suppression to **proactive prevention**. By analyzing daily atmospheric observations, evaporative demand, and soil moisture dynamics alongside static topographic and geographic indicators, the system forecasts the pre-ignition probability of active fire occurrence for the following day ($t+1$), categorizing risk into four calibrated operational tiers: **Low**, **Medium**, **High**, and **Extreme**.

---

## 2. Abstract Alignment

> *"AI-based forest fire risk prediction: ML on historical weather/environmental data predicts Low/Medium/High/Extreme risk before ignition; dashboard early warnings"*

ForestGuard AI directly implements every facet of this specification:

| Abstract Component | System Implementation | Verification & Evidence |
| :--- | :--- | :--- |
| **"AI-based forest fire risk prediction"** | Supervised ensemble machine learning pipeline utilizing a Calibrated Histogram Gradient Boosting Classifier (`CalibratedClassifierCV` around `HistGradientBoostingClassifier`, sigmoid scaling). | Evaluated against multiple baselines in `ml/reports/metrics.json`. Selected by pre-stated Validation PR-AUC on held-out 2023 data. |
| **"ML on historical weather/environmental data"** | 33 engineered features extracted from 7 years (2018–2024) of daily ERA5-Land reanalysis, including temperature, humidity, wind, rainfall sums (3d, 7d, 30d), days since rain, vapor pressure deficit, FAO-56 evapotranspiration (ET0), topsoil moisture, elevation, and historical anomalies. | Feature engineering pipeline implemented in `ml/features.py`, verified with zero temporal leakage in `ml/reports/leakage_audit.md`. |
| **"predicts Low/Medium/High/Extreme risk"** | Calibrated posterior probabilities mapped to four operational risk categories: Low ($[0.00, 0.25)$), Medium ($[0.25, 0.50)$), High ($[0.50, 0.75)$), and Extreme ($[0.75, 1.00]$). | Observed 2024 test fire rates demonstrate strict empirical monotonicity: Low (5.25%), Medium (31.92%), High (56.05%), Extreme (78.99%). |
| **"before ignition"** | Next-day forecasting formulation ($y_{d, t+1}$) strictly utilizing environmental information observed up to day $t$ (cutoff at 23:59:59 local time), predicting whether an active fire will ignite on day $t+1$. | Target shifting implemented in `ml/02_build_dataset.py`; leakage audited in `ml/reports/leakage_audit.md`. |
| **"dashboard early warnings"** | Unified interactive web dashboard providing real-time KPI alerts, 7-day multi-district risk forecasts, interactive district vulnerability maps, and active satellite fire monitoring. | Full-stack architecture served by FastAPI with instant caching and responsive React UI. |

---

## 3. System Architecture

ForestGuard AI runs as a single, self-contained application where a high-performance **FastAPI backend** powers the REST API and concurrently serves the production-built **React Single Page Application (SPA)** from `backend/static/`.

```text
+---------------------------------------------------------------------------------+
|                                React SPA Frontend                               |
|   (Leaflet Maps, 7-Day Forecast, District Vulnerability, Model Evaluation, KPI) |
+----------------------------------------+----------------------------------------+
                                         | HTTP / JSON (Port 8000)
+----------------------------------------v----------------------------------------+
|                             FastAPI Unified Backend                             |
| - Static Asset Handler: Serves built React SPA from backend/static/ at /        |
| - REST API Endpoints: /health, /api/forecast, /api/fires, /api/weather, etc.    |
| - Caching Layer: In-memory 24h TTLCache with static JSON disk cache fallback    |
+-------------------+-----------------------------------------+-------------------+
                    |                                         |
+-------------------v-------------------+ +-------------------v-------------------+
|        ML Inference Serving Pipeline  | |          External Data Providers      |
| - ml/features.py: 33-feature engine   | | - Open-Meteo Forecast & Archive APIs  |
|   (with 90-day antecedent buffer)     | |   (Daily weather, ET0, soil moisture) |
| - ml/models/risk_model.joblib:        | | - NASA FIRMS VIIRS Active Fire API    |
|   Calibrated HistGradientBoosting     | |   (Satellite thermal anomaly layer)   |
+---------------------------------------+ +---------------------------------------+
```

### Key Technical Highlights
- **Single-Server Simplicity:** Runtime execution requires only Python; no Node.js or npm dependencies are needed to run the application.
- **Shared Feature Extraction:** The production serving pipeline (`backend/routes/forecast.py`) calls the exact same feature engineering module (`ml/features.py`) used during model training and offline evaluation.
- **Antecedent Lookback Buffer:** Queries to the weather API automatically prepend a 90-day historical window so that antecedent metrics (`rain_30d`, `days_since_rain`, `temp_mean_7d`) are calculated dynamically over genuine weather history rather than synthetic approximations.
- **Offline Resilience:** If the live weather API is unreachable, the backend serves from an in-memory 24-hour cache or falls back to a committed baseline forecast (`backend/cache/forecast_latest.json`), clearly flagging responses with status headers (`source: "cached"` or `"fallback"`).

---

## 4. Quick Start

### Prerequisites
- **Python 3.13** is the tested project standard (see `.python-version`). Download from [python.org](https://python.org/downloads/) and ensure *"Add Python to PATH"* is checked during installation.
- No Node.js runtime is required. The frontend is pre-built into `backend/static/`.

### Windows (One Command)
```bat
run.bat
```
Double-click `run.bat` or execute it from PowerShell / Command Prompt. The script will:
1. Detect Python 3.13 via the Windows `py` launcher.
2. Create a virtual environment at `.venv` if one does not exist.
3. Install runtime requirements from `requirements-serve.txt`.
4. Copy `backend/.env.example` to `backend/.env` if missing.
5. Automatically open **http://127.0.0.1:8000** in your default browser.
6. Start the FastAPI server in the foreground (press `Ctrl+C` to stop).

### macOS / Linux
```bash
chmod +x run.sh && ./run.sh
```
Executes the identical workflow: sets up `.venv`, installs dependencies, launches the browser, and starts the server at **http://127.0.0.1:8000**.

---

## 5. Environment Configuration

All configuration is managed through environment variables in `backend/.env` (created automatically from `backend/.env.example` on first run). 

> [!NOTE]
> All sensitive keys reside exclusively on the backend. No API keys are embedded in frontend client code or exposed in static bundles.

| Variable | Default | Description |
| :--- | :---: | :--- |
| `FIRMS_MAP_KEY` | *(empty)* | Optional NASA FIRMS Map Key for live VIIRS satellite fire overlays. When empty, the server returns an honest `"not_configured"` response and displays historical fallback records. |
| `CORS_ORIGINS` | `http://localhost:8000,http://127.0.0.1:8000` | Comma-separated list of allowed origins. |

---

## 6. Data Sources and Attribution

ForestGuard AI strictly cites and complies with all upstream data providers:

| Data Source | Provider / Origin | License / Usage Terms | Usage in ForestGuard AI |
| :--- | :--- | :--- | :--- |
| **Historical Weather & Soil Moisture** | [Open-Meteo Historical Weather API](https://open-meteo.com/) (ERA5-Land reanalysis) | [Creative Commons Attribution 4.0 (CC BY 4.0)](https://open-meteo.com/en/terms) | Model training, validation, and historical baseline calculations (2018–2024). |
| **Operational Forecasts** | [Open-Meteo Weather Forecast API](https://open-meteo.com/) | [Creative Commons Attribution 4.0 (CC BY 4.0)](https://open-meteo.com/en/terms) | Real-time 7-day operational predictions across all 13 district centroids. |
| **Active Fire Detections** | [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) (VIIRS SNPP 375m) | Public Domain / NASA Earthdata Policy | Ground truth training labels ($y_{d, t+1}$) and live map overlay layer. |
| **District Administrative Boundaries** | [`geohacker/india`](https://github.com/geohacker/india) (Sajjad Anwar) | **MIT License**, Copyright (c) 2014 Sajjad Anwar | GeoJSON polygon boundaries for Uttarakhand districts. |
| **Underlying Boundary Data** | [GADM](https://gadm.org/) | Academic, research, and non-commercial use | Source spatial data for district geometries. |
| **Cartographic Basemaps** | OpenStreetMap & [OpenHikingMap / OpenMaps.fr](https://openmaps.fr/) | Open Database License ([ODbL](https://www.openstreetmap.org/copyright)) / OpenMaps.fr Usage Policy | Raster topographic basemaps for Leaflet map views. |

---

## 7. Model Performance & Evaluation Summary

Evaluated on the held-out **2024 test year** ($N = 4,745$ district-days across all 13 districts):

| Model / Baseline | Val $\tau^*$ | Accuracy | Precision | Recall | F1 Score | PR-AUC | ROC-AUC | Role |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **ForestGuard Served Model (Calibrated GB)** | **0.33** | **75.89%** | **57.28%** | **88.06%** | **0.6941** | **0.7094** | **0.8731** | **Production Serving** |
| Random Forest (Full Features) | 0.26 | 72.48% | 53.38% | 90.09% | 0.6704 | 0.7152 | 0.8653 | Ensemble Comparison |
| Climatology (District + Month Lookup) | 0.22 | 74.10% | 54.99% | 91.66% | 0.6874 | 0.6526 | 0.8465 | Geographic/Seasonal Baseline |
| Logistic Regression (Baseline) | 0.42 | 72.77% | 53.63% | 91.32% | 0.6757 | 0.6768 | 0.8553 | Linear Baseline |
| Random Forest (Weather-Only Baseline) | 0.21 | 70.22% | 51.12% | 94.44% | 0.6633 | 0.6954 | 0.8560 | Spatial Ablation |
| Climatology (Month Only Lookup) | 0.21 | 65.10% | 46.70% | 87.31% | 0.6085 | 0.5720 | 0.7907 | Pure Calendar Baseline |
| Rule-Based FWI / Drought Proxy | 0.0017 | 64.62% | 45.98% | 79.44% | 0.5824 | 0.5303 | 0.7225 | Weak Heuristic Baseline |

*Detailed experimental methodology, confusion matrices, rolling-origin walk-forward results, and feature audits are documented in [docs/METHODOLOGY.md](docs/METHODOLOGY.md) and [docs/REPORT_NUMBERS.md](docs/REPORT_NUMBERS.md).*

---

## 8. Limitations & Engineering Honesty

To maintain rigorous scientific standards, the limitations of the current implementation are explicitly disclosed:

1. **Modest Margin Over Climatology:** On the held-out 2024 test set, the served model achieves a PR-AUC of 0.7094 compared to 0.6526 for the District + Month Climatology lookup ($\Delta\text{PR-AUC} = +0.0567$). In weekly block bootstrap testing (52 blocks, $B = 1,000$), the 95% confidence interval is `[-0.0277, 0.1368]`. Because this interval crosses zero, the ranking improvement over the geographic-seasonal baseline is modest and not statistically significant. Broad seasonal timing and district geography explain the bulk of baseline risk, while daily weather dynamics provide fine-grained day-to-day modulation.
2. **Agricultural Residue Burning in Lowland Plains:** Ground truth labels are derived from all satellite thermal detections within administrative district borders without a land-cover forest canopy mask. In agricultural districts such as Haridwar (PR-AUC 0.4093) and Udham Singh Nagar (47.4% positive fire rate), post-harvest crop residue burning generates thermal anomalies that elevate false positive rates.
3. **Centroid Weather Sampling:** Weather observations are queried for a single centroid coordinate per district. In topographically complex Himalayan districts (e.g., Chamoli, Uttarkashi), centroid sampling does not capture steep elevation gradients, localized rain shadows, or microclimate variations.
4. **Vegetation Representation via Physical Proxies:** Satellite NDVI is not ingested directly into the ML model due to cloud cover gaps during pre-monsoon and monsoon transitions. Instead, vegetation dryness is represented through physical proxies: topsoil volumetric moisture (0–7cm depth) and FAO-56 Penman-Monteith reference evapotranspiration (ET0).
5. **Operational Lead Time Uncertainty (Days 3–7):** The model is trained and validated on day-ahead ($t+1$) predictions. In production serving, days 3–7 rely on numerical weather prediction forecasts whose accuracy naturally degrades over longer horizons. Operational predictions for lead days 3–7 carry advisory uncertainty notes.
6. **Single Primary Held-Out Test Year:** Primary benchmark figures are evaluated on the 2024 calendar year ($N = 4,745$), supplemented by 4-year rolling-origin walk-forward validation (2021–2024).

---

## 9. Project Navigation & Documentation

- [**docs/METHODOLOGY.md**](docs/METHODOLOGY.md): Comprehensive experimental setup, feature definitions, leakage audit, calibration analysis, and full baseline metrics.
- [**docs/REPORT_NUMBERS.md**](docs/REPORT_NUMBERS.md): Single-page quick reference sheet containing every exact number and source file path for college project reports and viva defense.
- [**docs/ABSTRACT_MAPPING.md**](docs/ABSTRACT_MAPPING.md): Traceability matrix connecting each sentence of the project abstract to its concrete codebase implementation.
- [**TEAM_GUIDE.md**](TEAM_GUIDE.md): Teammate instructions for running the application locally or viewing the live deployment.
- [**DEPLOY.md**](DEPLOY.md): Step-by-step instructions for deploying to the Render free web service tier.

---

## 10. License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.  
Upstream boundary datasets and weather APIs remain subject to their respective licenses and terms of use cited above.
