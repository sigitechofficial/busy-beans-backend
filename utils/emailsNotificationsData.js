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
  account,
  partnerOrder,
  partnerOrderItem,
} = require("../models");
const { Op, literal } = require("sequelize");
const { emailDateFormate } = require("./emailDateFormate");
// const { Op, literal, fn, col } = require('sequelize');

const customerOrder = async ({ orderId }) => {
  try {
    let itemAttributes = [
      "id",
      [
        literal(
          `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`
        ),
        "product",
      ],
      "qty",
      "productName",
      "price",
      "discount",
      "orderId",
      "type",
      "productId",
      [
        literal(
          `(SELECT products.sku FROM products WHERE products.id = items.productId LIMIT 1)`
        ),
        "sku",
      ],

      [
        literal(
          `(SELECT products.sku FROM products WHERE products.id = items.productId LIMIT 1)`
        ),
        "productCode",
      ],
      [
        literal(
          `(SELECT products.grind FROM products WHERE products.id = items.productId LIMIT 1)`
        ),
        "grind",
      ],
      [
        literal(`
            (SELECT supplierSku
            FROM skuSuppliers
            WHERE skuSuppliers.productId = items.productId
              AND skuSuppliers.supplierId = order.supplierId
            LIMIT 1)
          `),
        "supplierSku",
      ],
    ];

    const doc = await order.findOne({
      where: { id: orderId },

      attributes: [
        "id",
        [
          literal(
            `(SELECT users.countryCode FROM users WHERE users.id = order.userId LIMIT 1)`
          ),
          "countryCountry",
        ],
        [
          literal(
            `(SELECT users.phoneNumber FROM users WHERE users.id = order.userId LIMIT 1)`
          ),
          "phoneNumber",
        ],
        [
          literal(
            `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`
          ),
          "customerName",
        ],
        [
          literal(
            `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`
          ),
          "companyName",
        ],
        [
          literal(
            `(SELECT users.stripeCustomerId FROM users WHERE users.id = order.userId LIMIT 1)`
          ),
          "stripeCustomerId",
        ],
        [
          literal(
            `(SELECT users.email FROM users WHERE users.id = order.userId LIMIT 1)`
          ),
          "email",
        ],
        [
          literal(
            `(SELECT users.billingAddress FROM users WHERE users.id = order.userId LIMIT 1)`
          ),
          "billingAddress",
        ],
        [
          literal(
            `(SELECT users.emailToSendInvoices FROM users WHERE users.id = order.userId LIMIT 1)`
          ),
          "emailToSendInvoices",
        ],
        [
          literal(
            `(SELECT users.dispatchEmail FROM users WHERE users.id = order.userId LIMIT 1)`
          ),
          "dispatchEmail",
        ],
        [
          literal(
            `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = order.statusId LIMIT 1)`
          ),
          "orderCurrentStatus",
        ],
        [
          literal(`COALESCE(
         (SELECT SUM(salerCommission)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
          "localPatnerCommission",
        ],
        [
          literal(`
            COALESCE(order.totalBill, 0) - COALESCE((
              SELECT SUM(salerCommission)
              FROM items
              WHERE items.orderId = order.id
            ), 0)
          `),
          "adminReceivableAmount",
        ],
        [
          literal(
            `(SELECT supplier.supplierName FROM supplier WHERE supplier.id = order.supplierId LIMIT 1)`
          ),
          "supplierName",
        ],
        [
          literal(
            `(SELECT supplier.email FROM supplier WHERE supplier.id = order.supplierId LIMIT 1)`
          ),
          "supplierEmail",
        ],
        [
          literal(
            `(SELECT salesReps.srName FROM salesReps WHERE salesReps.id = order.salesRepId LIMIT 1)`
          ),
          "srName",
        ],
        [
          literal(
            `(SELECT salesReps.connectAccountId FROM salesReps WHERE salesReps.id = order.salesRepId LIMIT 1)`
          ),
          "connectAccountId",
        ],
        [
          literal(
            `(SELECT salesReps.email FROM salesReps WHERE salesReps.id = order.salesRepId LIMIT 1)`
          ),
          "patnerEmail",
        ],
        [
          literal(`COALESCE(
              (SELECT SUM(qty)
                FROM items
                WHERE items.orderId = order.id ), 0)`),
          "totalQuantity",
        ],
        "totalBill",
        "subTotal",
        "discountPrice",
        "discountPercentage",
        "itemsPrice",
        "vat",
        "totalWeight",
        "note",
        "paymentMethod",
        "poNumber",
        "frequency",
        "statusId",
        "trackingNumber",
        "paymentStatus",
        "on",
        "salesRepId",
        "supplierId",
        "adminReceivableStatus",
        "adminReceivableAmount",
        "localPatnerCommission",
        "invoicePdf",
        "invoiceId",
        "createdAt",
        "userId",
        "paymentMethodId",
        "shippingCompany",
        "shippingCharges",
        "poNumber",
        "hostedInvoiceUrl",
        "invoiceNumber",
        "invoiceDate",
        "invoiceReminder",
        "invoicePaidDate",
      ],
      include: [
        {
          model: address,
          attributes: {
            exclude: [
              "createdAt",
              "updatedAt",
              "userId",
              "deleted",
              "deletedAt",
            ],
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
              "createdAt",
              "updatedAt",
              "deleted",
              "deletedAt",
              "password",
            ],
          },
        },
        {
          model: user,
          attributes: {
            exclude: [
              "createdAt",
              "updatedAt",
              "latestOtp",
              "password",
              "deleted",
              "deletedAt",
              "stripeCustomerId",
              "verifiedAt",
              "status",
            ],
          },
          include: {
            model: billingAddress,
            attributes: {
              exclude: [
                "createdAt",
                "updatedAt",
                "userId",
                "deleted",
                "deletedAt",
              ],
            },
          },
        },
      ],
    });
    return JSON.parse(JSON.stringify(doc));
  } catch (err) {
    console.error(err);
  }
};

const localPartnerOrder = async ({ orderId }) => {
  try {
    console.log("🚀 ~ localPartnerOrder ~ localPartnerOrder:", orderId);
    console.log("🚀 ~ localPartnerOrder ~ localPartnerOrder:", orderId);
    console.log("🚀 ~ localPartnerOrder ~ localPartnerOrder:");
    console.log("🚀 ~ localPartnerOrder ~ localPartnerOrder:");

    let itemAttributes = [
      "id",
      [
        literal(
          `(SELECT products.name FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`
        ),
        "product",
      ],
      "qty",
      "productName",
      "price",
      "discount",
      "partnerOrderId",
      "type",
      "productId",
      [
        literal(
          `(SELECT products.sku FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`
        ),
        "sku",
      ],

      [
        literal(
          `(SELECT products.sku FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`
        ),
        "productCode",
      ],
      [
        literal(
          `(SELECT products.grind FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`
        ),
        "grind",
      ],
      [
        literal(`
            (SELECT supplierSku
            FROM skuSuppliers
            WHERE skuSuppliers.productId = partnerOrderItems.productId
              AND skuSuppliers.supplierId = partnerOrder.supplierId
            LIMIT 1)
          `),
        "supplierSku",
      ],
    ];

    const doc = await partnerOrder.findOne({
      where: { id: orderId },
      attributes: [
        "id",
        [
          literal(
            `(SELECT countryCode FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`
          ),
          "countryCountry",
        ],
        [
          literal(
            `(SELECT phoneNumber FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`
          ),
          "phoneNumber",
        ],
        [
          literal(
            `(SELECT srName FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`
          ),
          "customerName",
        ],
        [
          literal(
            `(SELECT srName FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`
          ),
          "companyName",
        ],
        [
          literal(
            `(SELECT stripeCustomerId FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`
          ),
          "stripeCustomerId",
        ],
        [
          literal(
            `(SELECT  email FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`
          ),
          "email",
        ],
        [
          literal(
            `(SELECT email FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`
          ),
          "emailToSendInvoices",
        ],
        [
          literal(
            `(SELECT email FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`
          ),
          "dispatchEmail",
        ],
        [
          literal(
            `(SELECT statuses.orderStatus FROM statuses WHERE statuses.id = partnerOrder.statusId LIMIT 1)`
          ),
          "orderCurrentStatus",
        ],
        [
          literal(
            `(SELECT supplier.supplierName FROM supplier WHERE supplier.id = partnerOrder.supplierId LIMIT 1)`
          ),
          "supplierName",
        ],
        [
          literal(
            `(SELECT supplier.email FROM supplier WHERE supplier.id = partnerOrder.supplierId LIMIT 1)`
          ),
          "supplierEmail",
        ],
        [
          literal(`COALESCE(
              (SELECT SUM(qty)
                FROM items
                WHERE partnerOrderitems.partnerOrderId = partnerOrder.id ), 0)`),
          "totalQuantity",
        ],
        "totalBill",
        "subTotal",
        "discountPrice",
        "discountPercentage",
        "itemsPrice",
        "vat",
        "totalWeight",
        "note",
        "paymentMethod",
        "poNumber",
        "frequency",
        "statusId",
        "trackingNumber",
        "paymentStatus",
        "on",
        "salesRepId",
        "supplierId",
        "adminReceivableStatus",
        "adminReceivableAmount",
        "localPatnerCommission",
        "invoicePdf",
        "invoiceId",
        "createdAt",
        "paymentMethodId",
        "shippingCompany",
        "shippingCharges",
        "poNumber",
        "hostedInvoiceUrl",
        "invoiceNumber",
        "invoiceDate",
        "invoiceReminder",
        "invoicePaidDate",
      ],
      include: [
        {
          model: address,
          attributes: {
            exclude: [
              "createdAt",
              "updatedAt",
              "userId",
              "deleted",
              "deletedAt",
            ],
          },
        },
        {
          model: partnerOrderItem,
          attributes: itemAttributes,
        },
        {
          model: salesRep,
          include: {
            model: billingAddress,
            attributes: {
              exclude: [
                "createdAt",
                "updatedAt",
                "userId",
                "deleted",
                "deletedAt",
              ],
            },
          },
          attributes: {
            exclude: [
              "createdAt",
              "updatedAt",
              "deleted",
              "deletedAt",
              "password",
            ],
          },
        },
      ],
    });
    console.log("🚀 ~ localPartnerOrder ~ doc:", doc.id);
    return JSON.parse(JSON.stringify(doc));
  } catch (err) {
    console.error(err);
  }
};

exports.dataForEmailAndNotifications = async (
  orderId,
  orderType = "customer"
) => {
  const output =
    orderType == "customer"
      ? await customerOrder({ orderId: orderId })
      : await localPartnerOrder({ orderId: orderId });

  if (orderType == "local-partner") {
    output.user = output.salesRep;
    output.items = output.partnerOrderItems;
    output.partnerOrderItems = null;
    output.salesRep = null;
  }
  console.log(
    "ðŸš€ ~ exports.dataForEmailAndNotifications= ~ output:",
    output?.id
  );

  const or = [{ accountId: 1 }];

  if (output?.supplierId) {
    or.push({ supplierId: output.supplierId });
  } else if (output?.salesRepId) {
    or.push({ salesRepId: output.salesRepId });
  } else if (output?.userId) {
    or.push({ salesRepId: output.userId });
  }

  const tokenCondition = { [Op.or]: or };

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

  output.localPatnerCommission =
    orderType == "customer"
      ? await item.sum("salerCommission", {
          where: { orderId: output.id },
        })
      : 0;

  output.adminReceivableAmount =
    parseFloat(output?.totalBill || 0) -
    parseFloat(output.localPatnerCommission || 0);

  const admin = await account.findOne({
    attributes: { exclude: ["password", "status"] },
  });
  output.admin = admin;
  return {
    details: output,
    email: output?.email,
    adminTokens,
    userTokens,
    supplierTokens,
    salesRepTokens,
  };
};
