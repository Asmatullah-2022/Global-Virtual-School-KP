import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../lib/dataStore.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import logger from '../logger.js';

const router = Router();
const VALID_ROLES = ['student', 'teacher', 'parent', 'school', 'admin'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only students, teachers, parents and schools can self-register.
// Admin accounts must be provisioned directly by an existing admin (see docs/API.md).
router.post('/register', async (req, res) => {
  const { name, email, password, role, grade, school } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password and role are required.' });
  }
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!VALID_ROLES.includes(role) || role === 'admin') {
    return res.status(400).json({ error: 'Invalid role for self-registration.' });
  }
  const existing = db.findOne('users', (u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  const passwordHash = await bcrypt.hash(password, 12);
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

  logger.audit('user_registered', { userId: user.id, role });
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required.' });
  const user = db.findOne('users', (u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

  logger.audit('user_login', { userId: user.id });
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

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
