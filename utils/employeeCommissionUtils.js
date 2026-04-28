const { order, user, employee } = require("../models");
const { Op } = require("sequelize");
const Stripe = require("../controllers/stripe");
const { STRIPE_SECRET_KEY } = process.env;
const stripe = require("stripe")(STRIPE_SECRET_KEY);

/**
 * Calculate and save employee commission data for an order (offline/manual payments)
 * Also attempts to transfer the commission. If transfer succeeds, saves transfer ID.
 * If transfer fails, commission data is still saved and can be transferred later.
 * Uses order subTotal directly (excluding shipping charges, no Stripe fee calculation for offline payments)
 *
 * @param {Object} params - Parameters object
 * @param {number} params.orderId - The ID of the order
 * @returns {Promise<Object|false>} - Object containing commission and transfer details on success, false on error
 */

async function calculateAndSaveEmployeeCommission({
  orderId,
  employeeOf = "admin",
}) {
  try {
    // Step 1: Fetch order with user and employee associations
    const orderData = await order.findOne({
      where: { id: orderId },
      include: [
        {
          model: user,
          attributes: ["id", "employeeId", "salesRepId"],
          include: [
            {
              model: employee,
              attributes: [
                "id",
                "commissionPercentage",
                "stripeConnectAccountId",
                "employeeOf",
              ],
              required: false,
            },
          ],
        },
      ],
      attributes: [
        "id",
        "subTotal",
        "paymentIntentId",
        "invoiceNumber",
        "employeeId",
        "salesRepId",
        "AppliedEmployeeCommisionPercentage",
        "employeeCommisionAmount",
        "employeeTransferId",
      ],
    });

    if (!orderData) {
      console.error(`❌ Order with ID ${orderId} not found`);
      return false;
    }

    const orderPlaced = JSON.parse(JSON.stringify(orderData));
    const customer = orderPlaced?.user;

    // Step 2: Check if commission already transferred
    if (orderPlaced?.employeeTransferId) {
      console.log(
        `ℹ️ Order ${orderId} already has a transfer ID (${orderPlaced.employeeTransferId}). Commission already transferred. Skipping.`,
      );
      return false;
    }

    // Step 3: Check conditions for employee commission
    const hasNoLocalPartner = !customer?.salesRepId && !orderPlaced?.salesRepId;
    const hasEmployee =
      customer?.employee !== null && customer?.employee !== undefined;

    if (!hasNoLocalPartner) {
      console.error(
        "❌ Order has a local partner (salesRepId). Employee commission only applies to admin customers.",
      );
      return false;
    }

    if (!hasEmployee) {
      console.error("❌ Order customer does not have an associated employee.");
      return false;
    }

    const emp = customer.employee;
    const commissionPercentage = parseFloat(emp.commissionPercentage) || 0;

    if (commissionPercentage <= 0) {
      console.error(
        `❌ Employee has no commission percentage set (${commissionPercentage}%)`,
      );
      return false;
    }

    // Step 4: Get order subtotal (excluding shipping charges)
    const orderSubTotal = parseFloat(orderPlaced?.subTotal) || 0;

    if (orderSubTotal <= 0) {
      console.error(
        `❌ Order subtotal is invalid or zero (${orderSubTotal}). Cannot calculate commission.`,
      );
      return false;
    }

    // Step 5: Calculate commission based on order subtotal
    // Commission is calculated on subtotal (excluding shipping charges which are admin-only)
    const employeeCommissionAmount =
      (orderSubTotal * commissionPercentage) / 100;

    console.log("🚀 ~ calculateAndSaveEmployeeCommission ~ Calculation:");
    console.log("  Order ID:", orderId);
    console.log("  Employee ID:", emp.id);
    console.log("  Order SubTotal:", orderSubTotal);
    console.log("  Commission %:", commissionPercentage);
    console.log("  Employee Commission:", employeeCommissionAmount);

    // Step 6: Update order with commission data
    await order.update(
      {
        employeeId: emp.id,
        employeeOf: employeeOf,
        AppliedEmployeeCommisionPercentage: commissionPercentage,
        employeeCommisionAmount: employeeCommissionAmount,
        // Note: employeeTransferId will be updated if transfer succeeds
      },
      { where: { id: orderId } },
    );

    console.log("✅ Commission data saved to DB");

    // Step 7: Attempt to transfer commission using already-fetched data
    console.log("🚀 Attempting to transfer commission...");

    // Prepare order data with updated commission values
    const orderDataForTransfer = {
      ...orderPlaced,
      employeeId: emp.id,
      employeeCommisionAmount: employeeCommissionAmount,
      employeeTransferId: null, // Will be updated after transfer
    };

    const transferResult = await transferEmployeeCommissionWithData({
      orderData: orderDataForTransfer,
      employeeData: emp,
      commissionAmount: employeeCommissionAmount,
    });

    if (transferResult && transferResult.success && transferResult.transferId) {
      // Transfer succeeded - transferEmployeeCommission already updated the order with transfer ID
      console.log("✅ Transfer completed and transfer ID saved to DB");
      console.log("  Transfer ID:", transferResult.transferId);

      return {
        success: true,
        orderId: orderId,
        employeeId: emp.id,
        employeeOf: employeeOf,
        commissionPercentage: commissionPercentage,
        employeeCommissionAmount: employeeCommissionAmount,
        orderSubTotal: orderSubTotal,
        transferId: transferResult.transferId,
        transferCompleted: true,
        message: "Commission calculated, saved, and transferred successfully",
      };
    } else {
      // Transfer failed - commission data is already saved, just log the error
      console.error(
        `⚠️ Commission saved but transfer failed for order ${orderId}. Transfer can be retried later.`,
      );

      return {
        success: true,
        orderId: orderId,
        employeeId: emp.id,
        employeeOf: employeeOf,
        commissionPercentage: commissionPercentage,
        employeeCommissionAmount: employeeCommissionAmount,
        orderSubTotal: orderSubTotal,
        transferCompleted: false,
        message:
          "Commission calculated and saved, but transfer failed. You can retry transfer later.",
      };
    }
  } catch (error) {
    console.error(
      "❌ Error in calculateAndSaveEmployeeCommission:",
      error.message,
    );
    return false;
  }
}

