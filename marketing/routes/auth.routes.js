const express = require("express");
const { marketingProtect } = require("../middlewares/marketingAuth");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/auth.controller");
const ssoController = require("../controllers/sso.controller");

const router = express.Router();
// SSO codes are 256-bit random and single-use; the limit only caps noise from bad links.
const ssoLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.post("/login", authController.login);
router.post("/sso/exchange", ssoLimiter, ssoController.exchange);
router.get("/me", marketingProtect, authController.me);
router.post("/logout", marketingProtect, authController.logout);
router.patch("/profile", marketingProtect, authController.updateProfile);
router.post("/change-password", marketingProtect, authController.changePassword);

module.exports = router;
