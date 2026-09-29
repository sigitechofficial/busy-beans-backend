# Marketing Analytics & Leads — Frontend API Guide

> **Partly outdated (2026-09).** Dashboard revenue/avg time are real values now, there is a `touch` parameter, and per-page reports live at `/api/admin/analytics/pages`. Current references: `docs/analytics/EVENT_CONTRACT.md` (events, reports, revenue), `docs/security/HARDENING.md` (API security), and in the Campaign Builder repo `docs/landing-pages/ARCHITECTURE.md` / `ENVIRONMENT.md` / `RENDERER_PACKAGE.md`.

**Backend repo:** `busy-beans-backend`  
**Module:** `marketing/` only (mounted at `/api`)  
**Status:** Implemented — ready for customer site + `/admin/marketing/analytics`  
**Related:** [FRONTEND_TRACKING_IMPLEMENTATION.md](./FRONTEND_TRACKING_IMPLEMENTATION.md)  
**Full guide with demo responses:** [FRONTEND_CUSTOMER_WEBSITE_ANALYTICS_GUIDE.md](./FRONTEND_CUSTOMER_WEBSITE_ANALYTICS_GUIDE.md)

---

## 1. Base URL & auth

| Item | Value |
|------|--------|
| API prefix | `/api` |
| Staging example | `https://testingbb.trimworldwide.com/api` |
| Frontend env | `NEXT_PUBLIC_API_BASE_URL` — paths below are relative to this base |

### Public routes (customer site `/lp/{slug}`)

No auth. Fire-and-forget POSTs.

### Admin routes (page builder analytics UI)

```http
Authorization: Bearer <marketing_jwt>
```

- Token from `POST /api/auth/login` → `data.token`
- Uses **marketing JWT** (`MARKETING_JWT_SECRET`) — **not** commerce `/api/v1` auth

---

## 2. Response envelope

### Success (most JSON endpoints)

```json
{ "data": { ... } }
```

Lists return `data` as an **array**.

### Success (tracking ingest)

```http
204 No Content
```

Empty body on success.

### Error

```json
{
  "error": "Human readable message",
  "code": "ERROR_CODE"
}
```

| Code | HTTP | When |
|------|------|------|
| `VALIDATION_ERROR` | 400 | Bad payload |
| `RATE_LIMITED` | 429 | Too many requests |
| `UNAUTHORIZED` | 401 | Missing/invalid marketing token |
| `NOT_FOUND` | 404 | Lead not found |
| `INTERNAL_ERROR` | 500 | Server error |

---

## 3. Important: two different “tracking” paths

| Path | Purpose |
|------|---------|
| `POST /api/public/tracking/events` | **Analytics ingest** (page views, CTA, form events) |
| `POST /api/public/tracking/touchpoints` | **Attribution snapshot** per page view |
| `GET/PUT /api/admin/tracking/settings` | **GTM / global tracking config** (unchanged — not analytics ingest) |

Do not merge these in the frontend.

---

## 4. Customer site — public ingest

### 4.1 Page view flow

On `/lp/{slug}` mount, send **two** requests:

```
POST /api/public/tracking/touchpoints
POST /api/public/tracking/events   (eventType: landing_page_view)
```

### 4.2 Form submit flow

On successful submit, send **three** requests:

```
POST /api/public/lead-submissions
POST /api/public/tracking/events   (eventType: form_submit)
POST /api/public/tracking/events   (eventType: lead_created)
```

All are independent. Backend dedupes events/touchpoints by client `id`.

### 4.3 `POST /api/public/tracking/touchpoints`

**Auth:** None  
**Rate limit:** 300/min per IP (default)  
**Response:** `204`

**Required body fields:**

| Field | Type |
|-------|------|
| `id` | string (`tp-…`) — frontend-generated, used for dedupe |
| `visitorId` | string |
| `sessionId` | string |
| `timestamp` | ISO 8601 |

