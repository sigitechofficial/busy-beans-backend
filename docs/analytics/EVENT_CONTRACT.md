# Marketing analytics — event contract

Ingest: `POST /api/public/tracking/events` (one event) and `POST /api/public/tracking/touchpoints`.
Stored in `marketing_analytics_events` / `marketing_touchpoints`; sessions in `marketing_sessions`.
Checked by `npm run marketing:analytics-contract` and `npm run marketing:attribution-test` (local DB
only — they write and remove test rows).

## Page context (derived server-side)

`marketing/utils/analyticsPayload.js#resolvePageContext` derives these from the event's `pathname`;
client-sent values for them are not trusted.

| Column | Value |
|---|---|
| `page_type` | `landing_page` when `pathname` is `/lp/{slug}`, else `site`; `null` when there is no pathname (server events) |
| `page_slug` | Every page event. `/lp/{slug}` → `{slug}`; other paths → path with `/` replaced by `-` (`/` → `home`) |
| `landing_page_slug` / `landing_page_id` | Only on `/lp/{slug}` events. Cleared on other paths even if the client sent them. Kept as attribution on events without a pathname |
| `site` | `metadata.site` or `site`, one of `customer-website`, `campaign-lp`, `campaign-preview`, `server`; else `null` |
| `page_type = preview` | Campaign Builder canvas / preview traffic (see "Preview / editor traffic"): never reported |

Reports that are "per landing page" must filter `page_type IS NULL OR page_type = 'landing_page'`.

## Event types sent by the website tracker

| `event_type` | When | Metadata |
|---|---|---|
| `page_view` | Site page view (deduped per path + session) | device, pageTitle, `site` |
| `landing_page_view` | `/lp/{slug}` view | same |
| `cta_click` | CTA / button / link click | `cta_name`, `cta_location`, `page_path`, `label` (never personal data: no signed-in name, emails, numbers) |
| `phone_click`, `email_click`, `whatsapp_click` | `tel:` / `mailto:` / WhatsApp link click (never the number or address) | same as `cta_click` |
| `form_view` | Form scrolled into view, once per form per page per session | `form_id` |
| `form_start` | First interaction with a form, once per form per page per session | `form_id` |
| `form_error` | Invalid fields on submit, or the lead API failed | `form_id`, field names / `code` (never values) |
| `form_submit` | Submit attempt (before the lead API call) | `form_id` |
| `form_success` | The server stored a real (non-test) lead; `fetch keepalive` | `form_id`, `event_id`, `lead_id` |
| `lead_created` | **Recorded by the server** when it stores a real lead (`id = lead-<event_id>`) | `leadId`, `formId`, `eventId` |
| `scroll_depth` | 25/50/75/90% buckets | `depthPct` |
| `page_engagement` | Page hidden / closed / left; sent with `fetch keepalive` | `activeMs` (visible + focused + activity in last 30 s), `maxScrollPct` |

Sum of `page_engagement.activeMs` for a page = its engaged time. Backend caps one event at 30 min.
Imported (custom HTML) pages run in a sandboxed iframe; the frame posts `bb-ch-activity` (throttled
to one per 5 s) on pointer/key/scroll activity and the host re-emits it as a `bb:activity` window
event, so time spent interacting inside the frame counts as active.

## Attribution model (website `src/lib/analytics/client/*`, server `marketing/utils/attribution.js`)

### Touches

A **touch** is how a visit started: `{ channel, source, medium, campaign, content, term, utmId,
sourcePlatform, creativeFormat, marketingTactic, meta, extraUtm, referrer, referrerDomain,
landingPage, landingUrl, rawQuery, clickIds, conflict, timestamp }` (server adds `receivedAt`).

| Model | Meaning | Where |
|---|---|---|
| first touch | visitor's first touch (write-once) | `marketing_visitors.first_touch`, lead `first_touch*` |
| last touch | visitor's latest touch, Direct included | `marketing_visitors.last_touch`, lead `last_touch*` |
| last non-direct touch | latest touch that wasn't Direct; a Direct revisit never replaces it | `marketing_visitors.last_non_direct_touch`, lead `lnd_*` |
| session touch | how this visit started (write-once, first touchpoint of the session) | `marketing_sessions.channel/source/…/touch`, lead `session_touch` |
| conversion touch | session touch + conversion page + server time | lead `conversion_touch` |

A lead's own `channel/source/medium/campaign/content/term` = last non-direct touch, else the
session touch ("last non-direct click").

