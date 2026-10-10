# Customer Website & Marketing Analytics — Frontend Integration Guide

> **Partly outdated (2026-09).** Landing-page fields are now derived server-side; dashboard revenue and avg time are real values; per-page reports live at `/api/admin/analytics/pages`. Current references: `docs/analytics/EVENT_CONTRACT.md` (events, reports, revenue), `docs/security/HARDENING.md` (API security), and in the Campaign Builder repo `docs/landing-pages/ARCHITECTURE.md` / `ENVIRONMENT.md` / `RENDERER_PACKAGE.md`.

**Backend:** `busy-beans-backend` (marketing module only)  
**Audience:** Customer website + page-builder frontend teams  
**Base URL:** `{NEXT_PUBLIC_API_BASE_URL}` — e.g. `https://testingbb.trimworldwide.com/api`  
**Related:** [FRONTEND_TRACKING_IMPLEMENTATION.md](./FRONTEND_TRACKING_IMPLEMENTATION.md) (browser-side tracker logic)

Demo request/response examples in this doc were captured from the live backend via `npm run marketing:capture-demos`.

---

## Table of contents

1. [Safety rules (read first)](#1-safety-rules-read-first)
2. [Setup & env](#2-setup--env)
3. [Response envelope & errors](#3-response-envelope--errors)
4. [Endpoint index](#4-endpoint-index)
5. [Public — tracking ingest](#5-public--tracking-ingest)
6. [Public — lead submissions](#6-public--lead-submissions)
7. [Admin — analytics dashboard](#7-admin--analytics-dashboard)
8. [Admin — leads CRUD](#8-admin--leads-crud)
9. [Customer website flows](#9-customer-website-flows)
10. [QA checklist](#10-qa-checklist)

---

## 1. Safety rules (read first)

| Rule | Why |
|------|-----|
| Tracking POSTs are **fire-and-forget** | Never `await` before showing thank-you / navigation |
| Use **no auth** on `/public/tracking/*` and `/public/lead-submissions` | Public ingest; do not send commerce JWT |
| Do **not** touch `/api/v1/*` for analytics | Commerce orders/login stay separate |
| `/admin/tracking/settings` ≠ `/public/tracking/events` | GTM config vs analytics ingest |
| Backend never generates `visitorId` / `sessionId` / event `id` | Client owns all IDs |
| `testMode: true` → stored but excluded from KPIs | Page-builder preview only |
| Send login state in `metadata` only | `isAuthenticated`, `accountType`, optional `customerUserId` |
| Ignore backend failures silently on client | `.catch(() => undefined)` — localStorage fallback OK |

---

## 2. Setup & env

### Customer website / page-builder

| Variable | Production | Notes |
|----------|------------|-------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://testingbb.trimworldwide.com/api` | Required for backend sync |
| `NEXT_PUBLIC_USE_DEMO_DATA` | `false` | When `true`, skip all backend POSTs |

### Admin analytics UI

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <token>` from `POST /api/auth/login` |

Marketing JWT only — not commerce `/api/v1` token.

---

## 3. Response envelope & errors

### Success — JSON endpoints

```json
{ "data": { ... } }
```

Lists: `data` is an **array**.

### Success — tracking ingest

```http
HTTP/1.1 204 No Content
```

Empty body. Duplicates (same client `id`) also return **204**.

### Error

```json
{
  "error": "Human readable message",
  "code": "ERROR_CODE"
}
```

**Demo error responses:**

```json
// 400 VALIDATION_ERROR
{
  "error": "visitorId, sessionId, and eventType are required.",
  "code": "VALIDATION_ERROR"
}

// 429 RATE_LIMITED (tracking)
{
  "error": "Too many tracking requests. Please try again shortly.",
  "code": "RATE_LIMITED"
}

// 429 RATE_LIMITED (leads)
{
  "error": "Too many lead submissions. Please try again shortly.",
  "code": "RATE_LIMITED"
}

// 401 UNAUTHORIZED (admin routes)
{
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}

// 404 NOT_FOUND
{
  "error": "Lead not found.",
  "code": "NOT_FOUND"
}
```

---

## 4. Endpoint index

| Method | Path | Auth | Rate limit | Response |
|--------|------|------|------------|----------|
| GET | `/health` | No | — | 200 JSON |
| POST | `/public/tracking/touchpoints` | No | 300/min/IP | 204 |
| POST | `/public/tracking/events` | No | 300/min/IP | 204 |
| POST | `/public/lead-submissions` | No | 20/min/IP | 200 JSON |
| GET | `/admin/analytics/dashboard?from=&to=` | Bearer | — | 200 JSON |
| GET | `/admin/lead-submissions?includeTest=` | Bearer | — | 200 JSON |
| GET | `/admin/lead-submissions/{id}` | Bearer | — | 200 JSON |
| PATCH | `/admin/lead-submissions/{id}` | Bearer | — | 200 JSON |
| DELETE | `/admin/lead-submissions/{id}` | Bearer | — | 204 |

> **Not in this guide:** `/api/admin/tracking/settings` (GTM config), `/api/v1/*` (commerce).

---

## 5. Public — tracking ingest

### 5.1 `POST /public/tracking/touchpoints`

One attribution snapshot per page view.

**Required:** `id`, `visitorId`, `sessionId`, `timestamp`

**Demo request:**

```json
{
  "id": "tp-demo-1783488417815",
  "visitorId": "demo-visitor-1783488417815",
  "sessionId": "demo-session-1783488417815",
  "timestamp": "2026-07-08T05:26:57.815Z",
  "source": "instagram",
  "medium": "paid_social",
  "campaign": "summer2026_office",
  "content": "carousel_ad_1",
  "term": "",
  "referrer": "https://instagram.com/",
  "landingPage": "office-coffee-demo",
  "landingPageId": "lp_demo_001",
  "pageUrl": "https://busybeancoffee.com/lp/office-coffee-demo?utm_source=instagram&utm_campaign=summer2026_office",
  "pathname": "/lp/office-coffee-demo",
  "pageTitle": "Office Coffee Service",
  "category": "paid_social",
  "clickIds": {
    "fbclid": "demo-fbclid-123",
    "gclid": "",
    "ttclid": "",
    "msclkid": "",
    "liFatId": ""
  },
  "isLandingPage": true
}
```

**Demo response:**

```http
HTTP/1.1 204 No Content
```

Re-posting the same `id` → still **204** (deduped, no error).

---

### 5.2 `POST /public/tracking/events`

#### A) Landing page view — `/lp/{slug}`

**Demo request (`landing_page_view`):**

```json
{
  "id": "ev-lpview-1783488417815",
  "visitorId": "demo-visitor-1783488417815",
  "sessionId": "demo-session-1783488417815",
  "eventType": "landing_page_view",
  "timestamp": "2026-07-08T05:26:57.815Z",
  "pageUrl": "https://busybeancoffee.com/lp/office-coffee-demo?utm_source=instagram&utm_campaign=summer2026_office",
  "pathname": "/lp/office-coffee-demo",
  "landingPageId": "lp_demo_001",
  "landingPageSlug": "office-coffee-demo",
  "attribution": {
    "source": "instagram",
    "medium": "paid_social",
    "campaign": "summer2026_office",
    "category": "paid_social"
  },
  "firstTouchUtm": {
    "utmSource": "instagram",
    "utmMedium": "paid_social",
    "utmCampaign": "summer2026_office",
    "utmContent": "",
    "utmTerm": ""
  },
  "lastTouchUtm": {
    "utmSource": "instagram",
    "utmMedium": "paid_social",
    "utmCampaign": "summer2026_office",
    "utmContent": "",
    "utmTerm": ""
  },
  "clickIds": {
    "fbclid": "demo-fbclid-123",
    "gclid": "",
    "ttclid": "",
    "msclkid": "",
    "liFatId": ""
  },
  "metadata": {
    "pageTitle": "Office Coffee Service",
    "browser": "Chrome",
    "browserVersion": "125.0",
    "os": "iOS",
    "deviceType": "mobile",
    "screenWidth": 390,
    "screenHeight": 844,
    "language": "en-US",
    "timezone": "America/Los_Angeles",
    "isLandingPage": true,
    "isAuthenticated": false,
    "accountType": "guest"
  }
}
```

**Demo response:** `204 No Content`

---

#### B) Customer website page — `/shop`, `/`, etc.

Use `eventType: "page_view"` (not `landing_page_view`).

**Demo request (`page_view` + logged-in customer):**

```json
{
  "id": "ev-pageview-1783488417815",
  "visitorId": "demo-visitor-1783488417815",
  "sessionId": "demo-session-1783488417815",
  "eventType": "page_view",
  "timestamp": "2026-07-08T05:26:57.815Z",
  "pageUrl": "https://busybeancoffee.com/shop",
  "pathname": "/shop",
  "attribution": {
    "source": "instagram",
    "medium": "paid_social",
    "campaign": "summer2026_office"
  },
  "metadata": {
    "pageTitle": "Shop",
    "deviceType": "mobile",
    "isAuthenticated": true,
    "accountType": "customer",
    "customerUserId": "1042"
  },
  "isAuthenticated": true,
  "accountType": "customer",
  "customerUserId": "1042"
}
```

Top-level `isAuthenticated` / `accountType` / `customerUserId` are merged into `metadata` on the backend.

**Demo response:** `204 No Content`

---

#### C) Form submit events (after lead POST)

**Demo request (`form_submit`):**

```json
{
  "id": "ev-formsubmit-1783488417815",
  "visitorId": "demo-visitor-1783488417815",
  "sessionId": "demo-session-1783488417815",
  "eventType": "form_submit",
  "timestamp": "2026-07-08T05:26:57.815Z",
  "landingPageSlug": "office-coffee-demo",
  "pathname": "/lp/office-coffee-demo"
}
```

**Demo request (`lead_created`):**

```json
{
  "id": "ev-leadcreated-1783488417815",
  "visitorId": "demo-visitor-1783488417815",
  "sessionId": "demo-session-1783488417815",
  "eventType": "lead_created",
  "timestamp": "2026-07-08T05:26:57.815Z",
  "landingPageSlug": "office-coffee-demo",
  "pathname": "/lp/office-coffee-demo"
}
```

**Demo response (both):** `204 No Content`

---

#### Event types reference

| `eventType` | When |
|-------------|------|
| `landing_page_view` | `/lp/{slug}` load |
| `page_view` | Any other customer site page |
| `cta_click` | CTA click — `metadata.label` |
| `form_start` | First form field edit per session |
| `form_submit` | Form submitted |
| `lead_created` | Immediately after successful submit |
| `scroll_depth` | 25/50/75/90 — `metadata.depthPct` |
| `order_completed` | Reserved — optional `metadata.revenue` |

---

## 6. Public — lead submissions

### `POST /public/lead-submissions`

**Demo request (production lead):**

```json
{
  "fields": {
    "name": "Jane Demo",
    "email": "jane.demo@example.com",
    "phone": "555-0100",
    "company": "Demo Corp",
    "city": "Charlotte",
    "utm_source": "instagram",
    "utm_campaign": "summer2026_office"
  },
  "pageUrl": "https://busybeancoffee.com/lp/office-coffee-demo?utm_source=instagram&utm_campaign=summer2026_office",
  "submittedAt": "2026-07-08T05:26:57.815Z",
  "testMode": false,
  "visitorId": "demo-visitor-1783488417815",
  "sessionId": "demo-session-1783488417815",
  "landingPageId": "lp_demo_001",
  "landingPageSlug": "office-coffee-demo",
  "firstTouchSource": "instagram",
  "firstTouchMedium": "paid_social",
  "firstTouchCampaign": "summer2026_office",
  "lastTouchSource": "instagram",
  "lastTouchMedium": "paid_social",
  "lastTouchCampaign": "summer2026_office",
  "trafficCategory": "paid_social",
  "fbclid": "demo-fbclid-123",
  "device": {
    "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    "deviceType": "mobile",
    "browser": "Chrome",
    "os": "iOS",
    "screenWidth": 390,
    "screenHeight": 844,
    "language": "en-US",
    "timezone": "America/Los_Angeles"
  },
  "attribution": {
    "utmSource": "instagram",
    "utmMedium": "paid_social",
    "utmCampaign": "summer2026_office",
    "landingPageSlug": "office-coffee-demo",
    "source": "instagram"
  }
}
```

**Demo response:**

```json
{
  "data": {
    "id": "sub_6",
    "stored": true,
    "testMode": false
  }
}
```

---

**Demo request (page-builder test):**

```json
{
  "fields": { "name": "Test Mode Lead", "email": "jane.demo@example.com" },
  "pageUrl": "https://busybeancoffee.com/lp/office-coffee-demo",
  "submittedAt": "2026-07-08T05:26:57.815Z",
  "testMode": true,
  "visitorId": "demo-visitor-1783488417815",
  "sessionId": "demo-session-1783488417815"
}
```

**Demo response:**

```json
{
  "data": {
    "id": "sub_7",
    "stored": true,
    "testMode": true
  }
}
```

Test leads appear in DB but are **excluded** from default admin list and lead KPIs.

---

## 7. Admin — analytics dashboard

### `GET /admin/analytics/dashboard`

**Auth:** Bearer  
**Query:** `from`, `to` (optional ISO dates)

**Demo response (structure — captured from backend):**

```json
{
  "data": {
    "executive": {
      "totalVisitors": 4,
      "totalLeads": 4,
      "totalOrders": 0,
      "revenue": 0,
      "conversionRate": 100,
      "averageOrderValue": 0,
      "returningVisitors": 0
    },
    "marketing": {
      "trafficSources": [
        { "source": "instagram", "visitors": 4, "leads": 0, "revenue": 0 }
      ],
      "utmCampaigns": [
        { "campaign": "summer2026_office", "visitors": 1, "leads": 0, "revenue": 0 }
      ],
      "landingPages": []
    },
    "funnel": [
      { "step": "landing_page_view", "label": "Landing page views", "count": 4, "dropOffPct": null },
      { "step": "cta_click", "label": "CTA clicks", "count": 0, "dropOffPct": 100 },
      { "step": "form_start", "label": "Form starts", "count": 0, "dropOffPct": null },
      { "step": "form_submit", "label": "Form submits", "count": 1, "dropOffPct": null },
      { "step": "lead_created", "label": "Leads created", "count": 4, "dropOffPct": null },
      { "step": "order_completed", "label": "Orders completed", "count": 0, "dropOffPct": 100 }
    ],
    "landingPages": [
      {
        "landingPageSlug": "office-coffee-demo",
        "landingPageId": "lp_demo_001",
        "visitors": 1,
        "uniqueVisitors": 1,
        "sessions": 1,
        "bounceRate": 0,
        "avgTimeOnPageSec": 0,
        "avgScrollDepth": 0,
        "ctaClicks": 0,
        "formStarts": 0,
        "formSubmissions": 1,
        "leads": 1,
        "orders": 0,
        "revenue": 0,
        "conversionRate": 100,
        "deviceBreakdown": { "mobile": 5 },
        "sourceBreakdown": { "instagram": 5 },
        "campaignBreakdown": { "summer2026_office": 5 }
      }
    ],
    "recentTouchpoints": [
      {
        "id": "tp-demo-1783488417815",
        "visitorId": "demo-visitor-1783488417815",
        "sessionId": "demo-session-1783488417815",
        "timestamp": "2026-07-08T05:26:57.000Z",
        "source": "instagram",
        "medium": "paid_social",
        "campaign": "summer2026_office",
        "landingPage": "office-coffee-demo",
        "pageUrl": "https://busybeancoffee.com/lp/office-coffee-demo?utm_source=instagram&utm_campaign=summer2026_office"
      }
    ],
    "recentEvents": [
      {
        "id": "ev-leadcreated-1783488417815",
        "visitorId": "demo-visitor-1783488417815",
        "sessionId": "demo-session-1783488417815",
        "eventType": "lead_created",
        "timestamp": "2026-07-08T05:26:57.000Z",
        "landingPageSlug": "office-coffee-demo",
        "pathname": "/lp/office-coffee-demo",
        "attribution": {},
        "metadata": {}
      }
    ]
  }
}
```

**UI mapping:**

| Tab | API fields |
|-----|------------|
| Executive | `executive.*`, `recentEvents` (first 6), `landingPages.length` |
| Marketing | `marketing.trafficSources`, `marketing.utmCampaigns`, `recentTouchpoints`, `recentEvents` |
| Funnel | `funnel` (always 6 steps) |
| Landing pages | `landingPages` |
| Leads | **`GET /admin/lead-submissions`** — not this endpoint |

---

## 8. Admin — leads CRUD

### `GET /admin/lead-submissions`

Default: excludes `testMode: true`.  
`?includeTest=true` includes test submissions.

**Demo response (single item from list):**

```json
{
  "data": [
    {
      "id": "sub_6",
      "fields": {
        "name": "Jane Demo",
        "email": "jane.demo@example.com",
        "phone": "555-0100",
        "company": "Demo Corp",
        "city": "Charlotte",
        "utm_source": "instagram",
        "utm_campaign": "summer2026_office"
      },
      "submittedAt": "2026-07-08T05:26:57.000Z",
      "pageUrl": "https://busybeancoffee.com/lp/office-coffee-demo?utm_source=instagram&utm_campaign=summer2026_office",
      "testMode": false,
      "submitStatus": "success",
      "landingPageId": "lp_demo_001",
      "landingPageSlug": "office-coffee-demo",
      "visitorId": "demo-visitor-1783488417815",
      "sessionId": "demo-session-1783488417815",
      "attribution": {
        "utmSource": "instagram",
        "utmMedium": "paid_social",
        "utmCampaign": "summer2026_office",
        "source": "instagram",
        "firstTouchSource": "instagram",
        "lastTouchSource": "instagram",
        "trafficCategory": "paid_social",
        "fbclid": "demo-fbclid-123"
      },
      "device": {
        "deviceType": "mobile",
        "browser": "Chrome",
        "os": "iOS"
      },
      "conversionStatus": "new",
      "revenue": null,
      "profit": null,
      "notes": null,
      "updatedAt": "2026-07-08T05:26:57.000Z",
      "utmSource": "instagram",
      "utmMedium": "paid_social",
      "utmCampaign": "summer2026_office",
      "deviceType": "mobile",
      "browser": "Chrome",
      "os": "iOS"
    }
  ]
}
```

---

### `GET /admin/lead-submissions/{id}`

Accepts `sub_6` or `6`. Same item shape as above.

---

### `PATCH /admin/lead-submissions/{id}`

**Demo request:**

```json
{
  "conversionStatus": "contacted",
  "revenue": 1200,
  "profit": 400,
  "notes": "Demo patch — called back, interested."
}
```

**Demo response:**

```json
{
  "data": {
    "id": "sub_6",
    "conversionStatus": "contacted",
    "revenue": 1200,
    "profit": 400,
    "notes": "Demo patch — called back, interested.",
    "fields": { "name": "Jane Demo", "email": "jane.demo@example.com" },
    "testMode": false,
    "visitorId": "demo-visitor-1783488417815",
    "sessionId": "demo-session-1783488417815"
  }
}
```

`conversionStatus`: `new` | `contacted` | `qualified` | `won` | `lost`

---

### `DELETE /admin/lead-submissions/{id}`

**Demo response:**

```http
HTTP/1.1 204 No Content
```

---

## 9. Customer website flows

### Flow A — Visitor lands from Instagram ad

```
1. User opens: /lp/office-coffee?utm_source=instagram&utm_campaign=summer2026_office
2. POST /public/tracking/touchpoints     → 204
3. POST /public/tracking/events          → landing_page_view → 204
4. (optional) scroll_depth, cta_click     → 204 each
```

### Flow B — Logged-in customer browses shop

```
1. User opens: /shop (already logged in)
2. POST /public/tracking/touchpoints     → 204
3. POST /public/tracking/events          → page_view + metadata.isAuthenticated: true → 204
```

### Flow C — Form conversion

```
1. POST /public/lead-submissions         → 200 { data: { id: "sub_6", ... } }
2. POST /public/tracking/events          → form_submit → 204
3. POST /public/tracking/events          → lead_created → 204
```

All three use the **same** `visitorId` and `sessionId`.

### Mounting on customer website

| Page type | `eventType` | Mount |
|-----------|-------------|-------|
| `/lp/{slug}` | `landing_page_view` | Existing `LandingPageAnalyticsTracker` |
| All other pages | `page_view` | New root `SiteAnalyticsTracker` in app layout |

Share cookie `bb_visitor_id` sitewide so LP → shop → form is one journey.

---

## 10. QA checklist

### Customer site (Network tab)

- [ ] UTM link → touchpoint + page/landing view → **204**
- [ ] Logged-in `/shop` → `metadata.isAuthenticated: true`
- [ ] Guest homepage → `metadata.isAuthenticated: false`
- [ ] Form submit → lead **200** + 2 events **204**
- [ ] `testMode: true` → lead stored, hidden from admin list
- [ ] Commerce login/checkout still works

### Admin UI

- [ ] Dashboard all tabs load (`executive`, `marketing`, `funnel`, `landingPages`)
- [ ] Leads tab from `GET /admin/lead-submissions`
- [ ] PATCH/DELETE lead works with `sub_{id}`

### Backend ops (before staging/prod)

```bash
npm run marketing:migrate
npm run marketing:analytics-contract
pm2 restart testbb
```

Regenerate demo JSON anytime:

```bash
npm run marketing:capture-demos > marketing/scripts/demo-responses.json
```

---

*Captured: 2026-07-08 — regenerate with `marketing:capture-demos` after backend changes.*
