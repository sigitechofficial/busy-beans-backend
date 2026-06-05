const express = require("express");
const { marketingProtect } = require("../../middlewares/marketingAuth");
const globalTrackingController = require("../../controllers/globalTracking.controller");

const router = express.Router();
router.use(marketingProtect);

router.get("/settings", globalTrackingController.getSettings);
router.put("/settings", globalTrackingController.updateSettings);

module.exports = router;
