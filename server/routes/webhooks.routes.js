import { Router } from 'express';
import crypto from 'crypto';
import config from '../config.js';
import logger from '../logger.js';
import { invalidateCache } from '../services/facebookService.js';

const router = Router();

// GET: Meta's webhook subscription verification handshake.
router.get('/facebook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (!config.webhookVerifyToken) {
    logger.warn('facebook_webhook_verify_not_configured');
    return res.status(503).send('WEBHOOK_VERIFY_TOKEN is not configured on the server.');
  }
  if (mode === 'subscribe' && token && timingSafeEqual(token, config.webhookVerifyToken)) {
    logger.info('facebook_webhook_verified');
    return res.status(200).send(challenge);
  }
  logger.warn('facebook_webhook_verify_failed');
  res.sendStatus(403);
});

// POST: Meta pushes real-time change notifications here.
// Body must be captured as a raw buffer (see server/index.js) so the
// X-Hub-Signature-256 signature can be verified before trusting the payload.
router.post('/facebook', (req, res) => {
  if (!config.metaAppSecret) {
    logger.warn('facebook_webhook_event_ignored_no_secret');
    return res.status(503).json({ error: 'META_APP_SECRET is not configured on the server.' });
  }

  const signatureHeader = req.headers['x-hub-signature-256'];
  const rawBody = req.rawBody;
  if (!signatureHeader || !rawBody || !verifySignature(rawBody, signatureHeader, config.metaAppSecret)) {
    logger.warn('facebook_webhook_signature_invalid');
    return res.sendStatus(403);
  }

  const body = req.body || {};
  if (body.object === 'page') {
    for (const entry of body.entry || []) {
      logger.info('facebook_webhook_event', { pageId: entry.id, changes: (entry.changes || []).map((c) => c.field) });
    }
    // A feed/post change invalidates our short-lived cache so the next
    // client request triggers a fresh Graph API fetch instead of serving
    // stale data for up to CACHE_TTL_MS.
    invalidateCache();
  }

  res.sendStatus(200);
});

function verifySignature(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signatureHeader));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export default router;
