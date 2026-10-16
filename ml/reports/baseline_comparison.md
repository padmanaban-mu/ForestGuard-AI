# Model Performance & Baseline Comparison

Evaluated on held-out test year **2024** across all 13 Uttarakhand districts (4,745 district-day observations).
All decision thresholds (tau*) were tuned strictly by maximizing F1 on the **2023 validation year**. PR-AUC and ROC-AUC evaluate ranking performance across continuous probability distributions without threshold dependency.

## 1. Full Baselines & Model Comparison Table (All 13 Districts)

| Model / Approach | Val tau* | Accuracy | Precision | Recall | F1 Score | PR-AUC | ROC-AUC | Selection Role |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Rule-Based FWI / Drought Proxy** | 0.0017 (q=50%) | 64.6% | 46.0% | 79.4% | 0.5824 | 0.5303 | 0.7225 | Weak Heuristic (Pred Pos: 53.7%) |
| **Climatology (Month Rate Only)** | 0.21 | 65.1% | 46.7% | 87.3% | 0.6085 | 0.5720 | 0.7907 | Calendar Baseline |
| **Climatology (District + Month Rate)** | **0.22** | **74.1%** | **55.0%** | 91.7% | **0.6874** | 0.6526 | 0.8465 | Geographic + Calendar Baseline |
| **Logistic Regression (Baseline)** | 0.42 | 72.8% | 53.6% | 91.3% | 0.6757 | 0.6768 | 0.8553 | Linear Baseline |
| **Random Forest (Weather-Only Baseline)** | 0.21 | 70.2% | 51.1% | 94.4% | 0.6633 | 0.6954 | 0.8560 | Ablation (No Location) |
| **Random Forest (Full Location & Soil)** | 0.26 | 72.5% | 53.4% | 90.1% | 0.6704 | 0.7152 | 0.8653 | Ensemble Comparison Row |
| **ForestGuard Served Model (Calibrated Gradient Boosting)** | **0.33** | **75.9%** | **57.3%** | 88.1% | **0.6941** | **0.7094** | **0.8731** | **SERVED IN PRODUCTION** |
| **Deep Non-Seasonal Weather Ablation** | 0.33 | 70.1% | 51.2% | 85.1% | 0.6392 | 0.6164 | 0.8144 | Physics Stress Test |

- **FWI Proxy Baseline:** The Rule-Based FWI / Drought Proxy is a weak heuristic that predicts positive on **53.7%** of days (at its 50th percentile training threshold), with low precision (**46.0%**) and modest ranking skill (PR-AUC 0.5303).

---

## 2. Reporting Honesty: Climatology Lookup vs Served Model

### Confusion Matrix Breakdown (Test Year 2024, N = 4,745)
At their respective validation-tuned thresholds, both approaches yield:

| Model | Decision Threshold (tau*) | True Neg (TN) | False Pos (FP) | False Neg (FN) | True Pos (TP) | Total Correct (TN+TP) | Accuracy | Precision | Recall | F1 Score |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **District+Month Climatology** | 0.22 | 2,165 | 1,106 | 123 | 1,351 | **3,516** / 4,745 | **74.099%** | **54.986%** | 91.7% | **0.6874** |
| **Served Model (Calibrated Gradient Boosting)** | 0.33 | 2,303 | 968 | 176 | 1,298 | **3,601** / 4,745 | **75.890%** | **57.282%** | 88.1% | **0.6941** |

- **Operating Comparison:** At tau* = 0.33, the served model correctly classifies **3,601** out of 4,745 district-days (75.9% accuracy, 57.3% precision, 88.1% recall, F1 = 0.6941), while the Climatology lookup at tau* = 0.22 correctly classifies **3,516** out of 4,745 district-days (74.1% accuracy, 55.0% precision, 91.7% recall, F1 = 0.6874).
- **Verification:** Both models demonstrate strong classification performance, with the served model reducing false positives from 1,106 down to 968 (138 fewer false alarms).

### Reconciliation of the Three Gain Figures
1. **Headline Test Set Delta:** +0.0567 (Served Model PR-AUC 0.7094 vs Climatology Lookup 0.6526).
2. **Walk-Forward Fold 2024 Delta:** +0.0567 (reproduces the served model test metrics).
3. **Weekly Block Bootstrap Mean Delta (52 ISO Weeks, B = 1,000):** +0.0585 (95% CI: `[-0.0277, 0.1368]`).
- **Statistical Finding:** Because the 95% confidence interval for Delta PR-AUC crosses zero (`[-0.0277, 0.1368]`), **this ranking improvement is modest and not statistically significant**.
- Seasonal timing and geographic base rates explain the vast majority of predictive skill, while daily weather and moisture provide fine-grained day-to-day risk modulation.

