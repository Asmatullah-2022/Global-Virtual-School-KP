import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import config from './config.js';
import logger from './logger.js';
import { attachUser } from './middleware/auth.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

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
// route parses JSON itself with a rawBody capture; everything else uses
// the standard JSON parser.
app.use('/webhooks', express.json({ limit: '1mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimiter);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(attachUser);

app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: config.isProd ? '1d' : 0 }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
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

// Bind explicitly to 0.0.0.0 (not just the default) so the app is reachable
// on the interface hosting platforms' health checks and preview proxies
// (e.g. Bonto) actually probe, rather than relying on Node's default.
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
