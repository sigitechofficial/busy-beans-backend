const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const {
  createMultiInvoiceCheckout,
} = require("../../services/multiInvoiceCheckoutService");

/**
 * Customer selects multiple unpaid invoices and requests one combined checkout session.
 * POST /api/v1/users/multi-invoice-checkout/fetch
 * Body: { orderIds: number[] }
 */
exports.fetchMultiInvoiceCheckout = catchAsync(async (req, res, next) => {
  if (req.user?.entity !== "user") {
    return next(
      new AppError("Only customers can pay multiple invoices from this endpoint.", 403),
    );
  }

  const { orderIds } = req.body;
  const userId = req.user.id;

  const result = await createMultiInvoiceCheckout({
    orderIds,
    authenticatedUserId: userId,
  });

  return res.status(200).json({
    status: "success",
    data: result,
  });
});
