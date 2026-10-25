const { validationResult } = require("express-validator");
const Admission = require("../models/Admission");
const PatientProfile = require("../models/PatientProfile");
const Prediction = require("../models/Prediction");
const Bed = require("../models/Bed");
const audit = require("../utils/audit");
const mlService = require("../services/mlService");

exports.getAdmissions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const query = {};
    if (status) query.status = status;

    // Patients only see their own
    if (req.user.role === "patient") {
      const profile = await PatientProfile.findOne({ userId: req.user._id });
      if (!profile) return res.json({ admissions: [], total: 0 });
      query.patientProfileId = profile._id;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [admissions, total] = await Promise.all([
      Admission.find(query)
        .populate("patientProfileId", "name demoId age gender")
        .populate("wardId", "name type")
        .populate("bedId", "bedNumber")
        .populate("latestPredictionId", "predictedLosDays riskCategory")
        .sort({ admissionDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Admission.countDocuments(query),
    ]);
    res.json({ admissions, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
};

exports.createAdmission = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: "Validation failed", details: errors.array() });

    const { patientProfileId, admissionType, medicalCondition, insurance, bedId, wardId, notes } = req.body;

    const profile = await PatientProfile.findById(patientProfileId);
    if (!profile) return res.status(404).json({ error: "Patient profile not found" });

    // Check bed availability
    if (bedId) {
      const bed = await Bed.findById(bedId);
      if (!bed || bed.status !== "available") {
        return res.status(409).json({ error: "Selected bed is not available" });
      }
    }

    const featureSnapshot = {
      age: profile.age,
      gender: profile.gender,
      blood_group: profile.bloodGroup,
      medical_condition: medicalCondition,
      admission_type: admissionType,
      insurance,
    };

    const admission = await Admission.create({
      patientProfileId,
      admittedBy: req.user._id,
      bedId: bedId || undefined,
      wardId: wardId || undefined,
      admissionType,
      medicalCondition,
      insurance,
      featureSnapshot,
      notes,
    });

    // Mark bed occupied
    if (bedId) {
      await Bed.findByIdAndUpdate(bedId, { status: "occupied", currentAdmissionId: admission._id });
    }

    await audit(req, { action: "CREATE_ADMISSION", category: "admission", targetId: admission._id, targetModel: "Admission" });
    res.status(201).json({ admission });
  } catch (err) { next(err); }
};

exports.getAdmission = async (req, res, next) => {
  try {
    const admission = await Admission.findById(req.params.id)
      .populate("patientProfileId")
      .populate("wardId", "name type")
      .populate("bedId", "bedNumber")
      .populate("latestPredictionId");

    if (!admission) return res.status(404).json({ error: "Admission not found" });

    // Patient role: can only see own admission
    if (req.user.role === "patient") {
      const profile = await PatientProfile.findOne({ userId: req.user._id });
      if (!profile || !admission.patientProfileId._id.equals(profile._id)) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    res.json({ admission });
  } catch (err) { next(err); }
};

exports.updateAdmission = async (req, res, next) => {
  try {
    const { status, notes, dischargeDate } = req.body;
    const admission = await Admission.findById(req.params.id);
    if (!admission) return res.status(404).json({ error: "Admission not found" });

    if (status) admission.status = status;
    if (notes) admission.notes = notes;
    if (status === "discharged") {
      admission.dischargeDate = dischargeDate ? new Date(dischargeDate) : new Date();
      const days = (admission.dischargeDate - admission.admissionDate) / (1000 * 60 * 60 * 24);
      admission.actualLos = Math.round(days * 10) / 10;

      // Free the bed
      if (admission.bedId) {
        await Bed.findByIdAndUpdate(admission.bedId, {
          status: "cleaning",
          currentAdmissionId: null,
          lastDischargedAt: new Date(),
        });
      }
    }
    await admission.save();
    await audit(req, { action: "UPDATE_ADMISSION", category: "admission", targetId: admission._id, targetModel: "Admission", details: { status } });
    res.json({ admission });
  } catch (err) { next(err); }
};

exports.predictForAdmission = async (req, res, next) => {
  try {
    const admission = await Admission.findById(req.params.id).populate("patientProfileId");
    if (!admission) return res.status(404).json({ error: "Admission not found" });

    const features = admission.featureSnapshot;
    const mlResult = await mlService.predict(features);

    const prediction = await Prediction.create({
      admissionId: admission._id,
      patientProfileId: admission.patientProfileId._id,
      requestedBy: req.user._id,
      inputFeatures: features,
      predictedLosDays: mlResult.predicted_los_days,
      intervalLower: mlResult.prediction_interval?.lower,
      intervalHigh: mlResult.prediction_interval?.upper,
      prolongedStayProbability: mlResult.prolonged_stay_probability,
      riskCategory: mlResult.risk_category,
      modelVersion: mlResult.model_version,
      predictedAt: mlResult.predicted_at || new Date(),
    });

    admission.latestPredictionId = prediction._id;
    await admission.save();

    await audit(req, { action: "PREDICT_LOS", category: "prediction", targetId: prediction._id, targetModel: "Prediction" });
    res.json({ prediction });
  } catch (err) { next(err); }
};
