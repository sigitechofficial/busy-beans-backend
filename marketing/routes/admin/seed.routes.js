const express = require("express");
const { marketingProtect } = require("../../middlewares/marketingAuth");
const seedController = require("../../controllers/seed.controller");

const router = express.Router();
router.use(marketingProtect);

router.get("/status", seedController.getStatus);
router.patch("/status", seedController.patchStatus);

module.exports = router;
