const Admission = require("../models/Admission");
const Prediction = require("../models/Prediction");
const Bed = require("../models/Bed");
const Ward = require("../models/Ward");
const mlService = require("../services/mlService");

exports.getOverview = async (req, res, next) => {
  try {
    const [admissions, predictions, beds, wards] = await Promise.all([
      Admission.find().select("status admissionDate actualLos"),
      Prediction.find().select("predictedLosDays riskCategory prolongedStayProbability predictedAt"),
      Bed.find().select("status wardId"),
      Ward.find({ isActive: true }).select("name type totalBeds"),
    ]);

    // Monthly admission trend (last 6 months)
    const now = new Date();
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      const count = admissions.filter(a => a.admissionDate >= d && a.admissionDate < next).length;
      monthlyTrend.push({ month: label, admissions: count });
    }

    const losDistribution = [
      { range: "1-3", count: predictions.filter(p => p.predictedLosDays <= 3).length },
      { range: "4-7", count: predictions.filter(p => p.predictedLosDays > 3 && p.predictedLosDays <= 7).length },
      { range: "8-14", count: predictions.filter(p => p.predictedLosDays > 7 && p.predictedLosDays <= 14).length },
      { range: "15+", count: predictions.filter(p => p.predictedLosDays > 14).length },
    ];

    const wardOccupancy = await Promise.all(wards.map(async (w) => {
      const wardBeds = beds.filter(b => String(b.wardId) === String(w._id));
      return {
        name: w.name,
        type: w.type,
        total: wardBeds.length || w.totalBeds,
        occupied: wardBeds.filter(b => b.status === "occupied").length,
        available: wardBeds.filter(b => b.status === "available").length,
      };
    }));

    res.json({ monthlyTrend, losDistribution, wardOccupancy, totalPredictions: predictions.length });
  } catch (err) { next(err); }
};

exports.getModelMetrics = async (req, res, next) => {
  try {
    const info = await mlService.getModelInfo();
    res.json({ modelInfo: info });
  } catch (err) { next(err); }
};
