# Global Virtual School (GVS) — Mobile App

**Global Virtual School App** — Government of Khyber Pakhtunkhwa · Gulbahar, Peshawar, Pakistan
*Connecting Classrooms, Creating Futures*

> Not yet formally designated an "Official Government App" — see the
> Branding note below. Use "Global Virtual School App" until that
> authorization is confirmed by the client.

- Website: https://gvskp.org/
- Admissions: https://gvskp.org/admission
- LMS: https://lms.gvskp.org/login
- Facebook: https://www.facebook.com/profile.php?id=61592435229097

## What this is

A mobile-first, installable PWA (Express backend + vanilla-JS frontend)
upgraded from the original starter. It keeps the starter's architecture —
a lightweight Node/Express server serving a PWA and a server-side Meta
Graph API integration — because it already worked and is a sound base for
Android packaging via Capacitor (see `docs/ANDROID_BUILD.md`), rather than
being rewritten from scratch in Flutter.

## Architecture

```
server/            Express API (auth, content, Facebook, AI Teacher, admin)
  routes/           One router per feature area
  services/         Facebook Graph API client, AI provider client, KB search
  middleware/        JWT auth + role guards, error handling
  lib/dataStore.js   JSON-file data layer (interim — see docs/DATABASE_SCHEMA.md)
  data/              Seed data collections (grades, updates, live classes, ...)
public/             PWA frontend (app shell, views, service worker)
docs/               Setup guides, API reference, checklists
```

## What's real vs. what needs configuration

| Feature | Status |
|---|---|
| PWA shell, navigation, splash, offline banner, service worker | ✅ Working |
| JWT auth, roles (student/teacher/parent/school/admin) | ✅ Working |
| Grades/subjects structure, updates, live classes, language academy, search | ✅ Working (admin-managed content; no fabricated lessons/announcements ship by default) |
| Facebook feed (`/api/facebook/feed`) | ✅ Working. Shows clearly labeled **Demo Content** (see below) until `PAGE_ACCESS_TOKEN`/`META_GRAPH_VERSION` are set, then automatically switches to the real Graph API feed — no code change or extra step needed beyond setting the env vars and restarting |
| Facebook Webhooks | ✅ Verified GET handshake + signature-checked POST, but returns 503 until `WEBHOOK_VERIFY_TOKEN`/`META_APP_SECRET` are set |
| AI Teacher | ✅ Full UI (language/grade pickers, quick prompts, disclaimer) working end-to-end, but returns an honest "not connected" message until `AI_PROVIDER`/`AI_API_KEY` are set |
| Role dashboards | ✅ Working, backed by real (currently empty) `progress` data |
| Admin dashboard | ✅ Working web UI at Profile → Admin Dashboard (admin role only): system status, analytics, users, and CRUD for updates/live classes/language courses |
| Video player, quizzes, offline lesson downloads | ⛔ Not built — the Learn screen honestly states content is pending admin publication |
| Virtual Labs | ⛔ Not built |
| Native Android app | ⛔ Not built — packaging path documented in `docs/ANDROID_BUILD.md` |

Nothing above fakes success: every unconfigured integration shows a plain,
honest status message instead of pretending to work (see `docs/FACEBOOK_SETUP.md`,
`docs/AI_TEACHER_SETUP.md`).

### Demo Facebook feed

While `PAGE_ACCESS_TOKEN`/`META_GRAPH_VERSION` are unset, `/api/facebook/feed`
returns two clearly labeled **Demo Content** posts (dashed gold border in the
UI, `isDemo:true` in the API, `[Demo Content]` prefix in the text) instead of
an empty feed, so the Home and Updates screens can be built, styled, and
tested end-to-end before real Meta credentials exist. The moment both env
vars are set (see `docs/FACEBOOK_SETUP.md`) and the server restarts,
`server/services/facebookService.js` skips the demo branch entirely and
calls the real Graph API — this was verified in this build by toggling
`config.isFacebookConfigured()`'s inputs and re-testing the endpoint.

## Install & run

```bash
npm install
cp .env.example .env
# Generate a real JWT secret:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# paste it into .env as JWT_SECRET
npm start
# Provision the first admin account (admins can't self-register):
npm run create-admin -- --name "Your Name" --email admin@example.com --password "a-strong-password"
```
Open http://localhost:3000. It can be installed as a PWA from a supporting browser.
Log in with the admin account above and go to Profile → Admin Dashboard to manage content.

## Environment variables

See `.env.example` for the full list and inline explanations. Highlights:
- `JWT_SECRET` — required for auth to work at all.
- `PAGE_ID`, `META_GRAPH_VERSION`, `PAGE_ACCESS_TOKEN`, `META_APP_SECRET`, `WEBHOOK_VERIFY_TOKEN` — Facebook/Meta (see `docs/FACEBOOK_SETUP.md`).
- `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` — AI Teacher (see `docs/AI_TEACHER_SETUP.md`).

**Never commit `.env`. Never put any of these values in `public/`** — the
frontend only ever calls our own `/api/*` routes.

## Documentation index

- `docs/API.md` — full endpoint reference
- `docs/FACEBOOK_SETUP.md` — Meta Graph API + Webhooks setup, exactly what the GVS Page admin must configure
- `docs/AI_TEACHER_SETUP.md` — AI provider setup and privacy notes
- `docs/DATABASE_SCHEMA.md` — current data model and the Firestore/Supabase migration path
- `docs/ANDROID_BUILD.md` — Capacitor packaging steps, package ID note
- `docs/PLAY_STORE.md` — Play Store listing checklist (nothing submitted automatically)
- `docs/TESTING_CHECKLIST.md` — what's been tested here vs. what needs a real browser/device
- `docs/DEPLOYMENT_CHECKLIST.md` — production readiness checklist