**Optional (store as sent):** `source`, `medium`, `campaign`, `content`, `term`, `referrer`, `landingPage`, `landingPageId`, `pageUrl`, `pathname`, `pageTitle`, `category`, `clickIds`, `isLandingPage`, plus nested attribution/UTM if sent.

**Example:**

```json
{
  "id": "tp-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "visitorId": "bf64ffca-a91b-4371-93fb-3dbf5ade62f8",
  "sessionId": "b2d9f7f7-b951-462c-972a-7e10b620804f",
  "timestamp": "2026-06-24T10:15:00.000Z",
  "source": "instagram",
  "medium": "paid_social",
  "campaign": "sf-q1",
  "landingPage": "office-coffee",
  "landingPageId": "lp_abc123",
  "pageUrl": "https://example.com/lp/office-coffee?utm_source=instagram",
  "isLandingPage": true
}
```

### 4.4 `POST /api/public/tracking/events`

**Auth:** None  
**Rate limit:** 300/min per IP  
**Response:** `204`

**Required:**

| Field | Type |
|-------|------|
| `id` | string (`ev-…`) |
| `visitorId` | string |
| `sessionId` | string |
| `eventType` | string (see event types below) |
| `timestamp` | ISO 8601 |

**Optional:** `pageUrl`, `pathname`, `landingPageId`, `landingPageSlug`, `attribution`, `firstTouchUtm`, `lastTouchUtm`, `clickIds`, `metadata`.

**Supported `eventType` values:**

| Value | When |
|-------|------|
| `landing_page_view` | `/lp/{slug}` load |
| `page_view` | Non-LP page load |
| `cta_click` | CTA click (`metadata.label`) |
| `form_start` | First form interaction per session |
| `form_submit` | Form submitted |
| `lead_created` | After successful submit |
| `scroll_depth` | 25 / 50 / 75 / 90 (`metadata.depthPct`) |
| `quote_requested`, `order_created`, `payment_completed`, `order_completed` | Reserved |

Backend **never generates** `visitorId`, `sessionId`, or event `id` — always send from browser.

### 4.5 `POST /api/public/lead-submissions`

**Auth:** None  
**Rate limit:** 20/min per IP  
**Response:** `200`

```json
{
  "data": {
    "id": "sub_42",
    "stored": true,
    "testMode": false
  }
}
```

**Required body fields:**

| Field | Type | Notes |
|-------|------|-------|
| `fields` | `Record<string, string>` | Preserve empty strings |
| `pageUrl` | string | Full URL at submit time |
| `submittedAt` | ISO 8601 | Client timestamp |
| `testMode` | boolean | `true` = page-builder test |

**Recommended (from tracker):** `visitorId`, `sessionId`, `landingPageId`, `landingPageSlug`, nested `attribution`, nested `device`, flat UTM/first-touch/last-touch fields, `trafficCategory`, click IDs.

**Backend behavior:**

- Stores **all** submissions including `testMode: true`
- Test leads **excluded** from admin list & KPI counts by default
- No email sent when `testMode: true`
- Ignores `location` / `ipAddress` if sent (geo stays frontend-only)
- Resolves `landingPageId` from slug in `pageUrl` (`/lp/{slug}`) when not provided

**Example:**

```json
{
  "fields": {
    "name": "Joe Argyle",
    "email": "joe@example.com",
    "phone": "6196468865",
    "utm_source": ""
  },
  "pageUrl": "https://example.com/lp/coffee-service?utm_medium=instagram",
  "submittedAt": "2026-06-24T10:16:40.439Z",
  "testMode": false,
  "visitorId": "bf64ffca-a91b-4371-93fb-3dbf5ade62f8",
  "sessionId": "b2d9f7f7-b951-462c-972a-7e10b620804f",
  "firstTouchSource": "instagram",
  "lastTouchSource": "google",
  "trafficCategory": "paid_social",
  "device": {
    "deviceType": "mobile",
    "browser": "Chrome",
    "os": "iOS"
  }
}
```

