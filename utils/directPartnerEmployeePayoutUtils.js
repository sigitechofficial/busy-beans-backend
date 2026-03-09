const { order, user, employee, salesRep, sequelize } = require("../models");
const Stripe = require("../controllers/stripe");

const ACTIVE_PAYOUT_STATUSES = ["pending", "in_transit", "paid"];
const RETRYABLE_PAYOUT_STATUSES = ["failed", "canceled"];

const toDateFromEpochSeconds = (seconds) => {
  if (!seconds) return null;
  return new Date(seconds * 1000);
};

const buildDirectPartnerPayoutIdempotencyKey = ({ orderId, attemptCount }) => {
  return `dp-employee-payout-order-${orderId}-attempt-${attemptCount}`;
};

async function markDirectPartnerPayoutFailed({
  orderId,
  message,
  failureCode = null,
  triggerSource = null,
  transaction = null,
}) {
  try {
    await order.update(
      {
        employeeOf: "direct-partner",
        directPartnerEmployeePayoutStatus: "failed",
        directPartnerEmployeePayoutFailureCode: failureCode,
        directPartnerEmployeePayoutFailureMessage: message || "Payout failed",
        directPartnerEmployeePayoutLastAttemptAt: new Date(),
        directPartnerEmployeePayoutLastTriggerSource: triggerSource,
      },
      { where: { id: orderId }, transaction },
    );
  } catch (error) {
    console.error(
      "⚠️ Unable to persist direct-partner payout failure state:",
      error?.message || error,
    );
  }
}

