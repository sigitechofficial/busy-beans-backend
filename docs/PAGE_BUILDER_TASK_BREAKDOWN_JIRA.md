# Page Builder Backend — Jira Task Breakdown

**Project:** Busy Beans Backend  
**Module:** Marketing Page Builder  
**Execution model:** Isolated module inside existing repo (`/api/auth`, `/api/admin`, `/api/public`) with separate marketing DB/schema.

---

## Epic 1 — Foundations, Isolation, and Infrastructure

### Story 1.1 — Define module boundaries and acceptance criteria
**Estimate:** 3 points  
**Dependencies:** None

**Subtasks**
1. Document route isolation rules (`/api/v1/*` untouched).
2. Freeze MVP scope and defer Phase-2 APIs.
3. Define response envelope and error code conventions.
4. Define definition-of-done for MVP.

**Acceptance**
- MVP scope approved.
- Isolation and non-regression rules approved.

---

### Story 1.2 — Create marketing module skeleton in backend
**Estimate:** 5 points  
**Dependencies:** Story 1.1

**Subtasks**
1. Create `marketing/` module root and route aggregators.
2. Add route groups (`auth`, `admin`, `public`).
3. Mount marketing router in app bootstrap under `/api`.
4. Add module-level error wrapper and request validation middleware.

**Acceptance**
- App boots with no route conflicts.
- Existing `/api/v1/*` endpoints unchanged.

---

### Story 1.3 — Marketing DB connection, migrations, and seed
**Estimate:** 8 points  
**Dependencies:** Story 1.2

**Subtasks**
1. Create dedicated Sequelize connection for marketing DB.
2. Add migration runner path for marketing module.
3. Create base migration set for MVP tables.
4. Add seed script for default marketing admin user.

**Acceptance**
- Marketing migrations run independently.
- Seed admin user can log in.

---

## Epic 2 — Marketing Authentication APIs

### Story 2.1 — Implement login and token flow
**Estimate:** 5 points  
**Dependencies:** Story 1.3

**Subtasks**
1. Create `POST /api/auth/login`.
2. Validate credentials and bcrypt compare.
3. Return token + normalized user payload.
4. Add auth failure responses (401).

**Acceptance**
- Valid credentials return token and user data.
- Invalid credentials rejected with 401.

---

### Story 2.2 — Implement me/profile/password APIs
**Estimate:** 8 points  
**Dependencies:** Story 2.1

**Subtasks**
1. Implement `GET /api/auth/me`.
2. Implement `PATCH /api/auth/profile` (name editable, email read-only).
3. Implement `POST /api/auth/change-password`.
4. Implement `POST /api/auth/logout` (204 semantics).
5. Add token verification middleware for protected routes.

**Acceptance**
- Authenticated flows pass checklist.
- Unauthorized calls return 401 with envelope.

---

## Epic 3 — Landing Pages Admin APIs (MVP Core)

### Story 3.1 — Create landing page data model and defaults
**Estimate:** 8 points  
**Dependencies:** Story 1.3

**Subtasks**
1. Create `landing_pages` migration and model.
2. Add `landing_page_versions` migration and model.
3. Add slug uniqueness + status indexes.
4. Add defaults for SEO/tracking/form settings and preview token.

**Acceptance**
- Create/read works at model level.
- Unique slug enforced.

---

### Story 3.2 — Implement landing page CRUD + autosave
**Estimate:** 13 points  
**Dependencies:** Story 3.1, Story 2.2

**Subtasks**
1. Implement list endpoint.
2. Implement get-by-id endpoint.
3. Implement create endpoint with template/section initialization.
4. Implement patch-draft endpoint mapping `sections -> draft_sections`.
5. Add validation for slug/title inputs.

**Acceptance**
- Builder can create and autosave draft pages.

---

### Story 3.3 — Implement publish lifecycle and versioning
**Estimate:** 13 points  
**Dependencies:** Story 3.2

