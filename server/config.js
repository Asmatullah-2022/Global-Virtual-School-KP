import dotenv from 'dotenv';
dotenv.config();

function bool(v) { return v === '1' || v === 'true'; }

// Trims incidental whitespace from an env var value, then strips one
// matching pair of wrapping quotes if present. Hosting dashboards
// (especially on mobile, where autocorrect/autocomplete and copy-paste are
// more error-prone) make it easy to save a value with a stray leading or
// trailing space or newline without it being visible in the UI -- and,
// separately, it's a very common paste mistake to copy a value straight
// out of a shell snippet or .env-style example that includes the
// surrounding quote characters (e.g. saving `"AIzaSy...=="` literally,
// quote marks included, as the dashboard value). Either mistake produces
// a value that LOOKS right at a glance in a masked/truncated dashboard
// display but is byte-for-byte wrong, which a downstream provider then
// rejects as an "invalid API key" with no way to tell the two apart from
// the outside -- stripping both here means neither can happen silently.
function env(name, fallback = '') {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
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
  // Gemini-specific overrides, both checked before the generic AI_MODEL /
  // AI_API_KEY (see server/services/aiService.js's resolution order).
  // geminiApiKey exists specifically so Gemini's key can be set, checked,
  // and rotated independently of whatever AI_API_KEY currently holds --
  // if AI_API_KEY still has a stale value from a previous provider (or a
  // paste mistake), Gemini keeps working off its own dedicated variable
  // rather than silently inheriting that problem. Anthropic/OpenAI are
  // unaffected either way -- they only ever read aiApiKey.
  geminiModel: env('GEMINI_MODEL'),
  geminiApiKey: env('GEMINI_API_KEY'),

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
  // Uses the same key-resolution order as callGemini() (geminiApiKey
  // first, falling back to aiApiKey) so this can't disagree with which
  // key the actual request will use -- setting only GEMINI_API_KEY (no
  // AI_API_KEY at all) must still report configured.
  isAiConfigured() {
    const key = this.aiProvider === 'gemini' ? (this.geminiApiKey || this.aiApiKey) : this.aiApiKey;
    return Boolean(this.aiProvider && key);
  },
  isAuthConfigured() {
    return Boolean(this.jwtSecret && this.jwtSecret !== 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET');
  },
};

export default config;
