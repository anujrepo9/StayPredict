const AuditLog = require("../models/AuditLog");

const audit = async (req, { action, category, targetId, targetModel, details, success = true }) => {
  try {
    await AuditLog.create({
      action,
      category,
      performedBy: req.user?._id,
      performedByEmail: req.user?.email,
      targetId,
      targetModel,
      details,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      success,
    });
  } catch (e) {
    console.error("[AUDIT] Failed to write audit log:", e.message);
  }
};

module.exports = audit;
