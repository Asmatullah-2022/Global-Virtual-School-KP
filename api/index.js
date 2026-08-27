// Vercel serverless function entry point. Vercel treats any file under
// /api as a function; this one re-exports the exact same Express app used
// by every other host (Bonto, Render, plain `node server/index.js`) — no
// routes, middleware, or app logic are duplicated or reimplemented here.
// vercel.json rewrites every request to this function, so Express's own
// static file serving and SPA fallback (already in server/index.js)
// continue to handle public/ and unmatched routes exactly as before.
export { default } from '../server/index.js';
