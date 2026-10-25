const mongoose = require("mongoose");

const predictionSchema = new mongoose.Schema({
  admissionId: { type: mongoose.Schema.Types.ObjectId, ref: "Admission", required: true },
  patientProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "PatientProfile", required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // Feature snapshot used for this prediction
  inputFeatures: {
    age: Number,
    gender: String,
    blood_group: String,
    medical_condition: String,
    admission_type: String,
    insurance: String,
  },

  // Prediction outputs
  predictedLosDays: { type: Number, required: true },
  intervalLower: Number,
  intervalHigh: Number,
  prolongedStayProbability: Number,
  riskCategory: { type: String, enum: ["Low Risk", "Standard Risk", "Elevated Risk"] },
  modelVersion: String,
  predictedAt: { type: Date, default: Date.now },

  disclaimer: { type: String, default: "AI-generated estimate for operational planning only. Not a clinical diagnosis." },
}, { timestamps: true });

predictionSchema.index({ admissionId: 1, predictedAt: -1 });
predictionSchema.index({ riskCategory: 1 });

module.exports = mongoose.model("Prediction", predictionSchema);
