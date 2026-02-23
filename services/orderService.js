// services/orderService.js
const {
  order,
  partnerOrder,
  partnerOrderItem,
  user,
  address,
  item,
  sequelize,
  salesRep,
  account,
} = require("../models");
const { literal } = require("sequelize");

/**
 * Fetch full order details by ID for QuickBooks invoice creation
 */

async function getOrderWithAssociations({ orderId, orderType = "customer" }) {
  console.log("🚀 ~ getOrderWithAssociations ~ orderType:", orderType);

  //   const httpError = (res, status, msg) => ({ status, msg });
  try {
    const id = Number(orderId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Invalid or missing :orderId path parameter.");
    }

    const customerOrderQry = {
      where: { id },
      include: [
        {
          model: user,
          attributes: ["id", "qboCustomerId", "qboCustomerIdForPartner"],
        },
        {
          model: address,
        },
        {
          model: item,
          attributes: [
            "id",
            [
              literal(
                `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`,
              ),
              "product",
            ],
            [
              literal(
                `(SELECT products.weight FROM products WHERE products.id = items.productId LIMIT 1)`,
              ),
              "singleUnitWeight",
            ],
            ["weight", "itemWeights"],
            "qty",
            "productName",
            "price",
            "discount",
            "orderId",
            "productId",
            "wholesalePrice",
            "salerCommission",
            "type",
          ],
        },
      ],
      attributes: [
        "id",
        [
          literal(
            `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`,
          ),
          "name",
        ],
        [
          literal(
            `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`,
          ),
          "companyName",
        ],
        [
          literal(
            `(SELECT users.qboCustomerId FROM users WHERE users.id = order.userId LIMIT 1)`,
          ),
          "qboCustomerId",
        ],
        [
          literal(
            `(SELECT salesReps.srName FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`,
          ),
          "salesRepName",
        ],
        [
          literal(
            `(SELECT salesReps.territoryName FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`,
          ),
          "territoryName",
        ],
        [
          literal(
            `(SELECT salesReps.currentRealmId FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`,
          ),
          "partnerCurrentRealmId",
        ],
        [
          literal(
            `(SELECT salesReps.partnerType FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`,
          ),
          "partnerType",
        ],
        [
          literal(`COALESCE(
             (SELECT SUM(salerCommission)
              FROM items
              WHERE items.orderId = order.id ), 0)`),
          "localPatnerCommission",
        ],
        "quickBooksInvoiceIdPartner",
        "quickBooksPaymentIdPartner",
        "totalBill",
        "salesRepId",
        "userId",
        "vat",
        "shippingCharges",
        "invoiceNumber",
        "quickBooksInvoiceId",
        "paymentMethod",
        "paymentIntentId",
        "paymentStatus",
        "invoicePaidDate",
        "invoiceDate",
        "shippingCompany",
        "termDays",
        "note",
        "trackingNumber",
        "partnerRealmId",
        "adminRealmId",
        [
          literal(
            `(SELECT createdAt FROM orderHistories WHERE orderHistories.statusId = 4 AND orderHistories.orderId = order.id LIMIT 1)`,
          ),
          "shippingDate",
        ],
      ],
    };

    const partnerOrderQry = {
      where: { id },
      include: [
        {
          model: salesRep,
          attributes: ["id", "qboCustomerId"],
        },
        {
          model: address,
        },
        {
          model: partnerOrderItem,
          attributes: [
            "id",
            [
              literal(
                `(SELECT products.name FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`,
              ),
              "product",
            ],
            [
              literal(
                `(SELECT products.weight FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`,
              ),
              "singleUnitWeight",
            ],
            ["weight", "itemWeights"],
            "qty",
            "productName",
            "price",
            "discount",
            "productId",
            "type",
          ],
        },
      ],
      attributes: [
        "id",
        [
          literal(
            `(SELECT srName FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`,
          ),
          "companyName",
        ],
        [
          literal(
            `(SELECT qboCustomerId FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`,
          ),
          "qboCustomerId",
        ],
        "totalBill",
        "vat",
        "shippingCharges",
        "invoiceNumber",
        "quickBooksInvoiceId",
        "paymentMethod",
        "paymentIntentId",
        "paymentStatus",
        "invoicePaidDate",
        "invoiceDate",
        "shippingCompany",
        "termDays",
        "note",
        "trackingNumber",
        "salesRepId",
        "partnerRealmId",
        "adminRealmId",
        [
          literal(
            `(SELECT createdAt FROM orderHistories WHERE orderHistories.statusId = 4 AND orderHistories.partnerOrderId = partnerOrder.id LIMIT 1)`,
          ),
          "shippingDate",
        ],
      ],
    };

    // 🔹 Your provided query, fully intact
    const MODEL = orderType === "customer" ? order : partnerOrder;
    const qry = orderType === "customer" ? customerOrderQry : partnerOrderQry;
    const doc = await MODEL.findOne(qry);

    if (!doc) return null;

    // Normalize to plain JS object
    const orderData = JSON.parse(JSON.stringify(doc));
    console.log("🚀 ~ getOrderWithAssociations ~ orderData:", orderData);

    if (orderType === "local-partner") {
      orderData.user = orderData?.salesRep;
      delete orderData?.salesRep;
      orderData.items = orderData.partnerOrderItems;
      delete orderData?.partnerOrderItems;
      orderData.localPatnerOrder = true;
    } else {
      orderData.localPatnerOrder = false;
      orderData.directParnerClient = false;
    }

    return orderData;
  } catch (err) {
    console.error("[orderService] getOrderById failed:", err);
    throw err;
  }
}

/**
 * Fetch multiple orders details by IDs for QuickBooks bulk invoice creation
 */
