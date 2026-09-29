# Marketing analytics — event contract

Ingest: `POST /api/public/tracking/events` (one event) and `POST /api/public/tracking/touchpoints`.
Stored in `marketing_analytics_events` / `marketing_touchpoints`; sessions in `marketing_sessions`.
Checked by `npm run marketing:analytics-contract` (local DB only — it writes and removes test rows).

## Page context (derived server-side)

`marketing/utils/analyticsPayload.js#resolvePageContext` derives these from the event's `pathname`;
client-sent values for them are not trusted.

| Column | Value |
|---|---|
| `page_type` | `landing_page` when `pathname` is `/lp/{slug}`, else `site`; `null` when there is no pathname (server events) |
| `page_slug` | Every page event. `/lp/{slug}` → `{slug}`; other paths → path with `/` replaced by `-` (`/` → `home`) |
| `landing_page_slug` / `landing_page_id` | Only on `/lp/{slug}` events. Cleared on other paths even if the client sent them. Kept as attribution on events without a pathname |
| `site` | `metadata.site` or `site`, one of `customer-website`, `campaign-lp`, `campaign-preview`, `server`; else `null` |

Reports that are "per landing page" must filter `page_type IS NULL OR page_type = 'landing_page'`.

## Event types sent by the website tracker

| `event_type` | When | Metadata |
|---|---|---|
| `page_view` | Site page view (deduped per path + session) | device, pageTitle, `site` |
| `landing_page_view` | `/lp/{slug}` view | same |
| `cta_click` | CTA click | `label` |
| `form_start` | First interaction with a form, once per page per session | — |
| `form_submit`, `lead_created` | After the lead API stored the lead | — |
| `scroll_depth` | 25/50/75/90% buckets | `depthPct` |
| `page_engagement` | Page hidden / closed / left; sent with `fetch keepalive` | `activeMs` (visible + focused + activity in last 30 s), `maxScrollPct` |

Sum of `page_engagement.activeMs` for a page = its engaged time. Backend caps one event at 30 min.
Imported (custom HTML) pages run in a sandboxed iframe; the frame posts `bb-ch-activity` (throttled
to one per 5 s) on pointer/key/scroll activity and the host re-emits it as a `bb:activity` window
event, so time spent interacting inside the frame counts as active.

## Traffic sources (website, `src/lib/analytics/client/attribution.ts` + `knownSources.ts`)

Every visit is classified from **its own** UTM tags, click IDs and referrer (click IDs stored from
an earlier visit never make a later visit "paid"). Source names are lower-case.

| Signal (first match wins) | Source | Category / medium |
|---|---|---|
| `gclid`, `gbraid`, `wbraid` | google | `paid_search` / `cpc` |
| `msclkid` | bing | `paid_search` / `cpc` |
| `ttclid`, `li_fat_id`, `twclid`, `ScCid`, `epik`, `rdt_cid` | tiktok, linkedin, x, snapchat, pinterest, reddit | `paid_social` |
| `utm_medium` contains cpc/ppc/paid | `utm_source` | `paid_search`, or `paid_social` when the medium says social |
| `utm_medium`/`utm_source` email, newsletter, mailchimp | `utm_source` | `email` |
| `utm_medium`/`utm_source` qr | `utm_source` | `qr` |
| partner / affiliate | `utm_source` | `referral` |
| `utm_medium=ai` or ChatGPT/Perplexity/Gemini/Copilot/Claude | assistant | `ai_assistant` |
| social `utm_source` (facebook, instagram, linkedin, tiktok, x, …) | `utm_source` | `social` |
| Known referrer host (Google, Bing, DuckDuckGo, Yahoo, Yandex, Baidu, Ecosia, Brave; Facebook, Instagram, LinkedIn/lnkd.in, X/t.co, TikTok, Pinterest, Reddit, YouTube, Nextdoor; Gmail/Outlook/Yahoo mail; ChatGPT, Perplexity, Gemini, Copilot, Claude; Yelp) | host rule | `organic_search`, `social`, `email`, `ai_assistant`, `referral` |
| Other external referrer | referrer host | `referral` |
| `fbclid` only (Meta adds it to organic clicks too) | facebook | `social` |
| nothing | direct | `direct` / `none` |

