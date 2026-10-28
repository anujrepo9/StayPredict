/**
 * Seeds demo data from real CSV files:
 *   - patients.csv  → PatientProfile + Admission records
 *   - staff.csv     → Staff User accounts
 * Run: node scripts/seed_demo_data.js  (from staypredict/ root)
 */
const path = require("path");
const fs   = require("fs");
const backendDir = path.join(__dirname, "../backend");

require(path.join(backendDir, "node_modules/dotenv")).config({
  path: path.join(backendDir, ".env"),
});
const mongoose = require(path.join(backendDir, "node_modules/mongoose"));
const bcrypt   = require(path.join(backendDir, "node_modules/bcryptjs"));

const URI = process.env.MONGODB_URI || "mongodb://localhost:27017/staypredict";

// ── Inline minimal schemas ──────────────────────────────────────────────────
const mk = (name, schema) =>
  mongoose.models[name] || mongoose.model(name, new mongoose.Schema(schema, { timestamps: true }));

const User           = mk("User",           { name:String, email:{type:String,unique:true}, password:String, role:String, isActive:Boolean });
const Ward           = mk("Ward",           { name:String, type:String, totalBeds:Number, floor:Number, isActive:Boolean });
const Bed            = mk("Bed",            { bedNumber:String, wardId:mongoose.Schema.Types.ObjectId, status:String, currentAdmissionId:{type:mongoose.Schema.Types.ObjectId,default:null} });
const PatientProfile = mk("PatientProfile", { demoId:{type:String,unique:true}, name:String, age:Number, gender:String, bloodGroup:String, userId:mongoose.Schema.Types.ObjectId });
const Admission      = mk("Admission",      { patientProfileId:mongoose.Schema.Types.ObjectId, admittedBy:mongoose.Schema.Types.ObjectId, bedId:mongoose.Schema.Types.ObjectId, wardId:mongoose.Schema.Types.ObjectId, admissionDate:Date, dischargeDate:Date, admissionType:String, medicalCondition:String, insurance:String, featureSnapshot:Object, status:String, actualLos:Number, latestPredictionId:mongoose.Schema.Types.ObjectId, notes:String });
const Prediction     = mk("Prediction",     { admissionId:mongoose.Schema.Types.ObjectId, patientProfileId:mongoose.Schema.Types.ObjectId, requestedBy:mongoose.Schema.Types.ObjectId, inputFeatures:Object, predictedLosDays:Number, intervalLower:Number, intervalHigh:Number, prolongedStayProbability:Number, riskCategory:String, modelVersion:String, predictedAt:Date });
const DischargeBarrier = mk("DischargeBarrier", { admissionId:mongoose.Schema.Types.ObjectId, patientProfileId:mongoose.Schema.Types.ObjectId, type:String, status:String, priority:String, description:String, createdBy:mongoose.Schema.Types.ObjectId });

// ── Simple CSV parser (no extra deps) ──────────────────────────────────────
function parseCSV(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/"/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────
const SERVICE_TO_WARD_TYPE = {
  surgery: "Surgical", emergency: "Emergency",
  general_medicine: "General", ICU: "ICU",
};
const INSURANCES = ["Medicare","Medicaid","Private","Aetna","Blue Cross","Cigna","UnitedHealth","None"];
const CONDITIONS  = { surgery:"Fracture", emergency:"Heart Disease", general_medicine:"Diabetes", ICU:"COPD" };
const BLOOD_GROUPS = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];
const randPick = arr => arr[Math.floor(Math.random() * arr.length)];

function losToRisk(los) {
  const prob = los > 10 ? 0.80 : los > 7 ? 0.55 : 0.20;
  return {
    prob,
    risk: prob < 0.35 ? "Low Risk" : prob <= 0.65 ? "Standard Risk" : "Elevated Risk",
  };
}

