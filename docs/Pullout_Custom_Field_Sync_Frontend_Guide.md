# PulloutIntentId Custom Field Sync – Frontend Integration

This guide covers the two admin APIs that work together to push the
**PulloutIntentId** custom field onto admin QuickBooks Online (QBO) invoices
for **dropship-partner, regular customer orders** that have already been
pulled out via Stripe but whose admin QBO invoice does **not** yet carry the
custom field.

The workflow is intentionally two-step:

1. **Listing API** — fetch the orders that still need their PulloutIntentId
   pushed to QBO. The UI shows them in a table with checkboxes.
2. **Bulk-sync API** — the admin selects rows and submits the ids. The backend
   pushes the custom field to QBO for each id and returns a per-order result.

After a successful sync, the affected rows automatically drop out of the
listing API (their `pulloutIntentIdSynced` becomes `"synced"`).

---

## Workflow at a glance

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. GET /admin-reports/pullout-intent-unsynced-orders                │
│    -> render rows in table with row checkbox                        │
│                                                                     │
│ 2. User selects N rows, clicks "Sync to QuickBooks"                 │
│                                                                     │
│ 3. POST /qbo/pullout-custom-field/sync   { orderIds: [...] }        │
│    -> render per-row outcome (synced / skipped / failed)            │
│                                                                     │
│ 4. Refetch step 1 to refresh the table                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Auth

Both endpoints sit under `/api/v1/admin/...` and use the same auth
(bearer token / cookie session) as every other admin route. Unauthenticated
requests get `401` from the global auth middleware.

---

# 1. Listing API – GET orders (unsynced / synced / all)

```
GET /api/v1/admin/admin-reports/pullout-intent-unsynced-orders
```

Returns customer orders that satisfy **every** gate required to push the
PulloutIntentId custom field to admin QBO. The same endpoint powers both the
"Needs sync" and the "Already synced" tabs via the `?syncStatus=` query param.

## Filters baked into the SQL (always applied — no opt-out)

