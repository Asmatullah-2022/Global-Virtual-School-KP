import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../lib/dataStore.js';
import { signToken, requireAuth, AuthNotConfiguredError } from '../middleware/auth.js';
import logger from '../logger.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();
const VALID_ROLES = ['student', 'teacher', 'parent', 'school', 'admin'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only students, teachers, parents and schools can self-register.
// Admin accounts must be provisioned directly by an existing admin (see docs/API.md).
router.post('/register', asyncHandler(async (req, res) => {
  const stageLog = (stage) => logger.info('register_stage', { stage, path: req.path });
  stageLog('start');
  const { name, email, password, role, grade, school } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password and role are required.' });
  }
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!VALID_ROLES.includes(role) || role === 'admin') {
    return res.status(400).json({ error: 'Invalid role for self-registration.' });
  }
  stageLog('validated');
  const existing = db.findOne('users', (u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });
  stageLog('checked_existing');

  const passwordHash = await bcrypt.hash(password, 12);
  stageLog('hashed_password');
  const user = db.create('users', {
    name,
    email: email.toLowerCase(),
    passwordHash,
    role,
    grade: role === 'student' ? grade || null : null,
    school: school || null,
    childrenIds: role === 'parent' ? [] : undefined,
    classIds: role === 'teacher' ? [] : undefined,
  }, 'usr');
  stageLog('created_user');

  logger.audit('user_registered', { userId: user.id, role });

  // The account is already created and saved at this point — that is the
  // part of "registration" that actually matters and cannot be undone.
  // Issuing a session token is a separate, best-effort step layered on
  // top: if it fails for any reason (e.g. a server misconfiguration), the
  // registration itself must still be reported as successful rather than
  // turning a real, saved account into a confusing 500 — the user can
  // simply log in afterward instead of being auto-signed-in immediately.
  let token = null;
  let authWarning;
  try {
    token = signToken(user);
    stageLog('token_issued');
  } catch (e) {
    logger.error('post_register_token_failed', { userId: user.id, name: e.name, message: e.message });
    authWarning = e instanceof AuthNotConfiguredError
      ? 'Your account was created, but automatic sign-in is temporarily unavailable. Please log in.'
      : 'Your account was created, but automatic sign-in failed. Please log in.';
  }

  stageLog('sending_response');
  res.status(201).json({ token, user: publicUser(user), ...(authWarning ? { authWarning } : {}) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required.' });
  const user = db.findOne('users', (u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

  logger.audit('user_login', { userId: user.id });
  let token;
  try {
    token = signToken(user);
  } catch (e) {
    logger.error('login_token_failed', { userId: user.id, name: e.name, message: e.message });
    const err = new Error(
      e instanceof AuthNotConfiguredError
        ? 'Sign-in is temporarily unavailable. Please try again shortly.'
        : 'Could not complete sign-in. Please try again.'
    );
    err.name = e.name; // preserve for accurate server-side log categorization
    err.status = 503;
    throw err;
  }
  res.json({ token, user: publicUser(user) });
}));

router.get('/me', requireAuth, (req, res) => {
  const user = db.get('users', req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(user) });
});

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

export default router;
