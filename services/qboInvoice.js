// services/qboInvoice.js
const axios = require("axios");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const {
  getOrderWithAssociations,
  getOrdersWithAssociations,
} = require("./orderService");
const { updateInvoiceInQuickBooks } = require("./qboInvoiceUpdate");
const { ensureItemByName, warmupQBOResources } = require("./qboItemService");
const { order, partnerOrder, account, qboCustomerMap } = require("../models");
const { handleQboError } = require("./qboErrorHandler");
const { qboQuery } = require("./qboHelpers");
const { getPulloutCustomFieldEntry } = require("./qboPulloutCustomField");

console.log("🚀 ~ qboInvoice.js ~ process.env.QBO_ENV:", Number(19.8));

const Order = order;
const PartnerOrder = partnerOrder;
const BASE =
  (process.env.QBO_ENV || "").toLowerCase() === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
const QBO = (realmId) => `${BASE}/v3/company/${realmId}`;

const MINOR = 70;
const MINOR_CUSTOM_FIELDS = 75;

// ---- Generic helpers ----
const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/json",
  "Content-Type": "application/json",
});

/**
 * Build a clear error message from an axios/QBO error so API responses show the real issue.
 * Uses QBO Fault.Error[].Message and Detail when present, else status + err.message.
 */
function getQboErrorMessage(err) {
  if (!err) return "Unknown error";
  const status = err.response?.status;
  const fault = err.response?.data?.Fault;
  const first = fault?.Error?.[0];
  if (first) {
    const msg = first.Message || "";
    const detail = first.Detail || "";
    const code = first.code ? ` (code ${first.code})` : "";
    const parts = [msg, detail].filter(Boolean);
    return `QBO ${status || "error"}${code}: ${parts.join(" — ")}`.trim();
  }
  if (status) return `QBO ${status}: ${err.message || "Request failed"}`;
  return err.message || "Unknown error";
}

/** QBO codes: invalid or deleted customer - mapping is stale and should be removed */
const QBO_STALE_CUSTOMER_CODES = ["2500", "6250"];

/**
 * If QBO error is "invalid reference" or "deleted customer", delete the matching
 * qboCustomerMaps row so the user can re-sync the customer.
 */
async function deleteStaleQboCustomerMappingIfNeeded(
  err,
  realmId,
  qboCustomerId,
) {
  if (!err?.response?.data?.Fault?.Error?.[0] || !realmId || !qboCustomerId)
    return;
  const code = String(err.response.data.Fault.Error[0].code || "");
  if (!QBO_STALE_CUSTOMER_CODES.includes(code)) return;
  try {
    const deleted = await qboCustomerMap.destroy({
      where: { realmId, qboCustomerId: String(qboCustomerId) },
    });
    if (deleted) {
      console.log(
        `[QBO] Removed stale customer mapping: realmId=${realmId}, qboCustomerId=${qboCustomerId} (QBO ${code})`,
      );
    }
  } catch (e) {
    console.warn("[QBO] Failed to delete stale qboCustomerMap:", e?.message);
  }
}

/**
 * When customer is "not connected" (no valid mapping), delete any existing
 * qboCustomerMaps row for this user in this realm so they can re-sync the customer.
 */
async function deleteQboCustomerMappingForUserInRealm(where) {
  if (!where || !where.realmId) return;
  try {
    const deleted = await qboCustomerMap.destroy({ where });
    if (deleted) {
      console.log(
        `[QBO] Removed not-connected customer mapping (re-sync customer):`,
        where,
      );
    }
  } catch (e) {
    console.warn(
      "[QBO] Failed to delete qboCustomerMap for re-connect:",
      e?.message,
    );
  }
}

function shouldSkipAdminQboSync({ orderType, order }) {
  if (orderType !== "customer" || !order?.salesRepId) return false;

  // Existing business rule: direct-partner customer orders do not sync to admin QBO.
  if (order?.partnerType === "direct-partner") return true;

  // New business rule: dropship direct-invoice orders should not sync to admin QBO.
  return (
    order?.partnerType === "dropship-partner" &&
    order?.type === "direct-invoice"
  );
}

/**
 * Query QBO for Sales Rep custom field DefinitionId
 * Uses GraphQL API to find custom field by name
 */
async function getSalesRepCustomFieldDefinitionId({ accessToken, realmId }) {
  try {
    // GraphQL endpoint for custom field definitions
    const graphqlUrl = "https://qb.api.intuit.com/graphql";

    const query = `
      query {
        appFoundationsCustomFieldDefinitions {
          id
          name
          type
          legacyIdV2
        }
      }
    `;

    const response = await axios.post(
      graphqlUrl,
      { query },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        validateStatus: () => true, // Don't throw on error
      },
    );

    if (response?.data?.data?.appFoundationsCustomFieldDefinitions) {
      const customFields =
        response.data.data.appFoundationsCustomFieldDefinitions;

      // Look for "Sales Rep" field (case-insensitive)
      const salesRepField = customFields.find(
        (field) =>
          field.name &&
          (field.name.toLowerCase() === "sales rep" ||
            field.name.toLowerCase() === "salesrep" ||
            field.name.toLowerCase() === "local partner"),
      );

      if (salesRepField?.legacyIdV2) {
        console.log(
          `✅ [QBO] Found Sales Rep custom field: ${salesRepField.name} (DefinitionId: ${salesRepField.legacyIdV2})`,
        );
        return salesRepField.legacyIdV2;
      }
    }

    console.log("⚠️ [QBO] Sales Rep custom field not found via GraphQL query");
    return null;
  } catch (err) {
    console.warn(
      "⚠️ [QBO] Error querying custom field definitions:",
      err.message,
    );
    // GraphQL might not be available or scopes missing - that's okay, we'll use fallback
    return null;
  }
}

// =========================
// 🔹 Helpers
// =========================

/**
 * Normalize a raw payment method name to a QBO-friendly label
 */
function mapPaymentMethodName(name = "") {
  name = name.toLowerCase();

  if (name.includes("card") && name.includes("credit")) return "Credit Card";
  // "card" from Stripe etc. → Credit Card for QBO
  if (name === "card" || (name.includes("card") && !name.includes("debit")))
    return "Credit Card";
  if (name.includes("debit")) return "Debit Card";
  if (name.includes("cash")) return "Cash";
  if (name.includes("cheque") || name.includes("check")) return "Check";
  if (name.includes("wire")) return "Wire Transfer";

  // ✅ All “bank transfer” types → ACH
  if (
    name.includes("bank") ||
    name.includes("transfer") ||
    name.includes("zelle") ||
    name.includes("venmo") ||
    name.includes("online")
  )
    return "ACH";

  return "ACH"; // safest fallback
}

