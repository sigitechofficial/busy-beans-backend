// services/qboInvoiceSyncService.js
const axios = require("axios");
const { refreshAccessTokenIfNeeded } = require("./qboTokenService");
const { getOrderWithAssociations } = require("./orderService");
const { warmupQBOResources } = require("./qboItemService");
const { handleQboError } = require("./qboErrorHandler");
const { order, partnerOrder } = require("../models");
const Order = order;
const PartnerOrder = partnerOrder;
const BASE =
  (process.env.QBO_ENV || "").toLowerCase() === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
const QBO = (realmId) => `${BASE}/v3/company/${realmId}`;
const MINOR = 70;

/**
 * Find Sales Rep custom field DefinitionId by querying existing invoices
 * This finds the DefinitionId from an invoice that already has the Sales Rep field populated
 */
async function findSalesRepCustomFieldDefinitionId({ accessToken, realmId }) {
  try {
    // Query for invoices that have custom fields
    const queryUrl = `${QBO(realmId)}/query?query=SELECT * FROM Invoice MAXRESULTS 10&minorversion=${MINOR}`;
    const response = await axios.get(queryUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      validateStatus: () => true,
    });

    if (response?.data?.QueryResponse?.Invoice) {
      const invoices = Array.isArray(response.data.QueryResponse.Invoice)
        ? response.data.QueryResponse.Invoice
        : [response.data.QueryResponse.Invoice];

      // Look through invoices for one with a custom field that has a value
      for (const invoice of invoices) {
        if (invoice?.CustomField) {
          const customFields = Array.isArray(invoice.CustomField)
            ? invoice.CustomField
            : [invoice.CustomField];

          // If we find a custom field with a StringValue, it's likely the Sales Rep field
          // (since the user manually created it and it's a text field)
          const salesRepField = customFields.find(f => f.StringValue && f.DefinitionId);
          
          if (salesRepField?.DefinitionId) {
            console.log(`✅ [QBO] Found Sales Rep custom field DefinitionId: ${salesRepField.DefinitionId} from existing invoice`);
            return salesRepField.DefinitionId;
          }
        }
      }
    }

    console.log("⚠️ [QBO] Could not find Sales Rep custom field DefinitionId from existing invoices");
    return null;
  } catch (err) {
    console.warn("⚠️ [QBO] Error finding Sales Rep custom field DefinitionId:", err.message);
    return null;
  }
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
      }
    );

    if (response?.data?.data?.appFoundationsCustomFieldDefinitions) {
      const customFields = response.data.data.appFoundationsCustomFieldDefinitions;
      
      // Look for "Sales Rep" field (case-insensitive)
      const salesRepField = customFields.find(
        (field) =>
          field.name &&
          (field.name.toLowerCase() === "sales rep" ||
            field.name.toLowerCase() === "salesrep" ||
            field.name.toLowerCase() === "local partner")
      );

      if (salesRepField?.legacyIdV2) {
        console.log(
          `✅ [QBO] Found Sales Rep custom field: ${salesRepField.name} (DefinitionId: ${salesRepField.legacyIdV2})`
        );
        return salesRepField.legacyIdV2;
      }
    }

    console.log("⚠️ [QBO] Sales Rep custom field not found via GraphQL query");
    return null;
  } catch (err) {
    console.warn(
      "⚠️ [QBO] Error querying custom field definitions:",
      err.message
    );
    // GraphQL might not be available or scopes missing - that's okay, we'll use fallback
    return null;
  }
}

/**
 * Create Sales Rep custom field in QBO if it doesn't exist
 * Uses GraphQL API to create custom field definition
 */
