const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");

const TEST_DB = process.env.MONGODB_URI || "mongodb://localhost:27017/staypredict_test";

beforeAll(async () => {
  await mongoose.connect(TEST_DB);
  await User.deleteMany({ email: /testuser/ });
});

afterAll(async () => {
  await User.deleteMany({ email: /testuser/ });
  await mongoose.disconnect();
});

describe("Auth endpoints", () => {
  let token;

  test("POST /api/auth/register — success", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test User", email: "testuser@example.com", password: "Test@1234", role: "staff",
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe("testuser@example.com");
    expect(res.body.user.password).toBeUndefined();
  });

  test("POST /api/auth/register — duplicate email", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test User", email: "testuser@example.com", password: "Test@1234",
    });
    expect(res.status).toBe(409);
  });

  test("POST /api/auth/register — weak password rejected", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "X", email: "testuser2@example.com", password: "weak",
    });
    expect(res.status).toBe(400);
  });

  test("POST /api/auth/login — success", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "testuser@example.com", password: "Test@1234",
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
  });

  test("POST /api/auth/login — wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "testuser@example.com", password: "WrongPass@1",
    });
    expect(res.status).toBe(401);
  });

  test("GET /api/auth/me — authenticated", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("testuser@example.com");
  });

  test("GET /api/auth/me — no token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("Password is hashed in DB", async () => {
    const user = await User.findOne({ email: "testuser@example.com" }).select("+password");
    expect(user.password).not.toBe("Test@1234");
    expect(user.password).toMatch(/^\$2[ab]\$12\$/);
  });
});
