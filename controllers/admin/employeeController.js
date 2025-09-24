// controllers/employeeController.js
const {
  employee,
  account,
  salesRep,
  permission,
  deviceToken,
} = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const {
  deleteDeviceTokenMultiple,
  deleteDeviceTokenSingle,
} = require('../../utils/deviceTokenDelete');
const factory = require('../handlerFactory');
const APIFeatures = require('../../utils/apiFeatures');
const { Op, literal, where, fn, col } = require('sequelize');
console.log('🚀 ~ literal:', process.env.BASE_URL);

exports.createEmployee = catchAsync(async (req, res, next) => {
  // Only allow admin or salesRep to create an employee
  if (req.user.entity === 'admin') {
    req.body.accountId = req.user?.id;
    req.body.employeeOf = 'Admin';
  } else if (req.user.entity === 'localPartner') {
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
    return next(new AppError('User with this email already exists.', 404));
  }

  const newEmployee = await employee.create(req.body);

  const { features } = req.body;
  const permissions =
    features && features.length > 0
      ? features.flatMap((f) =>
          Object.entries(f)
            .filter(([key, value]) => key !== 'feature' && value === true)
            .map(([key]) => ({
              key: `${f.feature}_${key}`,
              employeeId: newEmployee?.id,
            })),
        )
      : [];

  if (permissions && permissions.length > 0)
    await permission.bulkCreate(permissions);

  res.status(201).json({ status: 'success', data: newEmployee });
});

exports.getAllEmployee = async (req, res, next) => {
  const condition = {};
  if (req.user.entity == 'admin') {
    condition.accountId = req.user?.id;
  }
  if (req.user.entity == 'localPartner') {
    condition.salesRepId = req.user.id;
  }
  console.log('🚀 ~ condition:', condition);

  const emp = await employee.findAll({
    where: condition,
    attributes: { exclude: ['password'] },
  });

  res.status(200).json({ status: 'success', data: { data: emp } });
};

exports.getEmployee = async (req, res, next) => {
  const emp = await employee.findByPk(req.params.employeeId, {
    include: { model: permission, attributes: ['id', 'key'] },
  });
  if (!emp) {
    return res.status(404).json({ message: 'Employee not found' });
  }
  res.status(200).json({ status: 'success', data: emp });
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
    return next(new AppError('User with this email already exists.', 404));
  }
  await employee.update(req.body, { where: { id: employeeId } });

  const { features } = req.body;
  const permissions =
    features && features.length > 0
      ? features.flatMap((f) =>
          Object.entries(f)
            .filter(([key, value]) => key !== 'feature' && value === true)
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
    req.user?.entity == 'admin' || req.user?.entity == 'adminEmployee'
      ? 'adminEmployee'
      : 'partnerEmployee';
  deleteDeviceTokenMultiple({
    id: employeeId,
    entity: entity,
    tokenCondition: { employeeId: employeeId },
  });
  res.status(200).json({ status: 'success', data: {} });
};

exports.deleteEmployee = async (req, res, next) => {
  const emp = await employee.findByPk(req.params.employeeId);

  if (!emp) {
    return res.status(404).json({ message: 'Employee not found' });
  }

  const entity =
    req.user?.entity == 'admin' || req.user?.entity == 'adminEmployee'
      ? 'adminEmployee'
      : 'partnerEmployee';
  deleteDeviceTokenSingle({
    id: emp?.id,
    entity: entity,
    tokenCondition: { employeeId: emp?.id },
    refreshToken: req.user?.tokenId,
  });

  await permission.destroy({ where: { employeeId: emp?.id } });
  // Soft delete employee (paranoid mode)
  await emp.destroy();

  res.status(200).json({ status: 'success', message: 'Employee deleted' });
};
