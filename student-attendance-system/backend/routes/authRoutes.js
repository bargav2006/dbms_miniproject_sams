const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../database');
const pool = db.pool;
const dataStore = require('../dataStore');
const { verifyPassword } = require('../utils/passwordUtils');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

const roleMatches = (requestedRole, actualRole) => {
  if (!requestedRole || !actualRole) return false;
  if (requestedRole === 'admin') return actualRole === 'admin';
  if (requestedRole === 'teacher') return actualRole === 'teacher' || actualRole === 'admin';
  if (requestedRole === 'student') return actualRole === 'student';
  return false;
};

const normalizeRoleQuery = (roleField, fallback) => `COALESCE(${roleField}, '${fallback}') AS role`;

// Login route - handles student, teacher, and admin login
router.post('/login', async (req, res) => {
  const { username, password, role } = req.body;
  const rawUsername = typeof username === 'number' ? String(username) : (username || '');
  const rawPassword = password || '';
  const loginIdOrUsername = rawUsername.toString().trim();
  const loginPassword = rawPassword.toString().trim();

  if (!loginIdOrUsername || !loginPassword || !role) {
    return res.status(400).json({ message: 'Username/ID, password, and role are required' });
  }

  try {
    await db.checkDatabase();
    const isNumericId = /^\d+$/.test(loginIdOrUsername);
    const useFallback = !db.databaseAvailable;

    if (role === 'student') {
      let student;
      if (!useFallback) {
        const studentQuery = isNumericId
          ? `SELECT student_id, username, full_name, email, roll_number, class_id, password, ${normalizeRoleQuery('role', 'student')} FROM students WHERE student_id = ?`
          : `SELECT student_id, username, full_name, email, roll_number, class_id, password, ${normalizeRoleQuery('role', 'student')} FROM students WHERE (username = ? OR email = ?)`;
        try {
          const [students] = await pool.query(studentQuery, isNumericId ? [Number(loginIdOrUsername)] : [loginIdOrUsername, loginIdOrUsername]);
          student = students[0];
        } catch (innerError) {
          const [students] = await pool.query(
            `SELECT student_id, username, full_name, email, roll_number, class_id, password FROM students WHERE ${isNumericId ? 'student_id = ?' : '(username = ? OR email = ?)'}`,
            isNumericId ? [Number(loginIdOrUsername)] : [loginIdOrUsername, loginIdOrUsername]
          );
          student = students[0];
        }
      } else {
        student = dataStore.memoryDB.students.find((s) => {
          const matchesId = isNumericId
            ? Number(loginIdOrUsername) === s.student_id
            : loginIdOrUsername === s.username || loginIdOrUsername === s.roll_number || loginIdOrUsername === s.email;
          return matchesId;
        });
      }

      if (!student || !await verifyPassword(loginPassword, student.password)) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const actualRole = student.role || 'student';
      if (!roleMatches(role, actualRole)) {
        return res.status(403).json({ message: 'Access denied for this role' });
      }

      const token = jwt.sign(
        { id: student.student_id, username: student.username, role: actualRole, classId: student.class_id },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        message: 'Login successful',
        token,
        role: actualRole,
        user: {
          id: student.student_id,
          username: student.username,
          fullName: student.full_name,
          email: student.email,
          rollNumber: student.roll_number,
          classId: student.class_id,
          role: actualRole,
        }
      });
    }

    if (role === 'teacher' || role === 'admin') {
      let teacher;
      if (!useFallback) {
        const teacherQuery = isNumericId
          ? `SELECT teacher_id, username, full_name, email, department, password, ${normalizeRoleQuery('role', 'teacher')} FROM teachers WHERE teacher_id = ?`
          : `SELECT teacher_id, username, full_name, email, department, password, ${normalizeRoleQuery('role', 'teacher')} FROM teachers WHERE (username = ? OR email = ?)`;
        try {
          const [teachers] = await pool.query(teacherQuery, isNumericId ? [Number(loginIdOrUsername)] : [loginIdOrUsername, loginIdOrUsername]);
          teacher = teachers[0];
        } catch (innerError) {
          const [teachers] = await pool.query(
            `SELECT teacher_id, username, full_name, email, department, password FROM teachers WHERE ${isNumericId ? 'teacher_id = ?' : '(username = ? OR email = ?)'}`,
            isNumericId ? [Number(loginIdOrUsername)] : [loginIdOrUsername, loginIdOrUsername]
          );
          teacher = teachers[0];
        }
      } else {
        teacher = dataStore.memoryDB.teachers.find((t) => {
          const matchesId = isNumericId
            ? Number(loginIdOrUsername) === t.teacher_id
            : loginIdOrUsername === t.username || loginIdOrUsername === t.email;
          return matchesId;
        });
      }

      if (!teacher || !await verifyPassword(loginPassword, teacher.password)) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const actualRole = teacher.role || 'teacher';
      if (!roleMatches(role, actualRole)) {
        return res.status(403).json({ message: 'Access denied for this role' });
      }

      const token = jwt.sign(
        { id: teacher.teacher_id, username: teacher.username, role: actualRole },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        message: 'Login successful',
        token,
        role: actualRole,
        user: {
          id: teacher.teacher_id,
          username: teacher.username,
          fullName: teacher.full_name,
          email: teacher.email,
          department: teacher.department,
          role: actualRole,
        }
      });
    }

    return res.status(400).json({ message: 'Invalid role' });
  } catch (error) {
    console.error('Login error:', error);
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(500).json({
        message: 'Database schema mismatch detected. Please import schema.sql or run `npm run migrate-mysql`.',
        error: error.message,
      });
    }
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// Verify token route
router.post('/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

module.exports = router;
