const express = require("express");
const { marketingProtect } = require("../../middlewares/marketingAuth");
const productListingCatalogController = require("../../controllers/productListingCatalog.controller");

const router = express.Router();
router.use(marketingProtect);

router.get("/overrides", productListingCatalogController.list);
router.put("/overrides/:listingType", productListingCatalogController.upsert);
router.delete("/overrides/:listingType", productListingCatalogController.remove);

module.exports = router;
