# StayPredict — AI-Based Hospital Length of Stay Prediction & Bed Management

A full-stack academic engineering project demonstrating machine learning integration in hospital operations.

---

## Architecture

```
Browser (React/Vite)
    ↕ REST API (Axios)
Express.js API Gateway (Node 22, port 5000)
    ↕ Mongoose ODM
MongoDB (local or Atlas)
    ↕ HTTP + API Key
FastAPI ML Service (Python, port 8000)
    └── Random Forest Regressor (scikit-learn, joblib)
```

## Features

| Module | Description |
|--------|-------------|
| Dashboard | Live census, LOS distribution, risk chart, 7-day trend |
| New Admission | Patient search/create → admission form → AI prediction |
| Admissions | Paginated table, status management, inline re-prediction |
| Predictions | History, risk filter, full detail view with interval chart |
| Discharge Barriers | Create/track pharmacy, transport, insurance barriers |
| Bed & Ward Management | Visual bed map, valid state transitions, cleaning records |
| Analytics | Monthly trend, LOS distribution, ward occupancy |
| ROI Calculator | Configurable scenario estimator with formula display |
| Model Info | Dataset info, metrics, feature importance, limitations |
| Patient Portal | Own admission, LOS estimate, 4-phase recovery roadmap |
| User Management | Role assignment, activate/deactivate (admin only) |
| Audit Log | Timestamped events by category (admin only) |

---

## Prerequisites

- **Node.js** v18+ (tested on v22)
- **Python** 3.10+ (tested on 3.12)
- **MongoDB** Community 6+ running locally  
  Download: https://www.mongodb.com/try/download/community
- **npm** v9+

---

## Quick Start

### 1. Clone / open project

```bash
cd staypredict
```

### 2. Install MongoDB (Windows)
Download and run the MongoDB Community installer.  
Start MongoDB service: `mongod --dbpath C:\data\db`

### 3. Set up the ML Service

```bash
cd ml-service
pip install -r requirements.txt   # add --break-system-packages on Linux

# Train the model (uses synthetic data if no real dataset provided)
python -m training.train

# Start the ML service
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

ML service will be available at http://localhost:8000  
Swagger docs: http://localhost:8000/docs

### 4. Set up the Backend

```bash
cd backend
cp .env.example .env          # edit if needed
npm install
node ../scripts/create_admin.js   # creates admin@staypredict.demo
node ../scripts/seed_demo_data.js # seeds wards, beds, patients, admissions
npm start
```

Backend API: http://localhost:5000/api/health

### 5. Set up the Frontend

```bash
cd frontend
cp .env.example .env.local    # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev
```

Frontend: http://localhost:5173

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@staypredict.demo | Admin@12345 |
| Staff | staff@staypredict.demo | Staff@12345 |
| Patient | patient@staypredict.demo | Patient@1 |

> Created by `seed_demo_data.js`. Change passwords before any real deployment.

---

## Environment Variables

### `backend/.env`

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/staypredict
JWT_SECRET=change-this-to-a-long-random-string
JWT_EXPIRES_IN=8h
ML_SERVICE_URL=http://localhost:8000
ML_SERVICE_API_KEY=dev-secret-key
ADMIN_EMAIL=admin@staypredict.demo
ADMIN_PASSWORD=Admin@12345
ADMIN_NAME=System Administrator
CORS_ORIGIN=http://localhost:5173
```

### `ml-service/.env`

```env
ML_SERVICE_API_KEY=dev-secret-key
DATASET_PATH=              # path to real CSV, leave empty for synthetic
PORT=8000
```

### `frontend/.env.local`

```env
VITE_API_URL=http://localhost:5000/api
```

---

## Running with a Real Dataset

If you have a healthcare dataset with compatible columns:

```bash
# Column names the training script maps automatically:
# Age, Gender, Blood Type, Medical Condition, Admission Type,
# Insurance Provider, Length of Stay

export DATASET_PATH=/path/to/your/dataset.csv
cd ml-service
python -m training.train
```

The script validates columns and falls back to synthetic data with a clear warning if columns are missing.

---

## Using MongoDB Atlas

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/staypredict
```

---

## Running Tests

### ML Service (Python)

```bash
cd ml-service
python -m pytest tests/ -v
# 15 tests — all pass
```

### Backend (Node/Jest)

```bash
# Requires MongoDB running
cd backend
npm test
```

Tests cover: auth, password hashing, RBAC, bed state transitions.

### Frontend Build Verification

```bash
cd frontend
npm run build
# Produces dist/ — verifies no import errors
```

---

## API Reference

All endpoints are prefixed `/api/`.

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/register | — | Register user |
| POST | /auth/login | — | Login, returns JWT |
| GET | /auth/me | Bearer | Current user |

### Admissions
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /admissions | staff/admin | List with pagination |
| POST | /admissions | staff/admin | Create admission |
| GET | /admissions/:id | all | Get detail |
| PATCH | /admissions/:id | staff/admin | Update status |
| POST | /admissions/:id/predict | staff/admin | Run LOS prediction |

### Other key endpoints
- `GET /dashboard/summary` — dashboard metrics
- `GET /predictions` — prediction history
- `GET /predictions/:id` — prediction detail
- `GET /barriers`, `POST /barriers`, `PATCH /barriers/:id`
- `GET /wards`, `POST /wards`, `GET /beds`, `POST /beds`, `PATCH /beds/:id/status`
- `GET /analytics/overview`, `GET /analytics/model`
- `GET /admin/users`, `PATCH /admin/users/:id`, `GET /admin/audit-logs`
- `GET /reports/admissions.csv`
- `GET /health`

---

## ML Model Card

| Item | Value |
|------|-------|
| Algorithm | Random Forest Regressor |
| Estimators | 200 trees |
| Max depth | 12 |
| Random state | 42 |
| Dataset | Synthetic (54,966 records) |
| Train/test split | 80/20 (random_state=42) |
| MAE | ~2.04 days |
| RMSE | ~2.55 days |
| R² | ~0.45 |
| Interval method | Empirical tree percentile (10th–90th) |

**Limitations:**
- Trained on synthetic data — real-world accuracy is unknown
- Prediction intervals are empirical, not statistically calibrated
- Prolonged-stay probability is experimental, not a calibrated clinical probability
- Not HIPAA-compliant; not certified for real hospital deployment

---

## Windows PowerShell Notes

```powershell
# Set env vars in PowerShell
$env:MONGODB_URI = "mongodb://localhost:27017/staypredict"

# If mongod not in PATH
& "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath C:\data\db

# Python virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## Project Structure

```
staypredict/
├── frontend/           React 18 + Vite + Recharts
├── backend/            Express.js API gateway
│   ├── src/
│   │   ├── models/     9 Mongoose models
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/ auth + error handler
│   │   └── services/  mlService.js proxy
│   └── tests/         Jest + supertest
├── ml-service/         Python FastAPI
│   ├── app/            main, schemas, predictor
│   ├── training/       train.py
│   ├── artifacts/      model.joblib, metrics.json
│   └── tests/          pytest
├── scripts/            seed_demo_data.js, create_admin.js
└── README.md
```

---

## Academic Disclaimer

This is an academic demonstration project for a BE engineering capstone. It is not HIPAA-compliant, not clinically validated, and not certified for real hospital use. The AI predictions are for operational planning illustration only. All patient data used is synthetic and fictional. Real deployment would require legal, clinical, privacy, security, and infrastructure review.
