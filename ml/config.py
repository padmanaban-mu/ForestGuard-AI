"""Central configuration for the ForestGuard AI ML pipeline."""

from pathlib import Path

# Base directories
ML_DIR = Path(__file__).resolve().parent
ROOT_DIR = ML_DIR.parent
DATA_DIR = ML_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
MODELS_DIR = ML_DIR / "models"
REPORTS_DIR = ML_DIR / "reports"

# Region settings
REGION_NAME = "Uttarakhand, India"
# Bounding box: [west, south, east, north]
BBOX = [77.6, 28.7, 81.1, 31.5]

# Time horizon
START_YEAR = 2018
END_YEAR = 2024

# Time-based data split
TRAIN_YEARS = list(range(2018, 2023))  # 2018 - 2022
VAL_YEAR = 2023
TEST_YEAR = 2024

# Risk probability thresholds mapping: probability -> risk level
# Calibrated for pre-ignition probability on day t+1
RISK_THRESHOLDS = {
    "Low": (0.0, 0.25),
    "Medium": (0.25, 0.50),
    "High": (0.50, 0.75),
    "Extreme": (0.75, 1.0),
}


def probability_to_risk_level(prob: float) -> str:
    """Map calibrated fire probability (0-1) to categorical risk level."""
    if prob is None or prob < 0:
        return "Unavailable"
    if prob >= 0.75:
        return "Extreme"
    if prob >= 0.50:
        return "High"
    if prob >= 0.25:
        return "Medium"
    return "Low"
