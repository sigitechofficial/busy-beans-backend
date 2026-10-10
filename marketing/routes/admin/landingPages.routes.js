const express = require("express");
const { marketingProtect } = require("../../middlewares/marketingAuth");
const landingPagesController = require("../../controllers/landingPages.controller");
const { guardLandingPageCustomHtml } = require("../../middlewares/customHtmlGuard");

const router = express.Router();

router.use(marketingProtect);

router.get("/", landingPagesController.list);
router.get("/:id", landingPagesController.getById);
router.post("/", guardLandingPageCustomHtml, landingPagesController.create);
router.patch("/:id/draft", guardLandingPageCustomHtml, landingPagesController.patchDraft);
router.get("/:id/validate", landingPagesController.validate);
router.post("/:id/publish", landingPagesController.publish);
router.post("/:id/unpublish", landingPagesController.unpublish);
router.post("/:id/duplicate", landingPagesController.duplicate);
router.post("/:id/archive", landingPagesController.archive);
router.delete("/:id", landingPagesController.remove);
router.post("/:id/restore", landingPagesController.restore);
router.post("/:id/preview-token", landingPagesController.previewToken);

module.exports = router;
