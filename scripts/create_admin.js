/**
 * Creates an administrator account from environment variables.
 * Run: node scripts/create_admin.js  (from the staypredict/ root)
 * Requires: MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME set in backend/.env
 */
const path = require("path");
const backendDir = path.join(__dirname, "../backend");

// Load .env from backend/
require(path.join(backendDir, "node_modules/dotenv")).config({
  path: path.join(backendDir, ".env"),
});

// Resolve all deps from backend/node_modules
const mongoose = require(path.join(backendDir, "node_modules/mongoose"));
const bcrypt = require(path.join(backendDir, "node_modules/bcryptjs"));

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/staypredict";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@staypredict.demo";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@12345";
const ADMIN_NAME = process.env.ADMIN_NAME || "System Administrator";

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("[DB] Connected to", MONGODB_URI);

  // Inline User schema to avoid circular deps
  const userSchema = new mongoose.Schema({
    name: String, email: { type: String, unique: true }, password: String, role: String, isActive: Boolean,
  }, { timestamps: true });

  const User = mongoose.models.User || mongoose.model("User", userSchema);
  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log(`[SKIP] Admin already exists: ${ADMIN_EMAIL}`);
    await mongoose.disconnect(); return;
  }

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.create({ name: ADMIN_NAME, email: ADMIN_EMAIL, password: hashed, role: "admin", isActive: true });
  console.log(`[OK] Admin created: ${ADMIN_EMAIL}`);
  console.log(`[OK] Password: ${ADMIN_PASSWORD}`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err.message); process.exit(1); });
