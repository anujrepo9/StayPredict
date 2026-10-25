const Bed = require("../models/Bed");
const Ward = require("../models/Ward");
const BedCleaningRecord = require("../models/BedCleaningRecord");
const audit = require("../utils/audit");
const { validationResult } = require("express-validator");

exports.getWards = async (req, res, next) => {
  try {
    const wards = await Ward.find({ isActive: true }).sort("name");
    // Attach bed stats per ward
    const result = await Promise.all(wards.map(async (ward) => {
      const beds = await Bed.find({ wardId: ward._id });
      return {
        ...ward.toObject(),
        bedStats: {
          total: beds.length,
          available: beds.filter(b => b.status === "available").length,
          occupied: beds.filter(b => b.status === "occupied").length,
          cleaning: beds.filter(b => b.status === "cleaning").length,
          out_of_service: beds.filter(b => b.status === "out_of_service").length,
        },
      };
    }));
    res.json({ wards: result });
  } catch (err) { next(err); }
};

exports.createWard = async (req, res, next) => {
  try {
    const ward = await Ward.create(req.body);
    res.status(201).json({ ward });
  } catch (err) { next(err); }
};

exports.getBeds = async (req, res, next) => {
  try {
    const { wardId, status } = req.query;
    const query = {};
    if (wardId) query.wardId = wardId;
    if (status) query.status = status;
    const beds = await Bed.find(query)
      .populate("wardId", "name type")
      .populate("currentAdmissionId", "patientProfileId status")
      .sort("bedNumber");
    res.json({ beds });
  } catch (err) { next(err); }
};

exports.createBed = async (req, res, next) => {
  try {
    const bed = await Bed.create(req.body);
    res.status(201).json({ bed });
  } catch (err) { next(err); }
};

exports.updateBedStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const bed = await Bed.findById(req.params.id);
    if (!bed) return res.status(404).json({ error: "Bed not found" });

    // Valid transitions
    const allowed = {
      available: ["occupied", "out_of_service"],
      occupied: ["cleaning"],
      cleaning: ["available", "out_of_service"],
      out_of_service: ["available"],
    };
    if (!allowed[bed.status]?.includes(status)) {
      return res.status(400).json({
        error: `Cannot transition bed from '${bed.status}' to '${status}'`,
      });
    }

    const prevStatus = bed.status;
    bed.status = status;
    if (notes) bed.notes = notes;
    if (status !== "occupied") bed.currentAdmissionId = null;
    await bed.save();

    // Create cleaning record when status → cleaning
    if (status === "cleaning") {
      await BedCleaningRecord.create({
        bedId: bed._id,
        wardId: bed.wardId,
        startedAt: new Date(),
        cleanedBy: req.user._id,
        status: "in_progress",
      });
    }
    // Complete cleaning record when cleaning → available
    if (prevStatus === "cleaning" && status === "available") {
      const record = await BedCleaningRecord.findOne({ bedId: bed._id, status: "in_progress" }).sort("-startedAt");
      if (record) {
        record.completedAt = new Date();
        record.status = "completed";
        record.turnaroundMinutes = Math.round((record.completedAt - record.startedAt) / 60000);
        await record.save();
      }
    }

    await audit(req, { action: "BED_STATUS_CHANGE", category: "bed", targetId: bed._id, targetModel: "Bed", details: { from: prevStatus, to: status } });
    res.json({ bed });
  } catch (err) { next(err); }
};
