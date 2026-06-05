const express = require("express");
const { marketingProtect } = require("../middlewares/marketingAuth");
const authController = require("../controllers/auth.controller");

const router = express.Router();

router.post("/login", authController.login);
router.get("/me", marketingProtect, authController.me);
router.post("/logout", marketingProtect, authController.logout);
router.patch("/profile", marketingProtect, authController.updateProfile);
router.post("/change-password", marketingProtect, authController.changePassword);

module.exports = router;
