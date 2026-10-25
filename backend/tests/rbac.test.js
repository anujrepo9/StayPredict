const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");

const TEST_DB = process.env.MONGODB_URI || "mongodb://localhost:27017/staypredict_test";

let adminToken, staffToken, patientToken;

beforeAll(async () => {
  await mongoose.connect(TEST_DB);
  await User.deleteMany({ email: /rbactest/ });

  const mkUser = async (email, role, password = "Test@1234") => {
    const res = await request(app).post("/api/auth/register").send({ name: `${role} user`, email, password, role });
    // For admin we patch directly since register won't allow admin role
    if (role === "admin") {
      await User.findOneAndUpdate({ email }, { role: "admin" });
      const lr = await request(app).post("/api/auth/login").send({ email, password });
      return lr.body.token;
    }
    return res.body.token;
  };

  adminToken = await mkUser("rbactest-admin@example.com", "admin");
  staffToken = await mkUser("rbactest-staff@example.com", "staff");
  patientToken = await mkUser("rbactest-patient@example.com", "patient");
});

afterAll(async () => {
  await User.deleteMany({ email: /rbactest/ });
  await mongoose.disconnect();
});

describe("Role-Based Access Control", () => {
  test("Admin can access /api/admin/users", async () => {
    const res = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test("Staff cannot access /api/admin/users (403)", async () => {
    const res = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  test("Patient cannot access /api/admin/users (403)", async () => {
    const res = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${patientToken}`);
    expect(res.status).toBe(403);
  });

  test("Unauthenticated request to protected route returns 401", async () => {
    const res = await request(app).get("/api/admissions");
    expect(res.status).toBe(401);
  });

  test("Admin can access audit logs", async () => {
    const res = await request(app).get("/api/admin/audit-logs").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test("Patient cannot create admissions (403)", async () => {
    const res = await request(app).post("/api/admissions").set("Authorization", `Bearer ${patientToken}`).send({});
    expect(res.status).toBe(403);
  });

  test("Health endpoint is public", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