async function getValidDepositAccount({ accessToken, realmId }) {
  const query = `select Id, Name, AccountType from Account`; // no WHERE

  const res = await qboQuery({ accessToken, realmId, query });

  const accounts = res?.QueryResponse?.Account || [];

  // 1️⃣ Prefer Undeposited Funds
  const undeposited = accounts.find(
    (a) => a.Name?.toLowerCase() === "undeposited funds",
  );
  if (undeposited) return undeposited.Id;

  // 2️⃣ Otherwise pick any “Bank” account
  const bank = accounts.find(
    (a) => a.AccountType && a.AccountType.toLowerCase() === "bank",
  );
  if (bank) return bank.Id;

  // 3️⃣ Otherwise pick any usable asset account
  const asset = accounts.find(
    (a) =>
      a.AccountType &&
      ["other current assets", "accounts receivable"].includes(
        a.AccountType.toLowerCase(),
      ),
  );
  if (asset) return asset.Id;

  throw new Error("No valid deposit account found in QBO Charts of Accounts.");
}

/**
 * Ensure a PaymentMethod exists in QBO — fetch or create it
 */
async function ensurePaymentMethod({ accessToken, realmId, name }) {
  try {
    // 1️⃣ Try to find existing method
    const query = encodeURIComponent(
      `select * from PaymentMethod where Name='${name}'`,
    );
    const res = await axios.get(`${QBO(realmId)}/query?query=${query}`, {
      headers: headers(accessToken),
    });
    const found = res.data?.QueryResponse?.PaymentMethod?.[0];
    if (found?.Id) {
      console.log(`[QBO] Found existing PaymentMethod: ${name} (${found.Id})`);
      return found.Id;
    }

    // 2️⃣ Not found — create new one
    // QBO only accepts Type: "CREDIT_CARD" | "NON_CREDIT_CARD" | null (no "OTHER")
    const payload = {
      Name: name,
      Type: name === "Credit Card" ? "CREDIT_CARD" : "NON_CREDIT_CARD",
      Active: true,
    };
    const createRes = await axios.post(
      `${QBO(realmId)}/paymentmethod`,
      payload,
      {
        headers: headers(accessToken),
      },
    );
    const createdId = createRes.data?.PaymentMethod?.Id;
    console.log(`[QBO] Created new PaymentMethod: ${name} (${createdId})`);
    return createdId;
  } catch (err) {
    handleQboError({
      err,
      context: "[QBO] Failed to ensure PaymentMethod:",
    });
    throw err; // keep error bubbling
  }
}
// =========================
// 🔸 Main Function
// =========================
// ---- Payment creation ----
async function createPaymentForInvoice({
  accessToken,
  realmId,
  invoiceId,
  customerId,
  amount,
  paymentMethodName,
  refNumber,
  paidDate,
  invoiceNumber,
}) {
  console.log("🚀 Creating QBO Payment:", {
    invoiceId,
    customerId,
    amount,
    paymentMethodName,
    refNumber,
    paidDate,
    realmId,
    invoiceNumber,
  });

  if (!accessToken || !realmId) throw new Error("Missing QBO credentials");
  if (!invoiceId || !customerId)
    throw new Error("Missing invoice or customer ID");

  /* -----------------------------------------------------------
   ✅ 1. Normalize amount + date
  ----------------------------------------------------------- */

  /* -----------------------------------------------------------
   Validate Invoice before creating payment
----------------------------------------------------------- */
  const inv = await axios
    .get(`${QBO(realmId)}/invoice/${invoiceId}?minorversion=${MINOR}`, {
      headers: headers(accessToken),
    })
    .then((r) => r.data.Invoice);

  if (!inv) {
    throw new Error(
      `Invoice ${invoiceId} does not exist in QBO realm ${realmId}`,
    );
  }

  if (String(inv.CustomerRef?.value) !== String(customerId)) {
    throw new Error(
      `Invoice ${invoiceId} belongs to customer ${inv.CustomerRef.value}, not ${customerId}`,
    );
  }

  // Log invoice details for debugging
  console.log("🔍 [QBO] Invoice details:", {
    invoiceId,
    balance: inv.Balance,
    totalAmt: inv.TotalAmt,
    paidAmt: inv.TotalAmt - (inv.Balance || 0),
    hasPaymentRef: !!inv.PaymentRefNum,
  });

  const safeAmount = Number(amount) || 0.01;
  const safeDate = new Date(
    paidDate && !isNaN(Date.parse(paidDate)) ? paidDate : Date.now(),
  )
    .toISOString()
    .slice(0, 10);

  // Check if invoice is already paid - return existing payment ID if found
  if (Number(inv.Balance) <= 0) {
    console.log(
      `⚠️ [QBO] Invoice ${invoiceId} is already paid or closed. Checking for existing payment...`,
    );
    // Invoice is paid but no linked payment found → try to recover by creating link-only payment
    console.warn(
      `⚠️ [QBO] Invoice ${invoiceId} is closed but has no linked payment. Attempting recovery...`,
    );

    // Force-create linking payment with original total
    const recoveryAmount = Number(inv.TotalAmt || amount || 0);

    if (recoveryAmount <= 0) {
      throw new Error(
        `Cannot recover payment for invoice ${invoiceId}: invalid amount`,
      );
    }

    const recoveryPayload = {
      CustomerRef: { value: String(customerId) },
      TotalAmt: recoveryAmount,
      TxnDate: safeDate,
      PaymentRefNum: `REC-${invoiceId}`.substring(0, 21),
      Line: [
        {
          Amount: recoveryAmount,
          LinkedTxn: [{ TxnId: String(invoiceId), TxnType: "Invoice" }],
        },
      ],
    };

    console.log("🔁 [QBO] Creating recovery payment:", recoveryPayload);

    try {
      const recoveryRes = await axios.post(
        `${QBO(realmId)}/payment?minorversion=${MINOR}`,
        recoveryPayload,
        { headers: headers(accessToken) },
      );

      const recoveryPay = recoveryRes?.data?.Payment;

      if (!recoveryPay?.Id) {
        throw new Error("Recovery payment returned no ID");
      }

      console.log(
        `✅ [QBO] Recovery payment created: ${recoveryPay.Id} for invoice ${invoiceId}`,
      );

      return {
        id: recoveryPay.Id,
        totalAmt: recoveryPay.TotalAmt,
        txnDate: recoveryPay.TxnDate,
        raw: recoveryPay,
        isExisting: false,
        recovered: true,
      };
    } catch (recoveryErr) {
      console.error(
        "❌ [QBO] Recovery payment failed:",
        recoveryErr.response?.data || recoveryErr.message,
      );
      throw recoveryErr;
    }
  }

  /* -----------------------------------------------------------
   ✅ 2. Check for existing payment before creating (same method as above)
  ----------------------------------------------------------- */
  // Use same customer-based query method
  try {
    const query = `select Id, TotalAmt, TxnDate, LinkedTxn from Payment where CustomerRef = '${String(customerId)}'`;
    const queryUrl = `${QBO(realmId)}/query?query=${encodeURIComponent(query)}&minorversion=${MINOR}`;
    const queryRes = await axios.get(queryUrl, {
      headers: headers(accessToken),
      validateStatus: () => true,
    });

    if (queryRes?.data?.QueryResponse?.Payment) {
      const payments = Array.isArray(queryRes.data.QueryResponse.Payment)
        ? queryRes.data.QueryResponse.Payment
        : [queryRes.data.QueryResponse.Payment];

      const existingPayment = payments.find((p) => {
        if (!p.LinkedTxn) return false;
        const linkedTxns = Array.isArray(p.LinkedTxn)
          ? p.LinkedTxn
          : [p.LinkedTxn];
        return linkedTxns.some(
          (lt) => lt?.TxnId === String(invoiceId) && lt?.TxnType === "Invoice",
        );
      });

      if (existingPayment?.Id) {
        console.log(
          `✅ [QBO] Payment already exists for invoice ${invoiceId}: ${existingPayment.Id}`,
        );
        return {
          id: existingPayment.Id,
          totalAmt: existingPayment.TotalAmt,
          txnDate: existingPayment.TxnDate || safeDate,
          raw: existingPayment,
          isExisting: true,
        };
      }
    }
  } catch (preCheckErr) {
    console.warn(
      `⚠️ [QBO] Pre-check for existing payment failed:`,
      preCheckErr.message,
    );
    // Continue with payment creation
  }

  /* -----------------------------------------------------------
   ✅ 3. Normalize & map payment name to QBO-safe format
  ----------------------------------------------------------- */
  const normalizedName = mapPaymentMethodName(paymentMethodName);

  /* -----------------------------------------------------------
   ✅ 4. Get or Create PaymentMethod
  ----------------------------------------------------------- */
  const paymentMethodId = await ensurePaymentMethod({
    accessToken,
    realmId,
    name: normalizedName,
  });

  if (!paymentMethodId) {
    throw new Error("QBO PaymentMethod not found or could not be created.");
  }

  /* -----------------------------------------------------------
   ✅ 5. Build Payment Payload
  ----------------------------------------------------------- */
  // QBO has a 21 character limit for PaymentRefNum
  let safeRefNumber = refNumber || `ref-${invoiceId}`;
  if (safeRefNumber.length > 21) {
    console.warn(
      `⚠️ [QBO] PaymentRefNum too long (${safeRefNumber.length} chars), truncating to 21 characters`,
    );
    safeRefNumber = safeRefNumber.substring(0, 21);
  }

  const payload = {
    CustomerRef: { value: String(customerId) },
    TotalAmt: safeAmount,
    TxnDate: safeDate,
    PaymentRefNum: safeRefNumber,
    PaymentMethodRef: { value: String(paymentMethodId) },
    // ✅ REQUIRED: accounts receivable reference
    // ARAccountRef: { value: "33" }, // QBO auto-resolves this for most accounts, override if needed
    Line: [
      {
        Amount: safeAmount,
        LinkedTxn: [{ TxnId: String(invoiceId), TxnType: "Invoice" }],
      },
    ],
  };

  //   const depositAccountId = await getValidDepositAccount({
  //     accessToken,
  //     realmId,
  //   });
  //   payload.DepositToAccountRef = { value: String(depositAccountId) };

  if (invoiceNumber) {
    payload.PrivateNote = `Order Invoice ID: ${invoiceNumber}`;
  }
  console.log("🚀 ~ createPaymentForInvoice ~ payload:", payload);

  /* -----------------------------------------------------------
   ✅ 6. Send Request to QBO
  ----------------------------------------------------------- */
  try {
    const res = await axios.post(
      `${QBO(realmId)}/payment?minorversion=${MINOR}`,
      payload,
      { headers: headers(accessToken) },
    );

    const payment = res.data?.Payment;

    if (!payment?.Id) throw new Error("QBO returned invalid Payment response.");

    console.log("✅ QBO Payment Created:", {
      paymentId: payment.Id,
      total: payment.TotalAmt,
      date: payment.TxnDate,
    });

    return {
      id: payment.Id,
      totalAmt: payment.TotalAmt,
      txnDate: payment.TxnDate,
      raw: payment,
      isExisting: false,
    };
  } catch (error) {
    // Handle duplicate payment or validation errors
    const errorCode = error?.response?.data?.Fault?.Error?.[0]?.code;
    const errorMessage =
      error?.response?.data?.Fault?.Error?.[0]?.Message || "";
    const errorDetail = error?.response?.data?.Fault?.Error?.[0]?.Detail || "";

    console.log("🔍 [QBO] Payment error details:", {
      errorCode,
      errorMessage,
      errorDetail,
    });

    // Check if it's a duplicate payment error or validation error
    if (
      errorCode === "6000" ||
      errorMessage.includes("already exists") ||
      errorMessage.includes("duplicate") ||
      errorDetail.includes("already")
    ) {
      console.log(
        "⚠️ [QBO] Duplicate payment detected, finding existing payment...",
      );

      try {
        // Query QBO to find existing payment for this invoice
        const query = encodeURIComponent(
          `select Id, TotalAmt from Payment where Any(LinkedTxn.TxnId) = '${String(invoiceId)}' and Any(LinkedTxn.TxnType) = 'Invoice'`,
        );
        const queryUrl = `${QBO(realmId)}/query?query=${query}&minorversion=${MINOR}`;
        const queryRes = await axios.get(queryUrl, {
          headers: headers(accessToken),
          validateStatus: () => true,
        });

        const existingPayment = queryRes?.data?.QueryResponse?.Payment?.[0];
        if (existingPayment?.Id) {
          console.log(
            `✅ [QBO] Found existing payment ${existingPayment.Id} for invoice ${invoiceId}`,
          );
          return {
            id: existingPayment.Id,
            totalAmt: existingPayment.TotalAmt,
            txnDate: safeDate,
            raw: existingPayment,
            isExisting: true,
          };
        }
      } catch (findErr) {
        console.error(
          "❌ [QBO] Error while trying to find existing payment:",
          findErr.message,
        );
      }
    }

    handleQboError({
      err: error,
      context: `[QBO][Payment] ----❌ QBO Payment Failed:`,
    });
    throw error; // keep error bubbling
  }
}

