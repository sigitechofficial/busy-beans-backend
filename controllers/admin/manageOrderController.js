const {
  order,
  item,
  user,
  address,
  product,
  chequeDetail,
  orderHistory,
  supplier
} = require('../../models');
const { Op, literal, fn, col } = require('sequelize');

const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');
const { response } = require('../../utils/response');

exports.allOrder = catchAsync(async (req, res, next) => {
  let condition = {};
  if (req.params.id) condition.id = req.params.id;
  if (req.query.statusId) condition.statusId = req.query.statusId;
  if (req.query.orderStatus) condition.orderStatus = req.query.orderStatus;
  if (req.query.supplierId) condition.supplierId = req.query.supplierId;
  if (req.query.userId) condition.userId = req.query.userId;
  
  console.log("🚀 ~ exports.allOrder=catchAsync ~ condition:", condition)
  const doc = await order.findAll({
    where: condition,
    include: [
      {
        model: address,
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'userId', 'deleted', 'deletedAt'],
        },
      },
      {
        model: item,
        attributes: [
          'id',
          [
            literal(
              `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`,
            ),
            'product',
          ],
          'qty',
          'price',
          'discount',
          'orderId',
          'productId',
        ],
      },
    ],
    attributes: [
      'id',
      [
        literal(
          `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        'customerName',
      ],
      'totalBill',
      'subTotal',
      'discountPrice',
      'discountPercentage',
      'itemsPrice',
      'vat',
      'totalWeight',
      'note',
      'paymentMethod',
      'poNumber',
      'frequency',
    ],
  });

  res.status(200).json({
    status: 'success',
    data: {
      results: doc.length,
      data: doc,
    },
  });
});


exports.orderDetails = catchAsync(async (req, res, next) => {
  let condition = {};
  if (req.params.id) condition.id = req.params.id;
  
  console.log("🚀 ~ exports.allOrder=catchAsync ~ condition:", condition)

  const doc = await order.findOne({
    where: condition,
    include: [
      {
        model: address,
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'userId', 'deleted', 'deletedAt'],
        },
      },
      {
        model: supplier,
        attributes: {
          exclude: ['createdAt', 'updatedAt',  'deleted', 'deletedAt','password'],
        },
      },
      {
        model: user,
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'latestOtp','password', 'deleted', 'deletedAt', 'stripeCustomerId' , 'verifiedAt', 'status'],
        },
      },
      {
        model: item,
        attributes: [
          'id',
          [
            literal(
              `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`,
            ),
            'product',
          ],
          'qty',
          'price',
          'discount',
          'orderId',
          'productId',
        ],
      },
      {
        model: orderHistory,
        attributes: [
          'id',
          [
            literal(
              `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = orderHistories.statusId LIMIT 1)`,
            ),
            'orderStatus',
          ],
          [
            literal(
              `(SELECT statuses.discription FROM statuses WHERE statuses.id = orderHistories.statusId LIMIT 1)`,
            ),
            'discription',
          ],
          'on',
          'statusId'
        ],
      },
    ],
    attributes: [
      'id',
      [
        literal(
          `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        'customerName',
      ],
      [
        literal( 
          `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = order.statusId LIMIT 1)`,
        ),
        'orderCurrentStatus',
      ],
      'totalBill',
      'subTotal',
      'discountPrice',
      'discountPercentage',
      'itemsPrice',
      'vat',
      'totalWeight',
      'note',
      'paymentMethod',
      'poNumber',
      'frequency',
      'statusId',
      'trackingNumber'
    ],
  });

  res.status(200).json({
    status: 'success',
    data: {
      order: doc,
    },
  });
});

//* Assigin Supplier will Confirm order from admin side
exports.orderJourneryComplete = catchAsync(async (req, res, next) => {
  const { orderId } = req.body;

  const doc = await order.findOne({
    where: { id: orderId },
    attributes: ['id', 'supplierId'],
  });

  if (!doc) {
    return next(new AppError('Order not found.', 404));
  }

  if (req.body?.orderData)
    await order.update(req.body?.orderData, { where: { id: orderId } });

  if (req.body?.cheque) {
    req.body.cheque.orderId = orderId;
    await order.create(req.body?.cheque);
  }

  if (req.body?.orderData?.statusId) {
    await orderHistory.create({
      statusId: req.body?.orderData?.statusId,
      orderId: orderId,
      on: Date.now(),
    });
  }
  
  return res.status(200).json({
    status: 'success',
    data: {},
  });
});

exports.supplierAcknowledgement = catchAsync(async (req, res, next) => {
  const { supplierId, orderId } = req.body;

  const doc = await order.findOne({
    where: { id: orderId },
    attributes: ['id', 'supplierId'],
  });

  if (!doc) {
    return next(new AppError('Order not found.', 404));
  }

  doc.supplierId = supplierId;
  await doc.save();

  return res.status(200).json({
    status: 'success',
    data: {
      data: doc,
    },
  });
});
