# BusyBeans SSH deploy pipeline

This file is the full record of the backend CI/CD work. The same summary is linked from [`readme.md`](readme.md).

Repo: [sigitechofficial/busy-beans-backend](https://github.com/sigitechofficial/busy-beans-backend).  
This pipeline deploys **this backend only**. It does not touch the admin panel repo.

## What we built

One GitHub Actions workflow deploys over **SSH + rsync**. The **git branch** chooses the server:

| Branch   | Goes live? | Site | PM2 process | Entry | Apache/port |
|----------|------------|------|-------------|-------|-------------|
| `testing` | Always on push (or manual run) | https://testingbb.trimworldwide.com/ | `testbb` | `testbb.js` | 8012 |
| `main`    | Only when [`.github/production-go-live`](.github/production-go-live) is exactly `true` | https://backendbb.trimworldwide.com/ | `bb` | `bb.js` | `PORT` or 8011 |

There are **not** two workflow files for staging vs production. Branch mapping lives in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

`production-go-live` is currently `false`. Pushes to `main` run the job, print a skip message, and **do not** rsync, migrate, or restart `bb`.

## Files in this repo

| Path | Role |
|-------|------|
| [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) | The live SSH pipeline. Must also exist on **`main`** so GitHub lists **Run workflow**. |
| [`.github/production-go-live`](.github/production-go-live) | One line: `true` or `false`. Production gate. Not a GitHub Environment approval. |
| [`.github/workflows/bb.yml`](.github/workflows/bb.yml) | Older **FTP** production job (`workflow_dispatch` on `main` only). SSH is the current path. Do not use FTP unless someone explicitly chooses to. |

## What a deploy does (in order)

1. **Checkout** this repo on `ubuntu-latest`.
2. **Resolve target** from `testing` vs `main` (+ go-live flag on `main`).
3. **SSH** using GitHub secret `VPS_SSH_KEY` to user `trimworldwide` on port `22`. Host comes from secret `VPS_HOST`.
4. **Fail fast** if required live files are missing (`.env`, `config/config.json`, `firebase.json`, `.htaccess`, entry JS, `package.json` / lockfile).
5. **Snapshot** live app code to a `.tar.gz` on the VPS (secrets and uploads excluded). Keeps the newest **5** backups; older ones are deleted.
6. **`rsync -az --delete`** of the git tree onto the live path. Server-only files are **excluded** (they stay on disk).
7. **`npm ci`** on the server with `PUPPETEER_SKIP_DOWNLOAD=true` (Chrome download was breaking CI).
8. **Pending MySQL migrations only** (already-run files are skipped):
   - `NODE_ENV=production npm run migrate`
   - `NODE_ENV=production npm run marketing:migrate`
9. **`pm2 restart <name> --update-env --interpreter /bin/node`**. The process must already exist. The job does **not** `pm2 start`, `pm2 kill`, or reload other apps (`trim`, `thetrim`, etc.).
10. **Smoke check**: HTTP HEAD on the public URL, then a timed **POST `/api/v1/admin/login`** (8s max). A hang fails the job (this is how a bad Redis `.env` took down admin login). A `400` from fake credentials is OK.

**Redis on the VPS:** `testbb.js` / `bb.js` always use `localhost:6379`. Do not point server `.env` at laptop Redis (`REDIS_PORT=6397`). Optional server keys: `REDIS_HOST=localhost` and `REDIS_PORT=6379` with no quotes or semicolons. `local.js` only may use a custom Redis port.

Concurrency groups: `busybeans-testing` and `busybeans-production`. In-progress runs are **not** cancelled.

## Server-only files (never overwritten by rsync)

These stay on the VPS. They are not taken from GitHub:

- `.env` / `.env.*`
- `config/` (including `config/config.json`)
- `firebase.json`
- `.htaccess`
- `.well-known/`
- `public/` (uploads)
- `node_modules/`
- `.git` / `.github`
- `*.log`, `*.zip`, `*.pem`, `*.key`

Do not commit local `.env` or `config/` into this repo for deploy. The pipeline will not copy them onto the server anyway.

## GitHub secrets (backend repo)

Required for SSH deploy:

- `VPS_HOST` — VPS address
- `VPS_SSH_KEY` — private key whose public half is in `~/.ssh/authorized_keys` for `trimworldwide`

User and port are hardcoded in the workflow (`trimworldwide` / `22`) because empty `VPS_USER` / `VPS_PORT` secrets previously broke SSH.

## How to ship

### Staging

1. Merge or push to **`testing`**.
2. Watch **Deploy BusyBeans (SSH)** on GitHub Actions.
3. Confirm `testbb` is online and https://testingbb.trimworldwide.com/ is not `5xx`.

### Production

1. Put the commit you want on **`main`**.
2. Set [`.github/production-go-live`](.github/production-go-live) to `true` (one line, no quotes).
3. Push `main`. The job deploys to `backendbb` / `bb`.
4. Set the flag back to **`false`** and push `main` again so the next merge cannot go live by accident.

If the flag is `false`, the `main` job exits in a few seconds and production is untouched.

## Backups on the VPS

| Target | Backup folder |
|--------|-------------|
| Staging | `/home/trimworldwide/deployments/busybeans-testing/backups/` |
| Production | `/home/trimworldwide/deployments/busybeans-production/backups/` |

Each run writes `pre-deploy-YYYYMMDD-HHMMSSZ.tar.gz` of the live tree **without** `node_modules`, `.env`, `config/`, `firebase.json`, `.htaccess`, `.well-known`, `public`, logs, or zips. There is **no** GitHub rollback/restore workflow yet. Restore is still a manual extract of a backup tarball.

## What this pipeline does not do (yet)

- No `/health` or `/version` (or `/api/deploy`) endpoints. Planned separately; see `.cursor/plans/health-and-deploy-endpoints.md` in the workspace.
- No GitHub Actions job that restores a backup or rolls back code.
- No GitHub Environment protection / required reviewers. Go-live is the flag file.
- Does not deploy `busy-beans-admin-panel`.

## Server notes that matter

- Use **`/bin/node`** (v18.20.8) and **`/bin/pm2`**. An nvm-only `pm2` on PATH was missing `ProcessContainerFork.js` and crash-looped `testbb`.
- **Never** `pm2 kill`. That would stop **all** PM2 apps on the box, including production `bb`.
- Do not reload unrelated PM2 names (`trim`, `thetrim`, …).
- GitHub Actions needs available minutes on the account that owns the repo. A billing/spending limit will queue or skip runners with no useful job log.

## Proven runs (this work)

- Staging SSH: green (including after the unified branch-mapping workflow).
- Production SSH with go-live `true`: job succeeded, then the flag was set back to `false` on `main` (`28e633f`).