async function createQboPayment({
  order,
  invoiceId,
  accessToken,
  realmId,
  qboCustomerId = null,
  subtractLocalPartnerCommission = false,
}) {
  try {
    console.log("⚡ [QBO] Creating Payment for invoice:", invoiceId);

    // For admin + customer only: payment amount = totalBill - localPatnerCommission
    const rawTotal = Number(order.totalBill) || 0;
    const commission = Number(order.localPatnerCommission) || 0;
    const amount =
      subtractLocalPartnerCommission && commission > 0
        ? Math.max(0, rawTotal - commission)
        : rawTotal;

    const paymentRes = await createPaymentForInvoice({
      accessToken,
      realmId,
      invoiceId,
      customerId: qboCustomerId || order.qboCustomerId,
      amount,
      paymentMethodName: order.paymentMethod,
      refNumber: order.paymentIntentId || order.invoiceId,
      paidDate: order.invoicePaidDate,
      invoiceNumber: order.invoiceNumber,
    });

    const paymentId = paymentRes?.id;

    // Handle different scenarios
    if (paymentRes?.skipped) {
      // Invoice is already paid but payment not found - this is unusual
      console.log(
        `ℹ️ [QBO] Payment skipped - invoice already paid but payment not found: ${paymentRes.note || ""}`,
      );
      // Return null so caller can handle (don't update DB)
      return { paymentId: null, skipped: true };
    }

    if (paymentRes?.isExisting) {
      // Found existing payment - return it so DB can be updated
      console.log(`✅ [QBO] Using existing payment: ${paymentId}`);
      return { paymentId, isExisting: true };
    }

    if (!paymentId) {
      throw new Error("QBO Payment creation failed - no payment ID returned.");
    }

    console.log("✅ [QBO] Payment Created:", paymentId);

    return { paymentId, isExisting: false };
  } catch (err) {
    handleQboError({
      err: err,
      context: `❌ [QBO Payment ERROR]`,
    });
    throw err; // keep error bubbling
  }
}

