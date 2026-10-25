const mongoose = require("mongoose");

const patientProfileSchema = new mongoose.Schema({
  demoId: { type: String, required: true, unique: true }, // non-sensitive demo identifier
  name: { type: String, required: true, trim: true },
  age: { type: Number, required: true, min: 0, max: 120 },
  gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
  bloodGroup: { type: String, enum: ["A+","A-","B+","B-","AB+","AB-","O+","O-"], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

patientProfileSchema.index({ demoId: 1 });

module.exports = mongoose.model("PatientProfile", patientProfileSchema);
