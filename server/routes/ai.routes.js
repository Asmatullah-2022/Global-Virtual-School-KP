import { Router } from 'express';
import { askAiTeacher, SUPPORTED_LANGUAGES } from '../services/aiService.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/languages', (_req, res) => res.json({ languages: SUPPORTED_LANGUAGES }));

// Auth is required so AI usage is attributable and student data isn't
// exposed to anonymous callers; the question text is the only thing sent
// to the AI provider — no student PII is included in the prompt.
router.post('/ask', requireAuth, async (req, res) => {
  const { question, language, gradeContext, subject } = req.body || {};
  if (!question || !question.trim()) return res.status(400).json({ error: 'question is required.' });
  if (question.length > 2000) return res.status(400).json({ error: 'question is too long (max 2000 characters).' });

  const result = await askAiTeacher({ question: question.trim(), language, gradeContext, subject });
  res.json(result);
});

export default router;