async function createQboInvoice({
  order,
  accessToken,
  realmId,
  subtractSalerCommission = false,
}) {
  // Define payload outside try block so it's accessible in catch block
  let payload = null;

  try {
    console.log("⚡ [QBO] Creating Invoice for Order:", order?.id);

    // Warmup product/service IDs
    const { productItemId, serviceItemId, shippingItemId } =
      await warmupQBOResources({ accessToken, realmId });

    const Lines = (order.items || []).map((it) => {
      const qty = Number(it.qty || 1);

      // Log input values for debugging
      console.log("🔍 [QBO] Item calculation input:", {
        product: it.product,
        qty,
        price: it.price,
        total: it.total,
        wholesalePrice: it.wholesalePrice,
      });

      // CRITICAL: DB stores total price (after discounts), not unit price
      // QBO requires: Amount = UnitPrice * Qty (exact match, no rounding differences)
      // Strategy: Calculate unitPrice from DB total, then recalculate amount to ensure exact match
      let amount;
      let unitPrice;

      // Get the line total from DB (this is the actual charged amount after discounts). Use it.total (line total) first, not it.price (often unit price).
      let totalNum = Number(it.total || it.price || 0);
      const salerCommission = Number(it.salerCommission || 0);
      // Only subtract saler commission for admin sync when orderType is customer (not for local partner sync)
      if (subtractSalerCommission && salerCommission > 0) {
        totalNum = totalNum - salerCommission;
      }

      // CRITICAL: Always prioritize DB total (it.total or it.price) as it's the actual charged amount
      // Use wholesalePrice only if DB total is not available
      if (totalNum > 0 && qty > 0) {
        // Calculate unitPrice from total
        // Use the exact division result without premature rounding
        unitPrice = totalNum / qty;

        // Calculate amount from unitPrice - this ensures Amount = UnitPrice * Qty exactly
        // Round only at the final step to 2 decimal places
        amount = Math.round(unitPrice * qty * 100) / 100;

        // Round unitPrice to 8 decimal places for QBO (they accept up to 8 decimals)
        // This preserves precision while ensuring the calculation works
        unitPrice = Math.round(unitPrice * 100000000) / 100000000;

        // Final verification: recalculate amount one more time to ensure exact match
        const finalAmount = Math.round(unitPrice * qty * 100) / 100;
        if (Math.abs(amount - finalAmount) > 0.0001) {
          amount = finalAmount;
        }

        // Log if there's a significant difference from DB total
        const difference = Math.abs(totalNum - amount);
        if (difference > 0.01) {
          console.warn("⚠️ [QBO] Difference between DB total and QBO amount:", {
            product: it.product,
            dbTotal: totalNum,
            qboAmount: amount,
            difference: difference.toFixed(4),
            note: "Using calculated amount to satisfy QBO validation (Amount = UnitPrice * Qty)",
          });
        }
      } else if (it.wholesalePrice && qty > 0 && !subtractSalerCommission) {
        // Fallback: use wholesalePrice only when NOT subtracting commission (otherwise we'd send retail as unit price)
        unitPrice = Number(it.wholesalePrice);
        amount = Math.round(unitPrice * qty * 100) / 100;
        unitPrice = Math.round(unitPrice * 100000000) / 100000000;
      } else {
        amount = 0;
        unitPrice = 0;
      }

      // Final verification: Amount MUST equal UnitPrice * Qty exactly (QBO requirement)
      const verification = Math.round(unitPrice * qty * 100) / 100;
      const isExactMatch = Math.abs(amount - verification) < 0.0001;

      console.log("🔍 [QBO] Final line item:", {
        product: it.product,
        unitPrice: unitPrice.toFixed(8),
        qty,
        amount,
        verification,
        isExactMatch,
        difference: Math.abs(amount - verification),
        dbTotal: totalNum,
      });

      if (!isExactMatch) {
        console.error("❌ [QBO] Amount mismatch - using verification value!", {
          product: it.product,
          unitPrice,
          qty,
          amount,
          expected: verification,
        });
        // Force exact match - QBO validation requires this
        amount = verification;
      }

      return {
        Amount: amount,
        Description: `${it.product || "Item"}${it.grind ? ` • (${it.grind})` : ""}`,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: {
            value: String(it.productId ? productItemId : serviceItemId),
          },
          Qty: qty,
          UnitPrice: unitPrice,
          TaxCodeRef: { value: "NON" },
        },
      };
    });

    // Add shipping charge if exists
    if (Number(order.shippingCharges) > 0) {
      const shipAmt = +Number(order.shippingCharges).toFixed(2);
      Lines.push({
        Amount: shipAmt,
        Description: `Shipping Charges (${order.shippingCompany || "UPS"})`,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: String(shippingItemId) },
          Qty: 1,
          UnitPrice: shipAmt,
          TaxCodeRef: { value: "NON" },
        },
      });
    }

    // Build PrivateNote (keep original note only, no local partner info)
    const privateNote = order.note || undefined;

    // Build Local Partner info as separate field
    // Try to use existing "Sales Rep" custom field, or add as custom field
    let localPartnerValue = null;
    if (order.userId && order.salesRepId) {
      const salesRepName = order.salesRepName || "";
      const territoryName = order.territoryName || "";
      localPartnerValue = `${salesRepName}${territoryName ? ` (${territoryName})` : ""}`;
    }

    // Try to get Sales Rep custom field DefinitionId
    let salesRepDefinitionId = null;

    // Option 1: Check environment variable first (fastest, recommended)
    salesRepDefinitionId =
      process.env.QBO_SALES_REP_CUSTOM_FIELD_ID ||
      process.env.QBO_LOCAL_PARTNER_CUSTOM_FIELD_ID ||
      null;

    // Option 2: If not in env, try to query for it via GraphQL
    if (!salesRepDefinitionId && localPartnerValue) {
      try {
        const foundDefinitionId = await getSalesRepCustomFieldDefinitionId({
          accessToken,
          realmId,
        });
        if (foundDefinitionId) {
          salesRepDefinitionId = foundDefinitionId;
          console.log(
            `✅ [QBO] Auto-detected Sales Rep CustomField DefinitionId: ${salesRepDefinitionId}`,
          );
        }
      } catch (queryErr) {
        console.warn(
          "⚠️ [QBO] Could not query for Sales Rep custom field:",
          queryErr.message,
        );
      }
    }

    let customFields = [];
    if (localPartnerValue && salesRepDefinitionId) {
      customFields.push({
        DefinitionId: salesRepDefinitionId,
        StringValue: localPartnerValue,
      });
      console.log(
        `✅ [QBO] Adding Local Partner to Sales Rep CustomField: ${localPartnerValue}`,
      );
    } else if (localPartnerValue) {
      console.log(
        `⚠️ [QBO] Sales Rep CustomField not found. Using fallback method...`,
      );
    }

    const pulloutCf = getPulloutCustomFieldEntry(order);
    if (pulloutCf) {
      customFields.push(pulloutCf);
      console.log(
        `✅ [QBO] Adding Pullout CustomField (pulloutIntentId=${pulloutCf.StringValue})`,
      );
    }

    payload = {
      CustomerRef: { value: String(order.qboCustomerId) },
      Line: Lines,
      TxnDate: new Date(order.invoiceDate || Date.now())
        .toISOString()
        .slice(0, 10),
      DueDate: new Date(
        new Date(order.invoiceDate || Date.now()).getTime() +
          (order.termDays || 30) * 86400000,
      )
        .toISOString()
        .slice(0, 10),
      DocNumber: order.invoiceNumber || undefined,
      PrivateNote: privateNote,
      // Add CustomField for Sales Rep if DefinitionId is configured
      ...(customFields.length > 0 ? { CustomField: customFields } : {}),
      // Fallback: Add Local Partner as PONumber field if CustomField not configured
      // This appears as separate column in QBO and doesn't require setup
      ...(localPartnerValue && !salesRepDefinitionId
        ? { PONumber: `Local Partner: ${localPartnerValue}` }
        : {}),
    };

    console.log("⚡ [QBO] Invoice Payload:", payload);

    const hasCustomFields = customFields.length > 0;
    const invoiceUrl = hasCustomFields
      ? `${QBO(realmId)}/invoice?minorversion=${MINOR_CUSTOM_FIELDS}&include=enhancedAllCustomFields`
      : `${QBO(realmId)}/invoice?minorversion=${MINOR}`;
    const invRes = await axios.post(invoiceUrl, payload, {
      headers: headers(accessToken),
    });
    console.log("🚀 ~ createQboInvoice ~ invRes:", true);

    const invoiceId = invRes?.data?.Invoice?.Id;
    if (!invoiceId) throw new Error("Failed to create QuickBooks Invoice");

    console.log("✅ [QBO] Invoice Created:", invoiceId);

    return { invoiceId, payload, invRes };
  } catch (err) {
    // Handle duplicate document number error
    const errorCode = err?.response?.data?.Fault?.Error?.[0]?.code;
    const errorMessage = err?.response?.data?.Fault?.Error?.[0]?.Message || "";
    const errorDetail = err?.response?.data?.Fault?.Error?.[0]?.Detail || "";

    console.log("🔍 [QBO] Error details:", {
      errorCode,
      errorMessage,
      errorDetail,
    });

    if (
      errorCode === "6140" ||
      errorMessage.includes("Duplicate Document Number")
    ) {
      console.log(
        "⚠️ [QBO] Duplicate document number detected, finding existing invoice...",
      );

      const docNumber = order.invoiceNumber;
      if (!docNumber) {
        console.error(
          "❌ [QBO] Cannot find duplicate invoice - no DocNumber provided",
        );
        handleQboError({
          err: err,
          context: `❌ [QBO Invoice ERROR]:`,
        });
        throw err;
      }

      try {
        // Try to extract TxnId from error message first
        // Error format: "DocNumber=INV001110 is assigned to TxnType=Invoice with TxnId=1109"
        const txnIdMatch = errorDetail.match(/TxnId=(\d+)/);
        let existingInvoiceId = txnIdMatch ? txnIdMatch[1] : null;

        console.log("🔍 [QBO] Extracted TxnId from error:", existingInvoiceId);

        // If not found in error message, query QBO to find invoice by DocNumber
        if (!existingInvoiceId) {
          console.log(
            "🔍 [QBO] TxnId not in error message, querying QBO by DocNumber...",
          );
          const query = encodeURIComponent(
            `select Id, DocNumber from Invoice where DocNumber='${docNumber.replace(/'/g, "''")}'`,
          );
          const queryUrl = `${QBO(realmId)}/query?query=${query}&minorversion=${MINOR}`;

          const queryRes = await axios.get(queryUrl, {
            headers: headers(accessToken),
            validateStatus: () => true, // Don't throw on error
          });

          const existingInvoice = queryRes?.data?.QueryResponse?.Invoice?.[0];
          if (existingInvoice?.Id) {
            existingInvoiceId = existingInvoice.Id;
            console.log("🔍 [QBO] Found invoice via query:", existingInvoiceId);
          } else {
            console.log("🔍 [QBO] No invoice found via query");
          }
        }

        if (existingInvoiceId) {
          console.log(
            `✅ [QBO] Found existing invoice with DocNumber ${docNumber}: ${existingInvoiceId}`,
          );
          // Return the existing invoice ID instead of throwing error
          return {
            invoiceId: existingInvoiceId,
            payload: payload || undefined, // payload may be null if error occurred before it was set
            isExisting: true,
          };
        } else {
          console.error(
            `❌ [QBO] Duplicate DocNumber error but could not find existing invoice: ${docNumber}`,
          );
          handleQboError({
            err: err,
            context: `❌ [QBO Invoice ERROR]:`,
          });
          throw err;
        }
      } catch (findErr) {
        console.error(
          "❌ [QBO] Error while trying to find existing invoice:",
          findErr.message,
        );
        handleQboError({
          err: err,
          context: `❌ [QBO Invoice ERROR]:`,
        });
        throw err; // Throw original error
      }
    }

    handleQboError({
      err: err,
      context: `❌ [QBO Invoice ERROR]:`,
    });
    throw err; // keep error bubbling
  }
}
async function updateOrderRecord({ orderId, input = {}, MODEL = Order }) {
  console.log("🚀 ~ updateOrderRecord ~ input:", input);
  if (!orderId) throw new Error("Missing orderId");
  try {
    await MODEL.update(
      { ...input, qboLastSync: new Date() },
      { where: { id: orderId } },
    );

    console.log(`[QBO][OrderUpdate] Updated order ${orderId}:`, input);
  } catch (err) {
    handleQboError({
      err: err,
      context: `[QBO][OrderUpdate] ❌ Failed for order ${orderId}`,
    });
    throw err; // keep error bubbling
  }
}

