// controllers/employeeController.js
const { employee, account, salesRep } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');
const APIFeatures = require('../../utils/apiFeatures');
const { Op, literal, where, fn, col } = require('sequelize');

exports.createEmployee = catchAsync(async (req, res, next) => {
  // Only allow admin or salesRep to create an employee
  if (req.user.entity === 'admin') req.body.accountId = req.user?.id;
  else if (req.user.entity === 'localPartner')
    req.body.salesRepId = req.user?.id;

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

  res.status(201).json({ status: 'success', data: newEmployee });
});

exports.getAllEmployee = async (req, res,next) => {
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
  const emp = await employee.findByPk(req.params.employeeId);
  if (!emp) {
    return res.status(404).json({ message: 'Employee not found' });
  }
  res.status(200).json({ status: 'success', data: emp });
};

exports.updateEmployee = async (req, res ,next) => {
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
  res.status(200).json({ status: 'success', data: {} });
};

exports.deleteEmployee = async (req, res, next) => {
  const emp = await employee.findByPk(req.params.employeeId);
  if (!emp) {
    return res.status(404).json({ message: 'Employee not found' });
  }
  // Soft delete employee (paranoid mode)
  await emp.destroy();

  res.status(200).json({ status: 'success', message: 'Employee deleted' });
};
