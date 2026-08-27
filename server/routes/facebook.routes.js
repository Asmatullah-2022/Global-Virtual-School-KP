import { Router } from 'express';
import config from '../config.js';
import { getFeed } from '../services/facebookService.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

router.get('/config', (_req, res) => {
  res.json({
    pageId: config.pageId,
    facebookUrl: config.facebookPageUrl,
    configured: config.isFacebookConfigured(),
    website: config.links.website,
    admissions: config.links.admissions,
    lms: config.links.lms,
  });
});

router.get('/feed', asyncHandler(async (req, res) => {
  const forceRefresh = req.query.refresh === '1';
  const after = req.query.after || undefined;
  const result = await getFeed({ forceRefresh, after });
  const httpStatus = result.status === 'error' ? 502 : 200;
  res.status(httpStatus).json(result);
}));

export default router;
