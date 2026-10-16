"""Model inference service for ForestGuard AI FastAPI Backend."""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import joblib
import numpy as np
import pandas as pd

from backend.config import MODEL_PATH
from backend.schemas import KeyCondition

logger = logging.getLogger(__name__)


class ModelService:
    """Manages the serialized machine learning model bundle and provides inference."""

    def __init__(self, model_path: Optional[Path] = None):
        self.model_path = model_path or MODEL_PATH
        self.bundle: Optional[Dict[str, Any]] = None
        self.model = None
        self.base_model = None
        self.best_model_name: str = "Gradient Boosting"
        self.feature_names: List[str] = []
        self.risk_thresholds: Dict[str, Tuple[float, float]] = {}
        self.selection_criterion: str = ""
        self.validation_metrics: Dict[str, Any] = {}
        self.metadata: Dict[str, Any] = {}
        self.is_loaded: bool = False

        self.load_model()

    def load_model(self) -> None:
        """Load and unpack the model bundle artifact."""
        if not self.model_path.exists():
            error_msg = (
                f"Model bundle not found at {self.model_path}. "
                "Ensure ml/models/risk_model.joblib exists or run 'python ml/03_train_model.py'."
            )
            logger.error(error_msg)
            raise FileNotFoundError(error_msg)

        try:
            logger.info(f"Loading model bundle from {self.model_path}...")
            self.bundle = joblib.load(self.model_path)

            required_keys = [
                "model",
                "base_model",
                "best_model_name",
                "feature_names",
                "risk_thresholds",
                "selection_criterion",
                "validation_metrics",
                "metadata",
            ]
            missing_keys = [k for k in required_keys if k not in self.bundle]
            if missing_keys:
                raise ValueError(f"Model bundle is missing required keys: {missing_keys}")

            self.model = self.bundle["model"]
            self.base_model = self.bundle["base_model"]
            self.best_model_name = self.bundle["best_model_name"]
            self.feature_names = self.bundle["feature_names"]
            self.risk_thresholds = self.bundle["risk_thresholds"]
            self.selection_criterion = self.bundle["selection_criterion"]
            self.validation_metrics = self.bundle["validation_metrics"]
            self.metadata = self.bundle["metadata"]
            self.is_loaded = True
            logger.info(f"Successfully loaded {self.best_model_name} with {len(self.feature_names)} features.")
        except Exception as e:
            logger.error(f"Failed to load model bundle: {e}", exc_info=True)
            self.is_loaded = False
            raise RuntimeError(f"Error loading model bundle: {e}") from e

    def probability_to_risk_level(self, prob: float) -> str:
        """Map continuous calibrated probability (0-1) to risk level using bundle thresholds."""
        if prob is None or prob < 0.0:
            return "Unavailable"

        # Dynamically evaluate thresholds defined in the bundle
        for level, (low, high) in self.risk_thresholds.items():
            if high >= 1.0:
                if low <= prob <= 1.05:
                    return level
            else:
                if low <= prob < high:
                    return level

        if prob >= 0.75:
            return "Extreme"
        return "Low"

    def calculate_key_conditions(self, feat_row: Dict[str, float]) -> List[KeyCondition]:
        """Derive physical and seasonal condition indicators (heuristic, not model attribution)."""
        conditions: List[KeyCondition] = []

        # 1. Days since rain
        dsr = feat_row.get("days_since_rain", 0.0)
        if dsr >= 30:
            conditions.append(
                KeyCondition(
                    factor="days_since_rain",
                    label="Prolonged Drought",
                    value=round(dsr, 1),
                    unit="days",
                    impact="high" if dsr >= 45 else "moderate",
                    description=f"{int(dsr)} consecutive dry days without significant precipitation (>1mm).",
                )
            )

        # 2. Atmospheric Vapor Pressure Deficit (VPD)
        vpd = feat_row.get("vpd_proxy", 1.0)
        if vpd >= 2.0:
            conditions.append(
                KeyCondition(
                    factor="vpd_proxy",
                    label="Atmospheric Evaporative Demand (VPD)",
                    value=round(vpd, 2),
                    unit="kPa",
                    impact="high" if vpd >= 3.0 else "moderate",
                    description="Elevated vapor pressure deficit rapidly accelerates fuel moisture desiccation.",
                )
            )

        # 3. Topsoil moisture deficit
        sm = feat_row.get("soil_moisture_mean", 0.20)
        if sm <= 0.20:
            conditions.append(
                KeyCondition(
                    factor="soil_moisture_mean",
                    label="Low Topsoil Moisture",
                    value=round(sm, 3),
                    unit="m³/m³",
                    impact="high" if sm <= 0.14 else "moderate",
                    description="Topsoil moisture layer is critically depleted, indicating desiccated understory fuels.",
                )
            )

        # 4. Temperature anomaly vs climatology
        temp_anom = feat_row.get("temp_anomaly", 0.0)
        if temp_anom >= 2.0:
            conditions.append(
                KeyCondition(
                    factor="temp_anomaly",
                    label="Temperature Anomaly",
                    value=round(temp_anom, 1),
                    unit="°C",
                    impact="high" if temp_anom >= 4.0 else "moderate",
                    description=f"{temp_anom:+.1f}°C warmer than historical district monthly climatology baseline.",
                )
            )

        # 5. High maximum wind speed
        wind = feat_row.get("wind_speed_max", 10.0)
        if wind >= 20.0:
            conditions.append(
                KeyCondition(
                    factor="wind_speed_max",
                    label="Elevated Wind Speed",
                    value=round(wind, 1),
                    unit="km/h",
                    impact="high" if wind >= 30.0 else "moderate",
                    description=f"Gust speeds of {wind:.1f} km/h enhance oxygen delivery and spread potential.",
                )
            )

        # 6. Cumulative 30-day rain deficit
        r30_anom = feat_row.get("rain_30d_anomaly", 0.0)
        if r30_anom <= -20.0:
            conditions.append(
                KeyCondition(
                    factor="rain_30d_anomaly",
                    label="30-Day Rainfall Deficit",
                    value=round(r30_anom, 1),
                    unit="mm",
                    impact="high" if r30_anom <= -50.0 else "moderate",
                    description=f"{abs(r30_anom):.1f} mm below historical 30-day accumulation for this month.",
                )
            )

        # Ensure at least 2 informative conditions are returned
        if len(conditions) < 2:
            t_max = feat_row.get("temp_max", 25.0)
            conditions.append(
                KeyCondition(
                    factor="temp_max",
                    label="Ambient Maximum Temperature",
                    value=round(t_max, 1),
                    unit="°C",
                    impact="low",
                    description=f"Daily maximum ambient temperature of {t_max:.1f}°C.",
                )
            )

        # Sort conditions by impact (high -> moderate -> low)
        impact_order = {"high": 0, "moderate": 1, "low": 2}
        conditions.sort(key=lambda x: impact_order.get(x.impact, 3))
        return conditions[:4]

    def predict_features(self, feature_row: Dict[str, float]) -> Tuple[float, str, List[KeyCondition]]:
        """Run calibrated inference on a single feature dictionary."""
        if not self.is_loaded or self.model is None:
            raise RuntimeError("Model is not loaded. Call load_model() first.")

        # Ensure strictly correct feature ordering
        feature_vector = [float(feature_row.get(col, 0.0)) for col in self.feature_names]
        X = pd.DataFrame([feature_vector], columns=self.feature_names)

        # Predict probability for day t+1
        prob = float(self.model.predict_proba(X)[0, 1])
        prob = round(float(np.clip(prob, 0.0, 1.0)), 4)
        risk_level = self.probability_to_risk_level(prob)
        key_conditions = self.calculate_key_conditions(feature_row)

        return prob, risk_level, key_conditions


# Singleton instance
model_service = ModelService()
