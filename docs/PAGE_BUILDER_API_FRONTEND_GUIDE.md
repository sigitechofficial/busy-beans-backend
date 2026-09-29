# Page Builder API — Frontend Integration Guide

> **Partly outdated (2026-09).** Written for the Vite/MSW builder; the builder is now Next.js and the website renders `/lp` itself. Current references: `docs/analytics/EVENT_CONTRACT.md` (events, reports, revenue), `docs/security/HARDENING.md` (API security), and in the Campaign Builder repo `docs/landing-pages/ARCHITECTURE.md` / `ENVIRONMENT.md` / `RENDERER_PACKAGE.md`.

**Backend:** `busy-beans-backend` (marketing module)  
**Audience:** Frontend team (`busy-bean-page-builder`)  
**Status:** MVP implemented — wire existing UI to these HTTP endpoints  
**Last updated:** 2026-06-02

This document mirrors the original backend requirements spec, but lists **only what is implemented today** with real request/response examples. It does not cover UI flows (your app already has those).

---

## 1) Base URL and auth

| Item              | Value                                                           |
| ----------------- | --------------------------------------------------------------- |
| **API prefix**    | `/api`                                                          |
| **Local example** | `http://192.168.18.143:8013/api` or `http://127.0.0.1:8011/api` |
| **Production**    | Same origin recommended: `https://<your-domain>/api`            |
| **Frontend env**  | `VITE_API_BASE_URL` → paths below are relative to this base     |

### Auth header (admin routes)

```http
Authorization: Bearer <jwt>
```

- Token from `POST /api/auth/login` → `data.token`
- Store in `localStorage` key `auth_token` (matches existing frontend `http.ts`)

### Route groups

| Group  | Prefix          | Auth            |
| ------ | --------------- | --------------- |
| Health | `/api/health`   | None            |
| Auth   | `/api/auth`     | Mixed           |
| Admin  | `/api/admin/*`  | Bearer required |
| Public | `/api/public/*` | None            |

---

## 2) Response envelope (all marketing JSON APIs)

### Success

```json
{
  "data": {}
}
```

Lists return `data` as an **array**.

### Error

```json
{
  "error": "Human readable message",
  "code": "ERROR_CODE",
  "details": {}
}
```

`details` is optional (e.g. validation errors, campaign list on delete).

### HTTP status codes used

| Code | When                                             |
| ---- | ------------------------------------------------ |
| 200  | OK                                               |
| 201  | Created                                          |
| 204  | Deleted / logout (no body)                       |
| 400  | Validation                                       |
| 401  | Auth / invalid preview token                     |
| 404  | Not found                                        |
| 409  | Conflict (slug taken, page in use, media in use) |
| 413  | Upload too large                                 |
| 429  | Lead rate limit                                  |
| 500  | Server error                                     |

---

## 3) Implemented vs not implemented

### Implemented (MVP)

- Auth (login, me, logout, profile, change password)
- Landing pages admin (full lifecycle)
- Public landing page by slug
- Draft preview by token
- Lead submissions (public POST)
- Media library (list, upload, metadata, replace file, delete)
- Background scheduler (scheduled publish / unpublish)
- Health check

### Implemented (Phase 2 — full admin parity)

- Global tracking settings (`/api/admin/tracking/settings`)
- Marketing products catalog (`/api/admin/products`) — table `marketing_products`
- Campaigns CRUD (`/api/admin/campaigns`)
- Global sections (`/api/admin/global-sections`)
- Standalone forms (`/api/admin/forms`) — table `marketing_forms`
- Section catalog overrides (`/api/admin/section-catalog/overrides`)
- Product listing catalog overrides (`/api/admin/product-listing-catalog/overrides`)
- Custom templates (`/api/admin/templates/custom`)
- Built-in template overrides (`/api/admin/templates/builtin/:templateId/override`)

### Seed Data UI support

- `GET /api/admin/seed/status` — per-module `seeded`, `completeness`, counts (derived from DB + manifest)
- `PATCH /api/admin/seed/status` — optional `syncedAt` / `syncedBy` after each UI step
- `PATCH /api/admin/section-catalog/overrides/:sectionType/active` — toggle `active`
- **Idempotent creates** (re-sync safe): same `slug` on products/forms/landing pages; same `name` on campaigns; same media `name` skips re-upload
- CLI: `npm run marketing:seed-all` (tracking + 5 products only); full seed via admin UI steps 1–10

