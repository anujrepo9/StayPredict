const mongoose = require("mongoose");

const barrierSchema = new mongoose.Schema({
  admissionId: { type: mongoose.Schema.Types.ObjectId, ref: "Admission", required: true },
  patientProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "PatientProfile", required: true },
  type: {
    type: String,
    enum: ["pharmacy_authorization", "medical_transport", "post_acute_placement",
           "insurance_approval", "family_notification", "equipment", "other"],
    required: true,
  },
  status: { type: String, enum: ["open", "in_progress", "resolved"], default: "open" },
  priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  description: { type: String, required: true, maxlength: 500 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  notes: { type: String, maxlength: 1000 },
  resolvedAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

barrierSchema.index({ admissionId: 1, status: 1 });
barrierSchema.index({ status: 1, priority: -1 });

module.exports = mongoose.model("DischargeBarrier", barrierSchema);