| Filter | Reason |
|---|---|
| `orders.deleted = 0` | Soft-deleted orders excluded. |
| `orders.userId IS NOT NULL` | Customer orders only; partner self-orders ignored. |
| `orders.salesRepId IS NOT NULL` | Must belong to a local partner. |
| `orders.paymentMethod = 'Bank Check'` | Only pullout-eligible payment method (case-insensitive — MySQL default collation also matches `"bank check"`). |
| `orders.pulloutIntentId IS NOT NULL` and non-empty | Pullout must have already happened. |
| `orders.quickBooksInvoiceId IS NOT NULL` | Admin QBO invoice already exists; we are patching it. |
| `orders.type = 'regular-order'` | Excludes `direct-invoice`. |
| `salesRep.partnerType = 'dropship-partner'` | Excludes direct-partner (admin doesn't sync those). |

## Query parameters

| Parameter | Required | Type | Description |
|---|---|---|---|
| `syncStatus` | No | enum | `unsynced` (default) → rows where `pulloutIntentIdSynced <> 'synced'`. `synced` → rows where `pulloutIntentIdSynced = 'synced'` (audit / "Already synced" tab). `all` → both buckets together. |
| `startDate` | No | string | Start of range on `orders.on`. Format `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS`. Must be paired with `endDate`. |
| `endDate`   | No | string | End of range. Same format as `startDate`. Must be paired with `startDate`. |
| `salesRepId` | No | number | Filter to one local partner. Must be a positive integer. |
| `page` | No | number | Page number, default `1`. Must be ≥ 1. |
| `limit` | No | number | Page size, default `20`. Must be ≥ 1. |

### Suggested UI usage

Wire a two-tab layout to the same endpoint and just flip `syncStatus`:

```
GET /api/v1/admin/admin-reports/pullout-intent-unsynced-orders?syncStatus=unsynced  // tab "Needs sync"
GET /api/v1/admin/admin-reports/pullout-intent-unsynced-orders?syncStatus=synced    // tab "Already synced"
```

On the **Needs sync** tab the row checkboxes drive the bulk-sync API (§ 2). On
the **Already synced** tab show the rows read-only — they're done. Both tabs
share `startDate` / `endDate` / `salesRepId` / `page` / `limit`.

**Validation errors (`400`):**

- Only one of `startDate`/`endDate` provided (must be both or neither).
- Invalid date format.
- Invalid `salesRepId`.

## Example requests

```http
GET /api/v1/admin/admin-reports/pullout-intent-unsynced-orders?page=1&limit=20
Authorization: Bearer <token>
```

With date window and sales-rep filter:

```http
GET /api/v1/admin/admin-reports/pullout-intent-unsynced-orders?startDate=2026-01-01&endDate=2026-05-31&salesRepId=5&page=1&limit=50
```

## Response shape

```jsonc
{
  "status": "success",
  "pagination": {
    "total": 123,
    "page": 1,
    "limit": 20,
    "totalPages": 7,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "data": [
    {
      "id": 1092,
      "invoiceNumber": "INV001092",
      "totalBill": "284.73",
      "on": "2026-03-10T00:00:00.000Z",
      "salesRepId": 5,
      "userId": 350,
      "paymentMethod": "Bank Check",
      "paymentStatus": "done",
      "type": "regular-order",
      "adminReceivableStatus": 1,
      "adminReceivableAmount": "200.00",
      "localPatnerCommission": "84.73",
      "pulloutIntentId": "pi_23123109",
      "pulloutIntentIdSynced": "eligible",
      "pulloutDate": "1741564800000",
      "quickBooksInvoiceId": "31920",
      "adminRealmId": "9341454936920003",
      "companyName": "Acme Coffee Co",
      "salesRepName": "Joe Argyle",
      "partnerType": "dropship-partner",
      "pendingReason": "needs_custom_field_patch"
    }
  ]
}
```

## Field notes

- **`pulloutIntentIdSynced`** — current state of this row's state machine.
  In this list it will be one of:
  - `"eligible"` — gates passed previously, awaiting sync.
  - `"not-eligible"` — backfill default; reconciled at next sync attempt.
- **`pendingReason`** — derived in SQL to help you label the row:
  - `"needs_custom_field_patch"` — common case here. Admin QBO invoice exists;
    sync API will sparse-patch the `CustomField` array.
  - `"needs_admin_invoice"` — would mean no admin invoice yet. Filtered out
    by the current `quickBooksInvoiceId IS NOT NULL` rule but kept in the
    response shape for future-proofing.
- **`adminReceivableStatus`** — MySQL may return `1` / `0`; treat as boolean in UI.
- **`pulloutDate`** — May be a numeric epoch from Sequelize; format in the UI.
- **`totalBill`, `adminReceivableAmount`, `localPatnerCommission`** — decimal
  strings; parse to `Number` for math, keep as string for display to avoid
  float drift.
- Rows are ordered `orders.on DESC, orders.id DESC` (newest first).

## TypeScript type

```ts
export type PulloutIntentSyncState = "not-eligible" | "eligible" | "synced";

export interface PulloutUnsyncedOrderRow {
  id: number;
  invoiceNumber: string | null;
  totalBill: string | number | null;
  on: string | Date | null;
  salesRepId: number | null;
  userId: number | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  type: "regular-order" | "direct-invoice" | string | null;
  adminReceivableStatus: boolean | number;
  adminReceivableAmount: string | number | null;
  localPatnerCommission: string | number | null;
  pulloutIntentId: string | null;
  pulloutIntentIdSynced: PulloutIntentSyncState;
  pulloutDate: string | number | null;
  quickBooksInvoiceId: string | null;
  adminRealmId: string | null;
  companyName: string | null;
  salesRepName: string | null;
  partnerType: string | null;
  pendingReason: "needs_custom_field_patch" | "needs_admin_invoice";
}

export interface PulloutUnsyncedOrdersResponse {
  status: "success";
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  data: PulloutUnsyncedOrderRow[];
}
```

---

# 2. Bulk-sync API – POST push custom field to QBO

```
POST /api/v1/admin/qbo/pullout-custom-field/sync
Content-Type: application/json
```

For each requested order id, the backend runs the sparse-update flow against
the admin's QBO invoice and, on success, flips
`pulloutIntentIdSynced` to `"synced"` so the row drops out of the listing API.

## Request body

| Field | Required | Type | Notes |
|---|---|---|---|
| `orderIds` | Yes | `number[]` | Array of positive integers. Max **100** per request. Duplicates are silently de-duped. |
| `orderType` | No | `"customer" \| "local-partner"` | Defaults to `"customer"`. The listing API only returns customer orders, so you'll always send `"customer"` (or omit). |

**Validation errors (`400`):**

- `orderIds` missing or empty array.
- `orderIds.length > 100`.
- Any element that isn't a positive integer.
- Invalid `orderType`.

## Example request

```http
POST /api/v1/admin/qbo/pullout-custom-field/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "orderIds": [1092, 1234, 1500]
}
```

## Response shape — always HTTP 200 on a valid batch

Per-order failures **do not break the batch**. Each id is processed inside
its own try/catch and you always get back a summary plus a `results[]`
entry for every id you sent.

```jsonc
{
  "status": "success",
  "summary": {
    "total": 3,
    "synced": 2,
    "skipped": 0,
    "failed": 1
  },
  "results": [
    {
      "orderId": 1092,
      "ok": true,
      "outcome": "synced",
      "action": "patched_custom_fields",
      "reason": null,
      "invoiceId": "31920",
      "customField": {
        "DefinitionId": "1000000004",
        "StringValue": "pi_23123109"
      },
      "syncResult": null
    },
    {
      "orderId": 1234,
      "ok": true,
      "outcome": "synced",
      "action": "skipped",
      "reason": "pullout_already_set",
      "invoiceId": null,
      "customField": null,
      "syncResult": null
    },
    {
      "orderId": 1500,
      "ok": false,
      "outcome": "failed",
      "action": null,
      "reason": "Could not load QBO invoice 31000",
      "statusCode": 404,
      "qboResponse": { "Fault": { /* ... */ } },
      "invoiceId": null,
      "customField": null
    }
  ]
}
```

## Outcome semantics (what to render in the UI)

The `outcome` field is the only thing the UI needs to key off:

| `outcome` | When | Suggested UI |
|---|---|---|
| `"synced"` | Custom field is now on QBO (either we just patched it, or it was already there with the same value and we reconciled the DB state). | Green badge / row drops on next refetch. |
| `"skipped"` | Gates failed, invoice already paid, admin disconnected, etc. Inspect `reason`. | Yellow badge with `reason` tooltip. |
| `"failed"` | Exception (QBO 4xx/5xx, customer mapping missing, DB error, etc.). Inspect `reason` and optionally `qboResponse`. | Red badge; offer a "retry" by sending just that id again. |

### Known `reason` values you may see

| reason | outcome | What it means |
|---|---|---|
| `pullout_gates_not_met` | `skipped` | Order doesn't pass `getPulloutCustomFieldEntry` (gate). Usually the order changed state between report and sync. |
| `skipped_admin_sync_direct_partner_order` | `skipped` | Admin QBO is intentionally not used for this order. |
| `skipped_admin_sync_dropship_direct_invoice_order` | `skipped` | Same as above for dropship direct-invoice. |
| `admin_qbo_not_connected` | `skipped` (failed-ish) | Admin's QBO is disconnected. Treat as failure in UI if you want admin to reconnect. |
| `admin_qbo_customer_not_connected` | `skipped` | Customer not mapped to admin's QBO yet; mapping will rebuild on next normal sync. |
| `admin_qbo_token_or_realm_missing` | `skipped` | Token refresh failed. Reconnect QBO. |
| `pullout_already_set` | `synced` | QBO invoice already carried the same value — DB state reconciled to `synced`, no QBO write needed. |

**Paid / closed invoices are patched too.** The sparse update only writes the
`CustomField` array (never `Line`, `TotalAmt`, or `TxnDate`), so QBO accepts
the update on paid invoices and DB state still moves to `synced`. In
practice almost every row this endpoint touches is already paid because the
pullout collected the money up-front and the payment was synced to QBO; the
endpoint is designed for that case.
| `no_admin_invoice_id` | `synced` | Edge case where the order didn't have a QBO invoice yet, so the backend created one. `syncResult` is populated. |

## TypeScript type

```ts
export type BulkSyncOutcome = "synced" | "skipped" | "failed";

export interface BulkSyncResultRow {
  orderId: number;
  ok: boolean;
  outcome: BulkSyncOutcome;
  action: string | null;
  reason: string | null;
  statusCode?: number;
  qboResponse?: unknown;
  invoiceId: string | null;
  customField: { DefinitionId: string; StringValue: string } | null;
  syncResult?: unknown;
}

export interface BulkSyncResponse {
  status: "success";
  summary: {
    total: number;
    synced: number;
    skipped: number;
    failed: number;
  };
  results: BulkSyncResultRow[];
}
```

---

## End-to-end example (React-ish pseudo-code)

```tsx
async function fetchUnsynced(page = 1, limit = 20) {
  const res = await fetch(
    `/api/v1/admin/admin-reports/pullout-intent-unsynced-orders?page=${page}&limit=${limit}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Failed to load unsynced orders");
  return (await res.json()) as PulloutUnsyncedOrdersResponse;
}