async function getOrdersWithAssociations({ orderIds, orderType = "customer" }) {
  console.log("🚀 ~ getOrdersWithAssociations ~ orderType:", orderType);
  console.log("🚀 ~ getOrdersWithAssociations ~ orderIds:", orderIds);

  try {
    // Validate orderIds
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      throw new Error("orderIds must be a non-empty array");
    }

    // Convert to numbers and validate
    const validIds = orderIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (validIds.length === 0) {
      throw new Error("No valid order IDs provided");
    }

    const customerOrderQry = {
      where: { id: validIds },
      include: [
        {
          model: user,
          attributes: ["id", "qboCustomerId", "qboCustomerIdForPartner"],
        },
        {
          model: address,
        },
        {
          model: item,
          attributes: [
            "id",
            [
              literal(
                `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`,
              ),
              "product",
            ],
            [
              literal(
                `(SELECT products.weight FROM products WHERE products.id = items.productId LIMIT 1)`,
              ),
              "singleUnitWeight",
            ],
            ["weight", "itemWeights"],
            "qty",
            "productName",
            "price",
            "discount",
            "orderId",
            "productId",
            "wholesalePrice",
            "salerCommission",
            "type",
          ],
        },
      ],
      attributes: [
        "id",
        [
          literal(
            `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`,
          ),
          "name",
        ],
        [
          literal(
            `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`,
          ),
          "companyName",
        ],
        [
          literal(
            `(SELECT users.qboCustomerId FROM users WHERE users.id = order.userId LIMIT 1)`,
          ),
          "qboCustomerId",
        ],
        [
          literal(
            `(SELECT salesReps.srName FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`,
          ),
          "salesRepName",
        ],
        [
          literal(
            `(SELECT salesReps.territoryName FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`,
          ),
          "territoryName",
        ],
        [
          literal(
            `(SELECT salesReps.currentRealmId FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`,
          ),
          "partnerCurrentRealmId",
        ],
        [
          literal(
            `(SELECT salesReps.partnerType FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`,
          ),
          "partnerType",
        ],
        [
          literal(`COALESCE(
             (SELECT SUM(salerCommission)
              FROM items
              WHERE items.orderId = order.id ), 0)`),
          "localPatnerCommission",
        ],
        "quickBooksInvoiceIdPartner",
        "quickBooksPaymentIdPartner",
        "totalBill",
        "salesRepId",
        "userId",
        "vat",
        "shippingCharges",
        "invoiceNumber",
        "quickBooksInvoiceId",
        "paymentMethod",
        "paymentIntentId",
        "paymentStatus",
        "invoicePaidDate",
        "invoiceDate",
        "shippingCompany",
        "termDays",
        "note",
        "trackingNumber",
        "partnerRealmId",
        "adminRealmId",
        [
          literal(
            `(SELECT createdAt FROM orderHistories WHERE orderHistories.statusId = 4 AND orderHistories.orderId = order.id LIMIT 1)`,
          ),
          "shippingDate",
        ],
      ],
    };

    const partnerOrderQry = {
      where: { id: validIds },
      include: [
        {
          model: salesRep,
          attributes: ["id", "qboCustomerId"],
        },
        {
          model: address,
        },
        {
          model: partnerOrderItem,
          attributes: [
            "id",
            [
              literal(
                `(SELECT products.name FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`,
              ),
              "product",
            ],
            [
              literal(
                `(SELECT products.weight FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`,
              ),
              "singleUnitWeight",
            ],
            ["weight", "itemWeights"],
            "qty",
            "productName",
            "price",
            "discount",
            "productId",
            "type",
          ],
        },
      ],
      attributes: [
        "id",
        [
          literal(
            `(SELECT srName FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`,
          ),
          "companyName",
        ],
        [
          literal(
            `(SELECT qboCustomerId FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`,
          ),
          "qboCustomerId",
        ],
        "totalBill",
        "vat",
        "shippingCharges",
        "invoiceNumber",
        "quickBooksInvoiceId",
        "paymentMethod",
        "paymentIntentId",
        "paymentStatus",
        "invoicePaidDate",
        "invoiceDate",
        "shippingCompany",
        "termDays",
        "note",
        "trackingNumber",
        "salesRepId",
        "partnerRealmId",
        "adminRealmId",
        [
          literal(
            `(SELECT createdAt FROM orderHistories WHERE orderHistories.statusId = 4 AND orderHistories.partnerOrderId = partnerOrder.id LIMIT 1)`,
          ),
          "shippingDate",
        ],
      ],
    };

    const MODEL = orderType === "customer" ? order : partnerOrder;
    const qry = orderType === "customer" ? customerOrderQry : partnerOrderQry;
    const docs = await MODEL.findAll(qry);

    if (!docs || docs.length === 0) return [];

    // Normalize each order
    const orders = docs.map((doc) => {
      const orderData = JSON.parse(JSON.stringify(doc));

      if (orderType === "local-partner") {
        orderData.user = orderData?.salesRep;
        delete orderData?.salesRep;
        orderData.items = orderData.partnerOrderItems;
        delete orderData?.partnerOrderItems;
        orderData.localPatnerOrder = true;
      } else {
        orderData.localPatnerOrder = false;
        orderData.directParnerClient = false;
      }

      return orderData;
    });

    console.log(
      `🚀 ~ getOrdersWithAssociations ~ fetched ${orders.length} orders`,
    );
    return orders;
  } catch (err) {
    console.error("[orderService] getOrdersWithAssociations failed:", err);
    throw err;
  }
}

module.exports = { getOrderWithAssociations, getOrdersWithAssociations };
