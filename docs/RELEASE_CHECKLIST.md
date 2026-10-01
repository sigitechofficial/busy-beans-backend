# Release checklist: Campaign Builder, analytics and price-free catalog (phases 0–17)

What happens automatically on deploy, and what someone must do by hand per environment.
Tick the box for each environment when done. Branch: `staging/phase-0-17`.

## Automatic (GitHub Actions deploy, `.github/workflows/deploy.yml`)

Push `testing` → staging, push `main` with `.github/production-go-live` = `true` → production.
The deploy runs `npm run migrate` and `npm run marketing:migrate`. Marketing migrations are
recorded in `marketing_migrations`, so each one runs **once per environment**:

| Migration | What it does |
|---|---|
| `024`–`032` (.sql) | Analytics, attribution, consent log, SSO, product analytics tables and columns |
| `033_page_stats_lead_sessions.sql` | Lead conversion % = visits with a lead / visits; clears derived daily stats |
| `034_backfill_analytics_page_fields.js` | **Data migration**: page fields for analytics recorded before 024, product ids, old 404 views, removes contract-test data, rebuilds daily stats |
| `035_recompute_published_urls.js` | **Data migration**: stored page addresses recomputed from `WEBSITE_PUBLIC_URL` (needs manual step 1 done **before** the deploy; without it nothing changes) |
| `036_attribution_model.sql` | Attribution columns (additive): leads (touch models, flat source columns, click IDs, event/form ids, `client_submitted_at`, unique `event_id`), sessions (acquisition touch, `last_activity_at`), visitors (first/last/last non-direct touch, click IDs), touchpoints (`channel`, `touch`) |
| `037_backfill_attribution_columns.js` | **Data migration**: fills those columns for existing rows from stored data (`attribution_basis = legacy` on old leads); the original `attribution` JSON is not changed |
| `038_reporting_fixes.sql` | Marks Campaign Builder preview / canvas events recorded before ingest-time classification as `page_type = 'preview'` (website events untouched; nothing deleted); adds session indexes for visitor / new / returning counts |
| `039_report_indexes.sql` | Index `(status, paid_at)` on order attribution for report date filters (additive) |
| `040_lead_page_key.sql` | Leads store the page they were submitted on (`page_type`, `page_slug`, same key as events) for form / conversion-page reports (additive) |
| `041_backfill_lead_page_key.js` | **Data migration**: fills `page_type` / `page_slug` for existing leads from `page_url` (idempotent) |

Data migrations are `.js` files in `marketing/migrations/` exporting `async up()`; they run in
name order with the `.sql` files. Put every future one-off data fix there, never in a manual
command. The same backfills can still be run by hand (dry run first):
`npm run marketing:backfill-page-fields [-- --apply]`,
`npm run marketing:backfill-product-analytics [-- --apply]`.

## Manual, per environment

| # | Step | Staging | Production |
|---|---|---|---|
| 1 | Server `.env`: `WEBSITE_PUBLIC_URL`, `CAMPAIGN_APP_URL`, `API_PUBLIC_URL` (plain URLs, no quotes, no trailing slash), `WEBSITE_REVALIDATE_SECRET` (= website `REVALIDATE_SECRET`), `CORS_ALLOWED_ORIGINS`, `MARKETING_JWT_SECRET`, `MARKETING_ADMIN_EMAIL`, `MARKETING_ADMIN_PASSWORD`, `LEAD_NOTIFICATION_TO`/`FROM`. Remove `PUBLIC_SITE_URL`. Then `pm2 restart <app> --update-env` | [x] 2026-09-30 | [ ] |
| 2 | `npm run marketing:seed-admin` (first Campaign Builder Super Admin; resets its password to `MARKETING_ADMIN_PASSWORD`) | [x] 2026-09-30 | [ ] |
| 3 | Vercel website + Campaign Builder: environment variables (see `page-builder-nextjs/docs/landing-pages/ENVIRONMENT.md`), Standard Deployment Protection, Branch Tracking | [x] env + protection, [ ] branch tracking | [ ] |
| 4 | Only if `WEBSITE_PUBLIC_URL` was missing when the deploy ran: re-publish landing pages (migration 035 otherwise fixes stored addresses) | n/a (035) | [ ] |
| 5 | **Node 22.12+ on the server** before production: `sanitize-html` (custom-HTML server rendering) needs it. On Node 18 the API runs, but custom HTML is not pre-rendered for SEO | n/a | [ ] |
| 6 | `INTERNAL_JOB_API_KEY` in the API env **and** every Lambda/job caller (`x-job-key` header), see `docs/API_ACCESS.md`. Unset = job endpoints not enforced | [ ] | [ ] |
| 7 | Delete `.env.bak-*` copies on the server after the release is confirmed (they contain secrets) | [ ] | [ ] |
| 8 | Old React storefront staging (S3/CloudFront): staging-only `robots.txt` or `X-Robots-Tag: noindex` | [ ] | n/a |
| 9 | After deploy: `npm run marketing:attribution-test` on a non-production DB copy (it writes and removes test rows) | [ ] | n/a |

## Known deploy pitfalls (fixed, keep in mind)

- `.gitignore` must only ignore the root `/public/` upload folder: a `public/` rule hid source
  files in `controllers/public` and `marketing/routes/public` (now `storefront` and `site`).
- The deploy rsync skips every folder named `public` or `config`: never put source code in
  folders with those names.
- Before deploying, load the **committed** tree (`git archive HEAD`) under the server's Node
  version; a working folder can contain files git never saw.