**When a touch is created (website):** only on the first page view of a document load, or when a
session starts. Client-side (SPA) navigation never reads `document.referrer` or the URL, so it
never creates a touch; UTMs are never added to internal links. A new session starts after 30 min
of inactivity, or when a page load brings a *different* campaign/external source than the
current session's. Own-domain referrers (same registrable domain) and payment / sign-in returns
(Stripe, PayPal, Google/Apple/Microsoft sign-in) are not touches.

Example (spec scenario "paid → direct return"): Google Ads visit, then a Direct visit days later →
first = Google Ads, session = Direct, last = Direct, last non-direct = Google Ads; a lead in the
second visit is credited to Google Ads, with `last_touch_channel = Direct`.

### Parsing

- UTMs: `utm_source/medium/campaign/content/term/id/source_platform/creative_format/marketing_tactic`;
  any other `utm_*` is kept (sanitized, max 20) in `extraUtm`.
- Ad metadata (`meta`): `campaign_id/name`, `ad_group_id/name` (`adgroupid`), `adset_id/name`,
  `ad_id/name`, `creative_id`, `placement`, `network`, `device`, `match_type`, `keyword`,
  `affiliate_id`, `partner_id`.
- Click IDs: `gclid, gbraid, wbraid, dclid, fbclid, msclkid, ttclid, li_fat_id (liFatId), twclid,
  ScCid, epik, rdt_cid` — each stored with the time it was received (`{ value, at }`).
- Limits: source/medium/channel 100, campaign/content 255, term 500, click IDs 512, URLs 2048.
- Privacy: email-like values and parameters named like personal data (`email`, `phone`, `name`,
  `address`, …) are replaced by `[redacted]` in stored URLs, queries and UTM values.

### Channels (16) and classification (first match wins)

`Direct, Organic Search, Paid Search, Organic Social, Paid Social, Email, Referral, Affiliate,
Partner, Display, Video, WhatsApp, SMS, QR, Offline, Other`

1. `utm_medium` via the alias map (e.g. `cpc/ppc/sem/paid_search` → Paid Search;
   `paid_social/social_paid/paid-social/facebook_ads` → Paid Social; `display/banner/cpm` →
   Display; `email/newsletter` → Email; `social/organic_social` → Organic Social;
   `affiliate`, `partner`, `sms`, `whatsapp`, `qr`, `print/event/offline` …). Generic
   `cpc/ppc/paid` with a social `utm_source` → Paid Social. Unknown medium → Other. The raw
   medium is always stored as `medium`.
2. `utm_source` only → from the source (search engine, social network, email tool, WhatsApp…).
3. Click IDs: `gclid/gbraid/wbraid` → Paid Search/google, `msclkid` → Paid Search/bing, `dclid` →
   Display, `ttclid/li_fat_id/twclid/ScCid/epik/rdt_cid` → Paid Social; `fbclid` alone →
   Organic Social (Meta adds it to organic clicks too).
4. `affiliate_id` → Affiliate, `partner_id` → Partner.
5. External referrer: known search / social / email / AI-assistant hosts, else Referral.
6. Nothing → Direct (`source = direct`, `medium = none`).

`conflict = true` when UTMs and click IDs point at different platforms (diagnostic only; the UTM
wins).

**UTM convention for ads:** `utm_source` = platform (`facebook`, `instagram`, `linkedin`, `google`,
`tiktok`, `bing`…), `utm_medium` = `paid_social` / `cpc` / `email` / `qr` / `referral`,
`utm_campaign` = campaign name.

### Server authority

The browser's attribution is a claim. On every touchpoint and lead the server:

1. validates types/lengths and keeps only known properties,
2. re-parses UTMs, click IDs and metadata from the raw landing URL,
3. re-classifies the channel (client `channel/source/medium` are ignored),
4. reconciles with its own records: `marketing_visitors` / `marketing_sessions` touches win;
   the browser's (validated) touches are used only where the server has none
   (`lead_submissions.attribution_basis` = `server` | `client` | `legacy` | `none`); a
   disagreement sets `attribution_conflict`,
5. stores normalized columns plus the raw landing URL (`landing_page_url`), query (`raw_query`)
   and referrer (`referrer_url`).

Server-decided values, never taken from the body:
- `test_mode`: a valid Campaign Builder JWT (scope `marketing`) on the request, or a `previewToken`
  matching the landing page's `preview_token`. Test leads fire no conversions and record no
  `lead_created`.
