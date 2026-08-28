# Page Builder MVP — Endpoint Test Checklist

**Companion to:** [PAGE_BUILDER_BACKEND_MODULE_PLAN.md](./PAGE_BUILDER_BACKEND_MODULE_PLAN.md)  
**Contract reference:** `BACKEND_API_REQUIREMENTS.md` (frontend spec)  
**Base URL (local):** `http://localhost:8011/api` (adjust port/host as needed)

Use this checklist during and after MVP implementation. Mark each item `[x]` when verified.

---

## How to use

1. Run **Section 0** (prerequisites) once per environment.
2. Run **Section 1** (regression) before every release that touches `app.js` or shared middleware.
3. Complete **Sections 2–8** in order for MVP sign-off.
4. Record failures with: endpoint, status, request body (redacted), response `error` / `code`.

**Auth helper:** After login, set:

```http
Authorization: Bearer <token>
```

**Response envelope (all JSON endpoints):**

| Outcome | Shape |
|---------|--------|
| Success | `{ "data": ... }` |
| Error | `{ "error": "...", "code": "...", "details": { } }` |

---

## 0) Prerequisites

| # | Check | Pass |
|---|--------|------|
| 0.1 | Marketing tables exist in commerce DB (default: same as `config/config.json`, e.g. `livecoffee`) and migrations applied | [ ] |
| 0.2 | Seed marketing admin exists; credentials documented in secure store (not in git) | [ ] |
| 0.3 | `JWT_SECRET`, `JWT_EXPIRES_IN`, `PUBLIC_SITE_URL` set for marketing module | [ ] |
| 0.4 | S3/CDN env vars set (or media tests skipped with note) | [ ] |
| 0.5 | SMTP env vars set (or lead email tests skipped with note) | [ ] |
| 0.6 | `GET /api/health` (or marketing health route) returns 200 if implemented | [ ] |
| 0.7 | Module mounted at `/api/auth`, `/api/admin`, `/api/public` — not under `/api/v1` | [ ] |

---

## 1) Regression — existing commerce API (must not break)

Run smoke tests **without** marketing Bearer token (unless endpoint normally requires commerce auth).

| # | Endpoint | Expected | Pass |
|---|----------|----------|------|
| 1.1 | `GET /api/v1/admin` (or known safe admin route) | Same behavior as before deploy | [ ] |
| 1.2 | `GET /api/v1/leads` without token | 401 (unchanged) | [ ] |
| 1.3 | Stripe webhook route still registered (`/webhook/busy-beans-coffee`) | No routing conflict / app boots | [ ] |
| 1.4 | `POST /webhook/...` (Meta) if used | Still accepts JSON | [ ] |
| 1.5 | Server starts with no Sequelize errors on **commerce** DB connection | [ ] | [ ] |
| 1.6 | Marketing routes do **not** require commerce `protect` middleware | [ ] |

---

## 2) Auth (`/api/auth`)

### 2.1 `POST /api/auth/login`

| # | Case | Request | Expected | Pass |
|---|------|---------|----------|------|
| 2.1.1 | Valid credentials | `{ "email", "password" }` | **200**, `data.token` string, `data.user` with `id`, `email`, `name`, `role`, `initials` | [ ] |
| 2.1.2 | Wrong password | valid email, bad password | **401**, `error` message | [ ] |
| 2.1.3 | Unknown email | | **401** | [ ] |
| 2.1.4 | Missing fields | empty body / missing email | **400** | [ ] |
| 2.1.5 | Email normalized | mixed-case email | Login succeeds (stored lowercase) | [ ] |

### 2.2 `GET /api/auth/me`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 2.2.1 | Valid Bearer | **200**, `data` = user object (same shape as login) | [ ] |
| 2.2.2 | No header | **401** | [ ] |
| 2.2.3 | Invalid/expired token | **401** | [ ] |

### 2.3 `POST /api/auth/logout`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 2.3.1 | With Bearer | **204**, empty body | [ ] |
| 2.3.2 | Without token (if optional) | **204** or **401** per implementation | [ ] |

### 2.4 `PATCH /api/auth/profile`

