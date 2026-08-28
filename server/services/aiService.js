// AI Teacher backend integration. The provider API key never leaves the
// server. If no provider is configured, callers get a clear, honest status
// instead of a simulated answer.
import config from '../config.js';
import { searchKnowledgeBase } from './knowledgeBase.js';
import logger from '../logger.js';

const SUPPORTED_LANGUAGES = ['English', 'Urdu', 'Pashto'];

const SYSTEM_PROMPT = `You are the GVS AI Teacher for Global Virtual School (Government of Khyber Pakhtunkhwa).
You help students in grades 6-12 with their studies. Rules:
- Answer in the language the student requests (English, Urdu, or Pashto). Default to English.
- Keep answers clear, age-appropriate, and curriculum-focused.
- When the student asks for MCQs, short questions, or a quiz, format them clearly and numbered.
- If you are not certain something is part of the official GVS curriculum, say so — never claim
  unverified content is official GVS material.
- Always be encouraging and patient.`;

// Anthropic's error responses carry a machine-readable `type` alongside the
// human-readable message (https://docs.anthropic.com error object shape:
// {"error": {"type": "...", "message": "..."}}) -- neither field ever
// echoes back the request's API key, so both are safe to log and to
// return to the (already-authenticated) caller. Mapping the type to one
// of a small, consistent set of plain-language categories here means a
// failure can be diagnosed from the browser alone, without Vercel
// dashboard/log access -- regardless of which provider is active.
const ANTHROPIC_ERROR_CATEGORIES = {
  authentication_error: 'Invalid API key',
  permission_error: 'API key does not have access to this model',
  not_found_error: 'Model unavailable (not found -- check AI_MODEL)',
  rate_limit_error: 'Quota/rate limit exceeded',
  invalid_request_error: 'Request rejected by Anthropic (see message -- often a credit/billing issue)',
  overloaded_error: 'Anthropic API temporarily unavailable',
  api_error: 'Anthropic API error',
};

const OPENAI_ERROR_CATEGORIES = {
  invalid_api_key: 'Invalid API key',
  insufficient_quota: 'Quota/rate limit exceeded (no remaining credits)',
  model_not_found: 'Model unavailable (not found -- check AI_MODEL)',
  rate_limit_exceeded: 'Quota/rate limit exceeded',
};

// Google's Generative Language API error shape is
// {"error": {"code": <http status>, "message": "...", "status": "<ENUM>"}}
// -- the enum in `status` (not `code`, which is just the HTTP status
// repeated) is the machine-readable category, e.g. "RESOURCE_EXHAUSTED"
// for both quota and rate-limit (the free tier's most common failure).
// Neither field ever echoes back the request's API key.
const GEMINI_ERROR_CATEGORIES = {
  UNAUTHENTICATED: 'Invalid API key',
  PERMISSION_DENIED: 'API key does not have access to this model',
  NOT_FOUND: 'Model unavailable (not found -- check AI_MODEL)',
  RESOURCE_EXHAUSTED: 'Quota/rate limit exceeded (Gemini free-tier limits are easy to hit)',
  INVALID_ARGUMENT: 'Gemini API error (invalid request -- see message)',
  UNAVAILABLE: 'Gemini API temporarily unavailable',
  INTERNAL: 'Gemini API error',
};

function providerError(data, status, categories, providerType, providerLabel) {
  const err = new Error(data.error?.message || `${providerLabel} error (HTTP ${status}).`);
  err.status = status;
  err.providerType = providerType;
  err.category = (providerType && categories[providerType]) || `${providerLabel} API error (HTTP ${status})`;
  return err;
}

// Shared by every provider so a failure that never makes it to an HTTP
// response -- the outbound request itself failing (DNS, TLS, connection
// reset, a Vercel egress restriction) -- or a response that isn't valid
// JSON (a proxy/CDN error page in front of the provider) still gets a
// specific, safe category instead of silently falling back to the bare
// generic "could not respond" message with no detail at all.
async function fetchProviderJson(url, options, { categories, extractType, providerLabel }) {
  let r;
  try {
    r = await fetch(url, options);
  } catch (e) {
    const err = new Error(`Network error contacting ${providerLabel}: ${e.message}`);
    err.category = 'Could not reach the AI provider (network error)';
    throw err;
  }
  let data;
  try {
    data = await r.json();
  } catch (e) {
    const err = new Error(`${providerLabel} returned a response that could not be parsed (HTTP ${r.status}).`);
    err.status = r.status;
    err.category = 'Unexpected response from the AI provider';
    throw err;
  }
  if (!r.ok) throw providerError(data, r.status, categories, extractType(data), providerLabel);
  return data;
}

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