---

## 5. Admin — analytics dashboard

### `GET /api/admin/analytics/dashboard`

**Auth:** Bearer (marketing JWT)  
**Query (optional):** `from`, `to` (ISO date/datetime, inclusive)

**Example:** `GET /api/admin/analytics/dashboard?from=2026-06-01&to=2026-06-30`

**Response `200`:**

```json
{
  "data": {
    "executive": {
      "totalVisitors": 120,
      "totalLeads": 8,
      "totalOrders": 0,
      "revenue": 0,
      "conversionRate": 6.7,
      "averageOrderValue": 0,
      "returningVisitors": 15
    },
    "marketing": {
      "trafficSources": [
        { "source": "instagram", "visitors": 45, "leads": 3, "revenue": 0 }
      ],
      "utmCampaigns": [
        { "campaign": "sf-q1", "visitors": 30, "leads": 2, "revenue": 0 }
      ],
      "landingPages": []
    },
    "funnel": [
      { "step": "landing_page_view", "label": "Landing page views", "count": 120, "dropOffPct": null },
      { "step": "cta_click", "label": "CTA clicks", "count": 40, "dropOffPct": 67 },
      { "step": "form_start", "label": "Form starts", "count": 20, "dropOffPct": 50 },
      { "step": "form_submit", "label": "Form submits", "count": 10, "dropOffPct": 50 },
      { "step": "lead_created", "label": "Leads created", "count": 8, "dropOffPct": 20 },
      { "step": "order_completed", "label": "Orders completed", "count": 0, "dropOffPct": 100 }
    ],
    "landingPages": [
      {
        "landingPageSlug": "office-coffee",
        "landingPageId": "lp_abc123",
        "visitors": 80,
        "uniqueVisitors": 80,
        "sessions": 95,
        "bounceRate": 42,
        "avgTimeOnPageSec": 0,
        "avgScrollDepth": 62,
        "ctaClicks": 25,
        "formStarts": 12,
        "formSubmissions": 8,
        "leads": 8,
        "orders": 0,
        "revenue": 0,
        "conversionRate": 10.0,
        "deviceBreakdown": { "mobile": 50, "desktop": 30 },
        "sourceBreakdown": { "instagram": 40 },
        "campaignBreakdown": { "sf-q1": 30, "(not set)": 10 }
      }
    ],
    "recentTouchpoints": [],
    "recentEvents": []
  }
}
```

### Dashboard tab → API mapping

| Tab | Data source |
|-----|-------------|
| Executive | `executive`, `recentEvents` (first 6), `landingPages.length` |
| Marketing | `marketing.trafficSources`, `marketing.utmCampaigns`, `recentTouchpoints`, `recentEvents` |
| Funnel | `funnel` (always 6 steps) |
| Landing pages | `landingPages` |
| **Leads** | **Separate endpoint** — not dashboard |

### KPI rules

- `executive.totalLeads` = non-test rows in `lead_submissions`
- `funnel[lead_created].count` matches `executive.totalLeads`
- `recentTouchpoints` max 20, `recentEvents` max 30
- All top-level keys always present (empty arrays OK)

---

## 6. Admin — leads CRUD

Base: `/api/admin/lead-submissions`  
**Auth:** Bearer (marketing JWT)

### `GET /api/admin/lead-submissions`

Returns array of leads for the **Leads tab**.

**Query:**

| Param | Default | Description |
|-------|---------|-------------|
| `includeTest` | `false` | `true` or `1` to include test submissions |

**Response item shape:**

