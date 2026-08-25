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
- [ ] For any real concurrent user load, migrate off the bundled JSON file
      store (`server/lib/dataStore.js`) to Firestore or Supabase/Postgres —
      see `docs/DATABASE_SCHEMA.md` for the target shape. The JSON store is
      fine for a pilot/demo, not for production traffic.
- [ ] If staying on the JSON store short-term, ensure the deployment disk is
      persistent (not ephemeral containers wiping `server/data/` on restart)
      and back it up regularly.

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