async function createSalesRepCustomField({ accessToken, realmId }) {
  try {
    console.log("🔧 [QBO] Creating Sales Rep custom field...");
    
    // GraphQL endpoint for custom field definitions
    const graphqlUrl = "https://qb.api.intuit.com/graphql";
    
    const mutation = `
      mutation {
        appFoundationsCreateCustomFieldDefinition(
          input: {
            name: "Sales Rep"
            type: StringType
          }
        ) {
          customFieldDefinition {
            id
            name
            type
            legacyIdV2
          }
          errors {
            message
            code
          }
        }
      }
    `;

    const response = await axios.post(
      graphqlUrl,
      { query: mutation },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        validateStatus: () => true, // Don't throw on error
      }
    );

    // Log full response for debugging
    console.log("🔍 [QBO] GraphQL Custom Field Creation Response:", {
      status: response.status,
      statusText: response.statusText,
      data: JSON.stringify(response.data, null, 2),
    });

    // Check for errors in response
    if (response?.data?.errors) {
      console.warn("⚠️ [QBO] GraphQL errors:", JSON.stringify(response.data.errors, null, 2));
    }

    if (response?.data?.data?.appFoundationsCreateCustomFieldDefinition?.customFieldDefinition) {
      const createdField = response.data.data.appFoundationsCreateCustomFieldDefinition.customFieldDefinition;
      
      if (createdField?.legacyIdV2) {
        console.log(
          `✅ [QBO] Created Sales Rep custom field: ${createdField.name} (DefinitionId: ${createdField.legacyIdV2})`
        );
        return createdField.legacyIdV2;
      }
    }

    // Check for mutation errors
    if (response?.data?.data?.appFoundationsCreateCustomFieldDefinition?.errors) {
      const errors = response.data.data.appFoundationsCreateCustomFieldDefinition.errors;
      console.warn("⚠️ [QBO] Custom field creation errors:", JSON.stringify(errors, null, 2));
      
      // If field already exists error, try to find it
      if (errors.some(e => e.message?.toLowerCase().includes("already exists") || 
                          e.message?.toLowerCase().includes("duplicate"))) {
        console.log("⚠️ [QBO] Custom field may already exist, trying to find it...");
        return await getSalesRepCustomFieldDefinitionId({ accessToken, realmId });
      }
    }

    console.log("⚠️ [QBO] Failed to create Sales Rep custom field - Full response:", JSON.stringify(response.data, null, 2));
    return null;
  } catch (err) {
    console.warn(
      "⚠️ [QBO] Error creating custom field definition:",
      err.message,
      err.response?.data
    );
    return null;
  }
}

/**
 * Get or Create Sales Rep custom field DefinitionId
 * First tries to find existing field, if not found creates it
 */
async function getOrCreateSalesRepCustomField({ accessToken, realmId }) {
  // First, try to find existing field
  let definitionId = await getSalesRepCustomFieldDefinitionId({ accessToken, realmId });
  
  // If not found, create it
  if (!definitionId) {
    console.log("🔧 [QBO] Sales Rep custom field not found, creating new one...");
    definitionId = await createSalesRepCustomField({ accessToken, realmId });
  }
  
  return definitionId;
}

/**
 * Build QBO Invoice Payload (Lines + Shipping + Sparse Payload)
 * Does NOT send to QBO — only PREPARES the payload.
 * Now async to support custom field creation
 */
