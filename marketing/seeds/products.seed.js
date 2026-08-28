require("dotenv").config();
const manifest = require("../data/seedManifest");
const { getProductModel } = require("../models/product");
const productsService = require("../services/products.service");

const PRODUCTS = [
  {
    id: "prod-managed-office-coffee",
    name: "Managed Office Coffee",
    slug: "managed-office-coffee",
    brand: "Busy Bean",
    category: "office",
    shortDescription: "Full-service managed office coffee for growing teams.",
    features: ["Equipment included", "Weekly service", "Dedicated rep"],
    demoLandingSlug: "office-coffee-service-charlotte",
    recommendedCampaignTypes: ["office-coffee"],
    status: "active",
  },
  {
    id: "prod-commercial-espresso-program",
    name: "Commercial Espresso Program",
    slug: "commercial-espresso-program",
    brand: "Busy Bean",
    category: "commercial",
    shortDescription: "High-volume espresso for restaurants and hotels.",
    features: ["Training", "Preventive maintenance"],
    recommendedCampaignTypes: ["commercial-machines", "hotel-coffee"],
    status: "active",
  },
  {
    id: "prod-hospitality-coffee-program",
    name: "Hospitality Coffee Program",
    slug: "hospitality-coffee-program",
    brand: "Busy Bean",
    category: "hospitality",
    shortDescription: "Guest-first coffee programs for hotels and venues.",
    features: ["Lobby setups", "Guest satisfaction focus"],
    recommendedCampaignTypes: ["hotel-coffee"],
    status: "active",
  },
  {
    id: "prod-bean-to-cup-office",
    name: "Bean-to-Cup Office Line",
    slug: "bean-to-cup-office",
    brand: "Busy Bean",
    category: "bean-to-cup",
    shortDescription: "Self-service bean-to-cup for modern offices.",
    features: ["Fresh grind", "Low touch maintenance"],
    recommendedCampaignTypes: ["office-coffee", "product-demo"],
    status: "active",
  },
  {
    id: "prod-office-coffee-program",
    name: "Office Coffee Program",
    slug: "office-coffee-program",
    brand: "Busy Bean",
    category: "office",
    shortDescription: "Flexible office coffee plans for 25+ employees.",
    features: ["Multiple roast options", "Supplies included"],
    demoLandingSlug: "office-coffee-service-charlotte",
    recommendedCampaignTypes: ["office-coffee", "local-city"],
    status: "active",
  },
];

async function seedProducts() {
  for (const product of PRODUCTS) {
    // eslint-disable-next-line no-await-in-loop
    await productsService.createProduct(product);
    // eslint-disable-next-line no-console
    console.log(`[seed] upserted product: ${product.slug}`);
  }

  const missing = manifest.PRODUCT_SLUGS.filter(
    (slug) => !PRODUCTS.some((p) => p.slug === slug),
  );
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.warn("[seed] manifest slugs missing from PRODUCTS seed:", missing.join(", "));
  }
}

if (require.main === module) {
  seedProducts()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("[seed] products done");
      process.exit(0);
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[seed] products failed:", error.message);
      process.exit(1);
    });
}

module.exports = { seedProducts, PRODUCTS };
