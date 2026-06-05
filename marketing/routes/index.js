const express = require("express");
const { marketingRequestLogger } = require("../middlewares/requestLogger");
const authRoutes = require("./auth.routes");
const landingPagesRoutes = require("./admin/landingPages.routes");
const mediaRoutes = require("./admin/media.routes");
const trackingRoutes = require("./admin/tracking.routes");
const productsRoutes = require("./admin/products.routes");
const campaignsRoutes = require("./admin/campaigns.routes");
const globalSectionsRoutes = require("./admin/globalSections.routes");
const formsRoutes = require("./admin/forms.routes");
const sectionCatalogRoutes = require("./admin/sectionCatalog.routes");
const productListingCatalogRoutes = require("./admin/productListingCatalog.routes");
const templatesRoutes = require("./admin/templates.routes");
const seedRoutes = require("./admin/seed.routes");
const landingPagesPublicRoutes = require("./public/landingPagesPublic.routes");
const leadSubmissionsRoutes = require("./public/leadSubmissions.routes");

const router = express.Router();
router.use(marketingRequestLogger);

router.get("/health", (_req, res) => {
  res.status(200).json({
    data: {
      module: "page-builder",
      status: "ok",
    },
  });
});

router.use("/auth", authRoutes);
router.use("/admin/landing-pages", landingPagesRoutes);
router.use("/admin/media", mediaRoutes);
router.use("/admin/tracking", trackingRoutes);
router.use("/admin/products", productsRoutes);
router.use("/admin/campaigns", campaignsRoutes);
router.use("/admin/global-sections", globalSectionsRoutes);
router.use("/admin/forms", formsRoutes);
router.use("/admin/section-catalog", sectionCatalogRoutes);
router.use("/admin/product-listing-catalog", productListingCatalogRoutes);
router.use("/admin/templates", templatesRoutes);
router.use("/admin/seed", seedRoutes);
router.use("/public/landing-pages", landingPagesPublicRoutes);
router.use("/public/lead-submissions", leadSubmissionsRoutes);

module.exports = router;