### Not implemented yet

- Admin list for lead submissions (`GET /api/admin/lead-submissions`)
- S3 media upload (local disk + CDN URL still used in dev)
- Bulk `POST /api/admin/seed` (UI uses module APIs row-by-row)

---

## 4) Health

### `GET /api/health`

**Auth:** None

**Response 200:**

```json
{
  "data": {
    "module": "page-builder",
    "status": "ok"
  }
}
```

---

## 5) Auth — `/api/auth`

### 5.1 `POST /api/auth/login`

**Auth:** None

**Request body:**

```json
{
  "email": "admin@busybean.com",
  "password": "your-password"
}
```

**Response 200:**

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_marketing_admin",
      "email": "admin@busybean.com",
      "name": "Marketing Admin",
      "role": "Super Admin",
      "initials": "MA"
    }
  }
}
```

**Errors:** `401` — `INVALID_CREDENTIALS`

---

### 5.2 `GET /api/auth/me`

**Auth:** Bearer

**Response 200:**

```json
{
  "data": {
    "id": "user_marketing_admin",
    "email": "admin@busybean.com",
    "name": "Marketing Admin",
    "role": "Super Admin",
    "initials": "MA"
  }
}
```

**Errors:** `401` — `UNAUTHORIZED`

---

### 5.3 `POST /api/auth/logout`

**Auth:** Bearer (recommended)

**Body:** empty

**Response:** `204` (no body)

---

### 5.4 `PATCH /api/auth/profile`

**Auth:** Bearer

**Request body:**

```json
{
  "name": "Sarah Mitchell"
}
```

Email is not updated (read-only in UI).

**Response 200:** same `user` object as login.

**Errors:** `400` `VALIDATION_ERROR`, `404` `NOT_FOUND`

---

### 5.5 `POST /api/auth/change-password`

**Auth:** Bearer

**Request body:**

```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

**Response 200:**

```json
{
  "data": {
    "ok": true
  }
}
```

**Errors:** `400` — `VALIDATION_ERROR`, `WEAK_PASSWORD`, `PASSWORD_UNCHANGED`, `INVALID_CURRENT_PASSWORD`

---

## 6) Landing pages (admin) — `/api/admin/landing-pages`

All routes require **Bearer** token.

### Field mapping (important for frontend)

| Frontend / autosave body             | Backend column / GET field    |
| ------------------------------------ | ----------------------------- |
| `sections` (on create / PATCH draft) | `draftSections`               |
| `draftSections` (on GET admin)       | `draftSections`               |
| `publishedSections` (on GET admin)   | `publishedSections`           |
| Public page uses `sections`          | from `publishedSections` only |

Admin **GET** returns the full Sequelize document (camelCase), including metadata fields below.

---

### 6.1 `GET /api/admin/landing-pages`

**Response 200:**

```json
{
  "data": [
    {
      "id": "lp-1780398613272",
      "title": "Office Coffee Charlotte",
      "slug": "office-coffee-charlotte",
      "status": "draft",
      "templateName": "tpl-office-coffee",
      "updatedBy": "user_marketing_admin",
      "updatedAt": "2026-06-02T11:10:44.000Z",
      "publishedUrl": "https://busybeancoffee.com/lp/office-coffee-charlotte"
    }
  ]
}
```

`templateName` is the stored `templateId` (denormalized label for list UI).  
`publishedUrl` only present when set.

---

### 6.2 `GET /api/admin/landing-pages/:id`

**Response 200:** full landing page document, e.g.:

