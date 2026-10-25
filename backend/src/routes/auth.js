const router = require("express").Router();
const { body } = require("express-validator");
const { register, login, getMe } = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: "Too many attempts" } });

router.post("/register", authLimiter, [
  body("name").trim().isLength({ min: 2, max: 100 }),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 8 }).matches(/[A-Z]/).matches(/[0-9]/),
  body("role").optional().isIn(["staff", "patient"]),
], register);

router.post("/login", authLimiter, [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),
], login);

router.get("/me", authenticate, getMe);

module.exports = router;
