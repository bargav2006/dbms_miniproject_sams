const db = require('../database');
const pool = db.pool;
const dataStore = require('../dataStore');
const { hashPassword } = require('../utils/passwordUtils');

const getAllTeachers = async (req, res) => {
  try {
    if (!db.databaseAvailable) {
      return res.json(dataStore.listTeachers());
    }

    const [rows] = await pool.query('SELECT * FROM teachers ORDER BY teacher_id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch teachers', error: error.message });
  }
};

const createTeacher = async (req, res) => {
  const { full_name, email, phone, department, username, password, role } = req.body;

  if (!full_name || !email) {
    return res.status(400).json({ message: 'full_name and email are required' });
  }

  const teacherUsername = username || email.split('@')[0];
  const teacherPassword = password || 'password123';
  const teacherRole = role || 'teacher';

  try {
    const hashedPassword = await hashPassword(teacherPassword);

    if (!db.databaseAvailable) {
      const teacher = dataStore.createTeacher({ full_name, email, phone, department, username: teacherUsername, password: hashedPassword, role: teacherRole });
      return res.status(201).json({ teacher_id: teacher.teacher_id, message: 'Teacher created successfully' });
    }

    const [result] = await pool.query(
      'INSERT INTO teachers (username, password, full_name, email, phone, department, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [teacherUsername, hashedPassword, full_name, email, phone || null, department || null, teacherRole]
    );
    res.status(201).json({ teacher_id: result.insertId, message: 'Teacher created successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create teacher', error: error.message });
  }
};

const updateTeacher = async (req, res) => {
  const { id } = req.params;
  const { full_name, email, phone, department, username, password, role } = req.body;

  try {
    if (!db.databaseAvailable) {
      const teacher = dataStore.updateTeacher(id, { full_name, email, phone, department, username, password, role });
      if (!teacher) {
        return res.status(404).json({ message: 'Teacher not found' });
      }
      return res.json({ message: 'Teacher updated successfully' });
    }

    const fields = [];
    const values = [];
    if (username !== undefined) {
      fields.push('username = ?');
      values.push(username);
    }
    if (password !== undefined) {
      const hashedPassword = await hashPassword(password);
      fields.push('password = ?');
      values.push(hashedPassword);
    }
    if (role !== undefined) {
      fields.push('role = ?');
      values.push(role);
    }
    fields.push('full_name = ?', 'email = ?', 'phone = ?', 'department = ?');
    values.push(full_name, email, phone || null, department || null, id);

    const sql = `UPDATE teachers SET ${fields.join(', ')} WHERE teacher_id = ?`;
    await pool.query(sql, values);
    res.json({ message: 'Teacher updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update teacher', error: error.message });
  }
};

const deleteTeacher = async (req, res) => {
  const { id } = req.params;

  try {
    if (!db.databaseAvailable) {
      dataStore.deleteTeacher(id);
      return res.json({ message: 'Teacher deleted successfully' });
    }

    await pool.query('DELETE FROM teachers WHERE teacher_id = ?', [id]);
    res.json({ message: 'Teacher deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete teacher', error: error.message });
  }
};

module.exports = { getAllTeachers, createTeacher, updateTeacher, deleteTeacher };
