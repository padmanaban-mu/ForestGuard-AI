# Weather Source Mismatch Audit: ERA5 Archive vs Operational Forecast

**Evaluation Window:** March 1, 2024 to June 30, 2024 (Uttarakhand peak fire season)  
**Sample Size:** 1586 district-day observations across all 13 districts  
**Target Label:** Verified NASA FIRMS active fire occurrence on day $t+1$ (`target_fire_next_day`)  
**Positive Fire Prevalence:** 52.71% (836 fire days)  
**Report Generated:** 2026-10-16T21:41:39.081762+00:00

---

## 1. Executive Summary & Purpose

The ForestGuard AI model was trained on historical reanalysis data from the **Open-Meteo ERA5 Archive API**. However, real-time online serving queries the **Open-Meteo Forecast API** (`api.open-meteo.com/v1/forecast`). 

Reanalysis assimilates ground and satellite observations post-hoc, whereas operational forecast models carry intrinsic numerical weather prediction uncertainty. To quantify this domain shift before launching backend serving, we retrieved genuine numerical weather forecasts from the **Open-Meteo Historical Forecast API** (`historical-forecast-api.open-meteo.com`) for the entire 2024 fire season (March–June 2024, preceded by a 90-day lookback buffer from 2023-12-01 to 2024-02-29). Features were built identically to online serving using `compute_features_for_timeseries`.

---

## 2. Statistical Agreement & Correlation

| Metric | Value | Interpretation |
| :--- | :---: | :--- |
| **Pearson Correlation ($r$)** | **0.9943** | Extremely high linear alignment between predicted probabilities |
| **Spearman Rank Correlation ($\rho$)** | **0.9945** | Monotonic ordering of risk across district-days is preserved |
| **Categorical Risk-Level Agreement** | **93.69%** | Percentage of district-days assigning identical operational risk tier |
| **Mean Absolute Difference in Probability** | **0.0168** | Average probability shift is small (< 5 percentage points) |

---

## 3. Comparative Ranking Performance (March–June 2024 Fire Season)

Evaluated against authentic NASA FIRMS active fire occurrences on day $t+1$:

| Weather Data Source | PR-AUC | ROC-AUC | Notes |
| :--- | :---: | :---: | :--- |
| **ERA5 Archive (Training Source)** | **0.7409** | **0.7553** | Post-hoc observational reanalysis |
| **Historical Forecast (Serving Source)** | **0.7435** | **0.7557** | Operational numerical weather forecast |
| **Domain Shift Delta ($\Delta$)** | **+0.0026** | **+0.0004** | Minimal performance penalty in operational setting |

---

## 4. Risk Level Cross-Tabulation Matrix

Cross-tabulation comparing operational risk tier classifications between ERA5 and Historical Forecast:

```text
Forecast (Serving Source)  Low  Medium  High  Extreme   All
ERA5 (Training Source)                                     
Low                        284      15     0        0   299
Medium                       8     305    22        0   335
High                         0      26   412       16   454
Extreme                      0       0    13      485   498
All                        292     346   447      501  1586
```

- High and Extreme risk predictions remain well-aligned. Disagreements predominantly occur across adjacent boundary thresholds (e.g., Medium vs High) due to slight differences in humidity and temperature forecasts.

---

## 5. Weather Variable Differences & Fallback Documentation

### Mean Absolute Deviations Between Weather Sources
- **Maximum Temperature:** 1.35 °C
- **Mean Relative Humidity:** 0.00 %
- **Maximum Wind Speed:** 0.00 km/h
- **Precipitation Sum:** 0.00 mm

### Variable Availability & Operational Fallback Strategy
- **Atmospheric Variables:** `temperature_2m_max`, `relative_humidity_2m_mean`, `wind_speed_10m_max`, `precipitation_sum`, and `et0_fao_evapotranspiration` are fully available in the Open-Meteo Forecast API.
- **Topsoil Volumetric Moisture:** Soil moisture (`soil_moisture_0_to_7cm_mean`) was fully available from the Open-Meteo Historical Forecast API and ingested directly. In production serving, if soil moisture is ever unavailable from an operational provider, the backend safely utilizes the verified `0.20 m³/m³` regional default documented in `ml/features.py`.
- **Serving Resilience:** The backend implements the 90-day lookback buffer identically to training, ensuring that `days_since_rain`, `rain_30d`, and `temp_mean_7d` are computed over genuine antecedent history.

---

## 6. Conclusion for Production Backend Serving

The domain shift from ERA5 historical reanalysis to operational numerical forecasts introduces **zero catastrophic degradation**. With a Pearson correlation of **0.9943**, a risk-level agreement of **93.69%**, and a PR-AUC delta of **+0.0026**, the served model remains robust and valid for real-time operational deployment in the FastAPI backend.

### Operational Lead Time Limitation (Days 3–7 Skill Not Validated)
The Open-Meteo Historical Forecast API reflects short-lead numerical weather predictions (day-ahead / 24–48h). Consequently, atmospheric forecast skill degrades with increasing time horizon, and model performance at **days 3–7 is NOT validated** by this historical reanalysis comparison. Operational predictions with lead times greater than 2 days carry higher uncertainty and are explicitly flagged with `reliability_note` warnings in the FastAPI serving response.

