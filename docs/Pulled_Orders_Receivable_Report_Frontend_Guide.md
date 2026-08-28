# Pulled Orders Receivable Report – Frontend Integration

Use this API to list **customer orders** (`orders` table) where admin receivable was marked collected (`adminReceivableStatus = true`), receivable amount is present, and a Stripe intent exists (either `pulloutIntentId` or `paymentIntentId`). The backend exposes a single **effective** intent id for display and reconciliation.

---

## Base URL & Auth

- **Full path:** `GET /api/v1/admin/admin-reports/pulled-orders-receivable`
- **Auth:** Same as other admin routes after login (Bearer token / cookie session your app already uses for `/api/v1/admin/*`). If the request is unauthenticated, you will get `401` from the global auth middleware.

---

## Query parameters

| Parameter     | Required | Type   | Description |
|---------------|----------|--------|-------------|
| `startDate`   | Yes      | string | Start of range. Format **`YYYY-MM-DD`** or **`YYYY-MM-DD HH:MM:SS`**. Compared to `orders.on`. |
| `endDate`     | Yes      | string | End of range. Same format as `startDate`. |
| `salesRepId`  | No       | number | Filter to one local partner / sales rep (`orders.salesRepId`). Omit for all reps. |
| `page`        | No       | number | Page number, default **`1`**. Must be ≥ 1. |
| `limit`       | No       | number | Page size, default **`20`**. Must be ≥ 1. |

**Validation errors (`400`):**

- Missing `startDate` or `endDate`
- Invalid date format (must match the regex used server-side)
- Invalid calendar date
- Invalid `salesRepId` (not a positive integer)

---

## Example requests

```http
GET /api/v1/admin/admin-reports/pulled-orders-receivable?startDate=2026-01-01&endDate=2026-01-31&page=1&limit=20
Authorization: Bearer <token>
```

With sales rep filter:

```http
GET /api/v1/admin/admin-reports/pulled-orders-receivable?startDate=2026-01-01&endDate=2026-01-31&salesRepId=42&page=2&limit=50
```

---

## Response shape

Top-level fields:

| Field          | Type   | Description |
|----------------|--------|-------------|
| `status`       | string | Always `"success"` on `200`. |
| `pagination`   | object | Totals for the UI table pager. |
| `data`         | array  | Rows for the current page. |

```json
{
  "status": "success",
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "data": [
    {
      "id": 1001,
      "invoiceNumber": "INV001001",
      "totalBill": "1250.50",
      "on": "2026-01-15T12:00:00.000Z",
      "salesRepId": 7,
      "companyName": "Acme Coffee Co",
      "salesRepName": "North Region Partner",
      "adminReceivableStatus": 1,
      "adminReceivableAmount": "980.00",
      "localPatnerCommission": "270.50",
      "pulloutIntentId": "pi_xxx",
      "paymentIntentId": "pi_xxx",
      "effectivePulloutIntentId": "pi_xxx",
      "pulloutDate": "1705334400000",
      "paymentStatus": "done"
    }
  ]
}
```

**Frontend notes:**

- **`effectivePulloutIntentId`** — Use this for links, copy-to-clipboard, or Stripe Dashboard search. It is `COALESCE(NULLIF(pulloutIntentId,''), NULLIF(paymentIntentId,''))` so older rows that only stored `paymentIntentId` still show one id.
- **`on`** — Order date used for the date filter (same semantics as other admin reports using `orders.on`).
- **`totalBill`** — Full invoice total for the order.
- **`companyName`** — From the customer user (`users.companyName`); may be `null` if not set on the user.
- **`adminReceivableStatus`** — MySQL may return `1`/`0`; treat as boolean in UI if you prefer.
- **`pulloutDate`** — May be a numeric epoch from Sequelize; format in the UI as needed.
- **Pagination** — Use `pagination.totalPages`, `hasNextPage`, `hasPrevPage` for buttons; pass `page` and `limit` on the next request.

---

## TypeScript (optional) row type

```ts
export interface PulledOrdersReceivableRow {
  id: number;
  invoiceNumber: string | null;
  totalBill: string | number | null;
  on: string | Date | null;
  salesRepId: number | null;
  companyName: string | null;
  salesRepName: string | null;
  adminReceivableStatus: boolean | number;
  adminReceivableAmount: string | number | null;
  localPatnerCommission: string | number | null;
  pulloutIntentId: string | null;
  paymentIntentId: string | null;
  effectivePulloutIntentId: string | null;
  pulloutDate: string | number | null;
  paymentStatus: string | null;
}

export interface PulledOrdersReceivableResponse {
  status: "success";
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  data: PulledOrdersReceivableRow[];
}
```

---

## Swagger

The route is documented in Swagger under **Admin** as:

`GET /api/v1/admin/admin-reports/pulled-orders-receivable`

Use Swagger UI to try the same query parameters interactively.

---

## Scope reminder

This report reads **customer orders** only (`orders` + `users` for company name). It does not include `partnerOrders`. If you need a parallel report for partner self-orders, that would be a separate endpoint.
