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
  if (!r.ok) throw new Error(data.error?.message || `AI provider error (HTTP ${r.status}).`);
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
  if (!r.ok) throw new Error(data.error?.message || `AI provider error (HTTP ${r.status}).`);
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
    logger.error('ai_teacher_call_failed', { message: e.message });
    return {
      configured: true,
      answer: null,
      knowledgeBaseMatches: kbMatches,
      error: e.message,
      message: 'The AI Teacher could not respond right now. Please try again shortly.',
    };
  }
}

export { SUPPORTED_LANGUAGES };
