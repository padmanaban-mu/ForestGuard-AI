# Model Selection Record & Architecture Decision

This document records the model evaluation, pre-stated selection criterion, and architecture decision for the ForestGuard AI production fire risk prediction system.

---

## 1. Experimental Protocol & Selection Hygiene

- **Region:** Uttarakhand, India (all 13 administrative districts).
- **Temporal Partitioning:**
  - **Training Years:** 2018–2022 (5 years, 23,738 district-day observations).
  - **Antecedent Weather Buffer:** 2017-10-01 to 2017-12-31 (92 days of genuine ERA5 observations, eliminating artificial warm-up seeds).
  - **Validation Year:** 2023 (1 year, 4,745 district-day observations; 685 fire days, 14.4% prevalence).
  - **Test Year:** 2024 (1 year, 4,745 district-day observations; strictly held out for final reporting).
- **Candidate Feature Set:** All candidate models were evaluated on the **identical 33-feature representation** (14 weather/moisture features, 16 static location features, and 3 training climatology anomaly features).

### Pre-Stated Selection Criterion
The single pre-stated selection criterion is **Validation PR-AUC (Precision-Recall Area Under Curve)** on the held-out 2023 validation year.

**Scientific Justification for PR-AUC:**
In wildfire risk forecasting, ignition days are relatively rare (~15%–25% positive rate). Standard ROC-AUC can present an overly optimistic assessment because the abundance of non-fire days (true negatives) depresses the False Positive Rate ($FPR = \frac{FP}{FP + TN}$). In contrast, PR-AUC focuses directly on Precision ($\frac{TP}{TP + FP}$) and Recall ($\frac{TP}{TP + FN}$), evaluating the model's true positive ranking quality across all operating thresholds without being dominated by easy negative days. Furthermore, unlike F1-score which requires fixing an arbitrary decision threshold $\tau$, PR-AUC is threshold-free.

---

## 2. Validation Results on Candidate Models (Year 2023, N = 4,745)

All candidates were trained exclusively on 2018–2022 data and evaluated on 2023 validation data:

| Candidate Architecture | Implementation Details | Val PR-AUC (Selection Metric) | Val ROC-AUC | Val F1 ($\tau^*$) | Val Precision | Val Recall | Selection Decision |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Gradient Boosting (Raw)** | `HistGradientBoostingClassifier(max_iter=100, max_depth=6, class_weight="balanced", random_state=42)` | **0.6436** | **0.8524** | **0.6496** ($\tau^*=0.47$) | 56.4% | 76.6% | **SELECTED & SERVED** |
| **Random Forest** | `RandomForestClassifier(n_estimators=80, max_depth=10, min_samples_leaf=10, class_weight="balanced", random_state=42)` | 0.6289 | 0.8435 | 0.6369 ($\tau^*=0.41$) | 51.6% | 83.3% | Baseline Comparison |
| **Logistic Regression** | `StandardScaler()` + `LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)` | 0.6203 | 0.8398 | 0.6405 ($\tau^*=0.41$) | 51.6% | 84.5% | Linear Baseline |

### Metrics Reconciliation: Raw Model ($\tau^* = 0.47$) vs Calibrated Served Pipeline ($\tau = 0.50$)

| Model Version & Operating Threshold | F1 Score | Precision | Recall | PR-AUC | ROC-AUC | Source / Context |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Raw Base Model** ($\tau^* = 0.47$) | **0.6496** | 56.40% | 76.60% | 0.6436 | 0.8524 | Architecture selection benchmark in Table 2 above. |
| **Calibrated Pipeline** ($\tau = 0.50$) | **0.6417** | 57.41% | 72.75% | 0.6436 | 0.8524 | Serialized in `risk_model.joblib` bundle (`/model/metrics`). |

- **Explanation:** The raw base model's F1 score of **0.6496** is obtained by maximizing F1 on raw predicted probabilities across validation grid search ($\tau^* = 0.47$). After fitting probability calibration (`CalibratedClassifierCV(method='sigmoid')`), probabilities are mapped to true posterior ignition frequencies; evaluating this calibrated pipeline at the standard operating threshold $\tau = 0.50$ yields F1 = **0.6417**, Precision = **57.41%**, and Recall = **72.75%**. Both versions exhibit identical ranking performance (PR-AUC = 0.6436, ROC-AUC = 0.8524) because strictly monotonic sigmoid scaling preserves AUC metrics.

---

## 3. Statistical Significance of Validation Margin

- **Observed Validation Margin (GB vs RF):** $\Delta\text{PR-AUC} = +0.0148$ (0.6436 vs 0.6289).
- **Weekly Block Bootstrap (52 ISO Weeks, B = 1,000):**
  - **Mean Difference:** $+0.0142$
  - **95% Confidence Interval:** `[0.0020, 0.0281]`
- **Statistical Finding:** The observed validation PR-AUC margin (+0.0148) on a single validation year is modest. In time-series validation across different years, a small margin on one validation year does not guarantee superiority in other years, and both ensemble models perform comparably. Gradient Boosting was chosen strictly as the numeric top performer on the pre-stated criterion, combined with faster inference latency, compact model size, and native handling of tabular features.

---

## 4. Decision & Production Architecture

1. **Validation Winner:** **Gradient Boosting** achieved the highest numeric validation PR-AUC (0.6436), validation ROC-AUC (0.8524), and validation F1 (0.6496).
2. **Probability Calibration:** The winning model was calibrated using sigmoid scaling (`CalibratedClassifierCV(method="sigmoid")`) fitted via `PredefinedSplit` on the 2023 validation split. No test set data was seen.
3. **Serialization:** The calibrated pipeline, feature metadata, environment dependencies, and operational risk thresholds were serialized into `ml/models/risk_model.joblib`.
4. **Integrity Confirmation:** Zero 2024 test data was inspected, queried, or utilized during model selection, hyperparameter tuning, or calibration fitting.

---

## 5. Served Model vs Baseline Significance & Walk-Forward Protocol (Year 2024)

### Weekly Block Bootstrap Difference vs Climatology Lookup (Test Year 2024)
On the held-out 2024 test year ($N = 4,745$ across all 13 districts), the statistical significance of the served model (Calibrated Gradient Boosting) over the District + Month Climatology Lookup was assessed using weekly block bootstrapping (52 ISO week clusters, $B = 1,000$ resamples):
- **Delta PR-AUC Mean:** $+0.0585$ (95% CI: `[-0.0277, 0.1368]`)
- **Delta ROC-AUC Mean:** $+0.0267$ (95% CI: `[-0.0085, 0.0631]`)
- **Scientific Finding:** Because the 95% confidence interval for $\Delta\text{PR-AUC}$ crosses zero, the ranking improvement over the geographic-monthly lookup baseline is modest and not statistically significant. This confirms that broad calendar seasonality and district geography explain the bulk of baseline risk, while daily weather dynamics provide fine-grained modulation.

### Rolling-Origin Climatology Recomputation Protocol
In walk-forward rolling-origin evaluation (2021–2024), climatology tables and anomaly features are recomputed dynamically and strictly from each fold's training years only (e.g., fold 2021 uses only 2018–2019; fold 2022 uses 2018–2020; fold 2023 uses 2018–2021; fold 2024 uses 2018–2022). Zero future or test data enters any fold's baseline calculations.