**UTM convention for ads** (so paid traffic is never guessed): `utm_source` = platform
(`facebook`, `instagram`, `linkedin`, `google`, `tiktok`, `snapchat`, `x`, `bing`),
`utm_medium` = `paid_social` / `cpc` / `email` / `qr` / `referral`, `utm_campaign` = campaign name.

Server reports (`marketing/services/customerReports.service.js`) group by source + medium over
the whole range: visitors from touchpoints, leads (`attribution.source`/`utmSource`, medium falls
back to `utmMedium` then `lastTouchMedium`), won leads, paid orders, revenue. Empty, `(none)` and
`(not set)` mediums count as `none`.

## Order / revenue events (server-side only)

The public ingest endpoint rejects `order_created`, `order_completed`, `payment_completed` and
`subscription_payment` (400), so revenue can't be posted from a browser.

Flow (`marketing/services/orderAttribution.service.js`):

1. Website checkout (`createCheckoutOrder` in `src/data/backend.js`) sends
   `analytics: { visitorId, sessionId, firstTouch, lastTouch, clickIds }` with `POST /api/v1/users/book-order`.
2. `bookOrder` calls `recordOrderCreatedSafe` (fire-and-forget; never affects the order):
   - row in `marketing_order_attribution` (order id, visitor, session, touches, total);
   - `landing_page_slug` = most recent landing page in the visitor's sessions within 30 days,
     `first_landing_page_slug` = earliest ever — both from `marketing_sessions`, not the client;
   - event `order_created` (id `order_created-{orderId}`, metadata `orderId`, `orderTotal`, `site: server`).
3. The marketing scheduler (every `MARKETING_SCHEDULER_INTERVAL_MS`, default 60 s) runs
   `syncPaidOrders`: attributed orders (last 180 days) whose commerce `paymentStatus` is `done`
   get event `order_completed` (id `order_completed-{orderId}`, metadata `revenue` = `orders.totalBill`,
   `currency`, `orderId`) and the row becomes `paid`. Deleted/missing orders become `void`.
   Works for every payment path (Stripe webhooks, multi-invoice checkout, admin mark-paid).
   `order_completed` does not move the session end / visitor last-seen (payment may be days later).