**Subtasks**
1. Implement pre-publish validation endpoint.
2. Implement publish endpoint (draft->published snapshot copy).
3. Implement unpublish endpoint.
4. Implement duplicate/archive/delete endpoints.
5. Add campaign reference conflict rule on delete (409).
6. Save version records on create/publish.

**Acceptance**
- Full page lifecycle works for admin user.

---

## Epic 4 — Public APIs for Rendering and Preview

### Story 4.1 — Implement public published page by slug
**Estimate:** 8 points  
**Dependencies:** Story 3.3

**Subtasks**
1. Implement `GET /api/public/landing-pages/:slug`.
2. Enforce visibility rules for draft/archived/scheduled pages.
3. Return published content only.
4. Add cache-control header.

**Acceptance**
- Public endpoint returns only published pages and fields.

---

### Story 4.2 — Implement secure preview-by-token endpoint
**Estimate:** 5 points  
**Dependencies:** Story 3.2

**Subtasks**
1. Implement `GET /api/public/landing-pages/preview/:pageId?token=...`.
2. Validate token server-side.
3. Return draft content only for valid token.

**Acceptance**
- Preview requires valid token and never leaks data without it.

---

## Epic 5 — Lead Submission APIs (MVP)

### Story 5.1 — Implement public lead submission endpoint
**Estimate:** 8 points  
**Dependencies:** Story 4.1

**Subtasks**
1. Implement `POST /api/public/lead-submissions`.
2. Validate payload and required fields.
3. Persist non-test submissions to DB.
4. Send notification email.
5. Add CORS and rate-limit protections.

**Acceptance**
- Valid leads persist and trigger notification.
- Abuse controls are active.

---

## Epic 6 — Media Library APIs (MVP)

### Story 6.1 — Implement media upload and metadata endpoints
**Estimate:** 13 points  
**Dependencies:** Story 2.2

**Subtasks**
1. Implement media list endpoint.
2. Implement multipart upload endpoint.
3. Implement metadata update endpoint.
4. Implement binary replace endpoint.
5. Implement delete endpoint with usage conflict behavior.
6. Enforce file size and MIME checks.

**Acceptance**
- Uploaded media returns absolute CDN URL and can be managed by admin.

---

## Epic 7 — Scheduled Jobs and Operational Readiness

### Story 7.1 — Implement scheduled publish/unpublish jobs
**Estimate:** 8 points  
**Dependencies:** Story 3.3

**Subtasks**
1. Implement scheduled publish worker.
2. Implement scheduled unpublish worker.
3. Add idempotency/locking strategy.
4. Add job logs and failure alerts.

**Acceptance**
- Scheduled pages transition automatically and safely.

---

### Story 7.2 — Rollout, regression, and release controls
**Estimate:** 5 points  
**Dependencies:** Stories 2.2, 3.3, 4.2, 5.1, 6.1, 7.1

**Subtasks**
1. Execute MVP checklist on staging.
2. Run regression smoke for existing `/api/v1/*`.
3. Gate frontend with env flags and rollout plan.
4. Prepare production rollout + rollback notes.

**Acceptance**
- MVP checklist passes.
- No regressions in current modules.

---

## Suggested Priority Order

1. Epic 1
2. Epic 2
3. Epic 3
4. Epic 4
5. Epic 5
6. Epic 6
7. Epic 7

---

## Suggested Labels

- `module:page-builder`
- `layer:backend`
- `type:api`
- `type:migration`
- `type:security`
- `type:integration`
- `phase:mvp`
- `phase:parity`

---

## Suggested Milestones

1. **M1 Foundations Complete** (Epic 1)
2. **M2 Auth + Landing Core Ready** (Epic 2 + Epic 3)
3. **M3 Public + Leads + Media Ready** (Epic 4 + Epic 5 + Epic 6)
4. **M4 MVP Release Ready** (Epic 7)

