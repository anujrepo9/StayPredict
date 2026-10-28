"""
StayPredict — ML Training Script
Trains a Random Forest Regressor on the real LengthOfStay dataset (100,000 records).
Dataset columns are mapped and only admission-time features are used (no data leakage).
"""

import os
import sys
import json
import warnings
import numpy as np
import pandas as pd
import joblib
from datetime import datetime
from pathlib import Path

from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OrdinalEncoder
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.dummy import DummyRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

warnings.filterwarnings("ignore")

ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"
ARTIFACTS_DIR.mkdir(exist_ok=True)

RANDOM_STATE = 42
MODEL_VERSION = "2.0.0"
TARGET = "lengthofstay"

# ── Feature groups ────────────────────────────────────────────────────────────
# All features available at or before admission — no discharge date, no post-admission outcomes
NUMERICAL_FEATURES = [
    "hematocrit", "neutrophils", "sodium", "glucose",
    "bloodureanitro", "creatinine", "bmi", "pulse", "respiration",
    "secondarydiagnosisnonicd9", "rcount_num",   # rcount encoded as int
]
BINARY_FEATURES = [
    "dialysisrenalendstage", "asthma", "irondef", "pneum",
    "substancedependence", "psychologicaldisordermajor", "depress",
    "psychother", "fibrosisandother", "malnutrition", "hemo",
]
CATEGORICAL_FEATURES = ["gender", "facid"]
ALL_FEATURES = NUMERICAL_FEATURES + BINARY_FEATURES + CATEGORICAL_FEATURES


def load_and_prepare(data_path: str) -> pd.DataFrame:
    print(f"[INFO] Loading dataset from {data_path}")
    df = pd.read_csv(data_path)
    print(f"[INFO] Raw shape: {df.shape}")

    # ── Encode rcount (0,1,2,3,4,5+) → numeric ───────────────────────────────
    rcount_map = {"0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5+": 5}
    df["rcount_num"] = df["rcount"].astype(str).map(rcount_map).fillna(0).astype(int)

    # ── Drop rows with missing target ─────────────────────────────────────────
    df = df.dropna(subset=[TARGET])
    df = df[df[TARGET] >= 1]

    # ── Remove duplicates ─────────────────────────────────────────────────────
    before = len(df)
    df = df.drop_duplicates(subset=["eid"])
    print(f"[INFO] Duplicates removed: {before - len(df)}")

    # ── Validate feature presence ─────────────────────────────────────────────
    missing = [c for c in ALL_FEATURES + [TARGET] if c not in df.columns]
    if missing:
        raise ValueError(f"Missing expected columns: {missing}")

    # ── Select only admission-time features + target ──────────────────────────
    # Explicitly NOT including: vdate, discharged (discharge date = future leakage)
    df = df[ALL_FEATURES + [TARGET]].copy()

    print(f"[INFO] Clean shape: {df.shape}")
    print(f"[INFO] Target stats — min:{df[TARGET].min()}, max:{df[TARGET].max()}, "
          f"mean:{df[TARGET].mean():.2f}, std:{df[TARGET].std():.2f}")
    print(f"[INFO] Nulls per feature:\n{df[ALL_FEATURES].isnull().sum()[df[ALL_FEATURES].isnull().sum()>0]}")
    return df


def build_preprocessor():
    num_pipeline = Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
    ])
    # Binary features are already 0/1 — just impute, no scaling needed
    bin_pipeline = Pipeline([
        ("impute", SimpleImputer(strategy="most_frequent")),
    ])
    cat_pipeline = Pipeline([
        ("impute", SimpleImputer(strategy="most_frequent")),
        ("encode", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)),
    ])
    preprocessor = ColumnTransformer([
        ("num", num_pipeline, NUMERICAL_FEATURES),
        ("bin", bin_pipeline, BINARY_FEATURES),
        ("cat", cat_pipeline, CATEGORICAL_FEATURES),
    ])
    return preprocessor


def evaluate(name, pipeline, X_train, X_test, y_train, y_test):
    pipeline.fit(X_train, y_train)
    preds = np.clip(pipeline.predict(X_test), 1.0, None)
    mae  = mean_absolute_error(y_test, preds)
    rmse = mean_squared_error(y_test, preds, squared=False)
    r2   = r2_score(y_test, preds)
    print(f"  {name:40s}  MAE={mae:.3f}  RMSE={rmse:.3f}  R²={r2:.4f}")
    return {"name": name, "mae": mae, "rmse": rmse, "r2": r2, "pipeline": pipeline}


