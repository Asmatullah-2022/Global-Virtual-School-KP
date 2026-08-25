# Testing Checklist

## Verified in this build (automated smoke test via curl, see PR/commit notes)
- [x] Server starts cleanly, logs integration status (`facebookConfigured`, `webhookConfigured`, `aiConfigured`, `authConfigured`)
- [x] `GET /api/health` → 200
- [x] `GET /api/facebook/config` and `/api/facebook/feed` with no credentials → honest "not configured" response, no crash
- [x] `GET /webhooks/facebook` verification with wrong/missing token → rejected (403) or 503 if unconfigured
- [x] `GET /api/content/grades|updates|live-classes|language-courses|search` → all respond correctly against seed data
- [x] `POST /api/auth/register` (student) → 201 + JWT; duplicate email → 409; `role:"admin"` self-register → 400
- [x] `POST /api/auth/login`, `GET /api/auth/me` → correct user returned
- [x] `GET /api/dashboard/student` (authenticated) → 200 with progress scaffold
- [x] `GET /api/admin/users` unauthenticated → 401; authenticated as student → 403
- [x] `POST /api/ai/ask` with no `AI_PROVIDER` configured → `configured:false` + clear message, no fake answer
- [x] Static app shell served at `/`, SPA fallback works for unknown paths

## Needs manual verification in a browser/device (not possible headlessly in this environment)
- [ ] Splash screen timing/animation on a real phone
- [ ] Bottom navigation (Home/Learn/Classes/Updates/Profile) transitions
- [ ] Learn: Grade → Subject drill-down and breadcrumb back navigation
- [ ] Live Classes: live/upcoming/completed grouping once real class data exists
- [ ] AI Teacher UI end-to-end once `AI_PROVIDER`/`AI_API_KEY` are set
- [ ] Language Academy card rendering for all 5 languages
- [ ] Registration and Login forms (validation messages, success redirect)
- [ ] Role dashboards for teacher/parent/school once corresponding users/data exist
- [ ] Global search overlay (`🔍`) and side menu (`☰`)
- [ ] Offline banner: toggle devtools "Offline" and confirm state + cached shell via service worker
- [ ] RTL rendering once Urdu/Pashto UI strings are added (current UI is English-only; AI Teacher can *answer* in Urdu/Pashto today, but the interface chrome itself is not yet localized — see "What remains" in the README)
- [ ] Facebook feed against real credentials: live fetch, pagination (`after` cursor), rate-limit backoff, webhook-triggered cache invalidation
- [ ] Android build via Capacitor (see `docs/ANDROID_BUILD.md`) — requires Android Studio/SDK not available in this environment

## Regression watch-list for future changes
- Changing `server/lib/dataStore.js` internals must keep list/get/create/update/remove signatures stable — every route depends on them.
- Any new admin-managed collection must be added to `MANAGED_COLLECTIONS` in `server/routes/admin.routes.js` or its CRUD endpoints 404.
