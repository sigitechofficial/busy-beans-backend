# Page Builder — Seed data (backend)

**Companion to:** [PAGE_BUILDER_API_FRONTEND_GUIDE.md](./PAGE_BUILDER_API_FRONTEND_GUIDE.md)

The admin **Seed Data** UI (`/admin/marketing/seed`) syncs `page-builder-nextjs/src/data/` via existing module APIs (steps 1–10). There is no bulk `POST /api/admin/seed` endpoint.

## Backend endpoints for the UI

| Purpose | Method | Path |
|---------|--------|------|
| Check what is already seeded | `GET` | `/api/admin/seed/status` |
| Record last sync (optional) | `PATCH` | `/api/admin/seed/status` |
| Toggle section active | `PATCH` | `/api/admin/section-catalog/overrides/:sectionType/active` |

## Safe re-sync (idempotent creates)

| Module | Match key | Behavior on duplicate |
|--------|-----------|------------------------|
| Products | `slug` | Updates existing row |
| Forms | `slug` | Updates existing row |
| Landing pages | `slug` | Updates metadata/sections on existing row |
| Campaigns | `name` (case-insensitive) | Updates existing row |
| Media | `name` (case-insensitive) | Returns existing asset (no second upload) |
| Section catalog | `sectionType` | `PUT` upserts |

## Server bootstrap (CLI only)

```bash
npm run marketing:migrate
npm run marketing:seed-admin
npm run marketing:seed-all    # tracking defaults + 5 marketing products
```

Full ~90-row seed still requires the admin UI (or future shared JSON export).

## Status rules

Expected counts and slug/name lists live in `marketing/data/seedManifest.js`.  
`GET /api/admin/seed/status` derives `seeded` / `completeness` from the database; optional `marketing_seed_status` stores `syncedAt` / `syncedBy` from `PATCH`.

See the full contract in the frontend repo guide: `PAGE_BUILDER_SEED_BACKEND_GUIDE.md`.