- `submitted_at` / `created_at`: server time. The browser time is kept in `client_submitted_at`
  (only when within 2 years / 5 min).
- Event and touchpoint times from the public endpoints: the browser clock only when it is at most
  24 h old and 2 min ahead; otherwise server time (`metadata.clientTimestamp` keeps the original).
- `lead_created`: recorded by the server when it stores a real lead (id `lead-<eventId>`); a
  browser-sent `lead_created` is answered 204 and dropped.

Lead ingest also: honeypot `bb_hp` (filled → normal-looking response, nothing stored),
20 requests/min/IP, max 50 fields × 5,000 chars (32 KB), 64 KB body limit on `/api/public/*`,
idempotent on `event_id` (unique; a retry returns the same lead).

### Lead record

`lead_id (sub_N), visitor_id, session_id, event_id, form_id, section_id, channel, source, medium,
campaign, content, term, first_touch, last_touch, last_non_direct_touch, session_touch,
conversion_touch (JSON), first_touch_*/last_touch_*/lnd_* source/medium/channel, gclid, gbraid,
wbraid, dclid, fbclid, msclkid, ttclid, li_fat_id, twclid, click_ids (JSON with times),
referrer_url, referrer_domain, first_landing_page, session_landing_page, landing_page_url (raw
landing URL), conversion_page, raw_query, attribution_conflict, attribution_basis,
client_submitted_at, submitted_at, created_at`. Unknown values are `NULL`. The legacy
`attribution` JSON keeps the same flat keys as before (`source`, `utmSource`, …) for older readers.

### Reports: which source?

Every report reads lead attribution through `marketing/utils/leadAttributionSql.js`:

| Label | Definition |
|---|---|
| Session Source | the visit's own source: events `attribution` (website sends the session touch), `marketing_sessions.source`, lead `session_touch` |
| First Touch Source | lead `first_touch_*`; orders `first_touch` (report `touch=first`) |
| Last Touch Source | lead `last_touch_*` (Direct included) |
| Last Non-Direct Source | lead `source/medium/campaign` (= `lnd_*`, else session); orders `last_touch` (report `touch=last`, default) |
| Conversion Source | lead `conversion_touch` |

`leadAttrExpr(field, { touch })` models: `last` (operational lead source = last non-direct ??
session), `first`, `lastAny`, `lnd` (last non-direct only), `session`, `conversion`. The
operational source is a derived copy; the five touch models are stored independently and never
overwritten by it.

Traffic-source visitor counts come from touchpoints (each visitor counted once per source in the
range).

### Future hooks (Phase 7, not implemented)

Meta CAPI, Google Ads offline / enhanced conversions and CRM sync can read the lead row: `event_id`
(also sent as the browser Meta `eventID`, Google `transaction_id`, TikTok `event_id`, Snap
`client_dedup_id`, X `conversion_id`), click IDs with their times (`click_ids`), `submitted_at`
(conversion time) and `lead_id`. No uploads exist yet.

### Campaign Builder-hosted `/lp` pages

The Campaign Builder's own tracker (`page-builder-nextjs/src/features/analytics/client`) follows
the same rule: a touchpoint only for the entry page of a document load with UTMs / a click ID /
an external referrer, or for a new session (Direct). Internal navigation sends page views only.
The server also ignores a touchpoint without campaign parameters in a session that already has
its acquisition touch when it is Direct or repeats the session's own entry referrer (older cached
bundles sent one per page view).

### Preview / editor traffic

Events whose path is `/preview/…` or `/admin/…`, or that carry a Campaign Builder JWT, are stored
with `page_type = 'preview'`, `site = 'campaign-preview'` and touch no visitor/session; such
touchpoints are not stored. No report reads `page_type = 'preview'`.

No production conversions from test contexts: the Campaign Builder app installs no ad tags; in
its canvas and `/preview/…` pages, ad / analytics tags an author pasted into custom HTML (Google,
Meta, LinkedIn, TikTok, UET, Snapchat, X, Pinterest, Reddit) are removed before the isolated frame
renders (`stripAuthorAdTags`). On the website, `trackAdLead` (GA4 `generate_lead`, Google Ads
conversion, Meta `Lead`, LinkedIn, TikTok, UET, Snapchat, X) runs only when the server stored a
real lead (`testMode: false`); test leads also record no `lead_created`.

## Reporting definitions