```json
{
  "data": {
    "id": "lp-1780398613272",
    "title": "Office Coffee Charlotte",
    "slug": "office-coffee-charlotte",
    "status": "published",
    "templateId": "tpl-office-coffee",
    "campaignName": "Q2 Charlotte",
    "objective": "Lead generation",
    "targetAudience": "Offices 25+",
    "city": "Charlotte",
    "draftSections": [
      {
        "id": "hero-1",
        "type": "hero",
        "visible": true,
        "content": {
          "headline": "Office Coffee Service"
        }
      }
    ],
    "publishedSections": [
      {
        "id": "hero-1",
        "type": "hero",
        "visible": true,
        "content": {
          "headline": "Office Coffee Service"
        }
      }
    ],
    "seo": {
      "metaTitle": "Office Coffee Charlotte",
      "metaDescription": "Premium office coffee",
      "slug": "office-coffee-charlotte",
      "canonicalUrl": "",
      "ogTitle": "",
      "ogDescription": "",
      "ogImageId": "",
      "robots": "index, follow",
      "includeInSitemap": true,
      "enableFaqSchema": false,
      "enableLocalBusinessSchema": false,
      "customSchemaJson": ""
    },
    "tracking": {
      "captureUtmFields": true
    },
    "formSettings": {
      "fields": [],
      "requiredFields": [],
      "thankYouMessage": "Thanks! We will get back to you soon.",
      "notificationEmails": [],
      "testMode": false,
      "enableCrmSync": false
    },
    "previewToken": "c02a32edcbd32d05c596eb1deead4753",
    "publishedUrl": "https://busybeancoffee.com/lp/office-coffee-charlotte",
    "publishedAt": "2026-06-02T12:00:00.000Z",
    "scheduledAt": null,
    "unpublishAt": null,
    "archivedAt": null,
    "createdBy": "user_marketing_admin",
    "updatedBy": "user_marketing_admin",
    "createdAt": "2026-06-02T11:10:44.000Z",
    "updatedAt": "2026-06-02T12:00:00.000Z"
  }
}
```

**Errors:** `404` `NOT_FOUND`

**Note:** `versions[]` is not embedded yet; version rows exist in DB for restore.

---

### 6.3 `POST /api/admin/landing-pages`

**Request body:**

```json
{
  "title": "Office Coffee Service Charlotte",
  "slug": "office-coffee-service-charlotte",
  "templateId": "tpl-office-coffee",
  "campaignName": "Q2 Charlotte",
  "objective": "Lead generation",
  "targetAudience": "Offices 25+ employees",
  "city": "Charlotte",
  "sections": [
    {
      "id": "hero-1",
      "type": "hero",
      "visible": true,
      "content": {}
    }
  ],
  "seo": {},
  "tracking": {},
  "formSettings": {}
}
```

| Field      | Required | Notes                                       |
| ---------- | -------- | ------------------------------------------- |
| `title`    | No       | defaults to `"Untitled Landing Page"`       |
| `slug`     | Yes      | `^[a-z0-9-]{3,}$`                           |
| `sections` | No       | defaults to `[]`; stored as `draftSections` |
| `id`       | No       | auto `lp-<timestamp>` if omitted            |

**Response 201:** full page object (same shape as GET by id), `status: "draft"`.

**Errors:**

- `400` `INVALID_SLUG`
- `409` `SLUG_TAKEN`

---

### 6.4 `PATCH /api/admin/landing-pages/:id/draft`

Autosave from builder. All fields optional.

**Request body:**

```json
{
  "title": "Updated title",
  "sections": [
    {
      "id": "hero-1",
      "type": "hero",
      "visible": true,
      "content": { "headline": "Updated" }
    },
    {
      "id": "cta-1",
      "type": "cta-banner",
      "visible": true,
      "content": {}
    }
  ],
  "seo": {
    "metaTitle": "Updated meta"
  },
  "tracking": {
    "captureUtmFields": true
  },
  "formSettings": {
    "testMode": true
  }
}
```

**Response 200:** full updated page (draft fields updated; `publishedSections` unchanged).

**Errors:** `404` `NOT_FOUND`

---

### 6.5 `GET /api/admin/landing-pages/:id/validate`

Pre-publish checklist.

**Response 200:**

```json
{
  "data": {
    "passed": false,
    "errors": [
      {
        "key": "sections.hero",
        "message": "A visible Hero section is required"
      }
    ],
    "warnings": [
      {
        "key": "sections.lead-form",
        "message": "Consider adding a Lead Form section"
      }
    ]
  }
}
```

**Rules:**

- Error: visible `hero` required
- Error: at least one visible CTA among `hero`, `cta-banner`, `lead-form`
- Warning: visible `lead-form` recommended

---

### 6.6 `POST /api/admin/landing-pages/:id/publish`

**Request body:**

```json
{
  "scheduledAt": null,
  "unpublishAt": null,
  "notes": "Launch Q2 campaign"
}
```

| Field         | Notes                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `scheduledAt` | ISO string; if **future**, `status` → `scheduled`, `publishedSections` stays null until scheduler runs |
| `unpublishAt` | ISO string; scheduler sets page back to `draft` when due                                               |
| `notes`       | Stored on version row                                                                                  |

**Response 200:** full page with `status: "published"` (or `"scheduled"`), `publishedSections` copied from draft when published immediately.

