require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const SCHEMA_FILE = path.join(__dirname, '..', 'schema.sql');
const PERSISTENCE_FILE = path.join(__dirname, 'data-store.json');

const dbConfigNoDB = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  multipleStatements: true,
};

const dbName = process.env.DB_NAME || 'sams';

const getTableColumns = async (pool, tableName) => {
  const [rows] = await pool.query(
    'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
    [dbName, tableName]
  );
  return rows.map((row) => row.COLUMN_NAME.toLowerCase());
};

const ensureAttendanceColumns = async (pool) => {
  const attendanceColumns = await getTableColumns(pool, 'attendance');
  if (!attendanceColumns.includes('subject')) {
    await pool.query("ALTER TABLE attendance ADD COLUMN subject VARCHAR(100) NOT NULL DEFAULT 'General' AFTER attendance_date");
  }
  if (!attendanceColumns.includes('marked_by')) {
    await pool.query('ALTER TABLE attendance ADD COLUMN marked_by INT NULL AFTER subject');
  }
  if (!attendanceColumns.includes('marked_at')) {
    await pool.query('ALTER TABLE attendance ADD COLUMN marked_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER marked_by');
  }
  if (!attendanceColumns.includes('edit_count')) {
    await pool.query('ALTER TABLE attendance ADD COLUMN edit_count INT NOT NULL DEFAULT 0 AFTER marked_at');
  }
};

