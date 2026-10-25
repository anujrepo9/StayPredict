/**
 * Seeds demo data: wards, beds, patient profiles, admissions, discharge barriers.
 * All data is fictional for demonstration purposes only.
 * Run: node scripts/seed_demo_data.js  (from the staypredict/ root)
 */
const path = require("path");
const backendDir = path.join(__dirname, "../backend");

require(path.join(backendDir, "node_modules/dotenv")).config({
  path: path.join(backendDir, ".env"),
});

const mongoose = require(path.join(backendDir, "node_modules/mongoose"));
const bcrypt = require(path.join(backendDir, "node_modules/bcryptjs"));

const URI = process.env.MONGODB_URI || "mongodb://localhost:27017/staypredict";

// ── Minimal inline schemas ──────────────────────────────────────────────────
const mkModel = (name, schema) => mongoose.models[name] || mongoose.model(name, new mongoose.Schema(schema, { timestamps: true }));

const User = mkModel("User", { name: String, email: { type: String, unique: true }, password: String, role: String, isActive: Boolean });
const Ward = mkModel("Ward", { name: String, type: String, totalBeds: Number, floor: Number, isActive: Boolean });
const Bed = mkModel("Bed", { bedNumber: String, wardId: mongoose.Schema.Types.ObjectId, status: String, currentAdmissionId: { type: mongoose.Schema.Types.ObjectId, default: null } });
const PatientProfile = mkModel("PatientProfile", { demoId: { type: String, unique: true }, name: String, age: Number, gender: String, bloodGroup: String, userId: mongoose.Schema.Types.ObjectId });
const Admission = mkModel("Admission", { patientProfileId: mongoose.Schema.Types.ObjectId, admittedBy: mongoose.Schema.Types.ObjectId, bedId: mongoose.Schema.Types.ObjectId, wardId: mongoose.Schema.Types.ObjectId, admissionDate: Date, admissionType: String, medicalCondition: String, insurance: String, featureSnapshot: Object, status: String, latestPredictionId: mongoose.Schema.Types.ObjectId, notes: String });
const Prediction = mkModel("Prediction", { admissionId: mongoose.Schema.Types.ObjectId, patientProfileId: mongoose.Schema.Types.ObjectId, requestedBy: mongoose.Schema.Types.ObjectId, inputFeatures: Object, predictedLosDays: Number, intervalLower: Number, intervalHigh: Number, prolongedStayProbability: Number, riskCategory: String, modelVersion: String, predictedAt: Date });
const DischargeBarrier = mkModel("DischargeBarrier", { admissionId: mongoose.Schema.Types.ObjectId, patientProfileId: mongoose.Schema.Types.ObjectId, type: String, status: String, priority: String, description: String, createdBy: mongoose.Schema.Types.ObjectId, notes: String });

