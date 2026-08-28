# Data Model

Current storage: `server/lib/dataStore.js` (`list/get/findOne/create/update/remove`,
all async — every call must be `await`ed), backed by one of two implementations:

- **Default**: JSON files under `server/data/` (seed) copied into a runtime
  directory (`RUNTIME_DATA_DIR`, or the OS temp dir) on first use. Zero
  external services required. **Only safe on a host that runs one
  long-running process** (local dev, Bonto, Render) — see the Vercel
  caveat below.
- **Optional**: Upstash Redis, activated automatically when a REST URL+token
  pair is set — either `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`
  (Upstash's own naming) or `KV_REST_API_URL`/`KV_REST_API_TOKEN` (the
  naming Vercel's own "Storage" integration flow uses for the same
  Upstash-backed database — both are recognized, see `.env.example`).
  Each collection is stored as one Redis key (e.g. `gvs:users`) holding
  the full array, via `@upstash/redis`'s REST client.

Neither is meant for production concurrency or scale in the long run —
migrate to Firestore or Supabase/Postgres before real launch (the
collection/document shape below maps directly onto either).

## Why the JSON-file store breaks on Vercel

Vercel (and other serverless-function hosts) do not guarantee that
consecutive requests are served by the same container instance, and each
container's `/tmp` is private to it. A registration request handled by
container A writes `users.json` into A's `/tmp`; a login request moments
later can land in a fresh container B, whose `/tmp` never saw that write —
so login reports "Invalid email or password" for an account that was, in
fact, successfully created. This is invisible in local dev and on
single-process hosts, where every request hits the same process.
Provisioning Upstash Redis (a free tier is available via the Vercel
Marketplace, under your project's Storage tab) fixes this: every
container talks to the same shared Redis database over HTTP instead of a
private local file. Depending on how the database gets connected to the
project, Vercel auto-injects either `UPSTASH_REDIS_REST_*` or
`KV_REST_API_*` variables (see above) — check `/api/health`'s
`dataStore.backend` field after connecting to confirm it switched from
`"file"` to `"redis"`.

## Collections

### `users`
```
id, name, email, passwordHash, role (student|teacher|parent|school|admin),
grade (student only), school, childrenIds[] (parent), classIds[] (teacher),
createdAt, updatedAt
```

### `progress`
```
id, userId, overall (0-100), subjects: { [subjectId]: percent },
completedLessons: [lessonId], quizScores: [{lessonId, score, date}],
streakDays, createdAt, updatedAt
```
Not yet populated by any write endpoint in this build — lesson/quiz
completion needs to be wired once the video/quiz player is implemented.

### `grades`
```
id, grade (6-12), subjects: [{ id, name }]
```
Chapters/lessons are the next nesting level and are intentionally left for
the admin panel to populate — no fabricated lesson content ships by default.

### `updates`
```
id, title, body, imageUrl, date, expiresAt, category (announcement|course|event|notice),
link, status (draft|published), author, createdAt, updatedAt
```
`status` is computed as `expired` automatically once `expiresAt` passes
(see `server/routes/content.routes.js:effectiveStatus`).

### `liveClasses`
```
id, subject, grade, teacher, date (YYYY-MM-DD), time (HH:MM), durationMinutes,
joinUrl (admin-provided only — never invented), createdAt, updatedAt
```
`computedStatus` (`live|upcoming|completed`) is derived at request time from
`date`+`time`+`durationMinutes`, not stored.

### `languageCourses`
```
id, name, flag, overview, lessons: [], status (published|unpublished), createdAt, updatedAt
```

### `knowledgeBase`
```
id, grade, subject, topic, content, createdAt, updatedAt
```
Used for AI Teacher retrieval (see `docs/AI_TEACHER_SETUP.md`).

## Migrating to Firestore/Supabase

Replace the internals of `server/lib/dataStore.js` with calls to your chosen
backend while keeping its external function signatures the same — no route
file needs to change. Firestore: each collection maps 1:1; `list()` becomes
a query with optional `.where()`, `create`/`update`/`remove` map to
`add`/`update`/`delete`. Supabase: each collection maps to a table with a
`jsonb` or typed columns per field above; wrap `@supabase/supabase-js`
calls behind the same function names.

Also required at that point: Firestore/Postgres security rules mirroring the
role checks currently done in `server/middleware/auth.js` (students can only
read their own `progress` doc, parents only their linked children's, etc.).
