const { coffeeMachine, machineQuery } = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const factory = require("../handlerFactory");
const { Op, literal, where } = require("sequelize");
const REDIS = require("../../utils/redisHandling");

exports.getAllMachines = factory.getAll(coffeeMachine);
exports.getMachines = factory.getOne(coffeeMachine);
exports.createMachines = factory.createOne(coffeeMachine);
exports.updateMachines = factory.updateOne(coffeeMachine);
exports.deleteMachines = factory.softdelete(coffeeMachine);

exports.coffeeMachineQuries = catchAsync(async (req, res, next) => {
  const result = await machineQuery.findAll({});

  res.status(200).json({
    status: "success",
    data: { result },
  });
});
// exports.Add = catchAsync(async (req, res, next) => {
//   const exist = await order.findOne({
//     where: {
//       supplierId: req.params?.id,
//       statusId: {
//         [Op.in]: [2, 3, 4],
//       },
//     },
//     attributes: ["id"],
//   });

//   if (exist) {
//     return next(
//       new AppError("Pending work prevents supplier from being deleted.", 400)
//     );
//   }

//   await supplier.update(
//     { deleted: true },
//     {
//       where: { id: req.params.id },
//     }
//   );

//   res.status(200).json({
//     status: "success",
//     data: {},
//   });
// });
