// controllers/employeeController.js
const {
  employee,
  account,
  salesRep,
  permission,
  deviceToken,
  order,
  user,
} = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const {
  deleteDeviceTokenMultiple,
  deleteDeviceTokenSingle,
} = require("../../utils/deviceTokenDelete");
const factory = require("../handlerFactory");
const APIFeatures = require("../../utils/apiFeatures");
const { Op, literal, where, fn, col } = require("sequelize");
const Stripe = require("../stripe");
const {
  transferEmployeeCommission,
  bulkTransferEmployeeCommission,
} = require("../../utils/employeeCommissionUtils");
const bcrypt = require("bcryptjs");

console.log("🚀 ~ literal:", process.env.BASE_URL);

exports.createEmployee = catchAsync(async (req, res, next) => {
  // Only allow admin or salesRep to create an employee
  if (req.user.entity === "admin") {
    req.body.accountId = req.user?.id;
    req.body.employeeOf = "Admin";
  } else if (req.user.entity === "localPartner") {
    req.body.salesRepId = req.user?.id;
  }

  let exist = req.body?.email
    ? await account.findOne({ where: { email: req.body?.email } })
    : null;

  if (!exist)
    exist = req.body?.email
      ? await salesRep.findOne({ where: { email: req.body?.email } })
      : null;

  if (exist) {
    return next(new AppError("User with this email already exists.", 404));
  }

  const newEmployee = await employee.create(req.body);

  const { features } = req.body;
  const permissions =
    features && features.length > 0
      ? features.flatMap((f) =>
          Object.entries(f)
            .filter(([key, value]) => key !== "feature" && value === true)
            .map(([key]) => ({
              key: `${f.feature}_${key}`,
              employeeId: newEmployee?.id,
            })),
        )
      : [];

  if (permissions && permissions.length > 0)
    await permission.bulkCreate(permissions);

  res.status(201).json({ status: "success", data: newEmployee });
});

exports.getAllEmployee = async (req, res, next) => {
  const condition = {};
  if (req.user.entity == "admin") {
    condition.accountId = req.user?.id;
  }
  if (req.user.entity == "localPartner") {
    condition.salesRepId = req.user.id;
  }
  console.log("🚀 ~ condition:", condition);

  const emp = await employee.findAll({
    where: condition,
    attributes: { exclude: ["password"] },
  });

  res.status(200).json({ status: "success", data: { data: emp } });
};

exports.getEmployee = async (req, res, next) => {
  const emp = await employee.findByPk(req.params.employeeId, {
    include: { model: permission, attributes: ["id", "key"] },
  });
  if (!emp) {
    return res.status(404).json({ message: "Employee not found" });
  }
  res.status(200).json({ status: "success", data: emp });
};

exports.updateEmployee = async (req, res, next) => {
  const { employeeId } = req.params;
  let exist = req.body?.email
    ? await account.findOne({ where: { email: req.body?.email } })
    : null;

  if (!exist)
    exist = req.body?.email
      ? await salesRep.findOne({ where: { email: req.body?.email } })
      : null;

  if (exist) {
    return next(new AppError("User with this email already exists.", 404));
  }

  const updateData = { ...req.body };
  if (updateData.password) {
    updateData.password = bcrypt.hashSync(updateData.password, 12);
  }

  await employee.update(updateData, {
    where: { id: employeeId },
    individualHooks: true,
  });

  const { features } = req.body;
  const permissions =
    features && features.length > 0
      ? features.flatMap((f) =>
          Object.entries(f)
            .filter(([key, value]) => key !== "feature" && value === true)
            .map(([key]) => ({
              key: `${f.feature}_${key}`,
              employeeId: employeeId,
            })),
        )
      : [];

  await permission.destroy({ where: { employeeId: employeeId } });
  if (permissions && permissions.length > 0)
    await permission.bulkCreate(permissions);

  const entity =
    req.user?.entity == "admin" || req.user?.entity == "adminEmployee"
      ? "adminEmployee"
      : "partnerEmployee";
  deleteDeviceTokenMultiple({
    id: employeeId,
    entity: entity,
    tokenCondition: { employeeId: employeeId },
  });
  res.status(200).json({ status: "success", data: {} });
};

