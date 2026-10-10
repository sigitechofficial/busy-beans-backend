const express = require("express");
const rateLimit = require("express-rate-limit");
const leadSubmissionsController = require("../../controllers/leadSubmissions.controller");

const router = express.Router();
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.MARKETING_LEAD_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many lead submissions. Please try again shortly.",
    code: "RATE_LIMITED",
  },
});

router.post("/", limiter, leadSubmissionsController.create);

module.exports = router;