async function callAnthropic({ question, language, gradeContext, kbContext }) {
  const data = await fetchProviderJson(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.aiApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.aiModel || DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Grade context: ${gradeContext || 'unspecified'}\nPreferred language: ${language}\n${
              kbContext ? `Relevant GVS knowledge base excerpts:\n${kbContext}\n` : ''
            }\nStudent question: ${question}`,
          },
        ],
      }),
    },
    { categories: ANTHROPIC_ERROR_CATEGORIES, extractType: (d) => d.error?.type || null, providerLabel: 'Anthropic' }
  );
  return data.content?.[0]?.text || '';
}

async function callOpenAI({ question, language, gradeContext, kbContext }) {
  const data = await fetchProviderJson(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.aiApiKey}`,
      },
      body: JSON.stringify({
        model: config.aiModel || DEFAULT_OPENAI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Grade context: ${gradeContext || 'unspecified'}\nPreferred language: ${language}\n${
              kbContext ? `Relevant GVS knowledge base excerpts:\n${kbContext}\n` : ''
            }\nStudent question: ${question}`,
          },
        ],
      }),
    },
    { categories: OPENAI_ERROR_CATEGORIES, extractType: (d) => d.error?.code || d.error?.type || null, providerLabel: 'OpenAI' }
  );
  return data.choices?.[0]?.message?.content || '';
}

// Google Generative Language API (Gemini). The key is sent as the
// x-goog-api-key header rather than the documented alternative of a
// `?key=` query-string parameter -- a header can't end up copied into a
// log line, error message, or browser history the way a URL can, and
// Google's API accepts either form.
//
// Default model: gemini-3.1-flash-lite. The Gemini 2.0 family
// (gemini-2.0-flash and gemini-2.0-flash-lite, the previous default
// here) was retired by Google on 2026-06-01 -- confirmed via Google's
// own deprecations page (ai.google.dev/gemini-api/docs/deprecations)
// and release notes, not assumed. gemini-3.1-flash-lite is Google's
// current lightweight/cost-effective model, free-tier eligible with no
// credit card required, and is the model id Google's own docs use for
// API calls (ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite).
// GEMINI_MODEL overrides this (checked before the generic AI_MODEL, so
// switching AI_PROVIDER back to anthropic/openai later doesn't require
// touching this value) -- set it if Google retires this model too, or
// to trade free-tier headroom for a larger model.
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';

async function callGemini({ question, language, gradeContext, kbContext }) {
  const model = config.geminiModel || config.aiModel || DEFAULT_GEMINI_MODEL;
  const data = await fetchProviderJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': config.aiApiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Grade context: ${gradeContext || 'unspecified'}\nPreferred language: ${language}\n${
                  kbContext ? `Relevant GVS knowledge base excerpts:\n${kbContext}\n` : ''
                }\nStudent question: ${question}`,
              },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 1024 },
      }),
    },
    { categories: GEMINI_ERROR_CATEGORIES, extractType: (d) => d.error?.status || null, providerLabel: 'Gemini' }
  );
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || '').join('');
  if (!text) {
    // A response can come back HTTP 200 with no text -- most commonly the
    // model stopped for a safety/recitation reason. finishReason is
    // Google's own field, safe to surface the same way a provider error
    // is; never derived from the API key.
    const finishReason = data.candidates?.[0]?.finishReason;
    const err = new Error(finishReason ? `Gemini returned no text (finishReason: ${finishReason}).` : 'Gemini returned no text.');
    err.category = finishReason === 'SAFETY' ? "Response blocked by Gemini's safety filters" : 'Gemini API error (empty response)';
    throw err;
  }
  return text;
}

// Each provider's own machine-readable type for "quota exhausted" or
// "rate limited", used only to pick a more specific, actionable message
// than the generic fallback -- e.category already covers this for the
// small diagnostic line, but the top-level `message` field is what most
// of the UI actually reads, and "quota exceeded, try again later" is
// meaningfully different advice from "something went wrong".
const QUOTA_OR_RATE_LIMIT_TYPES = new Set(['RESOURCE_EXHAUSTED', 'rate_limit_error', 'rate_limit_exceeded', 'insufficient_quota']);

// Resolves to the same model string the active provider's callX()
// function will actually request -- exposed so /api/health can report
// it (a model name is not a secret; useful for confirming a config
// change actually took effect without needing Vercel log access).
export function resolvedAiModel() {
  if (config.aiProvider === 'gemini') return config.geminiModel || config.aiModel || DEFAULT_GEMINI_MODEL;
  if (config.aiProvider === 'openai') return config.aiModel || DEFAULT_OPENAI_MODEL;
  if (config.aiProvider === 'anthropic') return config.aiModel || DEFAULT_ANTHROPIC_MODEL;
  return null;
}

export async function askAiTeacher({ question, language, gradeContext, subject }) {
  const lang = SUPPORTED_LANGUAGES.includes(language) ? language : 'English';
  const kbMatches = await searchKnowledgeBase({ query: question, grade: gradeContext, subject });
  const kbContext = kbMatches.map((m) => `- (${m.grade || 'general'}/${m.subject || 'general'}) ${m.topic}: ${m.content}`).join('\n');

  if (!config.isAiConfigured()) {
    return {
      configured: false,
      answer: null,
      knowledgeBaseMatches: kbMatches,
      message:
        'AI Teacher is not yet connected to an AI provider. An administrator must set AI_PROVIDER and AI_API_KEY on the server. Meanwhile, here is what the GVS knowledge base has on this topic (if anything).',
    };
  }

  try {
    const caller = config.aiProvider === 'gemini' ? callGemini : config.aiProvider === 'openai' ? callOpenAI : callAnthropic;
    const answer = await caller({ question, language: lang, gradeContext, kbContext });
    return {
      configured: true,
      answer,
      knowledgeBaseMatches: kbMatches,
      disclaimer: 'AI-generated learning assistance. Verify important academic information with official course material.',
    };
  } catch (e) {
    // e.message and e.category come from the AI provider's own error
    // response (or a plain HTTP-status string) -- never from the request
    // we sent, so neither can contain the API key. Safe to log and safe
    // to return to this already-authenticated caller.
    logger.error('ai_teacher_call_failed', { status: e.status || null, providerType: e.providerType || null, category: e.category || null, message: e.message });
    return {
      configured: true,
      answer: null,
      knowledgeBaseMatches: kbMatches,
      error: e.message,
      errorCategory: e.category || null,
      message: QUOTA_OR_RATE_LIMIT_TYPES.has(e.providerType)
        ? 'AI Teacher has reached its free-tier usage limit for now. Please try again in a few minutes -- meanwhile, here is what the GVS knowledge base has on this topic (if anything).'
        : 'The AI Teacher could not respond right now. Please try again shortly.',
    };
  }
}

export { SUPPORTED_LANGUAGES };
