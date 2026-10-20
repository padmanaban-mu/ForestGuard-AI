# ForestGuard AI: Official Report Numbers & Verification Sheet

> **Live demo:** `<PASTE YOUR RENDER URL>`  
> This reference page provides verified numeric figures for project documentation, thesis defense, and academic reports. Every value is cited with its exact source file and JSON/Markdown reference. No numbers are unsourced or approximated.

---

## 1. Study Domain & Dataset Partitions

| Parameter / Metric | Exact Value | Source File Reference |
| :--- | :---: | :--- |
| **Geographic Target Region** | Uttarakhand, India (13 Districts) | `.agent/rules/forestguard.md:3`, `ml/reports/model_selection.md:9` |
| **Bounding Box** | $77.6^\circ\text{E} \text{ to } 81.1^\circ\text{E}, 28.7^\circ\text{N} \text{ to } 31.5^\circ\text{N}$ | `.agent/rules/forestguard.md:3`, `ml/reports/leakage_audit.md` |
| **Total Study Observations (2018–2024)** | **33,228** district-days | `ml/reports/model_selection.md:11-14` |
| **Training Partition (2018–2022)** | **23,738** district-days (5 years) | `ml/reports/model_selection.md:11` |
| **Antecedent Lookback Buffer** | **92** days (2017-10-01 to 2017-12-31) | `ml/reports/model_selection.md:12` |
| **Validation Partition (2023)** | **4,745** district-days (685 fire days, 14.44% prevalence) | `ml/reports/model_selection.md:13`, `ml/reports/metrics.json:237` |
| **Held-Out Test Partition (2024)** | **4,745** district-days (1,474 fire days, 31.06% prevalence) | `ml/reports/metrics.json:250-251` |
| **Total Feature Vector Dimension** | **33** features | `ml/reports/metrics.json:6` |
| **Atmospheric & Rolling Weather Features** | **14** features | `ml/reports/metrics.json:8-21` |
| **Static Spatial & Coordinate Features** | **16** features (13 districts, lat, lon, elevation) | `ml/reports/metrics.json:22-37` |
| **Climatological Anomaly Features** | **3** features (temp, humidity, rain_30d) | `ml/reports/metrics.json:38-40` |

---

## 2. Model Selection on 2023 Validation Set ($N = 4,745$)

**Selection Criterion:** Highest Validation PR-AUC on held-out 2023 validation set (`ml/reports/metrics.json:57`).

| Candidate Model | Val PR-AUC (Selection Metric) | Val ROC-AUC | Val F1 ($\tau^*$) | Val Precision | Val Recall | Selection Decision | Source File Reference |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Gradient Boosting (Raw)** | **0.6436** | **0.8524** | **0.6496** ($\tau^*=0.47$) | 56.40% | 76.60% | **SELECTED & SERVED** | `ml/reports/metrics.json:58-60`, `model_selection.md:31` |
| **Random Forest** | 0.6289 | 0.8435 | 0.6369 ($\tau^*=0.41$) | 51.60% | 83.30% | Comparison Baseline | `ml/reports/model_selection.md:32` |
| **Logistic Regression** | 0.6203 | 0.8398 | 0.6405 ($\tau^*=0.41$) | 51.60% | 84.50% | Linear Baseline | `ml/reports/model_selection.md:33` |

### Production Pipeline Calibration Details
- **Served Architecture:** `CalibratedClassifierCV(HistGradientBoostingClassifier, method='sigmoid')` (`ml/reports/metrics.json:4`).
- **Optimal Decision Threshold ($\tau^*$):** `0.33` tuned on 2023 validation set (`ml/reports/metrics.json:42`).
- **Calibrated Pipeline Validation Metrics ($\tau = 0.50$):** F1 = `0.6417`, Precision = `57.41%`, Recall = `72.75%`, PR-AUC = `0.6436`, ROC-AUC = `0.8524` (`ml/reports/model_selection.md:40`).

---

## 3. Held-Out 2024 Test Performance ($N = 4,745$, 1,474 Fire Days)

### 3.1 Model Comparison Table