const ensureLoginColumns = async (pool) => {
  const teacherColumns = await getTableColumns(pool, 'teachers');
  if (!teacherColumns.includes('username')) {
    await pool.query("ALTER TABLE teachers ADD COLUMN username VARCHAR(50) UNIQUE DEFAULT '' AFTER teacher_id");
  } else {
    const [colInfo] = await pool.query(
      'SELECT COLUMN_DEFAULT, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [dbName, 'teachers', 'username']
    );
    if (colInfo && colInfo[0] && (colInfo[0].COLUMN_DEFAULT === null || colInfo[0].COLUMN_DEFAULT === undefined)) {
      await pool.query("ALTER TABLE teachers MODIFY COLUMN username VARCHAR(50) NOT NULL DEFAULT ''");
    }
  }
  if (!teacherColumns.includes('password')) {
    await pool.query("ALTER TABLE teachers ADD COLUMN password VARCHAR(255) DEFAULT 'password123' AFTER username");
  } else {
    const [colInfo2] = await pool.query(
      'SELECT COLUMN_DEFAULT, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [dbName, 'teachers', 'password']
    );
    if (colInfo2 && colInfo2[0] && (colInfo2[0].COLUMN_DEFAULT === null || colInfo2[0].COLUMN_DEFAULT === undefined)) {
      await pool.query("ALTER TABLE teachers MODIFY COLUMN password VARCHAR(255) NOT NULL DEFAULT 'password123'");
    }
  }
  if (!teacherColumns.includes('role')) {
    await pool.query("ALTER TABLE teachers ADD COLUMN role ENUM('teacher','admin') NOT NULL DEFAULT 'teacher' AFTER department");
  } else {
    const [colInfoRole] = await pool.query(
      'SELECT COLUMN_DEFAULT, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [dbName, 'teachers', 'role']
    );
    if (colInfoRole && colInfoRole[0] && (colInfoRole[0].COLUMN_DEFAULT === null || colInfoRole[0].COLUMN_DEFAULT === undefined)) {
      await pool.query("ALTER TABLE teachers MODIFY COLUMN role ENUM('teacher','admin') NOT NULL DEFAULT 'teacher'");
    }
  }
  await pool.query(
    "UPDATE teachers SET username = LOWER(SUBSTRING_INDEX(email, '@', 1)) WHERE username IS NULL OR username = ''"
  );
  await pool.query("UPDATE teachers SET password = 'password123' WHERE password IS NULL OR password = ''");
  await pool.query("UPDATE teachers SET role = 'teacher' WHERE role IS NULL OR role = ''");

  const studentColumns = await getTableColumns(pool, 'students');
  if (!studentColumns.includes('username')) {
    await pool.query("ALTER TABLE students ADD COLUMN username VARCHAR(50) UNIQUE DEFAULT '' AFTER student_id");
  } else {
    const [colInfo3] = await pool.query(
      'SELECT COLUMN_DEFAULT, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [dbName, 'students', 'username']
    );
    if (colInfo3 && colInfo3[0] && (colInfo3[0].COLUMN_DEFAULT === null || colInfo3[0].COLUMN_DEFAULT === undefined)) {
      await pool.query("ALTER TABLE students MODIFY COLUMN username VARCHAR(50) NOT NULL DEFAULT ''");
    }
  }
  if (!studentColumns.includes('password')) {
    await pool.query("ALTER TABLE students ADD COLUMN password VARCHAR(255) DEFAULT 'password123' AFTER username");
  } else {
    const [colInfo4] = await pool.query(
      'SELECT COLUMN_DEFAULT, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [dbName, 'students', 'password']
    );
    if (colInfo4 && colInfo4[0] && (colInfo4[0].COLUMN_DEFAULT === null || colInfo4[0].COLUMN_DEFAULT === undefined)) {
      await pool.query("ALTER TABLE students MODIFY COLUMN password VARCHAR(255) NOT NULL DEFAULT 'password123'");
    }
  }
  if (!studentColumns.includes('role')) {
    await pool.query("ALTER TABLE students ADD COLUMN role ENUM('student','admin') NOT NULL DEFAULT 'student' AFTER phone");
  } else {
    const [colInfoRole2] = await pool.query(
      'SELECT COLUMN_DEFAULT, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [dbName, 'students', 'role']
    );
    if (colInfoRole2 && colInfoRole2[0] && (colInfoRole2[0].COLUMN_DEFAULT === null || colInfoRole2[0].COLUMN_DEFAULT === undefined)) {
      await pool.query("ALTER TABLE students MODIFY COLUMN role ENUM('student','admin') NOT NULL DEFAULT 'student'");
    }
  }

  // Ensure created_at exists on common tables to support data migration inserts
  const ensureCreatedAt = async (tableName) => {
    const cols = await getTableColumns(pool, tableName);
    if (!cols.includes('created_at')) {
      await pool.query(`ALTER TABLE ${tableName} ADD COLUMN created_at TIMESTAMP NULL DEFAULT NULL`);
    }
  };

  await ensureCreatedAt('teachers');
  await ensureCreatedAt('classes');
  await ensureCreatedAt('students');
  await pool.query(
    "UPDATE students SET username = LOWER(CONCAT(REPLACE(full_name, ' ', '_'), '_', roll_number)) WHERE username IS NULL OR username = ''"
  );
  await pool.query("UPDATE students SET password = 'password123' WHERE password IS NULL OR password = ''");
  await pool.query("UPDATE students SET role = 'student' WHERE role IS NULL OR role = ''");
};

