import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import config from './config.js';
import logger from './logger.js';
import db from './lib/dataStore.js';
import { attachUser } from './middleware/auth.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { jsonBody } from './middleware/bodyParser.js';
import { requestTimeout } from './middleware/requestTimeout.js';
import { asyncHandler } from './lib/asyncHandler.js';

import authRoutes from './routes/auth.routes.js';
import facebookRoutes from './routes/facebook.routes.js';
import webhookRoutes from './routes/webhooks.routes.js';
import contentRoutes from './routes/content.routes.js';
import aiRoutes from './routes/ai.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import adminRoutes from './routes/admin.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1);
app.use(requestTimeout(8000));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(cors({ origin: config.isProd ? [config.links.website, 'https://gvskp.org'] : true }));

// Webhooks need the raw body for X-Hub-Signature-256 verification, so that
// route captures it via jsonBody's rawBody option; everything else uses
// the plain JSON parser. See server/middleware/bodyParser.js for why this
// is a custom parser rather than express.json() directly (Vercel
// compatibility — express.json() alone silently produces an empty body
// there).
app.use('/webhooks', jsonBody({ captureRawBody: true }));
app.use(jsonBody());

const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimiter);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(attachUser);

app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: config.isProd ? '1d' : 0 }));

// VERCEL_GIT_COMMIT_SHA is set automatically by Vercel for every
// deployment — no configuration needed, nothing to add. Included here
// specifically so the actual deployed commit can be checked from a
// browser (open /api/health) instead of guessing whether a push has
// actually gone live, which has been the recurring source of confusion
// in getting registration fixes verified on this deployment.
// dataStore diagnostics below are deliberately limited to non-sensitive
// facts: which backend is active, the Redis hostname (never the token —
// a hostname alone grants no access), and a record count (never
// content). This exists specifically to answer, from the browser alone
// and without Vercel dashboard/log access, the question that has caused
// repeated confusion across Preview vs Production deployments: "is this
// exact domain even looking at the Redis database I think it is, and
// does it currently have any users in it?" Two domains reporting
// different redisHost values, or a domain reporting usersCount: 0 right
// after a registration that reported success, is direct, conclusive
// evidence of an environment/deployment mismatch rather than a data
// store or password-hashing bug.
// Reads the RAW env var directly (not config.jwtSecret, which is already
// trimmed) so this can distinguish, without ever revealing the secret
// itself: the key not being present under this exact name at all (a
// case/spelling mismatch between what's typed into Vercel and JWT_SECRET
// — env var names are case-sensitive) vs. present but empty vs. present
// but whitespace-only (trimmedLength 0 with rawLength > 0 — an
// easy-to-miss stray space/newline from copy-paste) vs. present with
// real content but happening to equal the exact placeholder string.
// Every field here is a length (an integer) or a boolean — none of them
// can be used to reconstruct or guess the actual secret value.
function jwtSecretDiagnostics() {
  const raw = process.env.JWT_SECRET;
  return {
    keyPresent: raw !== undefined,
    rawLength: raw === undefined ? null : raw.length,
    trimmedLength: raw === undefined ? null : raw.trim().length,
    matchesPlaceholderExactly: raw === 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET',
  };
}

app.get('/api/health', asyncHandler(async (_req, res) => {
  let usersCount = null;
  let dataStoreError = null;
  try {
    usersCount = await db.count('users');
  } catch (e) {
    dataStoreError = e.name || 'unknown';
  }
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    authConfigured: config.isAuthConfigured(),
    jwtSecretDiagnostics: jwtSecretDiagnostics(),
    // Provider name and a boolean only — never the API key, never any
    // part of it. Mirrors authConfigured so this can be checked from
    // /api/health without an admin login (server/routes/admin.routes.js's
    // /system-status already exposes this same pair, but requires auth).
    aiTeacher: { configured: config.isAiConfigured(), provider: config.aiProvider || null },
    dataStore: {
      backend: db.backend,
      redisHost: db.redisHost,
      usersCount,
      error: dataStoreError,
    },
  });
}));
app.use('/api/auth', authRoutes);
app.use('/api/facebook', facebookRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/webhooks', webhookRoutes);

app.use(notFoundHandler);

// SPA fallback — must come after API routes so unmatched /api/* still 404s as JSON.
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

app.use(errorHandler);

// On a serverless platform (Vercel sets VERCEL=1 in its function runtime)
// the platform itself invokes `app` as a request handler per invocation —
// there is no long-lived process to bind a port on, so app.listen() must
// be skipped there. Every other host (Bonto, Render, plain `node
// server/index.js`, etc.) runs this file directly as the process entry
// point and needs the normal listen() call, unchanged from before.
if (!process.env.VERCEL) {
  // Bind explicitly to 0.0.0.0 (not just the default) so the app is
  // reachable on the interface hosting platforms' health checks and
  // preview proxies (e.g. Bonto) actually probe, rather than relying on
  // Node's default.
  app.listen(config.port, '0.0.0.0', () => {
    logger.info('gvs_server_started', {
      port: config.port,
      host: '0.0.0.0',
      env: config.nodeEnv,
      facebookConfigured: config.isFacebookConfigured(),
      webhookConfigured: config.isWebhookConfigured(),
      aiConfigured: config.isAiConfigured(),
      authConfigured: config.isAuthConfigured(),
    });
    // eslint-disable-next-line no-console
    console.log(`GVS app running on http://localhost:${config.port}`);
  });
}

// Exported so a hosting-platform-specific entry point (e.g. api/index.js
// for Vercel) can reuse this exact same Express app as a request handler
// without duplicating any route/middleware setup above.
export default app;
