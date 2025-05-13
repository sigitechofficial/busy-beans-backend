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
          `(SELECT users.email FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        'email',
      ],
      [
        literal( 
          `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = order.statusId LIMIT 1)`,
        ),
        'orderCurrentStatus',
      ],
      [
        literal(
          `(SELECT suppliers.name FROM suppliers WHERE suppliers.id = order.supplierId LIMIT 1)`,
        ),
        'supplierName',
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
      'on'
    ],
  });
  const output = JSON.parse(JSON.stringify(doc))
  return { appointment: output, email:output?.email }
}
