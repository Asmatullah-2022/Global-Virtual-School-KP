// Resilient JSON body parser that works correctly both on a normal Node
// host (Bonto, Render, plain `node server/index.js`) and on Vercel.
//
// Root cause this works around: Vercel's Node.js Functions runtime
// automatically pre-parses the incoming request body by default (its
// "helpers" feature) and populates req.body *before* the exported Express
// app ever runs, draining the raw request stream in the process. Express's
// own express.json() middleware then tries to read that already-drained
// stream itself and silently ends up with an empty body — no error is
// thrown, so POST routes (register, login, AI Teacher, admin CRUD, ...)
// receive `req.body = {}` and 400/misbehave with no visible cause. Vercel
// documents an env-var opt-out (NODEJS_HELPERS=0), but that requires
// dashboard access this deployment process doesn't control, so instead:
// detect which case we're in and handle both without needing any
// platform-specific configuration at all.
import logger from '../logger.js';

export function jsonBody({ captureRawBody = false } = {}) {
  return (req, res, next) => {
    // Case 1: the platform (Vercel) already consumed the body before we
    // got here. Earlier this only recognized an already-parsed *object*
    // (req.body typeof 'object') — but Vercel's helpers can hand it over
    // as a raw string too, depending on runtime version and how the
    // request negotiates content type. Checking for "anything at all"
    // (not just objects) is what actually matches "the platform already
    // drained the stream" — the real condition we care about — instead of
    // one specific shape of it. Getting this narrower check wrong is
    // exactly what caused Case 2 (below) to wait on stream events that
    // would never fire, i.e. the production hang/500/504 this fixes.
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'string') {
        if (req.body.trim() === '') {
          req.body = {};
        } else {
          try {
            req.body = JSON.parse(req.body);
          } catch {
            return res.status(400).json({ error: 'Invalid JSON in request body.' });
          }
        }
      } else if (Buffer.isBuffer(req.body)) {
        const text = req.body.toString('utf-8');
        if (captureRawBody && !req.rawBody) req.rawBody = req.body;
        if (text.trim() === '') {
          req.body = {};
        } else {
          try {
            req.body = JSON.parse(text);
          } catch {
            return res.status(400).json({ error: 'Invalid JSON in request body.' });
          }
        }
      }
      // else: already a parsed plain object — use as-is.

      if (captureRawBody && !req.rawBody) {
        // Best-effort reconstruction for signature verification when the
        // true original bytes are unavailable. Documented limitation: if
        // the platform's re-serialization doesn't byte-match what the
        // sender actually transmitted, signature verification (which
        // needs exact original bytes) can't succeed even though the data
        // itself is intact. This only affects the webhook route, and only
        // when running on a platform that pre-parses bodies.
        req.rawBody = Buffer.from(JSON.stringify(req.body));
      }
      return next();
    }

    // Case 2: req.body wasn't pre-populated, so read the stream
    // ourselves — the normal path on every non-Vercel host. Defended with
    // its own short timeout: if the stream never emits 'data'/'end' at
    // all (a platform quirk this module doesn't yet know about), this
    // fails fast with a clear error instead of hanging until the
    // request-level safety net or the platform's own timeout kicks in.
    const chunks = [];
    let total = 0;
    const LIMIT = 1024 * 1024; // 1mb, matching the previous express.json() limit
    let responded = false;

    const streamTimeout = setTimeout(() => {
      if (!responded) {
        responded = true;
        logger.error('body_stream_timeout', { path: req.originalUrl || req.url });
        res.status(500).json({ error: 'Could not read the request body.' });
      }
    }, 5000);

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > LIMIT) {
        if (!responded) {
          responded = true;
          clearTimeout(streamTimeout);
          res.status(413).json({ error: 'Request body too large.' });
        }
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (responded) return;
      responded = true;
      clearTimeout(streamTimeout);
      const buf = Buffer.concat(chunks);
      if (captureRawBody) req.rawBody = buf;
      if (buf.length === 0) {
        req.body = {};
        return next();
      }
      try {
        req.body = JSON.parse(buf.toString('utf-8'));
      } catch {
        return res.status(400).json({ error: 'Invalid JSON in request body.' });
      }
      next();
    });

    req.on('error', (err) => {
      if (!responded) {
        responded = true;
        clearTimeout(streamTimeout);
        next(err);
      }
    });
  };
}

export default jsonBody;