**Errors:**

- `400` `VALIDATION_FAILED` with `details` same shape as validate endpoint
- `404` `NOT_FOUND`

---

### 6.7 `POST /api/admin/landing-pages/:id/unpublish`

**Body:** empty or `{}`

**Response 200:** page with `status: "draft"`, `publishedAt: null`, `scheduledAt: null`

---

### 6.8 `POST /api/admin/landing-pages/:id/duplicate`

**Response 201:** new page, `slug` like `{original}-copy` or `{original}-copy-2`, `status: "draft"`

---

### 6.9 `POST /api/admin/landing-pages/:id/archive`

**Response 200:** `status: "archived"`, `archivedAt` set

---

### 6.10 `DELETE /api/admin/landing-pages/:id`

**Response 204** on success (no body).

**Response 409:**

```json
{
  "error": "This page is used by campaigns: Q2 Office Coffee. Unlink it in Campaigns before deleting.",
  "code": "PAGE_IN_USE",
  "details": {
    "campaigns": [
      { "id": "cmp-001", "name": "Q2 Office Coffee", "status": "active" }
    ]
  }
}
```

---

### 6.11 `POST /api/admin/landing-pages/:id/restore`

**Request body:**

```json
{
  "versionNumber": 1
}
```

Restores `draftSections` from `landing_page_versions.sections_snapshot` when available.

**Response 200:** page with `status: "draft"`

**Errors:** `400` `VALIDATION_ERROR`, `404` `NOT_FOUND`

---

### 6.12 `POST /api/admin/landing-pages/:id/preview-token`

**Response 200:**

```json
{
  "data": {
    "token": "c02a32edcbd32d05c596eb1deead4753",
    "previewUrl": "https://busybeancoffee.com/preview/landing-page/lp-1780398613272?token=c02a32edcbd32d05c596eb1deead4753"
  }
}
```

`previewUrl` uses `PUBLIC_SITE_URL` from server env.

---

## 7) Public landing pages — `/api/public/landing-pages`

No auth.

### 7.1 `GET /api/public/landing-pages/:slug`

**Response 200** (published content only):

```json
{
  "data": {
    "id": "lp-1780398613272",
    "title": "Office Coffee Charlotte",
    "slug": "office-coffee-charlotte",
    "status": "published",
    "templateId": "tpl-office-coffee",
    "campaignName": "Q2 Charlotte",
    "objective": "Lead generation",
    "targetAudience": "Offices 25+",
    "city": "Charlotte",
    "sections": [
      {
        "id": "hero-1",
        "type": "hero",
        "visible": true,
        "content": {}
      }
    ],
    "seo": { "metaTitle": "...", "slug": "office-coffee-charlotte" },
    "tracking": { "captureUtmFields": true },
    "formSettings": { "testMode": false },
    "publishedUrl": "https://busybeancoffee.com/lp/office-coffee-charlotte",
    "publishedAt": "2026-06-02T12:00:00.000Z"
  }
}
```

| Condition                                     | Result |
| --------------------------------------------- | ------ |
| Slug not found                                | `404`  |
| `status` draft / archived                     | `404`  |
| `status` scheduled, `scheduledAt` in future   | `404`  |
| `status` published (or scheduled time passed) | `200`  |

**Headers:** `Cache-Control: public, max-age=60`

**Note:** Response uses `sections` (not `draftSections` / `publishedSections`). No `previewToken`.

---

### 7.2 `GET /api/public/landing-pages/preview/:pageId?token=...`

**Query:** `token` (required) — must match page `previewToken`

**Response 200:** same shape as public slug, but `sections` = **draft** content.

**Errors:**

- `401` `INVALID_PREVIEW_TOKEN`
- `404` `NOT_FOUND`

---

## 8) Lead submissions — `/api/public/lead-submissions`

### 8.1 `POST /api/public/lead-submissions`

**Auth:** None (rate limited: default 20/min per IP)

**Request body:**

```json
{
  "fields": {
    "name": "Jane Doe",
    "email": "jane@company.com",
    "phone": "555-0100",
    "company": "Acme Corp"
  },
  "pageUrl": "https://busybeancoffee.com/lp/office-coffee-charlotte?utm_source=facebook",
  "submittedAt": "2026-06-02T14:30:00.000Z",
  "testMode": false
}
```

