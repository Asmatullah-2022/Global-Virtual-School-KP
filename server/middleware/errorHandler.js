import crypto from 'crypto';
import logger from '../logger.js';

export function notFoundHandler(req, res, next) {
  if (req.path.startsWith('/api/') || req.path.startsWith('/webhooks/')) {
    return res.status(404).json({ error: 'Not found.' });
  }
  next();
}

// Classifies a 500 into a small set of safe, non-sensitive categories.
// Never exposes err.message, err.stack, or any file path/secret in the
// response — only a coarse label plus a short request ID that also
// appears in the server-side log line for the same event, so the two can
// be correlated without ever needing to expose internals to the client.
// This exists specifically so a failure is diagnosable when the person
// hitting it (or reporting it) has no access to the host's own logs.
function classifyError(err) {
  const code = err.code || '';
  const name = err.name || '';
  const message = err.message || '';

  if (['ENOENT', 'EACCES', 'EPERM', 'ENOTDIR', 'EISDIR', 'EEXIST', 'ENOSPC', 'EROFS', 'EMFILE'].includes(code)) {
    return 'STORAGE';
  }
  if (name === 'AuthNotConfiguredError' || name === 'JsonWebTokenError' || name === 'NotBeforeError' || /secretOrPrivateKey|jwt|expiresIn/i.test(message)) {
    return 'AUTH_CONFIG';
  }
  if (/bcrypt/i.test(message) || /bcrypt/i.test(name)) {
    return 'PASSWORD_HASHING';
  }
  if (name === 'SyntaxError') {
    return 'BAD_REQUEST_BODY';
  }
  return 'UNKNOWN';
}

export function errorHandler(err, req, res, _next) {
  const requestId = crypto.randomBytes(4).toString('hex');
  const category = classifyError(err);
  logger.error('unhandled_error', { requestId, category, path: req.path, message: err.message, code: err.code, name: err.name });
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error.' : err.message,
    ...(status === 500 ? { category, requestId } : {}),
  });
}
