const express = require("express");
const { marketingProtect } = require("../../middlewares/marketingAuth");
const leadSubmissionsAdminController = require("../../controllers/leadSubmissionsAdmin.controller");

const router = express.Router();

router.use(marketingProtect);

router.get("/", leadSubmissionsAdminController.list);
router.get("/:id", leadSubmissionsAdminController.getById);
router.patch("/:id", leadSubmissionsAdminController.update);
router.delete("/:id", leadSubmissionsAdminController.remove);

module.exports = router;
