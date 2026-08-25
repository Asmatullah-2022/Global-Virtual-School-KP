# Data Model

Current storage: JSON files under `server/data/`, accessed through
`server/lib/dataStore.js` (`list/get/findOne/create/update/remove`). This
keeps the app fully runnable with zero external services, but is **not**
meant for production concurrency or scale — migrate to Firestore or
Supabase/Postgres before real launch (the collection/document shape below
maps directly onto either).

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
