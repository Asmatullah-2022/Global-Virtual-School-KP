import { Router } from 'express';
import { askAiTeacher, SUPPORTED_LANGUAGES } from '../services/aiService.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

router.get('/languages', (_req, res) => res.json({ languages: SUPPORTED_LANGUAGES }));

// Auth is required so AI usage is attributable and student data isn't
// exposed to anonymous callers; the question text is the only thing sent
// to the AI provider — no student PII is included in the prompt.
// Recognized structured request modes -- each one carries an explicit,
// non-negotiable instruction appended to the prompt server-side (see
// aiService.js), rather than relying on the quick-action button's canned
// question text alone to steer the AI's output format. mcq5 is the
// strict, structurally-validated one; explain/quiz/hint/summarize are
// lighter prose-mode reinforcements for the other four quick actions.
// Anything not in this set (including undefined/omitted, i.e. a
// freeform typed question with no quick action selected) falls through
// to the exact same ungated prompt as before any mode existed.
const VALID_MODES = new Set(['mcq5', 'explain', 'quiz', 'hint', 'summarize']);

router.post('/ask', requireAuth, asyncHandler(async (req, res) => {
  const { question, language, gradeContext, subject, mode } = req.body || {};
  if (!question || !question.trim()) return res.status(400).json({ error: 'question is required.' });
  if (question.length > 2000) return res.status(400).json({ error: 'question is too long (max 2000 characters).' });

  const result = await askAiTeacher({ question: question.trim(), language, gradeContext, subject, mode: VALID_MODES.has(mode) ? mode : null });
  res.json(result);
}));

export default router;
