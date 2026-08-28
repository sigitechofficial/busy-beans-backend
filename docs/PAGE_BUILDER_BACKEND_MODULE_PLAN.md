# Page Builder Backend Module Plan

## Purpose

This document defines the implementation plan for adding the new Page Builder backend module to `busy-beans-backend` without disturbing existing modules and flows (`/api/v1/*`, webhook handling, order/subscription/QBO logic).

Primary goal: deliver a production-ready backend for the marketing page builder with isolated routes, isolated data, and safe rollout.

---

## 1) Non-Negotiable Isolation Rules

1. Keep all existing route prefixes and handlers unchanged:
   - `/api/v1/users`
   - `/api/v1/admin`
   - `/api/v1/leads`
   - `/api/v1/subscription`
   - `/qbo`
2. New module must use dedicated route groups only:
   - `/api/auth`
   - `/api/admin`
   - `/api/public`
3. Use the **same MySQL database** as commerce by default (`config/config.json` / `DATABASE_URL`). Marketing tables are namespaced (`marketing_users`, `landing_pages`, etc.) to avoid collisions. Override with `MARKETING_DB_NAME` only if needed.
4. Do not reuse existing auth role model by default; keep marketing auth isolated unless explicitly mapped later.
5. All rollout must be feature-flagged from frontend and validated on staging first.

---

## 2) Module Scope

### 2.1 MVP (Go-Live Scope)

1. Auth APIs
2. Landing Pages admin APIs (core lifecycle)
3. Public landing page by slug
4. Draft preview by secure token
5. Lead submission public API
6. Media upload and metadata APIs
7. Scheduled publish/unpublish jobs

### 2.2 Phase-2 (Parity Scope)

1. Campaigns APIs
2. Global sections APIs
3. Forms APIs
4. Marketing product catalog APIs
5. Tracking settings APIs
6. Section catalog overrides APIs
7. Custom templates + built-in template overrides
8. Product listing catalog overrides

---

## 3) Proposed Folder Structure

```text
marketing/
  index.js
  routes/
    index.js
    auth.routes.js
    admin/
      landingPages.routes.js
      media.routes.js
      campaigns.routes.js
      globalSections.routes.js
      forms.routes.js
      products.routes.js
      tracking.routes.js
      templates.routes.js
      overrides.routes.js
    public/
      landingPagesPublic.routes.js
      leadSubmissions.routes.js
  controllers/
    auth.controller.js
    landingPages.controller.js
    media.controller.js
    leadSubmissions.controller.js
    ...
  services/
    auth.service.js
    landingPages.service.js
    publish.service.js
    media.service.js
    leadSubmission.service.js
    validation.service.js
  models/
    marketingUser.js
    landingPage.js
    landingPageVersion.js
    mediaAsset.js
    leadSubmission.js
    ...
  middlewares/
    marketingAuth.js
    validateRequest.js
    errorEnvelope.js
  jobs/
    scheduledPublish.job.js
    scheduledUnpublish.job.js
  db/
    sequelize.marketing.js
  migrations/
    001_create_marketing_users.sql
    002_create_landing_pages.sql
    ...
  seeds/
    marketingAdmin.seed.js
```

---

## 4) Route Contract (High-Level)

### 4.1 Auth

1. `POST /api/auth/login`
2. `GET /api/auth/me`
3. `POST /api/auth/logout`
4. `PATCH /api/auth/profile`
5. `POST /api/auth/change-password`

### 4.2 Admin

1. `/api/admin/landing-pages` (CRUD + publish lifecycle)
2. `/api/admin/media` (upload/manage)
3. `/api/admin/*` Phase-2 modules (campaigns, forms, etc.)

### 4.3 Public

1. `GET /api/public/landing-pages/:slug`
2. `GET /api/public/landing-pages/preview/:pageId?token=...`
3. `POST /api/public/lead-submissions`

---

## 5) Execution Sequence (Numbered Tasks and Subtasks)

## Phase 0 - Foundations and Safety Gates

### 0.1 Finalize contract and acceptance checklist
1. Freeze MVP endpoint list.
2. Freeze response envelope (`{ data }`, `{ error, code, details }`).
3. Define success criteria for each MVP endpoint.

### 0.2 Environment and secrets planning
1. Add marketing DB env vars.
2. Add JWT env vars for marketing auth.
3. Add S3/CDN + SMTP env vars for marketing flows.

### 0.3 Risk controls
1. Add explicit test checklist for existing `/api/v1/*` regression.
2. Add release toggle strategy in frontend env flags.

---

## Phase 1 - Module Skeleton and Database Bootstrapping

### 1.1 Create `marketing/` module skeleton
1. Add index + route aggregators.
2. Mount module under `/api` in app bootstrap.
3. Confirm existing routes are untouched.

### 1.2 Set up isolated Sequelize instance
1. Create dedicated marketing DB connection.
2. Add migration runner for marketing migrations only.
3. Add base tables for auth + landing pages + media + leads.

