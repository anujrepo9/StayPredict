"""
StayPredict ML Service — FastAPI
Serves LOS predictions from a trained Random Forest model.
Only the Express backend should call this service in production.
"""

import os
from fastapi import FastAPI, HTTPException, Security, status
from fastapi.security.api_key import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.schemas import PredictRequest, PredictResponse, ModelInfoResponse, HealthResponse
from app.predictor import predictor

load_dotenv()

API_KEY = os.getenv("ML_SERVICE_API_KEY", "dev-secret-key")
API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

app = FastAPI(
    title="StayPredict ML Service",
    description="Hospital Length of Stay prediction service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000"],  # Only Express backend
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


async def require_api_key(key: str = Security(api_key_header)):
    if key != API_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key")
    return key


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health():
    return HealthResponse(
        status="ok",
        model_loaded=predictor.is_loaded(),
        model_version=predictor.model_version(),
    )


@app.get("/model/info", response_model=ModelInfoResponse, tags=["Model"])
async def model_info():
    if not predictor.is_loaded():
        raise HTTPException(status_code=503, detail="Model not loaded. Run training script first.")
    return predictor.get_model_info()


@app.post("/predict", response_model=PredictResponse, tags=["Prediction"])
async def predict(request: PredictRequest, _key: str = Security(require_api_key)):
    if not predictor.is_loaded():
        raise HTTPException(
            status_code=503,
            detail="Model artifact not found. Run: python -m training.train from ml-service/",
        )
    try:
        result = predictor.predict(request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Prediction failed. Check service logs.")