| Model / Evaluation Approach | Val $\tau^*$ | Accuracy | Precision | Recall | F1 Score | PR-AUC | ROC-AUC | Source Key in `ml/reports/metrics.json` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **ForestGuard Served Model (Calibrated GB)** | **0.33** | **75.89%** | **57.28%** | **88.06%** | **0.6941** | **0.7094** | **0.8731** | `fair_metrics_2024["ForestGuard Served Model..."]` (lines 172–182) |
| **Random Forest (Full Features)** | 0.26 | 72.48% | 53.38% | 90.09% | 0.6704 | 0.7152 | 0.8653 | `fair_metrics_2024["...Random Forest (Full...)"]` (lines 161–171) |
| **Climatology (District + Month Lookup)** | 0.22 | 74.10% | 54.99% | 91.66% | 0.6874 | 0.6526 | 0.8465 | `fair_metrics_2024["Climatology (District + Month)"]` (lines 128–138) |
| **Logistic Regression (Baseline)** | 0.42 | 72.77% | 53.63% | 91.32% | 0.6757 | 0.6768 | 0.8553 | `fair_metrics_2024["Logistic Regression (Baseline)"]` (lines 139–149) |
| **Random Forest (Weather-Only Baseline)** | 0.21 | 70.22% | 51.12% | 94.44% | 0.6633 | 0.6954 | 0.8560 | `fair_metrics_2024["...Random Forest (Weather-Only...)"]` (lines 150–160) |
| **Climatology (Month Only Lookup)** | 0.21 | 65.10% | 46.70% | 87.31% | 0.6085 | 0.5720 | 0.7907 | `fair_metrics_2024["Climatology (Month Only)"]` (lines 117–127) |
| **Rule-Based FWI / Drought Proxy** | 0.0017 | 64.62% | 45.98% | 79.44% | 0.5824 | 0.5303 | 0.7225 | `fair_metrics_2024["Rule-Based FWI / Drought Proxy"]` (lines 104–116) |

### 3.2 2024 Confusion Matrix Counts ($N = 4,745$)

| Approach | $\tau^*$ | True Neg ($TN$) | False Pos ($FP$) | False Neg ($FN$) | True Pos ($TP$) | Total Correct | Source in `metrics.json` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Climatology Lookup** | 0.22 | 2,165 | 1,106 | 123 | 1,351 | **3,516** (74.10%) | `confusion_matrix_verification.climatology_lookup` (lines 82–91) |
| **Served Gradient Boosting** | 0.33 | 2,303 | 968 | 176 | 1,298 | **3,601** (75.89%) | `confusion_matrix_verification.served_gradient_boosting` (lines 92–101) |

---

## 4. Statistical Significance & Bootstrapping (52 Blocks, $B = 1,000$)

| Metric / Parameter | Exact Value | Source in `metrics.json` |
| :--- | :---: | :--- |
| **Resample Iterations ($B$) / Blocks** | 1,000 resamples / 52 ISO weekly blocks | `weekly_block_bootstrap.n_bootstrap` / `n_blocks` (lines 274–275) |
| **Served Model PR-AUC 95% CI** | `[0.5886, 0.8050]` | `weekly_block_bootstrap.model_pr_auc_ci` (lines 276–279) |
| **Climatology Lookup PR-AUC 95% CI**| `[0.5632, 0.7320]` | `weekly_block_bootstrap.clim_pr_auc_ci` (lines 280–283) |
| **$\Delta\text{PR-AUC}$ Mean Difference** | **+0.0585** | `weekly_block_bootstrap.diff_pr_auc_mean` (line 300) |
| **$\Delta\text{PR-AUC}$ 95% Confidence Interval** | `[-0.0277, 0.1368]` | `weekly_block_bootstrap.diff_pr_auc_ci` (lines 284–287) |
| **PR-AUC Statistically Significant?** | **false** (Interval crosses zero) | `weekly_block_bootstrap.pr_auc_significant` (line 302) |
| **$\Delta\text{ROC-AUC}$ Mean Difference** | **+0.0267** | `weekly_block_bootstrap.diff_roc_auc_mean` (line 301) |
| **$\Delta\text{ROC-AUC}$ 95% Confidence Interval**| `[-0.0085, 0.0631]` | `weekly_block_bootstrap.diff_roc_auc_ci` (lines 296–299) |
| **ROC-AUC Statistically Significant?**| **false** (Interval crosses zero) | `weekly_block_bootstrap.roc_auc_significant` (line 303) |

---

## 5. Operational Risk Tier Monotonicity (Test Year 2024)

Source: `ml/reports/metrics.json:risk_level_validation.served_model_levels` (lines 306–335).

| Operational Risk Tier | Threshold Range | Days ($N$) | Observed Fire Days | Mean Predicted Probability | Observed Empirical Fire Rate |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Low** | $[0.00, 0.25)$ | 2,208 | 116 | 0.0615 ($6.15\%$) | **5.25%** |
| **Medium** | $[0.25, 0.50)$ | 849 | 271 | 0.3730 ($37.30\%$) | **31.92%** |
| **High** | $[0.50, 0.75)$ | 1,074 | 602 | 0.6220 ($62.20\%$) | **56.05%** |
| **Extreme** | $[0.75, 1.00]$ | 614 | 485 | 0.8414 ($84.14\%$) | **78.99%** |

---

## 6. Walk-Forward Rolling-Origin Evaluation (2021–2024)

Source: `ml/reports/metrics.json:rolling_origin_summary` (lines 195–272).

