// Express 4 (unlike Express 5) does not automatically forward a rejected
// promise from an `async (req, res) => {...}` route handler to error
// -handling middleware. If anything inside such a handler throws or
// rejects — a filesystem error, a dependency misbehaving, anything — the
// request is simply never responded to. There is no crash, no logged
// error from Express itself, nothing: the client just waits until the
// platform's own timeout eventually kills the connection. That is
// indistinguishable, from the outside, from a plain network hang.
//
// Wrapping every async route handler with this closes that gap: any
// rejection is caught and handed to next(), which reaches
// server/middleware/errorHandler.js and produces a fast, clear JSON
// error response instead of an unbounded silent wait.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default asyncHandler;
