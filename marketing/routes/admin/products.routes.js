const express = require("express");
const { marketingProtect } = require("../../middlewares/marketingAuth");
const productsController = require("../../controllers/products.controller");

const router = express.Router();
router.use(marketingProtect);

router.get("/", productsController.list);
router.get("/:id", productsController.getById);
router.post("/", productsController.create);
router.patch("/:id", productsController.update);
router.post("/:id/archive", productsController.archive);
router.delete("/:id", productsController.remove);

module.exports = router;
