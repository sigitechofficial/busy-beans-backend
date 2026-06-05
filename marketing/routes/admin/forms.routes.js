const express = require("express");
const { marketingProtect } = require("../../middlewares/marketingAuth");
const formsController = require("../../controllers/forms.controller");

const router = express.Router();
router.use(marketingProtect);

router.get("/", formsController.list);
router.get("/:id", formsController.getById);
router.post("/", formsController.create);
router.patch("/:id", formsController.update);
router.post("/:id/duplicate", formsController.duplicate);
router.post("/:id/publish", formsController.publish);
router.post("/:id/archive", formsController.archive);
router.delete("/:id", formsController.remove);

module.exports = router;
