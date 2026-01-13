// controllers/employeeController.js
const {
  employee,
  account,
  salesRep,
  permission,
  deviceToken,
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
            }))
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
  await employee.update(req.body, { where: { id: employeeId } });

  const { features } = req.body;
  const permissions =
    features && features.length > 0
      ? features.flatMap((f) =>
          Object.entries(f)
            .filter(([key, value]) => key !== "feature" && value === true)
            .map(([key]) => ({
              key: `${f.feature}_${key}`,
              employeeId: employeeId,
            }))
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
      new AppError("Employee not found or not an admin employee!", 404)
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
        error.message
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
          linkError.message
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
      new AppError("Employee not found or Stripe account not created!", 404)
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
      new AppError("Employee not found or Stripe account not created!", 404)
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
        new AppError("Commission percentage must be between 0 and 100", 400)
      );
    }
  }

  const emp = await employee.findByPk(employeeId);
  if (!emp) {
    return next(new AppError("Employee not found!", 404));
  }

  await employee.update(
    { commissionPercentage },
    { where: { id: employeeId } }
  );

  res.status(200).json({
    status: "success",
    data: {
      message: "Commission percentage updated successfully.",
    },
  });
});
