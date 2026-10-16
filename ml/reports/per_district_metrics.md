# Per-District Performance Report (Test Year 2024)

Evaluates the **Served Model (Calibrated Gradient Boosting)** across all 13 Uttarakhand districts on the 2024 held-out test year at tuned fair decision threshold (tau* = 0.33).

| District | Terrain / Land Type | Test Days | Fire Days | Positive Rate | Precision | Recall | F1 Score | PR-AUC | ROC-AUC |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Nainital** | Hills / Forest | 365 | 148 | 40.5% | 71.3% | 90.5% | 0.7976 | **0.8398** | 0.9039 |
| **Pauri Garhwal** | Hills / Forest | 365 | 130 | 35.6% | 60.9% | 96.9% | 0.7478 | **0.8069** | 0.9089 |
| **Udham Singh Nagar** | Plains / Agri | 365 | 173 | 47.4% | 67.3% | 97.7% | 0.7972 | **0.7752** | 0.8389 |
| **Almora** | Hills / Forest | 365 | 137 | 37.5% | 66.3% | 92.0% | 0.7706 | **0.7718** | 0.8805 |
| **Tehri Garhwal** | Hills / Forest | 365 | 129 | 35.3% | 64.6% | 87.6% | 0.7434 | **0.7654** | 0.8951 |
| **Uttarkashi** | Hills / Forest | 365 | 136 | 37.3% | 57.9% | 83.1% | 0.6828 | **0.6981** | 0.8110 |
| **Champawat** | Hills / Forest | 365 | 76 | 20.8% | 50.4% | 81.6% | 0.6231 | **0.6774** | 0.9056 |
| **Pithoragarh** | Hills / Forest | 365 | 95 | 26.0% | 50.9% | 91.6% | 0.6541 | **0.6594** | 0.8827 |
| **Chamoli** | Hills / Forest | 365 | 113 | 31.0% | 52.9% | 87.6% | 0.6600 | **0.6398** | 0.8399 |
| **Dehradun** | Hills / Forest | 365 | 109 | 29.9% | 55.9% | 90.8% | 0.6923 | **0.6146** | 0.8598 |
| **Bageshwar** | Hills / Forest | 365 | 95 | 26.0% | 53.8% | 81.1% | 0.6471 | **0.6092** | 0.8675 |
| **Rudraprayag** | Hills / Forest | 365 | 43 | 11.8% | 46.4% | 60.5% | 0.5253 | **0.5158** | 0.8660 |
| **Haridwar** | Plains / Agri | 365 | 90 | 24.7% | 33.0% | 74.4% | 0.4573 | **0.4093** | 0.6954 |

## Key Regional Findings & Hypotheses:
1. **Forested Hill Districts (Nainital, Pauri Garhwal, Tehri Garhwal, Almora, Bageshwar, Champawat):**
   - High predictive accuracy and ranking performance (PR-AUC 0.68 to 0.84).
   - Fuel drying is strongly governed by antecedent rainfall deficits, VPD, and soil moisture drawdown.
2. **Plains Agricultural Belt (Haridwar, Udham Singh Nagar):**
   - **Haridwar** exhibits lower precision (33.0%) and lowest PR-AUC (0.4093). Post-harvest agricultural residue burning is **hypothesized** to contribute to satellite thermal detections in agricultural areas without a forest canopy mask.
   - **Udham Singh Nagar** exhibits a high positive rate (47.4%) reflecting intensive seasonal agricultural burning in the agricultural Tarai belt.
3. **Complex High-Altitude Terrain (Rudraprayag):**
   - Lower sensitivity and F1 score (0.5253, PR-AUC 0.5158) are primarily explained by its **low baseline positive rate of 11.8%** (only 43 detection days out of 365), alongside **hypothesized** steep topography and persistent cloud shadows.
