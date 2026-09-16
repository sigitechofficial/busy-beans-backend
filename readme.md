# BusyBeans backend

Node.js / Express API for BusyBeans (orders, admin, partners, QuickBooks, Stripe, marketing page builder).

This is the **backend** repo only: [sigitechofficial/busy-beans-backend](https://github.com/sigitechofficial/busy-beans-backend).  
The admin UI lives in a **separate** repo (`busy-beans-admin-panel`). Do not mix those trees.

**Deploy / CI/CD:** full pipeline notes are in **[README.DEPLOY.md](README.DEPLOY.md)**.

## What the code consists of

| Area | What it is |
|------|------------|
| `app.js` | Express app: CORS, JSON, webhooks, routers, global errors. |
| `bb.js` | Production process. Listens on `PORT` or **8011**. PM2 name **`bb`**. |
| `testbb.js` | Staging process. Listens on **8012**. PM2 name **`testbb`**. |
| `local.js` | Local entry (`npm run local`). |
| `routes/` + `controllers/` | HTTP API: users, admin, leads, subscriptions, webhooks. |
| `models/` | Sequelize models (MySQL). |
| `migrations/` | App SQL migrations. Pending files only on each deploy. See `migrations/README.md`. |
| `marketing/` | Page-builder / marketing module (`/api/...`) plus its own migrations (`npm run marketing:migrate`). |
| `services/` | QuickBooks, Stripe/payments, orders, email dispatch, etc. |
| `middlewares/` | Auth, sub-admin ACL, and related gates. |
| `utils/` + `helper/` | Shared helpers (errors, Redis, invoices, email, …). |
| `config/` | **Server-only** on live. Not overwritten by deploy. Do not treat GitHub as the source of live secrets. |
| `.github/workflows/deploy.yml` | SSH deploy. Branch picks staging vs production. |
| `.github/production-go-live` | `true` / `false`. Production will not rsync unless this is `true`. |

### HTTP surface (`app.js`)

- `/api/v1/users`
- `/api/v1/admin`
- `/api/v1/leads`
- `/api/v1/subscription`
- `/qbo`
- `/api` — marketing / page builder
- `/webhook` and `/webhook/busy-beans-coffee`
- `/view` — EJS views
- `/public` — static files (live `public/` is **not** replaced by rsync)

There is **no** dedicated `/health` or `/version` yet (planned separately).

## Stack

- Node.js 18+ on the VPS (`/bin/node` v18.20.8)
- Express, Sequelize, **MySQL**, Redis
- Stripe, QuickBooks Online, Firebase admin, Puppeteer (Chrome download skipped in CI)

## Local

```bash
npm ci
npm run local
```

Other scripts: `npm start` (`bb.js`), `npm run test` (`testbb.js`), `npm run migrate`, `npm run marketing:migrate`.

Copy `.env` and `config/` from a trusted source. Never commit them.

## Deployment (SSH pipeline)

Documented in full in **[README.DEPLOY.md](README.DEPLOY.md)**. Short version:

1. **One workflow:** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Push (or **Run workflow**) on `testing` or `main`.
2. **`testing` → always** deploys to `testingbb.trimworldwide.com`, PM2 `testbb`, `testbb.js`.
3. **`main` → production** (`backendbb.trimworldwide.com`, PM2 `bb`) **only** if [`.github/production-go-live`](.github/production-go-live) is exactly `true`. Otherwise the job skips in seconds.
4. Deploy is **SSH + rsync `--delete`**, then `npm ci`, **pending** MySQL migrations, `pm2 restart` with `/bin/node`.
5. Live **`.env`**, `config/`, `firebase.json`, `.htaccess`, `.well-known`, and `public/` are **left on the server**.
6. Each deploy writes a code tarball under `/home/trimworldwide/deployments/busybeans-testing|production/backups/` (last 5 kept). Rollback workflow is not built yet.
7. After a production go-live, set the flag back to **`false`**.

GitHub secrets: `VPS_HOST`, `VPS_SSH_KEY`. SSH user/port in the workflow: `trimworldwide` / `22`.

The old FTP job in [`.github/workflows/bb.yml`](.github/workflows/bb.yml) is not the current path.

## Safety

- Do not `pm2 kill` on the VPS (stops every PM2 app, including production `bb`).
- Do not reload unrelated processes (`trim`, `thetrim`, …).
- Do not set `production-go-live` to `true` unless this commit is meant to go live.
