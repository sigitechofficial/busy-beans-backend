# API access rules (products, prices, subscriptions, jobs)

Prices are for signed-in customers only. Search engines and guests get the product catalog without
prices; the admin panel keeps full access with staff tokens.

Entities (JWT `entity`, `middlewares/protect.js`): `user` = customer; staff = `admin`, `subAdmin`,
`adminEmployee`, `localPartner`, `partnerEmployee`, `supplier` (`STAFF_ENTITIES`). Catalog editors =
`admin`, `subAdmin`, `adminEmployee` (`ADMIN_STAFF_ENTITIES`). `restrictTo` refuses with HTTP 200
`{ status: "fail" }` (the admin panel's existing convention).

## Products

| Endpoint | Who | Prices |
|---|---|---|
| `GET /api/v1/public/catalog/products?page&limit(≤100)&categoryId&search` | anyone (rate limit `PUBLIC_CATALOG_RATE_LIMIT_MAX`, default 120/min/IP; `Cache-Control: public, max-age=300`) | **never** — whitelisted fields only: `id, name, desc, image, imageUrl, weight, unit, grind, categoryId, category{id,name}, updatedAt` |
| `GET /api/v1/public/catalog/products/:id` | anyone; 404 for inactive / deleted / inactive category | never |
| `GET /api/v1/public/catalog/categories` | anyone (active categories) | — |
| `GET /api/v1/users/product` | signed-in customer | the customer's own (sales-rep price list, category discounts) |
| `GET /api/v1/admin/product`, `/product/:id` | staff | admin prices, wholesale, SKU, stock |
| `GET /api/v1/admin/products/sales-rep*` | staff | partner prices |
| `POST/PATCH/DELETE /api/v1/admin/product*`, `/category*` | catalog editors | — |
| `GET /api/v1/admin/category/` | anyone (names and counts) | — |

## Coffee machines

`GET /api/v1/users/coffee-machine` and `/:id` never return `price` / `pricePer` (the websites do not
show machine prices). Staff manage machines and prices through `/api/v1/admin/coffee-machine`.
Machine enquiry leads (`POST /api/v1/users/create-lead` with `machineId`) get `estimatedValue` from the
machine's price on the server.

## Subscriptions

| Endpoint | Who |
|---|---|
| `/api/v1/subscription/*` (create, list, get, cancel, reactivate, add-ons) | staff (admin panel) |
| `GET /api/v1/users/subscription/:id`, `GET/POST …/create-payment-intent/:userId`, `POST …/confirm-payment` | signed in; a customer only for their own subscription or an unassigned one (`userId` null, admin-created and paid through the customer's link), and `:userId` must be the customer. Anything else is 404. Staff pass. |

## Scheduled jobs and internal calls (`middlewares/requireJobKey.js` → `jobKeyOrStaff`)

Allowed with header `x-job-key: <INTERNAL_JOB_API_KEY>` or a staff token (the admin panel triggers
some manually). **Until `INTERNAL_JOB_API_KEY` is set, calls without either still pass** (a warning is
logged once) so existing Lambda callers keep working; set the key in the API env and in every caller,
then the endpoints are enforced.

| Endpoint | Caller |
|---|---|
| `POST /api/v1/admin/order-management/email-helper` | admin panel (order detail, emails, partner orders) |
| `POST /api/v1/admin/order-management/bulk-email-helper` | admin panel (email logs) |
| `POST /api/v1/admin/order-management/ensure-invoice-pdfs` | job |
| `POST /api/v1/admin/order-management/resend-unopened-supplier-emails` | job (`scripts/test_resend_supplier_endpoint.ps1`) |
| `GET /api/v1/admin/order-management/pending-pdfs-list` | job (lists unpaid invoices with totals) |
| `POST /api/v1/admin/lambda-function/pending-pullout-fromlocal-patner-banks` | Lambda |
| `POST /api/v1/admin/lambda-function/create-upcomming-orders` | Lambda |
| `POST /api/v1/admin/lambda-function/send-daily-eod-digests` | Lambda |
| `POST /api/v1/admin/lambda-function/sync-unsynced-paid-customer-payments` | Lambda + admin panel (QuickBooks → customer) |

Still public by design: `POST /api/v1/admin/order-management/fetch-invoice/:orderId` (pay-invoice
links from the websites and `views/pay.ejs`).

## Client IP and proxies (`app.js`, `utils/trustProxy.js`)

Request path: browser → (optional CDN / load balancer) → nginx on the API server → Node (PM2).
Express trusts exactly `TRUST_PROXY_HOPS` proxies (default `1` = nginx) when reading
`X-Forwarded-For`, so `req.ip` (rate limits, anonymized lead IPs) can't be set by a client header.
If a load balancer or CDN is added in front of nginx, set `TRUST_PROXY_HOPS=2` (or an Express
trust-proxy value such as `loopback, 10.0.0.0/8`). Never `true`.

## Public marketing ingest (`/api/public/*`)

| Endpoint | Limits |
|---|---|
| `POST /api/public/tracking/events`, `/touchpoints` | 300/min per IP, bots dropped (204), 64 KB body |
| `POST /api/public/tracking/consent` | 30/min per IP, 64 KB body |
| `POST /api/public/lead-submissions` | 20/min per IP, 64 KB body, honeypot, field limits, idempotent `event_id` |

The rest of the API keeps the 50 MB body limit (uploads). Test mode, lead time and attribution are
decided by the server (see `docs/analytics/EVENT_CONTRACT.md`, "Server authority").

## Logging secrets

Never log a secret, token, password, API key or Authorization header, not even a prefix. Log
presence only (`Stripe webhook configured: yes`, `authorization: "present"`). Request logs
(`app.js`, `marketing/middlewares/requestLogger.js`) follow this.

## Known issues (not changed here)

- `restrictTo("admin", "salesRep")` in `routes/adminRoutes.js` (`PUT /employee/:employeeId` and two
  routes after `router.use(protect)`) names an entity that does not exist (`localPartner` is the
  partner entity), so partners are always refused there.
- After `router.use(protect)` in `routes/adminRoutes.js`, routes without `restrictTo` accept customer
  tokens. The customer websites call only `shipping-charges-on-weight/customer/:id` and the
  address lists there; a router-wide "no customer tokens" guard with that allowlist would close the
  rest.
- Stripe webhook signing secrets that were hard-coded in `controllers/webhook/webhookController.js`
  (removed; verification now uses `STRIPE_WEBHOOK_SECERET` only and answers 500 when it is unset)
  remain in Git history: rotate them. Test: `node scripts/stripeWebhookSecretTest.js`.
- `firebase.json` (Firebase Admin service-account private key, used by `utils/throwNotification.js`)
  is tracked in Git: move it to the environment / secret storage and rotate the key.
- `POST /api/v1/users/create-lead` saves the request body as-is (`Lead.create(req.body)`).

Test: `node scripts/productAccessTest.js` (local API; set `INTERNAL_JOB_API_KEY` to the API's value to
include the job-key checks).
