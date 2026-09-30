/**
 * Public product catalog for search engines and guests: names, descriptions, images and specs.
 * Prices, wholesale prices, SKUs, stock and product codes are never returned — customers see
 * prices only through the signed-in `/api/v1/users/product` endpoint (per-customer pricing).
 */
const { Op } = require("sequelize");
const { product, category } = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const { getApiPublicUrl } = require("../../marketing/utils/publicUrls");

/** The only product columns this API may return. */
const PRODUCT_ATTRIBUTES = [
  "id",
  "name",
  "desc",
  "image",
  "weight",
  "unit",
  "grind",
  "categoryId",
  "updatedAt",
];
const CATEGORY_ATTRIBUTES = ["id", "name"];
const MAX_LIMIT = 100;

const activeCategory = {
  model: category,
  attributes: CATEGORY_ATTRIBUTES,
  where: { status: 1, deleted: 0 },
  required: true,
};

function absoluteImage(image) {
  const path = String(image || "").trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(getApiPublicUrl() || "").replace(/\/+$/, "");
  return base ? `${base}/${path.replace(/^\/+/, "")}` : null;
}

/** Explicit whitelist: a new column on the model can never leak through this API. */
function toPublicProduct(row) {
  const p = row.get ? row.get({ plain: true }) : row;
  return {
    id: p.id,
    name: p.name,
    desc: p.desc || "",
    image: p.image || null,
    imageUrl: absoluteImage(p.image),
    weight: p.weight ?? null,
    unit: p.unit || "",
    grind: p.grind || "",
    categoryId: p.categoryId ?? null,
    category: p.category ? { id: p.category.id, name: p.category.name } : null,
    updatedAt: p.updatedAt,
  };
}

function positiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function setPublicCache(res) {
  res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
}

exports.listProducts = catchAsync(async (req, res) => {
  const page = positiveInt(req.query.page, 1);
  const limit = Math.min(positiveInt(req.query.limit, 24), MAX_LIMIT);
  const where = { status: 1, deleted: 0 };
  const categoryId = positiveInt(req.query.categoryId, null);
  if (categoryId) where.categoryId = categoryId;
  const search = String(req.query.search || "").trim().slice(0, 100);
  if (search) where.name = { [Op.like]: `%${search.replace(/[\%_]/g, "\$&")}%` };

  const { rows, count } = await product.findAndCountAll({
    where,
    attributes: PRODUCT_ATTRIBUTES,
    include: [activeCategory],
    order: [["name", "ASC"], ["id", "ASC"]],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });

  setPublicCache(res);
  res.status(200).json({
    status: "success",
    results: rows.length,
    pagination: {
      page,
      limit,
      totalItems: count,
      totalPages: Math.max(1, Math.ceil(count / limit)),
    },
    data: { data: rows.map(toPublicProduct) },
  });
});

exports.getProduct = catchAsync(async (req, res, next) => {
  const id = positiveInt(req.params.id, null);
  const row = id
    ? await product.findOne({
        where: { id, status: 1, deleted: 0 },
        attributes: PRODUCT_ATTRIBUTES,
        include: [activeCategory],
      })
    : null;
  if (!row) return next(new AppError("Product not found", 404));
  setPublicCache(res);
  res.status(200).json({ status: "success", data: { data: toPublicProduct(row) } });
});

exports.listCategories = catchAsync(async (req, res) => {
  const rows = await category.findAll({
    where: { status: 1, deleted: 0 },
    attributes: CATEGORY_ATTRIBUTES,
    order: [["name", "ASC"]],
  });
  setPublicCache(res);
  res.status(200).json({
    status: "success",
    data: { data: rows.map((c) => ({ id: c.id, name: c.name })) },
  });
});

exports.PRODUCT_ATTRIBUTES = PRODUCT_ATTRIBUTES;
exports.toPublicProduct = toPublicProduct;
