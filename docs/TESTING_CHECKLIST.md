# Testing Checklist

## Verified via curl smoke tests (backend)
- [x] Server starts cleanly, logs integration status (`facebookConfigured`, `webhookConfigured`, `aiConfigured`, `authConfigured`)
- [x] `GET /api/health` → 200
- [x] `GET /api/facebook/config` and `/api/facebook/feed` with no credentials → `status:"demo"`, two clearly labeled Demo Content posts, no crash
- [x] `GET /webhooks/facebook` verification: correct token echoes `hub.challenge`; wrong token → 403; unconfigured → 503
- [x] `GET /api/content/grades|updates|live-classes|language-courses|search` → all respond correctly against seed data
- [x] `POST /api/auth/register` (student) → 201 + JWT; duplicate email → 409; `role:"admin"` self-register → 400
- [x] `POST /api/auth/login`, `GET /api/auth/me` → correct user returned
- [x] `GET /api/dashboard/student` (authenticated) → 200 with progress scaffold
- [x] `GET /api/admin/users` unauthenticated → 401; authenticated as student → 403
- [x] `POST /api/ai/ask` with no `AI_PROVIDER` configured → `configured:false` + clear message, no fake answer
- [x] `server/scripts/createAdmin.js` provisions a real admin; admin login → full access to `/api/admin/*`
- [x] Admin CRUD verified end-to-end: create an update via `/api/admin/collections/updates` → immediately visible on `GET /api/content/updates`; same for `liveClasses`
- [x] Static app shell served at `/`, SPA fallback works for unknown paths
- [x] `npm run check` — syntax-checks all 24 server + frontend JS files, 0 failures

## Verified via scripted Playwright pass (browser)
Ran a headless Chromium pass over all 18 primary screens/states (desktop
1280×900 and mobile 375×812 viewports), capturing full-page screenshots and
every console error/pageerror event. **Result: 0 console errors across all
18 screens.**
- [x] Splash screen renders and transitions to the app shell
- [x] Home: hero, stats strip, quick-access grid, feed widget (Demo Content correctly badged), upcoming classes widget, LMS callout
- [x] Learn: grade list → grade detail (7 grades, subject counts correct) → subject detail with breadcrumb navigation, honest "content coming from GVS LMS" empty state
- [x] Live Classes: live/upcoming/completed grouping (verified against a seeded live class — appeared correctly under "Upcoming")
- [x] Updates: category tabs, Demo Content clearly bordered/labeled and distinguished from real GVS updates, status line ("Demo Content — real GVS Facebook updates will replace this...")
- [x] AI Teacher: language/grade selectors, quick-prompt chips, honest "please log in" gating for anonymous users
- [x] Language Academy: all 5 courses listed with correct flags; course detail drill-down with honest "lessons coming soon" empty state
- [x] Login and Register forms render correctly, all fields present
- [x] Profile: logged-out state (login/register CTAs) and logged-in state (role pill, dashboard/LMS/website/Facebook tiles, settings toggles)
- [x] Admin Dashboard (real admin login): Overview tab (system status + analytics), Updates tab (list + Add New + the seeded item), tab switching
- [x] Offline banner appears and existing content remains visible when `navigator.onLine` goes false
- [x] Mobile viewport (375px): no horizontal overflow, grids collapse to 1-2 columns, bottom nav stays fixed and readable on every screen checked

Screenshots from this pass are not committed to the repo (they're
environment-specific artifacts), but the pass is reproducible — see
`docs/DEPLOYMENT_CHECKLIST.md` if you want to re-run an equivalent check.

## Still needs a human on a real device
- [ ] Splash screen animation timing/feel on an actual phone (verified structurally in browser, not on-device)
- [ ] Touch interactions (tap targets, scroll momentum) on real hardware
- [ ] AI Teacher's actual answers once `AI_PROVIDER`/`AI_API_KEY` are set (structure and gating verified; provider response content is untestable without a real key)
- [ ] RTL rendering once Urdu/Pashto UI strings are added (current UI chrome is English-only; AI Teacher can *answer* in Urdu/Pashto today — see README "Known limitations")
- [ ] Facebook feed against real credentials: live fetch, pagination (`after` cursor), rate-limit backoff, webhook-triggered cache invalidation
- [ ] Android build via Capacitor (see `docs/ANDROID_BUILD.md`) — requires Android Studio/SDK not available in this environment
- [ ] Role dashboards for teacher/parent/school with real linked data (student dashboard verified; the other three are code-reviewed and follow the same pattern but weren't exercised against seeded teacher/parent/school accounts)

## Regression watch-list for future changes
- Changing `server/lib/dataStore.js` internals must keep list/get/create/update/remove signatures stable — every route depends on them.
- Any new admin-managed collection must be added to `MANAGED_COLLECTIONS` in `server/routes/admin.routes.js` (and to the admin UI's tab list in `public/js/views.js`) or its CRUD endpoints/UI won't appear.
- The API rate limiter (`server/index.js`, 120 req/min per IP) applies per source IP — a test harness running many rapid requests from one machine (e.g. automated browser tests) can trip it; this is expected and not a bug. Restart the server to reset counters when re-testing heavily.
