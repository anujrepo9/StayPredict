const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const Admission = require("../models/Admission");
const { createObjectCsvStringifier } = require("../utils/csv");

exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(),
    ]);
    res.json({ users, total });
  } catch (err) { next(err); }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { role, isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    await user.save();
    res.json({ user });
  } catch (err) { next(err); }
};

exports.getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, category } = req.query;
    const query = category ? { category } : {};
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate("performedBy", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(query),
    ]);
    res.json({ logs, total });
  } catch (err) { next(err); }
};

exports.downloadAdmissionsCSV = async (req, res, next) => {
  try {
    const admissions = await Admission.find()
      .populate("patientProfileId", "name demoId age gender")
      .populate("wardId", "name")
      .populate("bedId", "bedNumber")
      .populate("latestPredictionId", "predictedLosDays riskCategory")
      .sort({ admissionDate: -1 })
      .limit(5000);

    const rows = admissions.map(a => ({
      id: a._id,
      patient_demo_id: a.patientProfileId?.demoId || "",
      patient_name: a.patientProfileId?.name || "",
      age: a.patientProfileId?.age || "",
      gender: a.patientProfileId?.gender || "",
      admission_date: a.admissionDate?.toISOString().slice(0, 10) || "",
      admission_type: a.admissionType,
      medical_condition: a.medicalCondition,
      insurance: a.insurance,
      status: a.status,
      ward: a.wardId?.name || "",
      bed: a.bedId?.bedNumber || "",
      predicted_los: a.latestPredictionId?.predictedLosDays || "",
      risk_category: a.latestPredictionId?.riskCategory || "",
      discharge_date: a.dischargeDate?.toISOString().slice(0, 10) || "",
      actual_los: a.actualLos || "",
    }));

    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${r[h]}"`).join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=admissions.csv");
    res.send(csv);
  } catch (err) { next(err); }
};