exports.deleteEmployee = async (req, res, next) => {
  const emp = await employee.findByPk(req.params.employeeId);

  if (!emp) {
    return res.status(404).json({ message: "Employee not found" });
  }

  const entity =
    req.user?.entity == "admin" || req.user?.entity == "adminEmployee"
      ? "adminEmployee"
      : "partnerEmployee";

  deleteDeviceTokenSingle({
    id: emp?.id,
    entity: entity,
    tokenCondition: { employeeId: emp?.id },
    refreshToken: req.user?.tokenId,
  });

  await permission.destroy({ where: { employeeId: emp?.id } });

  await emp.destroy();

  res.status(200).json({ status: "success", message: "Employee deleted" });
};

// Create Stripe Connect Account for Admin Employee
exports.stripeConnectAccount = catchAsync(async (req, res, next) => {
  const { returnUrl } = req.body;

  if (!returnUrl) {
    return next(new AppError("returnUrl is required in request body", 400));
  }

  const emp = await employee.findOne({
    where: {
      id: req.params.employeeId,
      employeeOf: "Admin", // Only for admin employees
    },
  });

  if (!emp) {
    return next(
      new AppError("Employee not found or not an admin employee!", 404),
    );
  }

  // Check if account already exists
  if (emp.stripeConnectAccountId) {
    try {
      // Check if account is active and ready to receive payments
      const accountStatus = await Stripe.retrieveConnectAccount({
        accountId: emp.stripeConnectAccountId,
      });

      // If account is active (all checks passed in retrieveConnectAccount)
      res.status(200).json({
        status: "success",
        data: {
          message: "Account is connected",
          accountState: true,
          accountId: emp.stripeConnectAccountId,
          account: accountStatus,
        },
      });
      return;
    } catch (error) {
      // Account exists but not active - need to complete onboarding
      console.log(
        "🚀 ~ Account exists but not active, getting onboarding link:",
        error.message,
      );

      try {
        const onboardingLink = await Stripe.createStripeAccountLink({
          accountId: emp.stripeConnectAccountId,
          returnUrl: returnUrl,
        });

        res.status(200).json({
          status: "success",
          data: {
            message: "Account connect pending",
            accountState: false,
            accountId: emp.stripeConnectAccountId,
            onboardingLink: onboardingLink,
          },
        });
        return;
      } catch (linkError) {
        // If getting link fails, create new account
        console.log(
          "🚀 ~ Error getting link, creating new account:",
          linkError.message,
        );
      }
    }
  }

  // Account doesn't exist - create new account
  const connectAccount = await Stripe.createConnectAccount({
    email: emp.email,
    returnUrl: returnUrl,
  });

  emp.stripeConnectAccountId = connectAccount.accountId;
  await emp.save();

  res.status(200).json({
    status: "success",
    data: {
      message: "Account connect pending",
      accountState: false,
      accountId: connectAccount.accountId,
      onboardingLink: connectAccount.accountLink?.url || null,
    },
  });
});

// Get Stripe Connect Account Link (for onboarding)
exports.stripeConnectAccountLink = catchAsync(async (req, res, next) => {
  const emp = await employee.findOne({
    where: {
      id: req.params.employeeId,
      employeeOf: "Admin",
      stripeConnectAccountId: { [Op.ne]: null },
    },
  });

  if (!emp) {
    return next(
      new AppError("Employee not found or Stripe account not created!", 404),
    );
  }

  const connectAccount = await Stripe.createStripeAccountLink({
    accountId: emp.stripeConnectAccountId,
    returnUrl: req.body.returnUrl,
  });

  res.status(200).json({
    status: "success",
    data: {
      message: "Stripe Connect Account Link.",
      data: { connectAccount },
    },
  });
});

