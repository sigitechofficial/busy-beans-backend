# Admin QuickBooks bulk APIs

Base path: **`/api/v1/admin`**

All routes require authentication (same as other admin routes: `protect` middleware — Bearer token or cookie).

**Authorization:** `admin` or `adminEmployee` only. Other roles receive **403**.

These operations target **admin QuickBooks only** (platform `account` / `currentRealmId`). Local partner QBO fields (`quickBooksInvoiceIdPartner`, `quickBooksPaymentIdPartner`, etc.) are **not** modified by the delete endpoints.

---

## 1. List orders with admin QBO invoice (before cutoff)

**Admin QBO:** rows that have a non-empty `quickBooksInvoiceId` (admin company).

### Request

| Item     | Value                                                               |
| -------- | ------------------------------------------------------------------- |
| Method   | `GET`                                                               |
| Path     | `/qbo/synced-orders-admin-before-march-2026`                        |
| Full URL | `{API_BASE}/api/v1/admin/qbo/synced-orders-admin-before-march-2026` |

#### Query parameters

| Name     | Required | Description                                                                                                                                                                                                      |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `date`   | No       | Calendar date as **`DD-MM-YYYY`** (e.g. `01-03-2026` = 1 March 2026 UTC). Orders with `createdAt` **&lt;** start of that day (UTC). Takes precedence over `cutoff` if both are sent.                             |
| `cutoff` | No       | ISO 8601 datetime (e.g. `2026-03-01T00:00:00.000Z`). Orders with `createdAt` **&lt;** this instant. Use `date` instead if you prefer `01-03-2026` style. If neither `date` nor `cutoff`: default 1 Mar 2026 UTC. |

#### Example

```http
GET /api/v1/admin/qbo/synced-orders-admin-before-march-2026
GET /api/v1/admin/qbo/synced-orders-admin-before-march-2026?date=01-03-2026
GET /api/v1/admin/qbo/synced-orders-admin-before-march-2026?cutoff=2026-03-01T00:00:00.000Z
```

### Response `200 OK`

```json
{
  "status": "success",
  "results": 42,
  "data": {
    "cutoff": "2026-03-01T00:00:00.000Z",
    "customerOrders": [
      {
        "orderType": "customer",
        "id": 1001,
        "quickBooksInvoiceId": "145",
        "quickBooksPaymentId": "229",
        "adminRealmId": "1234567890",
        "createdAt": "2025-11-15T10:00:00.000Z",
        "invoiceNumber": "INV-1001"
      }
    ],
    "partnerOrders": [
      {
        "orderType": "local-partner",
        "id": 501,
        "quickBooksInvoiceId": "200",
        "quickBooksPaymentId": null,
        "adminRealmId": "1234567890",
        "createdAt": "2026-01-10T08:00:00.000Z",
        "invoiceNumber": "INV-501"
      }
    ],
    "customerOrdersIdsOnly": [1001, 1002],
    "partnerOrdersIdsOnly": [501, 502],
    "counts": {
      "customer": 30,
      "partner": 12,
      "total": 42
    }
  }
}
```

- `results` equals `data.counts.total`.
- `customerOrdersIdsOnly` / `partnerOrdersIdsOnly` are arrays of numeric order ids only (same rows as `customerOrders` / `partnerOrders`).
- For `date=01-03-2026` (**DD-MM-YYYY**), the cutoff is **1 March 2026 00:00:00 UTC**; every returned row has `createdAt` strictly before that instant.
- `quickBooksPaymentId` may be `null` if the invoice exists in QBO but no admin payment was synced.
- Only non-deleted orders (`deleted: false`) are returned.

### Errors

| Status  | When                                                                                        |
| ------- | ------------------------------------------------------------------------------------------- |
| **400** | Invalid `date` / `cutoff` (bad `DD-MM-YYYY`, impossible calendar date, or unparseable ISO). |
| **403** | User is not `admin` / `adminEmployee`.                                                      |
| **401** | Not authenticated (middleware).                                                             |

---

## 2. Delete admin QBO payments by order IDs