One definition per metric, used by the API (`marketing/services/*`), the Campaign Builder dashboard and
this document. "Real" traffic excludes Campaign Builder preview / canvas traffic
(`marketing/utils/reportFilters.js`); "real" leads have `test_mode = 0`. Checked by
`npm run marketing:reporting-test`.

| Term | Definition |
|---|---|
| Visitor | One browser: `visitor_id` (first-party `bb_visitor_id` cookie; `sessionStorage` when analytics consent is refused). Another device, browser or cleared cookies = another visitor. **Dashboard / reports total**: distinct visitors with a real session that started in the range. **Page reports**: distinct visitors with a view of that page. **Traffic sources / campaigns**: distinct visitors with an acquisition touchpoint from that source / campaign in the range |
| Session | One visit (`marketing_sessions`). Website: new after 30 min without activity, or when a page load brings a different campaign / external source; shared across tabs. Campaign Builder-hosted `/lp`: per tab, 30 min idle |
| Page view | One `page_view` / `landing_page_view` event (an immediate repeat of the same path in the same session is not re-sent) |
| Lead | A `lead_submissions` row with `test_mode = 0` and `submitted_at` (server time) in the range. Honeypot submissions are never stored; test / preview leads (Campaign Builder session or preview token) are excluded everywhere |
| Operational lead source | The lead's `channel/source/medium/campaign/content/term` = last non-direct touch ?? session touch, decided by the server when the lead is stored (report `touch=last`, the default) |
| First touch | The visitor's first acquisition touch (server visitor record; the browser's validated claim only when the server has none) — `first_touch*`, report `touch=first` |
| Last touch | The visitor's most recent acquisition touch, Direct included — `last_touch*` |
| Last non-direct touch | The most recent touch that was not Direct; a later Direct visit never replaces it — `last_non_direct_touch` / `lnd_*` |
| Session touch | How the converting visit started — `session_touch` |
| Conversion touch | Session touch + conversion page + server time of the lead — `conversion_touch` |
| New visitor | A visitor in the range with exactly one session up to the range end |
| Returning visitor | A visitor in the range with 2+ distinct sessions up to the range end. Several page views in one session never count. New + returning = visitors |
| Lead conversion rate (dashboard) | Distinct visitors with a real lead in the range ÷ visitors (visitor → lead), max 100% |
| Visitor → lead / session → lead (reports) | Acquisition rates, see "Reporting API": visitors / sessions that started in the period (by how the visit started) that produced a real lead ÷ all of them |
| Attributed lead share (reports) | Leads credited to a row under the selected model ÷ all leads (replaces "lead rate" by source in new reports) |
| Landing page conversion rate | Sessions with a lead on that page ÷ sessions with a view of that page (session → lead, `leadConversionRate`) |
| Lead rate (traffic sources) | Leads credited to the source (lead attribution model) ÷ visitors who arrived from it (touchpoints). Indicative only — see below |

### Totals that intentionally do not reconcile

- **Visitors by source / campaign / page** add up to more than total visitors: a visitor who arrived
  from two sources (or saw two pages) is counted in each row. The traffic tab labels this
  "Visitors by source (sum)".
- **Leads by source / source+medium / campaign** do reconcile with total leads (every lead has exactly
  one operational source; no campaign → `(not set)`, no source → `direct`).
- **Leads by landing page** is not total leads: site-page and non-landing-page leads are in the
  site-pages report (via the server `lead_created` event) and leads without a page are in neither.
- **Lead rate by source** mixes two models (leads use the lead attribution model, visitors are every
  source a visitor arrived from), so it can exceed 100% for a source that converts returning visitors.
- **Switching `touch`** changes lead, won-lead and order credit, never visitor counts.
- **Dashboard funnel** counts events, not sessions (the per-page funnel counts sessions in order).
- **Orders / revenue** use their own attribution (the browser's first / last non-direct touch at
  checkout), not the lead's.
- **Older rows**: site-page lead counts can include browser-sent `lead_created` events recorded before
  the server started recording them (they could include test leads).

## Reporting API (Phase A)

`GET /api/admin/analytics/reports/*` (Campaign Builder login required). Implementation:
`marketing/services/reports.service.js`; shared query layer `marketing/utils/reportQuery.js`
(periods, comparison, attribution model, drill filters, CSV); real-traffic rules
`utils/reportFilters.js`; lead attribution SQL `utils/leadAttributionSql.js`. Tests:
`npm run marketing:reports-test`, `npm run marketing:reporting-test`.

Common parameters:

