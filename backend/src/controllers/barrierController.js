const DischargeBarrier = require("../models/DischargeBarrier");
const audit = require("../utils/audit");

exports.getBarriers = async (req, res, next) => {
  try {
    const { admissionId, status, priority, page = 1, limit = 20 } = req.query;
    const query = {};
    if (admissionId) query.admissionId = admissionId;
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [barriers, total] = await Promise.all([
      DischargeBarrier.find(query)
        .populate("assignedTo", "name email")
        .populate("createdBy", "name")
        .populate("admissionId", "medicalCondition admissionDate")
        .populate("patientProfileId", "name demoId")
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      DischargeBarrier.countDocuments(query),
    ]);
    res.json({ barriers, total });
  } catch (err) { next(err); }
};

exports.createBarrier = async (req, res, next) => {
  try {
    const barrier = await DischargeBarrier.create({ ...req.body, createdBy: req.user._id });
    await audit(req, { action: "CREATE_BARRIER", category: "barrier", targetId: barrier._id });
    res.status(201).json({ barrier });
  } catch (err) { next(err); }
};

exports.updateBarrier = async (req, res, next) => {
  try {
    const barrier = await DischargeBarrier.findById(req.params.id);
    if (!barrier) return res.status(404).json({ error: "Barrier not found" });

    const { status, priority, notes, assignedTo } = req.body;
    if (status) barrier.status = status;
    if (priority) barrier.priority = priority;
    if (notes !== undefined) barrier.notes = notes;
    if (assignedTo !== undefined) barrier.assignedTo = assignedTo;
    if (status === "resolved") barrier.resolvedAt = new Date();
    await barrier.save();

    await audit(req, { action: "UPDATE_BARRIER", category: "barrier", targetId: barrier._id, details: { status } });
    res.json({ barrier });
  } catch (err) { next(err); }
};