| # | Case | Body | Expected | Pass |
|---|------|------|----------|------|
| 2.4.1 | Update name | `{ "name": "New Name" }` | **200**, `data.name` updated | [ ] |
| 2.4.2 | Email change attempt | `{ "email": "other@test.com" }` | Ignored or **400** (email read-only) | [ ] |
| 2.4.3 | No auth | | **401** | [ ] |

### 2.5 `POST /api/auth/change-password`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 2.5.1 | Valid change | **200**, `data.ok === true`; login works with new password | [ ] |
| 2.5.2 | Wrong current password | **400**, `error` message | [ ] |
| 2.5.3 | `newPassword` &lt; 6 chars | **400** | [ ] |
| 2.5.4 | New same as current | **400** | [ ] |
| 2.5.5 | No auth | **401** | [ ] |

---

## 3) Landing pages — admin (`/api/admin/landing-pages`)

**Setup:** Create at least one page via API; note `id`, `slug`, `previewToken` for later sections.

### 3.1 `GET /api/admin/landing-pages`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 3.1.1 | Authenticated list | **200**, `data` array of list items: `id`, `title`, `slug`, `status`, `updatedBy`, `updatedAt` | [ ] |
| 3.1.2 | No auth | **401** | [ ] |
| 3.1.3 | Empty DB | **200**, `data: []` | [ ] |

### 3.2 `GET /api/admin/landing-pages/:id`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 3.2.1 | Valid id | **200**, full `LandingPage` document (`draftSections`, `seo`, `tracking`, `formSettings`, etc.) | [ ] |
| 3.2.2 | Unknown id | **404** | [ ] |
| 3.2.3 | No auth | **401** | [ ] |

### 3.3 `POST /api/admin/landing-pages`

| # | Case | Body notes | Expected | Pass |
|---|------|------------|----------|------|
| 3.3.1 | Valid create | `title`, `slug`, optional `templateId` | **201**, `status: draft`, `draftSections` populated, `previewToken` set | [ ] |
| 3.3.2 | Duplicate slug | same slug twice | **409**, `code` e.g. `SLUG_TAKEN` | [ ] |
| 3.3.3 | Invalid slug | uppercase or invalid chars | **400** | [ ] |
| 3.3.4 | Slug too short | &lt; 3 chars | **400** | [ ] |
| 3.3.5 | Version row created | | `landing_page_versions` has `draft_created` (or equivalent) | [ ] |

### 3.4 `PATCH /api/admin/landing-pages/:id/draft`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 3.4.1 | Update `sections` | **200**; DB `draft_sections` updated; `published_sections` unchanged | [ ] |
| 3.4.2 | Update `seo`, `tracking`, `formSettings` | **200**; fields persisted | [ ] |
| 3.4.3 | Partial body | only `title` | **200** | [ ] |
| 3.4.4 | Unknown id | **404** | [ ] |

### 3.5 `GET /api/admin/landing-pages/:id/validate`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 3.5.1 | Invalid page (no hero) | **200**, `passed: false`, `errors` array with `key` + `message` | [ ] |
| 3.5.2 | Valid page | **200**, `passed: true` (warnings optional) | [ ] |
| 3.5.3 | Missing lead-form | **200**, `warnings` includes lead-form recommendation | [ ] |

### 3.6 `POST /api/admin/landing-pages/:id/publish`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 3.6.1 | Publish valid draft | **200**, `status: published`, `publishedSections` = copy of draft, `publishedUrl` set, `publishedAt` set | [ ] |
| 3.6.2 | Publish invalid (validation fails) | **400**, errors in body | [ ] |
| 3.6.3 | Future `scheduledAt` | **200**, `status: scheduled`, `publishedSections` null until job runs | [ ] |
| 3.6.4 | Version row on publish | new version with publish action | [ ] |
| 3.6.5 | Lead-form `submitApiUrl` injected (if configured) | sections contain default public lead URL | [ ] |

### 3.7 `POST /api/admin/landing-pages/:id/unpublish`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 3.7.1 | Unpublish published page | **200**, `status: draft` | [ ] |

### 3.8 `POST /api/admin/landing-pages/:id/duplicate`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 3.8.1 | Duplicate | **201**, new `id`, slug `{original}-copy` or unique variant, `status: draft` | [ ] |

### 3.9 `POST /api/admin/landing-pages/:id/archive`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 3.9.1 | Archive | **200**, `status: archived`, `archivedAt` set | [ ] |