def train():
    data_path = os.getenv("DATASET_PATH", "")
    if not data_path or not Path(data_path).exists():
        # Try default locations
        candidates = [
            Path(__file__).parent.parent.parent / "data" / "LengthOfStay.csv",
            Path("/mnt/user-data/uploads/1792939497777_LengthOfStay.csv"),
        ]
        for c in candidates:
            if c.exists():
                data_path = str(c)
                break

    if not data_path or not Path(data_path).exists():
        print("[WARN] Real dataset not found — falling back to synthetic data.")
        print("[WARN] Set DATASET_PATH env var to the LengthOfStay.csv path.")
        return _train_synthetic()

    df = load_and_prepare(data_path)

    X = df[ALL_FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE
    )
    print(f"\n[INFO] Train: {len(X_train):,}  Test: {len(X_test):,}")

    preprocessor = build_preprocessor()

    candidates = {
        "Mean Baseline":    Pipeline([("pre", preprocessor), ("m", DummyRegressor(strategy="mean"))]),
        "Linear Regression":Pipeline([("pre", preprocessor), ("m", LinearRegression())]),
        "Ridge Regression": Pipeline([("pre", preprocessor), ("m", Ridge(alpha=1.0))]),
        "Decision Tree":    Pipeline([("pre", preprocessor), ("m", DecisionTreeRegressor(max_depth=8, random_state=RANDOM_STATE))]),
        "Random Forest":    Pipeline([("pre", preprocessor), ("m", RandomForestRegressor(
            n_estimators=200, max_depth=12, min_samples_split=10,
            min_samples_leaf=8, random_state=RANDOM_STATE, n_jobs=-1,
        ))]),
    }

    print("\n[INFO] Model comparison:")
    results = [evaluate(n, p, X_train, X_test, y_train, y_test) for n, p in candidates.items()]

    best = next(r for r in results if r["name"] == "Random Forest")
    final = best["pipeline"]
    print(f"\n[INFO] Selected: Random Forest  MAE={best['mae']:.3f}  R²={best['r2']:.4f}")

    # ── Interval coverage on test set ─────────────────────────────────────────
    rf   = final.named_steps["m"]
    pre  = final.named_steps["pre"]
    X_tp = pre.transform(X_test)
    tree_preds = np.array([t.predict(X_tp) for t in rf.estimators_])
    lo = np.percentile(tree_preds, 10, axis=0)
    hi = np.percentile(tree_preds, 90, axis=0)
    coverage = float(np.mean((y_test.values >= lo) & (y_test.values <= hi)))
    print(f"[INFO] Empirical 80% interval coverage on test set: {coverage:.3f} "
          f"(not a calibrated prediction interval)")

    # ── Feature importances ───────────────────────────────────────────────────
    feat_names = ALL_FEATURES
    importances = rf.feature_importances_
    feat_imp = dict(zip(feat_names, importances.tolist()))
    print("\n[INFO] Top feature importances:")
    for f, v in sorted(feat_imp.items(), key=lambda x: -x[1])[:10]:
        print(f"  {f:35s}: {v:.4f}")

    # ── Save artifacts ────────────────────────────────────────────────────────
    model_path = ARTIFACTS_DIR / "model.joblib"
    joblib.dump(final, model_path)
    print(f"\n[INFO] Model saved → {model_path}")

    metrics = {
        "model_version": MODEL_VERSION,
        "trained_at": datetime.utcnow().isoformat(),
        "dataset": {
            "source": str(data_path),
            "is_synthetic": False,
            "total_records": len(df),
            "train_records": len(X_train),
            "test_records": len(X_test),
        },
        "features": {
            "numerical": NUMERICAL_FEATURES,
            "binary": BINARY_FEATURES,
            "categorical": CATEGORICAL_FEATURES,
            "all": ALL_FEATURES,
            "leakage_note": "vdate and discharged columns excluded — discharge date is post-admission information.",
        },
        "hyperparameters": {
            "n_estimators": 200, "max_depth": 12,
            "min_samples_split": 10, "min_samples_leaf": 8,
            "random_state": RANDOM_STATE,
        },
        "test_metrics": {
            "mae": round(best["mae"], 4),
            "rmse": round(best["rmse"], 4),
            "r2": round(best["r2"], 4),
        },
        "all_model_comparison": [
            {"name": r["name"], "mae": round(r["mae"], 4),
             "rmse": round(r["rmse"], 4), "r2": round(r["r2"], 4)}
            for r in results
        ],
        "interval_info": {
            "method": "empirical_tree_percentile_10_90",
            "nominal_coverage": 0.80,
            "actual_test_coverage": round(coverage, 4),
            "warning": "Not a statistically calibrated prediction interval. Coverage measured on held-out test set.",
        },
        "feature_importance": {k: round(v, 6) for k, v in feat_imp.items()},
    }

    with open(ARTIFACTS_DIR / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    # Save categorical categories for validation
    cat_enc = final.named_steps["pre"].named_transformers_["cat"].named_steps["encode"]
    cats = {feat: list(cats) for feat, cats in zip(CATEGORICAL_FEATURES, cat_enc.categories_)}
    with open(ARTIFACTS_DIR / "categories.json", "w") as f:
        json.dump(cats, f, indent=2)

    print("[INFO] Training complete.\n")
    return final, metrics


def _train_synthetic():
    """Fallback synthetic dataset — clearly labelled."""
    from training.train_synthetic import train_synthetic
    return train_synthetic()


if __name__ == "__main__":
    train()