Removes the **admin** QuickBooks **payment** referenced by each order’s `quickBooksPaymentId`, then clears that field in the database.

**Note:** If QuickBooks refuses operations because a payment is tied to an invoice, you may need to delete the payment **before** deleting the invoice (or follow QBO’s rules for your company file).

### Request

| Item         | Value                                               |
| ------------ | --------------------------------------------------- |
| Method       | `POST`                                              |
| Path         | `/qbo/payments/delete-admin`                        |
| Full URL     | `{API_BASE}/api/v1/admin/qbo/payments/delete-admin` |
| Content-Type | `application/json`                                  |

#### Body (JSON)

| Field       | Type       | Required | Description                                                                       |
| ----------- | ---------- | -------- | --------------------------------------------------------------------------------- |
| `orderIds`  | `number[]` | Yes      | Order primary keys to process.                                                    |
| `orderType` | `string`   | No       | `"customer"` (default) → `order` table. `"local-partner"` → `partnerOrder` table. |

#### Example

```json
{
  "orderIds": [1001, 1002, 1003],
  "orderType": "customer"
}
```

### Response `200 OK`

HTTP **200** is returned even when some QBO deletes fail; inspect `data.failedPayments`.

```json
{
  "status": "success",
  "message": "Removed 2 admin QBO payment(s); 2 order row(s) updated.",
  "data": {
    "deletedPayments": [
      { "paymentId": "229", "orderIds": [1001] },
      { "paymentId": "230", "orderIds": [1002] }
    ],
    "failedPayments": [
      {
        "paymentId": "999",
        "orderIds": [1003],
        "message": "Object Not Found"
      }
    ],
    "skippedNoAdminPayment": [1004],
    "ordersNotFound": [9999],
    "orderType": "customer",
    "summary": {
      "paymentsDeleted": 2,
      "paymentsFailed": 1,
      "ordersUpdated": 2,
      "skippedNoAdminPayment": 1,
      "ordersNotFound": 1
    }
  }
}
```

#### DB updates (successful deletes only)

For affected order rows:

- `quickBooksPaymentId` → `null`
- `paymentSyncedToQBO` → `false`
- `qboLastSync` → current timestamp

Same QBO payment ID on multiple orders is deleted once; all matching rows are updated.

### Errors

| Status  | When                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------ |
| **400** | Missing/empty `orderIds`, invalid `orderType`, no valid numeric ids, or admin QBO not connected. |
| **403** | Not admin / adminEmployee.                                                                       |
| **401** | Not authenticated.                                                                               |

---

## 3. Delete admin QBO invoices by order IDs

Removes the **admin** QuickBooks **invoice** referenced by each order’s `quickBooksInvoiceId`, then clears admin invoice/payment fields on success.

QuickBooks often **blocks deleting an invoice** while a **payment** is still applied. Use **API 2** (delete admin payments) first when needed.

### Request

| Item         | Value                                               |
| ------------ | --------------------------------------------------- |
| Method       | `POST`                                              |
| Path         | `/qbo/invoices/delete-admin`                        |
| Full URL     | `{API_BASE}/api/v1/admin/qbo/invoices/delete-admin` |
| Content-Type | `application/json`                                  |

#### Body (JSON)

| Field       | Type       | Required | Description                                  |
| ----------- | ---------- | -------- | -------------------------------------------- |
| `orderIds`  | `number[]` | Yes      | Order primary keys to process.               |
| `orderType` | `string`   | No       | `"customer"` (default) or `"local-partner"`. |

#### Example

```json
{
  "orderIds": [1001, 1002],
  "orderType": "customer"
}
```

### Response `200 OK`

```json
{
  "status": "success",
  "message": "Removed 2 admin QBO invoice(s); 2 order row(s) updated.",
  "data": {
    "deletedInvoices": [
      { "invoiceId": "145", "orderIds": [1001] },
      { "invoiceId": "146", "orderIds": [1002] }
    ],
    "failedInvoices": [
      {
        "invoiceId": "147",
        "orderIds": [1003],
        "message": "A business validation error has occurred..."
      }
    ],
    "skippedNoAdminInvoice": [1004],
    "ordersNotFound": [8888],
    "orderType": "customer",
    "summary": {
      "invoicesDeleted": 2,
      "invoicesFailed": 1,
      "ordersUpdated": 2,
      "skippedNoAdminInvoice": 1,
      "ordersNotFound": 1
    }
  }
}
```