## Security notes

- Helmet + CSP, CORS locked to known origins in production, per-route rate
  limiting (tighter on `/api/auth/login` and `/register`).
- Passwords hashed with bcrypt (12 rounds); JWTs signed server-side.
- Role-based authorization enforced on every dashboard/admin route
  (`server/middleware/auth.js`).
- Facebook webhook payloads are rejected unless their `X-Hub-Signature-256`
  matches `META_APP_SECRET` via a timing-safe comparison.
- No secrets are ever read by, or embedded in, `public/`.

## Testing & build checks

```bash
npm run check     # syntax-checks every server + frontend JS file (24 files)
```
There is no unit-test framework wired in yet (see "Known limitations"). This
build was additionally verified with: full backend smoke tests via curl
(auth, content, admin CRUD, Facebook demo/config, webhook signature
rejection), and a scripted Playwright pass over all 18 screens (desktop +
mobile viewports, logged-out/student/admin sessions, offline state) with
zero browser console errors. See `docs/TESTING_CHECKLIST.md` for the full
breakdown of what's covered vs. what still needs a human on a real device.

## Exactly what remains to configure

### Meta / Facebook
Nothing in the code is missing — only credentials, which only the GVS Page
admin can issue (see `docs/FACEBOOK_SETUP.md` for the full walkthrough):
1. `PAGE_ACCESS_TOKEN` — Page Access Token for Page ID `61592435229097`, generated in the Meta App dashboard.
2. `META_GRAPH_VERSION` — current Graph API version at deploy time (check https://developers.facebook.com/docs/graph-api/changelog — this session could not reach that domain to confirm a version live, so don't trust a stale value here).
3. `META_APP_SECRET` — from the Meta App's Settings → Basic, needed to verify webhook signatures.
4. `WEBHOOK_VERIFY_TOKEN` — any random string **you choose**; must match what you enter in the Meta Webhooks console.
5. Subscribe the Page to the app's webhook (`/{page-id}/subscribed_apps`) and set the callback URL to `https://<your-domain>/webhooks/facebook`.

Until then: the app shows clearly labeled Demo Content (see above), which
switches to the live feed automatically once these are set — no further
code change needed.

### AI Teacher
1. Pick a provider: `AI_PROVIDER=anthropic` or `AI_PROVIDER=openai`.
2. Set `AI_API_KEY` to a real key from that provider's account.
3. Optionally set `AI_MODEL` (defaults to `claude-sonnet-5` for Anthropic, `gpt-4o-mini` for OpenAI).

Until then: `/api/ai/ask` returns an honest "AI Teacher is not yet connected"
message plus any matching knowledge-base entries — the full UI (language
picker, quick prompts, disclaimer) is already built and requires no further
frontend work once a key is set.

### Production deployment
1. Provision a real admin: `npm run create-admin -- --name "..." --email "..." --password "..."`.
2. Set `JWT_SECRET` to a freshly generated random value (never the placeholder).
3. Set `NODE_ENV=production` so CORS locks to `gvskp.org`/`lms.gvskp.org` (see `server/index.js`).
4. Put a real TLS-terminating reverse proxy in front of the Node process — this app does not terminate HTTPS itself.
5. Migrate off the bundled JSON file data store to Firestore or Supabase/Postgres before real concurrent traffic — see `docs/DATABASE_SCHEMA.md` for the target shape; it's fine for a pilot/demo, not for production load.
6. Full checklist: `docs/DEPLOYMENT_CHECKLIST.md`.

### Android build
1. Confirm the suggested package ID `pk.gov.gvs.mobile` as **permanent** with the client before any release build — Android package IDs cannot change after publishing.
2. Wrap the existing PWA with Capacitor (`npx cap init` / `add android` / `sync`) — no rewrite needed, `public/` is reused as-is. Exact commands: `docs/ANDROID_BUILD.md`.
3. Point the packaged app at the production API domain, not `localhost`.
4. Play Store listing prep (screenshots, privacy policy, data safety form): `docs/PLAY_STORE.md`. Nothing here is submitted automatically.

## Known limitations of this build (read before treating as production-ready)

- The bundled JSON file data store is not built for concurrent production
  load — migrate before real launch (`docs/DATABASE_SCHEMA.md`).
- The admin dashboard covers updates, live classes, language courses,
  system status, analytics and a users list; editing the grade/subject
  taxonomy and the AI knowledge base still requires calling the admin API
  directly (`docs/API.md`) rather than through the UI.
- Lesson video/notes/quiz playback, Virtual Labs, and offline lesson
  downloads are scaffolded in the UI (with honest "coming from GVS LMS"
  empty states) but not implemented.
- The AI Teacher's curriculum grounding is a simple keyword search over an
  admin-managed knowledge base, not real retrieval/embeddings — treat its
  answers as assistive, not authoritative (the app says so in-product).
- The UI chrome itself is English-only; the AI Teacher can respond in Urdu
  or Pashto, but full app localization/RTL layout is not yet built.
- Push notification preferences in Profile → Settings are saved locally
  only; there's no push delivery service wired up yet.
