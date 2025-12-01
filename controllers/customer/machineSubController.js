const { coffeeMachine, machineQuery } = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const factory = require("../handlerFactory");
const { Op, literal, where } = require("sequelize");
const REDIS = require("../../utils/redisHandling");
const coffeeMachineQuatationEmailCustomer = require("../../helper/coffeeMachineQuotation");

exports.coffeeMachineContact = catchAsync(async (req, res, next) => {
  console.log("🚀 ~~~~~~~~ :", req?.body);
  await machineQuery.create(req?.body);
  coffeeMachineQuatationEmailCustomer({ data: req?.body });
  res.status(200).json({
    status: "success",
    data: {},
  });
});

exports.coffeeMachineAdmin = catchAsync(async (req, res, next) => {
  const exist = await coffeeMachine.findOne({
    where: {
      supplierId: req.params?.id,
      statusId: {
        [Op.in]: [2, 3, 4],
      },
    },
    attributes: ["id"],
  });

  if (exist) {
    return next(
      new AppError("Pending work prevents supplier from being deleted.", 400)
    );
  }

  res.status(200).json({
    status: "success",
    data: {},
  });
});