// HANDLES INVOICE SYN and PAyment sync On ADMIN QBO
// Returns { saved: boolean, reason?: string } so bulk sync can report real success/failure
async function handleAdminQboSync({
  order,
  orderType,
  orderId,
  ADMIN,
  DBMODEL,
  updateRequest = false,
}) {
  try {
    console.log("🚀 ~ handleAdminQboSync ~ ADMIN:", {
      order,
      orderType,
      orderId,
      ADMIN,
      DBMODEL,
      updateRequest,
    });
    // Skip admin sync for direct-partner orders and dropship direct-invoice orders.
    if (shouldSkipAdminQboSync({ orderType, order })) {
      if (order?.partnerType === "direct-partner") {
        console.log(
          "[QBO] Skipping admin sync — order belongs to direct local-partner",
        );
        return {
          saved: true,
          reason: "skipped_admin_sync_direct_partner_order",
        };
      }
      console.log(
        "[QBO] Skipping admin sync — dropship direct-invoice order",
      );
      return {
        saved: true,
        reason: "skipped_admin_sync_dropship_direct_invoice_order",
      };
    }
    if (!ADMIN?.currentRealmId) {
      console.log(
        "🚀 ~ handlePartnerQboSync ~ LOCAL ADMIN NOT CONNECTED OR  ORDER ALREADY ON QUICK BOOKS:",
      );
      return { saved: false, reason: "admin_qbo_not_connected" };
    }

    const adminQboCondition = {
      realmId: ADMIN?.currentRealmId,
      accountId: ADMIN.id,
    };

    const customerOrPartnerCondition = { ...adminQboCondition };
    if (orderType == "customer") {
      customerOrPartnerCondition.userId = order.userId;
    } else if (orderType == "local-partner") {
      customerOrPartnerCondition.salesRepId = order.salesRepId;
    }

    const qboCustomerOnAdmin = await qboCustomerMap.findOne({
      where: customerOrPartnerCondition,
    });
    console.log(
      "🚀 ~ handleAdminQboSync ~ qboCustomerOnAdmin:",
      qboCustomerOnAdmin?.qboCustomerId,
    );
    if (!qboCustomerOnAdmin?.qboCustomerId) {
      console.log("🚀 ~ ADMIN QBO CUSTOMER NOT CONNECTED");
      await deleteQboCustomerMappingForUserInRealm({
        realmId: ADMIN?.currentRealmId,
        accountId: ADMIN?.id,
        userId: order?.userId,
      });
      return { saved: false, reason: "admin_qbo_customer_not_connected" };
    }

    order.qboCustomerId = qboCustomerOnAdmin.qboCustomerId;

    const { accessToken, realmId } = await refreshAccessTokenIfNeeded({
      condition: adminQboCondition,
    });

    // Skip admin sync if invoice already exists (unless update requested)
    if (order?.quickBooksInvoiceId && !updateRequest) {
      console.log(
        `[QBO] Admin invoice already exists (${order.quickBooksInvoiceId}), skipping admin sync`,
      );
      return { saved: true, reason: "admin_invoice_already_exists" };
    }
    if (accessToken && realmId && !order?.quickBooksInvoiceId) {
      // Create admin invoice only if it doesn't exist
      const adminQboInvoice = await createQboInvoice({
        order,
        accessToken,
        realmId,
        subtractSalerCommission:
          orderType === "customer" && !!order?.salesRepId,
      });

      updateOrderRecord({
        orderId,
        input: {
          quickBooksInvoiceId: adminQboInvoice?.invoiceId,
          adminRealmId: realmId,
        },
        MODEL: DBMODEL,
      });

      if (order?.paymentStatus == "done") {
        const adminQboPayment = await createQboPayment({
          order,
          invoiceId: adminQboInvoice?.invoiceId,
          accessToken,
          realmId,
          qboCustomerId: qboCustomerOnAdmin?.qboCustomerId,
          subtractLocalPartnerCommission:
            orderType === "customer" && !!order?.salesRepId,
        });

        updateOrderRecord({
          orderId,
          input: { quickBooksPaymentId: adminQboPayment?.paymentId },
          MODEL: DBMODEL,
        });
      }
      return { saved: true, reason: "admin_invoice_created" };
    }
    if (accessToken && realmId && order?.quickBooksInvoiceId && updateRequest) {
      console.log("🚀 ~ ADMIN QBO UPDATE ORDER", orderId);

      await updateInvoiceInQuickBooks({
        accessToken,
        realmId,
        order,
        qboInvoiceId: order?.quickBooksInvoiceId,
        MODEL: DBMODEL,
        subtractSalerCommission:
          orderType === "customer" && !!order?.salesRepId,
      });
      return { saved: true, reason: "admin_invoice_updated" };
    }
    return { saved: false, reason: "admin_qbo_token_or_realm_missing" };
  } catch (err) {
    handleQboError({
      err: err,
      context: `🔥 ERROR in handleAdminQboSync:`,
    });
    await deleteStaleQboCustomerMappingIfNeeded(
      err,
      ADMIN?.currentRealmId,
      order?.qboCustomerId,
    );
    return {
      saved: false,
      reason: getQboErrorMessage(err) || "admin_sync_error",
    };
  }
}