// Get Stripe Connect Account Dashboard Link
exports.stripeConnectAccountDashboard = catchAsync(async (req, res, next) => {
  const emp = await employee.findOne({
    where: {
      id: req.params.employeeId,
      employeeOf: "Admin",
      stripeConnectAccountId: { [Op.ne]: null },
    },
  });

  if (!emp) {
    return next(
      new AppError("Employee not found or Stripe account not created!", 404),
    );
  }

  const connectAccount = await Stripe.createStripeLoginLink({
    accountId: emp.stripeConnectAccountId,
  });

  res.status(200).json({
    status: "success",
    data: {
      message: "Stripe Connect Account Dashboard.",
      data: { connectAccount },
    },
  });
});

// Update Commission Percentage
exports.updateCommission = catchAsync(async (req, res, next) => {
  const { employeeId } = req.params;
  const { commissionPercentage } = req.body;

  if (commissionPercentage !== undefined) {
    if (commissionPercentage < 0 || commissionPercentage > 100) {
      return next(
        new AppError("Commission percentage must be between 0 and 100", 400),
      );
    }
  }

  const emp = await employee.findByPk(employeeId);
  if (!emp) {
    return next(new AppError("Employee not found!", 404));
  }

  await employee.update(
    { commissionPercentage },
    { where: { id: employeeId } },
  );

  res.status(200).json({
    status: "success",
    data: {
      message: "Commission percentage updated successfully.",
    },
  });
});

// Get orders with employee commission (transferred/not-transferred)
exports.getEmployeeCommissionOrders = catchAsync(async (req, res, next) => {
  // Only allow admin
  if (req.user.entity !== "admin" && req.user.entity !== "adminEmployee") {
    return next(
      new AppError(
        "Only admin and admin employees can access this endpoint",
        403,
      ),
    );
  }
  const { status } = req.params; // "transferred" or "not-transferred"

  if (!status || !["transferred", "not-transferred"].includes(status)) {
    return next(
      new AppError(
        "Status parameter is required and must be 'transferred' or 'not-transferred'",
        400,
      ),
    );
  }

  // Build condition based on status
  const condition = {
    employeeId:
      req.user.entity == "adminEmployee" ? req?.user?.id : { [Op.ne]: null }, // Must have employee commission data
    employeeCommisionAmount: { [Op.gt]: 0 }, // Commission amount must be > 0
  };

  if (status === "transferred") {
    condition.employeeTransferId = { [Op.ne]: null }; // Has transfer ID
  } else {
    // not-transferred
    condition.employeeTransferId = { [Op.is]: null }; // No transfer ID
    condition.paymentStatus = "Done"; // Payment status should be 'Done'
  }

  // Use APIFeatures for pagination, sorting, etc.
  const features = new APIFeatures(order, req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  // Get the base query options (where, limit, offset, order, etc.)
  const queryOptions = features.getQuery();

  // Merge condition with existing where conditions
  if (Object.keys(condition).length > 0) {
    if (queryOptions.where && queryOptions.where[Op.and]) {
      queryOptions.where[Op.and].push(condition);
    } else if (queryOptions.where) {
      queryOptions.where = {
        [Op.and]: [queryOptions.where, condition],
      };
    } else {
      queryOptions.where = condition;
    }
  }

  // Add attributes
  queryOptions.attributes = [
    "id",
    "totalBill",
    "subTotal",
    "shippingCharges",
    // Add employee name and user company name via Sequelize literal
    [
      literal(
        `(SELECT employees.name FROM employees WHERE employees.id = order.employeeId LIMIT 1)`,
      ),
      "employeeName",
    ],
    [
      literal(
        `(SELECT employees.stripeConnectAccountId FROM employees WHERE employees.id = order.employeeId LIMIT 1)`,
      ),
      "stripeConnectAccountId",
    ],
    [
      literal(
        `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`,
      ),
      "companyName",
    ],
    "invoiceNumber",
    "paymentMethod",
    "paymentStatus",
    "paymentIntentId",
    "employeeId",
    "AppliedEmployeeCommisionPercentage",
    "employeeCommisionAmount",
    "employeeTransferId",
    "on",
    "createdAt",
  ];

  // Get pagination metadata
  const pagination = await features.getPaginationMetadata(order, {
    where: condition,
    include: queryOptions.include,
  });

  // Execute the query
  const result = await order.findAll(queryOptions);

  res.status(200).json({
    status: "success",
    results: result.length,
    pagination: pagination,
    data: {
      data: result,
      status: status, // Return the filter status for reference
    },
  });
});

// Transfer commission to employees for multiple orders
exports.transferCommissionToEmployeeController = catchAsync(
  async (req, res, next) => {
    // Only allow admin and adminEmployee
    if (req.user.entity !== "admin" && req.user.entity !== "adminEmployee") {
      return next(
        new AppError(
          "Only admin and admin employees can access this endpoint",
          403,
        ),
      );
    }

    const { orderIds } = req.body;

    // Validate input
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return next(
        new AppError("orderIds is required and must be a non-empty array", 400),
      );
    }

    // Validate all IDs are numbers
    const invalidIds = orderIds.filter(
      (id) => !Number.isInteger(id) && !Number.isInteger(Number(id)),
    );
    if (invalidIds.length > 0) {
      return next(
        new AppError(
          `Invalid order IDs: ${invalidIds.join(", ")}. All IDs must be numbers.`,
          400,
        ),
      );
    }

    console.log(
      `🚀 ~ transferCommissionToEmployeeController ~ Processing ${orderIds.length} orders`,
    );

    // Process transfers for each order
    const results = [];
    const successful = [];
    const failed = [];

    for (const orderId of orderIds) {
      try {
        const transferResult = await transferEmployeeCommission({
          orderId: Number(orderId),
        });

        if (transferResult && transferResult.success) {
          successful.push({
            orderId: Number(orderId),
            transferId: transferResult.transferId,
            commissionAmount: transferResult.commissionAmount,
            message: transferResult.message,
          });
          results.push({
            orderId: Number(orderId),
            status: "success",
            transferId: transferResult.transferId,
            commissionAmount: transferResult.commissionAmount,
          });
        } else {
          failed.push({
            orderId: Number(orderId),
            message: "Transfer failed - check logs for details",
          });
          results.push({
            orderId: Number(orderId),
            status: "failed",
            message: "Transfer failed - check logs for details",
          });
        }
      } catch (error) {
        console.error(
          `❌ Error transferring commission for order ${orderId}:`,
          error.message,
        );
        failed.push({
          orderId: Number(orderId),
          message: error.message || "Transfer failed",
        });
        results.push({
          orderId: Number(orderId),
          status: "error",
          message: error.message || "Transfer failed",
        });
      }
    }

    console.log(
      `✅ Transfer summary: ${successful.length} successful, ${failed.length} failed`,
    );

    res.status(200).json({
      status: "success",
      data: {
        total: orderIds.length,
        successful: successful.length,
        failed: failed.length,
        results: results,
        summary: {
          successful: successful,
          failed: failed,
        },
      },
    });
  },
);

