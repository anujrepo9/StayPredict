const mongoose = require("mongoose");

const admissionSchema = new mongoose.Schema({
  patientProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "PatientProfile", required: true },
  admittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  bedId: { type: mongoose.Schema.Types.ObjectId, ref: "Bed" },
  wardId: { type: mongoose.Schema.Types.ObjectId, ref: "Ward" },

  // Admission-time features (model inputs — no post-admission data)
  admissionDate: { type: Date, required: true, default: Date.now },
  admissionType: { type: String, enum: ["Elective", "Emergency", "Urgent"], required: true },
  medicalCondition: { type: String, required: true },
  insurance: { type: String, required: true },
  // Snapshot of patient features at admission time (for audit)
  featureSnapshot: {
    age: Number,
    gender: String,
    blood_group: String,
    medical_condition: String,
    admission_type: String,
    insurance: String,
  },

  // Operational status
  status: {
    type: String,
    enum: ["admitted", "under_treatment", "pending_discharge", "discharged"],
    default: "admitted",
  },
  dischargeDate: Date,
  actualLos: Number, // computed on discharge

  // Link to latest prediction
  latestPredictionId: { type: mongoose.Schema.Types.ObjectId, ref: "Prediction" },
  notes: String,
}, { timestamps: true });

admissionSchema.index({ patientProfileId: 1, status: 1 });
admissionSchema.index({ status: 1, admissionDate: -1 });

module.exports = mongoose.model("Admission", admissionSchema);
