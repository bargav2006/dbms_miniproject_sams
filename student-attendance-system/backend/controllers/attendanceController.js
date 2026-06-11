const db = require('../database');
const pool = db.pool;
const dataStore = require('../dataStore');

const subjectCodeToLabel = {
  'aiml12': 'AIML',
  'aiml': 'AIML',
  'AIML': 'AIML',
  'db12': 'DBMS',
  'dbms': 'DBMS',
  'DBMS': 'DBMS',
  'math12': 'Mathematics',
  'mathematics': 'Mathematics',
  'Mathematics': 'Mathematics',
  'py12': 'Python',
  'python': 'Python',
  'Python': 'Python',
  'ds12': 'Data Structures',
  'data structures': 'Data Structures',
  'Data Structures': 'Data Structures',
  'General': 'General',
  'general': 'General'
};

const subjectLabelToCodes = {
  'AIML': ['aiml12', 'aiml', 'AIML'],
  'DBMS': ['db12', 'dbms', 'DBMS'],
  'Mathematics': ['math12', 'mathematics', 'Mathematics'],
  'Python': ['py12', 'python', 'Python'],
  'Data Structures': ['ds12', 'data structures', 'Data Structures'],
  'General': ['General', 'general']
};

const normalizeSubject = (subject) => {
  if (!subject && subject !== '') return 'General';
  return subjectCodeToLabel[String(subject).trim()] || String(subject).trim();
};

const getSubjectMatchValues = (subject) => {
  const normalized = normalizeSubject(subject);
  const values = new Set([String(subject || '').trim(), normalized]);
  const normalizedLabel = String(normalized).trim();
  if (subjectLabelToCodes[normalizedLabel]) {
    subjectLabelToCodes[normalizedLabel].forEach((value) => values.add(value));
  }
  return Array.from(values).filter((value) => value !== '');
};

const convertSubjectCode = (code) => {
  return subjectCodeToLabel[code] || normalizeSubject(code);
};

