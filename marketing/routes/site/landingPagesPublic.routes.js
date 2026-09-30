const express = require("express");
const landingPagesPublicController = require("../../controllers/landingPagesPublic.controller");

const router = express.Router();

router.get("/", landingPagesPublicController.listForSitemap);
router.get("/preview/:pageId", landingPagesPublicController.getPreviewByToken);
router.get("/:slug", landingPagesPublicController.getBySlug);

module.exports = router;