// HANDLES INVOICE SYN and PAyment sync On local Partner QBO
// Returns { saved: boolean, reason?: string } so bulk sync can report real success/failure
async function handlePartnerQboSync({
  order,
  orderType,
  orderId,
  DBMODEL,
  updateRequest = false,
}) {
  try {
    // No local partner → skip partner QBO sync; only admin sync will run
    if (orderType === "customer" && !order?.salesRepId) {
      console.log(
        "🚀 ~ handlePartnerQboSync ~ No local partner (no salesRepId), skipping partner QBO sync",
      );
      return { saved: true, reason: "no_local_partner" };
    }

    const quickBooksInvoiceIdPartner = order?.quickBooksInvoiceIdPartner;
    console.log(
      "🚀 ~ handlePartnerQboSync ~ quickBooksInvoiceIdPartner:",
      quickBooksInvoiceIdPartner,
    );

    console.log(
      "🚀 ~ handlePartnerQboSync ~ order?.partnerCurrentRealmId:",
      order?.partnerCurrentRealmId,
    );
    if (!(orderType == "customer" && order?.partnerCurrentRealmId)) {
      console.log(
        "🚀 ~ handlePartnerQboSync ~ ORDER IS ALREADY PARTNER ACCOUNT:",
      );
      return { saved: true, reason: "no_partner_realm" };
    }

    const partnerQboCondition = {
      realmId: order?.partnerCurrentRealmId,
      salesRepId: order.salesRepId,
    };

    const customerCondition = {
      ...partnerQboCondition,
      userId: order?.userId,
    };

    const qboCustomerOnPartner = await qboCustomerMap.findOne({
      where: customerCondition,
    });

    if (!qboCustomerOnPartner?.qboCustomerId) {
      console.log("🚀 ~ LOCAL PARTNER QBO CUSTOMER NOT CONNECTED");
      await deleteQboCustomerMappingForUserInRealm({
        realmId: order?.partnerCurrentRealmId,
        salesRepId: order?.salesRepId,
        userId: order?.userId,
      });
      return { saved: false, reason: "partner_qbo_customer_not_connected" };
    }

    order.qboCustomerId = qboCustomerOnPartner?.qboCustomerId;

    const { accessToken, realmId } = await refreshAccessTokenIfNeeded({
      condition: partnerQboCondition,
    });
    console.log("🚀 ~ handlePartnerQboSync ~ accessToken:", accessToken);
    console.log("🚀 ~ handlePartnerQboSync ~ realmId:", realmId);
    console.log(
      "🚀 ~ handlePartnerQboSync ~ quickBooksInvoiceIdPartner:",
      quickBooksInvoiceIdPartner,
    );
    if (accessToken && realmId && !quickBooksInvoiceIdPartner) {
      const partnerQboInvoice = await createQboInvoice({
        order,
        accessToken,
        realmId,
        subtractSalerCommission: false,
      });

      updateOrderRecord({
        orderId,
        input: {
          quickBooksInvoiceIdPartner: partnerQboInvoice?.invoiceId,
          partnerRealmId: realmId,
        },
        MODEL: DBMODEL,
      });

      if (!order.quickBooksPaymentIdPartner && order?.paymentStatus == "done") {
        const partnerQboPayment = await createQboPayment({
          order,
          invoiceId: partnerQboInvoice?.invoiceId,
          accessToken,
          realmId,
          qboCustomerId: qboCustomerOnPartner?.qboCustomerId,
          subtractLocalPartnerCommission: false,
        });

        updateOrderRecord({
          orderId,
          input: {
            quickBooksPaymentIdPartner: partnerQboPayment?.paymentId,
          },
          MODEL: DBMODEL,
        });
      }
      return { saved: true, reason: "partner_invoice_created" };
    }
    if (accessToken && realmId && quickBooksInvoiceIdPartner && updateRequest) {
      console.log("🚀 ~ LOCAL PARTNER QBO UPDATE ORDER", orderId);
      await updateInvoiceInQuickBooks({
        accessToken,
        realmId,
        order,
        qboInvoiceId: quickBooksInvoiceIdPartner,
        MODEL: DBMODEL,
        subtractSalerCommission: false,
      });
      return { saved: true, reason: "partner_invoice_updated" };
    }
    if (quickBooksInvoiceIdPartner) {
      return { saved: true, reason: "partner_invoice_already_exists" };
    }
    return { saved: false, reason: "partner_qbo_token_or_realm_missing" };
  } catch (err) {
    handleQboError({
      err: err,
      context: `🔥 ERROR in handlePartnerQboSync:`,
    });
    await deleteStaleQboCustomerMappingIfNeeded(
      err,
      order?.partnerCurrentRealmId,
      order?.qboCustomerId,
    );
    return {
      saved: false,
      reason: getQboErrorMessage(err) || "partner_sync_error",
    };
  }
}

