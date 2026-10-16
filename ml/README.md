# ForestGuard AI — Machine Learning Pipeline

This directory contains the machine learning pipeline for pre-ignition forest fire risk prediction across all 13 districts of Uttarakhand, India.

> **Note for Teammates:** Retraining is completely optional! Pre-trained calibrated model weights (`ml/models/risk_model.joblib`), evaluation reports (`ml/reports/`), authentic boundary files (`ml/zones.json`), and processed datasets (`ml/data/processed/dataset.csv`) are committed to this repository and ready for immediate inference by the backend.

---

## 1. Data Sources & Attribution

All datasets used in this project are 100% genuine and public:

| Dataset | Genuine Source | Vintage / Coverage | License / Terms |
| :--- | :--- | :--- | :--- |
| **District Boundaries** | [`geohacker/india`](https://github.com/geohacker/india) (Author: Sajjad Anwar) | Census of India 2011 / GADM (13 districts) | **Repository Code:** The MIT License (MIT), Copyright (c) 2014 Sajjad Anwar.<br>**Boundary Data:** GADM (`gadm.org`), free for **academic, research, and non-commercial use**. |
| **Historical Weather & Soil Moisture** | [Open-Meteo Historical Archive API](https://open-meteo.com/) | 2018-2024 daily observations | Creative Commons Attribution 4.0 International (CC BY 4.0) |
| **Active Fire Detections** | [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) (VIIRS SNPP) | 2018-2024 detections | NASA Earthdata / Public Domain |

### Vegetation & Dryness Representation
Vegetation dryness is represented strictly by topsoil volumetric moisture (`soil_moisture_0_to_7cm_mean` in m³/m³) and FAO-56 Penman-Monteith reference evapotranspiration (`et0`) proxies from ERA5-Land/Open-Meteo. Satellite NDVI is not ingested; documentation must not claim satellite NDVI.

---

## 2. Environment & Python Version

- **Deployment Requirement:** Project standard is Python 3.13; the model needs the pinned scikit-learn/numpy/pandas/joblib versions (scikit-learn `1.8.0`, numpy `2.4.1`, pandas `3.0.2`, joblib `1.5.3`; see `.python-version`).
- **Dependencies:** Install pinned requirements via:
  ```bash
  pip install -r ml/requirements.txt
  ```

---

## 3. Pipeline Structure & Execution Order

If you wish to rerun the pipeline from scratch:

1. **Extract District Boundaries:**
   ```bash
   python ml/extract_zones.py
   ```
   Downloads authentic Uttarakhand district boundaries from `geohacker/india` (GADM derived), queries Open-Meteo Elevation API for each centroid, and writes `frontend/public/data/zones.geojson` and `ml/zones.json`.

2. **Download Historical Weather & Fires:**
   ```bash
   python ml/01_download_data.py
   ```
   Ingests daily weather, soil moisture (`soil_moisture_0_to_7cm_mean`), and elevation from Open-Meteo from **2017-10-01 to 2024-12-31**. The genuine **2017 Q4 lookback buffer (92 days)** provides authentic antecedent rainfall history so `days_since_rain` and rolling aggregations on `2018-01-01` require zero artificial seed defaults. Downloads genuine NASA FIRMS active fire detections (2018–2024).

3. **Build Supervised Dataset & Climatology:**
   ```bash
   python ml/02_build_dataset.py
   ```
   Computes antecedent dryness, cumulative rainfall, static location features (lat, lon, elevation, district one-hot), training-only climatology baselines (`ml/data/processed/climatology_district_month.json`), and anomaly features. Aligns with day t+1 fire occurrence labels (`target_fire_next_day` and `target_fire_next_day_ge3`). Outputs `ml/data/processed/dataset.csv` (33,228 rows, 33 features).

4. **Train & Calibrate Models:**
   ```bash
   python ml/03_train_model.py
   ```
   Performs strict time-based split (Train: 2018-2022, Validation: 2023, Test: 2024). Evaluates candidate models (Logistic Regression, Random Forest, Gradient Boosting), selects the best model by validation PR-AUC, applies probability calibration, embeds runtime library metadata, and exports `ml/models/risk_model.joblib`.

5. **Evaluate & Generate Reports:**
   ```bash
   python ml/04_evaluate.py
   ```
   Executes leakage-free walk-forward rolling-origin evaluation (2021-2024), fair thresholding ($\tau^*$), weekly block bootstrap significance testing, deep non-seasonal ablation, label sensitivity analysis, and comparative calibration reliability analysis. Exports reports into `ml/reports/`.

6. **Verify Feature Parity:**
   ```bash
   python ml/tests/test_feature_parity.py
   ```
   Verifies 100% numerical parity (tolerance $10^{-6}$) between offline dataset generation and the online serving function `build_feature_row()`. Works on both full datasets and fresh clones via fixture fallback.

---

## 4. Serving Parity & Production Alignment

### How Serving Builds Features
- In production, the FastAPI backend fetches the past 90 days of daily weather via the Open-Meteo Forecast API (`past_days=90`) plus today's weather.
- The serving function `build_feature_row()` in `ml/features.py` computes the exact same 33 numerical features (rolling rainfall sums, days since rain, VPD, soil moisture, static location, and climatology anomalies) as computed during dataset building.
- `days_since_rain` is capped at 90 days in both offline training and online serving, matching the 90-day serving lookback buffer.
- Verified by automated unit test `ml/tests/test_feature_parity.py` with zero discrepancies down to machine precision.

### Operational Limitation: ERA5 vs Forecast Data
- **Offline Training Data:** Derived from Open-Meteo ERA5 historical reanalysis archive data.
- **Online Serving Data:** Derived from Open-Meteo operational numerical weather forecast models.
- **Limitation Note:** Reanalysis data incorporates post-hoc observational assimilation, whereas real-time forecast models have inherent forecast uncertainty. This introduces a minor domain shift between offline evaluation and real-time operational serving.

---

## 5. Summary of Scientific Findings & Reporting Honesty

- **Headline Test Year (2024, N = 4,745):**
  - **Served Model (Calibrated Gradient Boosting):** PR-AUC = **0.7094**, ROC-AUC = **0.8731**, F1 = **0.6941** ($\tau^* = 0.33$, Accuracy = 75.9%, Precision = 57.3%, Recall = 88.1%).
  - **Random Forest (Comparison Row):** PR-AUC = 0.7152, ROC-AUC = 0.8653, F1 = 0.6704 ($\tau^* = 0.26$, Accuracy = 72.5%, Precision = 53.4%, Recall = 90.1%).
  - **District + Month Climatology Lookup:** PR-AUC = 0.6526, ROC-AUC = 0.8465, F1 = 0.6874 ($\tau^* = 0.22$, Accuracy = 74.1%, Precision = 55.0%, Recall = 91.7%).
  - **Rule-Based FWI / Drought Proxy:** PR-AUC = 0.5303, ROC-AUC = 0.7225, F1 = 0.5824 ($\tau^* = 0.0017$). Acts as a weak heuristic baseline that predicts positive on 53.7% of days with low precision (46.0%).
- **Gain Reconciliation & Statistical Significance:**
  - Headline Test Gain ($\Delta\text{PR-AUC}$): $+0.0568$ (0.7094 vs 0.6526).
  - Walk-Forward Fold 2024 Gain: $+0.0567$ (reproduces the served model test benchmark).
  - Weekly Block Bootstrap Mean Delta (52 ISO Weeks, $B = 1,000$): $+0.0585$ (95% CI: `[-0.0277, 0.1368]`).
  - **Honesty Assessment:** Because the 95% bootstrap confidence interval crosses zero, the ranking improvement over a geographic-monthly lookup baseline is modest and not statistically significant. Seasonality and geographic base rates explain the majority of predictive skill, while weather and moisture features modulate daily risk.
- **Leakage-Free Rolling-Origin Evaluation (2021-2024):**
  - Fold-specific climatology tables and anomalies were recomputed dynamically using strictly earlier training years:
    - 2021: 2 training years (2018–2019) $\rightarrow$ $\Delta\text{PR} = +0.2837$, $\Delta\text{ROC} = +0.1075$
    - 2022: 3 training years (2018–2020) $\rightarrow$ $\Delta\text{PR} = +0.2190$, $\Delta\text{ROC} = +0.0976$
    - 2023: 4 training years (2018–2021) $\rightarrow$ $\Delta\text{PR} = +0.1220$, $\Delta\text{ROC} = +0.0570$
    - 2024: 5 training years (2018–2022) [Headline] $\rightarrow$ $\Delta\text{PR} = +0.0567$, $\Delta\text{ROC} = +0.0267$

---

## 6. Critical Limitations & Label Hypotheses

1. **Unmasked FIRMS Labels:** Target labels count any active fire detection from NASA FIRMS within district administrative boundaries without a forest canopy or land-use mask.
2. **Plains Agricultural Burning Hypothesis:** In southern agricultural lowlands (**Haridwar** PR-AUC 0.4093, precision 33.0%; **Udham Singh Nagar** 47.4% positive rate), post-harvest agricultural crop residue burning is **hypothesized** to contribute significantly to satellite thermal detections in agricultural areas without a forest canopy mask.
3. **Complex High-Altitude Terrain (Rudraprayag):** Rudraprayag exhibits lower detection sensitivity (PR-AUC 0.5158, F1 0.5253), primarily explained by its **low baseline positive rate of 11.8%** (only 43 detection days out of 365), alongside **hypothesized** steep topography and cloud shadows.
4. **Physical & Data Limitations:** Weather is sampled at one centroid per district (notably, the Uttarkashi 5023 m and Chamoli 3016 m centroids are situated above the local tree line); the binary fire target label covers the entire administrative district; no land-cover or forest-canopy mask is applied; and vegetation dryness is represented strictly by topsoil moisture (`soil_moisture_0_to_7cm_mean`) and ET0 proxies (no satellite NDVI).
