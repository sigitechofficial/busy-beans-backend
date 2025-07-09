const {
  order,
  item,
  user,
  address,
  product,
  chequeDetail,
  orderHistory,
  supplier,
  statuses,
  shippingCompanies,
  billingAddress
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
  const invoice =  await Stripe.createInvoiceWithItems({customerId:details.stripeCustomerId , order:details}) 

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
         (SELECT SUM(qty)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        'totalQuantity',
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
      [
        literal( 
          `(SELECT salesReps.srName FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`,
        ),
        'salesRepName',
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
      'createdBy',
      'on',
      'createdAt',
      'shippingCharges'
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

exports.ordersPendingPullouts = catchAsync(async (req, res, next) => {
  let  condition = {
  paymentStatus: 'done',
  // invoiceId: null,
  paymentMethodId: null,

  adminReceivableStatus: false,
  localPatnerCommission: 0.00,
  salesRepId: req.params.srId,
  statusId: {
    [Op.in]: [4, 5]
  }
};
  
  console.log("ðŸš€ ~ exports.allOrder=catchAsync ~ condition:", condition)

  const doc = await order.findAll({
    where: condition,
    include: [
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
        'localPatnerCommission',
      ],
        [
      literal(`
        COALESCE(order.totalBill, 0) - COALESCE((
          SELECT SUM(salerCommission)
          FROM items
          WHERE items.orderId = order.id
        ), 0)
      `),
      'adminReceivableAmount'
        ],
       [
        literal(`COALESCE(
         (SELECT SUM(qty)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        'totalQuantity',
    ],
         [
        literal(`COALESCE(
         (SELECT SUM(wholesalePrice)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        'wholesalePrice',
      ],
           [
        literal( 
          `(SELECT salesReps.srName FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`,
        ),
        'salesRepName',
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
      'invoicePdf',
      'invoiceId',
      'createdBy',
      'on',
      'createdAt',
      'shippingCharges'
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

exports.ordersPendingPayouts = catchAsync(async (req, res, next) => {
  let condition = {
    paymentStatus: 'done',
    adminReceivableStatus: false,
    localPatnerCommission: 0.00,
    salesRepId: req.params.srId,
    statusId: {
      [Op.in]: [4, 5]
    },
    [Op.or]: [
      { paymentMethodId: { [Op.not]: null } },
      { invoiceId: { [Op.not]: null } }
    ]
  };
    
  console.log("ðŸš€ ~ exports.allOrder=catchAsync ~ condition:", condition)

  const doc = await order.findAll({
    where: condition,
    include: [
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
        'localPatnerCommission',
      ],
        [
      literal(`
        COALESCE(order.totalBill, 0) - COALESCE((
          SELECT SUM(salerCommission)
          FROM items
          WHERE items.orderId = order.id
        ), 0)
      `),
      'adminReceivableAmount'
        ],
       [
        literal(`COALESCE(
         (SELECT SUM(qty)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        'totalQuantity',
    ],
         [
        literal(`COALESCE(
         (SELECT SUM(wholesalePrice)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        'wholesalePrice',
      ],
           [
        literal( 
          `(SELECT salesReps.srName FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`,
        ),
        'salesRepName',
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
      'invoicePdf',
      'invoiceId',
      'createdBy',
      'on',
      'createdAt',
      'shippingCharges'
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

exports.orderDetails = catchAsync(async (req, res, next) => {
  let condition = {};
  if (req.params.id) condition.id = req.params.id;
  
  console.log("ðŸš€ ~ exports.allOrder=catchAsync ~ condition:", condition)

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
        include:{
        model: billingAddress,
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'userId', 'deleted', 'deletedAt'],
        },
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
         (SELECT SUM(qty)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        'totalQuantity',
      ], 
      [
        literal(`COALESCE(
         (SELECT SUM(wholesalePrice)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        'wholesalePrice',
      ],
      [
        literal( 
          `(SELECT salesReps.srName FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`,
        ),
        'salesRepName',
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
      'createdBy',
      'on',
      'createdAt',
      'shippingCharges'
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
//! dont need this now
// if(req.body?.orderData?.statusId == 4)processTransferToLocalPartner({orderId:orderId})
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

  console.log("🚀 ~ exports.orderJourneryComplete ~ req.body?.orderData?.statusId :", req.body?.orderData?.statusId )
  if (req.body?.orderData?.statusId) {
    if(req.body?.orderData?.statusId == 2)supplierNewOrderEvent({orderId:orderId})
      
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


exports.findShippingCompanyForWeight = catchAsync(async (req, res, next) => {
   const weight = req.body.weight; // Weight from req.body
   console.log("🚀 ~ exports.findShippingCompanyForWeight=catchAsync ~ weight:", weight)

    // Find the shipping company where the weight is between weightFrom and weightTo
    const shippingCompany = await shippingCompanies.findOne({
      where: {
        weightFrom: {
          [Op.lte]: weight, // Less than or equal to the weight
        },
        weightTo: {
          [Op.gte]: weight, // Greater than or equal to the weight
        },
      },
      attributes:['charges']
    });

    if (!shippingCompany) {
       return next(new AppError('Not dealing in such weights. Contact customer support for this order.', 400));
    }

  return res.status(200).json({
    status: 'success',
    data: shippingCompany,
  });
});

//* UPDATE ORDER
exports.updateOrder = catchAsync(async (req, res, next) => {
  
  const placedOrder = await order.findOne({
    where: { id: req.params.orderId },
    attributes: ['id', 'supplierId','paymentStatus','salesRepId'],
  });

  console.log("🚀 ~ exports.updateOrder=catchAsync ~ body.items:", req.body)
  if (!placedOrder) {
    return next(new AppError('Order not found.', 404));
  }
  else if(placedOrder.paymentStatus == 'done'){
    return next(new AppError('The order payment has already been made. You may proceed with the update.', 404));
  }

   const input = {order:{}}
   input.items = req.body.items
 
  console.log("🚀 ~ exports.bookOrder=catchAsync ~ input:", input)  

  if (input?.items?.length < 1 ) {
   throw new AppError('Update possible, but no changes were made.', 404);
  }
  
  let productIds = input?.items.map(item => item.productId);
  let totalWeight  = 0
  let itemsPrice =0

  console.log("🚀 ~ exports.bookOrder=catchAsync ~ productIds:", productIds)
  const products = await product.findAll({
    where: {
      id: {
        [Op.in]: productIds
      }
    }
  });
 
  console.log("🚀 ~ exports.bookOrder=catchAsync ~ products:", products.length)
  const finalItems = products.map((obj) => {
      const element = {};
      element.productId = obj.id;
      // console.log("🚀 ~ finalItems ~ obj:", obj)

      // Find the matching product in input.items based on productId
      let prod = input?.items.find(item => item.productId == obj.id);

      // Set the qty from input.items or default to 1 if not found
      let qty = prod ? parseInt(prod.qty) : 1;
      console.log("🚀 ~ finalItems ~ qty:", qty)
      element.qty =  qty;
      // Calculate price, wholesalePrice, and weight for the item
      element.price = obj.price * qty;
      element.wholesalePrice = obj.wholesalePrice * qty;
      element.weight = obj.weight * qty;
      element.orderId = placedOrder?.id;

      // Accumulate the total weight and price
      itemsPrice += element.price;
      totalWeight += element.weight;

      // Handle salesRep commission if applicable
      if (placedOrder?.salesRepId) {
          element.salerCommission = parseFloat(element.price) - parseFloat(element.wholesalePrice );
      } else {
          element.wholesalePrice = 0;
          element.salerCommission  =0
      }

      return element; // Return the transformed element
    });
    
  console.log("🚀 ~ exports.paymentIntent=catchAsync ~ totalWeight:", totalWeight)
  const shippingCompany = await shippingCompanies.findOne({
      where: {
        weightFrom: {
          [Op.lte]: totalWeight, // Less than or equal to the weight
        },
        weightTo: {
          [Op.gte]: totalWeight, // Greater than or equal to the weight
        },
      },
      attributes:['charges']
  });

  input.order.itemsPrice = itemsPrice
  input.order.totalWeight = totalWeight
  input.order.shippingCharges = shippingCompany?.charges
  input.order.subTotal = itemsPrice + input.order.vat
  input.order.totalBill = itemsPrice +  parseFloat(input?.order?.vat) + parseFloat(shippingCompany?.charges|0)
  console.log("🚀 ~ exports.paymentIntent=catchAsync ~ shippingCompany?.charges:", shippingCompany?.charges)

  await order.update(input?.order,{where:{id:placedOrder?.id}})
  await item.destroy({where: {orderId: placedOrder?.id}});
  await item.bulkCreate(finalItems)
 
  return res.status(200).json({
    status: 'success',   
    data: {id: req.params.orderId },
  });
  
});