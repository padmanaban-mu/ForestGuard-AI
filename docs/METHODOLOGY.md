# ForestGuard AI: Scientific Methodology & Experimental Protocol

This document details the complete end-to-end experimental methodology, dataset construction, feature engineering, mathematical leakage audit, model selection, calibration procedure, and empirical validation results for ForestGuard AI.

---

## 1. Study Domain & Dataset Construction

### 1.1 Geographic Scope
The target region encompasses all **13 administrative districts** of the state of Uttarakhand, India, situated in the Western Himalayas (geographic bounding box: $77.6^\circ\text{E} \text{ to } 81.1^\circ\text{E}, 28.7^\circ\text{N} \text{ to } 31.5^\circ\text{N}$):
- **Montane & Alpine Districts:** Almora, Bageshwar, Chamoli, Champawat, Dehradun, Nainital, Pauri Garhwal, Pithoragarh, Rudraprayag, Tehri Garhwal, Uttarkashi.
- **Lowland Agricultural Plains:** Haridwar, Udham Singh Nagar.

District boundary polygons were sourced from the open-access [`geohacker/india`](https://github.com/geohacker/india) repository (MIT License, Copyright 2014 Sajjad Anwar), derived from [GADM](https://gadm.org/) for academic and research usage. Centroid coordinates and mean surface elevations (derived from the Open-Meteo digital elevation model) were calculated for each district.

### 1.2 Historical Weather & Reanalysis (ERA5-Land)
Daily atmospheric and terrestrial variables were extracted from the **Open-Meteo Historical Weather API** (ERA5-Land reanalysis, CC BY 4.0):
- **Temporal Horizon:** January 1, 2018 to December 31, 2024 (7 full calendar years, $N = 33,228$ district-day observations).
- **Antecedent Initialization Buffer:** October 1, 2017 to December 31, 2017 (92 days of genuine daily observations). This antecedent buffer seeds 7-day rolling averages, 30-day cumulative rainfall, and `days_since_rain` counters, preventing artificial zero-padding or warm-up distortions at the beginning of the 2018 training record.
- **Acquired Atmospheric Variables:** Daily maximum 2-meter air temperature ($^\circ\text{C}$), mean 2-meter relative humidity ($\%$), maximum 10-meter wind speed ($\text{km/h}$), daily precipitation sum ($\text{mm}$), FAO-56 Penman-Monteith reference evapotranspiration ($\text{et0}$, $\text{mm}$), and mean volumetric topsoil moisture ($0\text{--}7\text{ cm depth}$, $\text{m}^3/\text{m}^3$).

### 1.3 Ground Truth Fire Labels (NASA FIRMS VIIRS)
Ground truth active fire detections were acquired from the **NASA Fire Information for Resource Management System (FIRMS)**:
- **Satellite Instrument:** Visible Infrared Imaging Radiometer Suite (VIIRS) aboard the Suomi NPP satellite ($375\text{ m}$ nominal spatial resolution).
- **Data Series:** VIIRS SNPP 375m NRT and Country Archive for India.
- **Spatial Aggregation:** Active fire thermal anomalies were mapped to administrative districts using point-in-polygon spatial joins.
- **Binary Target Formulation ($y_{d, t+1}$):**
  A binary target indicating pre-ignition wildfire occurrence on the subsequent day ($t+1$) was constructed for each district $d$:
  $$y_{d, t+1} = \begin{cases} 1 & \text{if } \text{FIRMS detections}_{d, t+1} \ge 1 \\ 0 & \text{otherwise} \end{cases}$$
- **Zero-Leakage Causality:** Weather and environmental states observed up to day $t$ (23:59:59 local time) are paired exclusively with fire detections on day $t+1$. No same-day ($t$) or future ($>t$) fire counts are accessible to the feature extractor.

---

## 2. Feature Engineering & 33-Dimensional Feature Space

The model ingests a 33-dimensional feature vector $\mathbf{x}_{d, t}$ constructed from three complementary domains: daily/rolling weather dynamics, static spatial attributes, and climatological training anomalies.

| # | Feature Identifier | Mathematical Definition / Operational Formula | Time Lookback Window | Domain Category |
| :-: | :--- | :--- | :---: | :--- |
| **1** | `temp_max` | Daily maximum 2-meter air temperature ($^\circ\text{C}$) | $[t, t]$ | Atmospheric |
| **2** | `humidity_mean` | Daily mean 2-meter relative humidity ($\%$) | $[t, t]$ | Atmospheric |
| **3** | `wind_speed_max` | Daily maximum 10-meter wind speed ($\text{km/h}$) | $[t, t]$ | Atmospheric |
| **4** | `rain_sum` | Total daily precipitation ($\text{mm}$) | $[t, t]$ | Atmospheric |
| **5** | `et0` | FAO-56 Penman-Monteith reference evapotranspiration ($\text{mm}$) | $[t, t]$ | Terrestrial Energy |
| **6** | `soil_moisture_mean` | Topsoil volumetric moisture ($0\text{--}7\text{ cm}$, $\text{m}^3/\text{m}^3$) | $[t, t]$ | Terrestrial Moisture |
| **7** | `rain_3d` | 3-day backward precipitation accumulation: $\sum_{k=0}^{2} \text{rain}_{t-k}$ | $[t-2, t]$ | Moisture History |
| **8** | `rain_7d` | 7-day backward precipitation accumulation: $\sum_{k=0}^{6} \text{rain}_{t-k}$ | $[t-6, t]$ | Moisture History |
| **9** | `rain_30d` | 30-day backward precipitation accumulation: $\sum_{k=0}^{29} \text{rain}_{t-k}$ | $[t-29, t]$ | Moisture History |
| **10** | `days_since_rain` | Consecutive days with $\text{rain} < 1.0\text{ mm}$ (capped at 90) | $[t-89, t]$ | Fuel Desiccation |
| **11** | `temp_mean_7d` | 7-day rolling mean of daily maximum temperature: $\frac{1}{7}\sum_{k=0}^{6} \text{temp}_{t-k}$ | $[t-6, t]$ | Thermal Trend |
| **12** | `humidity_mean_7d` | 7-day rolling mean of daily relative humidity: $\frac{1}{7}\sum_{k=0}^{6} \text{humidity}_{t-k}$ | $[t-6, t]$ | Atmospheric Trend |
| **13** | `month` | Calendar month integer ($1\text{ to }12$) | $[t, t]$ | Seasonality |
| **14** | `vpd_proxy` | Vapor Pressure Deficit proxy: $e_s(T_t) \times (1 - \frac{RH_t}{100})$ | $[t, t]$ | Atmospheric Demand |
| **15** | `latitude` | District centroid latitude ($^\circ\text{N}$) | Static | Geographic Coordinate |
| **16** | `longitude` | District centroid longitude ($^\circ\text{E}$) | Static | Geographic Coordinate |
| **17** | `elevation` | District mean elevation (meters above sea level) | Static | Topography |
| **18** | `dist_almora` | Binary indicator for Almora district | Static | Geographic Spatial |
| **19** | `dist_bageshwar` | Binary indicator for Bageshwar district | Static | Geographic Spatial |
| **20** | `dist_chamoli` | Binary indicator for Chamoli district | Static | Geographic Spatial |
| **21** | `dist_champawat` | Binary indicator for Champawat district | Static | Geographic Spatial |
| **22** | `dist_dehradun` | Binary indicator for Dehradun district | Static | Geographic Spatial |
| **23** | `dist_haridwar` | Binary indicator for Haridwar district | Static | Geographic Spatial |
| **24** | `dist_nainital` | Binary indicator for Nainital district | Static | Geographic Spatial |
| **25** | `dist_pauri_garhwal` | Binary indicator for Pauri Garhwal district | Static | Geographic Spatial |
| **26** | `dist_pithoragarh` | Binary indicator for Pithoragarh district | Static | Geographic Spatial |
| **27** | `dist_rudraprayag` | Binary indicator for Rudraprayag district | Static | Geographic Spatial |
| **28** | `dist_tehri_garhwal` | Binary indicator for Tehri Garhwal district | Static | Geographic Spatial |
| **29** | `dist_udham_singh_nagar`| Binary indicator for Udham Singh Nagar district | Static | Geographic Spatial |
| **30** | `dist_uttarkashi` | Binary indicator for Uttarkashi district | Static | Geographic Spatial |
| **31** | `temp_anomaly` | $\text{temp\_max}_{d, t} - \mu_{\text{temp}}(d, \text{month}_t)$ (relative to training climatology) | Historical | Weather Anomaly |
| **32** | `humidity_anomaly` | $\text{humidity\_mean}_{d, t} - \mu_{\text{humidity}}(d, \text{month}_t)$ (relative to training climatology) | Historical | Moisture Anomaly |
| **33** | `rain_30d_anomaly` | $\text{rain\_30d}_{d, t} - \mu_{\text{rain30d}}(d, \text{month}_t)$ (relative to training climatology) | Historical | Drought Anomaly |

---

## 3. Temporal Partitioning & Leakage Audit

### 3.1 Strict Time-Based Partitioning
To model authentic operational forecasting conditions, data splitting was executed strictly along temporal boundaries:
- **Training Set (2018–2022):** 5 full years ($N = 23,738$ district-days).
- **Validation Set (2023):** 1 full year ($N = 4,745$ district-days; 685 fire days, positive prevalence $= 14.44\%$). Used exclusively for candidate model selection, probability calibration fitting, and decision threshold tuning ($\tau^*$).
- **Held-Out Test Set (2024):** 1 full year ($N = 4,745$ district-days; 1,474 fire days, positive prevalence $= 31.06\%$). Held out strictly until final model reporting.

### 3.2 Formal Zero-Leakage Verification
Temporal isolation was audited in accordance with the mathematical condition:
$$\frac{\partial X_{i, d, t}}{\partial \mathcal{O}_{\tau}} = 0 \quad \forall \tau > t$$
where $\mathcal{O}_{\tau}$ represents any observational state (atmospheric, satellite detection, or outcome) occurring on day $\tau$.

1. **Target Shifting:** Active fire counts for date $t+1$ are mapped to date $t$ weather records during dataset assembly (`ml/02_build_dataset.py`). The feature vector contains zero same-day fire indicators.
2. **Rolling Window Causality:** All sliding window features (`rain_3d`, `rain_7d`, `rain_30d`, `days_since_rain`, `temp_mean_7d`, `humidity_mean_7d`) are strictly backward-looking ($[t-k, t]$).
3. **Climatological Hygiene:** District-month means $\mu(d, m)$ utilized for anomaly features were computed strictly from the 2018–2022 training partition. No validation (2023) or test (2024) records were exposed to anomaly tables.
4. **Codebase Parity:** Training and production serving execute the identical feature generation logic defined in `ml/features.py`.

---

## 4. Model Selection, Calibration & Operational Tiers

### 4.1 Selection Criterion: Validation PR-AUC
Wildfire ignition is an imbalanced binary event (historical annual prevalence ranges from $14\%$ to $31\%$). Standard ROC-AUC can produce misleadingly high scores because the large quantity of true negative non-fire days suppresses the False Positive Rate ($FPR = FP / (FP + TN)$). In contrast, **PR-AUC (Precision-Recall Area Under Curve)** evaluates true positive ranking quality across all thresholds without being influenced by abundant negative days.

The pre-stated selection criterion was defined as:
$$\text{Maximize } \text{PR-AUC}_{\text{val}} \text{ on the held-out 2023 validation dataset.}$$

### 4.2 Candidate Architecture Comparison (Validation Year 2023)

| Candidate Model Architecture | Hyperparameters & Configuration | Val PR-AUC (Criterion) | Val ROC-AUC | Val F1 ($\tau^*$) | Val Precision | Val Recall | Selection Result |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **HistGradientBoostingClassifier** | `max_iter=100, max_depth=6, class_weight='balanced', random_state=42` | **0.6436** | **0.8524** | **0.6496** ($\tau^*=0.47$) | 56.40% | 76.60% | **SELECTED & SERVED** |
| **RandomForestClassifier** | `n_estimators=80, max_depth=10, min_samples_leaf=10, class_weight='balanced'` | 0.6289 | 0.8435 | 0.6369 ($\tau^*=0.41$) | 51.60% | 83.30% | Comparison Baseline |
| **LogisticRegression** | `StandardScaler()`, `class_weight='balanced', max_iter=1000` | 0.6203 | 0.8398 | 0.6405 ($\tau^*=0.41$) | 51.60% | 84.50% | Linear Baseline |

**Selection Finding:** Gradient Boosting achieved the highest numeric validation PR-AUC ($0.6436$), ROC-AUC ($0.8524$), and F1 score ($0.6496$), combined with sub-millisecond inference latency and native handling of tabular numerical inputs.

### 4.3 Probability Calibration & Optimal Decision Threshold ($\tau^*$)
- **Probability Calibration:** The raw base classifier produces uncalibrated pseudo-probabilities under balanced class weighting. To ensure predicted values reflect true posterior ignition probabilities, Platt sigmoid scaling was applied via `CalibratedClassifierCV(method='sigmoid')`, fitted strictly on the 2023 validation set using `PredefinedSplit`. Sigmoid scaling preserves exact ranking order (PR-AUC remains $0.6436$, ROC-AUC remains $0.8524$).
- **Optimal Decision Threshold ($\tau^*$):** The optimal classification threshold for binary fire/no-fire alerting was selected by maximizing F1 score on the calibrated validation fold:
  $$\tau^* = 0.33$$

### 4.4 Operational Risk Tiers & Monotonicity Verification
Calibrated continuous probabilities are mapped into four operational decision tiers:

$$\text{Risk Tier} = \begin{cases}
\text{Low} & p < 0.25 \\
\text{Medium} & 0.25 \le p < 0.50 \\
\text{High} & 0.50 \le p < 0.75 \\
\text{Extreme} & p \ge 0.75
\end{cases}$$

Evaluated on the held-out 2024 test year ($N = 4,745$ district-days), the operational tiers demonstrate strict empirical monotonicity:

| Risk Tier | Assigned Probability Range | 2024 Test District-Days ($N$) | 2024 Test Fire Days | Mean Predicted Probability | Observed Empirical Fire Rate |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Low** | $[0.00, 0.25)$ | 2,208 | 116 | 0.0615 ($6.15\%$) | **5.25%** |
| **Medium** | $[0.25, 0.50)$ | 849 | 271 | 0.3730 ($37.30\%$) | **31.92%** |
| **High** | $[0.50, 0.75)$ | 1,074 | 602 | 0.6220 ($62.20\%$) | **56.05%** |
| **Extreme** | $[0.75, 1.00]$ | 614 | 485 | 0.8414 ($84.14\%$) | **78.99%** |

---

## 5. Empirical Results on Held-Out Test Set (Year 2024)

### 5.1 Full Model & Baseline Comparison (All 13 Districts, $N = 4,745$)
All performance metrics were read directly from `ml/reports/metrics.json`:

| Model / Evaluation Approach | Val $\tau^*$ | Accuracy | Precision | Recall | F1 Score | PR-AUC | ROC-AUC | Description / Purpose |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **ForestGuard Served Model (Calibrated GB)** | **0.33** | **75.89%** | **57.28%** | **88.06%** | **0.6941** | **0.7094** | **0.8731** | **Operational Serving Pipeline** |
| **Random Forest (Full Features)** | 0.26 | 72.48% | 53.38% | 90.09% | 0.6704 | 0.7152 | 0.8653 | Ensemble Comparison Model |
| **Climatology (District + Month Lookup)** | 0.22 | 74.10% | 54.99% | 91.66% | 0.6874 | 0.6526 | 0.8465 | Geographic & Calendar Baseline |
| **Logistic Regression (Baseline)** | 0.42 | 72.77% | 53.63% | 91.32% | 0.6757 | 0.6768 | 0.8553 | Linear Comparison Baseline |
| **Random Forest (Weather-Only Baseline)** | 0.21 | 70.22% | 51.12% | 94.44% | 0.6633 | 0.6954 | 0.8560 | Spatial Ablation (No District Features) |
| **Climatology (Month Only Lookup)** | 0.21 | 65.10% | 46.70% | 87.31% | 0.6085 | 0.5720 | 0.7907 | Calendar Baseline (Statewide) |
| **Rule-Based FWI / Drought Proxy** | 0.0017 | 64.62% | 45.98% | 79.44% | 0.5824 | 0.5303 | 0.7225 | Weak Heuristic Drought Baseline |

### 5.2 2024 Confusion Matrix Verification
Comparison between the Served Gradient Boosting model ($\tau^* = 0.33$) and the Climatology Lookup baseline ($\tau^* = 0.22$):

| Metric | District + Month Climatology Lookup | ForestGuard Served Model | Difference ($\Delta$) |
| :--- | :---: | :---: | :---: |
| **Decision Threshold ($\tau^*$)** | 0.22 | 0.33 | +0.11 |
| **True Negatives ($TN$)** | 2,165 | 2,303 | +138 (138 fewer false alarms) |
| **False Positives ($FP$)** | 1,106 | 968 | -138 (reduced false positive burden) |
| **False Negatives ($FN$)** | 123 | 176 | +53 |
| **True Positives ($TP$)** | 1,351 | 1,298 | -53 |
| **Total Correct Predictions ($TN + TP$)** | 3,516 / 4,745 | **3,601 / 4,745** | **+85 additional correct days** |
| **Accuracy** | 74.10% | **75.89%** | +1.79 percentage points |
| **Precision** | 54.99% | **57.28%** | +2.29 percentage points |
| **Recall** | 91.66% | **88.06%** | -3.60 percentage points |
| **F1 Score** | 0.6874 | **0.6941** | +0.0067 |

### 5.3 Weekly Block Bootstrap Statistical Significance
To account for temporal autocorrelation in weather time series, statistical significance was evaluated using **weekly block bootstrapping** (52 ISO week clusters, $B = 1,000$ resamples) comparing the Served Model against the District + Month Climatology Lookup:
- **$\Delta\text{PR-AUC}$ Mean Difference:** $+0.0585$
- **$\Delta\text{PR-AUC}$ 95% Confidence Interval:** `[-0.0277, 0.1368]` ($\text{Statistically Significant: False}$)
- **$\Delta\text{ROC-AUC}$ Mean Difference:** $+0.0267$
- **$\Delta\text{ROC-AUC}$ 95% Confidence Interval:** `[-0.0085, 0.0631]` ($\text{Statistically Significant: False}$)

**Statistical Finding:** Because both 95% confidence intervals cross zero, the ranking improvement over the geographic-monthly lookup baseline is modest and not statistically significant. This confirms that calendar timing and district geography explain the bulk of baseline risk, while daily weather dynamics provide fine-grained day-to-day risk modulation.

### 5.4 Walk-Forward Rolling-Origin Evaluation (2021–2024)
To demonstrate temporal generalizability, rolling-origin walk-forward evaluation was conducted across 4 successive test folds. Climatology lookup tables and anomaly baselines were recomputed dynamically using **strictly earlier training years** for each fold:

| Test Year | Training Partition | Validation Year | Test Fire Prevalence | Served Model PR-AUC | Lookup PR-AUC | Delta PR-AUC | Served Model ROC-AUC | Lookup ROC-AUC | Delta ROC-AUC |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **2021** | 2018–2019 (2 yrs) | 2020 | 27.69% | 0.7901 | 0.5064 | **+0.2837** | 0.9203 | 0.8128 | **+0.1075** |
| **2022** | 2018–2020 (3 yrs) | 2021 | 26.03% | 0.7487 | 0.5297 | **+0.2190** | 0.8960 | 0.7983 | **+0.0976** |
| **2023** | 2018–2021 (4 yrs) | 2022 | 27.84% | 0.6468 | 0.5248 | **+0.1220** | 0.8479 | 0.7909 | **+0.0570** |
| **2024** | 2018–2022 (5 yrs) | 2023 | 31.06% | 0.7094 | 0.6526 | **+0.0567** | 0.8731 | 0.8465 | **+0.0267** |

- **4-Year Mean Served Model PR-AUC:** $0.7238 \pm 0.0528$ (Lookup: $0.5534 \pm 0.0580$, Mean $\Delta\text{PR-AUC} = +0.1704 \pm 0.0873$).
- **4-Year Mean Served Model ROC-AUC:** $0.8843 \pm 0.0269$ (Lookup: $0.8121 \pm 0.0213$, Mean $\Delta\text{ROC-AUC} = +0.0722 \pm 0.0324$).

### 5.5 Per-District Breakdown (Test Year 2024)

| District Name | Terrain Classification | Test Days | Fire Days | Positive Rate | Precision | Recall | F1 Score | PR-AUC | ROC-AUC |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Nainital** | Hills / Forest | 365 | 148 | 40.55% | 71.28% | 90.54% | **0.7976** | **0.8398** | **0.9039** |
| **Pauri Garhwal** | Hills / Forest | 365 | 130 | 35.62% | 60.87% | 96.92% | **0.7478** | **0.8069** | **0.9089** |
| **Udham Singh Nagar** | Plains / Agricultural | 365 | 173 | 47.40% | 67.33% | 97.69% | **0.7972** | **0.7752** | 0.8389 |
| **Almora** | Hills / Forest | 365 | 137 | 37.53% | 66.32% | 91.97% | **0.7706** | **0.7718** | 0.8805 |
| **Tehri Garhwal** | Hills / Forest | 365 | 129 | 35.34% | 64.57% | 87.60% | **0.7434** | **0.7654** | 0.8951 |
| **Uttarkashi** | Hills / Forest | 365 | 136 | 37.26% | 57.95% | 83.09% | 0.6828 | 0.6981 | 0.8110 |
| **Champawat** | Hills / Forest | 365 | 76 | 20.82% | 50.41% | 81.58% | 0.6231 | 0.6774 | **0.9056** |
| **Pithoragarh** | Hills / Forest | 365 | 95 | 26.03% | 50.88% | 91.58% | 0.6541 | 0.6594 | 0.8827 |
| **Chamoli** | Hills / Forest | 365 | 113 | 30.96% | 52.94% | 87.61% | 0.6600 | 0.6398 | 0.8399 |
| **Dehradun** | Hills / Forest | 365 | 109 | 29.86% | 55.93% | 90.83% | 0.6923 | 0.6146 | 0.8598 |
| **Bageshwar** | Hills / Forest | 365 | 95 | 26.03% | 53.85% | 81.05% | 0.6471 | 0.6092 | 0.8675 |
| **Rudraprayag** | Hills / Forest | 365 | 43 | 11.78% | 46.43% | 60.47% | 0.5253 | 0.5158 | 0.8660 |
| **Haridwar** | Plains / Agricultural | 365 | 90 | 24.66% | 33.00% | 74.44% | 0.4573 | 0.4093 | 0.6954 |

---

## 6. Weather Source Mismatch Audit: ERA5 Reanalysis vs Operational Forecast

During training and offline evaluation, the model ingests ERA5-Land reanalysis observations. In production, real-time serving queries the **Open-Meteo Weather Forecast API**. To quantify domain shift, genuine numerical weather forecasts were retrieved from the Open-Meteo Historical Forecast API for the peak 2024 wildfire season:
- **Evaluation Window:** March 1, 2024 to June 30, 2024 ($N = 1,586$ district-days across all 13 districts).
- **Target Ground Truth:** Authenticated NASA FIRMS active fire detections on day $t+1$ (positive rate: $52.71\%$, 836 fire days).
- **Correlation & Agreement:**
  - Pearson correlation ($r$): **0.9943**
  - Spearman rank correlation ($\rho$): **0.9945**
  - Categorical risk tier agreement: **93.69%**
  - Mean absolute difference in probability: **0.0168**
- **Ranking Comparison:**
  - ERA5 Archive: PR-AUC $= 0.7409$, ROC-AUC $= 0.7553$
  - Operational Forecast: PR-AUC $= 0.7435$, ROC-AUC $= 0.7557$
  - Domain Shift Delta ($\Delta$): **+0.0026 PR-AUC** / **+0.0004 ROC-AUC**
- **Domain Shift Conclusion:** The transition from observational reanalysis to numerical weather prediction introduces zero degradation in ranking quality or operational categorization.

---

## 7. Limitations & Engineering Honesty

1. **Modest Gain Over Geographic-Calendar Climatology:** On the primary 2024 test year, the PR-AUC improvement over the district+month lookup table is $+0.0567$ (0.7094 vs 0.6526). In weekly block bootstrap testing, the 95% confidence interval spans `[-0.0277, 0.1368]`, confirming that the gain is modest and not statistically significant. Baseline geographic location and broad seasonal timing explain the majority of predictive skill.
2. **Agricultural Residue Burning Confounding in Plains:** In lowland plains districts (**Haridwar** and **Udham Singh Nagar**), post-harvest crop residue burning is detected by VIIRS sensors, elevating positive detection rates without a land-cover forest canopy mask.
3. **Centroid Weather Representation:** Weather variables are sampled at a single centroid coordinate per district. In steep Himalayan topography (e.g., Chamoli and Uttarkashi), localized microclimates and valley inversions are not resolved.
4. **Proxy Vegetation Representation (No Satellite NDVI):** Satellite NDVI was omitted from the ML feature set due to frequent cloud cover gaps in mountain regions. Vegetation dryness is represented through physical proxies: topsoil volumetric moisture ($0\text{--}7\text{ cm}$) and reference evapotranspiration (ET0).
5. **Operational Lead Time Uncertainty (Days 3–7):** The ML model was trained and validated on day-ahead ($t+1$) horizons. In production serving, days 3–7 rely on operational numerical weather predictions whose skill degrades with lead time. These forecasts carry advisory warnings.
6. **Single Primary Held-Out Test Year:** Primary benchmarking is conducted on the 2024 calendar year ($N = 4,745$), supported by 4-year rolling-origin walk-forward validation (2021–2024).