| Field         | Required | Notes                                                   |
| ------------- | -------- | ------------------------------------------------------- |
| `fields`      | Yes      | object; must include `email` and/or `phone`             |
| `pageUrl`     | Yes      | used to resolve landing page id from `/lp/{slug}`       |
| `submittedAt` | No       | defaults to now                                         |
| `testMode`    | No       | if `true`: returns success, **does not** store or email |

**Response 200:**

```json
{
  "data": {
    "ok": true,
    "stored": true
  }
}
```

When `testMode: true`: `{ "ok": true, "stored": false }`

**Errors:** `400` `VALIDATION_ERROR`, `429` `RATE_LIMITED`

---

## 9) Media library — `/api/admin/media`

All routes require **Bearer** token.

### 9.1 `GET /api/admin/media`

**Response 200:**

```json
{
  "data": [
    {
      "id": "media-upload-1780399000000",
      "name": "hero-background.jpg",
      "type": "image",
      "usageCount": 2,
      "altText": "Office coffee hero",
      "url": "https://busybeancoffee.com/public/marketing-media/a1b2c3d4e5f6.jpg",
      "approved": true,
      "isCustom": true
    }
  ]
}
```

`usageCount` = number of landing pages referencing this id in draft or published sections.

---

### 9.2 `POST /api/admin/media`

**Content-Type:** `multipart/form-data`  
**Field name:** `file` (required)

Optional form fields: `name`, `altText`

**Limits:**

- Max size: `MEDIA_UPLOAD_MAX_BYTES` (default 5 MB)
- Types: `image/*`, `video/*` (mp4, webm), `application/pdf`

**Response 201:**

```json
{
  "data": {
    "id": "media-upload-1780399000000",
    "url": "https://busybeancoffee.com/public/marketing-media/a1b2c3d4e5f6.jpg",
    "name": "hero-background.jpg",
    "type": "image",
    "altText": "",
    "approved": true
  }
}
```

**Errors:** `400` `VALIDATION_ERROR`, `UNSUPPORTED_MIME`, `413` `FILE_TOO_LARGE`

---

### 9.3 `PATCH /api/admin/media/:id`

**Request body (JSON):**

```json
{
  "name": "Hero background",
  "altText": "Office coffee service"
}
```

**Response 200:**

```json
{
  "data": {
    "id": "media-upload-1780399000000",
    "name": "Hero background",
    "type": "image",
    "altText": "Office coffee service",
    "url": "https://...",
    "approved": true
  }
}
```

---

### 9.4 `PUT /api/admin/media/:id/file`

Replace binary, keep same id.

**Content-Type:** `multipart/form-data`  
**Field name:** `file`

**Response 200:** same shape as PATCH response (updated `url` if file changed).

---

### 9.5 `DELETE /api/admin/media/:id`

**Query:** `force=true` optional — delete even if `usageCount > 0`

**Response 204** on success.

**Response 409:**

```json
{
  "error": "Media is used by 2 page(s). Use ?force=true to delete anyway.",
  "code": "MEDIA_IN_USE",
  "details": {
    "usageCount": 2
  }
}
```

---

## 10) Shared JSON shapes (reference)

### LandingPageSection

```typescript
interface LandingPageSection {
  id: string;
  type: string; // e.g. "hero", "lead-form", "cta-banner"
  visible: boolean;
  locked?: boolean;
  globalSectionId?: string;
  content: Record<string, unknown>;
  styleOverrides?: {
    paddingTop?: string;
    paddingBottom?: string;
    backgroundColor?: string;
    textColor?: string;
  };
}
```

### LandingPageStatus

`draft` | `published` | `scheduled` | `archived`

### SEOSettings (defaults on create)

```json
{
  "metaTitle": "",
  "metaDescription": "",
  "slug": "<page-slug>",
  "canonicalUrl": "",
  "ogTitle": "",
  "ogDescription": "",
  "ogImageId": "",
  "robots": "index, follow",
  "includeInSitemap": true,
  "enableFaqSchema": false,
  "enableLocalBusinessSchema": false,
  "customSchemaJson": ""
}
```

### TrackingSettings (defaults on create)

```json
{
  "captureUtmFields": true
}
```

### LandingPageFormSettings (defaults on create)

```json
{
  "fields": [],
  "requiredFields": [],
  "thankYouMessage": "Thanks! We will get back to you soon.",
  "notificationEmails": [],
  "testMode": false,
  "enableCrmSync": false
}
```

---

## 11) Frontend env flags (production)