/**
 * Transfer employee commission using already-fetched order data
 * This is an optimized version that avoids re-fetching the order from the database
 *
 * @param {Object} params - Parameters object
 * @param {Object} params.orderData - The order data object (already fetched from DB)
 * @param {Object} params.employeeData - The employee data object (with stripeConnectAccountId)
 * @param {number} params.commissionAmount - The commission amount to transfer
 * @returns {Promise<Object|false>} - Object containing transfer details on success, false on error
 */
async function transferEmployeeCommissionWithData({
  orderData,
  employeeData,
  commissionAmount,
}) {
  try {
    const orderPlaced = JSON.parse(JSON.stringify(orderData));
    const orderId = orderPlaced.id;

    // Step 1: Check if transfer already completed
    if (orderPlaced?.employeeTransferId) {
      console.error(
        `❌ Order ${orderId} already has a transfer ID (${orderPlaced.employeeTransferId}). Transfer already completed.`,
      );
      return false;
    }

    // Step 2: Validate employee has Stripe Connect account
    if (!employeeData?.stripeConnectAccountId) {
      console.error(
        `❌ Employee ${employeeData?.id} does not have a Stripe Connect account ID. Cannot transfer.`,
      );
      return false;
    }

    console.log("🚀 ~ transferEmployeeCommissionWithData ~ Transfer Details:");
    console.log("  Order ID:", orderId);
    console.log("  Employee ID:", employeeData.id);
    console.log("  Commission Amount:", commissionAmount);
    console.log(
      "  Stripe Connect Account:",
      employeeData.stripeConnectAccountId,
    );

    // Step 3: Perform transfer based on payment type
    let transferResult;

    if (orderPlaced?.paymentIntentId) {
      // Online payment - use existing transferToEmployee function
      console.log("  Payment Type: Online (has paymentIntentId)");

      transferResult = await Stripe.transferToEmployee({
        amount: commissionAmount,
        employeeAccountId: employeeData.stripeConnectAccountId,
        orderId: orderId,
        invoiceId: null,
        paymentIntentId: orderPlaced.paymentIntentId,
        invoiceNumber: orderPlaced?.invoiceNumber || "",
      });
    } else {
      // Offline payment - create direct transfer
      console.log("  Payment Type: Offline (no paymentIntentId)");

      const commissionAmountCents = Math.round(commissionAmount * 100);
      const description = `Payment from Order #${orderId} - Employee Commission: $${commissionAmount.toFixed(2)}`;

      const transfer = await stripe.transfers.create({
        amount: commissionAmountCents,
        currency: "usd",
        destination: employeeData.stripeConnectAccountId,
        description,
      });

      transferResult = {
        transfer,
        netEmployeeAmount: commissionAmount,
        proportionalStripeFee: 0,
        grossEmployeeAmount: commissionAmount,
      };
    }

    // Step 4: Update order with transfer ID
    if (transferResult?.transfer?.id) {
      await order.update(
        {
          employeeTransferId: transferResult.transfer.id,
        },
        { where: { id: orderId } },
      );

      console.log("✅ Transfer completed successfully");
      console.log("  Transfer ID:", transferResult.transfer.id);

      return {
        success: true,
        orderId: orderId,
        employeeId: employeeData.id,
        transferId: transferResult.transfer.id,
        commissionAmount: commissionAmount,
        message: "Employee commission transferred successfully",
      };
    } else {
      console.error("❌ Transfer completed but no transfer ID returned");
      return false;
    }
  } catch (error) {
    console.error(
      "❌ Error in transferEmployeeCommissionWithData:",
      error.message,
    );
    return false;
  }
}

