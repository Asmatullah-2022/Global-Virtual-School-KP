# AI Teacher Configuration

The AI Teacher's provider key is never sent to or stored in the mobile/web
client. Students call our own `POST /api/ai/ask`; the server calls the AI
provider and returns only the answer text.

## Enabling it

Set in `.env`:
```
AI_PROVIDER=anthropic   # or "openai" or "gemini"
AI_API_KEY=<your provider API key>
AI_MODEL=claude-sonnet-5   # optional, provider-specific model id
```
Defaults per provider if `AI_MODEL` is left unset: `claude-sonnet-5`
(anthropic), `gpt-4o-mini` (openai), `gemini-2.0-flash-lite` (gemini).

Restart the server. `GET /api/admin/system-status` (admin only) and
`GET /api/health` (no login required — provider, resolved model, and a
configured boolean only, never the key) both report the active AI Teacher
configuration.

### Gemini-specific notes

- Get a key from [Google AI Studio](https://aistudio.google.com/apikey) —
  its free tier is generous enough for testing, but shares a request/token
  quota across everyone using that key; a `RESOURCE_EXHAUSTED` error means
  that quota (or per-minute rate limit) was hit, not that the key is wrong.
  The AI Teacher page shows this as *"AI Teacher has reached its free-tier
  usage limit for now..."* rather than a generic failure, and still shows
  any matching knowledge-base entries underneath.
- `server/services/aiService.js`'s `callGemini()` sends the key as the
  `x-goog-api-key` header (never a `?key=` query parameter, so it can't end
  up copied into a log line or browser history) and calls
  `POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`.
- **Model selection**: defaults to `gemini-2.0-flash-lite` — the lighter
  "-lite" sibling of `gemini-2.0-flash`, chosen specifically because Google
  grants it a more generous free-tier request quota (not just because it's
  cheaper per token), which is exactly what matters when testing on a free
  key. Set `GEMINI_MODEL=<model id>` to override it independently of the
  generic `AI_MODEL` — useful if you switch `AI_PROVIDER` back to
  anthropic/openai later without wanting to also change the Gemini choice,
  or if you want to trade free-tier headroom for a more capable model
  (e.g. `GEMINI_MODEL=gemini-2.0-flash` or a newer release). Resolution
  order: `GEMINI_MODEL` → `AI_MODEL` → the built-in default.

## Without a key

`POST /api/ai/ask` returns `configured:false` with the message *"AI Teacher
is not yet connected to an AI provider..."* plus any matching entries from
the GVS knowledge base (keyword search only — see below). It never
fabricates an AI answer.

## Curriculum grounding (knowledge base)

`server/data/knowledgeBase.json` holds admin-managed entries
(`{grade, subject, topic, content}`) manageable via
`GET/POST/PUT/DELETE /api/admin/collections/knowledgeBase`.
`server/services/knowledgeBase.js` does a simple keyword match against the
student's question and passes the top matches into the AI prompt as
context, and returns them directly if the AI provider isn't configured.

This is intentionally a v1 (keyword search, not embeddings/vector search).
Before treating AI answers as authoritative GVS curriculum content, expand
this with real retrieval over an admin-approved curriculum corpus.

## Privacy

- No student PII (name, email, grade-level identifiers beyond a bare grade
  number the student chooses to include) is sent to the AI provider — only
  the question text, selected language, and optional grade/subject context.
- `POST /api/ai/ask` requires authentication so usage is attributable to a
  user for support/audit purposes, but the prompt itself stays anonymous to
  the AI provider.
- Every AI answer is returned with the disclaimer: *"AI-generated learning
  assistance. Verify important academic information with official course
  material."*