const markAttendance = async (req, res) => {
  const { class_id, attendance_date, subject, records } = req.body;
  const class_number = Number(req.body.class_number || 1);
  const teacher_id = req.user.id; // Extract teacher_id from JWT token
  const normalizedSubject = String(subject || 'General').trim();

  if (!class_id || !attendance_date || !subject || !Array.isArray(records) || Number.isNaN(class_number) || class_number < 1) {
    return res.status(400).json({ message: 'class_id, class_number, attendance_date, subject, and records are required' });
  }

  try {
    dataStore.markAttendance(class_id, attendance_date, records, subject, teacher_id, class_number);

    // If DB was unavailable, try reconnecting once before giving up on SQL persistence.
    if (!db.databaseAvailable) {
      await db.checkDatabase();
    }

    if (!db.databaseAvailable) {
      return res.status(201).json({ message: 'Attendance marked successfully', recorded: records.length, subject });
    }

    let sessionInfo = { count: 0, max_edit_count: 0 };
    const sessionQuery = `
      SELECT COUNT(*) AS count, MAX(edit_count) AS max_edit_count
      FROM attendance
      WHERE class_id = ? AND class_number = ? AND attendance_date = ? AND subject = ?
    `;
    try {
      const [rows] = await pool.query(sessionQuery, [class_id, class_number, attendance_date, normalizedSubject]);
      sessionInfo = rows[0] || sessionInfo;
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR' || error.message.toLowerCase().includes('no such column: edit_count')) {
        const [rows] = await pool.query(
          `SELECT COUNT(*) AS count FROM attendance WHERE class_id = ? AND class_number = ? AND attendance_date = ? AND subject = ?`,
          [class_id, class_number, attendance_date, normalizedSubject]
        );
        sessionInfo = { count: rows[0]?.count || 0, max_edit_count: 0 };
      } else {
        throw error;
      }
    }

    if (sessionInfo.count > 0 && Number(sessionInfo.max_edit_count || 0) >= 1) {
      return res.status(409).json({ message: 'Attendance for this class, subject, and date has already been edited once.' });
    }

    const values = records.map((record) => [
      record.student_id,
      class_id,
      class_number,
      attendance_date,
      record.status || 'Present',
      record.subject || normalizedSubject,
      teacher_id,
      0,
    ]);

    if (db.dbType === 'sqlite') {
      const query = `
        INSERT INTO attendance (student_id, class_id, class_number, attendance_date, status, subject, marked_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(student_id, class_id, class_number, attendance_date, subject)
        DO UPDATE SET status = excluded.status,
                      subject = excluded.subject,
                      class_number = excluded.class_number,
                      marked_by = excluded.marked_by,
                      edit_count = 1,
                      marked_at = CURRENT_TIMESTAMP
      `;
      try {
        for (const row of values) {
          await pool.query(query, row.slice(0, 7));
        }
      } catch (error) {
        if (error.message.toLowerCase().includes('no such column: subject') || error.message.toLowerCase().includes('no such column: marked_by') || error.message.toLowerCase().includes('no such column: edit_count') || error.message.toLowerCase().includes('no such column: marked_at')) {
          const legacyQuery = `
            INSERT INTO attendance (student_id, class_id, class_number, attendance_date, status, marked_by)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(student_id, class_id, class_number, attendance_date)
            DO UPDATE SET status = excluded.status,
                          class_number = excluded.class_number,
                          marked_by = excluded.marked_by
          `;
          for (const record of records) {
            await pool.query(legacyQuery, [record.student_id, class_id, class_number, attendance_date, record.status || 'Present', teacher_id]);
          }
        } else {
          throw error;
        }
      }
    } else {
      const query = `
        INSERT INTO attendance (student_id, class_id, class_number, attendance_date, status, subject, marked_by, edit_count)
        VALUES ?
        ON DUPLICATE KEY UPDATE status = VALUES(status),
                                subject = VALUES(subject),
                                class_number = VALUES(class_number),
                                marked_by = VALUES(marked_by),
                                edit_count = GREATEST(1, VALUES(edit_count)),
                                marked_at = CURRENT_TIMESTAMP
      `;
      try {
        await pool.query(query, [values]);
      } catch (error) {
        if (error.code === 'ER_BAD_FIELD_ERROR' || error.message.toLowerCase().includes('no such column: subject') || error.message.toLowerCase().includes('no such column: marked_by') || error.message.toLowerCase().includes('no such column: edit_count') || error.message.toLowerCase().includes('no such column: marked_at')) {
          const legacyValues = records.map((record) => [record.student_id, class_id, class_number, attendance_date, record.status || 'Present', teacher_id]);
          const fallbackQuery = `
            INSERT INTO attendance (student_id, class_id, class_number, attendance_date, status, marked_by)
            VALUES ?
            ON DUPLICATE KEY UPDATE status = VALUES(status),
                                    class_number = VALUES(class_number),
                                    marked_by = VALUES(marked_by),
                                    marked_at = CURRENT_TIMESTAMP
          `;
          await pool.query(fallbackQuery, [legacyValues]);
        } else {
          throw error;
        }
      }
    }

    res.status(201).json({ message: 'Attendance marked successfully', recorded: values.length, subject });
  } catch (error) {
    if (error.message && error.message.includes('already edited once')) {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to mark attendance', error: error.message });
  }
};