// ---- Invoice creation ----
async function createInvoiceFromOrder({
  orderId,
  orderType = "customer",
  updateRequest = false,
}) {
  if (!orderId) throw new Error("Missing orderId");

  const DBMODEL = orderType === "local-partner" ? PartnerOrder : Order;
  const order = await getOrderWithAssociations({ orderId, orderType });
  if (!order) throw new Error(`Order not found id=${orderId}`);

  let ADMIN = await account.findOne({});

  // -------------------------------
  // 🔹 ADMIN SYNC
  // -------------------------------
  const adminResult = await handleAdminQboSync({
    order,
    orderType,
    orderId,
    ADMIN,
    DBMODEL,
    updateRequest,
  });

  // -------------------------------
  // 🔹 PARTNER SYNC
  // -------------------------------
  const partnerResult = await handlePartnerQboSync({
    order,
    orderType,
    orderId,
    DBMODEL,
    updateRequest,
  });

  const neededAdminSync =
    orderType === "customer" &&
    !order.quickBooksInvoiceId &&
    ADMIN?.currentRealmId &&
    !shouldSkipAdminQboSync({ orderType, order });
  const neededPartnerSync =
    orderType === "customer" &&
    order?.partnerCurrentRealmId &&
    !order?.quickBooksInvoiceIdPartner;
  const adminFailed = neededAdminSync && !adminResult.saved;
  const partnerFailed = neededPartnerSync && !partnerResult.saved;

  if (adminFailed || partnerFailed) {
    const reasons = [];
    if (adminFailed) reasons.push(adminResult.reason || "admin sync failed");
    if (partnerFailed)
      reasons.push(partnerResult.reason || "partner sync failed");
    throw new Error(`No QuickBooks ID saved: ${reasons.join("; ")}`);
  }

  return {
    message: `Quickbooks inovice sync success for order #${orderId}`,
  };
}