/**
 * Manually transfer employee commission for an order
 * This function performs the actual Stripe transfer to the employee's Connect account
 * Should be called after commission is calculated and saved
 *
 * @param {Object} params - Parameters object
 * @param {number} params.orderId - The ID of the order
 * @returns {Promise<Object|false>} - Object containing transfer details on success, false on error
 */
async function transferEmployeeCommission({ orderId, employeeOf = "admin" }) {
  try {
    // Step 1: Fetch order with employee (commission already calculated)
    const employeeOfCondition =
      employeeOf === "admin"
        ? { [Op.or]: ["admin", null] } // backward compatibility for legacy rows
        : employeeOf;

    const orderData = await order.findOne({
      where: { id: orderId, employeeOf: employeeOfCondition },
      include: [
        {
          model: employee,
          attributes: ["id", "stripeConnectAccountId"],
          required: false,
        },
      ],
      attributes: [
        "id",
        "paymentIntentId",
        "invoiceNumber",
        "salesRepId",
        "employeeId",
        "employeeCommisionAmount",
        "employeeTransferId",
      ],
    });

    if (!orderData) {
      console.error(`❌ Order with ID ${orderId} not found`);
      return false;
    }

    const orderPlaced = JSON.parse(JSON.stringify(orderData));

    // Step 2: Check if transfer already completed
    if (orderPlaced?.employeeTransferId) {
      console.error(
        `❌ Order ${orderId} already has a transfer ID (${orderPlaced.employeeTransferId}). Transfer already completed.`,
      );
      return false;
    }

    // Explicit guard: employee commission transfer is only for admin/customer orders.
    if (orderPlaced?.salesRepId) {
      console.error(
        `❌ Order ${orderId} is linked to a partner (salesRepId: ${orderPlaced.salesRepId}). Skipping employee transfer.`,
      );
      return false;
    }

    // Step 3: Validate commission data exists (should be calculated already)
    if (!orderPlaced?.employeeId) {
      console.error(
        `❌ Order ${orderId} does not have employee commission data. Please calculate commission first.`,
      );
      return false;
    }

    if (
      !orderPlaced?.employeeCommisionAmount ||
      orderPlaced.employeeCommisionAmount <= 0
    ) {
      console.error(
        `❌ Order ${orderId} has invalid commission amount (${orderPlaced.employeeCommisionAmount})`,
      );
      return false;
    }

    const emp = orderPlaced.employee;

    if (!emp) {
      console.error(`❌ Employee ${orderPlaced.employeeId} not found`);
      return false;
    }

    if (!emp.stripeConnectAccountId) {
      console.error(
        `❌ Employee ${emp.id} does not have a Stripe Connect account ID. Cannot transfer.`,
      );
      return false;
    }

    const commissionAmount =
      parseFloat(orderPlaced.employeeCommisionAmount) || 0;

    console.log("🚀 ~ transferEmployeeCommission ~ Transfer Details:");
    console.log("  Order ID:", orderId);
    console.log("  Employee ID:", emp.id);
    console.log("  Commission Amount:", commissionAmount);
    console.log("  Stripe Connect Account:", emp.stripeConnectAccountId);

    // Step 4: Perform transfer based on payment type
    let transferResult;

    if (orderPlaced?.paymentIntentId) {
      // Online payment - use existing transferToEmployee function
      console.log("  Payment Type: Online (has paymentIntentId)");

      transferResult = await Stripe.transferToEmployee({
        amount: commissionAmount,
        employeeAccountId: emp.stripeConnectAccountId,
        orderId: orderId,
        invoiceId: null,
        paymentIntentId: orderPlaced.paymentIntentId,
        invoiceNumber: orderPlaced?.invoiceNumber || "",
      });
    } else {
      // Offline payment - create direct transfer
      console.log("  Payment Type: Offline (no paymentIntentId)");

      const commissionAmountCents = Math.round(commissionAmount * 100);
      const description = `Payment from Order #${orderId} - Employee Commission: $${commissionAmount.toFixed(2)}`;

      const transfer = await stripe.transfers.create({
        amount: commissionAmountCents,
        currency: "usd",
        destination: emp.stripeConnectAccountId,
        description,
      });

      transferResult = {
        transfer,
        netEmployeeAmount: commissionAmount,
        proportionalStripeFee: 0,
        grossEmployeeAmount: commissionAmount,
      };
    }

    // Step 5: Update order with transfer ID
    if (transferResult?.transfer?.id) {
      await order.update(
        {
          employeeTransferId: transferResult.transfer.id,
        },
        { where: { id: orderId } },
      );

      console.log("✅ Transfer completed successfully");
      console.log("  Transfer ID:", transferResult.transfer.id);

      return {
        success: true,
        orderId: orderId,
        employeeId: emp.id,
        transferId: transferResult.transfer.id,
        commissionAmount: commissionAmount,
        message: "Employee commission transferred successfully",
      };
    } else {
      console.error("❌ Transfer completed but no transfer ID returned");
      return false;
    }
  } catch (error) {
    console.error("❌ Error in transferEmployeeCommission:", error.message);
    return false;
  }
}

