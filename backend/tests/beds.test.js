const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Ward = require("../src/models/Ward");
const Bed = require("../src/models/Bed");

const TEST_DB = process.env.MONGODB_URI || "mongodb://localhost:27017/staypredict_test";

let adminToken, testWardId, testBedId;

beforeAll(async () => {
  await mongoose.connect(TEST_DB);
  await User.deleteMany({ email: /bedtest/ });
  await Ward.deleteMany({ name: /Test Ward/ });

  // Create admin
  await request(app).post("/api/auth/register").send({ name: "bed admin", email: "bedtest-admin@example.com", password: "Test@1234" });
  await User.findOneAndUpdate({ email: "bedtest-admin@example.com" }, { role: "admin" });
  const lr = await request(app).post("/api/auth/login").send({ email: "bedtest-admin@example.com", password: "Test@1234" });
  adminToken = lr.body.token;

  // Create ward
  const wr = await request(app).post("/api/wards").set("Authorization", `Bearer ${adminToken}`).send({ name: "Test Ward Alpha", type: "General", totalBeds: 5, floor: 1 });
  testWardId = wr.body.ward._id;

  // Create bed
  const br = await request(app).post("/api/beds").set("Authorization", `Bearer ${adminToken}`).send({ bedNumber: "TST-01", wardId: testWardId });
  testBedId = br.body.bed._id;
});

afterAll(async () => {
  await Bed.deleteMany({ bedNumber: /TST/ });
  await Ward.deleteMany({ name: /Test Ward/ });
  await User.deleteMany({ email: /bedtest/ });
  await mongoose.disconnect();
});

describe("Bed state transitions", () => {
  test("New bed starts as available", async () => {
    const res = await request(app).get("/api/beds").set("Authorization", `Bearer ${adminToken}`).query({ wardId: testWardId });
    const bed = res.body.beds.find(b => b._id === testBedId);
    expect(bed?.status).toBe("available");
  });

  test("available → occupied (valid)", async () => {
    const res = await request(app).patch(`/api/beds/${testBedId}/status`).set("Authorization", `Bearer ${adminToken}`).send({ status: "occupied" });
    expect(res.status).toBe(200);
    expect(res.body.bed.status).toBe("occupied");
  });

  test("occupied → available (invalid — must go through cleaning)", async () => {
    const res = await request(app).patch(`/api/beds/${testBedId}/status`).set("Authorization", `Bearer ${adminToken}`).send({ status: "available" });
    expect(res.status).toBe(400);
  });

  test("occupied → cleaning (valid)", async () => {
    const res = await request(app).patch(`/api/beds/${testBedId}/status`).set("Authorization", `Bearer ${adminToken}`).send({ status: "cleaning" });
    expect(res.status).toBe(200);
    expect(res.body.bed.status).toBe("cleaning");
  });

  test("cleaning → available (valid)", async () => {
    const res = await request(app).patch(`/api/beds/${testBedId}/status`).set("Authorization", `Bearer ${adminToken}`).send({ status: "available" });
    expect(res.status).toBe(200);
    expect(res.body.bed.status).toBe("available");
  });

  test("available → out_of_service (valid)", async () => {
    const res = await request(app).patch(`/api/beds/${testBedId}/status`).set("Authorization", `Bearer ${adminToken}`).send({ status: "out_of_service" });
    expect(res.status).toBe(200);
  });

  test("out_of_service → available (valid)", async () => {
    const res = await request(app).patch(`/api/beds/${testBedId}/status`).set("Authorization", `Bearer ${adminToken}`).send({ status: "available" });
    expect(res.status).toBe(200);
    expect(res.body.bed.status).toBe("available");
  });
});