async function bulkSync(orderIds: number[]) {
  const res = await fetch(`/api/v1/admin/qbo/pullout-custom-field/sync`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderIds }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Sync failed (${res.status})`);
  }
  return (await res.json()) as BulkSyncResponse;
}

function PulloutSyncPage() {
  const [rows, setRows] = useState<PulloutUnsyncedOrderRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<BulkSyncResultRow[] | null>(null);

  async function refresh() {
    const { data } = await fetchUnsynced(1, 50);
    setRows(data);
    setSelected(new Set());
    setResults(null);
  }

  async function onSyncClick() {
    if (selected.size === 0) return;
    setSyncing(true);
    try {
      const { results } = await bulkSync([...selected]);
      setResults(results);
      // Refresh listing so synced rows drop out.
      await refresh();
    } finally {
      setSyncing(false);
    }
  }

  // ...render table with row checkboxes, "Sync to QuickBooks" button,
  //    and a results panel keyed by orderId.
}
```

---

## Recommended UX behaviour

- **Batch size** — the API allows up to 100 ids per call. If the user
  selects more, split the request into chunks of 100 and call sequentially;
  the response shapes can be concatenated.
- **Loading state** — sync runs sequentially server-side; expect roughly
  `~1–2 seconds per order` end-to-end. Show a progress bar (`X / N done`) if
  the batch is large.
- **Partial failures** — never error-toast the whole page. Render a
  per-row outcome strip and keep the failed rows selected so the user can
  retry just those.
- **Auto-refresh** — after the bulk-sync call, refetch the listing API so
  successfully synced rows drop out. The `summary.synced` counter helps you
  show a confirmation toast ("Pushed 23 invoices to QuickBooks").
- **Retry-on-failure** — for `outcome === "failed"`, the safest retry is to
  call the same API again with just that one id. The backend is idempotent
  (it re-runs the gate, GETs the invoice, sparse-updates only the
  `CustomField` array).

---

## Swagger

Both routes are documented under **Admin** in the project's Swagger UI:

- `GET /api/v1/admin/admin-reports/pullout-intent-unsynced-orders`
- `POST /api/v1/admin/qbo/pullout-custom-field/sync`

You can try them with the same payloads from Swagger UI to validate before
wiring into the UI.

---

## Scope reminder

- These APIs touch **customer orders** only (`orders` table). Partner
  self-orders (`partnerOrders`) never qualify (no `userId`) so they are
  filtered out automatically.
- The DB state machine column (`pulloutIntentIdSynced`) tracks **admin**
  QBO only. Local partner QBO has its own pullout custom field handling and
  is unaffected by these endpoints.