```env
VITE_API_BASE_URL=http://192.168.18.143:8013/api
VITE_USE_REAL_LANDING_PAGE_API=true
VITE_DISABLE_MSW=true
VITE_ENABLE_MSW=false
```

Other modules (campaigns, forms, global sections, etc.) remain on localStorage until Phase 2 APIs exist.

---

## 12) Quick endpoint index

| Method | Path                                                        | Auth   |
| ------ | ----------------------------------------------------------- | ------ |
| GET    | `/api/health`                                               | No     |
| POST   | `/api/auth/login`                                           | No     |
| GET    | `/api/auth/me`                                              | Bearer |
| POST   | `/api/auth/logout`                                          | Bearer |
| PATCH  | `/api/auth/profile`                                         | Bearer |
| POST   | `/api/auth/change-password`                                 | Bearer |
| GET    | `/api/admin/landing-pages`                                  | Bearer |
| GET    | `/api/admin/landing-pages/:id`                              | Bearer |
| POST   | `/api/admin/landing-pages`                                  | Bearer |
| PATCH  | `/api/admin/landing-pages/:id/draft`                        | Bearer |
| GET    | `/api/admin/landing-pages/:id/validate`                     | Bearer |
| POST   | `/api/admin/landing-pages/:id/publish`                      | Bearer |
| POST   | `/api/admin/landing-pages/:id/unpublish`                    | Bearer |
| POST   | `/api/admin/landing-pages/:id/duplicate`                    | Bearer |
| POST   | `/api/admin/landing-pages/:id/archive`                      | Bearer |
| DELETE | `/api/admin/landing-pages/:id`                              | Bearer |
| POST   | `/api/admin/landing-pages/:id/restore`                      | Bearer |
| POST   | `/api/admin/landing-pages/:id/preview-token`                | Bearer |
| GET    | `/api/public/landing-pages/:slug`                           | No     |
| GET    | `/api/public/landing-pages/preview/:pageId?token=`          | No     |
| POST   | `/api/public/lead-submissions`                              | No     |
| GET    | `/api/admin/media`                                          | Bearer |
| POST   | `/api/admin/media`                                          | Bearer |
| PATCH  | `/api/admin/media/:id`                                      | Bearer |
| PUT    | `/api/admin/media/:id/file`                                 | Bearer |
| DELETE | `/api/admin/media/:id`                                      | Bearer |
| GET    | `/api/admin/seed/status`                                    | Bearer |
| PATCH  | `/api/admin/seed/status`                                    | Bearer |
| GET    | `/api/admin/tracking/settings`                              | Bearer |
| PUT    | `/api/admin/tracking/settings`                              | Bearer |
| GET    | `/api/admin/products`                                       | Bearer |
| POST   | `/api/admin/products`                                       | Bearer |
| PATCH  | `/api/admin/products/:id`                                   | Bearer |
| GET    | `/api/admin/campaigns`                                      | Bearer |
| POST   | `/api/admin/campaigns`                                      | Bearer |
| PATCH  | `/api/admin/campaigns/:id`                                  | Bearer |
| DELETE | `/api/admin/campaigns/:id`                                  | Bearer |
| PATCH  | `/api/admin/templates/custom/:id`                           | Bearer |
| GET    | `/api/admin/global-sections`                                | Bearer |
| POST   | `/api/admin/global-sections`                                | Bearer |
| GET    | `/api/admin/forms`                                          | Bearer |
| POST   | `/api/admin/forms`                                          | Bearer |
| PUT    | `/api/admin/section-catalog/overrides/:sectionType`         | Bearer |
| PATCH  | `/api/admin/section-catalog/overrides/:sectionType/active`  | Bearer |
| PUT    | `/api/admin/product-listing-catalog/overrides/:listingType` | Bearer |
| PUT    | `/api/admin/templates/builtin/:templateId/override`         | Bearer |

/api/admin/product-listing-catalog/overrides/:listingType/active

---

## 13) Related internal docs

- `docs/PAGE_BUILDER_BACKEND_MODULE_PLAN.md` — implementation plan
- `docs/PAGE_BUILDER_MVP_CHECKLIST.md` — QA checklist
- `docs/PAGE_BUILDER_GO_LIVE_CHECKLIST.md` — deploy steps
- `marketing/.env.example` — server env reference

---

**End of guide.** Share this file with the frontend team as the HTTP contract for the implemented Page Builder MVP.