const getDailyAttendance = async (req, res) => {
  const { date } = req.query;
  const selectedDate = date || new Date().toISOString().split('T')[0];

  try {
    const fallbackRows = dataStore.getDailyAttendance(selectedDate);

    if (!db.databaseAvailable) {
      await db.checkDatabase();
    }

    if (!db.databaseAvailable) {
      return res.json(fallbackRows);
    }

    let rows;
    try {
      const result = await pool.query(`
        SELECT a.attendance_id, a.student_id, a.class_id, a.class_number, a.attendance_date, a.status, COALESCE(a.subject, 'General') AS subject, a.edit_count, s.full_name, s.roll_number, c.class_name, c.section
        FROM attendance a
        JOIN students s ON a.student_id = s.student_id
        JOIN classes c ON a.class_id = c.class_id
        WHERE a.attendance_date = ?
        ORDER BY a.attendance_id DESC
      `, [selectedDate]);
      rows = result[0];
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR' || error.message.toLowerCase().includes('no such column: subject') || error.message.toLowerCase().includes('no such column: edit_count')) {
        const result = await pool.query(`
        SELECT a.attendance_id, a.student_id, a.class_id, a.class_number, a.attendance_date, a.status, s.full_name, s.roll_number, c.class_name, c.section
        FROM attendance a
        JOIN students s ON a.student_id = s.student_id
        JOIN classes c ON a.class_id = c.class_id
        WHERE a.attendance_date = ?
        ORDER BY a.attendance_id DESC
      `, [selectedDate]);
        rows = result[0].map((row) => ({ ...row, subject: 'General', class_number: row.class_number || 1, edit_count: 0 }));
      } else {
        throw error;
      }
    }

    const mergedRows = [...fallbackRows];
    const fallbackKeys = new Set(fallbackRows.map((row) => `${row.student_id}-${row.class_id}-${row.class_number || 1}-${row.attendance_date}-${row.subject || 'General'}`));

    rows.forEach((row) => {
      const key = `${row.student_id}-${row.class_id}-${row.class_number || 1}-${row.attendance_date}-${row.subject}`;
      if (!fallbackKeys.has(key)) {
        mergedRows.push(row);
      }
    });

    res.json(mergedRows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch daily attendance', error: error.message });
  }
};

