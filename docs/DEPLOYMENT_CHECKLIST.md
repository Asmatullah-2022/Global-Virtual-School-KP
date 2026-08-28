# Production Deployment Checklist

## Before first deploy
- [ ] `JWT_SECRET` set to a real random value (never the placeholder)
- [ ] `NODE_ENV=production`
- [ ] Facebook: `PAGE_ACCESS_TOKEN`, `META_GRAPH_VERSION` set (see `docs/FACEBOOK_SETUP.md`); if launching without them, confirm the "not yet activated" UI copy is acceptable for launch
- [ ] Webhooks: `WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET` set and the Meta Webhooks subscription configured against your real domain
- [ ] AI Teacher: `AI_PROVIDER`/`AI_API_KEY` set, or launch with the honest "not configured" state
- [ ] At least one `admin` user provisioned (see `docs/API.md`)
- [ ] `server/data/*.json` reviewed — no leftover test accounts or demo content
- [ ] HTTPS terminated in front of the Node process (reverse proxy / platform load balancer) — the app itself does not terminate TLS
- [ ] `server/index.js` CORS origin list matches your real domain(s)

## Data store
- [ ] **On Vercel (or any serverless-function host), the JSON-file store
      does NOT reliably persist data across requests** — different
      invocations can land in different containers with separate, private
      `/tmp` directories, causing symptoms like "registration succeeds,
      then login says invalid credentials." Provision an Upstash Redis
      database (Vercel dashboard → your project → Storage tab → Marketplace
      → Upstash, free tier available) — it auto-injects
      `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`, which
      `server/lib/dataStore.js` picks up automatically with no code
      changes. Redeploy after connecting it. See `docs/DATABASE_SCHEMA.md`.
- [ ] On a single-process host (local dev, Bonto, Render), the JSON store
      works as-is — ensure the deployment disk is persistent (not wiped on
      restart) and back it up regularly.
- [ ] For any real concurrent user load beyond a pilot, migrate off both of
      the above to Firestore or Supabase/Postgres — see
      `docs/DATABASE_SCHEMA.md` for the target shape.

## Security
- [ ] Rotate `PAGE_ACCESS_TOKEN`/`META_APP_SECRET`/`AI_API_KEY` on a schedule
- [ ] Rate limits (`server/index.js`) tuned to real expected traffic
- [ ] Audit log output (`logger.audit(...)`) shipped to persistent, access-controlled storage rather than stdout only
- [ ] Confirm no secrets exist anywhere under `public/` (grep before every deploy: `grep -r "TOKEN\|SECRET\|API_KEY" public/` should return nothing)

## Content
- [ ] Real grade/subject/lesson content populated via the admin API (no
      placeholder lesson content shipped by default — see `docs/DATABASE_SCHEMA.md`)
- [ ] Live class `joinUrl`s are real, admin-provided meeting links — never invented
- [ ] Announcement `expiresAt` dates set correctly so nothing goes stale silently

## Post-deploy smoke test
Repeat the checks in `docs/TESTING_CHECKLIST.md` against the production URL.
