const {
  order,
  item,
  user,
  address,
  product,
  chequeDetail,
  orderHistory,
  supplier,
  statuses
} = require('../../models');
const { Op, literal, fn, col } = require('sequelize');
const APIFeatures = require('../../utils/apiFeatures');

const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const Stripe = require('../stripe');
const factory = require('../handlerFactory');
const { response } = require('../../utils/response');
const { supplierNewOrderEvent } = require('../events/orderToSupplierEvents');
const { sentPaymentInvoiceEvent } = require('../events/sentPaymentInvoiceEvent');
const {
dataForEmailAndNotifications
} = require('../../utils/emailsNotificationsData')

const {
processTransferToLocalPartner
} = require('../../utils/localPatnerCommissionTranfer')

exports.sendInvoice = catchAsync(async (req, res, next) => {
  const { details,email } = await dataForEmailAndNotifications(req.params.orderId);

  if(details?.paymentIntentId || details?.paymentStatus == 'done'){
    return next(new AppError('As the payment for the order has already been made, we are unable to send an invoice at this point.', 404));
  }
  
  const orderData = details
  const invoice = details.invoiceId ? await Stripe.getInvoiceDetails({invoiceId:details.invoiceId }): await Stripe.createInvoiceWithItems({customerId:details.stripeCustomerId , order:details}) 
  await order.update(invoice,{where:{id:details.id}})

  let to = [email]
   if (email) {
      if(details?.emailToSendInvoices && email != details?.emailToSendInvoices) {
        to.push(details?.emailToSendInvoices)
      }
    }

  sentPaymentInvoiceEvent({email:to,data:details,invoice})
  res.status(200).json({
    status: 'success',
    data: {
      order: invoice,
    },
  });
});

exports.getAllSalesRep = factory.getAll(statuses);

exports.allOrder = catchAsync(async (req, res, next) => {
  // Build manual conditions based on query/params
  let condition = {};
  if (req.params.id) condition.id = req.params.id;
  // Build API features (filter, sort, fields, pagination)
  const features = new APIFeatures(order, req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  // Get the base query options (where, limit, offset, order, etc.)
  const queryOptions = features.getQuery();

  // Merge manual filter conditions
  queryOptions.where = { ...(queryOptions.where || {}), ...condition };

  // Add your custom includes
  queryOptions.include = [
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
            `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`
          ),
          'product',
        ],
        [
          literal(
            `(SELECT products.image FROM products WHERE products.id = items.productId LIMIT 1)`
          ),
          'image',
        ],
        'qty',
        'price',
        'discount',
        'orderId',
        'productId',
        'wholesalePrice'
      ],
    },
  ];

  // Custom attributes with literal fields

  queryOptions.attributes = [
    'id',
    [
      literal(
        `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`
      ),
      'customerName',
    ],
    [
      literal(
        `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = order.statusId LIMIT 1)`
      ),
      'orderCurrentStatus',
    ],
    [
        literal(`COALESCE(
         (SELECT SUM(salerCommission)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        'totalSalerCommission',
    ],
    [
        literal(`COALESCE(
         (SELECT SUM(wholesalePrice)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        'adminEarnings',
    ],
    [
        literal(`COALESCE(
         (SELECT SUM(wholesalePrice)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        'wholesalePrice',
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
    'paymentStatus',
    'statusId',
      'adminReceivableStatus',
      'adminReceivableAmount',
      'localPatnerCommission',
      'invoicePdf',
      'invoiceId',
      'createdBy'
  ];

  // Execute the query
  const doc = await order.findAll(queryOptions);

  // Return response
  res.status(200).json({
    status: 'success',
    results: doc.length,
    data: {
      data: doc.reverse(),
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
        model: chequeDetail,
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'deletedAt'],
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
          'wholesalePrice'
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
      [
        literal(`COALESCE(
         (SELECT SUM(salerCommission)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        'totalSalerCommission',
      ],
      [
        literal(`COALESCE(
         (SELECT SUM(wholesalePrice)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        'adminEarnings',
      ],
         [
        literal(`COALESCE(
         (SELECT SUM(wholesalePrice)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        'wholesalePrice',
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
      'trackingNumber',
      'paymentStatus',
      'adminReceivableStatus',
      'adminReceivableAmount',
      'localPatnerCommission',
      'invoicePdf',
      'invoiceId',
      'createdBy'
    ],
  });
  if (!doc) {
    return next(new AppError('Data not found!', 400));
  }
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
    await chequeDetail.create(req.body?.cheque);
  }

  if (req.body?.orderData?.statusId) {
    if(req.body?.orderData?.statusId == 2)supplierNewOrderEvent({orderId:orderId})
    if(req.body?.orderData?.statusId == 5)processTransferToLocalPartner({orderId:orderId})
      
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

//* Assigin Supplier will Confirm order from admin side
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

//* Edit Cheque Information
exports.eidtCheque = catchAsync(async (req, res, next) => {
  const { cheque, chequeId } = req.body;
  await chequeDetail.update(cheque, { where: { id: chequeId } });
 
  return res.status(200).json({
    status: 'success',
    data: {},
  });
});
