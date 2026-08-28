const express = require("express");
const { marketingProtect } = require("../../middlewares/marketingAuth");
const analyticsController = require("../../controllers/analytics.controller");

const router = express.Router();

router.use(marketingProtect);

router.get("/dashboard", analyticsController.dashboard);

module.exports = router;
