const mongoose = require("mongoose");

const BED_STATUSES = ["available", "occupied", "cleaning", "out_of_service"];

const bedSchema = new mongoose.Schema({
  bedNumber: { type: String, required: true },
  wardId: { type: mongoose.Schema.Types.ObjectId, ref: "Ward", required: true },
  status: { type: String, enum: BED_STATUSES, default: "available" },
  currentAdmissionId: { type: mongoose.Schema.Types.ObjectId, ref: "Admission", default: null },
  lastDischargedAt: Date,
  notes: String,
}, { timestamps: true });

bedSchema.index({ wardId: 1, bedNumber: 1 }, { unique: true });
bedSchema.index({ status: 1 });

module.exports = mongoose.model("Bed", bedSchema);
module.exports.BED_STATUSES = BED_STATUSES;
