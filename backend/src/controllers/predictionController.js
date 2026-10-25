const Prediction = require("../models/Prediction");
const PatientProfile = require("../models/PatientProfile");

exports.getPredictions = async (req, res, next) => {
  try {
    const { admissionId, riskCategory, page = 1, limit = 20 } = req.query;
    const query = {};
    if (admissionId) query.admissionId = admissionId;
    if (riskCategory) query.riskCategory = riskCategory;

    if (req.user.role === "patient") {
      const profile = await PatientProfile.findOne({ userId: req.user._id });
      if (!profile) return res.json({ predictions: [], total: 0 });
      query.patientProfileId = profile._id;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [predictions, total] = await Promise.all([
      Prediction.find(query)
        .populate("admissionId", "medicalCondition admissionType")
        .populate("patientProfileId", "name demoId")
        .sort({ predictedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Prediction.countDocuments(query),
    ]);
    res.json({ predictions, total });
  } catch (err) { next(err); }
};

exports.getPrediction = async (req, res, next) => {
  try {
    const prediction = await Prediction.findById(req.params.id)
      .populate("admissionId")
      .populate("patientProfileId", "name demoId age gender")
      .populate("requestedBy", "name");
    if (!prediction) return res.status(404).json({ error: "Prediction not found" });

    if (req.user.role === "patient") {
      const profile = await PatientProfile.findOne({ userId: req.user._id });
      if (!profile || !prediction.patientProfileId._id.equals(profile._id)) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    res.json({ prediction });
  } catch (err) { next(err); }
};
