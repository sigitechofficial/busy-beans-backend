# QuickBooks Online: Sales Rep Custom Field on Invoices

## The issue

We wanted the **Sales Rep** (Local Partner) name to appear in the **Sales Rep** custom field on invoices in QuickBooks Online, instead of only in PONumber or not at all.

### What we had

- **Custom field in QBO:** A "Sales Rep" custom field exists in QuickBooks (Customer category, enabled for Invoices).
- **DefinitionId:** We obtained the correct DefinitionId from an existing invoice (e.g. `1000000002`) and set it in `.env`:
  - `QBO_SALES_REP_CUSTOM_FIELD_ID=1000000002`
- **Payload:** The app was already sending the custom field when creating invoices:
  - `CustomField: [ { DefinitionId: '1000000002', StringValue: 'Joe Argyle' } ]`
  - Request used `minorversion=75` when custom fields were present.

### What was wrong

- **Symptom:** In the backend logs, the value was clearly passed (e.g. "Joe Argyle") and the invoice was created successfully in QBO (e.g. Invoice Id 217).
- **In QuickBooks UI:** The Sales Rep field on that invoice stayed **empty**.
- So: the API accepted the request and created the invoice, but the custom field value was **not persisted** and did not show on the invoice.

### Root cause

The QuickBooks API only **processes and stores** custom fields on invoice **create** when the request explicitly asks for custom-field handling. Sending `CustomField` in the body alone was not enough; the **write** request also had to use the same opt-in parameter used for **reading** custom fields.

- For **GET** invoice: we already had to use `include=enhancedAllCustomFields` to get `CustomField` in the response.
- For **POST** (create) invoice: we were not using that parameter, so QBO accepted the payload but did not apply the custom field values to the stored invoice.

So the issue was not the DefinitionId or the payload shape; it was the **missing query parameter on the create endpoint**.

---

## What we did to fix it

### 1. Add `include=enhancedAllCustomFields` to the invoice create URL

**File:** `services/qboInvoice.js`

When creating an invoice **with** custom fields, we changed the POST URL from:

- **Before:**  
  `POST /v3/company/{realmId}/invoice?minorversion=75`
- **After:**  
  `POST /v3/company/{realmId}/invoice?minorversion=75&include=enhancedAllCustomFields`

So for any request that includes a `CustomField` array (e.g. Sales Rep), we now call the create endpoint with both:

- `minorversion=75`
- `include=enhancedAllCustomFields`

**Result:** The Sales Rep value is stored and appears in the Sales Rep custom field on the invoice in QuickBooks.

### 2. (Optional) Sales Rep value format: name + territory

We already built the value as **"Sales Rep Name (Territory Name)"** in `qboInvoice.js`. For **bulk** invoice sync, `territoryName` was missing from the order query, so only the name appeared. We added `territoryName` to `getOrdersWithAssociations` in `services/orderService.js` so that bulk-created invoices also get the full format, e.g. **"Joe Argyle (TerritoryName)"**.

---

## Summary

| Item | Before | After |
|------|--------|--------|
| DefinitionId in .env | Set (e.g. 1000000002) | Same |
| CustomField in payload | Sent correctly | Same |
| Create URL | `?minorversion=75` | `?minorversion=75&include=enhancedAllCustomFields` |
| Sales Rep on invoice in QBO | Empty | Shows value (e.g. "Joe Argyle" or "Joe Argyle (Territory)") |

**Takeaway:** For QBO invoice **create**, custom fields are only applied when the create request uses `include=enhancedAllCustomFields`. Adding the DefinitionId in `.env` was necessary but not sufficient until we added this parameter to the POST URL.
