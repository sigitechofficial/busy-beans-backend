const { order, item,orderHistory,orderFrequency } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');
const { response } = require('../../utils/response');
const { setOrderFrequency } = require('../admin/orderFrequencyController');
const {orderEvents} = require('../events/orderEvents')
const {createPaymentIntent} = require('../stripe')

exports.bookOrder = catchAsync(async (req, res, next) => {
  const input = req.body;
  if (input?.items?.length < 1 ) {
   throw new AppError('Cart is empty add products to place order', 404);
  }
  input.order.statusId = 1
  const newOrder = await order.create(input?.order);

  await orderHistory.create({
    statusId:1,
    orderId:newOrder.id,
    on: Date.now(),
  });

  input?.items.forEach((element) => {
    element.orderId = newOrder.id;
  });
  await item.bulkCreate(input?.items);
  
  if(newOrder.frequency != 'just-onces')setOrderFrequency({orderData:newOrder})


  orderEvents({orderId:newOrder?.id})
  return res.status(200).json({
    status: 'success',   
    data: {id:newOrder?.id},
  });
});

exports.paymentIntent = catchAsync(async (req, res, next) => {
  const output = await createPaymentIntent(req.body.amount)
  return res.status(200).json({
    status: 'success',   
    data: output,
  });
});

