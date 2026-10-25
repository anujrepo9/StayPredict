"""
Predictor — loads the trained pipeline and serves predictions.
"""
import json
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from datetime import datetime, timezone

from app.schemas import PredictRequest, PredictResponse, PredictionInterval, ModelInfoResponse

ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "model.joblib"
METRICS_PATH = ARTIFACTS_DIR / "metrics.json"

NUMERICAL_FEATURES = ["age"]
CATEGORICAL_FEATURES = [
    "gender", "blood_group", "medical_condition", "admission_type", "insurance"
]
ALL_FEATURES = NUMERICAL_FEATURES + CATEGORICAL_FEATURES


class Predictor:
    def __init__(self):
        self._pipeline = None
        self._metrics = None
        self._load()

    def _load(self):
        if MODEL_PATH.exists():
            try:
                self._pipeline = joblib.load(MODEL_PATH)
                print(f"[INFO] Model loaded from {MODEL_PATH}")
            except Exception as e:
                print(f"[ERROR] Failed to load model: {e}")
        else:
            print(f"[WARN] Model artifact not found at {MODEL_PATH}. Run training script.")

        if METRICS_PATH.exists():
            with open(METRICS_PATH) as f:
                self._metrics = json.load(f)

    def is_loaded(self) -> bool:
        return self._pipeline is not None

    def model_version(self) -> str | None:
        if self._metrics:
            return self._metrics.get("model_version")
        return None

    def get_model_info(self) -> ModelInfoResponse:
        m = self._metrics or {}
        ds = m.get("dataset", {})
        metrics = m.get("test_metrics", {})
        return ModelInfoResponse(
            model_version=m.get("model_version", "unknown"),
            trained_at=m.get("trained_at"),
            dataset_source=ds.get("source", "unknown"),
            is_synthetic_data=ds.get("is_synthetic", True),
            train_records=ds.get("train_records"),
            test_records=ds.get("test_records"),
            mae=metrics.get("mae"),
            rmse=metrics.get("rmse"),
            r2=metrics.get("r2"),
            features=m.get("features", {}),
            feature_importance=m.get("feature_importance"),
            interval_info=m.get("interval_info"),
        )

    def predict(self, request: PredictRequest) -> PredictResponse:
        if not self.is_loaded():
            raise ValueError("Model not loaded")

        df = pd.DataFrame([{
            "age": request.age,
            "gender": request.gender,
            "blood_group": request.blood_group,
            "medical_condition": request.medical_condition,
            "admission_type": request.admission_type,
            "insurance": request.insurance,
        }], columns=ALL_FEATURES)

        pipeline = self._pipeline
        preprocessor = pipeline.named_steps["pre"]
        rf = pipeline.named_steps["m"]

        # Preprocess through the pipeline's preprocessor step
        X_pre = preprocessor.transform(df)

        # Get per-tree predictions for uncertainty (using pre-processed data)
        tree_preds = np.array([tree.predict(X_pre) for tree in rf.estimators_]).flatten()
        point_pred = float(np.clip(rf.predict(X_pre)[0], 1.0, None))
        lo = float(np.clip(np.percentile(tree_preds, 10), 1.0, None))
        hi = float(np.clip(np.percentile(tree_preds, 90), 1.0, None))

        # Prolonged stay probability (fraction of trees predicting > 14 days)
        prolonged_prob = float(np.mean(tree_preds > 14.0))

        # Risk category
        if prolonged_prob < 0.35:
            risk = "Low Risk"
        elif prolonged_prob <= 0.65:
            risk = "Standard Risk"
        else:
            risk = "Elevated Risk"

        version = self.model_version() or "unknown"

        return PredictResponse(
            predicted_los_days=round(point_pred, 1),
            prediction_interval=PredictionInterval(
                lower=round(lo, 1),
                upper=round(hi, 1),
            ),
            prolonged_stay_probability=round(prolonged_prob, 4),
            risk_category=risk,
            model_version=version,
            predicted_at=datetime.now(timezone.utc),
        )


predictor = Predictor()