Revenue in the dashboard = sum of `metadata.revenue` on `order_completed` (per landing page by
`landing_page_slug`, per source/campaign by the event's last-touch `attribution`).

### Customers and repeat orders

- `customer_order_seq` = the customer's paid-order number (1 = first order = new customer);
  `is_repeat` = seq > 1. Set when the order becomes `paid`.
- Paid orders of a customer that were **not** tracked (recurring orders generated from a
  frequency, admin-created orders, another device) after the customer's first attributed paid
  order are credited to that order's source and landing page: a row with `is_repeat = 1`,
  `inherited_from_order_id` and one `order_completed` event (`metadata.repeat = true`,
  `inheritedFromOrderId`). Same scheduler run as `syncPaidOrders`.
- Still not attributed: customers whose **first** order had no website context (mobile app,
  admin-created) and machine subscriptions (created in the admin panel).

### Won leads (B2B customers who never check out online)

Sales marks a lead `won` in Leads with the deal `revenue`; `lead_submissions.converted_at` is set
then (cleared if the status changes away from won). Won leads and their revenue are reported on
the day they were won, credited to the lead's page (`landing_page_slug`, else `page_url`) and the
lead's own attribution. "Total customer revenue" = paid order revenue + won-lead revenue.

## Sessions

`marketing_sessions` fields maintained by `visitors.service.js#upsertSession`:

- `entry_pathname`, `entry_landing_page_slug` — set by the session's first event, never overwritten.
- `last_landing_page_slug` (and legacy `landing_page_slug`) — last `/lp` page seen.
- `page_count` — `page_view` + `landing_page_view` count (atomic increment).
- `engaged_ms` — sum of `page_engagement.activeMs` (atomic increment).

## Reporting (daily page stats)

`marketing/services/pageStats.service.js`; endpoints (marketing admin auth):

- `GET /api/admin/analytics/pages?type=landing_page|site&from=YYYY-MM-DD&to=YYYY-MM-DD&touch=last|first`
- `GET /api/admin/analytics/pages/:slug?type=…&from=…&to=…&touch=…` — KPIs, daily series, funnel, breakdowns
- `GET /api/admin/analytics/dashboard?…&touch=…` — unchanged shape, plus `meta`; landing page rows come from the rollups

Days are calendar days in `MARKETING_REPORT_TIMEZONE` (default America/New_York); `from`/`to`
are inclusive local days. Closed days are stored in `marketing_daily_page_stats` (re-rolled every
15 min for the last 2 days by the scheduler; missing days are filled on first read; backfill with
`npm run marketing:rollup-page-stats`). Today is computed live.

| Metric | Definition |
|---|---|
| Views | `page_view` / `landing_page_view` events |
| Visitors | distinct `visitor_id` with a view in the range (counted live — not additive across days) |
| Sessions | distinct sessions with a view of the page (per day, summed) |
| Entrances | sessions whose entry page (`marketing_sessions.entry_pathname`) is the page |
| Bounce rate | entrances with ≤ 1 page view, < 10 s engaged time and no CTA/form/lead event ÷ entrances |
| Exits / exit rate | sessions whose last view that day was the page ÷ views |
| Avg engaged time | sum of `page_engagement.activeMs` ÷ views |
| Avg scroll depth | mean `page_engagement.maxScrollPct` |
| Leads | landing pages: non-test `lead_submissions`; site pages: `lead_created` events |
| Lead / order conversion | leads (orders) ÷ sessions |
| Orders / revenue | paid attributed orders by payment day; last touch = `landing_page_slug`, first touch = `first_landing_page_slug` |
| Repeat orders / revenue | the same, `is_repeat = 1` only (includes untracked repeat orders credited to the first order) |
| Won leads / won revenue | leads marked won, by `converted_at` day; lead win rate = won ÷ leads in the range |
| Customer revenue | order revenue + won-lead revenue |
| Funnel | per session, in order: view → CTA → form start → form submit → lead → became a customer (paid order by the same visitor credited to the page, or the session's lead marked won); `anyOrder` = sessions with the step at all |

Dashboard (`GET /api/admin/analytics/dashboard`) also returns `customers: { summary, bySource }`,
`marketing.trafficSourceMediums` (server-side, full range) and executive `newCustomers`,
`repeatCustomers`, `repeatRevenue`, `wonLeads`, `wonRevenue`, `totalCustomerRevenue`.

Tests: `npm run marketing:page-stats-test` (known scenario on a fixed past day, incl. the
midnight boundary, won leads, repeat orders), `npm run marketing:order-attribution-test` (incl.
repeat crediting), `npm run marketing:analytics-contract`, `npm run marketing:tracking-settings-test`.

## Ad platform tags (website)

Configured in Campaign Builder → Tracking & Scripts (global) and per page (page tracking). Stored
in `global_tracking_settings` / `landing_pages.tracking`, validated by
`marketing/utils/trackingSettings.js` (exact vendor ID formats; placeholder IDs such as
`G-XXXXXXXX`, `123456789` are dropped). Served to the website by
`GET /api/public/tracking/settings` (cached 60 s; the website caches it under the
`tracking-settings` tag and the API revalidates it on save). Custom header/body/footer scripts can
only be changed by Super Admins (403 `SCRIPTS_FORBIDDEN`).

| Setting | Tag | Page view | Lead (`trackAdLead`) | Purchase (`trackAdPurchase`) |
|---|---|---|---|---|
| `ga4MeasurementId` | gtag.js | route changes | `generate_lead` | `purchase` |
| `googleAdsId` + `googleAdsLeadLabel` | gtag.js | — | `conversion` (label) | — (import the GA4 `purchase` into Google Ads) |
| `googleTagManagerId` | GTM | dataLayer | `bb_lead` | `bb_purchase` |
| `metaPixelId` | Meta Pixel | `PageView` | `Lead` | `Purchase` |
| `linkedInInsightTagId` + `linkedInLeadConversionId` | Insight Tag | on load | conversion | — |
| `tiktokPixelId` | TikTok Pixel | `page` | `SubmitForm` | `CompletePayment` |
| `snapchatPixelId` | Snap Pixel | `PAGE_VIEW` | `SIGN_UP` | `PURCHASE` |
| `xPixelId` + `xLeadEventId` / `xPurchaseEventId` | X Pixel | on load | `twq('event', xLeadEventId)` | `twq('event', xPurchaseEventId, {value, currency, conversion_id})` |
| `microsoftUetTagId` | UET | on load | `submit_lead_form` | `purchase` |

Tags are injected by our nonce-trusted bundle (`src/lib/tracking/adTags.ts`), so CSP
`'strict-dynamic'` allows them; vendor hosts are listed in `src/lib/security/csp.ts`. Page-level
IDs identical to the global ones are not loaded twice. "Purchase" = order placed at checkout
(orders are invoiced and paid later; paid revenue is in our own reports).

## Cookie consent (website)

`src/lib/consent/consent.ts`, banner `src/components/consent/ConsentBanner.tsx`, footer link
"Cookie settings" (`CookieSettingsLink`). Choice stored in the first-party cookie
`bb_consent=1.a{0|1}.m{0|1}.{unix}` for 180 days.

| Category | Controls |
|---|---|
| Necessary (always on) | cart, sign-in, security, `bb_consent`, Stripe fraud-prevention cookies |
| Analytics | our visitor cookie `bb_visitor_id`, stored attribution (`bb_attribution_v1`), session storage; GA4 `analytics_storage` |
| Marketing | Meta, LinkedIn, TikTok, Snapchat, X, Microsoft UET pixels; Google `ad_storage`, `ad_user_data`, `ad_personalization`; custom header/body/footer scripts |

Defaults before a choice — `consentMode` in Tracking & Scripts:

- `auto` (default): visitors in the EU/EEA, UK and Switzerland start with everything off (country
  from the host's geo header — `x-vercel-ip-country`, `cf-ipcountry`,
  `cloudfront-viewer-country`, `x-country-code` — else a `Europe/*` time zone). Everyone else
  starts with everything on, except marketing when the browser sends Global Privacy Control.
- `opt_in`: everything off for everyone until they accept. `opt_out`: everything on for everyone.

Google Consent Mode v2: `gtag('consent', 'default', …)` (from the state above, `wait_for_update:
500`) and `ads_data_redaction` are set before gtag.js / GTM load; each choice sends
`gtag('consent', 'update', …)` and a `bb_consent_update` dataLayer event (use it as a GTM trigger
for non-Google tags inside the container). `consentModeAdvanced`: off (basic) = Google tags load
only once analytics or marketing is granted; on (advanced) = they load immediately in the denied
state (cookieless pings, `gcs=G100`). Other pixels and custom scripts load only with marketing
consent.

Without analytics consent our own tracker still records page views, sources and leads, but with a
visitor / session id that lives only in memory for that page (no cookie or storage). Accepting
later on the same page keeps that visit's id and attribution. Withdrawing deletes our analytics
cookie/storage and known vendor cookies on our domain (`_ga*`, `_gcl_*`, `_fbp`, `_uet*`,
`_scid*`, `ttclid`, …) and reloads the page when pixels or scripts were loaded (they cannot be
unloaded).

### Consent log (proof of consent)

The cookie carries a random consent id: `bb_consent=1.a1.m0.<unix>.<consentId>`. Every saved
choice is sent (fetch keepalive, before any reload) to `POST /api/public/tracking/consent` and
stored in `marketing_consent_log` (migration 031): consent id, choices, action (`accept_all`,
`reject_all`, `custom`), consent mode, whether the visitor was in an ask-first region, country,
Global Privacy Control, privacy policy version (`PRIVACY_POLICY_VERSION`, must match the policy's
"Last updated"), banner version, page path, anonymized IP, user agent, time. The analytics visitor
id is stored only when analytics was allowed. Bots get 204 and nothing is stored; the endpoint has
its own rate limit (`MARKETING_CONSENT_RATE_LIMIT_MAX`, default 30/min). Records are purged after
`MARKETING_CONSENT_LOG_RETENTION_DAYS` (default 1095) by the scheduler.

Admin (marketing auth): `GET /api/admin/analytics/consent?from=&to=` (choices, accept / reject /
custom, analytics and marketing opt-in rates, by region) and `GET /api/admin/analytics/consent/:consentId`
(history for one browser). Shown in Campaign Builder → Tracking & Scripts → Consent log.
Test: `npm run marketing:consent-log-test`.

## Products & store (website → `marketing/services/productAnalytics.service.js`)

Store events (website `src/lib/analytics/commerce.ts`; metadata is whitelisted server-side by
`marketing/utils/productEvents.js`, max 16 KB per event):

| `event_type` | When | Metadata |
|---|---|---|
| (page view) | product page `/products/{slug}-{id}`, `/products/detail/{id}`, `/shop/{…}-{id}` | `product_id` derived from the URL |
| `view_item_list` | shop list shown (first page of a category) | `list`, `category`, `count` |
| `select_item` | product card clicked | `productId`, `position`, `list` |
| `add_to_cart` / `remove_from_cart` | cart change (`CartContext`) | `productId`, `name`, `qty`, `price`, `value` |
| `update_cart_qty` | quantity change | `productId`, `from`, `to` |
| `view_cart` | `/cart` shown | `items[]`, `value` |
| `begin_checkout` | `/checkout` shown with items | `items[]`, `value` |
| `login` / `sign_up` | sign-in (password / OTP) / account created | `method` only |
| `quote_requested` | "Request a quote" sent for a product (guests do not see prices; the lead itself is a `lead_submissions` row with `fields.formType = product_quote`, `productId`, `productName`, `quantity`) | `productId`, `name`, `qty`, `formType` |

Products report: `quoteRequests` per product and in totals. Journeys: "Requested a quote for X".

Columns (migration 032): `product_id` (URL or cart metadata), `customer_user_id` (signed-in account,
sent by the website **only with analytics consent**). Website 404 views (`app/not-found.tsx` renders
`[data-bb-not-found]`, the tracker adds `metadata.notFound`) are stored with `page_type = 'not_found'`
and excluded from page reports. Orders store their line items (`marketing_order_attribution.items`,
from `bookOrder`; untracked repeat orders from the commerce `items` table).

Admin endpoints (marketing auth): `GET /api/admin/analytics/products`, `/products/:productId`, `/store`
(funnel product view → cart → cart page → checkout → order → paid, abandoned carts), `/time-patterns`
(hour × weekday heatmaps in the business time zone), `/broken-links`, `/journey?visitorId|leadId|orderId|customerUserId`.
Site pages get order credit through the entry page of the ordering visit (last touch) / of the
visitor's first visit (first touch).

**Customer details** (names, companies, emails, phones, customer journeys) are returned only to
Super Admins and roles listed in `MARKETING_CUSTOMER_PII_ROLES`; everyone else gets
`Customer #id` and 403 on customer journeys. Every response with identified customers is written to
`marketing_pii_access_log` (Super Admins: `GET /api/admin/analytics/pii-access-log`, Tracking &
Scripts → Customer data access log), purged after `MARKETING_PII_LOG_RETENTION_DAYS` (730).

One-off: `npm run marketing:backfill-product-analytics -- [--apply] [--with-customers]` (product ids on
old product views, old 404 views, order items, customer links). Test: `npm run marketing:product-analytics-test`.

## Repair

`node marketing/scripts/cleanupSlugPollution.js [--apply]` re-derives page fields for events with a
pathname and rebuilds session fields from events. Dry run by default, idempotent.
