const router = require("express").Router();
const { authenticate, adminOnly, staffOrAdmin } = require("../middleware/auth");

// Auth
router.use("/auth", require("./auth"));

// Dashboard
router.get("/dashboard/summary", authenticate, require("../controllers/dashboardController").getSummary);

// Admissions
const adm = require("../controllers/admissionController");
router.get("/admissions", authenticate, adm.getAdmissions);
router.post("/admissions", authenticate, staffOrAdmin, adm.createAdmission);
router.get("/admissions/:id", authenticate, adm.getAdmission);
router.patch("/admissions/:id", authenticate, staffOrAdmin, adm.updateAdmission);
router.post("/admissions/:id/predict", authenticate, staffOrAdmin, adm.predictForAdmission);

// Predictions
const pred = require("../controllers/predictionController");
router.get("/predictions", authenticate, pred.getPredictions);
router.get("/predictions/:id", authenticate, pred.getPrediction);

// Patients (own data)
const pat = require("../controllers/patientController");
router.get("/patients/me", authenticate, pat.getMyProfile);
router.get("/patients/me/admissions", authenticate, pat.getMyAdmissions);

// Patient profiles (staff/admin)
const PatientProfile = require("../models/PatientProfile");
router.get("/patient-profiles", authenticate, staffOrAdmin, async (req, res, next) => {
  try {
    const { search } = req.query;
    const query = search ? { $or: [{ name: new RegExp(search, "i") }, { demoId: new RegExp(search, "i") }] } : {};
    const profiles = await PatientProfile.find(query).limit(50);
    res.json({ profiles });
  } catch (err) { next(err); }
});
router.post("/patient-profiles", authenticate, staffOrAdmin, async (req, res, next) => {
  try {
    const profile = await PatientProfile.create(req.body);
    res.status(201).json({ profile });
  } catch (err) { next(err); }
});

// Discharge barriers
const bar = require("../controllers/barrierController");
router.get("/barriers", authenticate, bar.getBarriers);
router.post("/barriers", authenticate, staffOrAdmin, bar.createBarrier);
router.patch("/barriers/:id", authenticate, staffOrAdmin, bar.updateBarrier);

// Beds & Wards
const bed = require("../controllers/bedController");
router.get("/wards", authenticate, bed.getWards);
router.post("/wards", authenticate, adminOnly, bed.createWard);
router.get("/beds", authenticate, bed.getBeds);
router.post("/beds", authenticate, adminOnly, bed.createBed);
router.patch("/beds/:id/status", authenticate, staffOrAdmin, bed.updateBedStatus);

// Analytics
const an = require("../controllers/analyticsController");
router.get("/analytics/overview", authenticate, staffOrAdmin, an.getOverview);
router.get("/analytics/model", authenticate, an.getModelMetrics);

// Admin
const admin = require("../controllers/adminController");
router.get("/admin/users", authenticate, adminOnly, admin.getUsers);
router.patch("/admin/users/:id", authenticate, adminOnly, admin.updateUser);
router.get("/admin/audit-logs", authenticate, adminOnly, admin.getAuditLogs);
router.get("/reports/admissions.csv", authenticate, staffOrAdmin, admin.downloadAdmissionsCSV);

// Health
router.get("/health", (req, res) => res.json({ status: "ok", service: "staypredict-api", time: new Date() }));

module.exports = router;
