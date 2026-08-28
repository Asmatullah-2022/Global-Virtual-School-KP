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
// return to the (already-authenticated) caller. Mapping the type to a
// plain-language category here means a failure can be diagnosed from the
// browser alone, without Vercel dashboard/log access.
const ANTHROPIC_ERROR_CATEGORIES = {
  authentication_error: 'Invalid or revoked API key',
  permission_error: 'API key does not have permission to use this model',
  not_found_error: 'Requested model was not found (check AI_MODEL)',
  rate_limit_error: 'Rate limited by the AI provider',
  invalid_request_error: 'Request rejected by the AI provider (see message -- often a credit/billing issue)',
  overloaded_error: 'AI provider is temporarily overloaded',
  api_error: 'AI provider internal error',
};

const OPENAI_ERROR_CATEGORIES = {
  invalid_api_key: 'Invalid or revoked API key',
  insufficient_quota: 'API key has no remaining credits/quota',
  model_not_found: 'Requested model was not found (check AI_MODEL)',
  rate_limit_exceeded: 'Rate limited by the AI provider',
};

function providerError(data, status, categories) {
  const providerType = data.error?.type || data.error?.code || null;
  const err = new Error(data.error?.message || `AI provider error (HTTP ${status}).`);
  err.status = status;
  err.providerType = providerType;
  err.category = (providerType && categories[providerType]) || `AI provider returned HTTP ${status}`;
  return err;
}

async function callAnthropic({ question, language, gradeContext, kbContext }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.aiApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.aiModel || 'claude-sonnet-5',
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
  });
  const data = await r.json();
  if (!r.ok) throw providerError(data, r.status, ANTHROPIC_ERROR_CATEGORIES);
  return data.content?.[0]?.text || '';
}

async function callOpenAI({ question, language, gradeContext, kbContext }) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.aiApiKey}`,
    },
    body: JSON.stringify({
      model: config.aiModel || 'gpt-4o-mini',
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
  });
  const data = await r.json();
  if (!r.ok) throw providerError(data, r.status, OPENAI_ERROR_CATEGORIES);
  return data.choices?.[0]?.message?.content || '';
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
    const caller = config.aiProvider === 'openai' ? callOpenAI : callAnthropic;
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
      message: 'The AI Teacher could not respond right now. Please try again shortly.',
    };
  }
}

export { SUPPORTED_LANGUAGES };
