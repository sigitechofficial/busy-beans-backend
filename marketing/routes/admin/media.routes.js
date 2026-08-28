const express = require("express");
const multer = require("multer");
const { marketingProtect } = require("../../middlewares/marketingAuth");
const mediaController = require("../../controllers/media.controller");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MEDIA_UPLOAD_MAX_BYTES || 5 * 1024 * 1024),
  },
});

router.use(marketingProtect);

router.get("/", mediaController.list);
router.post("/", upload.single("file"), mediaController.create);
router.patch("/:id", mediaController.updateMeta);
router.put("/:id/file", upload.single("file"), mediaController.replaceFile);
router.delete("/:id", mediaController.remove);

module.exports = router;
