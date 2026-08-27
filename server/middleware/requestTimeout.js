import logger from '../logger.js';

// Safety net for serverless hosts: if a handler somehow never sends a
// response (a hung dependency, an unresolved promise, anything), the
// platform's own function timeout eventually kills the invocation with an
// opaque failure and no useful client-facing error — exactly the
// "Request timed out" the frontend showed with no diagnosable cause.
// This responds with a clear, fast, structured error well before that
// happens, and logs which route hung so it's visible in the host's
// function logs even without live access to them.
export function requestTimeout(ms = 8000) {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        logger.error('request_timeout', { method: req.method, path: req.originalUrl });
        res.status(504).json({ error: 'The server took too long to respond. Please try again.' });
      }
    }, ms);
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
  };
}

export default requestTimeout;
