const express = require("express");
const { marketingProtect } = require("../../middlewares/marketingAuth");
const campaignsController = require("../../controllers/campaigns.controller");

const router = express.Router();
router.use(marketingProtect);

router.get("/", campaignsController.list);
router.get("/:id", campaignsController.getById);
router.post("/", campaignsController.create);
router.patch("/:id", campaignsController.update);
router.post("/:id/archive", campaignsController.archive);
router.delete("/:id", campaignsController.remove);

module.exports = router;
