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
| Facebook feed (`/api/facebook/feed`) | ✅ Working, but shows *"...will appear here when the GVS Page connection is activated"* until `PAGE_ACCESS_TOKEN`/`META_GRAPH_VERSION` are set |
| Facebook Webhooks | ✅ Verified GET handshake + signature-checked POST, but returns 503 until `WEBHOOK_VERIFY_TOKEN`/`META_APP_SECRET` are set |
| AI Teacher | ✅ Working end-to-end, but returns an honest "not connected" message until `AI_PROVIDER`/`AI_API_KEY` are set |
| Role dashboards | ✅ Working, backed by real (currently empty) `progress` data |
| Admin content management | ✅ API-complete (`/api/admin/collections/:name`); no admin **web UI** yet |
| Video player, quizzes, offline lesson downloads | ⛔ Not built — the Learn screen honestly states content is pending admin publication |
| Virtual Labs | ⛔ Not built |
| Native Android app | ⛔ Not built — packaging path documented in `docs/ANDROID_BUILD.md` |

Nothing above fakes success: every unconfigured integration shows a plain,
honest status message instead of pretending to work (see `docs/FACEBOOK_SETUP.md`,
`docs/AI_TEACHER_SETUP.md`).

## Install & run

```bash
npm install
cp .env.example .env
# Generate a real JWT secret:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# paste it into .env as JWT_SECRET
npm start
```
Open http://localhost:3000. It can be installed as a PWA from a supporting browser.

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

## Known limitations of this build (read before treating as production-ready)

- The bundled JSON file data store is not built for concurrent production
  load — migrate before real launch (`docs/DATABASE_SCHEMA.md`).
- There's no admin web UI yet, only the admin API.
- Lesson video/notes/quiz playback, Virtual Labs, and offline lesson
  downloads are scaffolded in the UI (with honest "coming from GVS LMS"
  empty states) but not implemented.
- The AI Teacher's curriculum grounding is a simple keyword search over an
  admin-managed knowledge base, not real retrieval/embeddings — treat its
  answers as assistive, not authoritative (the app says so in-product).
- The UI chrome itself is English-only; the AI Teacher can respond in Urdu
  or Pashto, but full app localization/RTL layout is not yet built.
