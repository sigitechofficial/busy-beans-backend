# Email Log API – Frontend Guide

Backend records **every email attempt** (success and failed). Each row has an **emailSent** value: `"Success"` or `"Failed"`. Use these APIs to show admins which emails were sent and which failed (invoice sent, reminder, paid receipt, supplier new order).

---

## Base URL & Auth

- **Base path:** `/api/v1/admin/order-management/email-log`
- **Auth:** Admin or Admin Employee only. Send the same token you use for other admin APIs (e.g. Bearer in `Authorization` header or your app's auth method).
- **Method:** All endpoints are **GET**.

---

## Endpoints

### 1. List email log (with filters and pagination)

**GET** `/api/v1/admin/order-management/email-log`

**Query parameters (all optional):**

| Parameter   | Type   | Description |
|-------------|--------|-------------|
| `emailType` | string | Filter by type. One of: `invoice_sent`, `invoice_reminder`, `paid_receipt`, `paid_receipt_admin`, `supplier_new_order`, `order_shipped` |
| `orderId`   | number | Filter by order/partner order ID |
| `emailSent` | string | Filter by outcome: `Success` or `Failed` |
| `from`      | string | Start date, format **YYYY-MM-DD** (e.g. `2025-02-01`) |
| `to`        | string | End date, format **YYYY-MM-DD** (e.g. `2025-02-04`) |
| `page`      | number | Page number, default `1` |
| `limit`     | number | Items per page, default `20`, max `100` |

**Example calls:**

- Last 20: `GET .../email-log`
- By type: `GET .../email-log?emailType=invoice_sent`
- By order: `GET .../email-log?orderId=123`
- By outcome: `GET .../email-log?emailSent=Failed` or `?emailSent=Success`
- By date range: `GET .../email-log?from=2025-02-01&to=2025-02-04`
- Pagination: `GET .../email-log?page=2&limit=10`
- Combined: `GET .../email-log?emailType=paid_receipt&from=2025-02-01&to=2025-02-04&page=1&limit=20`

**Response shape:**

```json
{
  "status": "success",
  "message": "success",
  "data": {
    "emailLogs": [
      {
        "id": 1,
        "emailType": "invoice_sent",
        "orderId": 123,
        "orderType": "customer",
        "recipients": "customer@example.com",
        "emailSent": "Success",
        "errorMessage": null,
        "sentAt": "2025-02-04T10:30:00.000Z",
        "metadata": "{\"subject\":\"Your Invoice INV-001\",\"invoiceNumber\":\"INV-001\"}",
        "createdAt": "2025-02-04T10:30:00.000Z",
        "updatedAt": "2025-02-04T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  },
  "error": ""
}
```

**Frontend notes:**

- `emailLogs` is the list of records; use `pagination` for "Page X of Y" and next/previous.
- `metadata` is a JSON string; parse with `JSON.parse(entry.metadata)` when you need subject/invoiceNumber.
- `sentAt` is ISO 8601; format for display as needed (e.g. "Feb 4, 2025 10:30 AM").
- `recipients` can be a single email or comma-separated list (e.g. for invoice sent).
- **`emailSent`** is `"Success"` or `"Failed"`. Use it for badges, filters, and "Failed emails" views.
- **`errorMessage`** is set when `emailSent === "Failed"`; show it in the UI for debugging/resend.

---

### 2. Get single email log by ID

**GET** `/api/v1/admin/order-management/email-log/:id`

**Path:**

- `id` – numeric ID of the email log row.

**Example:**

- `GET .../email-log/1`

**Response shape:**

```json
{
  "status": "success",
  "message": "success",
  "data": {
    "id": 1,
    "emailType": "invoice_sent",
    "orderId": 123,
    "orderType": "customer",
    "recipients": "customer@example.com",
    "emailSent": "Success",
    "errorMessage": null,
    "sentAt": "2025-02-04T10:30:00.000Z",
    "metadata": "{\"subject\":\"Your Invoice INV-001\",\"invoiceNumber\":\"INV-001\"}",
    "createdAt": "2025-02-04T10:30:00.000Z",
    "updatedAt": "2025-02-04T10:30:00.000Z"
  },
  "error": ""
}
```

**On not found:** API returns **404**; show "Email log not found" or similar.

---

## Email types (for filters and labels)

| `emailType`          | Label / description for UI    |
|----------------------|--------------------------------|
| `invoice_sent`       | Invoice sent                   |
| `invoice_reminder`    | Payment reminder               |
| `paid_receipt`       | Paid receipt (customer)        |
| `paid_receipt_admin` | Paid receipt (admin/partner)   |
| `supplier_new_order` | Supplier new order             |

---

## UI ideas

- **Order detail:** Call list with `?orderId=<orderId>` to show "Emails sent for this order."
- **Filters:** Dropdown for `emailType`, date pickers for `from`/`to`, then call list with those query params.
- **Table columns:** `sentAt`, `emailType` (with label), `orderId`, `recipients`, **`emailSent`** (Success/Failed badge), **`errorMessage`** (for failed rows); optional: parsed subject from `metadata`.
- **Failed-only view:** Use `?emailSent=Failed` to show only failed sends so admins can resend.
- **Resend:** These APIs are read-only. Use your existing "send email" APIs (e.g. email-helper) with the same `orderId` / email type to resend; no extra email-log endpoint needed.

---

## Error / auth

- **401 Unauthorized:** Invalid or missing auth token.
- **403 Forbidden:** User is not admin or admin employee.
- **404:** Only for single-log by id when that id does not exist.

Response body follows your standard API shape (e.g. `status`, `message`, `error`).
