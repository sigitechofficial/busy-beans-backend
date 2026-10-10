# Page Builder Backend — Go Live Checklist

> **Partly outdated (2026-09).** Written for the Vite/MSW builder and the pre-Phase-5 `/lp` proxy. Current references: `docs/analytics/EVENT_CONTRACT.md` (events, reports, revenue), `docs/security/HARDENING.md` (API security), and in the Campaign Builder repo `docs/landing-pages/ARCHITECTURE.md` / `ENVIRONMENT.md` / `RENDERER_PACKAGE.md`.

Use this checklist for the final production release of the marketing page-builder module.

---

## 1) Environment Variables

### Required

- Commerce DB configured in `config/config.json` (dev) or `DATABASE_URL` (production)
- `MARKETING_JWT_SECRET`
- `MARKETING_JWT_EXPIRES_IN` (recommended: `7d`)
- `PUBLIC_SITE_URL`

### Optional DB overrides (default: same DB as commerce, e.g. `livecoffee`)

- `MARKETING_DB_NAME`
- `MARKETING_DB_HOST`
- `MARKETING_DB_PORT`
- `MARKETING_DB_USER`
- `MARKETING_DB_PASSWORD`
### Required for admin bootstrap

- `MARKETING_ADMIN_EMAIL`
- `MARKETING_ADMIN_PASSWORD`
- `MARKETING_ADMIN_NAME` (optional default exists)
- `MARKETING_ADMIN_ROLE` (optional default exists)
- `MARKETING_ADMIN_ID` (optional default exists)

### Required for media URLs

- `CDN_BASE_URL` (recommended)

### Required for lead notification email

- `LEAD_NOTIFICATION_FROM`
- `LEAD_NOTIFICATION_TO` (falls back to FROM if omitted)

### Optional ops controls

- `MARKETING_SCHEDULER_ENABLED=true|false`
- `MARKETING_SCHEDULER_INTERVAL_MS=60000`
- `MARKETING_LEAD_RATE_LIMIT_MAX=20`
- `MEDIA_UPLOAD_MAX_BYTES=5242880`

---

## 2) Deployment Sequence

1. Deploy backend code with marketing module enabled.
2. Run marketing migrations:
   - `npm run marketing:migrate`
3. Seed marketing admin user:
   - `npm run marketing:seed-admin`
4. Start server and verify scheduler log line appears (unless disabled).
5. Run smoke test:
   - `npm run marketing:smoke`

---

## 3) API Health and Contract Validation

1. `GET /api/health` returns 200.
2. `POST /api/auth/login` returns token and user.
3. `GET /api/auth/me` works with Bearer token.
4. Landing page create + publish flow works:
   - `POST /api/admin/landing-pages`
   - `POST /api/admin/landing-pages/:id/publish`
5. Public slug endpoint returns published page only:
   - `GET /api/public/landing-pages/:slug`
6. Lead endpoint accepts valid payload:
   - `POST /api/public/lead-submissions`
7. Media upload and list work:
   - `POST /api/admin/media`
   - `GET /api/admin/media`

---

## 4) Regression Safety (Existing System)

Verify these are unchanged:

- `/api/v1/users/*`
- `/api/v1/admin/*`
- `/api/v1/leads/*`
- `/api/v1/subscription/*`
- `/qbo/*`
- `/webhook/busy-beans-coffee`
- `/webhook/*` (Meta JSON route)

---

## 5) Data Safety and Security Checks

1. Admin routes reject missing/invalid Bearer token.
2. Public slug endpoint never exposes draft sections.
3. Preview endpoint rejects invalid token.
4. Lead endpoint rate-limit returns proper error payload.
5. Media delete blocks when asset is in-use (unless `?force=true`).
6. Landing page delete blocks when referenced by non-archived campaigns.

---

## 6) Frontend Switch Checklist

1. Set frontend API base URL to `/api` or full production API URL.
2. Enable real API usage flags in frontend build.
3. Disable MSW in production.
4. Verify `/admin/*`, `/lp/:slug`, `/preview/...` routes work in production host.

---

## 7) Rollback Plan

If severe issue appears post-release:

1. Disable frontend real-API flags (fallback to demo mode if still available).
2. Set `MARKETING_SCHEDULER_ENABLED=false`.
3. Keep module mounted but block new writes at load balancer/WAF if needed.
4. Fix forward and redeploy.

