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

const Order = order;
const PartnerOrder = partnerOrder;
const BASE =
  (process.env.QBO_ENV || "").toLowerCase() === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
const QBO = (realmId) => `${BASE}/v3/company/${realmId}`;
const MINOR = 70;

// ---- Generic helpers ----
const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/json",
  "Content-Type": "application/json",
});

// =========================
// 🔹 Helpers
// =========================

/**
 * Normalize a raw payment method name to a QBO-friendly label
 */
function mapPaymentMethodName(name = "") {
  name = name.toLowerCase();

  if (name.includes("card") && name.includes("credit")) return "Credit Card";
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
    (a) => a.Name?.toLowerCase() === "undeposited funds"
  );
  if (undeposited) return undeposited.Id;

  // 2️⃣ Otherwise pick any “Bank” account
  const bank = accounts.find(
    (a) => a.AccountType && a.AccountType.toLowerCase() === "bank"
  );
  if (bank) return bank.Id;

  // 3️⃣ Otherwise pick any usable asset account
  const asset = accounts.find(
    (a) =>
      a.AccountType &&
      ["other current assets", "accounts receivable"].includes(
        a.AccountType.toLowerCase()
      )
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
      `select * from PaymentMethod where Name='${name}'`
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
    const payload = {
      Name: name,
      Type: name === "Credit Card" ? "CREDIT_CARD" : "OTHER",
      Active: true,
    };
    const createRes = await axios.post(
      `${QBO(realmId)}/paymentmethod`,
      payload,
      {
        headers: headers(accessToken),
      }
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
      `Invoice ${invoiceId} does not exist in QBO realm ${realmId}`
    );
  }

  if (String(inv.CustomerRef?.value) !== String(customerId)) {
    throw new Error(
      `Invoice ${invoiceId} belongs to customer ${inv.CustomerRef.value}, not ${customerId}`
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
    paidDate && !isNaN(Date.parse(paidDate)) ? paidDate : Date.now()
  )
    .toISOString()
    .slice(0, 10);

  // Check if invoice is already paid - return existing payment ID if found
  if (Number(inv.Balance) <= 0) {
    console.log(
      `⚠️ [QBO] Invoice ${invoiceId} is already paid or closed. Checking for existing payment...`
    );

    // QBO doesn't support querying payments by LinkedTxn.TxnId directly
    // Method: Query payments by customer, then filter in code by LinkedTxn
    try {
      console.log("🔍 [QBO] Querying payments by customer...");

      // Query payments for this customer (QBO syntax: CustomerRef = 'customerId')
      const query = `select Id, TotalAmt, TxnDate, LinkedTxn from Payment where CustomerRef = '${String(customerId)}'`;
      const queryUrl = `${QBO(realmId)}/query?query=${encodeURIComponent(query)}&minorversion=${MINOR}`;
      const queryRes = await axios.get(queryUrl, {
        headers: headers(accessToken),
        validateStatus: () => true,
      });

      console.log("🔍 [QBO] Payment query response:", {
        status: queryRes?.status,
        hasData: !!queryRes?.data,
        error: queryRes?.data?.Fault?.Error?.[0]?.Message,
        errorDetail: queryRes?.data?.Fault?.Error?.[0]?.Detail,
        payments: queryRes?.data?.QueryResponse?.Payment?.length || 0,
      });

      // Check for errors
      if (queryRes?.status === 400 || queryRes?.data?.Fault) {
        console.warn(
          "⚠️ [QBO] Payment query failed, cannot find existing payment"
        );
      } else if (queryRes?.data?.QueryResponse?.Payment) {
        // Query succeeded - filter payments
        const payments = Array.isArray(queryRes.data.QueryResponse.Payment)
          ? queryRes.data.QueryResponse.Payment
          : [queryRes.data.QueryResponse.Payment];

        console.log(
          `🔍 [QBO] Found ${payments.length} payments for customer, filtering by invoice ${invoiceId}...`
        );

        // Log all payments' LinkedTxn for debugging
        payments.forEach((p, idx) => {
          console.log(`🔍 [QBO] Payment ${idx + 1} (ID: ${p.Id}):`, {
            totalAmt: p.TotalAmt,
            txnDate: p.TxnDate,
            linkedTxn: p.LinkedTxn,
            linkedTxnType: typeof p.LinkedTxn,
            linkedTxnIsArray: Array.isArray(p.LinkedTxn),
          });
        });

        // Filter payments to find one linked to this invoice
        const matchingPayment = payments.find((p) => {
          if (!p.LinkedTxn) {
            console.log(`⚠️ [QBO] Payment ${p.Id} has no LinkedTxn`);
            return false;
          }

          // Handle different LinkedTxn structures
          let linkedTxns = [];
          if (Array.isArray(p.LinkedTxn)) {
            linkedTxns = p.LinkedTxn;
          } else if (p.LinkedTxn && typeof p.LinkedTxn === "object") {
            // Might be a single object or wrapped differently
            linkedTxns = [p.LinkedTxn];
          }

          console.log(
            `🔍 [QBO] Checking payment ${p.Id}, linkedTxns:`,
            JSON.stringify(linkedTxns, null, 2)
          );

          const matches = linkedTxns.some((lt) => {
            // Try different possible field names
            const txnId = String(
              lt?.TxnId || lt?.TxnID || lt?.Id || lt?.value || ""
            );
            const txnType = String(lt?.TxnType || lt?.Type || "");
            const matches =
              txnId === String(invoiceId) && txnType === "Invoice";

            if (matches) {
              console.log(
                `✅ [QBO] Found match! Payment ${p.Id} linked to invoice ${invoiceId}`
              );
            } else {
              console.log(
                `🔍 [QBO] Payment ${p.Id} - TxnId: ${txnId}, TxnType: ${txnType}, Looking for: ${invoiceId}`
              );
            }

            return matches;
          });

          return matches;
        });

        if (matchingPayment?.Id) {
          console.log(
            `✅ [QBO] Found existing payment ${matchingPayment.Id} for invoice ${invoiceId}`
          );
          return {
            id: matchingPayment.Id,
            totalAmt: matchingPayment.TotalAmt,
            txnDate: matchingPayment.TxnDate || safeDate,
            raw: matchingPayment,
            isExisting: true,
          };
        } else {
          console.log(
            `⚠️ [QBO] Found ${payments.length} payments for customer but none linked to invoice ${invoiceId}`
          );
          // Try alternative: check if any payment has matching amount and date
          const amountMatch = payments.find(
            (p) => Math.abs(Number(p.TotalAmt) - safeAmount) < 0.01
          );
          if (amountMatch) {
            console.log(
              `⚠️ [QBO] Found payment ${amountMatch.Id} with matching amount (${amountMatch.TotalAmt}) but LinkedTxn doesn't match invoice ${invoiceId}`
            );
            console.log(
              `🔍 [QBO] This payment's LinkedTxn:`,
              JSON.stringify(amountMatch.LinkedTxn, null, 2)
            );
          }
        }
      }
    } catch (findErr) {
      console.warn(
        `⚠️ [QBO] Error in payment query:`,
        findErr.message,
        findErr.response?.data?.Fault?.Error?.[0]
      );
    }

    // Method 3: Check if invoice has payment info in its response
    // Sometimes QBO includes payment references in the invoice
    if (inv?.PaymentRefNum || inv?.PaymentId) {
      console.log(
        `ℹ️ [QBO] Invoice has payment reference but couldn't query payment directly`
      );
    }

    // Invoice is paid but no payment found - return early without error
    console.log(
      `ℹ️ [QBO] Invoice ${invoiceId} is already paid, skipping payment creation`
    );
    return {
      id: null,
      totalAmt: 0,
      txnDate: safeDate,
      isExisting: false,
      skipped: true,
    };
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
          (lt) => lt?.TxnId === String(invoiceId) && lt?.TxnType === "Invoice"
        );
      });

      if (existingPayment?.Id) {
        console.log(
          `✅ [QBO] Payment already exists for invoice ${invoiceId}: ${existingPayment.Id}`
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
      preCheckErr.message
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
      `⚠️ [QBO] PaymentRefNum too long (${safeRefNumber.length} chars), truncating to 21 characters`
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
      { headers: headers(accessToken) }
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
        "⚠️ [QBO] Duplicate payment detected, finding existing payment..."
      );

      try {
        // Query QBO to find existing payment for this invoice
        const query = encodeURIComponent(
          `select Id, TotalAmt from Payment where Any(LinkedTxn.TxnId) = '${String(invoiceId)}' and Any(LinkedTxn.TxnType) = 'Invoice'`
        );
        const queryUrl = `${QBO(realmId)}/query?query=${query}&minorversion=${MINOR}`;
        const queryRes = await axios.get(queryUrl, {
          headers: headers(accessToken),
          validateStatus: () => true,
        });

        const existingPayment = queryRes?.data?.QueryResponse?.Payment?.[0];
        if (existingPayment?.Id) {
          console.log(
            `✅ [QBO] Found existing payment ${existingPayment.Id} for invoice ${invoiceId}`
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
          findErr.message
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
}) {
  try {
    console.log("⚡ [QBO] Creating Payment for invoice:", invoiceId);

    const paymentRes = await createPaymentForInvoice({
      accessToken,
      realmId,
      invoiceId,
      customerId: qboCustomerId || order.qboCustomerId,
      amount: order.totalBill,
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
        `ℹ️ [QBO] Payment skipped - invoice already paid but payment not found: ${paymentRes.note || ""}`
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

async function createQboInvoice({ order, accessToken, realmId }) {
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

      // Get the line total from DB (this is the actual charged amount after discounts)
      const totalNum = Number(it.total || it.price || 0);

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
      } else if (it.wholesalePrice && qty > 0) {
        // Fallback: If DB total not available, use wholesalePrice as unit price
        unitPrice = Number(it.wholesalePrice);
        // Calculate amount from unitPrice to ensure exact match
        amount = Math.round(unitPrice * qty * 100) / 100;
        // Round unitPrice to 8 decimal places
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

    // Build PrivateNote - include Local Partner info if both userId and salesRepId exist
    let privateNote = order.note || "";
    if (order.userId && order.salesRepId) {
      const salesRepName = order.salesRepName || "";
      const territoryName = order.territoryName || "";
      const localPartnerInfo = `Local Partner: ${salesRepName}${territoryName ? ` (${territoryName})` : ""}`;
      if (privateNote) {
        privateNote = `${privateNote}\n${localPartnerInfo}`;
      } else {
        privateNote = localPartnerInfo;
      }
    }

    payload = {
      CustomerRef: { value: String(order.qboCustomerId) },
      Line: Lines,
      TxnDate: new Date(order.invoiceDate || Date.now())
        .toISOString()
        .slice(0, 10),
      DueDate: new Date(
        new Date(order.invoiceDate || Date.now()).getTime() +
          (order.termDays || 30) * 86400000
      )
        .toISOString()
        .slice(0, 10),
      DocNumber: order.invoiceNumber || undefined,
      PrivateNote: privateNote || undefined,
    };

    console.log("⚡ [QBO] Invoice Payload:", payload);

    const invRes = await axios.post(
      `${QBO(realmId)}/invoice?minorversion=${MINOR}`,
      payload,
      { headers: headers(accessToken) }
    );
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
        "⚠️ [QBO] Duplicate document number detected, finding existing invoice..."
      );

      const docNumber = order.invoiceNumber;
      if (!docNumber) {
        console.error(
          "❌ [QBO] Cannot find duplicate invoice - no DocNumber provided"
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
            "🔍 [QBO] TxnId not in error message, querying QBO by DocNumber..."
          );
          const query = encodeURIComponent(
            `select Id, DocNumber from Invoice where DocNumber='${docNumber.replace(/'/g, "''")}'`
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
            `✅ [QBO] Found existing invoice with DocNumber ${docNumber}: ${existingInvoiceId}`
          );
          // Return the existing invoice ID instead of throwing error
          return {
            invoiceId: existingInvoiceId,
            payload: payload || undefined, // payload may be null if error occurred before it was set
            isExisting: true,
          };
        } else {
          console.error(
            `❌ [QBO] Duplicate DocNumber error but could not find existing invoice: ${docNumber}`
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
          findErr.message
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
      { where: { id: orderId } }
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
    if (ADMIN?.currentRealmId) {
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
        qboCustomerOnAdmin?.qboCustomerId
      );
      if (qboCustomerOnAdmin?.qboCustomerId) {
        order.qboCustomerId = qboCustomerOnAdmin.qboCustomerId;

        const { accessToken, realmId } = await refreshAccessTokenIfNeeded({
          condition: adminQboCondition,
        });

        // Skip admin sync if invoice already exists (unless update requested)
        if (order?.quickBooksInvoiceId && !updateRequest) {
          console.log(
            `[QBO] Admin invoice already exists (${order.quickBooksInvoiceId}), skipping admin sync`
          );
        } else if (accessToken && realmId && !order?.quickBooksInvoiceId) {
          // Create admin invoice only if it doesn't exist
          const adminQboInvoice = await createQboInvoice({
            order,
            accessToken,
            realmId,
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
            });

            updateOrderRecord({
              orderId,
              input: { quickBooksPaymentId: adminQboPayment?.paymentId },
              MODEL: DBMODEL,
            });
          }
        } else if (
          accessToken &&
          realmId &&
          order?.quickBooksInvoiceId &&
          updateRequest
        ) {
          console.log("🚀 ~ ADMIN QBO UPDATE ORDER", orderId);

          updateInvoiceInQuickBooks({
            accessToken,
            realmId,
            order,
            qboInvoiceId: order?.quickBooksInvoiceId,
            MODEL: DBMODEL,
          });
          console.log("🚀 ~ ADMIN QBO ACCOUNT NOT CONNECTED");
        }
      } else {
        console.log("🚀 ~ ADMIN QBO CUSTOMER NOT CONNECTED");
      }
    } else {
      console.log(
        "🚀 ~ handlePartnerQboSync ~ LOCAL ADMIN NOT CONNECTED OR  ORDER ALREADY ON QUICK BOOKS:"
      );
    }
  } catch (err) {
    handleQboError({
      err: err,
      context: `🔥 ERROR in handleAdminQboSync:`,
    });
  }
}

// HANDLES INVOICE SYN and PAyment sync On local Partner QBO
async function handlePartnerQboSync({
  order,
  orderType,
  orderId,
  DBMODEL,
  updateRequest = false,
}) {
  try {
    const quickBooksInvoiceIdPartner = order?.quickBooksInvoiceIdPartner;
    console.log(
      "🚀 ~ handlePartnerQboSync ~ quickBooksInvoiceIdPartner:",
      quickBooksInvoiceIdPartner
    );

    console.log(
      "🚀 ~ handlePartnerQboSync ~ order?.partnerCurrentRealmId:",
      order?.partnerCurrentRealmId
    );
    if (orderType == "customer" && order?.partnerCurrentRealmId) {
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

      if (qboCustomerOnPartner?.qboCustomerId) {
        order.qboCustomerId = qboCustomerOnPartner?.qboCustomerId;

        const { accessToken, realmId } = await refreshAccessTokenIfNeeded({
          condition: partnerQboCondition,
        });
        console.log("🚀 ~ handlePartnerQboSync ~ accessToken:", accessToken);

        console.log("🚀 ~ handlePartnerQboSync ~ realmId:", realmId);
        console.log(
          "🚀 ~ handlePartnerQboSync ~ quickBooksInvoiceIdPartner:",
          quickBooksInvoiceIdPartner
        );
        if (accessToken && realmId && !quickBooksInvoiceIdPartner) {
          const partnerQboInvoice = await createQboInvoice({
            order,
            accessToken,
            realmId,
          });

          updateOrderRecord({
            orderId,
            input: {
              quickBooksInvoiceIdPartner: partnerQboInvoice?.invoiceId,
              partnerRealmId: realmId,
            },
            MODEL: DBMODEL,
          });

          if (
            !order.quickBooksPaymentIdPartner &&
            order?.paymentStatus == "done"
          ) {
            const partnerQboPayment = await createQboPayment({
              order,
              invoiceId: partnerQboInvoice?.invoiceId,
              accessToken,
              realmId,
              qboCustomerId: qboCustomerOnPartner?.qboCustomerId,
            });

            updateOrderRecord({
              orderId,
              input: {
                quickBooksPaymentIdPartner: partnerQboPayment?.paymentId,
              },
              MODEL: DBMODEL,
            });
          }
        } else if (
          accessToken &&
          realmId &&
          quickBooksInvoiceIdPartner &&
          updateRequest
        ) {
          console.log("🚀 ~ LOCAL PARTNER QBO UPDATE ORDER", orderId);
          updateInvoiceInQuickBooks({
            accessToken,
            realmId,
            order,
            qboInvoiceId: quickBooksInvoiceIdPartner,
            MODEL: DBMODEL,
          });
        }
      } else {
        console.log("🚀 ~ LOCAL PARTNER QBO CUSTOMER NOT CONNECTED");
      }
    } else {
      console.log(
        "🚀 ~ handlePartnerQboSync ~ ORDER IS ALREADY PARTNER ACCOUNT:"
      );
    }
  } catch (err) {
    handleQboError({
      err: err,
      context: `🔥 ERROR in handlePartnerQboSync:`,
    });
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
  await handleAdminQboSync({
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
  await handlePartnerQboSync({
    order,
    orderType,
    orderId,
    DBMODEL,
    updateRequest,
  });

  return {
    message: `Quickbooks inovice sync success for order #${orderId}`,
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
      await handleAdminQboSync({
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
      await handlePartnerQboSync({
        order,
        orderType,
        orderId: order.id,
        DBMODEL,
        updateRequest,
      });

      // Success
      results.push({
        orderId: order.id,
        status: "success",
        message: `QuickBooks invoice sync successful for order #${order.id}`,
      });
      successCount++;
      console.log(`✅ Order #${order.id} processed successfully`);
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
  createPaymentForInvoice,
  mapPaymentMethodName,
  createQboPayment,
};