async function seed() {
  await mongoose.connect(URI);
  console.log("[DB] Connected");

  // ── Staff user ─────────────────────────────────────────────────────────
  let staffUser = await User.findOne({ email: "staff@staypredict.demo" });
  if (!staffUser) {
    staffUser = await User.create({ name: "Dr. Sarah Chen", email: "staff@staypredict.demo", password: await bcrypt.hash("Staff@12345", 12), role: "staff", isActive: true });
    console.log("[OK] Staff user created: staff@staypredict.demo / Staff@12345");
  }

  // Patient user
  let patUser = await User.findOne({ email: "patient@staypredict.demo" });
  if (!patUser) {
    patUser = await User.create({ name: "John Demo", email: "patient@staypredict.demo", password: await bcrypt.hash("Patient@1", 12), role: "patient", isActive: true });
    console.log("[OK] Patient user: patient@staypredict.demo / Patient@1");
  }

  // ── Wards ──────────────────────────────────────────────────────────────
  const wardData = [
    { name: "General Ward A", type: "General", totalBeds: 20, floor: 1, isActive: true },
    { name: "ICU", type: "ICU", totalBeds: 8, floor: 2, isActive: true },
    { name: "Surgical Ward", type: "Surgical", totalBeds: 15, floor: 3, isActive: true },
    { name: "Emergency Ward", type: "Emergency", totalBeds: 10, floor: 1, isActive: true },
  ];
  const wards = [];
  for (const w of wardData) {
    let ward = await Ward.findOne({ name: w.name });
    if (!ward) ward = await Ward.create(w);
    wards.push(ward);
  }
  console.log(`[OK] ${wards.length} wards`);

  // ── Beds ───────────────────────────────────────────────────────────────
  const bedStatuses = ["available","available","available","occupied","occupied","cleaning","out_of_service"];
  let bedCount = 0;
  for (const ward of wards) {
    const numBeds = ward.totalBeds;
    for (let i = 1; i <= numBeds; i++) {
      const bedNumber = `${ward.name.charAt(0)}${ward.floor}${String(i).padStart(2,"0")}`;
      const exists = await Bed.findOne({ bedNumber, wardId: ward._id });
      if (!exists) {
        const status = bedStatuses[i % bedStatuses.length];
        await Bed.create({ bedNumber, wardId: ward._id, status });
        bedCount++;
      }
    }
  }
  console.log(`[OK] ${bedCount} beds created`);

  // ── Patient profiles ───────────────────────────────────────────────────
  const patientData = [
    { demoId: "PT-2024-001", name: "Alice Johnson", age: 67, gender: "Female", bloodGroup: "A+" },
    { demoId: "PT-2024-002", name: "Robert Smith", age: 54, gender: "Male", bloodGroup: "O+" },
    { demoId: "PT-2024-003", name: "Maria Garcia", age: 72, gender: "Female", bloodGroup: "B+" },
    { demoId: "PT-2024-004", name: "James Wilson", age: 45, gender: "Male", bloodGroup: "AB-" },
    { demoId: "PT-2024-005", name: "John Demo", age: 38, gender: "Male", bloodGroup: "O-", userId: patUser._id },
  ];
  const patients = [];
  for (const p of patientData) {
    let pat = await PatientProfile.findOne({ demoId: p.demoId });
    if (!pat) pat = await PatientProfile.create(p);
    patients.push(pat);
  }
  console.log(`[OK] ${patients.length} patient profiles`);

  // ── Admissions & Predictions ───────────────────────────────────────────
  const admData = [
    { patient: 0, cond: "Heart Disease", type: "Emergency", insurance: "Medicare", status: "under_treatment", los: 8.5, prob: 0.72, risk: "Elevated Risk", ward: 1, daysAgo: 3 },
    { patient: 1, cond: "Diabetes", type: "Elective", insurance: "Aetna", status: "admitted", los: 5.2, prob: 0.28, risk: "Low Risk", ward: 0, daysAgo: 1 },
    { patient: 2, cond: "Cancer", type: "Urgent", insurance: "Medicare", status: "pending_discharge", los: 12.0, prob: 0.81, risk: "Elevated Risk", ward: 2, daysAgo: 8 },
    { patient: 3, cond: "Fracture", type: "Emergency", insurance: "Blue Cross", status: "admitted", los: 4.5, prob: 0.40, risk: "Standard Risk", ward: 3, daysAgo: 0 },
    { patient: 4, cond: "Hypertension", type: "Elective", insurance: "Private", status: "admitted", los: 3.8, prob: 0.18, risk: "Low Risk", ward: 0, daysAgo: 2 },
  ];

  for (const a of admData) {
    const patient = patients[a.patient];
    const ward = wards[a.ward];
    const admDate = new Date(); admDate.setDate(admDate.getDate() - a.daysAgo);
    const existing = await Admission.findOne({ patientProfileId: patient._id, status: { $ne: "discharged" } });
    if (existing) continue;

    const snap = { age: patient.age, gender: patient.gender, blood_group: patient.bloodGroup, medical_condition: a.cond, admission_type: a.type, insurance: a.insurance };
    const adm = await Admission.create({ patientProfileId: patient._id, admittedBy: staffUser._id, wardId: ward._id, admissionDate: admDate, admissionType: a.type, medicalCondition: a.cond, insurance: a.insurance, featureSnapshot: snap, status: a.status, notes: "Demo admission" });

    const pred = await Prediction.create({ admissionId: adm._id, patientProfileId: patient._id, requestedBy: staffUser._id, inputFeatures: snap, predictedLosDays: a.los, intervalLower: Math.max(1, a.los - 2.5), intervalHigh: a.los + 2.5, prolongedStayProbability: a.prob, riskCategory: a.risk, modelVersion: "1.0.0", predictedAt: admDate });
    adm.latestPredictionId = pred._id;
    await adm.save();
  }
  console.log("[OK] Admissions and predictions seeded");

  // ── Discharge Barriers ─────────────────────────────────────────────────
  const adms = await Admission.find({ status: { $in: ["under_treatment","pending_discharge"] } });
  for (const adm of adms.slice(0, 3)) {
    const existingBarrier = await DischargeBarrier.findOne({ admissionId: adm._id });
    if (!existingBarrier) {
      await DischargeBarrier.create({ admissionId: adm._id, patientProfileId: adm.patientProfileId, type: "pharmacy_authorization", status: "open", priority: "high", description: "Awaiting pharmacy sign-off on discharge medications.", createdBy: staffUser._id });
      await DischargeBarrier.create({ admissionId: adm._id, patientProfileId: adm.patientProfileId, type: "post_acute_placement", status: "in_progress", priority: "medium", description: "Coordinating post-acute rehabilitation placement.", createdBy: staffUser._id });
    }
  }
  console.log("[OK] Discharge barriers seeded");

  console.log("\n✅ Seed complete!\n");
  console.log("Demo credentials:");
  console.log("  Admin:   admin@staypredict.demo  /  Admin@12345");
  console.log("  Staff:   staff@staypredict.demo  /  Staff@12345");
  console.log("  Patient: patient@staypredict.demo / Patient@1\n");

  await mongoose.disconnect();
}

seed().catch(err => { console.error("[ERROR]", err.message); process.exit(1); });
