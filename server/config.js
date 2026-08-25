import dotenv from 'dotenv';
dotenv.config();

function bool(v) { return v === '1' || v === 'true'; }

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',

  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  pageId: process.env.PAGE_ID || '61592435229097',
  graphVersion: process.env.META_GRAPH_VERSION || '',
  pageAccessToken: process.env.PAGE_ACCESS_TOKEN || '',
  metaAppSecret: process.env.META_APP_SECRET || '',
  webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN || '',
  facebookPageUrl: `https://www.facebook.com/profile.php?id=${process.env.PAGE_ID || '61592435229097'}`,

  aiProvider: process.env.AI_PROVIDER || '',
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || '',

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