/**
 * Calculate and transfer employee commission in one function
 * This function calculates commission and immediately transfers it
 *
 * @param {Object} params - Parameters object
 * @param {number} params.orderId - The ID of the order
 * @returns {Promise<Object|false>} - Object containing commission and transfer details on success, false on error
 */
async function calculateAndTransferEmployeeCommission({
  orderId,
  employeeOf = "admin",
}) {
  try {
    // Step 1: Calculate and save commission
    const commissionResult = await calculateAndSaveEmployeeCommission({
      orderId,
      employeeOf,
    });

    if (!commissionResult) {
      console.error(
        `❌ Failed to calculate commission for order ${orderId}. Cannot proceed with transfer.`,
      );
      return false;
    }

    console.log("✅ Commission calculated, proceeding with transfer...");

    // Step 2: Transfer commission
    const transferResult = await transferEmployeeCommission({ orderId });

    if (!transferResult) {
      console.error(
        `❌ Commission calculated but transfer failed for order ${orderId}`,
      );
      // Commission is already saved, so we return partial success
      return {
        success: false,
        orderId: orderId,
        commissionCalculated: true,
        commissionAmount: commissionResult.employeeCommissionAmount,
        transferCompleted: false,
        message:
          "Commission calculated and saved, but transfer failed. You can retry transfer later.",
      };
    }

    // Step 3: Return combined result
    return {
      success: true,
      orderId: orderId,
      employeeId: commissionResult.employeeId,
      commissionPercentage: commissionResult.commissionPercentage,
      commissionAmount: commissionResult.employeeCommissionAmount,
      orderSubTotal: commissionResult.orderSubTotal,
      transferId: transferResult.transferId,
      message: "Commission calculated and transferred successfully",
    };
  } catch (error) {
    console.error(
      "❌ Error in calculateAndTransferEmployeeCommission:",
      error.message,
    );
    return false;
  }
}