| Param | Values |
|---|---|
| `range` | `today`, `yesterday`, `last_7_days`, `last_30_days` (**default**), `this_week` (Monday start), `last_week`, `this_month`, `last_month`, `all_time`, `custom` (+ `from` / `to` = YYYY-MM-DD business days, inclusive) |
| `compare` | `previous`: same number of days just before; `last_month` → the previous full month; `this_month` → the same days of the previous month; none for `all_time` |
| `attribution` | `operational` (default), `first`, `last` (Direct included), `last_non_direct`, `session`, `conversion`. Older endpoints also accept `touch=first` |
| `channel` `source` `medium` `campaign` `content` `term` | Drill filters (exact bucket value, e.g. `Unknown`, `(not set)`) |

Days are business days in `MARKETING_REPORT_TIMEZONE` (echoed as `period.timeZone`); storage is
UTC. The older analytics endpoints (`/dashboard`, `/pages`, `/products`, …) accept the same `range`
presets; without any range they still default to all time.

| Endpoint | Returns |
|---|---|
| `reports/overview` | Visitors, sessions, page views, leads, visitor → lead %, session → lead %, won leads, lead revenue, orders, order revenue, new / returning visitors; with `compare` each metric has `previous`, `delta`, `deltaPct` (`null` = N/A when the previous value is 0) |
| `reports/acquisition?dimension=channel\|source\|medium\|campaign\|content\|term` | One row per value at that level, under the drill filters; `totals`; `format=csv` returns the same rows as CSV |
| `reports/leads` | Server-side lead list: `page`, `pageSize` (10–100), `sort` (`submittedAt`, `status`, `revenue`, `channel`, `source`, `campaign`), `dir`, filters `status`, `channel`, `source`, `medium`, `campaign` (operational), `landingPage`, `form`, `firstSource`, `lastSource`, `lndSource`, `test` (`real` default / `test` / `all`), `q` (lead id or text in the form) → `{ rows, total, page, pageSize, pages }` |
| `reports/leads/export` | CSV of the same filtered list (newest 10,000; header `X-Export-Truncated` when cut). Contact columns (name, email, phone, company) only for roles allowed to see customer details (`MARKETING_CUSTOMER_PII_ROLES`), and each such export is written to the PII access log |

### Acquisition vs attribution (why no rate exceeds 100%)

| Group | Counted from | Metrics |
|---|---|---|
| Acquisition | Real sessions that **started** in the period, by the session's own acquisition touch (`marketing_sessions.channel/source/…`) | Visitors (distinct), sessions, **visitor → lead** = visitors acquired by the row who submitted a real lead in the period ÷ visitors, **session → lead** = sessions acquired by the row that produced a lead ÷ sessions. Always ≤ 100% |
| Attribution | Real leads **submitted** in the period, grouped by the selected model | Leads, **attributed lead share** = leads ÷ all leads (not a conversion rate), won leads and **lead revenue** (revenue of leads of that cohort now Won) |
| Orders | Paid orders in the period, by the order's own attribution (first / last non-direct touch at checkout) | Orders, **order revenue** — reported next to lead revenue, never added to it |

### Reconciliation (Phase A reports)

| Report | Reconciles to |
|---|---|
| Leads by channel / source / medium / campaign / content / term (any model) | Total real leads in the period (`Unknown` / `(not set)` buckets included) |
| Attributed lead share | Sums to 100% |
| Sessions by any dimension | Total sessions |
| Visitors by any dimension | **Not** total visitors: a person whose visits came from two sources counts in both rows; the totals row shows distinct visitors |
| Won leads / lead revenue by dimension | Overview won leads / lead revenue (same cohort) |
| Order revenue by dimension | Overview order revenue |
| Drill level | The rows under a parent sum to the parent row (sessions, leads, won, revenue) |

### Cost metrics (not connected)

Spend is not ingested, so the UI shows no CPL / CPA / ROAS. When a spend source exists (Google
Ads, Meta, LinkedIn, Microsoft, TikTok APIs or a CSV upload, joined on platform + campaign /
ad group / ad ids): **CPL** = spend ÷ leads, **CPA** = spend ÷ won leads (or paid orders, to be
agreed), **ROAS** = revenue ÷ spend.

## Conversion reports (Phase B)