#### DB updates (successful deletes only)

For affected order rows:

- `quickBooksInvoiceId` → `null`
- `quickBooksPaymentId` → `null`
- `paymentSyncedToQBO` → `false`
- `qboLastSync` → current timestamp

**Not cleared:** `quickBooksInvoiceIdPartner`, `quickBooksPaymentIdPartner`, `partnerRealmId` (partner QBO unchanged).

### Errors

| Status  | When                                                                                                           |
| ------- | -------------------------------------------------------------------------------------------------------------- |
| **400** | Missing/empty `orderIds`, invalid `orderType`, invalid ids, admin QBO not connected, or QBO credentials error. |
| **403** | Not admin / adminEmployee.                                                                                     |
| **401** | Not authenticated.                                                                                             |

---

## 4. Update admin QBO invoices by order IDs

Pushes the latest order data to the **existing** admin QuickBooks invoice (`quickBooksInvoiceId`) via `updateInvoiceInQuickBooks`. **Partner QBO is not called.**

Orders without `quickBooksInvoiceId` are **skipped** (`no_admin_invoice`). Direct-partner / dropship direct-invoice admin-skip rules still apply (see `shouldSkipAdminQboSync` in `qboInvoice.js`).

### Request

| Item         | Value                                               |
| ------------ | --------------------------------------------------- |
| Method       | `POST`                                              |
| Path         | `/qbo/invoices/update-admin`                        |
| Full URL     | `{API_BASE}/api/v1/admin/qbo/invoices/update-admin` |
| Content-Type | `application/json`                                  |

#### Body (JSON)

| Field       | Type       | Required | Description                                  |
| ----------- | ---------- | -------- | -------------------------------------------- |
| `orderIds`  | `number[]` | Yes      | Order IDs to update in admin QBO.            |
| `orderType` | `string`   | No       | `"customer"` (default) or `"local-partner"`. |

#### Example

```json
{
  "orderIds": [1001, 1002],
  "orderType": "customer"
}
```

### Response `200 OK`

```json
{
  "status": "success",
  "message": "Admin QBO invoice update: 2 updated, 0 failed, 1 skipped, 0 id(s) not found.",
  "data": {
    "orderType": "customer",
    "updatedOrderIds": [1001, 1002],
    "failed": [
      { "orderId": 1003, "reason": "admin_qbo_customer_not_connected" }
    ],
    "skipped": [{ "orderId": 1004, "reason": "no_admin_invoice" }],
    "ordersNotFound": [9999],
    "summary": {
      "updated": 2,
      "failed": 1,
      "skipped": 1,
      "ordersNotFound": 1,
      "totalRequested": 5
    }
  }
}
```

Requests are spaced by **300 ms** between orders to reduce QBO throttling.

### Errors

| Status  | When                                                                    |
| ------- | ----------------------------------------------------------------------- |
| **400** | Missing/empty `orderIds`, invalid `orderType`, or no valid numeric ids. |
| **403** | Not admin / adminEmployee.                                              |
| **401** | Not authenticated.                                                      |

---

## Quick reference

| #   | Method | Path                                                      |
| --- | ------ | --------------------------------------------------------- |
| 1   | `GET`  | `/api/v1/admin/qbo/synced-orders-admin-before-march-2026` |
| 2   | `POST` | `/api/v1/admin/qbo/payments/delete-admin`                 |
| 3   | `POST` | `/api/v1/admin/qbo/invoices/delete-admin`                 |
| 4   | `POST` | `/api/v1/admin/qbo/invoices/update-admin`                 |

**Implementation:** `services/qboOrderQueryService.js`, `services/qboPaymentService.js`, `services/qboDeleteInvoice.js`, `services/qboInvoice.js` (`updateAdminQboInvoicesForOrders`), `controllers/admin/manageOrderController.js`, `routes/adminRoutes.js`.
