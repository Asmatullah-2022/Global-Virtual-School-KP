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
export function jsonBody({ captureRawBody = false } = {}) {
  return (req, res, next) => {
    // Case 1: the platform (Vercel) already parsed the body into a plain
    // object before we got here. Trust it — there is no raw stream left
    // to read, and re-reading it would hang or return nothing.
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
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

    // Case 2: nothing has consumed the stream yet — this is the normal
    // path on every non-Vercel host, and read it ourselves.
    const chunks = [];
    let total = 0;
    const LIMIT = 1024 * 1024; // 1mb, matching the previous express.json() limit
    let responded = false;

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > LIMIT) {
        if (!responded) {
          responded = true;
          res.status(413).json({ error: 'Request body too large.' });
        }
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (responded) return;
      const buf = Buffer.concat(chunks);
      if (captureRawBody) req.rawBody = buf;
      if (buf.length === 0) {
        req.body = {};
        return next();
      }
      try {
        req.body = JSON.parse(buf.toString('utf-8'));
      } catch {
        responded = true;
        return res.status(400).json({ error: 'Invalid JSON in request body.' });
      }
      next();
    });

    req.on('error', (err) => {
      if (!responded) {
        responded = true;
        next(err);
      }
    });
  };
}

export default jsonBody;
