const { order, item } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');
const { response } = require('../../utils/response');

exports.bookOrder = catchAsync(async (req, res, next) => {
  const input = req.body;

  const newOrder = await order.create(input.order);

  input?.items.forEach((element) => {
    element.orderId = newOrder.id;
  });

  await item.bulkCreate(input?.items);

  res.status(200).json({
    status: 'success',
    data: {},
  });
});
