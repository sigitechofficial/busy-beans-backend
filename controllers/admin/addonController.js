const { addon } = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const factory = require("../handlerFactory");
const { Op, fn, col } = require("sequelize");

/**
 * Get all addons
 * GET /api/v1/subscription/addons/all
 */
exports.getAllAddons = factory.getAll(addon, { deleted: false });

/**
 * Get addon by ID
 * GET /api/v1/subscription/addons/:id
 */
exports.getAddon = factory.getOne(addon);

/**
 * Create addons (bulk create from array)
 * POST /api/v1/subscription/addons
 * Body: [{ name, description, price, status }]
 */
exports.createAddon = catchAsync(async (req, res, next) => {
  const addonsData = req.body;

  // Validate that body is an array
  if (!Array.isArray(addonsData)) {
    return next(new AppError("Request body must be an array of addons", 400));
  }

  if (addonsData.length === 0) {
    return next(new AppError("Addons array cannot be empty", 400));
  }

  // Validate required fields for each addon
  for (const addonItem of addonsData) {
    if (!addonItem.name || !addonItem.price) {
      return next(
        new AppError("Each addon must have 'name' and 'price' fields", 400)
      );
    }
  }

  // Check for duplicate names within the request (case-insensitive)
  const addonNamesLower = addonsData.map((a) => a.name.toLowerCase());
  const uniqueNames = new Set(addonNamesLower);
  if (addonNamesLower.length !== uniqueNames.size) {
    return next(
      new AppError("Duplicate addon names found in the request", 400)
    );
  }

  // Check if any addon names already exist in database
  const addonNames = addonsData.map((a) => a.name);
  const existingAddons = await addon.findAll({
    where: {
      [Op.and]: [
        {
          name: {
            [Op.in]: addonNames,
          },
        },
        { deleted: false },
      ],
    },
    attributes: ["name"],
  });

  if (existingAddons.length > 0) {
    const existingNames = existingAddons.map((a) => a.name);
    return next(
      new AppError(
        `Addon(s) with name(s) "${existingNames.join(", ")}" already exist`,
        400
      )
    );
  }

  // Prepare addons for bulk create
  const addonsToCreate = addonsData.map((addonItem) => ({
    name: addonItem.name,
    description: addonItem.description || null,
    price: addonItem.price,
    status: addonItem.status !== undefined ? addonItem.status : true,
    deleted: false,
  }));

  // Bulk create addons
  const createdAddons = await addon.bulkCreate(addonsToCreate);

  res.status(201).json({
    status: "success",
    results: createdAddons.length,
    data: {
      data: createdAddons,
    },
  });
});

/**
 * Update addon
 * PATCH /api/v1/subscription/addons/:id
 */
exports.updateAddon = factory.updateOne(addon);

/**
 * Delete addon (soft delete)
 * DELETE /api/v1/subscription/addons/:id
 */
exports.deleteAddon = factory.softdelete(addon);