async function buildQboInvoiceUpdatePayload({
  order,
  qboInvoiceId,
  syncToken,
  productItemId,
  serviceItemId,
  shippingItemId,
  accessToken = null,
  realmId = null,
}) {
  /* -------------------------------------------------------
      3. Build line items
  --------------------------------------------------------*/
  const Lines = [];

  for (const it of order.items || []) {
    const qty = Number(it.qty || 1);

    // CRITICAL: DB stores total price (after discounts), not unit price
    // QBO requires: Amount = UnitPrice * Qty (exact match, no rounding differences)
    // Strategy: Calculate unitPrice from DB total, then recalculate amount to ensure exact match
    let amount;
    let unitPrice;

    // Get the line total from DB (this is the actual charged amount after discounts)
    const totalNum = Number(it.total || it.price || 0);

    if (it.wholesalePrice && qty > 0) {
      // If wholesalePrice exists, use it as unit price (most reliable)
      unitPrice = Number(it.wholesalePrice);
      // Calculate amount from unitPrice to ensure exact match
      amount = Math.round(unitPrice * qty * 100) / 100;
    } else if (totalNum > 0 && qty > 0) {
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
    } else {
      amount = 0;
      unitPrice = 0;
    }

    // Final verification: Amount MUST equal UnitPrice * Qty exactly (QBO requirement)
    const verification = Math.round(unitPrice * qty * 100) / 100;
    if (Math.abs(amount - verification) > 0.0001) {
      // Force exact match - QBO validation requires this
      amount = verification;
    }

    const itemRef = it.productId ? productItemId : serviceItemId;

    Lines.push({
      Amount: amount,
      Description: it.product || it.productName || "Item",
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: { value: String(itemRef) },
        Qty: qty,
        UnitPrice: unitPrice,
        TaxCodeRef: { value: "NON" },
      },
    });
  }

  /* -------------------------------------------------------
      4. Add shipping line
  --------------------------------------------------------*/
  if (Number(order.shippingCharges) > 0) {
    const shipAmt = +Number(order.shippingCharges).toFixed(2);

    Lines.push({
      Amount: shipAmt,
      Description: `Shipping Charges ${order.shippingCompany || "UPS"}`,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: { value: String(shippingItemId) },
        Qty: 1,
        UnitPrice: shipAmt,
        TaxCodeRef: { value: "NON" },
      },
    });
  }

  /* -------------------------------------------------------
      5. Build Sales Rep info - simple, just the name
  --------------------------------------------------------*/
  let salesRepName = null;
  if (order.userId && order.salesRepId && order.salesRepName) {
    salesRepName = order.salesRepName;
  }

  // Get the custom field DefinitionId for "Sales Rep"
  let salesRepDefinitionId = process.env.QBO_SALES_REP_CUSTOM_FIELD_ID || null;
  
  if (!salesRepDefinitionId && salesRepName && accessToken && realmId) {
    try {
      salesRepDefinitionId = await findSalesRepCustomFieldDefinitionId({ accessToken, realmId });
    } catch (err) {
      console.warn("⚠️ [QBO] Could not find Sales Rep custom field DefinitionId:", err.message);
    }
  }

  // Build custom fields array if we have the DefinitionId
  let customFields = [];
  if (salesRepName && salesRepDefinitionId) {
    customFields.push({
      DefinitionId: salesRepDefinitionId,
      StringValue: salesRepName,
    });
    console.log(`✅ [QBO] Adding Sales Rep to custom field: ${salesRepName}`);
  }

  /* -------------------------------------------------------
      6. Build sparse payload
  --------------------------------------------------------*/
  return {
    Id: String(qboInvoiceId),
    SyncToken: syncToken,
    sparse: true,
    CustomerRef: {
      value: String(order.qboCustomerId),
    },
    Line: Lines,
    PrivateNote: order.note || undefined,

    TxnDate: new Date(order.invoiceDate || Date.now())
      .toISOString()
      .slice(0, 10),

    DueDate: new Date(
      new Date(order.invoiceDate || Date.now()).getTime() +
        (order.termDays || 30) * 86400000
    )
      .toISOString()
      .slice(0, 10),

    ShipAddr: order.address
      ? {
          Line1: order.address.addressLineOne,
          City: order.address.city,
          CountrySubDivisionCode: order.address.state,
          PostalCode: order.address.zipCode,
          Country: order.address.country,
        }
      : undefined,

    // Add custom field for Sales Rep
    ...(customFields.length > 0 ? { CustomField: customFields } : {}),
  };
}

/**
 * Update an existing QuickBooks invoice with latest order data.
 * Handles SyncToken versioning and skips if invoice is paid.
 */

