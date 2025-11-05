// services/orderService.js
const { order, user, address, item, sequelize } = require("../models");
const { literal } = require("sequelize");

/**
 * Fetch full order details by ID for QuickBooks invoice creation
 */
async function getOrderWithAssociations({ orderId }) {
  const httpError = (res, status, msg) => ({ status, msg });

  try {
    const id = Number(orderId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Invalid or missing :orderId path parameter.");
    }

    // 🔹 Your provided query, fully intact
    const doc = await order.findOne({
      where: { id },
      include: [
        {
          model: user,
          attributes: ["id", "qboCustomerId"],
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
            `(SELECT createdAt FROM orderHistories WHERE orderHistories.statusId = 4 AND orderHistories.orderId = order.id LIMIT 1)`
          ),
          "shippingDate",
        ],
      ],
    });

    if (!doc) return null;

    // Normalize to plain JS object
    const orderData = JSON.parse(JSON.stringify(doc));
    console.log("🚀 ~ getOrderWithAssociations ~ orderData:", orderData);

    return orderData;
  } catch (err) {
    console.error("[orderService] getOrderById failed:", err);
    throw err;
  }
}

module.exports = { getOrderWithAssociations };
