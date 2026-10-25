const mongoose = require("mongoose");

const cleaningSchema = new mongoose.Schema({
  bedId: { type: mongoose.Schema.Types.ObjectId, ref: "Bed", required: true },
  wardId: { type: mongoose.Schema.Types.ObjectId, ref: "Ward", required: true },
  startedAt: { type: Date, required: true },
  completedAt: Date,
  turnaroundMinutes: Number,
  status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },
  cleanedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  notes: String,
}, { timestamps: true });

cleaningSchema.post("save", function () {
  if (this.startedAt && this.completedAt) {
    this.turnaroundMinutes = Math.round((this.completedAt - this.startedAt) / 60000);
  }
});

module.exports = mongoose.model("BedCleaningRecord", cleaningSchema);
