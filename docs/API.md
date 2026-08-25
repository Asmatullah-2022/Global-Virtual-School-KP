# GVS API Reference

Base URL: `http://localhost:3000` (development) or your deployed domain.
All endpoints return JSON. Authenticated endpoints expect `Authorization: Bearer <token>`.

## Auth (`/api/auth`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/register` | none | `{name,email,password,role,grade?,school?}`. Roles: `student`, `teacher`, `parent`, `school`. `admin` cannot self-register. |
| POST | `/login` | none | `{email,password}` → `{token,user}` |
| GET | `/me` | Bearer | Returns the current user |

Provisioning the first admin: since admins can't self-register through the API,
create one directly against the data store (or a one-off script) before launch,
e.g. `node -e "..."` using `bcryptjs` to hash a password and appending to
`server/data/users.json` with `role: "admin"`. Replace this with a proper
seed/CLI script before production.

## Facebook (`/api/facebook`)
| Method | Path | Notes |
|---|---|---|
| GET | `/config` | Public config: page id, official links, `configured` flag |
| GET | `/feed?refresh=1&after=<cursor>` | Graph API feed. See `status` field: `live`, `cache`, `stale_cache`, `not_configured`, `error` |

## Webhooks (`/webhooks/facebook`)
| Method | Path | Notes |
|---|---|---|
| GET | `/facebook` | Meta subscription verification (`hub.mode`, `hub.verify_token`, `hub.challenge`) |
| POST | `/facebook` | Change notifications. Verified via `X-Hub-Signature-256` using `META_APP_SECRET`. Invalidates the feed cache on a valid `page` event. |

## Content (`/api/content`)
| Method | Path | Notes |
|---|---|---|
| GET | `/grades` / `/grades/:grade` | Grade → subject structure |
| GET | `/updates?category=` | Published, non-expired announcements/courses/events/notices |
| GET | `/live-classes?status=live\|upcoming\|completed` | Computed from `date`+`time`+`durationMinutes` |
| GET | `/language-courses` / `/language-courses/:id` | Language Academy courses |
| GET | `/search?q=` | Cross-content search |

## AI Teacher (`/api/ai`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/languages` | none | Supported languages |
| POST | `/ask` | Bearer | `{question,language?,gradeContext?,subject?}`. Returns `configured:false` with a clear message if no AI provider is set. |

## Dashboards (`/api/dashboard`)
`GET /student`, `/teacher`, `/parent`, `/school` — each requires the matching role (school dashboard also allows `admin`).

## Admin (`/api/admin`) — role `admin` only
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/collections/:name` | `:name` ∈ `updates, liveClasses, languageCourses, grades, knowledgeBase` |
| PUT/DELETE | `/collections/:name/:id` | Update/delete one item |
| GET | `/users` | List users (no password hashes) |
| GET | `/system-status` | Facebook/AI/auth configuration status |
| GET | `/analytics` | Aggregate, privacy-conscious counts only |

There is currently no admin **UI** — only the API. See `docs/DEPLOYMENT_CHECKLIST.md`
for what's needed to add one (it can be a simple authenticated page under `public/admin/`
calling these same endpoints).
