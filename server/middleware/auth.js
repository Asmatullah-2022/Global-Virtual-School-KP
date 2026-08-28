import jwt from 'jsonwebtoken';
import config from '../config.js';

// Thrown with a distinct name (rather than letting jsonwebtoken's own
// generic "secretOrPrivateKey must have a value" surface) so callers can
// reliably detect "auth isn't configured" specifically, without having to
// pattern-match an error message string.
export class AuthNotConfiguredError extends Error {
  constructor() {
    super('JWT_SECRET is not configured on the server.');
    this.name = 'AuthNotConfiguredError';
  }
}

export function signToken(user) {
  if (!config.jwtSecret) throw new AuthNotConfiguredError();
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

// Populates req.user if a valid token is present; does not reject otherwise.
export function attachUser(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || !config.jwtSecret) return next();
  try {
    req.user = jwt.verify(token, config.jwtSecret);
  } catch {
    // invalid/expired token: treat as anonymous
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to access this resource.' });
    }
    next();
  };
}
