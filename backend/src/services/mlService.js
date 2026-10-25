const axios = require("axios");

const ML_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
const ML_KEY = process.env.ML_SERVICE_API_KEY || "dev-secret-key";

const client = axios.create({
  baseURL: ML_URL,
  timeout: 30000,
  headers: { "X-API-Key": ML_KEY, "Content-Type": "application/json" },
});

exports.predict = async (features) => {
  try {
    const { data } = await client.post("/predict", features);
    return data;
  } catch (err) {
    if (err.response?.status === 503) {
      throw Object.assign(new Error("ML model not loaded. Please run the training script."), { status: 503 });
    }
    if (err.response?.status === 422) {
      throw Object.assign(new Error("Invalid prediction features: " + JSON.stringify(err.response.data)), { status: 422 });
    }
    if (err.code === "ECONNREFUSED") {
      throw Object.assign(new Error("ML service unavailable. Start with: uvicorn app.main:app"), { status: 503 });
    }
    throw Object.assign(new Error("ML service error: " + (err.message || "unknown")), { status: 502 });
  }
};

exports.getModelInfo = async () => {
  try {
    const { data } = await client.get("/model/info");
    return data;
  } catch (err) {
    return null;
  }
};

exports.health = async () => {
  try {
    const { data } = await client.get("/health");
    return data;
  } catch (err) {
    return { status: "unreachable" };
  }
};