async function seed() {
  await mongoose.connect(URI);
  console.log("[DB] Connected to", URI);

  // ── 1. Admin user ─────────────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL || "admin@staypredict.demo";
  let adminUser = await User.findOne({ email: adminEmail });
  if (!adminUser) {
    adminUser = await User.create({
      name: process.env.ADMIN_NAME || "System Administrator",
      email: adminEmail,
      password: await bcrypt.hash(process.env.ADMIN_PASSWORD || "Admin@12345", 12),
      role: "admin", isActive: true,
    });
    console.log(`[OK] Admin created: ${adminEmail}`);
  } else {
    console.log(`[SKIP] Admin already exists: ${adminEmail}`);
  }

  // ── 2. Staff users from staff.csv ─────────────────────────────────────────
  const CSV_DIR = path.join(__dirname, "../data");
  const staffCsvPath = path.join(CSV_DIR, "staff.csv");

  // Also try uploaded path
  const staffUploadPath = "/mnt/user-data/uploads/1792939509272_staff.csv";
  const staffPath = fs.existsSync(staffCsvPath) ? staffCsvPath
    : fs.existsSync(staffUploadPath) ? staffUploadPath : null;

  let seedStaffUser = await User.findOne({ email: "staff@staypredict.demo" });
  if (!seedStaffUser) {
    seedStaffUser = await User.create({
      name: "Dr. Sarah Chen", email: "staff@staypredict.demo",
      password: await bcrypt.hash("Staff@12345", 12), role: "staff", isActive: true,
    });
    console.log("[OK] Default staff user: staff@staypredict.demo / Staff@12345");
  }

  if (staffPath) {
    const staffRows = parseCSV(staffPath);
    let created = 0;
    for (const row of staffRows.slice(0, 20)) { // seed first 20 as demo users
      const email = `${row.staff_id}@staypredict.demo`.toLowerCase();
      const exists = await User.findOne({ email });
      if (!exists) {
        await User.create({
          name: row.staff_name, email,
          password: await bcrypt.hash("Staff@12345", 12),
          role: "staff", isActive: true,
        });
        created++;
      }
    }
    console.log(`[OK] ${created} staff users created from staff.csv`);
  } else {
    console.log("[WARN] staff.csv not found at data/ — place it at staypredict/data/staff.csv for full seeding");
  }

  // Patient demo user
  let patUser = await User.findOne({ email: "patient@staypredict.demo" });
  if (!patUser) {
    patUser = await User.create({
      name: "Demo Patient", email: "patient@staypredict.demo",
      password: await bcrypt.hash("Patient@1", 12), role: "patient", isActive: true,
    });
    console.log("[OK] Patient user: patient@staypredict.demo / Patient@1");
  }

  // ── 3. Wards ──────────────────────────────────────────────────────────────
  const wardDefs = [
    { name:"General Ward A",  type:"General",   totalBeds:20, floor:1 },
    { name:"ICU",             type:"ICU",        totalBeds:8,  floor:2 },
    { name:"Surgical Ward",   type:"Surgical",   totalBeds:15, floor:3 },
    { name:"Emergency Ward",  type:"Emergency",  totalBeds:10, floor:1 },
  ];
  const wardMap = {}; // type → ward doc
  for (const w of wardDefs) {
    let ward = await Ward.findOne({ name: w.name });
    if (!ward) ward = await Ward.create({ ...w, isActive: true });
    wardMap[w.type] = ward;
  }
  console.log(`[OK] ${wardDefs.length} wards ensured`);

  // ── 4. Beds ───────────────────────────────────────────────────────────────
  const statusCycle = ["available","available","available","occupied","occupied","cleaning","out_of_service"];
  let bedCount = 0;
  for (const ward of Object.values(wardMap)) {
    for (let i = 1; i <= ward.totalBeds; i++) {
      const bedNumber = `${ward.name.charAt(0)}${ward.floor}${String(i).padStart(2,"0")}`;
      const exists = await Bed.findOne({ bedNumber, wardId: ward._id });
      if (!exists) {
        await Bed.create({ bedNumber, wardId: ward._id, status: statusCycle[i % statusCycle.length] });
        bedCount++;
      }
    }
  }
  console.log(`[OK] ${bedCount} beds created`);

  // ── 5. Patient profiles + admissions from patients.csv ────────────────────
  const patCsvPath   = path.join(CSV_DIR, "patients.csv");
  const patUploadPath = "/mnt/user-data/uploads/1792939509270_patients.csv";
  const patPath = fs.existsSync(patCsvPath) ? patCsvPath
    : fs.existsSync(patUploadPath) ? patUploadPath : null;

  if (patPath) {
    const rows = parseCSV(patPath);
    // Use first 50 patients for demo (keeps seed fast)
    const demoRows = rows.slice(0, 50);
    let profCreated = 0, admCreated = 0;

    for (const row of demoRows) {
      const gender = Math.random() > 0.5 ? "Female" : "Male";
      const genderCode = gender === "Female" ? "F" : "M";

      // Patient profile
      let prof = await PatientProfile.findOne({ demoId: row.patient_id });
      if (!prof) {
        prof = await PatientProfile.create({
          demoId: row.patient_id,
          name: row.name,
          age: parseInt(row.age) || 30,
          gender,
          bloodGroup: randPick(BLOOD_GROUPS),
        });
        profCreated++;
      }

      // Admission — only create if not already admitted
      const exists = await Admission.findOne({ patientProfileId: prof._id });
      if (exists) continue;

      const arrivalDate   = new Date(row.arrival_date);
      const departureDate = new Date(row.departure_date);
      const los = Math.max(1, Math.round((departureDate - arrivalDate) / 86400000));
      const isActive = departureDate > new Date();
      const status = isActive ? (los > 5 ? "under_treatment" : "admitted") : "discharged";
      const wardType = SERVICE_TO_WARD_TYPE[row.service] || "General";
      const ward = wardMap[wardType];
      const cond = CONDITIONS[row.service] || "Hypertension";
      const ins  = randPick(INSURANCES);
      const snap = {
        gender: genderCode, facid: randPick(["A","B","C","D","E"]), rcount: "0",
        hematocrit: 11.9, neutrophils: 9.4, sodium: 137.9, glucose: 153.0,
        bloodureanitro: 14.0, creatinine: 1.1, bmi: 29.8, pulse: 73, respiration: 6.5,
        secondarydiagnosisnonicd9: 1,
        dialysisrenalendstage:0,asthma:0,irondef:0,pneum:0,substancedependence:0,
        psychologicaldisordermajor:0,depress:0,psychother:0,fibrosisandother:0,
        malnutrition:0,hemo:0,
      };

      const adm = await Admission.create({
        patientProfileId: prof._id,
        admittedBy: seedStaffUser._id,
        wardId: ward?._id,
        admissionDate: arrivalDate,
        dischargeDate: status === "discharged" ? departureDate : undefined,
        actualLos: status === "discharged" ? los : undefined,
        admissionType: row.service === "emergency" ? "Emergency" : row.service === "ICU" ? "Urgent" : "Elective",
        medicalCondition: cond,
        insurance: ins,
        featureSnapshot: snap,
        status,
        notes: `Seeded from patients.csv | Satisfaction: ${row.satisfaction}`,
      });

      // Prediction
      const { prob, risk } = losToRisk(los);
      const pred = await Prediction.create({
        admissionId: adm._id,
        patientProfileId: prof._id,
        requestedBy: seedStaffUser._id,
        inputFeatures: snap,
        predictedLosDays: Math.max(1, los + (Math.random() - 0.5) * 1.5),
        intervalLower: Math.max(1, los - 1.5),
        intervalHigh: los + 2,
        prolongedStayProbability: prob,
        riskCategory: risk,
        modelVersion: "2.0.0",
        predictedAt: arrivalDate,
      });

      adm.latestPredictionId = pred._id;
      await adm.save();
      admCreated++;
    }
    console.log(`[OK] ${profCreated} patient profiles | ${admCreated} admissions created from patients.csv`);

    // Link demo patient user to first profile
    const firstProf = await PatientProfile.findOne({});
    if (firstProf && !firstProf.userId) {
      firstProf.userId = patUser._id;
      await firstProf.save();
    }
  } else {
    console.log("[WARN] patients.csv not found — place it at staypredict/data/patients.csv");
    // Minimal fallback
    await _seedFallbackPatients(seedStaffUser, patUser, wardMap);
  }

  // ── 6. Discharge barriers ─────────────────────────────────────────────────
  const activeAdms = await Admission.find({ status: { $in: ["under_treatment","pending_discharge"] } }).limit(6);
  let barrierCount = 0;
  for (const adm of activeAdms) {
    const exists = await DischargeBarrier.findOne({ admissionId: adm._id });
    if (!exists) {
      await DischargeBarrier.create({
        admissionId: adm._id, patientProfileId: adm.patientProfileId,
        type: "pharmacy_authorization", status: "open", priority: "high",
        description: "Awaiting pharmacy sign-off on discharge medications.",
        createdBy: seedStaffUser._id,
      });
      await DischargeBarrier.create({
        admissionId: adm._id, patientProfileId: adm.patientProfileId,
        type: "post_acute_placement", status: "in_progress", priority: "medium",
        description: "Coordinating post-acute rehabilitation placement.",
        createdBy: seedStaffUser._id,
      });
      barrierCount += 2;
    }
  }
  console.log(`[OK] ${barrierCount} discharge barriers created`);

  console.log("\n✅ Seed complete!\n");
  console.log("Demo credentials:");
  console.log(`  Admin:   ${adminEmail}  /  ${process.env.ADMIN_PASSWORD||"Admin@12345"}`);
  console.log("  Staff:   staff@staypredict.demo  /  Staff@12345");
  console.log("  Patient: patient@staypredict.demo /  Patient@1\n");

  await mongoose.disconnect();
}

