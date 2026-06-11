const db = require('../database');
const pool = db.pool;
const dataStore = require('../dataStore');

const dedupeClasses = (classes) => {
  const seen = new Set();
  return classes.filter((classItem) => {
    const key = `${String(classItem.class_name || '').trim().toLowerCase()}|${String(classItem.section || '').trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getAllClasses = async (req, res) => {
  try {
    const filterBCA = (classItem) => !/\bBCA\b/i.test(String(classItem.class_name).trim());

    if (!db.databaseAvailable) {
      return res.json(dedupeClasses(dataStore.listClasses().filter(filterBCA)));
    }

    const [rows] = await pool.query(`
      SELECT c.class_id, c.class_name, c.section, c.teacher_id, t.full_name AS teacher_name
      FROM classes c
      LEFT JOIN teachers t ON c.teacher_id = t.teacher_id
      ORDER BY c.class_id DESC
    `);

    res.json(dedupeClasses(rows.filter(filterBCA)));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch classes', error: error.message });
  }
};

const createClass = async (req, res) => {
  const { class_name, section, teacher_id } = req.body;

  if (!class_name) {
    return res.status(400).json({ message: 'class_name is required' });
  }

  try {
    if (!db.databaseAvailable) {
      const schoolClass = dataStore.createClass({ class_name, section, teacher_id });
      return res.status(201).json({ class_id: schoolClass.class_id, message: 'Class created successfully' });
    }

    const [result] = await pool.query(
      'INSERT INTO classes (class_name, section, teacher_id) VALUES (?, ?, ?)',
      [class_name, section || null, teacher_id || null]
    );
    res.status(201).json({ class_id: result.insertId, message: 'Class created successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create class', error: error.message });
  }
};

const updateClass = async (req, res) => {
  const { id } = req.params;
  const { class_name, section, teacher_id } = req.body;

  try {
    if (!db.databaseAvailable) {
      const schoolClass = dataStore.updateClass(id, { class_name, section, teacher_id });
      if (!schoolClass) {
        return res.status(404).json({ message: 'Class not found' });
      }
      return res.json({ message: 'Class updated successfully' });
    }

    await pool.query(
      'UPDATE classes SET class_name = ?, section = ?, teacher_id = ? WHERE class_id = ?',
      [class_name, section || null, teacher_id || null, id]
    );
    res.json({ message: 'Class updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update class', error: error.message });
  }
};

const deleteClass = async (req, res) => {
  const { id } = req.params;

  try {
    if (!db.databaseAvailable) {
      dataStore.deleteClass(id);
      return res.json({ message: 'Class deleted successfully' });
    }

    await pool.query('DELETE FROM classes WHERE class_id = ?', [id]);
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete class', error: error.message });
  }
};

module.exports = { getAllClasses, createClass, updateClass, deleteClass };
