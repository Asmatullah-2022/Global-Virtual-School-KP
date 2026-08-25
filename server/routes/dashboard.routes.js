import { Router } from 'express';
import db from '../lib/dataStore.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

router.get('/student', requireAuth, requireRole('student'), (req, res) => {
  const user = db.get('users', req.user.sub);
  const progress = db.findOne('progress', (p) => p.userId === req.user.sub);
  const upcoming = db
    .list('liveClasses', (c) => String(c.grade) === String(user?.grade))
    .filter((c) => new Date(`${c.date}T${c.time}`) > new Date())
    .slice(0, 5);
  res.json({
    user: publicUser(user),
    progress: progress || { overall: 0, subjects: {}, completedLessons: [], quizScores: [], streakDays: 0 },
    upcomingClasses: upcoming,
  });
});

router.get('/teacher', requireAuth, requireRole('teacher'), (req, res) => {
  const user = db.get('users', req.user.sub);
  const myClasses = db.list('liveClasses', (c) => (user?.classIds || []).includes(c.id));
  const myStudents = db.list('users', (u) => u.role === 'student' && (user?.classIds || []).some((cid) => (u.classIds || []).includes(cid)));
  res.json({
    user: publicUser(user),
    classes: myClasses,
    studentCount: myStudents.length,
  });
});

router.get('/parent', requireAuth, requireRole('parent'), (req, res) => {
  const user = db.get('users', req.user.sub);
  const children = db.list('users', (u) => (user?.childrenIds || []).includes(u.id)).map((c) => {
    const progress = db.findOne('progress', (p) => p.userId === c.id);
    return { ...publicUser(c), progress: progress || null };
  });
  res.json({ user: publicUser(user), children });
});

router.get('/school', requireAuth, requireRole('school', 'admin'), (req, res) => {
  const user = db.get('users', req.user.sub);
  const schoolName = user?.school;
  const students = db.list('users', (u) => u.role === 'student' && u.school === schoolName);
  const teachers = db.list('users', (u) => u.role === 'teacher' && u.school === schoolName);
  res.json({
    school: schoolName,
    totals: { students: students.length, teachers: teachers.length, classes: db.list('liveClasses').length },
  });
});

export default router;
