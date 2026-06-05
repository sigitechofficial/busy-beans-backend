const express = require("express");
const { marketingProtect } = require("../../middlewares/marketingAuth");
const templatesController = require("../../controllers/templates.controller");

const router = express.Router();
router.use(marketingProtect);

router.get("/custom", templatesController.listCustom);
router.get("/custom/:id", templatesController.getCustomById);
router.post("/custom", templatesController.createCustom);
router.put("/custom/:id", templatesController.updateCustom);
router.patch("/custom/:id", templatesController.updateCustom);
router.delete("/custom/:id", templatesController.deleteCustom);
router.get("/builtin/:templateId/override", templatesController.getBuiltinOverride);
router.put("/builtin/:templateId/override", templatesController.upsertBuiltinOverride);

module.exports = router;