async function calculateAndPayoutDirectPartnerEmployeeCommission({
  orderId,
  forceRetry = false,
  triggerSource = "system",
}) {
  let transaction;

  try {
    transaction = await sequelize.transaction();

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
                "salesRepId",
                "commissionPercentage",
                "directPartnerExternalAccountId",
              ],
              required: false,
            },
          ],
        },
      ],
      attributes: [
        "id",
        "subTotal",
        "invoiceNumber",
        "salesRepId",
        "employeeId",
        "employeeCommisionAmount",
        "AppliedEmployeeCommisionPercentage",
        "employeeOf",
        "directPartnerEmployeePayoutId",
        "directPartnerEmployeePayoutStatus",
        "directPartnerEmployeePayoutAttemptCount",
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!orderData) {
      await transaction.rollback();
      console.error(`❌ Order with ID ${orderId} not found`);
      return {
        success: false,
        reasonCode: "ORDER_NOT_FOUND",
        message: `Order with ID ${orderId} not found`,
      };
    }

    const orderPlaced = JSON.parse(JSON.stringify(orderData));
    const customer = orderPlaced?.user;
    const currentPayoutStatus = orderPlaced?.directPartnerEmployeePayoutStatus;
    const hasPriorPayout = !!orderPlaced?.directPartnerEmployeePayoutId;

    if (hasPriorPayout && ACTIVE_PAYOUT_STATUSES.includes(currentPayoutStatus)) {
      await transaction.rollback();
      return {
        success: false,
        reasonCode: "PAYOUT_ALREADY_ACTIVE",
        message: "Payout is already active or completed for this order.",
      };
    }

    if (
      hasPriorPayout &&
      RETRYABLE_PAYOUT_STATUSES.includes(currentPayoutStatus) &&
      !forceRetry
    ) {
      await transaction.rollback();
      return {
        success: false,
        reasonCode: "PAYOUT_RETRY_REQUIRED",
        message: "Use retry flow for failed/canceled payout.",
      };
    }

    if (forceRetry && !RETRYABLE_PAYOUT_STATUSES.includes(currentPayoutStatus)) {
      await transaction.rollback();
      return {
        success: false,
        reasonCode: "PAYOUT_NOT_RETRYABLE",
        message: `Payout status '${currentPayoutStatus || "none"}' is not retryable.`,
      };
    }

    const localPartnerId = orderPlaced?.salesRepId || customer?.salesRepId;
    if (!localPartnerId) {
      await transaction.rollback();
      return {
        success: false,
        reasonCode: "INVALID_PARTNER_CONTEXT",
        message: "Order is not linked to a local partner.",
      };
    }

    const partner = await salesRep.findOne({
      where: { id: localPartnerId },
      attributes: ["id", "partnerType", "connectAccountId"],
      transaction,
    });

    if (!partner) {
      await markDirectPartnerPayoutFailed({
        orderId,
        message: "Local partner not found.",
        failureCode: "PARTNER_NOT_FOUND",
        triggerSource,
        transaction,
      });
      await transaction.commit();
      return {
        success: false,
        reasonCode: "PARTNER_NOT_FOUND",
        message: "Local partner not found.",
      };
    }

    if (partner.partnerType !== "direct-partner") {
      await transaction.rollback();
      return {
        success: false,
        reasonCode: "INVALID_PARTNER_CONTEXT",
        message: "Partner is not a direct-partner.",
      };
    }

    if (!partner.connectAccountId) {
      await markDirectPartnerPayoutFailed({
        orderId,
        message: "Direct-partner connect account is missing.",
        failureCode: "MISSING_CONNECT_ACCOUNT",
        triggerSource,
        transaction,
      });
      await transaction.commit();
      return {
        success: false,
        reasonCode: "MISSING_CONNECT_ACCOUNT",
        message: "Direct-partner connect account is missing.",
      };
    }

    const emp = customer?.employee;
    if (!emp) {
      await markDirectPartnerPayoutFailed({
        orderId,
        message: "Order customer does not have an associated employee.",
        failureCode: "MISSING_EMPLOYEE",
        triggerSource,
        transaction,
      });
      await transaction.commit();
      return {
        success: false,
        reasonCode: "MISSING_EMPLOYEE",
        message: "Order customer does not have an associated employee.",
      };
    }

    if (Number(emp?.salesRepId) !== Number(partner.id)) {
      await markDirectPartnerPayoutFailed({
        orderId,
        message: "Employee is not mapped to this direct-partner.",
        failureCode: "EMPLOYEE_PARTNER_MISMATCH",
        triggerSource,
        transaction,
      });
      await transaction.commit();
      return {
        success: false,
        reasonCode: "EMPLOYEE_PARTNER_MISMATCH",
        message: "Employee is not mapped to this direct-partner.",
      };
    }

    const commissionPercentage = parseFloat(emp?.commissionPercentage) || 0;
    if (commissionPercentage <= 0) {
      await markDirectPartnerPayoutFailed({
        orderId,
        message: `Employee has invalid commission percentage (${commissionPercentage}).`,
        failureCode: "INVALID_COMMISSION_PERCENTAGE",
        triggerSource,
        transaction,
      });
      await transaction.commit();
      return {
        success: false,
        reasonCode: "INVALID_COMMISSION_PERCENTAGE",
        message: `Employee has invalid commission percentage (${commissionPercentage}).`,
      };
    }

    if (!emp?.directPartnerExternalAccountId) {
      await markDirectPartnerPayoutFailed({
        orderId,
        message: "Employee direct-partner external account is not linked.",
        failureCode: "MISSING_EXTERNAL_ACCOUNT",
        triggerSource,
        transaction,
      });
      await transaction.commit();
      return {
        success: false,
        reasonCode: "MISSING_EXTERNAL_ACCOUNT",
        message: "Employee direct-partner external account is not linked.",
      };
    }

    const orderSubTotal = parseFloat(orderPlaced?.subTotal) || 0;
    if (orderSubTotal <= 0) {
      await markDirectPartnerPayoutFailed({
        orderId,
        message: `Order subtotal is invalid (${orderSubTotal}).`,
        failureCode: "INVALID_ORDER_SUBTOTAL",
        triggerSource,
        transaction,
      });
      await transaction.commit();
      return {
        success: false,
        reasonCode: "INVALID_ORDER_SUBTOTAL",
        message: `Order subtotal is invalid (${orderSubTotal}).`,
      };
    }

    const employeeCommissionAmount = (orderSubTotal * commissionPercentage) / 100;
    const nextAttemptCount =
      Number(orderPlaced?.directPartnerEmployeePayoutAttemptCount || 0) + 1;

    await order.update(
      {
        employeeId: emp.id,
        employeeOf: "direct-partner",
        AppliedEmployeeCommisionPercentage: commissionPercentage,
        employeeCommisionAmount: employeeCommissionAmount,
        directPartnerEmployeePayoutStatus: "pending",
        directPartnerEmployeePayoutFailureCode: null,
        directPartnerEmployeePayoutFailureMessage: null,
        directPartnerEmployeePayoutCreatedAt: new Date(),
        directPartnerEmployeePayoutAttemptCount: nextAttemptCount,
        directPartnerEmployeePayoutLastAttemptAt: new Date(),
        directPartnerEmployeePayoutLastTriggerSource: triggerSource,
      },
      { where: { id: orderId }, transaction },
    );

    const idempotencyKey = buildDirectPartnerPayoutIdempotencyKey({
      orderId,
      attemptCount: nextAttemptCount,
    });

    const payout = await Stripe.createConnectedAccountPayout({
      connectedAccountId: partner.connectAccountId,
      amount: employeeCommissionAmount,
      destinationExternalAccountId: emp.directPartnerExternalAccountId,
      idempotencyKey,
      metadata: {
        orderId: String(orderId),
        employeeId: String(emp.id),
        invoiceNumber: orderPlaced?.invoiceNumber || "",
        source: "direct-partner-employee-commission",
        retry: forceRetry ? "true" : "false",
        attemptCount: String(nextAttemptCount),
        triggerSource: triggerSource || "",
      },
    });

    const payoutStatus = payout?.status || "pending";
    const payoutId = payout?.id || null;

    await order.update(
      {
        employeeId: emp.id,
        employeeOf: "direct-partner",
        AppliedEmployeeCommisionPercentage: commissionPercentage,
        employeeCommisionAmount: employeeCommissionAmount,
        directPartnerEmployeePayoutId: payoutId,
        directPartnerEmployeePayoutStatus: payoutStatus,
        directPartnerEmployeePayoutFailureCode: payout?.failure_code || null,
        directPartnerEmployeePayoutFailureMessage:
          payout?.failure_message || null,
        directPartnerEmployeePayoutCreatedAt:
          toDateFromEpochSeconds(payout?.created) || new Date(),
        directPartnerEmployeePayoutPaidAt:
          payoutStatus === "paid"
            ? toDateFromEpochSeconds(payout?.arrival_date)
            : null,
        directPartnerEmployeePayoutLastAttemptAt: new Date(),
        directPartnerEmployeePayoutLastTriggerSource: triggerSource,
      },
      { where: { id: orderId }, transaction },
    );

    await transaction.commit();

    return {
      success: true,
      orderId,
      employeeId: emp.id,
      employeeOf: "direct-partner",
      commissionPercentage,
      commissionAmount: employeeCommissionAmount,
      payoutId,
      payoutStatus,
      attemptCount: nextAttemptCount,
      message: "Direct-partner employee commission payout created successfully",
    };
  } catch (error) {
    console.error(
      "❌ Error in calculateAndPayoutDirectPartnerEmployeeCommission:",
      error?.message || error,
    );

    if (transaction) {
      await transaction.rollback();
    }

    await markDirectPartnerPayoutFailed({
      orderId,
      message: error?.message || "Direct-partner payout failed",
      failureCode: "PAYOUT_CREATE_ERROR",
      triggerSource,
    });

    return {
      success: false,
      reasonCode: "PAYOUT_CREATE_ERROR",
      message: error?.message || "Direct-partner payout failed",
    };
  }
}

