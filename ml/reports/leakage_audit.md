# Feature Leakage Audit & Temporal Causality Design Audit

This audit provides a formal engineering audit of temporal causality and data isolation for all **33 input features** utilized in the ForestGuard AI model.

---

## 1. Problem Formulation & Temporal Horizon

- **Prediction Task:** Given environmental observations up to and including day $t$, forecast whether at least one active fire will be detected within district $d$ on day $t+1$.
- **Information Cutoff:** Strictly at the conclusion of day $t$ (23:59:59 local time).
- **Target Definition:** $y_{d, t+1} = \mathbb{I}(\text{FIRMS detections}_{d, t+1} \ge 1)$.
- **Zero-Leakage Criterion:** An input feature $X_{i, d, t}$ satisfies zero temporal leakage if and only if:
  $$\frac{\partial X_{i, d, t}}{\partial \mathcal{O}_{\tau}} = 0 \quad \forall \tau > t$$
  where $\mathcal{O}_{\tau}$ represents any observational state (weather, satellite detections, or outcomes) occurring on day $\tau$.

---

## 2. Feature-by-Feature Temporal Window Audit

| # | Feature Name | Description & Formula | Time Window | Temporal Isolation (Zero Exposure to $\tau > t$) |
| :-: | :--- | :--- | :---: | :--- |
| **1** | `temp_max` | Maximum 2-meter air temperature on day $t$ | $[t, t]$ | Evaluated directly from daily observations on day $t$. Uses zero data after day $t$. |
| **2** | `humidity_mean` | Mean relative humidity on day $t$ | $[t, t]$ | Aggregated from 24 hourly readings on day $t$. Completely bounded within day $t$. |
| **3** | `wind_speed_max` | Maximum 10-meter wind speed on day $t$ | $[t, t]$ | Maximum hourly gust observed during day $t$. Completely bounded within day $t$. |
| **4** | `rain_sum` | Total daily precipitation on day $t$ | $[t, t]$ | Sum of 24 hourly precipitation readings on day $t$. Uses zero data after day $t$. |
| **5** | `temp_max_7d_mean` | 7-day rolling average of daily max temperature: $\frac{1}{7}\sum_{k=0}^{6} \text{temp\_max}_{t-k}$ | $[t-6, t]$ | Rolling lookback over the past 7 days up to day $t$. All indices are $\le t$. |
| **6** | `temp_max_diff_1d` | Day-over-day temperature shift: $\text{temp\_max}_t - \text{temp\_max}_{t-1}$ | $[t-1, t]$ | First-order backward difference. Operates strictly on days $t$ and $t-1$. |
| **7** | `humidity_mean_7d` | 7-day rolling average of mean relative humidity: $\frac{1}{7}\sum_{k=0}^{6} \text{humidity\_mean}_{t-k}$ | $[t-6, t]$ | Backward rolling lookback over the past 7 days. All indices are $\le t$. |
| **8** | `rain_3d` | 3-day accumulated rainfall: $\sum_{k=0}^{2} \text{rain\_sum}_{t-k}$ | $[t-2, t]$ | Backward rolling sum over past 3 days up to day $t$. All indices $\le t$. |
| **9** | `rain_7d` | 7-day accumulated rainfall: $\sum_{k=0}^{6} \text{rain\_sum}_{t-k}$ | $[t-6, t]$ | Backward rolling sum over past 7 days up to day $t$. All indices $\le t$. |
| **10** | `rain_30d` | 30-day accumulated rainfall: $\sum_{k=0}^{29} \text{rain\_sum}_{t-k}$ | $[t-29, t]$ | Backward rolling sum over past 30 days up to day $t$. All indices $\le t$. |
| **11** | `days_since_rain` | Number of consecutive days preceding and including day $t$ with $\text{rain\_sum} < 1.0\text{ mm}$ (capped at 90) | $[t-89, t]$ | Incremented backwards in time; reset when rain $\ge 1\text{ mm}$. Capped at 90 days, matching the 90-day serving window. Zero future data utilized. |
| **12** | `et0` | FAO-56 Penman-Monteith reference evapotranspiration | $[t, t]$ | Physical evaporative demand calculated from solar radiation, temperature, and wind on day $t$. Completely bounded within day $t$. |
| **13** | `vpd_proxy` | Vapor Pressure Deficit proxy via Tetens equation: $e_s(T_t) \times (1 - \frac{RH_t}{100})$ | $[t, t]$ | Deterministic non-linear combination of $\text{temp\_max}_t$ and $\text{humidity\_mean}_t$. Uses zero future data. |
| **14** | `soil_moisture_mean` | Daily volumetric soil moisture (0–7 cm depth, $\text{m}^3/\text{m}^3$) | $[t, t]$ | ERA5-Land reanalysis topsoil moisture on day $t$. Completely bounded within day $t$. |
| **15** | `district_almora` | One-hot indicator for Almora district | Static | Constant geographic indicator. Time-invariant. |
| **16** | `district_bageshwar` | One-hot indicator for Bageshwar district | Static | Constant geographic indicator. Time-invariant. |
| **17** | `district_chamoli` | One-hot indicator for Chamoli district | Static | Constant geographic indicator. Time-invariant. |
| **18** | `district_champawat` | One-hot indicator for Champawat district | Static | Constant geographic indicator. Time-invariant. |
| **19** | `district_dehradun` | One-hot indicator for Dehradun district | Static | Constant geographic indicator. Time-invariant. |
| **20** | `district_haridwar` | One-hot indicator for Haridwar district | Static | Constant geographic indicator. Time-invariant. |
| **21** | `district_nainital` | One-hot indicator for Nainital district | Static | Constant geographic indicator. Time-invariant. |
| **22** | `district_pauri_garhwal` | One-hot indicator for Pauri Garhwal district | Static | Constant geographic indicator. Time-invariant. |
| **23** | `district_pithoragarh` | One-hot indicator for Pithoragarh district | Static | Constant geographic indicator. Time-invariant. |
| **24** | `district_rudraprayag` | One-hot indicator for Rudraprayag district | Static | Constant geographic indicator. Time-invariant. |
| **25** | `district_tehri_garhwal` | One-hot indicator for Tehri Garhwal district | Static | Constant geographic indicator. Time-invariant. |
| **26** | `district_udham_singh_nagar` | One-hot indicator for Udham Singh Nagar district | Static | Constant geographic indicator. Time-invariant. |
| **27** | `district_uttarkashi` | One-hot indicator for Uttarkashi district | Static | Constant geographic indicator. Time-invariant. |
| **28** | `latitude` | District centroid latitude | Static | Geographic coordinate from official boundaries. Time-invariant. |
| **29** | `longitude` | District centroid longitude | Static | Geographic coordinate from official boundaries. Time-invariant. |
| **30** | `elevation` | District centroid elevation (meters above sea level) | Static | Topographic constant from Open-Meteo elevation model. Time-invariant. |
| **31** | `temp_anomaly` | $\text{temp\_max}_t - \mu_{\text{temp}}(\text{district}, \text{month}_t)$ | Historical | Climatological mean $\mu$ is derived strictly from historical training years ($t \in \text{Train}$). Day $t$ observation is subtracted. No future data is exposed. |
| **32** | `humidity_anomaly` | $\text{humidity\_mean}_t - \mu_{\text{humidity}}(\text{district}, \text{month}_t)$ | Historical | Climatological mean $\mu$ is derived strictly from historical training years ($t \in \text{Train}$). Zero test or future year leakage. |
| **33** | `rain_30d_anomaly` | $\text{rain\_30d}_t - \mu_{\text{rain30d}}(\text{district}, \text{month}_t)$ | Historical | Climatological mean $\mu$ is derived strictly from historical training years ($t \in \text{Train}$). Zero test or future year leakage. |

---

## 3. Strict Verification of Pipeline Stages

1. **Target Shifting:** In `ml/02_build_dataset.py`, the target variable is formed by joining FIRMS detections on date $t+1$ to weather on date $t$:
   ```python
   # Day t weather joined with Day t+1 fire count
   target = 1 if fire_counts.get((district, date_plus_1), 0) >= 1 else 0
   ```
2. **Online Serving Equivalence:** In `ml/features.py:build_feature_row`, the function receives `history_records` (up to day $t-1$) and `today_record` (day $t$). It has no parameter or access to any record for $t+1$.
3. **Hyperparameter & Threshold Hygiene:**
   - Candidate models were trained on 2018–2022.
   - Probability calibration and decision threshold selection ($\tau^*$) were fitted strictly on 2023 validation data.
   - The test year 2024 was used exclusively for final held-out reporting.