/**
 * Bulk transfer employee commission - sums all commission amounts and transfers once per employee
 * Gets orders with employeeId and commission amount, groups by employee, transfers total sum,
 * then saves the transfer ID to all those orders
 *
 * @param {Object} params - Parameters object
 * @param {Array<number>} params.orderIds - Array of order IDs that have employee commission data
 * @returns {Promise<Object|false>} - Object containing transfer results grouped by employee
 */
async function bulkTransferEmployeeCommission({
  orderIds,
  employeeOf = "admin",
}) {
  try {
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      console.error("❌ orderIds is required and must be a non-empty array");
      return false;
    }

    console.log(
      `🚀 ~ bulkTransferEmployeeCommission ~ Processing ${orderIds.length} orders`,
    );
    const normalizedOrderIds = orderIds.map((id) => Number(id));

    const employeeOfCondition =
      employeeOf === "admin"
        ? { [Op.or]: ["admin", null] } // backward compatibility for legacy rows
        : employeeOf;

    // Step 1: Fetch all orders with employee commission data
    const orders = await order.findAll({
      where: {
        id: { [Op.in]: orderIds },
        employeeOf: employeeOfCondition,
        employeeId: { [Op.ne]: null },
        employeeCommisionAmount: { [Op.gt]: 0 },
        employeeTransferId: { [Op.is]: null }, // Only orders that haven't been transferred
      },
      include: [
        {
          model: employee,
          attributes: ["id", "stripeConnectAccountId"],
          required: true,
        },
      ],
      attributes: [
        "id",
        "employeeId",
        "salesRepId",
        "employeeCommisionAmount",
        "paymentIntentId",
        "invoiceNumber",
      ],
    });

    if (orders.length === 0) {
      console.error(
        "❌ No orders found with employee commission data or all orders already transferred",
      );
      return false;
    }

    console.log(
      `✅ Found ${orders.length} orders with pending employee commission`,
    );

    // Step 2: Group orders by employeeId
    const ordersByEmployee = {};
    const ordersData = JSON.parse(JSON.stringify(orders));

    // Explicit guard: never include partner orders in admin employee commission transfer.
    const eligibleOrders = ordersData.filter((o) => !o?.salesRepId);

    if (eligibleOrders.length === 0) {
      console.error(
        "❌ No eligible admin/customer orders found for employee commission transfer",
      );
      return false;
    }

    eligibleOrders.forEach((orderData) => {
      const empId = orderData.employeeId;
      if (!ordersByEmployee[empId]) {
        ordersByEmployee[empId] = {
          employeeId: empId,
          employee: orderData.employee,
          orders: [],
          totalCommission: 0,
        };
      }
      ordersByEmployee[empId].orders.push(orderData);
      ordersByEmployee[empId].totalCommission +=
        parseFloat(orderData.employeeCommisionAmount) || 0;
    });

    console.log(
      `✅ Grouped into ${Object.keys(ordersByEmployee).length} employee(s)`,
    );

    // Step 3: Transfer for each employee and update all their orders
    const results = [];
    const successful = [];
    const failed = [];
    const errors = [];
    const failedOrders = [];

    const addFailedOrders = ({
      orderIds: sourceOrderIds,
      message,
      employeeId = null,
    }) => {
      sourceOrderIds.forEach((id) => {
        failedOrders.push({
          orderId: Number(id),
          employeeId,
          message,
        });
      });
    };

    const fetchedOrderIds = new Set(ordersData.map((o) => Number(o.id)));
    const notEligibleOrderIds = normalizedOrderIds.filter(
      (id) => !fetchedOrderIds.has(id),
    );
    if (notEligibleOrderIds.length) {
      const message =
        "Order is not eligible for bulk transfer (missing commission, already transferred, invalid employee, or outside scope)";
      addFailedOrders({ orderIds: notEligibleOrderIds, message });
      errors.push({
        employeeId: null,
        message,
        orderIds: notEligibleOrderIds,
      });
    }

    const partnerScopedOrderIds = ordersData
      .filter((o) => o?.salesRepId)
      .map((o) => Number(o.id));
    if (partnerScopedOrderIds.length) {
      const message =
        "Partner scoped orders are excluded from admin employee bulk transfer";
      addFailedOrders({ orderIds: partnerScopedOrderIds, message });
      errors.push({
        employeeId: null,
        message,
        orderIds: partnerScopedOrderIds,
      });
    }

    for (const empId in ordersByEmployee) {
      const empData = ordersByEmployee[empId];
      const emp = empData.employee;

      if (!emp.stripeConnectAccountId) {
        console.error(
          `❌ Employee ${empId} does not have a Stripe Connect account ID`,
        );
        const failedRecord = {
          employeeId: empId,
          orderIds: empData.orders.map((o) => o.id),
          totalCommission: empData.totalCommission,
          message: "Employee does not have Stripe Connect account",
        };
        failed.push(failedRecord);
        results.push({
          employeeId: empId,
          status: "failed",
          ...failedRecord,
        });
        addFailedOrders({
          orderIds: failedRecord.orderIds,
          employeeId: Number(empId),
          message: failedRecord.message,
        });
        errors.push({
          employeeId: empId,
          message: failedRecord.message,
          orderIds: failedRecord.orderIds,
        });
        continue;
      }

      console.log(
        `🚀 ~ Transferring ${empData.totalCommission} for employee ${empId} (${empData.orders.length} orders)`,
      );

      try {
        // Check if all orders have paymentIntentId (online) or not (offline)
        const hasPaymentIntent = empData.orders.some((o) => o.paymentIntentId);
        const firstOrder = empData.orders[0];

        let transferResult;

        if (hasPaymentIntent && firstOrder.paymentIntentId) {
          // Online payment - use existing transferToEmployee function
          console.log(
            `  Payment Type: Online (using paymentIntentId from first order)`,
          );

          transferResult = await Stripe.transferToEmployee({
            amount: empData.totalCommission,
            employeeAccountId: emp.stripeConnectAccountId,
            orderId: firstOrder.id, // Use first order ID for reference
            invoiceId: null,
            paymentIntentId: firstOrder.paymentIntentId,
            invoiceNumber: firstOrder.invoiceNumber || "",
          });
        } else {
          // Offline payment - create direct transfer
          console.log(`  Payment Type: Offline (no paymentIntentId)`);

          const totalCommissionCents = Math.round(
            empData.totalCommission * 100,
          );
          const description = `Bulk transfer for ${empData.orders.length} orders - Employee Commission: $${empData.totalCommission.toFixed(2)}`;

          const transfer = await stripe.transfers.create({
            amount: totalCommissionCents,
            currency: "usd",
            destination: emp.stripeConnectAccountId,
            description,
          });

          transferResult = {
            transfer,
            netEmployeeAmount: empData.totalCommission,
            proportionalStripeFee: 0,
            grossEmployeeAmount: empData.totalCommission,
          };
        }

        // Step 4: Update all orders with the transfer ID
        if (transferResult?.transfer?.id) {
          const transferId = transferResult.transfer.id;
          const orderIdsToUpdate = empData.orders.map((o) => o.id);

          await order.update(
            {
              employeeTransferId: transferId,
            },
            {
              where: {
                id: { [Op.in]: orderIdsToUpdate },
              },
            },
          );

          console.log(
            `✅ Transfer completed for employee ${empId}: ${transferId} (updated ${orderIdsToUpdate.length} orders)`,
          );

          successful.push({
            employeeId: empId,
            transferId: transferId,
            totalCommission: empData.totalCommission,
            orderIds: orderIdsToUpdate,
            orderCount: orderIdsToUpdate.length,
            message: "Bulk transfer completed successfully",
          });

          results.push({
            employeeId: empId,
            status: "success",
            transferId: transferId,
            totalCommission: empData.totalCommission,
            orderIds: orderIdsToUpdate,
            orderCount: orderIdsToUpdate.length,
          });
        } else {
          throw new Error("Transfer completed but no transfer ID returned");
        }
      } catch (error) {
        console.error(
          `❌ Error transferring commission for employee ${empId}:`,
          error.message,
        );
        const failedRecord = {
          employeeId: empId,
          orderIds: empData.orders.map((o) => o.id),
          totalCommission: empData.totalCommission,
          message: error.message || "Transfer failed",
        };
        failed.push(failedRecord);
        results.push({
          employeeId: empId,
          status: "failed",
          ...failedRecord,
        });
        addFailedOrders({
          orderIds: failedRecord.orderIds,
          employeeId: Number(empId),
          message: failedRecord.message,
        });
        errors.push({
          employeeId: empId,
          message: failedRecord.message,
          orderIds: failedRecord.orderIds,
        });
      }
    }

    console.log(
      `✅ Bulk transfer summary: ${successful.length} employees successful, ${failed.length} employees failed`,
    );

    return {
      success: true,
      totalOrders: orders.length,
      totalEmployees: Object.keys(ordersByEmployee).length,
      successful: successful.length,
      failed: failed.length,
      results: results,
      errors,
      failedOrders,
      summary: {
        successful: successful,
        failed: failed,
      },
    };
  } catch (error) {
    console.error("❌ Error in bulkTransferEmployeeCommission:", error.message);
    return false;
  }
}

