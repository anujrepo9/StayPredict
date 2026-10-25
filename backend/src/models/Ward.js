const mongoose = require("mongoose");

const wardSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  type: { type: String, enum: ["General", "ICU", "Emergency", "Surgical", "Pediatric", "Maternity", "Oncology"], required: true },
  totalBeds: { type: Number, required: true, min: 1 },
  floor: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
  notes: String,
}, { timestamps: true });

module.exports = mongoose.model("Ward", wardSchema);
