import { Router } from 'express';
import db from '../lib/dataStore.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

router.get('/student', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const user = await db.get('users', req.user.sub);
  const progress = await db.findOne('progress', (p) => p.userId === req.user.sub);
  const upcomingAll = await db.list('liveClasses', (c) => String(c.grade) === String(user?.grade));
  const upcoming = upcomingAll
    .filter((c) => new Date(`${c.date}T${c.time}`) > new Date())
    .slice(0, 5);
  res.json({
    user: publicUser(user),
    progress: progress || { overall: 0, subjects: {}, completedLessons: [], quizScores: [], streakDays: 0 },
    upcomingClasses: upcoming,
  });
}));

router.get('/teacher', requireAuth, requireRole('teacher'), asyncHandler(async (req, res) => {
  const user = await db.get('users', req.user.sub);
  const myClasses = await db.list('liveClasses', (c) => (user?.classIds || []).includes(c.id));
  const myStudents = await db.list('users', (u) => u.role === 'student' && (user?.classIds || []).some((cid) => (u.classIds || []).includes(cid)));
  res.json({
    user: publicUser(user),
    classes: myClasses,
    studentCount: myStudents.length,
  });
}));

router.get('/parent', requireAuth, requireRole('parent'), asyncHandler(async (req, res) => {
  const user = await db.get('users', req.user.sub);
  const childUsers = await db.list('users', (u) => (user?.childrenIds || []).includes(u.id));
  const children = await Promise.all(childUsers.map(async (c) => {
    const progress = await db.findOne('progress', (p) => p.userId === c.id);
    return { ...publicUser(c), progress: progress || null };
  }));
  res.json({ user: publicUser(user), children });
}));

router.get('/school', requireAuth, requireRole('school', 'admin'), asyncHandler(async (req, res) => {
  const user = await db.get('users', req.user.sub);
  const schoolName = user?.school;
  const students = await db.list('users', (u) => u.role === 'student' && u.school === schoolName);
  const teachers = await db.list('users', (u) => u.role === 'teacher' && u.school === schoolName);
  res.json({
    school: schoolName,
    totals: { students: students.length, teachers: teachers.length, classes: (await db.list('liveClasses')).length },
  });
}));

export default router;