| Fold Test Year | Train Years | Val Year | Test Fire Prev | Served PR-AUC | Lookup PR-AUC | $\Delta\text{PR-AUC}$ | Served ROC-AUC | Lookup ROC-AUC | $\Delta\text{ROC-AUC}$ |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **2021** | 2018–2019 (2 yrs) | 2020 | 27.69% | 0.7901 | 0.5064 | **+0.2837** | 0.9203 | 0.8128 | **+0.1075** |
| **2022** | 2018–2020 (3 yrs) | 2021 | 26.03% | 0.7487 | 0.5297 | **+0.2190** | 0.8960 | 0.7983 | **+0.0976** |
| **2023** | 2018–2021 (4 yrs) | 2022 | 27.84% | 0.6468 | 0.5248 | **+0.1220** | 0.8479 | 0.7909 | **+0.0570** |
| **2024** | 2018–2022 (5 yrs) | 2023 | 31.06% | 0.7094 | 0.6526 | **+0.0567** | 0.8731 | 0.8465 | **+0.0267** |
| **4-Year Mean** | — | — | — | **0.7238** | **0.5534** | **+0.1704** | **0.8843** | **0.8121** | **+0.0722** |
| **4-Year Std** | — | — | — | $\pm 0.0528$ | $\pm 0.0580$ | $\pm 0.0873$ | $\pm 0.0269$ | $\pm 0.0213$ | $\pm 0.0324$ |

---

## 7. Weather Source Mismatch Audit (ERA5 vs Operational Forecast)

Source: `ml/reports/forecast_vs_era5.md` (Peak Fire Season: March 1 – June 30, 2024, $N = 1,586$ district-days).

| Evaluation Parameter | Exact Value | Source in `forecast_vs_era5.md` |
| :--- | :---: | :--- |
| **Fire Days / Positive Fire Rate** | 836 days / 52.71% | lines 5–6 |
| **Pearson Correlation ($r$)** | **0.9943** | line 23 |
| **Spearman Rank Correlation ($\rho$)** | **0.9945** | line 24 |
| **Categorical Risk Tier Agreement** | **93.69%** | line 25 |
| **Mean Absolute Probability Difference** | **0.0168** | line 26 |
| **ERA5 Archive PR-AUC / ROC-AUC** | 0.7409 / 0.7553 | line 36 |
| **Operational Forecast PR-AUC / ROC-AUC** | 0.7435 / 0.7557 | line 37 |
| **Domain Shift Delta ($\Delta$)** | **+0.0026 PR-AUC** / **+0.0004 ROC-AUC** | line 38 |

---

## 8. Per-District Test 2024 Metrics ($N = 365$ days each)

Source: `ml/reports/metrics.json:per_district_summary` (lines 367–524).

| District | Terrain Class | Fire Days | Positive Rate | Precision | Recall | F1 Score | PR-AUC | ROC-AUC |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Nainital** | Hills / Forest | 148 | 40.55% | 71.28% | 90.54% | **0.7976** | **0.8398** | **0.9039** |
| **Pauri Garhwal** | Hills / Forest | 130 | 35.62% | 60.87% | 96.92% | **0.7478** | **0.8069** | **0.9089** |
| **Udham Singh Nagar** | Plains / Agricultural | 173 | 47.40% | 67.33% | 97.69% | **0.7972** | **0.7752** | 0.8389 |
| **Almora** | Hills / Forest | 137 | 37.53% | 66.32% | 91.97% | **0.7706** | **0.7718** | 0.8805 |
| **Tehri Garhwal** | Hills / Forest | 129 | 35.34% | 64.57% | 87.60% | **0.7434** | **0.7654** | 0.8951 |
| **Uttarkashi** | Hills / Forest | 136 | 37.26% | 57.95% | 83.09% | 0.6828 | 0.6981 | 0.8110 |
| **Champawat** | Hills / Forest | 76 | 20.82% | 50.41% | 81.58% | 0.6231 | 0.6774 | **0.9056** |
| **Pithoragarh** | Hills / Forest | 95 | 26.03% | 50.88% | 91.58% | 0.6541 | 0.6594 | 0.8827 |
| **Chamoli** | Hills / Forest | 113 | 30.96% | 52.94% | 87.61% | 0.6600 | 0.6398 | 0.8399 |
| **Dehradun** | Hills / Forest | 109 | 29.86% | 55.93% | 90.83% | 0.6923 | 0.6146 | 0.8598 |
| **Bageshwar** | Hills / Forest | 95 | 26.03% | 53.85% | 81.05% | 0.6471 | 0.6092 | 0.8675 |
| **Rudraprayag** | Hills / Forest | 43 | 11.78% | 46.43% | 60.47% | 0.5253 | 0.5158 | 0.8660 |
| **Haridwar** | Plains / Agricultural | 90 | 24.66% | 33.00% | 74.44% | 0.4573 | 0.4093 | 0.6954 |