/**
 * Calculate and transfer employee commission using already-fetched order data
 * This is optimized for webhooks that already have the order data
 *
 * @param {Object} params - Parameters object
 * @param {Object} params.orderData - The order data object (already fetched from DB with user and employee)
 * @param {string} params.invoiceId - Optional invoice ID for transfer
 * @param {string} params.paymentIntentId - Payment intent ID for transfer
 * @returns {Promise<Object|false>} - Object containing commission and transfer details on success, false on error
 */
async function calculateAndTransferEmployeeCommissionWithData({
  orderData,
  invoiceId = null,
  paymentIntentId = null,
  employeeOf = "admin",
}) {
  try {
    const orderPlaced = JSON.parse(JSON.stringify(orderData));
    const orderId = orderPlaced.id;

    // Step 1: Check if commission already transferred
    if (orderPlaced?.employeeTransferId) {
      console.log(
        `ℹ️ Order ${orderId} already has a transfer ID (${orderPlaced.employeeTransferId}). Commission already transferred. Skipping.`,
      );
      return false;
    }

    // Step 2: Check conditions for employee commission
    const customer = orderPlaced?.user;
    const hasNoLocalPartner = !customer?.salesRepId && !orderPlaced?.salesRepId;
    const hasEmployee =
      customer?.employee !== null && customer?.employee !== undefined;

    if (!hasNoLocalPartner) {
      console.error(
        "❌ Order has a local partner (salesRepId). Employee commission only applies to admin customers.",
      );
      return false;
    }

    if (!hasEmployee) {
      console.error("❌ Order customer does not have an associated employee.");
      return false;
    }

    const emp = customer.employee;
    const commissionPercentage = parseFloat(emp.commissionPercentage) || 0;

    if (commissionPercentage <= 0) {
      console.error(
        `❌ Employee has no commission percentage set (${commissionPercentage}%)`,
      );
      return false;
    }

    if (!emp.stripeConnectAccountId) {
      console.error(
        `❌ Employee ${emp.id} does not have a Stripe Connect account ID. Cannot transfer.`,
      );
      return false;
    }

    // Step 3: Get order subtotal (excluding shipping charges)
    const orderSubTotal = parseFloat(orderPlaced?.subTotal) || 0;

    if (orderSubTotal <= 0) {
      console.error(
        `❌ Order subtotal is invalid or zero (${orderSubTotal}). Cannot calculate commission.`,
      );
      return false;
    }

    // Step 4: Calculate commission based on order subtotal
    const employeeCommissionAmount =
      (orderSubTotal * commissionPercentage) / 100;

    console.log(
      "🚀 ~ calculateAndTransferEmployeeCommissionWithData ~ Calculation:",
    );
    console.log("  Order ID:", orderId);
    console.log("  Employee ID:", emp.id);
    console.log("  Order SubTotal:", orderSubTotal);
    console.log("  Commission %:", commissionPercentage);
    console.log("  Employee Commission:", employeeCommissionAmount);

    // Step 5: Save commission data to DB FIRST (before transfer)
    await order.update(
      {
        employeeId: emp.id,
        employeeOf: employeeOf,
        AppliedEmployeeCommisionPercentage: commissionPercentage,
        employeeCommisionAmount: employeeCommissionAmount,
        // employeeTransferId will remain NULL until transfer succeeds
      },
      { where: { id: orderId } },
    );

    console.log("✅ Commission data saved to DB");

    // Step 6: Transfer to employee
    const transfer = await Stripe.transferToEmployee({
      amount: employeeCommissionAmount,
      employeeAccountId: emp.stripeConnectAccountId,
      orderId: orderId,
      invoiceId: invoiceId,
      paymentIntentId: paymentIntentId || orderPlaced?.paymentIntentId,
      invoiceNumber: orderPlaced?.invoiceNumber || "",
    });

    // Step 7: Save transfer ID if transfer succeeded
    if (transfer?.transfer?.id) {
      await order.update(
        {
          employeeTransferId: transfer.transfer.id,
        },
        { where: { id: orderId } },
      );

      console.log("✅ Employee commission transferred successfully");
      console.log("  Transfer ID:", transfer.transfer.id);

      return {
        success: true,
        orderId: orderId,
        employeeId: emp.id,
        employeeOf: employeeOf,
        commissionPercentage: commissionPercentage,
        employeeCommissionAmount: employeeCommissionAmount,
        orderSubTotal: orderSubTotal,
        transferId: transfer.transfer.id,
        transferCompleted: true,
        message: "Commission calculated, saved, and transferred successfully",
      };
    } else {
      console.error("⚠️ Transfer completed but no transfer ID returned");
      return {
        success: true,
        orderId: orderId,
        employeeId: emp.id,
        employeeOf: employeeOf,
        commissionPercentage: commissionPercentage,
        employeeCommissionAmount: employeeCommissionAmount,
        orderSubTotal: orderSubTotal,
        transferCompleted: false,
        message: "Commission calculated and saved, but transfer ID not found.",
      };
    }
  } catch (error) {
    console.error(
      "❌ Error in calculateAndTransferEmployeeCommissionWithData:",
      error.message,
    );
    return false;
  }
}

module.exports = {
  calculateAndSaveEmployeeCommission,
  transferEmployeeCommission,
  calculateAndTransferEmployeeCommission,
  bulkTransferEmployeeCommission,
  calculateAndTransferEmployeeCommissionWithData,
};