async function syncDirectPartnerEmployeePayoutStatus({
  orderId,
  payoutId,
  connectedAccountId,
}) {
  try {
    if (!orderId || !payoutId || !connectedAccountId) return false;

    const payout = await Stripe.retrieveConnectedAccountPayout({
      connectedAccountId,
      payoutId,
    });

    await order.update(
      {
        directPartnerEmployeePayoutStatus: payout?.status || null,
        directPartnerEmployeePayoutFailureCode: payout?.failure_code || null,
        directPartnerEmployeePayoutFailureMessage: payout?.failure_message || null,
        directPartnerEmployeePayoutCreatedAt: toDateFromEpochSeconds(payout?.created),
        directPartnerEmployeePayoutPaidAt:
          payout?.status === "paid"
            ? toDateFromEpochSeconds(payout?.arrival_date)
            : null,
        directPartnerEmployeePayoutLastAttemptAt: new Date(),
        directPartnerEmployeePayoutLastTriggerSource: "webhook",
      },
      { where: { id: orderId } },
    );

    return payout;
  } catch (error) {
    console.error(
      "❌ Error in syncDirectPartnerEmployeePayoutStatus:",
      error?.message || error,
    );
    return false;
  }
}

module.exports = {
  ACTIVE_PAYOUT_STATUSES,
  calculateAndPayoutDirectPartnerEmployeeCommission,
  syncDirectPartnerEmployeePayoutStatus,
};