(async () => {
  try {
    if (!fs.existsSync(SCHEMA_FILE)) {
      console.error('schema.sql not found');
      process.exit(1);
    }

    const schemaSql = fs.readFileSync(SCHEMA_FILE, 'utf-8');

    // Ensure database exists first (connect without database)
    const conn = await mysql.createConnection(dbConfigNoDB);
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await conn.end();

    console.log('Database ensured. Connecting to target DB...');

    const pool = mysql.createPool({
      ...dbConfigNoDB,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
    });

    // Run CREATE statements first so tables exist before inserts/updates
    const statements = schemaSql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    const createStmts = statements.filter(s => /^CREATE\s+/i.test(s) || /^USE\s+/i.test(s));
    const otherStmts = statements.filter(s => !createStmts.includes(s));

    for (const stmt of createStmts) {
      try {
        await pool.query(stmt);
      } catch (err) {
        console.warn('Ignored error running CREATE statement:', err.message);
      }
    }

    // Ensure username/password columns exist (for older schemas)
    await ensureLoginColumns(pool);
    await ensureAttendanceColumns(pool);

    // Run remaining statements (inserts, alters, etc.) now that tables/cols exist
    for (const stmt of otherStmts) {
      try {
        await pool.query(stmt);
      } catch (err) {
        console.warn('Ignored error running statement:', err.message);
      }
    }

    if (!fs.existsSync(PERSISTENCE_FILE)) {
      console.log('No persisted fallback file to migrate:', PERSISTENCE_FILE);
      await pool.end();
      return;
    }

    const raw = fs.readFileSync(PERSISTENCE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const memoryDB = parsed.memoryDB || {};

    // Insert teachers
    if (Array.isArray(memoryDB.teachers)) {
      for (const t of memoryDB.teachers) {
        await pool.query(
          `INSERT INTO teachers (teacher_id, full_name, email, phone, department, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), phone = VALUES(phone), department = VALUES(department)`,
          [t.teacher_id, t.full_name, t.email, t.phone || null, t.department || null, t.created_at || null]
        );
      }
    }

    // Insert classes
    if (Array.isArray(memoryDB.classes)) {
      for (const c of memoryDB.classes) {
        await pool.query(
          `INSERT INTO classes (class_id, class_name, section, teacher_id, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE class_name = VALUES(class_name), section = VALUES(section), teacher_id = VALUES(teacher_id)`,
          [c.class_id, c.class_name, c.section || null, c.teacher_id || null, c.created_at || null]
        );
      }
    }

    // Insert students
    if (Array.isArray(memoryDB.students)) {
      for (const s of memoryDB.students) {
        await pool.query(
          `INSERT INTO students (student_id, roll_number, full_name, class_id, email, phone, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), class_id = VALUES(class_id), email = VALUES(email), phone = VALUES(phone)`,
          [s.student_id, s.roll_number, s.full_name, s.class_id || null, s.email || null, s.phone || null, s.created_at || null]
        );
      }
    }

    // Insert attendance
    if (Array.isArray(memoryDB.attendance)) {
      for (const a of memoryDB.attendance) {
        const attendanceDate = a.attendance_date ? (a.attendance_date.split('T')[0]) : null;
        try {
          const classNumber = a.class_number != null ? a.class_number : 1;
          const editCount = a.edit_count != null ? a.edit_count : 0;
          await pool.query(
            `INSERT INTO attendance (attendance_id, student_id, class_id, class_number, attendance_date, status, subject, marked_by, edit_count, recorded_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status), subject = VALUES(subject), class_number = VALUES(class_number), marked_by = VALUES(marked_by), edit_count = VALUES(edit_count), recorded_at = VALUES(recorded_at)`,
            [a.attendance_id, a.student_id, a.class_id, classNumber, attendanceDate, a.status || 'Present', a.subject || 'General', a.marked_by || null, editCount, a.recorded_at || null]
          );
        } catch (err) {
          console.warn('Skipping attendance row due to error:', err.message);
        }
      }
    }

    // Insert subject marks
    if (Array.isArray(memoryDB.subject_marks)) {
      for (const m of memoryDB.subject_marks) {
        try {
          await pool.query(
            `INSERT INTO student_subject_marks (mark_id, student_id, subject, ia1, ia2, ia3, best_two_average, status, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE ia1 = VALUES(ia1), ia2 = VALUES(ia2), ia3 = VALUES(ia3), best_two_average = VALUES(best_two_average), status = VALUES(status), updated_at = VALUES(updated_at)`,
            [m.mark_id, m.student_id, m.subject, m.ia1, m.ia2, m.ia3, m.best_two_average, m.status || 'Fail', m.updated_at || null]
          );
        } catch (err) {
          console.warn('Skipping subject mark row due to error:', err.message);
        }
      }
    }

    // Insert leave requests
    if (Array.isArray(memoryDB.leave_requests)) {
      for (const l of memoryDB.leave_requests) {
        try {
          await pool.query(
            `INSERT INTO leave_requests (leave_id, student_id, leave_date, reason, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE reason = VALUES(reason), status = VALUES(status)`,
            [l.leave_id, l.student_id, l.leave_date ? l.leave_date.split('T')[0] : null, l.reason || null, l.status || 'Pending', l.created_at || null]
          );
        } catch (err) {
          console.warn('Skipping leave row due to error:', err.message);
        }
      }
    }

    console.log('Migration complete.');
    await pool.end();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
})();