async function _seedFallbackPatients(staffUser, patUser, wardMap) {
  const fallbackPatients = [
    { demoId:"PT-001", name:"Alice Johnson",  age:67, gender:"Female", bloodGroup:"A+", service:"emergency", los:5 },
    { demoId:"PT-002", name:"Robert Smith",   age:54, gender:"Male",   bloodGroup:"O+", service:"general_medicine", los:3 },
    { demoId:"PT-003", name:"Maria Garcia",   age:72, gender:"Female", bloodGroup:"B+", service:"ICU", los:10 },
    { demoId:"PT-004", name:"James Wilson",   age:45, gender:"Male",   bloodGroup:"AB-",service:"surgery", los:4 },
    { demoId:"PT-005", name:"Demo Patient",   age:38, gender:"Male",   bloodGroup:"O-", service:"general_medicine", los:2, userId: patUser._id },
  ];
  const INSURANCES = ["Medicare","Medicaid","Private","Blue Cross"];
  const CONDITIONS = { surgery:"Fracture", emergency:"Heart Disease", general_medicine:"Diabetes", ICU:"COPD" };
  for (const p of fallbackPatients) {
    let prof = await mongoose.models.PatientProfile.findOne({ demoId: p.demoId });
    if (!prof) prof = await mongoose.models.PatientProfile.create({ demoId:p.demoId, name:p.name, age:p.age, gender:p.gender, bloodGroup:p.bloodGroup, userId:p.userId });
    const exists = await mongoose.models.Admission.findOne({ patientProfileId: prof._id });
    if (exists) continue;
    const wardType = { surgery:"Surgical", emergency:"Emergency", general_medicine:"General", ICU:"ICU" }[p.service];
    const ward = wardMap[wardType];
    const snap = { gender: p.gender==="Female"?"F":"M", facid:"A", rcount:"0", hematocrit:11.9, neutrophils:9.4, sodium:137.9, glucose:153.0, bloodureanitro:14.0, creatinine:1.1, bmi:29.8, pulse:73, respiration:6.5, secondarydiagnosisnonicd9:1, dialysisrenalendstage:0,asthma:0,irondef:0,pneum:0,substancedependence:0,psychologicaldisordermajor:0,depress:0,psychother:0,fibrosisandother:0,malnutrition:0,hemo:0 };
    const adm = await mongoose.models.Admission.create({ patientProfileId:prof._id, admittedBy:staffUser._id, wardId:ward?._id, admissionDate:new Date(), admissionType:p.service==="emergency"?"Emergency":"Elective", medicalCondition:CONDITIONS[p.service], insurance:INSURANCES[0], featureSnapshot:snap, status:"admitted" });
    const { prob, risk } = { prob: p.los>7?0.7:0.3, risk: p.los>7?"Elevated Risk":"Low Risk" };
    const pred = await mongoose.models.Prediction.create({ admissionId:adm._id, patientProfileId:prof._id, requestedBy:staffUser._id, inputFeatures:snap, predictedLosDays:p.los, intervalLower:Math.max(1,p.los-1.5), intervalHigh:p.los+2, prolongedStayProbability:prob, riskCategory:risk, modelVersion:"2.0.0", predictedAt:new Date() });
    adm.latestPredictionId = pred._id; await adm.save();
  }
  console.log("[OK] Fallback patients seeded");
}

seed().catch(err => { console.error("[ERROR]", err.message); process.exit(1); });