`GET /api/admin/analytics/reports/forms | ctas | funnel | timing | trends` — same period, comparison,
attribution and drill parameters as the Phase A reports, plus `segment` (`channel`, `source`,
`medium`, `campaign`, `landingPage`), `landingPage` (entry landing page slug), `form` + `page`
(one form), `scope` (`landing` | `any`, funnel), `granularity` (`day` | `week` | `month`, trends)
and `format=csv` (forms, CTAs, funnel, timing). Implementation:
`marketing/services/conversionReports.service.js` (SQL aggregation only). Test:
`npm run marketing:conversion-test`.

**Scope.** Forms, CTAs, the funnel and trend visits are EVENT reports: drill filters, segments and
the landing-page filter use the visit's own acquisition touch (`marketing_sessions`) and entry
landing page — the attribution model does not apply (the UI says so). Conversion time is a
LEAD report: filters and segments use the selected attribution model.

**Form identity.** Every form carries one id on both sides: website forms set
`data-analytics-form` (`hero_tasting_request`, `contact_page`, `machine_contact`,
`machine_enquiry`, `campaign_tracking`, `product_quote`) and submit the same `formId`; landing-page
lead forms use their section id (`data-analytics-form={sectionId}`, Campaign Builder
`form_start` / `form_submit` carry `form_id`). Reports compare normalised keys (lower-case,
non-alphanumerics → `_`), so `sec-hero` (lead) and `sec_hero` (event) are the same form. Rows are
per form **and** page, so two forms on one page are never merged. Landing-page forms show their
section heading when the page has one; otherwise the technical id — nothing is invented. Leads
store the page they were submitted on (`lead_submissions.page_type` / `page_slug`, migrations
040 / 041) with the same key as events.

