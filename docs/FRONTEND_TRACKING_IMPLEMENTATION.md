# Frontend Tracking Implementation Guide

This document explains how **visitor ID**, **session ID**, **page visit tracking**, and **source (attribution) tracking** work in the Busy Bean page-builder Next.js app.

**Related docs:**
- [BACKEND_ANALYTICS_AND_LEADS.md](./BACKEND_ANALYTICS_AND_LEADS.md) — what the backend API must accept and store

---

## Table of contents

1. [Overview](#1-overview)
2. [Frontend-generated keys & IDs (not backend)](#2-frontend-generated-keys--ids-not-backend)
3. [Architecture](#3-architecture)
4. [File map](#4-file-map)
5. [Identity: visitor ID & session ID](#5-identity-visitor-id--session-id)
6. [Source & attribution tracking](#6-source--attribution-tracking)
7. [Page visit & event tracking](#7-page-visit--event-tracking)
8. [Lead form integration](#8-lead-form-integration)
9. [Data persistence & API sync](#9-data-persistence--api-sync)
10. [Admin analytics dashboard](#10-admin-analytics-dashboard)
11. [Demo vs production mode](#11-demo-vs-production-mode)
12. [Multi-visit user journeys](#12-multi-visit-user-journeys)
13. [Event types reference](#13-event-types-reference)
14. [Storage keys reference](#14-storage-keys-reference)
15. [Implementation checklist (for new pages)](#15-implementation-checklist-for-new-pages)

---

## 1. Overview

All tracking logic runs **in the browser (frontend)**. The backend does **not** generate visitor or session IDs — it only receives, stores, and aggregates what the client sends.

| Concern | Where it happens |
|---------|------------------|
| Visitor ID generation | Frontend (`visitorId.ts`) |
| Session ID generation | Frontend (`session.ts`) |
| UTM / source / referrer parsing | Frontend (`attribution.ts`) |
| Page views, CTA, scroll, form events | Frontend (`AnalyticsTracker.ts`) |
| Local persistence | `localStorage` + `sessionStorage` + cookie |
| Backend sync | `POST /public/tracking/events`, `POST /public/tracking/touchpoints` |
| Lead conversion linking | Same IDs attached to `POST /public/lead-submissions` |

> **See also:** [Section 2 — Frontend-generated keys & IDs](#2-frontend-generated-keys--ids-not-backend) for every static key name, constant, and ID format defined in frontend code.

---

## 2. Frontend-generated keys & IDs (not backend)

This section lists **everything the frontend defines or generates**. The backend never creates these — it only receives them in POST payloads and stores them as-is.

### 2.1 Static storage key names (hardcoded strings)

These key names are **fixed in source code** and do not come from the backend or any API response.

| TypeScript constant | Key / cookie name | Storage | Source file |
|---------------------|-------------------|---------|-------------|
| `VISITOR_COOKIE` | `bb_visitor_id` | Cookie | `client/visitorId.ts` |
| `SESSION_KEY` | `bb_session_state` | `sessionStorage` | `client/session.ts` |
| `ATTRIBUTION_KEY` | `bb_attribution_v1` | `localStorage` | `client/attribution.ts` |
| `ANALYTICS_STORAGE_KEY` | `busy-bean.analytics.v1` | `localStorage` | `storage/analytics.storage.ts` |

**What is stored under each key:**

| Key | Stored value shape |
|-----|-------------------|
| `bb_visitor_id` | Plain string — visitor UUID (e.g. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`) |
| `bb_session_state` | JSON object — `{ sessionId, visitorId, startedAt, lastActivityAt, landingPageId?, landingPageSlug?, isLandingPageSession? }` |
| `bb_attribution_v1` | JSON object — `{ firstTouchUtm, lastTouchUtm, firstTouchAttribution, lastTouchAttribution, clickIds }` |
| `busy-bean.analytics.v1` | JSON object — `{ v: 1, visitors[], sessions[], touchpoints[], events[] }` |

### 2.2 Static numeric & config constants (frontend only)

| Constant | Value | Purpose | Source file |
|----------|-------|---------|-------------|
| `VISITOR_MAX_AGE_SEC` | `31536000` (365 days) | Cookie `max-age` for visitor ID | `client/visitorId.ts` |
| `SESSION_IDLE_MS` | `1800000` (30 minutes) | Idle time before a new session ID is created | `client/session.ts` |
| `MAX_TOUCHPOINTS` | `2000` | Max touchpoints kept in localStorage | `storage/analytics.storage.ts` |
| `MAX_EVENTS` | `5000` | Max events kept in localStorage | `storage/analytics.storage.ts` |
| Store schema version | `v: 1` | Analytics localStorage schema version | `storage/analytics.storage.ts` |

### 2.3 URL query param keys (read by frontend, not generated)

The frontend **reads** these from the page URL. It does not invent their values — they come from marketing links or ad platforms.

**UTM parameters** (parsed in `attribution.ts`):

| Query param | Mapped to |
|-------------|-----------|
| `utm_source` | `utmSource` / `source` |
| `utm_medium` | `utmMedium` / `medium` |
| `utm_campaign` | `utmCampaign` / `campaign` |
| `utm_content` | `utmContent` / `content` |
| `utm_term` | `utmTerm` / `term` |

**Click ID parameters** (`CLICK_ID_PARAMS` in `attribution.ts`):

| Query param | Mapped to |
|-------------|-----------|
| `fbclid` | `clickIds.fbclid` |
| `gclid` | `clickIds.gclid` |
| `ttclid` | `clickIds.ttclid` |
| `msclkid` | `clickIds.msclkid` |
| `li_fat_id` | `clickIds.liFatId` |

**Other browser inputs (not keys, but frontend-sourced):**

| Input | Source |
|-------|--------|
| Referrer | `document.referrer` |
| Page URL | `window.location.href` |
| Pathname | `window.location.pathname` |

### 2.4 Dynamic IDs generated on frontend (NOT backend)

These IDs are **created in the browser** at runtime. The backend must accept them in POST bodies and use them for deduplication / joins — it must **not** replace them with server-generated IDs.

| ID field | Generated by | Format | Example | Sent to backend? |
|----------|--------------|--------|---------|------------------|
| `visitorId` | `getOrCreateVisitorId()` | `crypto.randomUUID()` or `v-{timestamp}-{random}` | `bf64ffca-a91b-4371-93fb-3dbf5ade62f8` | ✅ Yes — events, touchpoints, leads |
| `sessionId` | `getOrCreateSession()` | `crypto.randomUUID()` or `s-{timestamp}-{random}` | `b2d9f7f7-b951-462c-972a-7e10b620804f` | ✅ Yes — events, touchpoints, leads |
| Event `id` | `AnalyticsTracker.newId("ev")` | `ev-{uuid}` or `ev-{timestamp}-{random}` | `ev-a1b2c3d4-e5f6-7890-abcd-ef1234567890` | ✅ Yes — `POST /public/tracking/events` |
| Touchpoint `id` | `AnalyticsTracker.newId("tp")` | `tp-{uuid}` or `tp-{timestamp}-{random}` | `tp-a1b2c3d4-e5f6-7890-abcd-ef1234567890` | ✅ Yes — `POST /public/tracking/touchpoints` |
| Lead local `id` | `submitLeadForm()` (client record only) | `sub-{timestamp}` | `sub-1719224200439` | ❌ Local only — backend may return its own `id` |

**ID generation code (frontend):**

```typescript
// visitorId.ts
function newId(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// session.ts
function newSessionId(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// AnalyticsTracker.ts
function newId(prefix: string): string {
  if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
```

### 2.5 Static demo / seed IDs (NOT used in real tracking)

When demo mode is on, **hardcoded static IDs** are used for the admin dashboard preview. Real visitors never get these.

**File:** `src/features/analytics/data/demoAnalytics.ts`

| Entity | Static ID pattern | Example |
|--------|-------------------|---------|
| Visitor | `vis-demo-{nnn}` | `vis-demo-001` |
| Session | `ses-demo-{nnn}` | `ses-demo-001` |
| Touchpoint | `tp-demo-{nnn}` | `tp-demo-001` |
| Event | `ev-demo-{nnn}` | `ev-demo-001` |

**Cleanup:** `purgeDemoAnalyticsRecords()` removes any rows in localStorage whose IDs start with `vis-demo-`, `ses-demo-`, `tp-demo-`, or `ev-demo-` when real analytics data is read.

### 2.6 Payload field names sent to backend (frontend attaches these)

On analytics events, touchpoints, and lead submissions, the frontend sends these **field names** (values are frontend-generated or browser-derived):

| Field group | Field names |
|-------------|-------------|
| Identity | `visitorId`, `sessionId` |
| Event | `id`, `eventType`, `timestamp`, `pageUrl`, `pathname`, `landingPageId`, `landingPageSlug` |
| Attribution | `attribution`, `firstTouchUtm`, `lastTouchUtm`, `clickIds` |
| Lead (flat) | `firstTouchSource`, `firstTouchMedium`, `firstTouchCampaign`, `firstTouchContent`, `firstTouchTerm`, `lastTouchSource`, `lastTouchMedium`, `lastTouchCampaign`, `lastTouchContent`, `lastTouchTerm`, `trafficCategory`, `fbclid`, `gclid`, `ttclid`, `msclkid`, `liFatId` |
| Device | `userAgent`, `deviceType`, `browser`, `os`, `screenWidth`, `screenHeight`, `language`, `timezone` |

None of these identity or event `id` values are assigned by the backend on ingest.

### 2.7 What the backend generates (for contrast)

| Item | Frontend | Backend |
|------|----------|---------|
| `visitorId` | ✅ Generates | ❌ Does not generate — stores client value |
| `sessionId` | ✅ Generates | ❌ Does not generate — stores client value |
| Event / touchpoint `id` | ✅ Generates | ❌ Does not generate — dedupes by client `id` |
| Lead `id` (production DB row) | ❌ Local `sub-{timestamp}` only for offline cache | ✅ Server may return `{ "id": "sub_abc123" }` |
| `firstSeenAt` / `lastSeenAt` on visitor row | ✅ Client sends timestamps on events | ✅ Backend upserts from incoming `visitorId` |
| Dashboard KPIs (`totalVisitors`, funnel, etc.) | ✅ Fallback aggregation from localStorage | ✅ Primary in production via `GET /admin/analytics/dashboard` |
| Cookie / sessionStorage / localStorage keys | ✅ All key names defined in frontend | ❌ Backend never sets browser storage |

---

## 3. Architecture

```
Public landing page (/lp/{slug})
│
├─ LandingPageRenderer.tsx
│    └─ LandingPageAnalyticsTracker (React component)
│         └─ AnalyticsTracker.trackPageView()
│              ├─ getOrCreateVisitorId()     → cookie bb_visitor_id
│              ├─ getOrCreateSession()        → sessionStorage bb_session_state
│              ├─ captureAttributionFromPage() → localStorage bb_attribution_v1
│              ├─ collectDeviceContext()      → user-agent, screen, timezone
│              └─ analyticsCollector
│                   ├─ analyticsRepo (localStorage busy-bean.analytics.v1)
│                   └─ analyticsApi (POST to backend if enabled)
│
├─ LeadFormInteractive.tsx
│    ├─ trackFormStart() on first field edit
│    └─ submitLeadForm() → trackFormSubmit() + lead API payload with IDs
│
Admin UI (/admin/marketing/analytics)
│
└─ analyticsApi.getDashboard()
     ├─ Backend: GET /admin/analytics/dashboard
     └─ Fallback: aggregate from localStorage via aggregateAnalytics.ts
```

### Data flow on a single landing page visit

```
1. User opens /lp/office-coffee?utm_source=instagram&utm_campaign=sf-q1
2. LandingPageAnalyticsTracker mounts
3. Visitor ID read/created (cookie, 365 days)
4. Session ID read/created (sessionStorage, 30 min idle timeout)
5. Attribution parsed from URL + document.referrer → stored in localStorage
6. One TouchpointRecord created (attribution snapshot)
7. One AnalyticsEventRecord created (eventType: landing_page_view)
8. Both saved to localStorage
9. Both POSTed to backend (if NEXT_PUBLIC_API_BASE_URL is configured)
10. Scroll / CTA / form events follow the same pattern with shared visitorId + sessionId
```

---

## 4. File map

| File | Role |
|------|------|
| `src/features/analytics/client/visitorId.ts` | Persistent visitor ID (cookie) |
| `src/features/analytics/client/session.ts` | Session ID (sessionStorage, 30 min idle) |
| `src/features/analytics/client/attribution.ts` | UTM, click IDs, first/last touch attribution |
| `src/features/analytics/client/device.ts` | Browser, OS, screen, timezone |
| `src/features/analytics/client/AnalyticsTracker.ts` | Main tracker: page views, events, funnel |
| `src/features/analytics/components/LandingPageAnalyticsTracker.tsx` | React hook-up for `/lp/{slug}` pages |
| `src/features/analytics/services/analytics.collector.ts` | Writes locally + forwards to API |
| `src/features/analytics/services/analytics.api.ts` | HTTP ingest & dashboard fetch |
| `src/features/analytics/services/analytics.repo.ts` | Read/write local analytics store |
| `src/features/analytics/storage/analytics.storage.ts` | localStorage schema |
| `src/features/analytics/services/aggregateAnalytics.ts` | Client-side dashboard aggregation |
| `src/features/analytics/types/analytics.types.ts` | TypeScript types |
| `src/features/leads/services/buildLeadSubmissionApiPayload.ts` | Attaches IDs to lead payload |
| `src/features/leads/services/collectLeadContext.ts` | Device + IP/geo for leads |
| `src/features/landing-pages/services/submitLeadForm.ts` | Form submit + analytics events |
| `src/public-renderer/LandingPageRenderer.tsx` | Mounts tracker on public LPs |
| `src/features/builder/section-renderers/LeadFormSection/LeadFormInteractive.tsx` | Form start/submit hooks |
| `src/lib/apiMode.ts` | Demo vs backend API mode |
| `docs/BACKEND_ANALYTICS_AND_LEADS.md` | Backend contract |

---

## 5. Identity: visitor ID & session ID

### 5.1 Visitor ID

**Source:** `src/features/analytics/client/visitorId.ts`

| Property | Value |
|----------|-------|
| Cookie name | `bb_visitor_id` |
| Lifetime | 365 days (`max-age`) |
| Scope | `path=/`, `SameSite=Lax`, `Secure` on HTTPS |
| Generation | `crypto.randomUUID()` or fallback `v-{timestamp}-{random}` |
| Created by | **Frontend only** |

**Behavior:**
- On first visit, a UUID is generated and written to the cookie.
- On return visits (same browser), the existing cookie value is reused.
- Same person across multiple days = same `visitorId`.

```typescript
// Simplified logic
export function getOrCreateVisitorId(): string {
  const existing = readCookie("bb_visitor_id");
  if (existing) return existing;
  const id = crypto.randomUUID(); // or fallback
  writeCookie("bb_visitor_id", id, 365 * 24 * 60 * 60);
  return id;
}
```

### 5.2 Session ID

**Source:** `src/features/analytics/client/session.ts`

| Property | Value |
|----------|-------|
| Storage | `sessionStorage` key `bb_session_state` |
| Idle timeout | 30 minutes (`SESSION_IDLE_MS = 30 * 60 * 1000`) |
| Generation | `crypto.randomUUID()` or fallback `s-{timestamp}-{random}` |
| Created by | **Frontend only** |

**Behavior:**
- A session is **reused** if:
  - Stored session exists
  - Stored `visitorId` matches current visitor
  - Less than 30 minutes since `lastActivityAt`
- A **new session** is created if:
  - No stored session
  - Visitor ID changed
  - 30+ minutes of inactivity
- Each session stores optional landing page context: `landingPageId`, `landingPageSlug`, `isLandingPageSession`.

```typescript
// Stored shape in sessionStorage
type StoredSession = {
  sessionId: string;
  visitorId: string;
  startedAt: string;       // ISO timestamp
  lastActivityAt: string; // ISO timestamp — updated on each event
  landingPageId?: string;
  landingPageSlug?: string;
  isLandingPageSession?: boolean;
};
```

### 5.3 Event & touchpoint IDs

Generated in `AnalyticsTracker.ts`:

| ID prefix | Used for |
|-----------|----------|
| `ev-{uuid}` | Analytics events |
| `tp-{uuid}` | Touchpoints (attribution snapshots) |

These are also **frontend-generated** and sent to the backend for deduplication.

---

## 6. Source & attribution tracking

**Source:** `src/features/analytics/client/attribution.ts`

### 6.1 What is captured

| Input | Source |
|-------|--------|
| UTM parameters | URL query: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` |
| Ad click IDs | URL query: `fbclid`, `gclid`, `ttclid`, `msclkid`, `li_fat_id` |
| Referrer | `document.referrer` |
| Landing page slug | Passed from page context or parsed from `/lp/{slug}` |

### 6.2 Storage

| Key | Storage | Content |
|-----|---------|---------|
| `bb_attribution_v1` | `localStorage` | First-touch + last-touch UTM, attribution, click IDs |

**First-touch vs last-touch rules:**
- **First-touch UTM** — set once on the first visit that has UTM params; never overwritten.
- **Last-touch UTM** — updated whenever a new visit has UTM params.
- **First-touch attribution** — set once when first source is known.
- **Last-touch attribution** — updated when new UTM, click IDs, or referrer appear.
- **Click IDs** — merged cumulatively (once seen, kept in store).

### 6.3 Traffic source classification

Function: `classifyTrafficSource()`

| Category | Triggers |
|----------|----------|
| `paid_search` | `gclid`, `msclkid`, or medium contains cpc/ppc/paid |
| `paid_social` | `fbclid`, `ttclid`, `li_fat_id`, or paid social medium |
| `email` | medium/source contains email or newsletter |
| `qr` | medium/source contains qr |
| `social` | facebook, instagram, linkedin, tiktok, twitter, x |
| `organic_search` | referrer from google/bing/yahoo/duckduckgo |
| `referral` | any other external referrer |
| `direct` | no UTM, no click IDs, no referrer |

### 6.4 Attribution object shape

```typescript
interface TrafficAttribution {
  source?: string;      // e.g. "instagram", "google", or referrer hostname
  medium?: string;      // e.g. "paid_social", "cpc", "none"
  campaign?: string;
  content?: string;
  term?: string;
  referrer?: string;
  landingPage?: string;
  category?: TrafficSourceCategory;
}
```

---

## 7. Page visit & event tracking

### 7.1 Where tracking starts

Public landing pages mount the tracker in `LandingPageRenderer.tsx`:

```tsx
<LandingPageAnalyticsTracker landingPageId={page.id} landingPageSlug={slug} />
```

**Component:** `src/features/analytics/components/LandingPageAnalyticsTracker.tsx`

On mount it:
1. Calls `trackPageView()` once
2. Listens for scroll → `trackScrollDepth()` at 25%, 50%, 75%, 90%
3. Listens for clicks on `a`, `button`, `[data-analytics-cta]` → `trackCtaClick()`

### 7.2 Page view flow (`trackPageView`)

**Source:** `AnalyticsTracker.ts`

```
trackPageView(ctx)
  ├─ getOrCreateVisitorId()
  ├─ getOrCreateSession(visitorId, { landingPageId, landingPageSlug, isLandingPage })
  ├─ captureAttributionFromPage(pageUrl, landingPageSlug)
  ├─ collectDeviceContext()
  ├─ Dedupe: skip if same pathname + sessionId already tracked
  ├─ Create TouchpointRecord (attribution snapshot)
  ├─ Create AnalyticsEventRecord (landing_page_view or page_view)
  ├─ analyticsCollector.recordTouchpoint()
  ├─ analyticsCollector.recordEvent()
  └─ touchSession() — update lastActivityAt
```

### 7.3 Deduplication

Page views are deduplicated in-memory with:

```typescript
const dedupeKey = `${ctx.pathname}|${session.sessionId}`;
if (lastPageViewKey === dedupeKey) return;
```

This prevents double-firing on React strict-mode remounts within the same session.

### 7.4 Device context

**Source:** `device.ts`

Collected on each page view and stored in event `metadata`:

| Field | Source |
|-------|--------|
| `browser`, `browserVersion` | Parsed from `navigator.userAgent` |
| `os` | Parsed from user agent |
| `deviceType` | `mobile` \| `tablet` \| `desktop` \| `unknown` |
| `screenWidth`, `screenHeight` | `window.screen` |
| `language` | `navigator.language` |
| `timezone` | `Intl.DateTimeFormat().resolvedOptions().timeZone` |

### 7.5 Touchpoint vs event

| Record | Purpose | When created |
|--------|---------|--------------|
| **TouchpointRecord** | Attribution snapshot at visit time | One per page view |
| **AnalyticsEventRecord** | Funnel / activity event | Every tracked action |

Both share the same `visitorId` and `sessionId`.

---

## 8. Lead form integration

### 8.1 Form start

**File:** `LeadFormInteractive.tsx`

When the user edits any form field (not in admin preview):

```typescript
getAnalyticsTracker().trackFormStart(landingPageId, landingPageSlug);
```

- Fires **once per session** (`formStartedThisSession` flag in `AnalyticsTracker`).
- Event type: `form_start`.

### 8.2 Form submit

**File:** `submitLeadForm.ts`

On successful submit (non-test mode):

```typescript
getAnalyticsTracker().trackFormSubmit(landingPageId, landingPageSlug);
```

This fires **two** analytics events:
1. `form_submit`
2. `lead_created`

Plus one lead API call with full attribution context.

### 8.3 Lead payload includes analytics state

**File:** `buildLeadSubmissionApiPayload.ts`

On submit, `getAnalyticsTracker().getState()` provides:

| Field on lead payload | Source |
|-----------------------|--------|
| `visitorId` | Cookie |
| `sessionId` | sessionStorage |
| `firstTouchSource/Medium/Campaign/Content/Term` | localStorage attribution |
| `lastTouchSource/Medium/Campaign/Content/Term` | localStorage attribution |
| `fbclid`, `gclid`, `ttclid`, `msclkid`, `liFatId` | Click IDs |
| `trafficCategory` | Last-touch classification |

Also included: `device`, `location` (IP/geo via `ipwho.is`), nested `attribution`, and flat duplicates for API compatibility.

### 8.4 Full submit request sequence (production)

When a visitor submits a lead form on `/lp/{slug}`:

```
1. POST /public/lead-submissions     (lead row + visitorId + sessionId + attribution)
2. POST /public/tracking/events      (eventType: form_submit)
3. POST /public/tracking/events      (eventType: lead_created)
```

All three are independent; backend should dedupe events by `id`.

---

## 9. Data persistence & API sync

### 9.1 Local storage (always)

**Key:** `busy-bean.analytics.v1` (localStorage)

```typescript
type StoreShape = {
  v: 1;
  visitors: VisitorRecord[];
  sessions: SessionRecord[];
  touchpoints: TouchpointRecord[];
  events: AnalyticsEventRecord[];
};
```

| Array | Max rows kept |
|-------|---------------|
| touchpoints | 2,000 |
| events | 5,000 |

**Collector:** `analytics.collector.ts`

```typescript
recordTouchpoint(touchpoint) {
  analyticsRepo.appendTouchpoint(touchpoint);           // localStorage
  void analyticsApi.ingestTouchpoint(touchpoint);       // backend (async, fire-and-forget)
}

recordEvent(event) {
  analyticsRepo.appendEvent(event);                     // localStorage
  analyticsRepo.upsertVisitor({ visitorId, firstSeenAt, lastSeenAt });
  void analyticsApi.ingestEvent(event);                 // backend (async, fire-and-forget)
}
```

Backend POST failures are silently ignored (`.catch(() => undefined)`); local data is always kept.

### 9.2 Backend API endpoints

**Configured in:** `src/shared/lib/apiPaths.ts`

| Method | Path | Payload |
|--------|------|---------|
| POST | `/public/tracking/events` | `AnalyticsEventRecord` |
| POST | `/public/tracking/touchpoints` | `TouchpointRecord` |
| POST | `/public/lead-submissions` | Lead payload with IDs |
| GET | `/admin/analytics/dashboard` | Dashboard aggregates |

**Base URL:** `NEXT_PUBLIC_API_BASE_URL` (e.g. `https://testingbb.trimworldwide.com/api`)

### 9.3 When backend is called

From `src/lib/apiMode.ts`:

```typescript
export function useBackendApi(): boolean {
  if (useDemoData()) return false;
  const base = getApiBaseUrl();
  return base.startsWith("http://") || base.startsWith("https://");
}
```

| Condition | Behavior |
|-----------|----------|
| `NEXT_PUBLIC_USE_DEMO_DATA=true` | No backend calls; local/demo data only |
| Valid `NEXT_PUBLIC_API_BASE_URL` | Events/touchpoints/leads POSTed to backend |
| No API URL / demo mode | localStorage only |

---

## 10. Admin analytics dashboard

**Route:** `/admin/marketing/analytics`

**Hook:** `useAnalyticsDashboard.ts` → `analyticsApi.getDashboard()`

| Mode | Data source |
|------|-------------|
| Backend enabled | `GET /admin/analytics/dashboard?from=&to=` |
| Backend disabled / error | `aggregateAnalytics.ts` over localStorage |

### Dashboard tabs & data

| Tab | Key metrics |
|-----|-------------|
| Executive | totalVisitors, totalLeads, revenue, conversionRate, returningVisitors |
| Marketing | trafficSources, utmCampaigns, recentTouchpoints, recentEvents |
| Funnel | landing_page_view → cta_click → form_start → form_submit → lead_created → order_completed |
| Landing pages | Per-slug visitors, bounce rate, scroll depth, conversions |
| Leads | Separate `GET /admin/lead-submissions` (not from dashboard endpoint) |

---

## 11. Demo vs production mode

### Demo analytics data

**File:** `src/features/analytics/data/demoAnalytics.ts`

Contains **hardcoded static IDs** for the admin UI demo:

| ID pattern | Example |
|------------|---------|
| Visitor | `vis-demo-001` |
| Session | `ses-demo-001` |
| Touchpoint | `tp-demo-001` |
| Event | `ev-demo-001` |

**Important:** Real visitor tracking never uses these IDs. They are only for seeded demo dashboard data.

On first real analytics read, `purgeDemoAnalyticsRecords()` removes any demo rows from localStorage.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base (required for production sync) |
| `NEXT_PUBLIC_USE_DEMO_DATA` | When truthy, disables all backend HTTP calls |

---

## 12. Multi-visit user journeys

The system tracks **one person across multiple visits** in the same browser.

| ID | Same across visits? | Lifetime | Use for |
|----|---------------------|----------|---------|
| `visitorId` | Yes | 365 days (cookie) | Unique people, returning visitors, lifetime journey |
| `sessionId` | No | New after 30 min idle | Single-visit funnel, bounce rate |

### Example: 3 visits, same browser

**Visit 1 — Instagram ad, browse only**
```
visitorId:  a1b2-…  (new cookie)
sessionId:  sess-001 (new session)
URL:        /lp/coffee?utm_source=instagram&utm_campaign=awareness
→ firstTouch = instagram/awareness
→ lastTouch  = instagram/awareness
```

**Visit 2 — Returns days later, Google retargeting**
```
visitorId:  a1b2-…  (SAME cookie)
sessionId:  sess-002 (NEW session)
URL:        /lp/coffee?utm_source=google&utm_campaign=retarget
→ firstTouch = instagram/awareness (unchanged)
→ lastTouch  = google/retarget (updated)
→ returning visitor (firstSeenAt ≠ lastSeenAt)
```

**Visit 3 — Signs up via lead form**
```
visitorId:  a1b2-…  (SAME)
sessionId:  sess-003 (NEW)
Lead payload includes:
  firstTouchSource: instagram
  lastTouchSource:  google
  visitorId + sessionId for linking
```

---

## 13. Event types reference

| eventType | When fired | Key metadata |
|-----------|------------|--------------|
| `landing_page_view` | `/lp/{slug}` page load | pageTitle, device, isLandingPage |
| `page_view` | Generic non-LP page load | Same as above |
| `cta_click` | Click on link/button/CTA | `label` |
| `form_start` | First form field interaction per session | — |
| `form_submit` | Successful form submit | — |
| `lead_created` | Immediately after form_submit | — |
| `scroll_depth` | Scroll milestones | `depthPct`: 25, 50, 75, or 90 |
| `quote_requested` | Reserved | — |
| `order_created` | Reserved | — |
| `payment_completed` | Reserved | `revenue` optional |
| `order_completed` | Reserved | `revenue` optional |

---

## 14. Storage keys reference

> Full detail on static key names, constants, and ID formats: [Section 2](#2-frontend-generated-keys--ids-not-backend).

| Key | Storage | Lifetime | Content |
|-----|---------|----------|---------|
| `bb_visitor_id` | Cookie | 365 days | Visitor UUID |
| `bb_session_state` | sessionStorage | Tab session + 30 min idle | Session JSON |
| `bb_attribution_v1` | localStorage | Until cleared | First/last touch UTM + click IDs |
| `busy-bean.analytics.v1` | localStorage | Until cleared | Events, touchpoints, visitors |

---

## 15. Implementation checklist (for new pages)

To add tracking to a new public page:

### Step 1 — Mount the tracker component

```tsx
import { LandingPageAnalyticsTracker } from "@features/analytics/components/LandingPageAnalyticsTracker";

<LandingPageAnalyticsTracker
  landingPageId={page.id}
  landingPageSlug={slug}
/>
```

### Step 2 — Provide lead context (if page has a form)

```tsx
import { LeadSubmitPageProvider } from "@features/leads/context/LeadSubmitPageContext";

<LeadSubmitPageProvider value={{ landingPageId: page.id, landingPageSlug: slug }}>
  {/* form + tracker */}
</LeadSubmitPageProvider>
```

### Step 3 — Use existing form component

`LeadFormInteractive` already calls `trackFormStart` and `submitLeadForm` handles `trackFormSubmit`.

### Step 4 — Optional: custom CTA tracking

Add `data-analytics-cta="Your label"` to buttons/links, or call:

```typescript
getAnalyticsTracker().trackCtaClick("Get a quote", landingPageId, landingPageSlug);
```

### Step 5 — Optional: custom events

```typescript
getAnalyticsTracker().trackEvent({
  eventType: "quote_requested",
  landingPageId,
  landingPageSlug,
  metadata: { plan: "enterprise" },
});
```

### Step 6 — Read current analytics state (e.g. for debugging)

```typescript
const state = getAnalyticsTracker().getState();
// { visitorId, sessionId, firstTouchUtm, lastTouchUtm, firstTouchAttribution, lastTouchAttribution, clickIds }
```

---

## Quick reference: frontend vs backend

| Responsibility | Frontend | Backend |
|----------------|----------|---------|
| Generate visitorId | ✅ | ❌ |
| Generate sessionId | ✅ | ❌ |
| Parse UTM / referrer | ✅ | ❌ |
| Classify traffic source | ✅ | ❌ (may re-aggregate) |
| Track page views & events | ✅ | ❌ |
| Store events & touchpoints | ✅ (localStorage) + POST | ✅ (persistent DB) |
| Aggregate dashboard metrics | ✅ (fallback) | ✅ (primary in production) |
| Link leads to visitor journey | ✅ (sends IDs on submit) | ✅ (stores & joins by visitorId) |

---

*Last updated: matches implementation in `page-builder-nextjs` analytics feature module.*
