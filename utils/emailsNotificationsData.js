const {
  order,
  orderHistory,
  item,
  address,
  user,
  salesRep,
  supplier,
  billingAddress,
  deviceToken,
} = require('../models');
const { Op, literal } = require('sequelize');
const { emailDateFormate } = require('./emailDateFormate');
// const { Op, literal, fn, col } = require('sequelize');

exports.dataForEmailAndNotifications = async (orderId) => {
  console.log(
    'ðŸš€ ~ exports.dataForEmailAndNotifications= ~ orderId:',
    orderId,
  );

  let itemAttributes = [
    'id',
    [
      literal(
        `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`,
      ),
      'product',
    ],
    'qty',
    'productName',
    'price',
    'discount',
    'orderId',
    'type',
    'productId',
    [
      literal(
        `(SELECT products.sku FROM products WHERE products.id = items.productId LIMIT 1)`,
      ),
      'sku',
    ],

    [
      literal(
        `(SELECT products.sku FROM products WHERE products.id = items.productId LIMIT 1)`,
      ),
      'productCode',
    ],
    [
      literal(
        `(SELECT products.grind FROM products WHERE products.id = items.productId LIMIT 1)`,
      ),
      'grind',
    ],
    [
      literal(`
            (SELECT supplierSku
            FROM skuSuppliers
            WHERE skuSuppliers.productId = items.productId
              AND skuSuppliers.supplierId = order.supplierId
            LIMIT 1)
          `),
      'supplierSku',
    ],
  ];

  const doc = await order.findOne({
    where: { id: orderId },

    attributes: [
      'id',
      [
        literal(
          `(SELECT users.countryCode FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        'countryCountry',
      ],
      [
        literal(
          `(SELECT users.phoneNumber FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        'phoneNumber',
      ],
      [
        literal(
          `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        'customerName',
      ],
      [
        literal(
          `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        'companyName',
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
          `(SELECT users.dispatchEmail FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        'dispatchEmail',
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
        'adminReceivableAmount',
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
      [
        literal(
          `(SELECT salesReps.email FROM salesReps WHERE salesReps.id = order.salesRepId LIMIT 1)`,
        ),
        'patnerEmail',
      ],
      [
        literal(`COALESCE(
              (SELECT SUM(qty)
                FROM items
                WHERE items.orderId = order.id ), 0)`),
        'totalQuantity',
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
      'supplierId',
      'adminReceivableStatus',
      'adminReceivableAmount',
      'localPatnerCommission',
      'invoicePdf',
      'invoiceId',
      'createdAt',
      'userId',
      'paymentMethodId',
      'shippingCompany',
      'shippingCharges',
      'poNumber',
      'hostedInvoiceUrl',
      'invoiceNumber',
      'invoiceDate',
      'invoiceReminder',
      'invoicePaidDate',
    ],
    include: [
      {
        model: address,
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'userId', 'deleted', 'deletedAt'],
        },
      },
      {
        model: item,
        attributes: itemAttributes,
      },
      {
        model: salesRep,
        attributes: {
          exclude: [
            'createdAt',
            'updatedAt',
            'deleted',
            'deletedAt',
            'password',
          ],
        },
      },
      {
        model: user,
        attributes: {
          exclude: [
            'createdAt',
            'updatedAt',
            'latestOtp',
            'password',
            'deleted',
            'deletedAt',
            'stripeCustomerId',
            'verifiedAt',
            'status',
          ],
        },
        include: {
          model: billingAddress,
          attributes: {
            exclude: [
              'createdAt',
              'updatedAt',
              'userId',
              'deleted',
              'deletedAt',
            ],
          },
        },
      },
    ],
  });
  const output = JSON.parse(JSON.stringify(doc));
  console.log(
    'ðŸš€ ~ exports.dataForEmailAndNotifications= ~ output:',
    output?.id,
  );

  const tokenCondition = {
    [Op.or]: [
      { supplierId: output?.supplierId },
      { salesRepId: output?.salesRepId },
      { accountId: 1 },
      { userId: output?.userId },
    ],
  };

  const dvtokens = await deviceToken.findAll({ where: tokenCondition });

  // Now split them into 4 arrays
  const adminTokens = dvtokens
    .filter((t) => t.accountId === 1)
    .map((t) => t.tokenId);

  const userTokens = dvtokens
    .filter((t) => t.userId === order.userId)
    .map((t) => t.tokenId);

  const supplierTokens = dvtokens
    .filter((t) => t.supplierId === order.supperId)
    .map((t) => t.tokenId);

  const salesRepTokens = dvtokens
    .filter((t) => t.salesRepId === order.salesRepId)
    .map((t) => t.tokenId);

  output.localPatnerCommission = await item.sum('salerCommission', {
    where: { orderId: output.id },
  });

  output.adminReceivableAmount =
    parseFloat(output?.totalBill || 0) -
    parseFloat(output.localPatnerCommission || 0);

  return {
    details: output,
    email: output?.email,
    adminTokens,
    userTokens,
    supplierTokens,
    salesRepTokens,
  };
};
