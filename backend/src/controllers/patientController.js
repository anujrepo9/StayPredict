const PatientProfile = require("../models/PatientProfile");
const Admission = require("../models/Admission");

exports.getMyProfile = async (req, res, next) => {
  try {
    const profile = await PatientProfile.findOne({ userId: req.user._id });
    if (!profile) return res.status(404).json({ error: "Patient profile not found" });
    res.json({ profile });
  } catch (err) { next(err); }
};

exports.getMyAdmissions = async (req, res, next) => {
  try {
    const profile = await PatientProfile.findOne({ userId: req.user._id });
    if (!profile) return res.json({ admissions: [] });
    const admissions = await Admission.find({ patientProfileId: profile._id })
      .populate("latestPredictionId")
      .populate("wardId", "name type")
      .populate("bedId", "bedNumber")
      .sort({ admissionDate: -1 });
    res.json({ admissions });
  } catch (err) { next(err); }
};