| Metric | Definition |
|---|---|
| Form views / starts / submits | Unique sessions with that event for the form on that page (raw event counts shown as secondary) |
| View → start | Sessions that viewed AND started ÷ sessions that viewed |
| Start → submit | Sessions that started AND submitted ÷ sessions that started |
| Start → lead | Sessions that started the form AND stored a real lead with that form in the same session ÷ sessions that started |
| Submit → lead | Same, from submit sessions (a submit whose lead failed is not a lead) |
| Form leads | All real leads stored with the form on that page (also leads without tracked events) |
| CTA clicks / sessions | `cta_click`, `phone_click`, `email_click`, `whatsapp_click` per type · name (`cta_name`, else label) · location · page; unique sessions clicking |
| CTA → lead | Sessions that clicked and stored a real lead in the SAME session at / after the click ÷ sessions that clicked (never leads ÷ raw clicks) |
| Lead in a later visit | Sessions whose visitor stored a real lead in a LATER session within the period (assist, never mixed into CTA → lead). Phone / email / WhatsApp clicks are engagement, not leads |
| Funnel | Sessions started in the period → (landing) page view → CTA click (any CTA type) → form start → form submit → real lead stored from that session. A session passes a step only if the event happened at / after the previous step; each session counts once per step. Per step: sessions, % of previous, drop-off, % of all sessions. Segments add up to the total (each visit has one acquisition) |
| Time to conversion | Lead time − first-touch time (first touch received / clicked; else the visitor's first recorded session) |
| Sessions before conversion | The visitor's real sessions that started up to and including the converting session |
| Same-session / multi-session | Sessions before conversion = 1 / ≥ 2 (from session ids, not from time) |
| Time buckets | Same session (exclusive) · < 1 day · 1–3 days (1 ≤ d < 4) · 4–7 · 8–30 · 31–90 · 90+ days; shares of leads with complete history |
| Single / multi-source journey | Lead first-touch source = / ≠ the converting session's source (descriptive only) |
| Trends | Visitors / sessions: visits started in each bucket; leads: real leads submitted in it; visitor / session → lead: visits in the bucket that produced a lead; form-start / form-submit / CTA sessions. ≤ 31 days daily, ≤ 180 weekly (Monday), else monthly; compared only when the previous period has the same number of buckets |

"Lead after X" allows 2 minutes of clock difference (the same browser-clock tolerance ingest
accepts).

**History for timing.** `complete`: the lead's session is recorded and the visitor has a server
first touch. `partial`: session recorded but the visitor predates first-touch tracking (earlier
visits may be missing). `unknown`: no recorded session (no visitor / session id, or tracking was
blocked). Only complete leads feed averages, medians and buckets; the others are counted and shown
as excluded — never assumed to be one session.

**Legacy data.** Form events recorded before form ids existed (and Campaign Builder events before
this change) fall into `(not set)` — their leads still count on the right form. The site funnel
counts steps from events, so older sessions without CTA / form events simply stop earlier.

**Indexes (EXPLAIN).** Form / CTA / trend events use `(event_type, timestamp)`; funnel steps use
`(session_id, timestamp)`; sessions `started_at`; leads `(test_mode, submitted_at)`, `session_id`,
`visitor_id`. Form id / CTA name / location are read from event metadata JSON only for form and
CTA events inside the period (a small share of events); promote them to columns only if those
event volumes become large.

## Business outcome reports (Phase C)

`GET /api/admin/analytics/reports/lead-quality | revenue | attribution-comparison |
audience/new-returning | audience/direct | audience/referrer-urls` (+ `acquisition` for the
Organic Search / Social / Referral views: `channel=<channel>&dimension=searchEngine|socialNetwork|source`).
Same period, timezone, `compare=previous`, `attribution`, drill filters, real/test/preview
exclusion and Unknown / (not set) buckets as Phase A; `format=csv` everywhere except referrer URLs.
Implementation: `marketing/services/outcomeReports.service.js` on the shared
`reports.service.getAcquisition` (one metric definition for every report). Test:
`npm run marketing:outcome-test`.

**Lead status = current status only.** `lead_submissions.conversion_status` (New · Contacted ·
Qualified · Won · Lost) holds one value; no status history is stored, the admin can set any
status at any time (no enforced order) and `converted_at` is only "marked Won at" (cleared when
the lead leaves Won). Reports are therefore **current-state**: counts per current status (they add
up to the leads), never transitions, never time between statuses.

| Metric | Definition |
|---|---|
| Qualified (or won) | Current status Qualified **or** Won. Won counts because it is the later stage by meaning — the system does not record whether a won lead was ever marked Qualified. Lost does **not** count (the stage it was lost at is unknown) |
| Qualified rate | (Qualified + Won) ÷ leads |
| Win rate / loss rate | Won ÷ leads / Lost ÷ leads (same denominator as Phase A) |
| Status funnel | Lead → Contacted or later (Contacted + Qualified + Won) → Qualified or later (Qualified + Won) → Won, from current status; Lost shown beside it as an outcome |
| Lead revenue | Amounts entered by sales on **Won** leads (`lead_submissions.revenue`; an amount on another status is not counted) |
| Average won value | Lead revenue ÷ won leads **with an amount entered** |
| Revenue per lead / per qualified lead | Lead revenue ÷ leads / ÷ (Qualified + Won) |
| Order revenue, orders, AOV | Paid online orders (`marketing_order_attribution`, by `paid_at`) with the order's own attribution: first touch for the First-touch model, else the last non-direct touch stored at checkout. AOV = order revenue ÷ paid orders |

**Lead ↔ order.** Leads have no customer / order id (only a shared `visitor_id`), so no report
claims that a lead produced an order. Lead revenue and order revenue can describe the same
business and are **never added together** (the older "Total customer revenue" / "Total revenue"
displays in the legacy Executive, Customers and Traffic-source views were removed for this reason;
the API fields remain for compatibility).

**Attribution comparison.** Leads, won leads and lead revenue per channel / source / campaign
under all six models in one statement (the lead set is materialised once — `NO_MERGE` — and
grouped six times). Each model credits every lead once, so every column adds up to the same
total. The UI shows movement against a chosen baseline (sum of |difference| ÷ 2 = credit that
changes row) — attribution movement, not a performance change. Drill filters and the model
selector do not apply (every model is shown).

| Model | Credits the lead to |
|---|---|
| Operational (default) | Last non-direct touch; if the visitor never had one, how the converting visit started (stored on the lead) |
| First touch | The visitor's first recorded touch (older leads: first-touch fields sent with the lead) |
| Last touch | The visitor's most recent touch before the lead, Direct included |
| Last non-direct | Most recent non-direct touch; none → Unknown / (not set), never Direct |
| Session | How the converting visit started |
| Conversion | The converting visit's touch stored with the conversion page and time — same source as Session |

**Direct.** Three different questions, never merged: *true last touch = Direct* (Last-touch
model), *conversion session = Direct* (the visit in which the lead was submitted started Direct;
Session / Conversion models), *operational source = Direct* (no earlier non-direct touch).
Leads converted in a Direct visit are split into **truly Direct** (operational = Direct) and
**credited to an earlier source** (operational = the last non-direct touch, listed by channel /
source / campaign). Direct order revenue = paid orders with no non-direct touch at checkout.

**Organic / social / referral views.** The shared acquisition query with a channel constraint
(no per-channel logic): Organic Search grouped by engine (Google · Bing · DuckDuckGo · Yahoo ·
Other), Organic Social and Paid Social (separate) grouped by network (Facebook · Instagram ·
LinkedIn · TikTok · YouTube · X · Reddit · Pinterest · Other), Referral grouped by referring site
(= source: the referrer domain for untagged referrals, a name for AI assistants, the utm_source for
tagged referral links). Groups use the canonical source names from `utils/attribution.js`.
Organic search keywords are not available (search engines do not pass them) and are not
estimated. Referring URLs load only on request (top 50, query strings removed — they can carry
tokens).

**New vs returning.** Visitor-level, no attribution model: New = one real visit up to the end of
the period, Returning = two or more (the Phase A definition). The same rule groups visits, leads
and paid orders (via `visitor_id`), so the groups add up; leads / orders without a recorded visit
form their own row. Average visits per visitor = all visits up to the period end. Conversion
behaviour reuses Phase B timing (complete history only): a new visitor's leads convert in the
first visit by definition.

**Comparison / trends.** Every Phase C report returns its totals for the previous period
(`compare=previous`): `{ value, previous, delta, deltaPct }`, `deltaPct` null when the previous
value is 0. Trends (Phase B engine) add qualified leads, won leads and lead revenue (current status
of the leads submitted in each bucket — not the day the status changed) and paid orders / order
revenue (by payment day, order attribution).

**Lead list.** `status` accepts several statuses (`status=qualified,won`).

**Timezone fix.** Report instants are passed to SQL as UTC strings (`reportQuery.sqlTime`):
Sequelize formats a `Date` replacement in the Node process's local timezone, which shifted every
report window by the host's UTC offset on non-UTC machines (UTC servers were unaffected).

**Indexes (EXPLAIN).** No new indexes. Lead reports use `(test_mode, submitted_at)`; the
comparison reads that range once; channel-constrained views use `ms_channel_started_idx`
(filters compare the plain column when the value is not the Unknown bucket); referrer URLs use
`ms_source_medium_idx`; new vs returning / Direct use the visitor index for per-visitor visit
counts; orders use `moa_status_created_idx` / `moa_status_paid_idx`.

**Report navigation / legacy consolidation.** Campaign Builder › Analytics: Overview ·
Acquisition (Channels · Sources · Campaigns) · Conversion (Landing pages · Site pages · Forms ·
CTAs · Funnel · Timing · Trends) · Outcomes (Lead quality · Revenue · Attribution comparison ·
Customers) · Audience (New vs returning · Organic search · Social · Referral · Direct) · Products ·
Leads, and a "Legacy reports" menu. Every change is a URL (history push); old links
(`tab=landing_pages`, `tab=customers`, `tab=compare&compare=a,b`, …) still open.

| Legacy view | Covered by | Status |
|---|---|---|
| Executive: visitors, leads, orders, order revenue, lead conversion, won leads, returning visitors | Overview (Phase A/C KPIs, acquisition-based, comparable) | Replaced |
| Executive: AOV | Outcomes › Revenue | Replaced |
| Executive: new / repeat customers, add-to-cart, checkouts, sign-ins, sign-ups, recent activity | Outcomes › Customers, Products; nothing else for sign-ins / sign-ups / recent activity | **Keep** (legacy menu) |
| Traffic sources: source · medium table | Acquisition › Sources (drill to medium) | Replaceable — kept until owners confirm (different, visitor/first-touch-based definitions) |
| Marketing: new / returning, traffic summary, UTM campaigns | Audience › New vs returning, Acquisition | Replaced |
| Marketing: recent touchpoints / events feed | — | **Keep** (legacy menu, "Marketing activity") |
| Event funnel incl. add-to-cart / checkout / orders | Conversion › Funnel covers the lead path only | **Keep** |
| Customers, Landing pages, Site pages, Compare, Products | Moved under Outcomes / Conversion / Products (unchanged) | Kept |

**Not in Phase C.** Spend, CPL / CPA / ROAS, CRM stages (SQL, quote sent, deal stages), status
history and CRM sync.

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
- `channel`, `source`, `medium`, `campaign`, `content`, `term`, `referrer`, `landing_url`, `touch`
  — the session's acquisition touch, set once by its first touchpoint (conditional update).
- `last_activity_at` — server time of the latest event.

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
