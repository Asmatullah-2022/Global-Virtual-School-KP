# Deploying to Render (recommended for the testing stage)

**Why Render**: the app is a single Node/Express server that serves both
the API and the PWA frontend (`public/`) from one process — no separate
frontend/backend deploy is needed. Render's free Web Service tier deploys
directly from a GitHub branch with zero credit card requirement, gives you
a public HTTPS URL, and lets you set environment variables in a dashboard
(never in git). This repo already includes `render.yaml`, so Render can
configure itself from that file.

This guide was **not run against a live Render account** — this
environment has no hosting credentials. Everything below was verified
locally instead (production-mode boot, security headers, CORS, the demo
Facebook fallback — see the PR/commit notes) and translated into exact
steps for you to execute in the Render dashboard.

## Step-by-step

1. Go to https://render.com and sign up / log in (GitHub login is easiest — no card required for the free tier).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub account if prompted, then select the repository
   `Asmatullah-2022/Global-Virtual-School-KP`.
4. Render detects `render.yaml` in the repo root and shows the
   `gvs-mobile-app` service it defines, targeting the **`main-base`**
   branch (the merged, production-ready branch).
5. Review the environment variables Render shows:
   - `NODE_ENV=production` and `JWT_EXPIRES_IN=7d` — pre-filled, leave as is.
   - `JWT_SECRET` — Render auto-generates a secure random value (`generateValue: true` in the blueprint). You don't need to enter anything.
   - `PAGE_ID=61592435229097` — pre-filled, public/non-secret.
   - `META_GRAPH_VERSION`, `PAGE_ACCESS_TOKEN`, `META_APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`, `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` — shown blank ("set later"). **Leave these blank for now**, per your instructions. The app runs correctly with them unset (see "What you'll see" below).
6. Click **Apply**. Render runs `npm install` (build) then `npm start`, and assigns a public URL of the form `https://gvs-mobile-app-XXXX.onrender.com`.
7. Wait for the build/deploy log to show `GVS app running on http://localhost:<port>` — typically 1-3 minutes on the free tier.
8. Open the assigned URL. That's your public live URL.
9. Provision an admin account so you can reach the Admin Dashboard: in the Render dashboard, open the service's **Shell** tab and run:
   ```bash
   npm run create-admin -- --name "Your Name" --email you@example.com --password "a-strong-password"
   ```

## What you'll see with credentials left blank (by design, per your instructions)

- **Home / Updates**: two posts clearly labeled **Demo Content**, plus a
  "View GVS Facebook Page" link — never presented as real GVS
  announcements.
- **AI Teacher**: full UI works; asking a question returns "AI Teacher is
  not yet connected to an AI provider" instead of a fabricated answer.
- **Webhooks** (`/webhooks/facebook`): responds `503` with a message
  naming the missing env vars — not a silent fake success.
- Everything else (Learn, Live Classes, Language Academy, Login/Register,
  Profile, role dashboards, Admin Dashboard) works fully — none of it
  depends on Meta or AI credentials.

## Important limitation: the free tier's disk is not persistent

This app's current data layer (`server/lib/dataStore.js`) is JSON files on
disk (see `docs/DATABASE_SCHEMA.md`) — an interim store, by design, for
this stage. **Render's free Web Service tier has an ephemeral filesystem**:
anything written after deploy (registered users, admin-created updates/live
classes, the admin account you just created) is lost on every restart,
redeploy, or free-tier spin-down after inactivity. This is fine for
testing the UI and flows, but:
- Don't rely on data surviving between test sessions — recreate the admin
  account and any test content after a restart if it's gone.
- Before real use with real users, either upgrade to a paid Render plan
  with a persistent disk mounted at `server/data/`, or migrate to
  Firestore/Supabase per `docs/DATABASE_SCHEMA.md`.

## Connecting the real GVS Facebook Page later

Once you have the Page Access Token, App Secret, current Graph API
version, and have chosen a webhook verify token (see
`docs/FACEBOOK_SETUP.md` for exactly how to obtain each one):
1. Render dashboard → your service → **Environment** tab.
2. Fill in `META_GRAPH_VERSION`, `PAGE_ACCESS_TOKEN`, `META_APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`.
3. Save — Render automatically redeploys with the new values.
4. In the Meta Webhooks console, set the callback URL to
   `https://<your-render-url>/webhooks/facebook` and the verify token to
   match what you entered above.
5. No code or frontend change is needed — `server/services/facebookService.js`
   switches from demo content to the live Graph API automatically once
   `PAGE_ACCESS_TOKEN`/`META_GRAPH_VERSION` are both set.

## Alternatives considered

- **Railway** / **Fly.io**: also simple Node deploys; `Procfile` (`web: npm start`) is included in this repo for broader platform compatibility if you'd rather use one of these instead of Render.
- **Vercel/Netlify serverless**: not recommended as-is — this app is a stateful long-running Express server (JWT sessions, JSON file writes, Facebook cache), which doesn't fit a serverless function model without further rework.
