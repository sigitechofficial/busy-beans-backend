const express = require("express");
const { marketingProtect } = require("../../middlewares/marketingAuth");
const sectionCatalogController = require("../../controllers/sectionCatalog.controller");

const router = express.Router();
router.use(marketingProtect);

router.get("/overrides", sectionCatalogController.list);
router.put("/overrides/:sectionType", sectionCatalogController.upsert);
router.patch("/overrides/:sectionType/active", sectionCatalogController.patchActive);
router.delete("/overrides/:sectionType", sectionCatalogController.remove);

module.exports = router;
