/**
 * Mounted on the commerce API at /api/v1/admin/marketing-sso behind the commerce `protect`
 * (see app.js). Lets a signed-in admin panel user open the Campaign Builder without a
 * second password.
 */
const express = require("express");
const rateLimit = require("express-rate-limit");
const ssoController = require("../controllers/sso.controller");

const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

router.post("/code", limiter, ssoController.issue);

module.exports = router;
