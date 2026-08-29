import { Router } from 'express';
import db from '../lib/dataStore.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

function isExpired(item) {
  return item.expiresAt && new Date(item.expiresAt).getTime() < Date.now();
}
function effectiveStatus(item) {
  if (item.status === 'draft') return 'draft';
  return isExpired(item) ? 'expired' : item.status || 'published';
}
function published(item) {
  return effectiveStatus(item) === 'published';
}

// --- Grades / Subjects / Chapters / Lessons (structural scaffold) ---
router.get('/grades', asyncHandler(async (_req, res) => {
  res.json({ grades: await db.list('grades') });
}));
router.get('/grades/:grade', asyncHandler(async (req, res) => {
  const grade = await db.findOne('grades', (g) => String(g.grade) === req.params.grade);
  if (!grade) return res.status(404).json({ error: 'Grade not found.' });
  res.json({ grade });
}));

// --- Video Lessons / Notes / Quizzes (admin-managed via the same generic
// collection CRUD as updates/liveClasses/languageCourses -- see
// admin.routes.js's MANAGED_COLLECTIONS). Each item carries a grade and
// subjectId so a request can scope to exactly the grade/subject the
// student is viewing, same as the grades/subjects structure above. ---
function requireGradeSubject(req, res) {
  const { grade, subject } = req.query;
  if (!grade || !subject) {
    res.status(400).json({ error: 'grade and subject query parameters are required.' });
    return null;
  }
  return { grade: String(grade), subject: String(subject) };
}
function forThisGradeSubject(item, grade, subject) {
  return published(item) && String(item.grade) === grade && item.subjectId === subject;
}

router.get('/lessons', asyncHandler(async (req, res) => {
  const gs = requireGradeSubject(req, res);
  if (!gs) return;
  const raw = await db.list('lessons', (l) => forThisGradeSubject(l, gs.grade, gs.subject));
  const items = raw.sort((a, b) => (Number(a.lessonNumber) || 0) - (Number(b.lessonNumber) || 0));
  res.json({ lessons: items });
}));

router.get('/notes', asyncHandler(async (req, res) => {
  const gs = requireGradeSubject(req, res);
  if (!gs) return;
  const items = await db.list('notes', (n) => forThisGradeSubject(n, gs.grade, gs.subject));
  res.json({ notes: items });
}));

router.get('/quizzes', asyncHandler(async (req, res) => {
  const gs = requireGradeSubject(req, res);
  if (!gs) return;
  const items = await db.list('quizzes', (q) => forThisGradeSubject(q, gs.grade, gs.subject));
  res.json({ quizzes: items });
}));

// --- Updates / Announcements / Events (admin-managed, date-driven expiry) ---
router.get('/updates', asyncHandler(async (req, res) => {
  const { category } = req.query;
  const raw = await db.list('updates', (u) => published(u) && (!category || u.category === category));
  const items = raw
    .map((u) => ({ ...u, status: effectiveStatus(u) }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ updates: items });
}));

// --- Live Classes ---
router.get('/live-classes', asyncHandler(async (req, res) => {
  const now = Date.now();
  const all = await db.list('liveClasses');
  const items = all.map((c) => {
    const start = new Date(`${c.date}T${c.time || '00:00'}`).getTime();
    const end = start + (c.durationMinutes || 45) * 60000;
    let computedStatus = 'upcoming';
    if (now >= start && now <= end) computedStatus = 'live';
    else if (now > end) computedStatus = 'completed';
    return { ...c, computedStatus };
  });
  const { status } = req.query;
  res.json({ liveClasses: status ? items.filter((c) => c.computedStatus === status) : items });
}));

// --- Language Academy ---
router.get('/language-courses', asyncHandler(async (_req, res) => {
  res.json({ courses: await db.list('languageCourses', (c) => c.status !== 'unpublished') });
}));
router.get('/language-courses/:id', asyncHandler(async (req, res) => {
  const course = await db.get('languageCourses', req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  res.json({ course });
}));

// --- Global search across content types ---
router.get('/search', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ results: [] });

  const results = [];
  const grades = await db.list('grades');
  for (const g of grades) {
    for (const s of g.subjects || []) {
      if (s.name.toLowerCase().includes(q)) {
        results.push({ type: 'subject', grade: g.grade, title: `${s.name} — Grade ${g.grade}`, path: `learn/${g.grade}/${s.id}` });
      }
    }
  }
  const updates = await db.list('updates', published);
  for (const u of updates) {
    if (u.title.toLowerCase().includes(q) || u.body.toLowerCase().includes(q)) {
      results.push({ type: 'update', title: u.title, path: `updates/${u.id}` });
    }
  }
  const courses = await db.list('languageCourses');
  for (const c of courses) {
    if (c.name.toLowerCase().includes(q)) {
      results.push({ type: 'language-course', title: c.name, path: `languages/${c.id}` });
    }
  }
  const liveClasses = await db.list('liveClasses');
  for (const lc of liveClasses) {
    if (lc.subject.toLowerCase().includes(q) || (lc.teacher || '').toLowerCase().includes(q)) {
      results.push({ type: 'live-class', title: `${lc.subject} — Grade ${lc.grade}`, path: `classes/${lc.id}` });
    }
  }
  res.json({ results: results.slice(0, 30) });
}));

export default router;
