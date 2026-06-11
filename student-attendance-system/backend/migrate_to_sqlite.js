require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sqlite = require('./sqlite');

const PERSISTENCE_FILE = path.join(__dirname, 'data-store.json');
const db = sqlite.db;

const run = (sql, params=[]) => {
  const stmt = db.prepare(sql);
  return stmt.run(params);
};

const all = (sql, params=[]) => {
  const stmt = db.prepare(sql);
  return stmt.all(params);
};

(async () => {
  try {
    if (!fs.existsSync(PERSISTENCE_FILE)) {
      console.log('No persisted fallback file to migrate:', PERSISTENCE_FILE);
      return;
    }

    const raw = fs.readFileSync(PERSISTENCE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const memoryDB = parsed.memoryDB || {};

    // Insert teachers
    if (Array.isArray(memoryDB.teachers)) {
      const insert = db.prepare('INSERT OR IGNORE INTO teachers (teacher_id, username, password, full_name, email, phone, department, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      const update = db.prepare('UPDATE teachers SET username = ?, password = ?, full_name = ?, email = ?, phone = ?, department = ? WHERE teacher_id = ?');
      for (const t of memoryDB.teachers) {
        const username = t.username || (t.email ? t.email.split('@')[0] : `teacher_${t.teacher_id}`);
        const password = t.password || 'password123';
        insert.run(t.teacher_id, username, password, t.full_name, t.email, t.phone || null, t.department || null, t.created_at || null);
        update.run(username, password, t.full_name, t.email, t.phone || null, t.department || null, t.teacher_id);
      }
    }

    // Insert classes
    if (Array.isArray(memoryDB.classes)) {
      const insert = db.prepare('INSERT OR IGNORE INTO classes (class_id, class_name, section, teacher_id, created_at) VALUES (?, ?, ?, ?, ?)');
      const update = db.prepare('UPDATE classes SET class_name = ?, section = ?, teacher_id = ? WHERE class_id = ?');
      for (const c of memoryDB.classes) {
        insert.run(c.class_id, c.class_name, c.section || null, c.teacher_id || null, c.created_at || null);
        update.run(c.class_name, c.section || null, c.teacher_id || null, c.class_id);
      }
    }

    // Insert students
    if (Array.isArray(memoryDB.students)) {
      const insert = db.prepare('INSERT OR IGNORE INTO students (student_id, username, password, roll_number, full_name, class_id, email, phone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const update = db.prepare('UPDATE students SET username = ?, password = ?, roll_number = ?, full_name = ?, class_id = ?, email = ?, phone = ? WHERE student_id = ?');
      for (const s of memoryDB.students) {
        const username = s.username || `${s.full_name.toLowerCase().replace(/\s+/g, '_')}_${s.roll_number}`;
        const password = s.password || 'password123';
        insert.run(s.student_id, username, password, s.roll_number, s.full_name, s.class_id || null, s.email || null, s.phone || null, s.created_at || null);
        update.run(username, password, s.roll_number, s.full_name, s.class_id || null, s.email || null, s.phone || null, s.student_id);
      }
    }

    // Insert attendance
    if (Array.isArray(memoryDB.attendance)) {
      const insert = db.prepare('INSERT OR IGNORE INTO attendance (attendance_id, student_id, class_id, class_number, attendance_date, status, subject, marked_by, edit_count, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const update = db.prepare('UPDATE attendance SET status = ?, class_number = ?, subject = ?, marked_by = ?, edit_count = ?, recorded_at = ? WHERE attendance_id = ?');
      for (const a of memoryDB.attendance) {
        const attendanceDate = a.attendance_date ? (a.attendance_date.split('T')[0]) : null;
        try {
          const classNumber = a.class_number != null ? a.class_number : 1;
          const editCount = a.edit_count != null ? a.edit_count : 0;
          insert.run(a.attendance_id, a.student_id, a.class_id, classNumber, attendanceDate, a.status || 'Present', a.subject || 'General', a.marked_by || null, editCount, a.recorded_at || null);
          update.run(a.status || 'Present', classNumber, a.subject || 'General', a.marked_by || null, editCount, a.recorded_at || null, a.attendance_id);
        } catch (err) {
          console.warn('Skipping attendance row due to error:', err.message);
        }
      }
    }

    // Insert subject marks
    if (Array.isArray(memoryDB.subject_marks)) {
      const insert = db.prepare('INSERT OR IGNORE INTO student_subject_marks (mark_id, student_id, subject, ia1, ia2, ia3, best_two_average, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const update = db.prepare('UPDATE student_subject_marks SET ia1 = ?, ia2 = ?, ia3 = ?, best_two_average = ?, status = ?, updated_at = ? WHERE mark_id = ?');
      for (const m of memoryDB.subject_marks) {
        try {
          insert.run(m.mark_id, m.student_id, m.subject, m.ia1, m.ia2, m.ia3, m.best_two_average, m.status || 'Fail', m.updated_at || null);
          update.run(m.ia1, m.ia2, m.ia3, m.best_two_average, m.status || 'Fail', m.updated_at || null, m.mark_id);
        } catch (err) {
          console.warn('Skipping subject mark row due to error:', err.message);
        }
      }
    }

    // Insert leave requests
    if (Array.isArray(memoryDB.leave_requests)) {
      const insert = db.prepare('INSERT OR IGNORE INTO leave_requests (leave_id, student_id, leave_date, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?)');
      const update = db.prepare('UPDATE leave_requests SET reason = ?, status = ? WHERE leave_id = ?');
      for (const l of memoryDB.leave_requests) {
        try {
          insert.run(l.leave_id, l.student_id, l.leave_date ? l.leave_date.split('T')[0] : null, l.reason || null, l.status || 'Pending', l.created_at || null);
          update.run(l.reason || null, l.status || 'Pending', l.leave_id);
        } catch (err) {
          console.warn('Skipping leave row due to error:', err.message);
        }
      }
    }

    console.log('SQLite migration complete. Database file:', path.join(__dirname, 'sams.sqlite'));
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
})();
