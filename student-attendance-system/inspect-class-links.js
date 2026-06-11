const db = require('./backend/database');
const pool = db.pool;
(async () => {
  try {
    const [classes] = await pool.query('SELECT class_id, class_name, section, teacher_id FROM classes ORDER BY class_id ASC');
    for (const cls of classes) {
      const [[studentCount]] = await pool.query('SELECT COUNT(*) AS cnt FROM students WHERE class_id = ?', [cls.class_id]);
      const [[attendanceCount]] = await pool.query('SELECT COUNT(*) AS cnt FROM attendance WHERE class_id = ?', [cls.class_id]);
      console.log(`class_id=${cls.class_id} name=${cls.class_name}${cls.section ? ' '+cls.section : ''} teacher_id=${cls.teacher_id} students=${studentCount.cnt} attendance=${attendanceCount.cnt}`);
    }
  } catch (error) {
    console.error('err', error.message);
  } finally {
    process.exit(0);
  }
})();
