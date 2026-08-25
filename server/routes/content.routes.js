import { Router } from 'express';
import db from '../lib/dataStore.js';

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
router.get('/grades', (_req, res) => {
  res.json({ grades: db.list('grades') });
});
router.get('/grades/:grade', (req, res) => {
  const grade = db.findOne('grades', (g) => String(g.grade) === req.params.grade);
  if (!grade) return res.status(404).json({ error: 'Grade not found.' });
  res.json({ grade });
});

// --- Updates / Announcements / Events (admin-managed, date-driven expiry) ---
router.get('/updates', (req, res) => {
  const { category } = req.query;
  const items = db
    .list('updates', (u) => published(u) && (!category || u.category === category))
    .map((u) => ({ ...u, status: effectiveStatus(u) }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ updates: items });
});

// --- Live Classes ---
router.get('/live-classes', (req, res) => {
  const now = Date.now();
  const items = db.list('liveClasses').map((c) => {
    const start = new Date(`${c.date}T${c.time || '00:00'}`).getTime();
    const end = start + (c.durationMinutes || 45) * 60000;
    let computedStatus = 'upcoming';
    if (now >= start && now <= end) computedStatus = 'live';
    else if (now > end) computedStatus = 'completed';
    return { ...c, computedStatus };
  });
  const { status } = req.query;
  res.json({ liveClasses: status ? items.filter((c) => c.computedStatus === status) : items });
});

// --- Language Academy ---
router.get('/language-courses', (_req, res) => {
  res.json({ courses: db.list('languageCourses', (c) => c.status !== 'unpublished') });
});
router.get('/language-courses/:id', (req, res) => {
  const course = db.get('languageCourses', req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  res.json({ course });
});

// --- Global search across content types ---
router.get('/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ results: [] });

  const results = [];
  for (const g of db.list('grades')) {
    for (const s of g.subjects || []) {
      if (s.name.toLowerCase().includes(q)) {
        results.push({ type: 'subject', grade: g.grade, title: `${s.name} — Grade ${g.grade}`, path: `learn/${g.grade}/${s.id}` });
      }
    }
  }
  for (const u of db.list('updates', published)) {
    if (u.title.toLowerCase().includes(q) || u.body.toLowerCase().includes(q)) {
      results.push({ type: 'update', title: u.title, path: `updates/${u.id}` });
    }
  }
  for (const c of db.list('languageCourses')) {
    if (c.name.toLowerCase().includes(q)) {
      results.push({ type: 'language-course', title: c.name, path: `languages/${c.id}` });
    }
  }
  for (const lc of db.list('liveClasses')) {
    if (lc.subject.toLowerCase().includes(q) || (lc.teacher || '').toLowerCase().includes(q)) {
      results.push({ type: 'live-class', title: `${lc.subject} — Grade ${lc.grade}`, path: `classes/${lc.id}` });
    }
  }
  res.json({ results: results.slice(0, 30) });
});

export default router;