// Bulk transfer commission to employees - sums all commissions per employee and transfers once
exports.bulkTransferCommissionToEmployeeController = catchAsync(
  async (req, res, next) => {
    // Only allow admin and adminEmployee
    if (req.user.entity !== "admin" && req.user.entity !== "adminEmployee") {
      return next(
        new AppError(
          "Only admin and admin employees can access this endpoint",
          403,
        ),
      );
    }

    const { orderIds } = req.body;

    // Validate input
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return next(
        new AppError("orderIds is required and must be a non-empty array", 400),
      );
    }

    // Validate all IDs are numbers
    const invalidIds = orderIds.filter(
      (id) => !Number.isInteger(id) && !Number.isInteger(Number(id)),
    );
    if (invalidIds.length > 0) {
      return next(
        new AppError(
          `Invalid order IDs: ${invalidIds.join(", ")}. All IDs must be numbers.`,
          400,
        ),
      );
    }

    console.log(
      `🚀 ~ bulkTransferCommissionToEmployeeController ~ Processing ${orderIds.length} orders`,
    );

    // Call bulk transfer function
    const result = await bulkTransferEmployeeCommission({ orderIds });

    if (!result) {
      return next(
        new AppError("Bulk transfer failed. Check logs for details.", 500),
      );
    }

    res.status(200).json({
      status: "success",
      data: result,
    });
  },
);