### 1.3 Seed strategy
1. Seed default marketing admin user.
2. Optional seed starter template/meta defaults.

---

## Phase 2 - Auth APIs (MVP Blocker)

### 2.1 Login and token issuance
1. Validate credentials.
2. Compare bcrypt hash.
3. Return token + user profile shape expected by frontend.

### 2.2 Profile APIs
1. Implement `GET /me`.
2. Implement `PATCH /profile` (name update).
3. Implement `POST /change-password` with policy checks.

### 2.3 Auth middleware
1. Verify Bearer token for admin routes.
2. Return consistent 401 envelope on invalid/expired token.

---

## Phase 3 - Landing Pages Admin APIs (Core MVP)

### 3.1 Data model and defaults
1. Create landing page table with draft/published JSON columns.
2. Include SEO, tracking, form settings, preview token fields.
3. Add status and schedule columns (`scheduled_at`, `unpublish_at`).

### 3.2 CRUD + autosave
1. `GET /api/admin/landing-pages`
2. `GET /api/admin/landing-pages/:id`
3. `POST /api/admin/landing-pages`
4. `PATCH /api/admin/landing-pages/:id/draft` (map `sections` to `draft_sections`)

### 3.3 Validation + publish lifecycle
1. `GET /:id/validate` with pre-publish checklist response.
2. `POST /:id/publish` with validation gate.
3. `POST /:id/unpublish`
4. `POST /:id/duplicate`
5. `POST /:id/archive`
6. `DELETE /:id` with usage conflict checks.

### 3.4 Version history
1. Save version rows on create/publish.
2. Add restore endpoint behavior for snapshots.

---

## Phase 4 - Public Rendering and Preview APIs (MVP)

### 4.1 Published page by slug
1. Implement public slug endpoint.
2. Return 404 for draft/archived/not-yet-scheduled pages.
3. Return published content only (`published_sections`).

### 4.2 Draft preview by token
1. Validate page + token server-side.
2. Return draft sections only for valid token.

### 4.3 Caching and headers
1. Add cache-control for published page GET.
2. Ensure no sensitive fields leak in response payload.

---

## Phase 5 - Lead Submissions API (MVP)

### 5.1 Endpoint behavior
1. Implement `POST /api/public/lead-submissions`.
2. Validate payload and required fields.
3. Apply `testMode` policy (do not persist if test mode).

### 5.2 Security and anti-abuse
1. Apply endpoint rate limiting.
2. Add optional honeypot field strategy.
3. Add CORS policy for public origin.

### 5.3 Side effects
1. Store in `lead_submissions`.
2. Send notification email via SMTP.

---

## Phase 6 - Media Library API (MVP)

### 6.1 Media CRUD
1. `GET /api/admin/media`
2. `POST /api/admin/media` (multipart upload)
3. `PATCH /api/admin/media/:id` metadata
4. `PUT /api/admin/media/:id/file`
5. `DELETE /api/admin/media/:id`

### 6.2 Storage pipeline
1. Validate size and MIME type.
2. Upload to S3 key scheme.
3. Store public CDN URL and metadata in DB.

---

## Phase 7 - Scheduled Jobs (MVP)

### 7.1 Publish scheduler
1. Find pages due for publish.
2. Promote draft -> published fields atomically.

### 7.2 Unpublish scheduler
1. Find pages due for unpublish.
2. Move status back to draft safely.

### 7.3 Concurrency safety
1. Ensure single-job execution lock strategy.
2. Add logging for job decisions and failures.

---

## Phase 8 - Integration, QA, and Rollout

### 8.1 Integration checks
1. Validate all MVP endpoints via Postman/Swagger tests.
2. Verify frontend integration with feature flags enabled.
3. Verify no regression on existing `/api/v1/*` modules.

### 8.2 Staging rollout
1. Deploy marketing module to staging.
2. Run smoke + auth + upload + public render tests.
3. Validate scheduled publish in staging clock test.

### 8.3 Production rollout
1. Deploy backend with module enabled.
2. Enable frontend flags gradually.
3. Monitor error rates, lead submission success, media upload health.

---

## 6) Definition of Done (MVP)

MVP is complete when all conditions are true:

1. Auth flow works end-to-end from frontend login to protected admin calls.
2. Landing pages can be created, autosaved, validated, published, and publicly fetched by slug.
3. Preview token endpoint serves draft content securely.
4. Lead submissions are accepted, persisted (non-test), and notification emails are sent.
5. Media uploads store successfully in S3/CDN and are retrievable in admin list.
6. Scheduled publish/unpublish runs reliably.
7. Existing `/api/v1/*` endpoints pass regression checks.

---

## 7) Notes for Development Team

1. Keep each phase on a separate branch/PR to reduce review risk.
2. Prefer additive changes; avoid refactoring legacy modules during MVP.
3. Maintain strict API response consistency from day one.
4. Add structured logs for all new module endpoints and jobs.
5. If timeline is tight, ship MVP first and defer all phase-2 endpoints.