const getAttendanceReport = async (req, res) => {
  const { student_id, start_date, end_date, subject } = req.query;

  if (!student_id) {
    return res.status(400).json({ message: 'student_id is required' });
  }

  try {
    if (!db.databaseAvailable) {
      await db.checkDatabase();
    }

    if (!db.databaseAvailable) {
      return res.json(dataStore.getAttendanceReport(student_id, start_date, end_date, subject));
    }

    const studentQueryByIdOrRoll = `
      SELECT student_id, full_name, roll_number
      FROM students
      WHERE student_id = ? OR roll_number = ?
      LIMIT 1
    `;
    const [studentRows] = await pool.query(studentQueryByIdOrRoll, [student_id, student_id]);
    const student = studentRows[0] || { student_id: student_id, full_name: null, roll_number: null };

    const conditions = ['(s.student_id = ? OR s.roll_number = ?)'];
    const params = [student_id, student_id];
    if (start_date) {
      conditions.push('a.attendance_date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('a.attendance_date <= ?');
      params.push(end_date);
    }
    if (subject) {
      const matchValues = getSubjectMatchValues(subject);
      const placeholders = matchValues.map(() => '?').join(',');
      conditions.push(`LOWER(COALESCE(a.subject, 'General')) IN (${placeholders})`);
      params.push(...matchValues.map((value) => value.toLowerCase()));
    }

    let rows;
    try {
      const result = await pool.query(`
        SELECT COALESCE(a.subject, 'General') AS subject,
               a.class_number,
               a.attendance_date,
               SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_count,
               COUNT(a.attendance_id) AS total_count,
               ROUND((SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) / NULLIF(COUNT(a.attendance_id), 0)) * 100, 2) AS attendance_percentage
        FROM students s
        LEFT JOIN attendance a ON s.student_id = a.student_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY COALESCE(a.subject, 'General'), a.class_number, a.attendance_date
        ORDER BY a.attendance_date ASC, a.class_number ASC, subject
      `, params);
      rows = result[0];
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR' || error.message.toLowerCase().includes('no such column: subject')) {
        const fallbackParams = [student_id, student_id];
        const fallbackConditions = ['(s.student_id = ? OR s.roll_number = ?)'];
        if (start_date) {
          fallbackConditions.push('a.attendance_date >= ?');
          fallbackParams.push(start_date);
        }
        if (end_date) {
          fallbackConditions.push('a.attendance_date <= ?');
          fallbackParams.push(end_date);
        }
        const result = await pool.query(`
          SELECT a.class_number,
                 a.attendance_date,
                 SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_count,
                 COUNT(a.attendance_id) AS total_count,
                 ROUND((SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) / NULLIF(COUNT(a.attendance_id), 0)) * 100, 2) AS attendance_percentage
          FROM students s
          LEFT JOIN attendance a ON s.student_id = a.student_id
          WHERE ${fallbackConditions.join(' AND ')}
          GROUP BY a.class_number, a.attendance_date
        `, fallbackParams);
        const fallbackRow = result[0][0] || { present_count: 0, total_count: 0, attendance_percentage: 0, class_number: 1, attendance_date: null };
        rows = [{
          subject: 'General',
          class_number: fallbackRow.class_number || 1,
          attendance_date: fallbackRow.attendance_date || null,
          present_count: Number(fallbackRow.present_count || 0),
          total_count: Number(fallbackRow.total_count || 0),
          attendance_percentage: Number(fallbackRow.attendance_percentage || 0),
        }];
      } else {
        throw error;
      }
    }

    const totalCount = rows.reduce((sum, row) => sum + Number(row.total_count || 0), 0);
    const presentCount = rows.reduce((sum, row) => sum + Number(row.present_count || 0), 0);
    const attendancePercentage = totalCount === 0 ? 0 : Number(((presentCount / totalCount) * 100).toFixed(2));

    res.json({
      student_id: student.student_id,
      full_name: student.full_name,
      roll_number: student.roll_number,
      present_count: presentCount,
      total_count: totalCount,
      attendance_percentage: attendancePercentage,
      selected_subject: subject || null,
      subject_breakdown: rows.map((row) => ({
        subject: convertSubjectCode(row.subject),
        class_number: row.class_number || 1,
        attendance_date: row.attendance_date || null,
        present_count: Number(row.present_count || 0),
        total_count: Number(row.total_count || 0),
        attendance_percentage: Number(row.attendance_percentage || 0),
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch attendance report', error: error.message });
  }
};

const calculateSubjectMarksResult = (ia1, ia2, ia3) => {
  const scores = [Number(ia1), Number(ia2), Number(ia3)].sort((a, b) => b - a);
  const bestTwoAverage = Number((scores.slice(0, 2).reduce((sum, value) => sum + value, 0) / 2).toFixed(2));
  return {
    best_two_average: bestTwoAverage,
    status: bestTwoAverage >= 10 ? 'Pass' : 'Fail',
  };
};

const saveSubjectMarks = async (req, res) => {
  const { student_id, subject, ia1, ia2, ia3 } = req.body;

  if (!student_id || !subject) {
    return res.status(400).json({ message: 'student_id and subject are required' });
  }

  const parsedScores = [ia1, ia2, ia3].map((value, index) => {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      throw new Error(`IA${index + 1} must be numeric`);
    }
    if (numericValue < 0 || numericValue > 25) {
      throw new Error(`IA${index + 1} must be between 0 and 25`);
    }
    return numericValue;
  });

  try {
    const result = calculateSubjectMarksResult(...parsedScores);

    if (!db.databaseAvailable) {
      const saved = dataStore.saveSubjectMarks(student_id, subject, parsedScores[0], parsedScores[1], parsedScores[2]);
      if (!saved) {
        return res.status(404).json({ message: 'Student not found' });
      }
      return res.status(201).json(saved);
    }

    const [existing] = await pool.query('SELECT mark_id FROM student_subject_marks WHERE student_id = ? AND subject = ?', [student_id, subject]);

    if (existing.length) {
      await pool.query(
        'UPDATE student_subject_marks SET ia1 = ?, ia2 = ?, ia3 = ?, best_two_average = ?, status = ? WHERE mark_id = ?',
        [parsedScores[0], parsedScores[1], parsedScores[2], result.best_two_average, result.status, existing[0].mark_id]
      );
    } else {
      await pool.query(
        'INSERT INTO student_subject_marks (student_id, subject, ia1, ia2, ia3, best_two_average, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [student_id, subject, parsedScores[0], parsedScores[1], parsedScores[2], result.best_two_average, result.status]
      );
    }

    const [rows] = await pool.query(
      'SELECT student_id, subject, ia1, ia2, ia3, best_two_average, status, updated_at FROM student_subject_marks WHERE student_id = ? AND subject = ? ORDER BY mark_id DESC LIMIT 1',
      [student_id, subject]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.message.includes('IA')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to save subject marks', error: error.message });
  }
};

const getSubjectMarks = async (req, res) => {
  const { student_id, subject } = req.query;

  if (!student_id) {
    return res.status(400).json({ message: 'student_id is required' });
  }

  try {
    if (!db.databaseAvailable) {
      return res.json(dataStore.getSubjectMarks(student_id, subject));
    }

    const query = `
      SELECT sm.student_id, s.full_name, s.roll_number, sm.subject, sm.ia1, sm.ia2, sm.ia3, sm.best_two_average, sm.status, sm.updated_at
      FROM student_subject_marks sm
      JOIN students s ON sm.student_id = s.student_id
      WHERE (s.student_id = ? OR s.roll_number = ?)
      ${subject ? 'AND sm.subject = ?' : ''}
      ORDER BY sm.subject
    `;
    const params = [student_id, student_id];
    if (subject) params.push(subject);

    const [rows] = await pool.query(query, params);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch subject marks', error: error.message });
  }
};

const getLowAttendanceStudents = async (req, res) => {
  try {
    if (!db.databaseAvailable) {
      return res.json(dataStore.getLowAttendanceStudents());
    }

    const [rows] = await pool.query(`
      SELECT s.student_id, s.roll_number, s.full_name, c.class_name, c.section,
             ROUND((SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) / NULLIF(COUNT(a.attendance_id), 0)) * 100, 2) AS attendance_percentage
      FROM students s
      LEFT JOIN attendance a ON s.student_id = a.student_id
      LEFT JOIN classes c ON s.class_id = c.class_id
      GROUP BY s.student_id, s.roll_number, s.full_name, c.class_name, c.section
      HAVING attendance_percentage < 75 OR attendance_percentage IS NULL
      ORDER BY attendance_percentage ASC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch low attendance students', error: error.message });
  }
};

const getSummary = async (req, res) => {
  try {
    if (!db.databaseAvailable) {
      return res.json(dataStore.getSummary());
    }

    const [studentCount] = await pool.query('SELECT COUNT(*) AS total_students FROM students');
    const [todayAttendance] = await pool.query(
      "SELECT COUNT(*) AS present_today FROM attendance WHERE attendance_date = CURDATE() AND status = 'Present'"
    );
    const [lowAttendance] = await pool.query(`
      SELECT ROUND((COUNT(*) / NULLIF((SELECT COUNT(*) FROM students), 0)) * 100, 2) AS low_attendance_percentage
      FROM (
        SELECT s.student_id
        FROM students s
        LEFT JOIN attendance a ON s.student_id = a.student_id
        GROUP BY s.student_id
        HAVING ROUND((SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) / NULLIF(COUNT(a.attendance_id), 0)) * 100, 2) < 75
           OR COUNT(a.attendance_id) = 0
      ) low
    `);

    res.json({
      total_students: studentCount[0]?.total_students || 0,
      present_today: todayAttendance[0]?.present_today || 0,
      low_attendance_percentage: lowAttendance[0]?.low_attendance_percentage || 0,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch summary', error: error.message });
  }
};

module.exports = {
  markAttendance,
  getDailyAttendance,
  getAttendanceReport,
  saveSubjectMarks,
  getSubjectMarks,
  getLowAttendanceStudents,
  getSummary,
};