/**
 * Update existing **admin** QBO invoices only (no partner QBO, no create).
 * Orders without `quickBooksInvoiceId` are skipped.
 *
 * @param {Object} opts
 * @param {number[]} opts.orderIds
 * @param {'customer'|'local-partner'} [opts.orderType='customer']
 */
async function updateAdminQboInvoicesForOrders({
  orderIds,
  orderType = "customer",
} = {}) {
  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error("orderIds must be a non-empty array");
  }

  const numericIds = [
    ...new Set(
      orderIds
        .map((id) => Number(id))
        .filter((n) => !Number.isNaN(n) && n > 0),
    ),
  ];
  if (numericIds.length === 0) {
    throw new Error("orderIds must contain valid numeric ids");
  }

  const DBMODEL = orderType === "local-partner" ? PartnerOrder : Order;
  const ADMIN = await account.findOne({});

  const orders = await getOrdersWithAssociations({
    orderIds: numericIds,
    orderType,
  });
  const foundIdSet = new Set(orders.map((o) => o.id));
  const ordersNotFound = numericIds.filter((id) => !foundIdSet.has(id));

  const updatedOrderIds = [];
  const failed = [];
  const skipped = [];

  for (const ord of orders) {
    if (
      !ord.quickBooksInvoiceId ||
      String(ord.quickBooksInvoiceId).trim() === ""
    ) {
      skipped.push({ orderId: ord.id, reason: "no_admin_invoice" });
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }

    const adminResult = await handleAdminQboSync({
      order: ord,
      orderType,
      orderId: ord.id,
      ADMIN,
      DBMODEL,
      updateRequest: true,
    });

    if (adminResult.saved && adminResult.reason === "admin_invoice_updated") {
      updatedOrderIds.push(ord.id);
    } else if (adminResult.saved) {
      skipped.push({
        orderId: ord.id,
        reason: adminResult.reason || "skipped",
      });
    } else {
      failed.push({
        orderId: ord.id,
        reason: adminResult.reason || "admin_update_failed",
      });
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  return {
    orderType,
    updatedOrderIds,
    failed,
    skipped,
    ordersNotFound,
    summary: {
      updated: updatedOrderIds.length,
      failed: failed.length,
      skipped: skipped.length,
      ordersNotFound: ordersNotFound.length,
      totalRequested: numericIds.length,
    },
  };
}

// ---- Bulk Invoice creation ----
async function createMultipleInvoicesFromOrders({
  orderIds,
  orderType = "customer",
  updateRequest = false,
}) {
  console.log("🚀 ~ createMultipleInvoicesFromOrders ~ orderIds:", orderIds);
  console.log("🚀 ~ createMultipleInvoicesFromOrders ~ orderType:", orderType);

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error("orderIds must be a non-empty array");
  }

  const DBMODEL = orderType === "local-partner" ? PartnerOrder : Order;

  // Fetch all orders at once
  const orders = await getOrdersWithAssociations({ orderIds, orderType });

  if (!orders || orders.length === 0) {
    throw new Error(`No orders found for the provided IDs`);
  }

  console.log(`🚀 ~ Processing ${orders.length} orders for QBO sync`);

  // Get ADMIN account once
  let ADMIN = await account.findOne({});

  // Initialize results tracking
  const results = [];
  let successCount = 0;
  let failureCount = 0;

  // Loop through each order and process
  for (const order of orders) {
    try {
      console.log(`\n🔄 Processing Order #${order.id}...`);

      // -------------------------------
      // 🔹 ADMIN SYNC
      // -------------------------------
      const adminResult = await handleAdminQboSync({
        order,
        orderType,
        orderId: order.id,
        ADMIN,
        DBMODEL,
        updateRequest,
      });

      // -------------------------------
      // 🔹 PARTNER SYNC
      // -------------------------------
      const partnerResult = await handlePartnerQboSync({
        order,
        orderType,
        orderId: order.id,
        DBMODEL,
        updateRequest,
      });

      // Only count as success if we actually saved an ID (or already had one)
      const neededAdminSync =
        orderType === "customer" &&
        !order.quickBooksInvoiceId &&
        ADMIN?.currentRealmId &&
        !shouldSkipAdminQboSync({ orderType, order });
      const neededPartnerSync =
        orderType === "customer" &&
        order?.partnerCurrentRealmId &&
        !order?.quickBooksInvoiceIdPartner;

      const adminFailed = neededAdminSync && !adminResult.saved;
      const partnerFailed = neededPartnerSync && !partnerResult.saved;

      if (adminFailed || partnerFailed) {
        const reasons = [];
        if (adminFailed)
          reasons.push(adminResult.reason || "admin sync failed");
        if (partnerFailed)
          reasons.push(partnerResult.reason || "partner sync failed");
        const failMessage =
          reasons.length > 0
            ? `No QuickBooks ID saved: ${reasons.join("; ")}`
            : `Failed to sync order #${order.id}`;
        console.error(`❌ Order #${order.id} failed:`, failMessage);
        results.push({
          orderId: order.id,
          status: "failed",
          message: failMessage,
          error: adminResult.reason || partnerResult.reason,
        });
        failureCount++;
      } else {
        results.push({
          orderId: order.id,
          status: "success",
          message: `QuickBooks invoice sync successful for order #${order.id}`,
        });
        successCount++;
        console.log(`✅ Order #${order.id} processed successfully`);
      }
    } catch (error) {
      // Failure - log error but continue processing other orders
      console.error(`❌ Order #${order.id} failed:`, error.message);
      results.push({
        orderId: order.id,
        status: "failed",
        message: `Failed to sync order #${order.id}`,
        error: error.message,
      });
      failureCount++;
    }
  }

  // Return summary
  const summary = {
    total: orders.length,
    successCount,
    failureCount,
    results,
    message: `Bulk invoice sync completed: ${successCount} succeeded, ${failureCount} failed out of ${orders.length} total orders`,
  };

  console.log("\n📊 Bulk Invoice Sync Summary:", summary);
  return summary;
}

module.exports = {
  createInvoiceFromOrder,
  createMultipleInvoicesFromOrders,
  updateAdminQboInvoicesForOrders,
  createPaymentForInvoice,
  mapPaymentMethodName,
  createQboPayment,
};