### 3.10 `DELETE /api/admin/landing-pages/:id`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 3.10.1 | Delete unused page | **204** | [ ] |
| 3.10.2 | Delete page linked to active campaign | **409**, `error` names campaigns | [ ] |
| 3.10.3 | Unknown id | **404** | [ ] |

### 3.11 `POST /api/admin/landing-pages/:id/restore`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 3.11.1 | Restore version | **200**, `status: draft`, content from snapshot if stored | [ ] |
| 3.11.2 | Invalid version number | **400** or **404** | [ ] |

### 3.12 `POST /api/admin/landing-pages/:id/preview-token`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 3.12.1 | Regenerate/get token | **200**, `data.token`, `data.previewUrl` contains `pageId` and `token` query | [ ] |

---

## 4) Public landing pages (`/api/public/landing-pages`)

**No `Authorization` header** unless testing negative cases.

### 4.1 `GET /api/public/landing-pages/:slug`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 4.1.1 | Published slug | **200**, sections from `published_sections` only; no `draftSections` | [ ] |
| 4.1.2 | Draft-only slug | **404** | [ ] |
| 4.1.3 | Archived slug | **404** | [ ] |
| 4.1.4 | Scheduled, `scheduled_at` in future | **404** | [ ] |
| 4.1.5 | Unknown slug | **404** | [ ] |
| 4.1.6 | `previewToken` omitted or null in response | [ ] |
| 4.1.7 | `Cache-Control` header present (e.g. `public, max-age=60`) | [ ] |

### 4.2 `GET /api/public/landing-pages/preview/:pageId?token=...`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 4.2.1 | Valid token | **200**, `draftSections` (or equivalent draft content) | [ ] |
| 4.2.2 | Wrong token | **401** or **404** | [ ] |
| 4.2.3 | Missing token query | **400** or **401** | [ ] |
| 4.2.4 | Published page still returns draft in preview when token valid | [ ] |

---

## 5) Lead submissions (`/api/public/lead-submissions`)

### 5.1 `POST /api/public/lead-submissions`

| # | Case | Body | Expected | Pass |
|---|------|------|----------|------|
| 5.1.1 | Valid submission | `fields`, `pageUrl`, `submittedAt`, `testMode: false` | **200**, `data.ok: true`; row in `lead_submissions` | [ ] |
| 5.1.2 | `testMode: true` | | **200** but no DB row (or **400** per policy — document choice) | [ ] |
| 5.1.3 | Missing required fields | | **400** | [ ] |
| 5.1.4 | CORS preflight from public origin | `OPTIONS` + `POST` with `Origin` header | Allowed if cross-origin | [ ] |
| 5.1.5 | Rate limit | burst requests | **429** after threshold | [ ] |
| 5.1.6 | Notification email sent | check inbox/logs | [ ] |

### 5.2 `GET /api/admin/lead-submissions` (optional MVP)

| # | Case | Expected | Pass |
|---|------|----------|------|
| 5.2.1 | List with auth | **200**, paginated `data` | [ ] |
| 5.2.2 | Filter `landingPageId` | returns filtered rows | [ ] |
| 5.2.3 | No auth | **401** | [ ] |

---

## 6) Media library (`/api/admin/media`)

### 6.1 `GET /api/admin/media`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 6.1.1 | List custom uploads | **200**, `data` array with `id`, `name`, `type`, `url` (HTTPS), `altText`, `approved` | [ ] |
| 6.1.2 | No auth | **401** | [ ] |

### 6.2 `POST /api/admin/media`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 6.2.1 | Valid image upload | multipart `file` | **201**, `data.url` absolute HTTPS | [ ] |
| 6.2.2 | File &gt; 5 MB | | **413** | [ ] |
| 6.2.3 | Disallowed MIME | | **400** | [ ] |
| 6.2.4 | No file | **400** | [ ] |

### 6.3 `PATCH /api/admin/media/:id`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 6.3.1 | Update `name`, `altText` | **200** | [ ] |
| 6.3.2 | Unknown id | **404** | [ ] |

### 6.4 `PUT /api/admin/media/:id/file`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 6.4.1 | Replace file | **200**, same `id`, `url` updated if key changed | [ ] |

