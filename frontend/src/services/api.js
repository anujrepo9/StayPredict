import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({ baseURL: BASE, timeout: 30000 });

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sp_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global response handler
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("sp_token");
      localStorage.removeItem("sp_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────
export const authApi = {
  login: (data) => api.post("/auth/login", data),
  register: (data) => api.post("/auth/register", data),
  me: () => api.get("/auth/me"),
};

// ── Dashboard ─────────────────────────────────────
export const dashboardApi = {
  summary: () => api.get("/dashboard/summary"),
};

// ── Patient Profiles ──────────────────────────────
export const profileApi = {
  list: (search) => api.get("/patient-profiles", { params: { search } }),
  create: (data) => api.post("/patient-profiles", data),
  myProfile: () => api.get("/patients/me"),
  myAdmissions: () => api.get("/patients/me/admissions"),
};

// ── Admissions ────────────────────────────────────
export const admissionApi = {
  list: (params) => api.get("/admissions", { params }),
  get: (id) => api.get(`/admissions/${id}`),
  create: (data) => api.post("/admissions", data),
  update: (id, data) => api.patch(`/admissions/${id}`, data),
  predict: (id) => api.post(`/admissions/${id}/predict`),
};

// ── Predictions ───────────────────────────────────
export const predictionApi = {
  list: (params) => api.get("/predictions", { params }),
  get: (id) => api.get(`/predictions/${id}`),
};

// ── Barriers ──────────────────────────────────────
export const barrierApi = {
  list: (params) => api.get("/barriers", { params }),
  create: (data) => api.post("/barriers", data),
  update: (id, data) => api.patch(`/barriers/${id}`, data),
};

// ── Beds & Wards ──────────────────────────────────
export const wardApi = {
  list: () => api.get("/wards"),
  create: (data) => api.post("/wards", data),
};
export const bedApi = {
  list: (params) => api.get("/beds", { params }),
  create: (data) => api.post("/beds", data),
  updateStatus: (id, data) => api.patch(`/beds/${id}/status`, data),
};

// ── Analytics ─────────────────────────────────────
export const analyticsApi = {
  overview: () => api.get("/analytics/overview"),
  model: () => api.get("/analytics/model"),
};

// ── Admin ─────────────────────────────────────────
export const adminApi = {
  users: (params) => api.get("/admin/users", { params }),
  updateUser: (id, data) => api.patch(`/admin/users/${id}`, data),
  auditLogs: (params) => api.get("/admin/audit-logs", { params }),
  downloadCsv: () => `${BASE}/reports/admissions.csv`,
};

export default api;
