# API hardening (Phase 11)

## CORS

`middlewares/corsOriginAudit.js`, wired in `app.js`.

| Env | Effect |
|---|---|
| `CORS_ALLOWED_ORIGINS` | Comma-separated browser origins; `https://*.example.com` matches one subdomain level |
| `CORS_ENFORCE=true` | Only listed origins get CORS headers. Without it the API still reflects any origin (old behavior) and **logs** unlisted origins once (`[cors-audit]`) |

Requests without an `Origin` header (server-to-server, mobile apps, webhooks, curl) are never affected.

Rollout per environment:
1. Set `CORS_ALLOWED_ORIGINS` (website, admin panel, Campaign Builder, their staging hosts; local: `http://localhost:3000,http://localhost:3001,http://localhost:3002`).
2. Watch the logs for `[cors-audit] origin NOT in CORS_ALLOWED_ORIGINS` for a few days; add legitimate origins.
3. Set `CORS_ENFORCE=true`. Rollback = unset it.

Why it matters: login responses set an httpOnly `jwt` cookie and `protect` accepts it, and some
admin-panel calls use `credentials: "include"`. With any origin reflected **with credentials**, a
third-party site could make credentialed requests and read the responses in browsers that send
that cookie cross-site.

## Security headers

`helmet` (was commented out): HSTS, `nosniff`, `X-Frame-Options: SAMEORIGIN`, no `X-Powered-By`,
etc. No CSP on the API (JSON + EJS pay pages + Swagger UI with inline scripts); CORP is
`cross-origin` so the website can embed uploaded media.

## Error responses

`controllers/errorController.js`:
- Any `NODE_ENV` gets the safe handler — previously anything other than exactly `development` /
  `production` (e.g. unset, `staging`) sent **no response**, and `development` returned the full
  error object + stack to API clients.
- Details (stack, raw error) only with `API_ERROR_DETAILS=true` — developer machines only.
- Malformed JSON → 400, too-large body → 413, foreign-key errors → 400 without SQL text.
- Non-API URLs return plain text (the handler used to render an `error` view that does not exist).

## Public marketing endpoints

- Tracking (`/api/public/tracking/*`): known bots, link previewers, headless browsers, monitoring
  and HTTP libraries (and empty user agents) get `204` and nothing is stored
  (`marketing/utils/requestMeta.js`). Rate limit unchanged (`MARKETING_TRACKING_RATE_LIMIT_MAX`,
  default 300/min/IP).
- Lead submissions: `user_agent` is stored; `ip_address` per `MARKETING_LEAD_IP_MODE`
  — `anonymized` (default, IPv4 /24 · IPv6 /48), `full`, or `off`. Pick per your privacy policy.
- Lead notification email: submitted values and the page URL are HTML-escaped (they were inserted
  raw, so anyone could put links/images into the staff email).
- Revenue event types are refused on the public ingest endpoint (Phase 8).
- Campaign Builder API tokens must carry `scope: "marketing"` (Phase 10).

Test: `npm run marketing:hardening-test` (API must be running for the HTTP part).

## Next: move the commerce login token to an httpOnly cookie (separate project)

Today the website and admin panel keep the JWT in `localStorage` (`accessToken`) and send it as
`Authorization: Bearer`; any script that runs on those origins can read it. Plan:

1. **Same site first.** The API lives on `*.trimworldwide.com` / `backend.busybeancoffee.com`,
   the website on `www.busybeancoffee.com`. A first-party cookie needs the API on the same site
   (e.g. `api.busybeancoffee.com`) — otherwise it must be `SameSite=None; Secure` and browsers that
   block third-party cookies will drop it.
2. **Cookie**: `HttpOnly; Secure; SameSite=Lax; Path=/; Domain=.busybeancoffee.com`, same 7-day
   expiry as the JWT (the current cookie expires after 1 day and has no `SameSite`).
3. **CSRF**: with cookie auth, state-changing requests need protection — `SameSite=Lax` plus an
   `Origin` check against `CORS_ALLOWED_ORIGINS` (enforced CORS) and/or a double-submit token.
4. **Clients**: `withCredentials: true` everywhere, stop writing `accessToken` to storage, read
   the user from `/me` instead of the token; logout clears the cookie + Redis entry.
5. **Transition**: `protect` already accepts either; ship cookie-setting first, then clients,
   then drop the Bearer path for browsers.
6. QA: login/logout on website + admin panel, checkout (Stripe redirects), FCM, sub-admin ACL,
   Safari ITP, mobile app (keeps Bearer).
