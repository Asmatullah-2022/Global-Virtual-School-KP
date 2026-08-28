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
(anthropic), `gpt-4o-mini` (openai), `gemini-3.1-flash-lite` (gemini).

Restart the server. `GET /api/admin/system-status` (admin only) and
`GET /api/health` (no login required — provider, resolved model, and a
configured boolean only, never the key) both report the active AI Teacher
configuration. `/api/health`'s `aiTeacher.apiKey` block also reports,
still without ever exposing the key itself: which env var it came from
(`source`), its length (`length` — an integer alone can't reconstruct a
secret, but does confirm the value isn't empty or a stray placeholder),
and whether it starts with Google's public `AIza` key prefix
(`looksLikeGoogleAiStudioKey` — `false` here is near-conclusive evidence
the stored value isn't a real Google key at all, e.g. it's still a
leftover key from a different provider).

### Gemini-specific notes

- Get a key from [Google AI Studio](https://aistudio.google.com/apikey) —
  its free tier is generous enough for testing, but shares a request/token
  quota across everyone using that key; a `RESOURCE_EXHAUSTED` error means
  that quota (or per-minute rate limit) was hit, not that the key is wrong.
  The AI Teacher page shows this as *"AI Teacher has reached its free-tier
  usage limit for now..."* rather than a generic failure, and still shows
  any matching knowledge-base entries underneath.
- **Key**: `GEMINI_API_KEY` takes priority over the shared `AI_API_KEY`
  (checked first — see resolution order below). Set it if you've ever used
  `AI_API_KEY` for a different provider before, so Gemini definitely uses
  its own value rather than whatever `AI_API_KEY` currently holds. Paste
  only the raw key — a value saved with surrounding quote characters
  (e.g. `"AIza..."`, literal quotes included) is a common dashboard paste
  mistake that produces exactly the same `INVALID_ARGUMENT` /
  `"API key not valid"` error as a genuinely wrong key; both `AI_API_KEY`
  and `GEMINI_API_KEY` now have one layer of wrapping quotes stripped
  automatically as a safety net, but don't rely on that — copy just the
  key itself.
- `server/services/aiService.js`'s `callGemini()` sends the key as the
  `x-goog-api-key` header (never a `?key=` query parameter, so it can't end
  up copied into a log line or browser history) and calls
  `POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`.
- **Model selection**: defaults to `gemini-3.1-flash-lite`, Google's
  current lightweight/cost-effective model, free-tier eligible with no
  credit card required. The entire Gemini 2.0 family (`gemini-2.0-flash`,
  `gemini-2.0-flash-lite`, and their `-001` variants — a previous default
  here) was retired by Google on 2026-06-01; requesting any of those now
  returns a `NOT_FOUND` error (`errorCategory: "Model unavailable"`), not
  a rate limit. Set `GEMINI_MODEL=<model id>` to override the default
  independently of the generic `AI_MODEL` — useful if you switch
  `AI_PROVIDER` back to anthropic/openai later without wanting to also
  change the Gemini choice, if you want to trade free-tier headroom for a
  larger model (e.g. `GEMINI_MODEL=gemini-3.1-flash`), or if Google
  retires this model too and you need a fast override without a code
  change. Resolution order: `GEMINI_MODEL` → `AI_MODEL` → the built-in
  default. Check Google's own deprecations page
  (ai.google.dev/gemini-api/docs/deprecations) before relying on any
  specific model long-term.

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