```json
{
  "id": "sub_42",
  "fields": { "name": "Joe", "email": "joe@example.com" },
  "submittedAt": "2026-06-24T10:16:40.439Z",
  "pageUrl": "https://…",
  "testMode": false,
  "submitStatus": "success",
  "landingPageId": "lp_abc123",
  "landingPageSlug": "office-coffee",
  "visitorId": "bf64ffca-…",
  "sessionId": "b2d9f7f7-…",
  "attribution": { "utmSource": "instagram", "utmCampaign": "sf-q1" },
  "device": { "deviceType": "mobile", "browser": "Chrome", "os": "iOS" },
  "conversionStatus": "new",
  "revenue": null,
  "profit": null,
  "notes": null,
  "updatedAt": "2026-06-24T11:00:00.000Z",
  "utmSource": "instagram",
  "utmMedium": "",
  "utmCampaign": "sf-q1",
  "deviceType": "mobile",
  "browser": "Chrome",
  "os": "iOS"
}
```

Flat UTM/device fields are duplicated for convenience if nested objects are omitted.

### `GET /api/admin/lead-submissions/{id}`

Same shape as list item. Accepts `sub_42` or numeric `42`.

### `PATCH /api/admin/lead-submissions/{id}`

CRM fields only (all optional):

```json
{
  "conversionStatus": "contacted",
  "revenue": 1200,
  "profit": 400,
  "notes": "Called back, interested in Q3."
}
```

`conversionStatus`: `new` | `contacted` | `qualified` | `won` | `lost`

Returns updated lead in `{ data: … }`.

### `DELETE /api/admin/lead-submissions/{id}`

Returns `204` empty body.

---

## 7. Frontend env (customer site + admin)

| Variable | Production value |
|----------|------------------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://testingbb.trimworldwide.com/api` |
| `NEXT_PUBLIC_USE_DEMO_DATA` | `false` |

When demo mode is on, frontend should **not** POST to backend (existing `useBackendApi()` logic).

---

## 8. Endpoint summary

| Method | Path | Auth | Response |
|--------|------|------|----------|
| POST | `/public/tracking/touchpoints` | No | 204 |
| POST | `/public/tracking/events` | No | 204 |
| POST | `/public/lead-submissions` | No | 200 `{ data: { id, stored, testMode } }` |
| GET | `/admin/analytics/dashboard?from=&to=` | Bearer | 200 `{ data: AnalyticsDashboardData }` |
| GET | `/admin/lead-submissions` | Bearer | 200 `{ data: Lead[] }` |
| GET | `/admin/lead-submissions/{id}` | Bearer | 200 `{ data: Lead }` |
| PATCH | `/admin/lead-submissions/{id}` | Bearer | 200 `{ data: Lead }` |
| DELETE | `/admin/lead-submissions/{id}` | Bearer | 204 |

---

## 9. QA checklist (frontend)

### Customer site (`/lp/{slug}`)

- [ ] Page load → touchpoint + `landing_page_view` POSTs → 204
- [ ] Scroll milestones → `scroll_depth` events → 204
- [ ] CTA click → `cta_click` → 204
- [ ] Form edit → `form_start` (once per session) → 204
- [ ] Form submit → lead POST 200 + `form_submit` + `lead_created` → 204
- [ ] `visitorId` / `sessionId` same across all three on submit
- [ ] `testMode: true` from builder → lead stored but not in admin list

### Admin (`/admin/marketing/analytics`)

- [ ] Dashboard loads all tabs with `{ data: … }` unwrap
- [ ] Date filters `from` / `to` applied
- [ ] Leads tab uses `GET /admin/lead-submissions` (not dashboard)
- [ ] Lead drawer PATCH/DELETE work with `sub_{id}` format
- [ ] Marketing JWT used (not commerce token)

---

## 10. What did not change

- Commerce APIs: `/api/v1/*`
- Landing page CRUD/publish: `/api/admin/landing-pages`, `/api/public/landing-pages`
- Global tracking settings: `/api/admin/tracking/settings`
- Marketing auth: `/api/auth/login`

No frontend changes required for those unless already in use.

---

*Last updated: matches marketing analytics implementation in `busy-beans-backend`.*
