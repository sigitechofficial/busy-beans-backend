const {
  order,
  orderHistory,
  item,
  address,
  user
} = require('../models')
const { literal } = require('sequelize')
const { emailDateFormate } = require('./emailDateFormate')

exports.dataForEmailAndNotifications = async (orderId) => {
  const doc = await order.findOne({
    where: { id : orderId },
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
      [
        literal(
          `(SELECT users.stripeCustomerId FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        'stripeCustomerId',
      ],
      [
        literal(
          `(SELECT users.email FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        'email',
      ],
      [
        literal(
          `(SELECT users.billingAddress FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        'billingAddress',
      ],
      [
        literal(
          `(SELECT users.emailToSendInvoices FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        'emailToSendInvoices',
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
        literal(
          `(SELECT supplier.supplierName FROM supplier WHERE supplier.id = order.supplierId LIMIT 1)`,
        ),
        'supplierName',
      ],
       [
        literal(
          `(SELECT supplier.email FROM supplier WHERE supplier.id = order.supplierId LIMIT 1)`,
        ),
        'supplierEmail',
      ],
      [
        literal(
          `(SELECT salesReps.srName FROM salesReps WHERE salesReps.id = order.salesRepId LIMIT 1)`,
        ),
        'srName',
      ],
      [
        literal(
          `(SELECT salesReps.connectAccountId FROM salesReps WHERE salesReps.id = order.salesRepId LIMIT 1)`,
        ),
        'connectAccountId',
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
      'on',
      'salesRepId',
      'adminReceivableStatus',
      'adminReceivableAmount',
      'localPatnerCommission',
      'invoicePdf',
      'invoiceId',
      'createdBy',
      'userId',
      'paymentMethodId',
      'shippingCharges',
      'poNumber',
    ],
  });
  const output = JSON.parse(JSON.stringify(doc))
  console.log("🚀 ~ exports.dataForEmailAndNotifications= ~ output:", output.totalBill)

  output.localPatnerCommission = await item.sum('salerCommission', { where: { orderId: output.id } });
  output.adminReceivableAmount = parseFloat(output?.totalBill || 0) - parseFloat(output.localPatnerCommission||0);

  return { details: output, email:output?.email }
}