### Explanation of Variations Between Runs
- **Deep Ablation Variation:** In Phase 2.5, Deep Ablation was trained using `RandomForestClassifier` (Acc 67.9%, F1 0.6369, PR-AUC 0.6192). In Phase 2.6, it was switched to `HistGradientBoostingClassifier` to match the served model family (Acc 68.3%, F1 0.6355, PR-AUC 0.6191).
- **Random Forest (Full) Threshold Variation:** In Phase 2.5, the validation threshold was selected over a coarse linear grid `linspace(0.01, 0.99, 99)` (tau* = 0.23, F1 0.6681). In Phase 2.6, empirical validation quantiles were added to the threshold search, selecting tau* = 0.24 (F1 0.6687).

---

## 3. Leakage-Free Rolling-Origin Evaluation (2021-2024)

Climatology tables and anomaly features were recomputed dynamically using **strictly earlier training years** for each walk-forward fold:

| Test Year | Training Years Available | Validation Year | Test Fire Prevalence | Served Model PR-AUC | Lookup PR-AUC | Delta PR-AUC | Served Model ROC-AUC | Lookup ROC-AUC | Delta ROC-AUC |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **2021** | 2018-2019 (2 years) | 2020 | 27.7% | 0.7901 | 0.5064 | **+0.2837** | 0.9203 | 0.8128 | **+0.1075** |
| **2022** | 2018-2020 (3 years) | 2021 | 26.0% | 0.7487 | 0.5297 | **+0.2190** | 0.8960 | 0.7983 | **+0.0976** |
| **2023** | 2018-2021 (4 years) | 2022 | 27.8% | 0.6468 | 0.5248 | **+0.1220** | 0.8479 | 0.7909 | **+0.0570** |
| **2024 (Headline)** | 2018-2022 (5 years) | 2023 | 31.1% | 0.7094 | 0.6526 | **+0.0567** | 0.8731 | 0.8465 | **+0.0267** |

> [!NOTE]
> Earlier test folds had fewer historical training years, making their climatology estimates more sensitive to single-year anomalies. Year 2024 serves as the headline test benchmark with 5 years of preceding training history.

---

## 4. Operational Risk Level Calibration (Served Model vs Lookup Baseline)

| Operational Risk Level | Probability Range | Served Model Days (N) | Served Observed Fire Rate | Lookup Days (N) | Lookup Observed Fire Rate | Monotonicity Check |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Low** | < 0.25 | 2208 | **5.2%** | 2408 | **6.5%** | Both Strictly Monotonic |
| **Medium** | 0.25 - 0.50 | 849 | **31.9%** | 1669 | **51.6%** | Both Strictly Monotonic |
| **High** | 0.50 - 0.75 | 1074 | **56.0%** | 577 | **66.9%** | Both Strictly Monotonic |
| **Extreme** | >= 0.75 | 614 | **79.0%** | 91 | **76.9%** | Both Strictly Monotonic |

- Both the Served Model and the Lookup Baseline produce **strictly monotonic** observed ignition frequencies across risk tiers.
- Calibration diagrams are saved at `ml/reports/calibration_reliability.png`.

---

## 5. Critical Limitations & Hypotheses

1. **Absence of Land-Cover Forest Mask:**
   Target labels are constructed from all NASA FIRMS VIIRS active fire detections within administrative district boundaries. No land-use or forest canopy mask was applied.
2. **Agricultural Burning Hypothesis in Plains:**
   In southern lowland districts (**Haridwar** PR-AUC 0.4093 and **Udham Singh Nagar** 47.4% positive rate), seasonal crop residue burning is **hypothesized** to contribute significantly to satellite thermal detections in agricultural areas without a forest canopy mask.
3. **Complex High-Altitude Terrain (Rudraprayag):**
   Rudraprayag exhibits lower sensitivity and detection rates (PR-AUC 0.5158, F1 0.5253), primarily explained by its **low baseline positive rate of 11.8%** (only 43 detection days out of 365), alongside **hypothesized** steep topography and cloud shadows.
4. **Vegetation Representation:**
   Vegetation dryness is represented strictly by topsoil volumetric moisture (`soil_moisture_0_to_7cm_mean`) and FAO-56 Penman-Monteith reference evapotranspiration (`et0`) proxies from ERA5-Land/Open-Meteo. Satellite NDVI is not ingested.

---

## 6. Data Attribution & Licensing Terms

- **District Boundary Geometries:** [`geohacker/india`](https://github.com/geohacker/india) (Author: Sajjad Anwar).
  - **Repository Code:** Licensed under **The MIT License (MIT)**, Copyright (c) 2014 Sajjad Anwar.
  - **Geographic Data:** Derived from **GADM** (`gadm.org`), free for **academic, research, and other non-commercial use**.
- **Historical Weather Data:** [Open-Meteo Historical Weather API](https://open-meteo.com/) (Open Data, CC BY 4.0). Includes volumetric soil moisture and elevation.
- **Active Fire Observations:** [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) (VIIRS SNPP Near Real-Time & Country Archive).
