const express = require("express");
const rateLimit = require("express-rate-limit");
const catalogController = require("../controllers/public/catalogController");

/**
 * @swagger
 * tags:
 *   - name: Public catalog
 *     description: Price-free product catalog for guests and search engines
 */
const router = express.Router();

router.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.PUBLIC_CATALOG_RATE_LIMIT_MAX || 120),
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: "fail", message: "Too many requests. Please try again shortly." },
  }),
);

/**
 * @swagger
 * /api/v1/public/catalog/products:
 *   get:
 *     summary: Active products without prices (paginated; categoryId, search)
 *     tags: [Public catalog]
 */
router.get("/products", catalogController.listProducts);

/**
 * @swagger
 * /api/v1/public/catalog/products/{id}:
 *   get:
 *     summary: One active product without prices
 *     tags: [Public catalog]
 */
router.get("/products/:id", catalogController.getProduct);

/**
 * @swagger
 * /api/v1/public/catalog/categories:
 *   get:
 *     summary: Active product categories
 *     tags: [Public catalog]
 */
router.get("/categories", catalogController.listCategories);

module.exports = router;
