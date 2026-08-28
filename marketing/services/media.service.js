const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const { getMediaAssetModel } = require("../models/mediaAsset");
const { getMediaUsageMap, getMediaUsageCount } = require("../utils/usageCounts");

const MAX_UPLOAD_BYTES = Number(process.env.MEDIA_UPLOAD_MAX_BYTES || 5 * 1024 * 1024);
const uploadDir = path.resolve(__dirname, "../../public/marketing-media");

function buildMediaId() {
  return `media-upload-${Date.now()}`;
}

function inferTypeFromMime(mimeType) {
  if (!mimeType) return null;
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "document";
  return null;
}

function extensionFromMime(mimeType) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "video/mp4") return ".mp4";
  if (mimeType === "video/webm") return ".webm";
  if (mimeType === "application/pdf") return ".pdf";
  return "";
}

function buildPublicUrl(fileName) {
  const cdnBase = String(process.env.CDN_BASE_URL || "").replace(/\/+$/, "");
  if (cdnBase) return `${cdnBase}/marketing-media/${fileName}`;
  const site = String(process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  if (site) return `${site}/public/marketing-media/${fileName}`;
  return `/public/marketing-media/${fileName}`;
}

async function saveFileBuffer(buffer, mimeType) {
  await fs.mkdir(uploadDir, { recursive: true });
  const fileName = `${crypto.randomBytes(12).toString("hex")}${extensionFromMime(mimeType)}`;
  const filePath = path.join(uploadDir, fileName);
  await fs.writeFile(filePath, buffer);
  return { fileName, url: buildPublicUrl(fileName) };
}

async function listMediaAssets() {
  const MediaAsset = getMediaAssetModel();
  const rows = await MediaAsset.findAll({ order: [["created_at", "DESC"]] });
  const usageMap = await getMediaUsageMap();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    usageCount: usageMap[row.id] || 0,
    altText: row.altText || "",
    url: row.url,
    approved: Boolean(row.approved),
    isCustom: !row.isBuiltin,
  }));
}

async function createMediaAsset(file, body = {}) {
  if (!file) {
    const error = new Error("file is required.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const error = new Error(`File size exceeds ${MAX_UPLOAD_BYTES} bytes.`);
    error.code = "FILE_TOO_LARGE";
    throw error;
  }
  const type = inferTypeFromMime(file.mimetype);
  if (!type) {
    const error = new Error("Unsupported file type.");
    error.code = "UNSUPPORTED_MIME";
    throw error;
  }

  const MediaAsset = getMediaAssetModel();
  const displayName = String(body.name || file.originalname || "").trim();
  if (displayName) {
    const rows = await MediaAsset.findAll({ attributes: ["id", "name", "type", "altText", "url", "approved"] });
    const existing = rows.find(
      (r) => String(r.name || "").trim().toLowerCase() === displayName.toLowerCase(),
    );
    if (existing) {
      if (body.altText !== undefined) {
        existing.altText = body.altText;
        await existing.save();
      }
      return {
        id: existing.id,
        url: existing.url,
        name: existing.name,
        type: existing.type,
        altText: existing.altText || "",
        approved: Boolean(existing.approved),
      };
    }
  }

  const id = buildMediaId();
  const uploaded = await saveFileBuffer(file.buffer, file.mimetype);
  const row = await MediaAsset.create({
    id,
    name: displayName || id,
    type,
    altText: body.altText || "",
    url: uploaded.url,
    mimeType: file.mimetype,
    fileSizeBytes: file.size,
    approved: true,
    isBuiltin: false,
  });
  return {
    id: row.id,
    url: row.url,
    name: row.name,
    type: row.type,
    altText: row.altText || "",
    approved: true,
  };
}

async function updateMediaMeta(id, body = {}) {
  const MediaAsset = getMediaAssetModel();
  const row = await MediaAsset.findByPk(id);
  if (!row) return null;
  if (body.name !== undefined) row.name = body.name;
  if (body.altText !== undefined) row.altText = body.altText;
  await row.save();
  return row;
}

async function replaceMediaFile(id, file) {
  const MediaAsset = getMediaAssetModel();
  const row = await MediaAsset.findByPk(id);
  if (!row) return null;
  if (!file) {
    const error = new Error("file is required.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const error = new Error(`File size exceeds ${MAX_UPLOAD_BYTES} bytes.`);
    error.code = "FILE_TOO_LARGE";
    throw error;
  }
  const type = inferTypeFromMime(file.mimetype);
  if (!type) {
    const error = new Error("Unsupported file type.");
    error.code = "UNSUPPORTED_MIME";
    throw error;
  }

  const uploaded = await saveFileBuffer(file.buffer, file.mimetype);
  row.url = uploaded.url;
  row.type = type;
  row.mimeType = file.mimetype;
  row.fileSizeBytes = file.size;
  await row.save();
  return row;
}

async function deleteMedia(id, { force = false } = {}) {
  const MediaAsset = getMediaAssetModel();
  const row = await MediaAsset.findByPk(id);
  if (!row) return { deleted: false, reason: "NOT_FOUND" };

  const usageCount = await getMediaUsageCount(id);
  if (!force && usageCount > 0) {
    return { deleted: false, reason: "IN_USE", usageCount };
  }

  await row.destroy();
  return { deleted: true };
}

module.exports = {
  listMediaAssets,
  createMediaAsset,
  updateMediaMeta,
  replaceMediaFile,
  deleteMedia,
};
