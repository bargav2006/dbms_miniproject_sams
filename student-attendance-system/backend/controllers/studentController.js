const db = require('../database');
const pool = db.pool;
const dataStore = require('../dataStore');
const { hashPassword } = require('../utils/passwordUtils');

const getAllStudents = async (req, res) => {
  const { class_id } = req.query;
  
  try {
    if (!db.databaseAvailable) {
      let students = dataStore.listStudents();
      if (class_id) {
        students = students.filter(s => s.class_id === Number(class_id));
      }
      return res.json(students);
    }

    let query = `
      SELECT s.student_id, s.roll_number, s.full_name, s.email, s.phone, c.class_id, c.class_name, c.section
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.class_id
    `;
    const params = [];
    
    if (class_id) {
      query += ` WHERE s.class_id = ?`;
      params.push(Number(class_id));
    }
    
    query += ` ORDER BY s.student_id DESC`;
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch students', error: error.message });
  }
};

const createStudent = async (req, res) => {
  const { roll_number, full_name, class_id, email, phone, username, password, role } = req.body;

  if (!roll_number || !full_name) {
    return res.status(400).json({ message: 'roll_number and full_name are required' });
  }

  const studentUsername = username || roll_number;
  const studentPassword = password || 'password123';
  const studentRole = role || 'student';
  const studentId = String(roll_number);

  try {
    const hashedPassword = await hashPassword(studentPassword);

    if (!db.databaseAvailable) {
      const student = dataStore.createStudent({ student_id: studentId, roll_number, full_name, class_id, email, phone, username: studentUsername, password: hashedPassword, role: studentRole });
      return res.status(201).json({ student_id: student.student_id, message: 'Student created successfully' });
    }

    await pool.query(
      'INSERT INTO students (student_id, username, password, roll_number, full_name, class_id, email, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [studentId, studentUsername, hashedPassword, roll_number, full_name, class_id || null, email || null, phone || null, studentRole]
    );
    res.status(201).json({ student_id: studentId, message: 'Student created successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create student', error: error.message });
  }
};

const updateStudent = async (req, res) => {
  const { id } = req.params;
  const { roll_number, full_name, class_id, email, phone, username, password, role } = req.body;

  try {
    if (!db.databaseAvailable) {
      const student = dataStore.updateStudent(id, { roll_number, full_name, class_id, email, phone, username, password, role });
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }
      return res.json({ message: 'Student updated successfully' });
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
    fields.push('roll_number = ?', 'full_name = ?', 'class_id = ?', 'email = ?', 'phone = ?');
    values.push(roll_number, full_name, class_id || null, email || null, phone || null, id);

    const sql = `UPDATE students SET ${fields.join(', ')} WHERE student_id = ?`;
    await pool.query(sql, values);
    res.json({ message: 'Student updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update student', error: error.message });
  }
};

const deleteStudent = async (req, res) => {
  const { id } = req.params;

  try {
    if (!db.databaseAvailable) {
      dataStore.deleteStudent(id);
      return res.json({ message: 'Student deleted successfully' });
    }

    await pool.query('DELETE FROM students WHERE student_id = ?', [id]);
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete student', error: error.message });
  }
};

module.exports = { getAllStudents, createStudent, updateStudent, deleteStudent };