### 6.5 `DELETE /api/admin/media/:id`

| # | Case | Expected | Pass |
|---|------|----------|------|
| 6.5.1 | Delete unused asset | **204**; S3 object removed | [ ] |
| 6.5.2 | In use (`usageCount > 0`) | **409** unless `?force=true` | [ ] |

---

## 7) Background jobs

| # | Case | Setup | Expected | Pass |
|---|------|-------|----------|------|
| 7.1 | Scheduled publish | page `status=scheduled`, `scheduled_at` in past | Job sets `published`, copies sections, sets `published_at` | [ ] |
| 7.2 | Scheduled unpublish | `unpublish_at` in past | Job sets `status=draft` | [ ] |
| 7.3 | No double publish | run job twice concurrently | idempotent / single transition | [ ] |
| 7.4 | Job logging | | failures logged with page id | [ ] |

---

## 8) Frontend integration (staging / production)

| # | Check | Pass |
|---|--------|------|
| 8.1 | `VITE_API_BASE_URL` points to `/api` (or full API URL) | [ ] |
| 8.2 | `VITE_USE_REAL_LANDING_PAGE_API=true` | [ ] |
| 8.3 | `VITE_DISABLE_MSW=true` / `VITE_ENABLE_MSW=false` | [ ] |
| 8.4 | Admin login stores `auth_token`; protected builder calls succeed | [ ] |
| 8.5 | `/lp/:slug` loads published page from API (not localStorage) | [ ] |
| 8.6 | Preview URL with token loads draft (public preview endpoint) | [ ] |
| 8.7 | Lead form POST reaches `/api/public/lead-submissions` (network tab) | [ ] |
| 8.8 | Media picker shows uploaded CDN URLs (not base64) | [ ] |
| 8.9 | Commerce admin (`/api/v1`) still works in same browser session | [ ] |

---

## 9) Security smoke (MVP)

| # | Check | Pass |
|---|--------|------|
| 9.1 | Admin routes reject missing/invalid JWT | [ ] |
| 9.2 | Public slug never returns `draft_sections` | [ ] |
| 9.3 | Preview without valid token does not return draft | [ ] |
| 9.4 | Password hashes never in API responses | [ ] |
| 9.5 | Lead endpoint rate-limited | [ ] |
| 9.6 | Upload size/MIME enforced server-side | [ ] |

---

## 10) MVP sign-off

All must be checked before MVP release:

| # | Criterion | Pass |
|---|-----------|------|
| 10.1 | Section 1 regression — all pass | [ ] |
| 10.2 | Section 2 auth — all critical paths pass | [ ] |
| 10.3 | Section 3 landing pages — create → draft → validate → publish → public GET | [ ] |
| 10.4 | Section 4 public + preview — pass | [ ] |
| 10.5 | Section 5 lead submissions — pass | [ ] |
| 10.6 | Section 6 media — pass (or waived with ticket) | [ ] |
| 10.7 | Section 7 jobs — pass | [ ] |
| 10.8 | Section 8 frontend integration — pass on staging | [ ] |

**Signed off by:** _______________ **Date:** _______________ **Environment:** _______________

---

## Appendix — Sample requests (curl)

Replace `BASE`, `TOKEN`, `PAGE_ID`, `SLUG` as needed.

```bash
# Login
curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@busybean.com","password":"***"}'

# List landing pages
curl -s "$BASE/admin/landing-pages" -H "Authorization: Bearer $TOKEN"

# Public published page
curl -s "$BASE/public/landing-pages/$SLUG"

# Lead submission
curl -s -X POST "$BASE/public/lead-submissions" \
  -H "Content-Type: application/json" \
  -d '{"fields":{"name":"Test","email":"t@example.com"},"pageUrl":"https://example.com/lp/test","submittedAt":"2026-06-02T12:00:00.000Z","testMode":false}'
```

---

## Out of scope for this checklist (Phase-2)

Track separately when implementing parity APIs:

- Campaigns (`/api/admin/campaigns`)
- Global sections
- Forms
- Marketing products CRUD
- Global tracking settings
- Section catalog / template / product-listing overrides

See [PAGE_BUILDER_BACKEND_MODULE_PLAN.md](./PAGE_BUILDER_BACKEND_MODULE_PLAN.md) Phase-2 section.
