import { Router } from 'express';
import db from '../lib/dataStore.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getCacheSnapshot } from '../services/facebookService.js';
import config from '../config.js';
import logger from '../logger.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// Generic CRUD for the content collections an admin manages. Kept generic
// (rather than one router per collection) because the shape of the
// operations is identical; validation of collection-specific fields still
// happens client-side in the admin UI and should be hardened further
// before a real production launch (e.g. per-collection JSON schema).
const MANAGED_COLLECTIONS = ['updates', 'liveClasses', 'languageCourses', 'grades', 'knowledgeBase'];

router.get('/collections/:name', asyncHandler(async (req, res) => {
  if (!MANAGED_COLLECTIONS.includes(req.params.name)) return res.status(404).json({ error: 'Unknown collection.' });
  res.json({ items: await db.list(req.params.name) });
}));

router.post('/collections/:name', asyncHandler(async (req, res) => {
  if (!MANAGED_COLLECTIONS.includes(req.params.name)) return res.status(404).json({ error: 'Unknown collection.' });
  const item = await db.create(req.params.name, { ...req.body, status: req.body.status || 'draft', author: req.user.name });
  logger.audit('admin_create', { collection: req.params.name, id: item.id, by: req.user.sub });
  res.status(201).json({ item });
}));

router.put('/collections/:name/:id', asyncHandler(async (req, res) => {
  if (!MANAGED_COLLECTIONS.includes(req.params.name)) return res.status(404).json({ error: 'Unknown collection.' });
  const item = await db.update(req.params.name, req.params.id, req.body);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  logger.audit('admin_update', { collection: req.params.name, id: item.id, by: req.user.sub });
  res.json({ item });
}));

router.delete('/collections/:name/:id', asyncHandler(async (req, res) => {
  if (!MANAGED_COLLECTIONS.includes(req.params.name)) return res.status(404).json({ error: 'Unknown collection.' });
  const ok = await db.remove(req.params.name, req.params.id);
  if (!ok) return res.status(404).json({ error: 'Item not found.' });
  logger.audit('admin_delete', { collection: req.params.name, id: req.params.id, by: req.user.sub });
  res.status(204).end();
}));

router.get('/users', asyncHandler(async (_req, res) => {
  const users = (await db.list('users')).map(({ passwordHash, ...u }) => u);
  res.json({ users });
}));

router.get('/system-status', (_req, res) => {
  const fb = getCacheSnapshot();
  res.json({
    facebook: { configured: config.isFacebookConfigured(), webhookConfigured: config.isWebhookConfigured(), lastUpdatedAt: fb.updatedAt, cachedPosts: fb.posts.length },
    aiTeacher: { configured: config.isAiConfigured(), provider: config.aiProvider || null },
    auth: { configured: config.isAuthConfigured() },
    environment: config.nodeEnv,
  });
});

router.get('/analytics', asyncHandler(async (_req, res) => {
  // Privacy-conscious, aggregate-only counts — no per-user tracking payloads.
  const users = await db.list('users');
  res.json({
    activeUsers: users.length,
    byRole: users.reduce((acc, u) => ((acc[u.role] = (acc[u.role] || 0) + 1), acc), {}),
    courseEnrollments: (await db.list('progress')).length,
    liveClassesScheduled: (await db.list('liveClasses')).length,
    languageCourseCount: (await db.list('languageCourses')).length,
  });
}));

export default router;
