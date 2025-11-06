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
} = require("../models");
const { literal } = require("sequelize");

/**
 * Fetch full order details by ID for QuickBooks invoice creation
 */

async function getOrderWithAssociations({ orderId, orderType = "customer" }) {
  console.log("🚀 ~ getOrderWithAssociations ~ orderType:", orderType);
  console.log("🚀 ~ getOrderWithAssociations ~ orderType:", orderType);
  console.log("🚀 ~ getOrderWithAssociations ~ orderType:", orderType);
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
                `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`
              ),
              "product",
            ],
            [
              literal(
                `(SELECT products.weight FROM products WHERE products.id = items.productId LIMIT 1)`
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
            "type",
          ],
        },
      ],
      attributes: [
        "id",
        [
          literal(
            `(SELECT users.name FROM users WHERE users.id = order.userId LIMIT 1)`
          ),
          "name",
        ],
        [
          literal(
            `(SELECT users.companyName FROM users WHERE users.id = order.userId LIMIT 1)`
          ),
          "companyName",
        ],
        [
          literal(
            `(SELECT users.qboCustomerId FROM users WHERE users.id = order.userId LIMIT 1)`
          ),
          "qboCustomerId",
        ],
        [
          literal(
            `(SELECT salesReps.srName FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`
          ),
          "salesRepName",
        ],
        [
          literal(
            `(SELECT salesReps.partnerType FROM salesReps WHERE order.salesRepId = salesReps.id LIMIT 1)`
          ),
          "partnerType",
        ],
        "totalBill",
        "salesRepId",
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
        [
          literal(
            `(SELECT createdAt FROM orderHistories WHERE orderHistories.statusId = 4 AND orderHistories.orderId = order.id LIMIT 1)`
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
                `(SELECT products.name FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`
              ),
              "product",
            ],
            [
              literal(
                `(SELECT products.weight FROM products WHERE products.id = partnerOrderItems.productId LIMIT 1)`
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
            `(SELECT srName FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`
          ),
          "companyName",
        ],
        [
          literal(
            `(SELECT qboCustomerId FROM salesReps WHERE salesReps.id = partnerOrder.salesRepId LIMIT 1)`
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
        [
          literal(
            `(SELECT createdAt FROM orderHistories WHERE orderHistories.statusId = 4 AND orderHistories.partnerOrderId = partnerOrder.id LIMIT 1)`
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
      if (orderData.salesRepId && orderData.patnerType === "direct-partner") {
        orderData.qboCustomerId =
          orderData.user?.qboCustomerIdForPartner || null;
        orderData.user.qboCustomerId =
          orderData.user?.qboCustomerIdForPartner || null;
        orderData.directParnerClient = true;
      }
    }

    return orderData;
  } catch (err) {
    console.error("[orderService] getOrderById failed:", err);
    throw err;
  }
}

module.exports = { getOrderWithAssociations };
