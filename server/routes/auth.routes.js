import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../lib/dataStore.js';
import { signToken, requireAuth, AuthNotConfiguredError } from '../middleware/auth.js';
import logger from '../logger.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();
const VALID_ROLES = ['student', 'teacher', 'parent', 'school', 'admin'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Consistent normalization used by both register and login — trimmed and
// lowercased here, once, rather than relying on each call site (or the
// frontend) to remember to do it the same way every time.
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Only students, teachers, parents and schools can self-register.
// Admin accounts must be provisioned directly by an existing admin (see docs/API.md).
router.post('/register', asyncHandler(async (req, res) => {
  // db.instanceId identifies which cold-start/container this request ran
  // in; db.count is a record count only (never content) — both safe to
  // log, and together they're the direct evidence needed to confirm or
  // rule out cross-container storage isolation as the cause of a login
  // failure immediately following a successful registration. Never logs
  // the password or password hash.
  const stageLog = (stage, extra) => logger.info('register_stage', { stage, path: req.path, instanceId: db.instanceId, backend: db.backend, ...extra });
  stageLog('start');
  const { name, password, role, grade, school } = req.body || {};
  const email = normalizeEmail(req.body?.email);
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password and role are required.' });
  }
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!VALID_ROLES.includes(role) || role === 'admin') {
    return res.status(400).json({ error: 'Invalid role for self-registration.' });
  }
  stageLog('validated');
  const existing = await db.findOne('users', (u) => u.email === email);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });
  stageLog('checked_existing', { existingUserCount: await db.count('users') });

  const passwordHash = await bcrypt.hash(password, 12);
  stageLog('hashed_password');
  const user = await db.create('users', {
    name,
    email,
    passwordHash,
    role,
    grade: role === 'student' ? grade || null : null,
    school: school || null,
    childrenIds: role === 'parent' ? [] : undefined,
    classIds: role === 'teacher' ? [] : undefined,
  }, 'usr');
  stageLog('created_user', { userId: user.id, userCountAfterCreate: await db.count('users') });

  logger.audit('user_registered', { userId: user.id, role, instanceId: db.instanceId });

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
  const stageLog = (stage, extra) => logger.info('login_stage', { stage, path: req.path, instanceId: db.instanceId, backend: db.backend, ...extra });
  stageLog('start');
  const { password } = req.body || {};
  const email = normalizeEmail(req.body?.email);
  if (!email || !password) return res.status(400).json({ error: 'email and password are required.' });
  // Diagnostic only — a record count, never content, never the password
  // or its hash. If this same email was registered moments earlier on a
  // different container, userCountAtLookup here being 0 (or the user not
  // being found despite a successful prior registration) is the direct
  // evidence needed to confirm cross-container storage isolation as the
  // cause, rather than assuming it.
  stageLog('looking_up_user', { userCountAtLookup: await db.count('users') });
  const user = await db.findOne('users', (u) => u.email === email);
  if (!user) {
    stageLog('user_not_found');
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  stageLog('user_found', { userId: user.id });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    stageLog('password_mismatch', { userId: user.id });
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  stageLog('password_ok', { userId: user.id });

  logger.audit('user_login', { userId: user.id, instanceId: db.instanceId });
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

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await db.get('users', req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(user) });
}));

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

export default router;
