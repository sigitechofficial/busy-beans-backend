const express = require("express");
const { marketingProtect } = require("../../middlewares/marketingAuth");
const globalSectionsController = require("../../controllers/globalSections.controller");

const router = express.Router();
router.use(marketingProtect);

router.get("/", globalSectionsController.list);
router.get("/:id", globalSectionsController.getById);
router.post("/", globalSectionsController.create);
router.patch("/:id", globalSectionsController.update);
router.delete("/:id", globalSectionsController.remove);
router.post("/:id/detach", globalSectionsController.detach);

module.exports = router;
