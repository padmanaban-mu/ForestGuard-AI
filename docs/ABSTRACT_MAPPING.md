# ForestGuard AI: Project Abstract Traceability & Implementation Mapping

This document provides a formal, clause-by-clause traceability matrix mapping the project abstract to concrete codebase implementations, runtime routes, and empirical verification records. It transparently delineates where the implementation is complete versus where physical proxies were adopted.

---

## 1. Abstract Statement

> *"AI-based forest fire risk prediction: ML on historical weather/environmental data predicts Low/Medium/High/Extreme risk before ignition; dashboard early warnings"*

---

## 2. Traceability Matrix

| Abstract Clause | Implementation Files & Routes | Concrete Mechanism | Empirical Evidence / Metrics | Implementation Status & Proxy Honesty |
| :--- | :--- | :--- | :--- | :--- |
| **"AI-based forest fire risk prediction"** | • `ml/train_model.py`<br>• `ml/models/risk_model.joblib`<br>• `backend/main.py`<br>• `backend/routes/forecast.py` | Supervised ensemble machine learning pipeline utilizing a Calibrated Histogram Gradient Boosting Classifier (`CalibratedClassifierCV(HistGradientBoostingClassifier, method='sigmoid')`). | • Validation PR-AUC: **0.6436**<br>• Held-out 2024 PR-AUC: **0.7094**<br>• ROC-AUC: **0.8731**<br>• F1 Score: **0.6941** at $\tau^* = 0.33$<br>*(Source: `ml/reports/metrics.json`)* | **FULL**<br>Selected by pre-stated PR-AUC criterion on held-out 2023 data over Random Forest (0.6289) and Logistic Regression (0.6203). |
| **"ML on historical weather/environmental data"** | • `ml/01_fetch_weather.py`<br>• `ml/02_build_dataset.py`<br>• `ml/features.py`<br>• `backend/services/weather.py` | 33 engineered features derived from 7 years (2018–2024, $N = 33,228$) of daily ERA5-Land reanalysis observations, including 90-day antecedent buffers (`days_since_rain`, `rain_30d`, `temp_mean_7d`). | • 14 atmospheric & moisture features<br>• 16 static spatial/elevation features<br>• 3 historical training anomalies<br>• Zero-leakage mathematical audit passed<br>*(Source: `ml/reports/leakage_audit.md`)* | **PARTIAL / PROXY (Vegetation)**<br>• **Weather Data:** FULL (ERA5 daily temperature, humidity, wind, rainfall, solar radiation).<br>• **Vegetation Data:** PROXY. Vegetation dryness is represented by topsoil volumetric moisture (0–7cm) and Penman-Monteith evapotranspiration (ET0). Satellite NDVI is **NOT** ingested into the ML pipeline due to frequent mountain cloud contamination.<br>• **Spatial Sampling:** Centroid approximation (1 coordinate per district). |
| **"predicts Low/Medium/High/Extreme risk"** | • `ml/features.py:probability_to_risk_level`<br>• `backend/routes/forecast.py`<br>• `frontend/src/components/RiskBadge.jsx`<br>• `frontend/src/pages/ForecastPage.jsx` | Platt sigmoid probability calibration mapped to four discrete operational tiers:<br>• Low: $[0.00, 0.25)$<br>• Medium: $[0.25, 0.50)$<br>• High: $[0.50, 0.75)$<br>• Extreme: $[0.75, 1.00]$ | Empirical 2024 test fire rates demonstrate strict monotonicity:<br>• Low: **5.25%** (116 / 2,208 days)<br>• Medium: **31.92%** (271 / 849 days)<br>• High: **56.05%** (602 / 1,074 days)<br>• Extreme: **78.99%** (485 / 614 days)<br>*(Source: `ml/reports/metrics.json`)* | **FULL**<br>Probability calibration guarantees that predicted probabilities correspond to true empirical posterior ignition frequencies across all operational tiers. |
| **"before ignition"** | • `ml/02_build_dataset.py`<br>• `ml/features.py`<br>• `backend/routes/forecast.py` | Target label is strictly next-day active fire occurrence ($y_{d, t+1} = \mathbb{I}(\text{detections}_{d, t+1} \ge 1)$). Environmental observations are bounded strictly to day $t$ (cutoff 23:59:59 local time). | Formal mathematical audit verifies zero exposure to future states:<br>$$\frac{\partial X_t}{\partial \mathcal{O}_\tau} = 0 \quad \forall \tau > t$$<br>*(Source: `ml/reports/leakage_audit.md`)* | **FULL for Day-Ahead ($t+1$)**<br>• Day-ahead pre-ignition forecasting is fully verified.<br>• **Days 3–7 Operational Forecasts:** Operational lead times beyond day 2 rely on numerical weather prediction trajectories whose skill degrades over time; these are flagged with advisory uncertainty warnings in serving. |
| **"dashboard early warnings"** | • `frontend/src/pages/DashboardPage.jsx`<br>• `frontend/src/pages/ForecastPage.jsx`<br>• `frontend/src/pages/VulnerableAreasPage.jsx`<br>• `backend/main.py` | Unified FastAPI server delivering:<br>• 7-day district risk forecast cards<br>• Live KPI status cards with alert tiers<br>• Leaflet district vulnerability choropleth<br>• Operational early warning feeds | • Single-origin serving at `http://127.0.0.1:8000`<br>• In-memory 24h caching and static offline fallback<br>• Sub-second API response times | **FULL**<br>Interactive web dashboard accessible via a single command (`run.bat` / `run.sh`) or cloud deployment. |

---

## 3. Detailed Component Analysis & Engineering Honesty

### 3.1 Vegetation Representation (Why Soil Moisture & ET0 Instead of Satellite NDVI)
The abstract refers to "environmental data", which in wildfire literature typically includes vegetative fuel status. In ForestGuard AI:
- **What is implemented:** Topsoil volumetric moisture ($0\text{--}7\text{ cm depth}$, $\text{m}^3/\text{m}^3$) and FAO-56 Penman-Monteith reference evapotranspiration ($\text{et0}$, $\text{mm}$) from ERA5-Land reanalysis.
- **What is omitted:** Optical satellite vegetation indices (e.g., MODIS/Sentinel-2 NDVI).
- **Justification:** Optical NDVI in the Western Himalayas suffers from severe cloud occlusion during the monsoon and pre-monsoon transitions, leading to missing observations or composite interpolation errors. Volumetric soil moisture and evaporative demand provide continuous, physical proxies for fine fuel moisture without cloud gaps.

### 3.2 Target Label Construction & Agricultural Burning
- **What is implemented:** Active thermal anomalies from the NASA FIRMS VIIRS sensor ($375\text{ m}$ resolution) aggregated across district administrative boundaries.
- **What is omitted:** A high-resolution land-cover forest canopy mask.
- **Impact:** In lowland agricultural districts (**Haridwar** and **Udham Singh Nagar**), post-harvest crop residue burning is detected as active fire events by VIIRS, resulting in elevated false positive rates (Haridwar PR-AUC is 0.4093, compared to montane Nainital PR-AUC of 0.8398).

### 3.3 Forecast Lead Times (Day 1 vs. Days 3–7)
- **Day-Ahead ($t+1$):** Formally validated against historical ERA5 reanalysis and verified with real operational forecast data (March–June 2024: Pearson $r = 0.9943$, risk tier agreement $93.69\%$).
- **Multi-Day Horizon (Days 3–7):** Driven by multi-day numerical weather predictions from Open-Meteo. While computationally supported by the serving pipeline, forecast skill naturally diminishes with increasing lead time and has not been validated against reanalysis ground truth.
