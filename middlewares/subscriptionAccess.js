const { subscription } = require("../models");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

/**
 * After `protect` on /api/v1/users/subscription/:id*: a customer may only open their own
 * subscription, or one not yet assigned to anyone (admin-created, paid by the customer who opens
 * the payment link). A `:userId` in the path must be the signed-in customer. Staff tokens pass.
 * Someone else's subscription answers 404 (never confirms that the id exists).
 */
exports.requireOwnSubscription = catchAsync(async (req, res, next) => {
  if (req.user?.entity !== "user") return next();
  const me = String(req.user.id);
  if (req.params.userId != null && String(req.params.userId) !== me) {
    return next(new AppError("Subscription not found", 404));
  }
  const record = await subscription.findByPk(req.params.id, {
    attributes: ["id", "userId"],
  });
  if (!record || (record.userId != null && String(record.userId) !== me)) {
    return next(new AppError("Subscription not found", 404));
  }
  next();
});
