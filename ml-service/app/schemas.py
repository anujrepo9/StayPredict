from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional
from datetime import datetime


VALID_GENDERS = ["Male", "Female", "Other"]
VALID_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
VALID_CONDITIONS = [
    "Diabetes", "Hypertension", "Heart Disease", "Asthma",
    "Cancer", "Arthritis", "Obesity", "Pneumonia", "COPD", "Fracture", "Other",
]
VALID_ADMISSION_TYPES = ["Elective", "Emergency", "Urgent"]
VALID_INSURANCES = [
    "Medicare", "Medicaid", "Private", "Aetna",
    "Blue Cross", "Cigna", "UnitedHealth", "None", "Other",
]


class PredictRequest(BaseModel):
    age: int = Field(..., ge=0, le=120, description="Patient age in years")
    gender: str = Field(..., description="Patient gender")
    blood_group: str = Field(..., description="Blood group e.g. A+")
    medical_condition: str = Field(..., description="Primary diagnosis at admission")
    admission_type: Literal["Elective", "Emergency", "Urgent"]
    insurance: str = Field(..., description="Insurance provider")

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v):
        if v not in VALID_GENDERS:
            return "Other"  # graceful fallback for unseen values
        return v

    @field_validator("blood_group")
    @classmethod
    def validate_blood_group(cls, v):
        if v not in VALID_BLOOD_GROUPS:
            raise ValueError(f"blood_group must be one of {VALID_BLOOD_GROUPS}")
        return v

    @field_validator("medical_condition")
    @classmethod
    def validate_condition(cls, v):
        if v not in VALID_CONDITIONS:
            return "Other"
        return v

    @field_validator("insurance")
    @classmethod
    def validate_insurance(cls, v):
        if v not in VALID_INSURANCES:
            return "Other"
        return v

    model_config = {"json_schema_extra": {
        "example": {
            "age": 55, "gender": "Male", "blood_group": "O+",
            "medical_condition": "Heart Disease", "admission_type": "Emergency",
            "insurance": "Medicare",
        }
    }}


class PredictionInterval(BaseModel):
    lower: float
    upper: float
    nominal_coverage: float = 0.80
    method: str = "empirical_tree_percentile"
    warning: str = "Not a statistically calibrated prediction interval"


class PredictResponse(BaseModel):
    predicted_los_days: float
    prediction_interval: PredictionInterval
    prolonged_stay_probability: float = Field(
        ..., description="Fraction of trees predicting >14 days. Experimental, not a calibrated probability."
    )
    risk_category: Literal["Low Risk", "Standard Risk", "Elevated Risk"]
    model_version: str
    predicted_at: datetime
    disclaimer: str = (
        "This is an AI-generated estimate for operational planning purposes only. "
        "It is not a clinical diagnosis or medically approved discharge timeline. "
        "Actual length of stay is determined by clinical staff."
    )


class ModelInfoResponse(BaseModel):
    model_version: str
    trained_at: Optional[str]
    dataset_source: str
    is_synthetic_data: bool
    train_records: Optional[int]
    test_records: Optional[int]
    mae: Optional[float]
    rmse: Optional[float]
    r2: Optional[float]
    features: dict
    feature_importance: Optional[dict]
    interval_info: Optional[dict]


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: Optional[str]
