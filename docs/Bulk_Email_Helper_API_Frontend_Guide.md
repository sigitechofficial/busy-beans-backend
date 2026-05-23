# Bulk Email Helper API – Frontend Guide

Send one or more order emails in a single request (retry failed sends, resend invoices, etc.). Each item uses the same `emailType` values as the single **email-helper** endpoint.

---

## Endpoint

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/admin/order-management/bulk-email-helper` |
| **Full example** | `POST http://192.168.1.8:8013/api/v1/admin/order-management/bulk-email-helper` |
| **Content-Type** | `application/json` |

**Auth:** This route is registered **before** admin `protect` (same as `email-helper`). Confirm with your deployment whether a Bearer token is required.

---

## Request body

```json
{
  "ordersToSentEmail": [
    {
      "orderId": 201299,
      "orderType": "customer",
      "emailType": "invoice-sent"
    }
  ]
}
```

### Fields (each array item)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderId` | number or string | Yes | Customer order id or partner order id |
| `orderType` | string | Yes | `customer` or `local-partner` |
| `emailType` | string | Yes | See allowed types below |

---

## Duplicate handling (backend sanitizes)

If the same `(orderId + orderType + emailType)` appears more than once, the **backend keeps the first row and removes later duplicates**. The API does **not** return an error for duplicates.

| Input | Processed |
|-------|-------------|
| Order `1` + `customer` + `invoice-sent` twice | One send (first row kept) |
| Order `1` + `invoice-sent` and order `1` + `invoice-reminder` | Both sent (different types) |

**Dedupe key:** `orderType` + `orderId` + `emailType`

Removed duplicates are returned in `data.removedDuplicates` with the original array `index`. `data.summary.duplicatesRemoved` is the count.

### Optional: dedupe on frontend too

You may still dedupe before POST to match what will be sent:

```javascript
function dedupeOrdersToSentEmail(items) {
  const seen = new Set();
  return items.filter((item) => {
    const orderType = item.orderType === "local-partner" ? "local-partner" : "customer";
    const key = `${orderType}:${Number(item.orderId)}:${item.emailType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

---

## Allowed `emailType` values

| `emailType` | Use for |
|-------------|---------|
| `order-confirmation` | Customer order confirmed |
| `paid-invoice` | Paid receipt (customer + admin/partner) |
| `invoice-sent` | Payment invoice (first send) |
| `invoice-reminder` | Invoice reminder |
| `order-dispatch` | Dispatch notification |
| `order-shipped` | Shipped notification |
| `order-ship-supplier` | Supplier new order |

**Direct-invoice orders** (`order.type === "direct-invoice"`): only `invoice-sent` and `invoice-reminder` are allowed. Other types return per-row `success: false`.

---

## Example payloads

### Single order, one email

```json
{
  "ordersToSentEmail": [
    {
      "orderId": 201299,
      "orderType": "customer",
      "emailType": "invoice-sent"
    }
  ]
}
```

### Multiple orders, different types

```json
{
  "ordersToSentEmail": [
    {
      "orderId": 201299,
      "orderType": "customer",
      "emailType": "invoice-sent"
    },
    {
      "orderId": 201300,
      "orderType": "customer",
      "emailType": "order-confirmation"
    },
    {
      "orderId": 88,
      "orderType": "local-partner",
      "emailType": "invoice-reminder"
    }
  ]
}
```

### Same order, different email types (allowed)

```json
{
  "ordersToSentEmail": [
    {
      "orderId": 201299,
      "orderType": "customer",
      "emailType": "invoice-sent"
    },
    {
      "orderId": 201299,
      "orderType": "customer",
      "emailType": "invoice-reminder"
    }
  ]
}
```

### Duplicate rows in payload (sanitized, still 200)

If you send the same combination twice, only the **first** is processed:

```json
{
  "ordersToSentEmail": [
    {
      "orderId": 201299,
      "orderType": "customer",
      "emailType": "invoice-sent"
    },
    {
      "orderId": 201299,
      "orderType": "customer",
      "emailType": "invoice-sent"
    }
  ]
}
```

Response includes `duplicatesRemoved: 1` and `removedDuplicates` with the skipped row.

---

## Success response (200)

```json
{
  "status": "success",
  "message": "success",
  "data": {
    "summary": {
      "totalRequested": 3,
      "totalProcessed": 2,
      "duplicatesRemoved": 1,
      "success": 2,
      "failed": 0
    },
    "removedDuplicates": [
      {
        "orderId": 201299,
        "orderType": "customer",
        "emailType": "invoice-sent",
        "index": 2
      }
    ],
    "results": [
      {
        "orderId": 201299,
        "orderType": "customer",
        "emailType": "invoice-sent",
        "success": true,
        "error": null
      },
      {
        "orderId": 201300,
        "orderType": "customer",
        "emailType": "order-confirmation",
        "success": true,
        "error": null
      }
    ]
  },
  "error": ""
}
```

### Partial failure example

```json
{
  "status": "success",
  "message": "success",
  "data": {
    "summary": {
      "totalRequested": 2,
      "totalProcessed": 2,
      "duplicatesRemoved": 0,
      "success": 1,
      "failed": 1
    },
    "removedDuplicates": [],
    "results": [
      {
        "orderId": 201299,
        "orderType": "customer",
        "emailType": "invoice-sent",
        "success": true,
        "error": null
      },
      {
        "orderId": 99999,
        "orderType": "customer",
        "emailType": "invoice-sent",
        "success": false,
        "error": "Order not found"
      }
    ]
  },
  "error": ""
}
```

### Response fields

| Field | Description |
|-------|-------------|
| `data.summary.totalRequested` | Items in the original request array |
| `data.summary.totalProcessed` | Unique items after dedupe (emails attempted) |
| `data.summary.duplicatesRemoved` | Duplicate rows dropped |
| `data.summary.success` | Count with `success: true` |
| `data.summary.failed` | Count with `success: false` |
| `data.removedDuplicates[]` | Skipped duplicates (`index` = position in original array) |
| `data.results[]` | One entry per processed unique row |
| `results[].success` | Whether that email was queued/sent |
| `results[].error` | Error message when `success` is false; otherwise `null` |

**Frontend notes:**

- HTTP **200** even when some rows fail; use `results[].success` per row.
- One failed row does not stop the rest.
- After a successful retry, check **email-log** API: prior failed rows for that order/type get `retrySuccess: true`.

---

## Error responses

### Empty or missing array (400)

```json
{
  "status": "fail",
  "message": "ordersToSentEmail must be a non-empty array"
}
```

### Single-order helper (comparison)

For one order at a time, use:

`POST /api/v1/admin/order-management/email-helper`

```json
{
  "orderId": 201299,
  "orderType": "customer",
  "emailType": "invoice-sent"
}
```

---

## Related: email log

List sends and failures:

`GET /api/v1/admin/order-management/email-log?orderId=201299&emailType=invoice_sent`

See **Email_Log_API_Frontend_Guide.md** for filters (`emailSent`, `retrySuccess`, pagination).

---

## Checklist for UI

1. Build `ordersToSentEmail` from user selection (failed rows, checkboxes, etc.).
2. POST to bulk-email-helper (duplicates are removed server-side).
3. Show `summary`, `removedDuplicates` (if any), and per-row `results`.
4. Refresh email-log list; failed rows may show `retrySuccess: true` after a successful retry.
