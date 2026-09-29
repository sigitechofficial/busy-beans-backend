const express = require("express");
const { marketingProtect } = require("../../middlewares/marketingAuth");
const templatesController = require("../../controllers/templates.controller");
const { guardTemplateCustomHtml, requireSuperAdmin } = require("../../middlewares/customHtmlGuard");

const router = express.Router();
router.use(marketingProtect);

router.post("/import-url", requireSuperAdmin, templatesController.importFromUrl);
router.get("/custom", templatesController.listCustom);
router.get("/custom/:id", templatesController.getCustomById);
router.post("/custom", guardTemplateCustomHtml, templatesController.createCustom);
router.put("/custom/:id", guardTemplateCustomHtml, templatesController.updateCustom);
router.patch("/custom/:id", guardTemplateCustomHtml, templatesController.updateCustom);
router.delete("/custom/:id", templatesController.deleteCustom);
router.get("/builtin/:templateId/override", templatesController.getBuiltinOverride);
router.put("/builtin/:templateId/override", guardTemplateCustomHtml, templatesController.upsertBuiltinOverride);

module.exports = router;
