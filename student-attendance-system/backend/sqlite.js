const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_FILE = process.env.SQLITE_FILE || path.join(__dirname, 'sams.sqlite');
const INIT_FLAG = path.join(__dirname, '.sqlite_initialized');

const db = new Database(DB_FILE);

const run = (sql) => db.exec(sql);

const ensureAttendanceColumns = () => {
  const columns = db.prepare("PRAGMA table_info(attendance)").all().map((col) => col.name.toLowerCase());
  if (!columns.includes('marked_by')) {
    run('ALTER TABLE attendance ADD COLUMN marked_by INTEGER');
  }
  if (!columns.includes('marked_at')) {
    run("ALTER TABLE attendance ADD COLUMN marked_at TEXT DEFAULT (datetime('now'))");
  }
  if (!columns.includes('edit_count')) {
    run('ALTER TABLE attendance ADD COLUMN edit_count INTEGER NOT NULL DEFAULT 0');
  }
};

// Create tables with SQLite-compatible schema if not exists
const init = () => {
  // Create tables if needed
  run(`
    CREATE TABLE IF NOT EXISTS teachers (
      teacher_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      department TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  run(`
    CREATE TABLE IF NOT EXISTS classes (
      class_id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_name TEXT NOT NULL,
      section TEXT,
      teacher_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id) ON DELETE SET NULL
    );
  `);

  run(`
    CREATE TABLE IF NOT EXISTS students (
      student_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      roll_number TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      class_id INTEGER,
      email TEXT,
      phone TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE SET NULL
    );
  `);

  run(`
    CREATE TABLE IF NOT EXISTS attendance (
      attendance_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      class_number INTEGER NOT NULL DEFAULT 1,
      attendance_date TEXT NOT NULL,
      status TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT 'General',
      marked_by INTEGER,
      recorded_at TEXT DEFAULT (datetime('now')),
      marked_at TEXT DEFAULT (datetime('now')),
      edit_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE (student_id, class_id, class_number, attendance_date, subject),
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE
    );
  `);

  run(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      leave_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      leave_date TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'Pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    );
  `);

  run(`
    CREATE TABLE IF NOT EXISTS student_subject_marks (
      mark_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      ia1 INTEGER NOT NULL,
      ia2 INTEGER NOT NULL,
      ia3 INTEGER NOT NULL,
      best_two_average REAL NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(student_id, subject),
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    );
  `);

  if (!fs.existsSync(INIT_FLAG)) {
    fs.writeFileSync(INIT_FLAG, 'initialized');
  }

  ensureAttendanceColumns();
};

    CREATE TABLE IF NOT EXISTS leave_requests (
      leave_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      leave_date TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'Pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    );
  `);

  // Subject marks
  run(`
    CREATE TABLE IF NOT EXISTS student_subject_marks (
      mark_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      ia1 INTEGER NOT NULL,
      ia2 INTEGER NOT NULL,
      ia3 INTEGER NOT NULL,
      best_two_average REAL NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(student_id, subject),
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
    );
  `);

  fs.writeFileSync(INIT_FLAG, 'initialized');
};

init();

const query = async (sql, params = []) => {
  const stmt = db.prepare(sql);
  const upper = sql.trim().split(/\s+/)[0].toUpperCase();
  try {
    if (upper === 'SELECT' || upper === 'PRAGMA') {
      const rows = stmt.all(params);
      return [rows];
    }
    const info = stmt.run(params);
    return [info];
  } catch (err) {
    // Re-throw to keep behavior similar to mysql2
    throw err;
  }
};

module.exports = {
  pool: { query },
  db,
};
