import dotenv from 'dotenv';
dotenv.config();

function bool(v) { return v === '1' || v === 'true'; }

// Trims incidental whitespace from an env var value. Hosting dashboards
// (especially on mobile, where autocorrect/autocomplete and copy-paste are
// more error-prone) make it easy to save a value with a stray leading or
// trailing space or newline without it being visible in the UI.
function env(name, fallback = '') {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.trim();
}

// jsonwebtoken's `expiresIn` option throws synchronously — not a graceful
// rejection, an actual thrown Error — if the string doesn't match its
// expected format (e.g. "7d", "20h", or a plain number of seconds). A
// value with any extra character (a trailing space is enough) breaks it.
// Since this is only ever set from an env var someone typed or pasted
// into a dashboard, validating it here means a malformed value degrades
// to a safe default instead of taking down every registration and login
// with an opaque 500.
const JWT_EXPIRES_IN_RE = /^(\d+|\d+\s?(ms|s|m|h|d|w|y))$/i;
function resolveJwtExpiresIn() {
  const raw = env('JWT_EXPIRES_IN', '7d');
  if (JWT_EXPIRES_IN_RE.test(raw)) return raw;
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'invalid_jwt_expires_in_falling_back', meta: { rawLength: raw.length } }));
  return '7d';
}

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',

  jwtSecret: env('JWT_SECRET'),
  jwtExpiresIn: resolveJwtExpiresIn(),

  pageId: env('PAGE_ID', '61592435229097'),
  graphVersion: env('META_GRAPH_VERSION'),
  pageAccessToken: env('PAGE_ACCESS_TOKEN'),
  metaAppSecret: env('META_APP_SECRET'),
  webhookVerifyToken: env('WEBHOOK_VERIFY_TOKEN'),
  facebookPageUrl: `https://www.facebook.com/profile.php?id=${env('PAGE_ID', '61592435229097')}`,

  // Lowercased so a dashboard value typed as "Gemini"/"GEMINI"/"OpenAI"
  // still matches the exact-string comparisons in aiService.js instead of
  // silently falling through to the Anthropic default -- the provider
  // selection is otherwise indistinguishable from "not gemini" with no
  // error at all, which is exactly how this class of bug hides.
  aiProvider: env('AI_PROVIDER').toLowerCase(),
  aiApiKey: env('AI_API_KEY'),
  aiModel: env('AI_MODEL'),
  // Gemini-specific override, checked before the generic AI_MODEL (see
  // server/services/aiService.js's model resolution order) -- lets the
  // Gemini model be tuned (e.g. to a lighter free-tier-friendlier variant)
  // without disturbing AI_MODEL for anyone who later switches AI_PROVIDER
  // back to anthropic/openai.
  geminiModel: env('GEMINI_MODEL'),

  links: {
    website: 'https://gvskp.org/',
    admissions: 'https://gvskp.org/admission',
    lms: 'https://lms.gvskp.org/login',
  },

  isFacebookConfigured() {
    return Boolean(this.pageAccessToken && this.graphVersion);
  },
  isWebhookConfigured() {
    return Boolean(this.webhookVerifyToken && this.metaAppSecret);
  },
  isAiConfigured() {
    return Boolean(this.aiProvider && this.aiApiKey);
  },
  isAuthConfigured() {
    return Boolean(this.jwtSecret && this.jwtSecret !== 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET');
  },
};

export default config;