async function updateInvoiceInQuickBooks({
  accessToken,
  realmId,
  order,
  qboInvoiceId,
  MODEL = Order,
}) {
  try {
    console.log("🚀 updateInvoiceInQuickBooks:", { orderId: order?.id });
    console.log("🚀 updateInvoiceInQuickBooks:", {
      orderId: order?.qboCustomerId,
    });
    console.log("🚀 ~ updateInvoiceInQuickBooks ~ accessToken:", accessToken);
    console.log("🚀 ~ updateInvoiceInQuickBooks ~ realmId:", realmId);
    console.log("🚀 ~ updateInvoiceInQuickBooks ~ qboInvoiceId:", qboInvoiceId);

    if (!accessToken || !realmId) throw new Error("Missing QBO credentials");
    if (!order) throw new Error("Order not found");
    if (!qboInvoiceId) throw new Error("No QBO invoice linked.");

    /* -------------------------------------------------------
        1. Warmup items
    --------------------------------------------------------*/
    const { productItemId, serviceItemId, shippingItemId } =
      await warmupQBOResources({ accessToken, realmId });

    console.log(
      `🚀 ~ updateInvoiceInQuickBooks ~ { productItemId, serviceItemId, shippingItemId }:`,
      { productItemId, serviceItemId, shippingItemId }
    );
    /* -------------------------------------------------------
        2. Fetch existing invoice
    --------------------------------------------------------*/
    const getUrl = `${QBO(realmId)}/invoice/${qboInvoiceId}?minorversion=${MINOR}`;
    const invRes = await axios.get(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const currentInvoice = invRes?.data?.Invoice;
    if (!currentInvoice)
      throw new Error(`Could not load invoice ${qboInvoiceId}`);

    // Skip if paid
    if (Number(currentInvoice.Balance || 0) === 0) {
      console.log(
        `[QBO] Skipping update — invoice ${qboInvoiceId} already paid.`
      );
      return currentInvoice;
    }

    /* -------------------------------------------------------
        3 + 4 + 5 = Build Sparse Payload via helper
    --------------------------------------------------------*/
    const payload = await buildQboInvoiceUpdatePayload({
      order,
      qboInvoiceId,
      syncToken: currentInvoice.SyncToken,
      productItemId,
      serviceItemId,
      shippingItemId,
      accessToken, // Pass accessToken for custom field creation
      realmId,     // Pass realmId for custom field creation
    });
    console.log("🚀 ~ updateInvoiceInQuickBooks ~ payload:", payload);

    /* -------------------------------------------------------
        6. Send update request
    --------------------------------------------------------*/
    const postUrl = `${QBO(realmId)}/invoice?minorversion=${MINOR}`;
    const res = await axios.post(postUrl, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    /* -------------------------------------------------------
        7. Update DB
    --------------------------------------------------------*/
    await MODEL.update(
      { qboLastSync: new Date() },
      { where: { id: order.id } }
    );

    console.log(`[QBO] ✅ Invoice updated ${qboInvoiceId} =  ${realmId}`);

    return res.data?.Invoice;
  } catch (err) {
    handleQboError({
      err,
      context: "❌ [QBO][UPDATE INVOICE ERROR]:",
    });
    // throw err;
  }
}

module.exports = { updateInvoiceInQuickBooks };

// async function updateInvoiceInQuickBooks({ orderId, orderType = "customer" }) {
//   console.log("🚀 updateInvoiceInQuickBooks:", { orderId, orderType });

//   // ✅ Step 1: Get access token
//   const { accessToken, realmId } = await refreshAccessTokenIfNeeded();
//   if (!accessToken || !realmId) throw new Error("Missing QBO credentials");

//   // ✅ Step 2: Warm up all item types ONCE
//   // ✅ Step 2: Get all item IDs at once
//   const { productItemId, serviceItemId, shippingItemId } =
//     await warmupQBOResources({ accessToken, realmId });

//   // ✅ Step 3: Load order
//   const ord = await getOrderWithAssociations({ orderId, orderType });
//   if (!ord) throw new Error(`Order not found with id=${orderId}`);
//   if (!ord.quickBooksInvoiceId)
//     throw new Error("No QuickBooks invoice linked with this order.");

//   const invoiceId = ord.quickBooksInvoiceId;

//   // ✅ Step 4: Fetch current invoice (to get SyncToken)
//   const getUrl = `${QBO(realmId)}/invoice/${invoiceId}?minorversion=${MINOR}`;
//   const invRes = await axios.get(getUrl, {
//     headers: { Authorization: `Bearer ${accessToken}` },
//   });

//   const currentInvoice = invRes?.data?.Invoice;
//   if (!currentInvoice)
//     throw new Error(`Could not load invoice ${invoiceId} from QBO.`);

//   // ✅ Skip updating a paid invoice
//   if (Number(currentInvoice.Balance || 0) === 0) {
//     console.log(
//       `[QBO] Skipping update — invoice ${invoiceId} already paid/completed.`
//     );
//     return currentInvoice;
//   }

//   // ✅ Step 5: Build Line Items (PRODUCT / SERVICE / SHIPPING)
//   const Lines = [];

//   for (const it of ord.items || []) {
//     const qty = Number(it.qty || 1);
//     const amount = +Number(it.price || it.total || 0).toFixed(2);
//     const unitPrice = +(amount / qty).toFixed(2);

//     // ✅ Choose the correct ItemRef
//     let itemRef = serviceItemId; // default

//     if (it.productId)
//       itemRef = productItemId; // Product line
//     else itemRef = serviceItemId; // Service line

//     Lines.push({
//       Amount: amount,
//       Description: it.product || it.productName || "Item",
//       DetailType: "SalesItemLineDetail",
//       SalesItemLineDetail: {
//         ItemRef: { value: String(itemRef) },
//         Qty: qty,
//         UnitPrice: unitPrice,
//         TaxCodeRef: { value: "NON" },
//       },
//     });
//   }

//   // ✅ Step 6: Add Shipping Line
//   if (Number(ord.shippingCharges) > 0) {
//     const shipAmt = +Number(ord.shippingCharges).toFixed(2);

//     Lines.push({
//       Amount: shipAmt,
//       Description: `Shipping Charges ${ord.shippingCompany || "UPS"}`,
//       DetailType: "SalesItemLineDetail",
//       SalesItemLineDetail: {
//         ItemRef: { value: String(shippingItemId) },
//         Qty: 1,
//         UnitPrice: shipAmt,
//         TaxCodeRef: { value: "NON" },
//       },
//     });
//   }

//   // ✅ Step 7: Build sparse update payload
//   const payload = {
//     Id: String(invoiceId),
//     SyncToken: currentInvoice.SyncToken,
//     sparse: true,
//     Line: Lines,

//     PrivateNote: ord.note || undefined,

//     TxnDate: new Date(ord.invoiceDate || Date.now()).toISOString().slice(0, 10),

//     DueDate: new Date(Date.now() + (ord.termDays || 30) * 86400000)
//       .toISOString()
//       .slice(0, 10),

//     ShipAddr: ord.address
//       ? {
//           Line1: ord.address.addressLineOne,
//           City: ord.address.city,
//           CountrySubDivisionCode: ord.address.state,
//           PostalCode: ord.address.zipCode,
//           Country: ord.address.country,
//         }
//       : undefined,
//   };

//   // ✅ Step 8: Send update request
//   const postUrl = `${QBO(realmId)}/invoice?minorversion=${MINOR}`;
//   const res = await axios.post(postUrl, payload, {
//     headers: {
//       Authorization: `Bearer ${accessToken}`,
//       Accept: "application/json",
//       "Content-Type": "application/json",
//     },
//   });

//   // ✅ Step 9: Update DB timestamp
//   const DBMODEL = orderType === "local-partner" ? PartnerOrder : Order;

//   await DBMODEL.update({ qboLastSync: new Date() }, { where: { id: orderId } });

//   console.log(`[QBO] ✅ Invoice updated ${invoiceId}`, {
//     total: res.data?.Invoice?.TotalAmt,
//   });

//   return res.data?.Invoice;
// }
