"""Train and calibrate forest fire risk prediction models.

Uses a strict time-based split:
  - Train: 2018-2022
  - Validation: 2023
  - Test: 2024

Models compared:
  1. Logistic Regression (baseline)
  2. Random Forest Classifier
  3. HistGradientBoosting Classifier

Selection criterion: PR-AUC and F1-score on held-out validation set.
Calibrates probabilities and saves artifacts to ml/models/risk_model.joblib.
"""

from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import PredefinedSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# Ensure ml directory is on sys.path
ML_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ML_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from config import (
    MODELS_DIR,
    PROCESSED_DATA_DIR,
    RISK_THRESHOLDS,
    TEST_YEAR,
    TRAIN_YEARS,
    VAL_YEAR,
)
from features import FEATURE_NAMES


def train_and_select_model():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    dataset_file = PROCESSED_DATA_DIR / "dataset.csv"
    if not dataset_file.exists():
        raise FileNotFoundError(f"Missing {dataset_file}. Run 02_build_dataset.py first.")

    print(f"Loading dataset from {dataset_file}...")
    df = pd.read_csv(dataset_file)
    df["year"] = pd.to_datetime(df["date"]).dt.year

    # Time-based split
    train_mask = df["year"].isin(TRAIN_YEARS)
    val_mask = df["year"] == VAL_YEAR
    test_mask = df["year"] == TEST_YEAR

    X_train = df.loc[train_mask, FEATURE_NAMES]
    y_train = df.loc[train_mask, "target_fire_next_day"]

    X_val = df.loc[val_mask, FEATURE_NAMES]
    y_val = df.loc[val_mask, "target_fire_next_day"]

    X_test = df.loc[test_mask, FEATURE_NAMES]
    y_test = df.loc[test_mask, "target_fire_next_day"]

    print("\n--- Dataset Temporal Split Summary ---")
    print(f"  Train ({TRAIN_YEARS[0]}-{TRAIN_YEARS[-1]}): {len(X_train)} samples ({y_train.sum()} fires, {y_train.mean()*100:.1f}%)")
    print(f"  Validation ({VAL_YEAR}):   {len(X_val)} samples ({y_val.sum()} fires, {y_val.mean()*100:.1f}%)")
    print(f"  Test ({TEST_YEAR}):         {len(X_test)} samples ({y_test.sum()} fires, {y_test.mean()*100:.1f}%)")

    candidates = {
        "Logistic Regression (Baseline)": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)),
        ]),
        "Random Forest": Pipeline([
            ("clf", RandomForestClassifier(n_estimators=80, max_depth=10, min_samples_leaf=10, class_weight="balanced", random_state=42, n_jobs=-1)),
        ]),
        "Gradient Boosting": Pipeline([
            ("clf", HistGradientBoostingClassifier(max_iter=100, max_depth=6, class_weight="balanced", random_state=42)),
        ]),
    }

    results = {}
    fitted_models = {}

    print("\n--- Model Training & Validation Evaluation ---")
    for name, pipe in candidates.items():
        pipe.fit(X_train, y_train)
        fitted_models[name] = pipe

        val_probs = pipe.predict_proba(X_val)[:, 1]
        val_preds = pipe.predict(X_val)

        pr_auc = float(average_precision_score(y_val, val_probs))
        roc_auc = float(roc_auc_score(y_val, val_probs))
        f1 = float(f1_score(y_val, val_preds, zero_division=0))
        prec = float(precision_score(y_val, val_preds, zero_division=0))
        rec = float(recall_score(y_val, val_preds, zero_division=0))

        results[name] = {
            "pr_auc": pr_auc,
            "roc_auc": roc_auc,
            "f1": f1,
            "precision": prec,
            "recall": rec,
        }
        print(f"  [{name}]")
        print(f"    PR-AUC: {pr_auc:.4f} | ROC-AUC: {roc_auc:.4f} | F1: {f1:.4f} (Prec: {prec:.4f}, Rec: {rec:.4f})")

    # Select best model strictly by PR-AUC (ranking capability across all decision thresholds)
    best_name = max(results.keys(), key=lambda k: results[k]["pr_auc"])
    best_model = fitted_models[best_name]
    print(f"\n[OK] Selected Best Model by PR-AUC: '{best_name}' (PR-AUC={results[best_name]['pr_auc']:.4f})")

    # Calibrate probabilities using validation set
    print("Calibrating probabilities with CalibratedClassifierCV (PredefinedSplit on validation set)...")
    split_indices = np.concatenate([
        -np.ones(len(X_train), dtype=int),
        np.zeros(len(X_val), dtype=int),
    ])
    pds = PredefinedSplit(test_fold=split_indices)
    X_train_val = pd.concat([X_train, X_val], ignore_index=True)
    y_train_val = pd.concat([y_train, y_val], ignore_index=True)

    calibrated_model = CalibratedClassifierCV(best_model, cv=pds, method="sigmoid")
    calibrated_model.fit(X_train_val, y_train_val)

    # Save artifacts bundle with compression (<15 MB)
    out_model_path = MODELS_DIR / "risk_model.joblib"
    artifact = {
        "model": calibrated_model,
        "base_model": best_model,
        "best_model_name": best_name,
        "feature_names": FEATURE_NAMES,
        "risk_thresholds": RISK_THRESHOLDS,
        "selection_criterion": "PR-AUC (Precision-Recall Area Under Curve)",
        "validation_metrics": results[best_name],
        "metadata": {
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "train_years": f"{TRAIN_YEARS[0]}-{TRAIN_YEARS[-1]}",
            "val_year": str(VAL_YEAR),
            "test_year": str(TEST_YEAR),
            "features_count": len(FEATURE_NAMES),
            "python_version": sys.version.split()[0],
            "sklearn_version": getattr(sys.modules.get("sklearn"), "__version__", "1.8.0"),
            "numpy_version": np.__version__,
            "pandas_version": pd.__version__,
            "joblib_version": joblib.__version__,
        },
    }
    joblib.dump(artifact, out_model_path, compress=3)
    size_mb = out_model_path.stat().st_size / (1024 * 1024)
    print(f"[OK] Calibrated model saved to {out_model_path} ({size_mb:.2f} MB)")

    return artifact, df, X_test, y_test


if __name__ == "__main__":
    train_and_select_model()
