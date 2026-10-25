const Admission = require("../models/Admission");
const Prediction = require("../models/Prediction");
const Bed = require("../models/Bed");
const DischargeBarrier = require("../models/DischargeBarrier");
const BedCleaningRecord = require("../models/BedCleaningRecord");
const Ward = require("../models/Ward");

exports.getSummary = async (req, res, next) => {
  try {
    const [
      totalAdmissions,
      activeAdmissions,
      predictions,
      beds,
      openBarriers,
      wardCount,
    ] = await Promise.all([
      Admission.countDocuments(),
      Admission.countDocuments({ status: { $in: ["admitted", "under_treatment", "pending_discharge"] } }),
      Prediction.find().sort({ predictedAt: -1 }).limit(500),
      Bed.find(),
      DischargeBarrier.countDocuments({ status: { $ne: "resolved" } }),
      Ward.countDocuments({ isActive: true }),
    ]);

    const availableBeds = beds.filter(b => b.status === "available").length;
    const cleaningBeds = beds.filter(b => b.status === "cleaning").length;
    const totalBeds = beds.length;

    // Average predicted LOS from recent predictions
    const avgPredictedLos = predictions.length
      ? (predictions.reduce((s, p) => s + p.predictedLosDays, 0) / predictions.length).toFixed(1)
      : null;

    const prolongedFlag = predictions.filter(p => p.prolongedStayProbability > 0.65).length;

    // LOS distribution (buckets: 1-3, 4-7, 8-14, 15+)
    const losBuckets = [
      { range: "1-3 days", count: predictions.filter(p => p.predictedLosDays <= 3).length },
      { range: "4-7 days", count: predictions.filter(p => p.predictedLosDays > 3 && p.predictedLosDays <= 7).length },
      { range: "8-14 days", count: predictions.filter(p => p.predictedLosDays > 7 && p.predictedLosDays <= 14).length },
      { range: "15+ days", count: predictions.filter(p => p.predictedLosDays > 14).length },
    ];

    // Risk distribution
    const riskDist = {
      "Low Risk": predictions.filter(p => p.riskCategory === "Low Risk").length,
      "Standard Risk": predictions.filter(p => p.riskCategory === "Standard Risk").length,
      "Elevated Risk": predictions.filter(p => p.riskCategory === "Elevated Risk").length,
    };

    // Admission trend: last 7 days
    const now = new Date();
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const from = new Date(d.setHours(0, 0, 0, 0));
      const to = new Date(d.setHours(23, 59, 59, 999));
      const count = await Admission.countDocuments({ admissionDate: { $gte: from, $lte: to } });
      trend.push({ date: from.toISOString().slice(0, 10), admissions: count });
    }

    res.json({
      summary: {
        totalAdmissions,
        activeAdmissions,
        availableBeds,
        totalBeds,
        cleaningBeds,
        avgPredictedLos: avgPredictedLos ? parseFloat(avgPredictedLos) : null,
        prolongedFlagCount: prolongedFlag,
        openBarriers,
        wardCount,
      },
      losBuckets,
      riskDistribution: riskDist,
      admissionTrend: trend,
    });
  } catch (err) { next(err); }
};
