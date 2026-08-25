import logger from '../logger.js';

export function notFoundHandler(req, res, next) {
  if (req.path.startsWith('/api/') || req.path.startsWith('/webhooks/')) {
    return res.status(404).json({ error: 'Not found.' });
  }
  next();
}

export function errorHandler(err, req, res, _next) {
  logger.error('unhandled_error', { path: req.path, message: err.message });
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error.' : err.message,
  });
}
