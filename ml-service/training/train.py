"""
StayPredict - ML Training Script
Trains a Random Forest Regressor to predict hospital Length of Stay.
Uses a synthetic dataset when real data is unavailable (documented limitation).
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
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

warnings.filterwarnings("ignore")

ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"
ARTIFACTS_DIR.mkdir(exist_ok=True)

RANDOM_STATE = 42
MODEL_VERSION = "1.0.0"

# Admission-time features only (no post-admission data leakage)
NUMERICAL_FEATURES = ["age"]
CATEGORICAL_FEATURES = [
    "gender",
    "blood_group",
    "medical_condition",
    "admission_type",
    "insurance",
]
TARGET = "length_of_stay"


def generate_synthetic_dataset(n_samples: int = 54966, random_state: int = 42) -> pd.DataFrame:
    """
    Generate a synthetic hospital admission dataset.
    LIMITATION: This is synthetic data for demonstration only.
    Distributions are realistic but not derived from real patient records.
    Model performance on synthetic data does not predict real-world accuracy.
    """
    rng = np.random.default_rng(random_state)
    print(f"[INFO] Generating synthetic dataset with {n_samples} records (demonstration only).")
    print("[WARN] Synthetic data — model results do not reflect real clinical performance.")

    genders = rng.choice(["Male", "Female"], size=n_samples, p=[0.48, 0.52])
    blood_groups = rng.choice(
        ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
        size=n_samples,
        p=[0.28, 0.06, 0.21, 0.02, 0.05, 0.01, 0.30, 0.07],
    )
    conditions = rng.choice(
        ["Diabetes", "Hypertension", "Heart Disease", "Asthma",
         "Cancer", "Arthritis", "Obesity", "Pneumonia", "COPD", "Fracture"],
        size=n_samples,
        p=[0.18, 0.17, 0.12, 0.10, 0.08, 0.09, 0.08, 0.07, 0.06, 0.05],
    )
    admission_types = rng.choice(
        ["Elective", "Emergency", "Urgent"],
        size=n_samples,
        p=[0.40, 0.35, 0.25],
    )
    insurances = rng.choice(
        ["Medicare", "Medicaid", "Private", "Aetna", "Blue Cross", "Cigna", "UnitedHealth", "None"],
        size=n_samples,
        p=[0.22, 0.15, 0.20, 0.10, 0.12, 0.08, 0.09, 0.04],
    )
    ages = rng.integers(1, 90, size=n_samples).astype(float)

    # LOS depends on age, condition, admission type (realistic relationships)
    base_los = np.full(n_samples, 5.0)
    base_los += (ages - 40) * 0.04
    condition_effect = {
        "Cancer": 6, "Heart Disease": 5, "COPD": 4, "Pneumonia": 4,
        "Diabetes": 2, "Fracture": 3, "Hypertension": 1, "Asthma": 2,
        "Arthritis": 1, "Obesity": 1,
    }
    for cond, effect in condition_effect.items():
        base_los[conditions == cond] += effect
    admission_effect = {"Emergency": 3, "Urgent": 1.5, "Elective": 0}
    for adm, effect in admission_effect.items():
        base_los[admission_types == adm] += effect

    noise = rng.normal(0, 2.5, size=n_samples)
    los = np.clip(np.round(base_los + noise, 1), 1.0, 45.0)

    df = pd.DataFrame({
        "age": ages,
        "gender": genders,
        "blood_group": blood_groups,
        "medical_condition": conditions,
        "admission_type": admission_types,
        "insurance": insurances,
        TARGET: los,
    })
    return df


def load_dataset(data_path: str | None = None) -> pd.DataFrame:
    if data_path and Path(data_path).exists():
        print(f"[INFO] Loading dataset from {data_path}")
        df = pd.read_csv(data_path)
        # Map common column names from public healthcare datasets
        col_map = {
            "Age": "age", "Gender": "gender", "Blood Type": "blood_group",
            "Medical Condition": "medical_condition",
            "Admission Type": "admission_type",
            "Insurance Provider": "insurance",
            "Length of Stay": TARGET,
        }
        df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})
        required = NUMERICAL_FEATURES + CATEGORICAL_FEATURES + [TARGET]
        missing = [c for c in required if c not in df.columns]
        if missing:
            print(f"[WARN] Missing columns: {missing}. Falling back to synthetic data.")
            return generate_synthetic_dataset()
        df = df[required].copy()
        df[TARGET] = pd.to_numeric(df[TARGET], errors="coerce")
        df = df.dropna(subset=[TARGET])
        df = df[df[TARGET] >= 1]
        print(f"[INFO] Loaded {len(df)} records from file.")
        return df
    return generate_synthetic_dataset()


def build_preprocessor():
    num_pipeline = Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
    ])
    cat_pipeline = Pipeline([
        ("impute", SimpleImputer(strategy="most_frequent")),
        ("encode", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)),
    ])
    preprocessor = ColumnTransformer([
        ("num", num_pipeline, NUMERICAL_FEATURES),
        ("cat", cat_pipeline, CATEGORICAL_FEATURES),
    ])
    return preprocessor


def evaluate_model(name, model, X_train, X_test, y_train, y_test):
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    preds = np.clip(preds, 1.0, None)
    mae = mean_absolute_error(y_test, preds)
    rmse = mean_squared_error(y_test, preds, squared=False)
    r2 = r2_score(y_test, preds)
    print(f"  {name:35s}  MAE={mae:.3f}  RMSE={rmse:.3f}  R2={r2:.4f}")
    return {"name": name, "mae": mae, "rmse": rmse, "r2": r2}


def train():
    data_path = os.getenv("DATASET_PATH")
    df = load_dataset(data_path)

    print(f"\n[INFO] Dataset shape: {df.shape}")
    print(f"[INFO] Target stats: min={df[TARGET].min():.1f}, max={df[TARGET].max():.1f}, "
          f"mean={df[TARGET].mean():.2f}, std={df[TARGET].std():.2f}")
    print(f"[INFO] Missing values:\n{df.isnull().sum()}")

    X = df[NUMERICAL_FEATURES + CATEGORICAL_FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE
    )
    print(f"\n[INFO] Train: {len(X_train)}, Test: {len(X_test)}")

    preprocessor = build_preprocessor()

    candidates = {
        "Mean Baseline": Pipeline([("pre", preprocessor), ("m", DummyRegressor(strategy="mean"))]),
        "Linear Regression": Pipeline([("pre", preprocessor), ("m", LinearRegression())]),
        "Ridge Regression": Pipeline([("pre", preprocessor), ("m", Ridge(alpha=1.0))]),
        "Decision Tree": Pipeline([("pre", preprocessor), ("m", DecisionTreeRegressor(max_depth=8, random_state=RANDOM_STATE))]),
        "Random Forest": Pipeline([("pre", preprocessor), ("m", RandomForestRegressor(
            n_estimators=200, max_depth=12, min_samples_split=10,
            min_samples_leaf=8, random_state=RANDOM_STATE, n_jobs=-1,
        ))]),
    }

    print("\n[INFO] Model comparison (test set):")
    results = []
    for name, pipeline in candidates.items():
        res = evaluate_model(name, pipeline, X_train, X_test, y_train, y_test)
        res["pipeline"] = pipeline
        results.append(res)

    # Select Random Forest as specified
    best = next(r for r in results if r["name"] == "Random Forest")
    final_pipeline = best["pipeline"]
    print(f"\n[INFO] Selected model: {best['name']} (MAE={best['mae']:.3f}, R2={best['r2']:.4f})")

    # Compute interval coverage on test set
    rf = final_pipeline.named_steps["m"]
    X_test_pre = final_pipeline.named_steps["pre"].transform(X_test)
    tree_preds = np.array([tree.predict(X_test_pre) for tree in rf.estimators_])
    lo = np.percentile(tree_preds, 10, axis=0)
    hi = np.percentile(tree_preds, 90, axis=0)
    coverage = np.mean((y_test.values >= lo) & (y_test.values <= hi))
    print(f"[INFO] Empirical 80% interval coverage on test set: {coverage:.3f} "
          f"(target ~0.80, not a calibrated prediction interval)")

    # Feature importance
    feat_names = NUMERICAL_FEATURES + CATEGORICAL_FEATURES
    importances = rf.feature_importances_
    feat_imp = dict(zip(feat_names, importances.tolist()))
    print("\n[INFO] Feature importances:")
    for feat, imp in sorted(feat_imp.items(), key=lambda x: -x[1]):
        print(f"  {feat:25s}: {imp:.4f}")

    # Save artifacts
    model_path = ARTIFACTS_DIR / "model.joblib"
    joblib.dump(final_pipeline, model_path)
    print(f"\n[INFO] Model saved to {model_path}")

    metrics = {
        "model_version": MODEL_VERSION,
        "trained_at": datetime.utcnow().isoformat(),
        "dataset": {
            "source": data_path or "synthetic_demonstration",
            "is_synthetic": data_path is None,
            "total_records": len(df),
            "train_records": len(X_train),
            "test_records": len(X_test),
            "warning": "Synthetic data only — not real patient records." if data_path is None else None,
        },
        "features": {"numerical": NUMERICAL_FEATURES, "categorical": CATEGORICAL_FEATURES},
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
            "actual_test_coverage": round(float(coverage), 4),
            "warning": "Not a statistically calibrated prediction interval. Coverage estimated on held-out test set.",
        },
        "feature_importance": feat_imp,
    }

    metrics_path = ARTIFACTS_DIR / "metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"[INFO] Metrics saved to {metrics_path}")

    # Save categorical categories for each feature (for validation)
    cat_encoder = final_pipeline.named_steps["pre"].named_transformers_["cat"].named_steps["encode"]
    categories = {feat: list(cats) for feat, cats in zip(CATEGORICAL_FEATURES, cat_encoder.categories_)}
    cats_path = ARTIFACTS_DIR / "categories.json"
    with open(cats_path, "w") as f:
        json.dump(categories, f, indent=2)

    print("\n[INFO] Training complete.")
    return final_pipeline, metrics


if __name__ == "__main__":
    train()
