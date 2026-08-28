/**
 * Expected seed targets — aligned with PAGE_BUILDER_SEED_BACKEND_GUIDE.md / frontend src/data.
 * Used for GET /api/admin/seed/status completeness checks only.
 */

const PRODUCT_SLUGS = [
  "managed-office-coffee",
  "commercial-espresso-program",
  "hospitality-coffee-program",
  "bean-to-cup-office",
  "office-coffee-program",
];

const MEDIA_NAMES = [
  "Office coffee bar",
  "Commercial espresso machine",
  "Hotel lobby coffee service",
  "Team enjoying office coffee",
];

const PRODUCT_LISTING_TYPES = [
  "product-grid-cards",
  "product-compact-list",
  "product-comparison",
  "product-featured-split",
  "product-carousel-strip",
];

const BUILTIN_TEMPLATE_IDS = [
  "tpl-office-coffee",
  "tpl-hotel-coffee",
  "tpl-commercial-machines",
  "tpl-corporate-cafe",
  "tpl-restaurant-equipment",
  "tpl-senior-living",
  "tpl-no-capex-offer",
  "tpl-local-city",
  "tpl-product-demo",
  "tpl-quote-request",
  "tpl-brochure-download",
  "tpl-comparison",
  "tpl-industry-target",
  "tpl-brand-general",
];

const SECTION_CATALOG_ANCHORS = ["hero", "benefits", "lead-form"];

const GLOBAL_SECTION_NAMES = [
  "Office Coffee FAQ",
  "Standard Trust Badges",
  "Quote Request Form",
];

const FORM_SLUGS = [
  "office-coffee-quote",
  "commercial-demo-request",
  "brochure-download",
  "callback-request",
  "newsletter-signup",
  "consultation-booking",
  "contact-general",
];

const LANDING_PAGE_SLUGS = ["office-coffee-service-charlotte"];

const CAMPAIGN_NAMES = ["Q2 Office Coffee — Charlotte"];

module.exports = {
  MODULE_KEYS: [
    "tracking",
    "products",
    "media",
    "sectionCatalog",
    "productListingCatalog",
    "templates",
    "globalSections",
    "forms",
    "landingPages",
    "campaigns",
  ],
  EXPECTED: {
    tracking: 1,
    products: PRODUCT_SLUGS.length,
    media: MEDIA_NAMES.length,
    sectionCatalog: 53,
    productListingCatalog: PRODUCT_LISTING_TYPES.length,
    templates: BUILTIN_TEMPLATE_IDS.length,
    globalSections: GLOBAL_SECTION_NAMES.length,
    forms: FORM_SLUGS.length,
    landingPages: LANDING_PAGE_SLUGS.length,
    campaigns: CAMPAIGN_NAMES.length,
  },
  PRODUCT_SLUGS,
  MEDIA_NAMES,
  PRODUCT_LISTING_TYPES,
  BUILTIN_TEMPLATE_IDS,
  SECTION_CATALOG_ANCHORS,
  GLOBAL_SECTION_NAMES,
  FORM_SLUGS,
  LANDING_PAGE_SLUGS,
  CAMPAIGN_NAMES,
  TEMPLATES_MIN_FOR_SEEDED: 12,
  SECTION_CATALOG_PARTIAL_RATIO: 0.5,
};
