const fs = require('fs');
const path = require('path');
require('dotenv').config();

const useSqlite = process.env.DB_TYPE === 'sqlite' || process.env.USE_SQLITE === 'true';

if (useSqlite) {
  // Defer to sqlite implementation which exposes a pool-like `query` method
  const sqlite = require('./sqlite');
  module.exports = {
    pool: sqlite.pool,
    dbType: 'sqlite',
    get databaseAvailable() {
      return true;
    },
    checkDatabase: async () => {},
  };
} else {
  const mysql = require('mysql2/promise');

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sams',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  let databaseAvailable = false;

  const ensureAttendanceColumns = async (connection) => {
    const dbName = process.env.DB_NAME || 'sams';
    try {
      const [rows] = await connection.query(
        'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
        [dbName, 'attendance']
      );
      const cols = rows.map((row) => row.COLUMN_NAME.toLowerCase());
      if (!cols.includes('class_number')) {
        await connection.query('ALTER TABLE attendance ADD COLUMN class_number INT NOT NULL DEFAULT 1 AFTER class_id');
      }
      if (!cols.includes('subject')) {
        await connection.query("ALTER TABLE attendance ADD COLUMN subject VARCHAR(100) NOT NULL DEFAULT 'General' AFTER class_number");
      }
      if (!cols.includes('marked_by')) {
        await connection.query('ALTER TABLE attendance ADD COLUMN marked_by INT NULL AFTER subject');
      }
      if (!cols.includes('marked_at')) {
        await connection.query('ALTER TABLE attendance ADD COLUMN marked_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER marked_by');
      }
      if (!cols.includes('edit_count')) {
        await connection.query('ALTER TABLE attendance ADD COLUMN edit_count INT NOT NULL DEFAULT 0 AFTER marked_at');
      }

      const [indexRows] = await connection.query(
        'SELECT INDEX_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? ORDER BY SEQ_IN_INDEX',
        [dbName, 'attendance', 'unique_daily_record']
      );
      const indexCols = indexRows.map((row) => row.COLUMN_NAME.toLowerCase());
      if (indexCols.length > 0 && !indexCols.includes('class_number')) {
        await connection.query('ALTER TABLE attendance DROP INDEX unique_daily_record');
        await connection.query('ALTER TABLE attendance ADD UNIQUE KEY unique_daily_record (student_id, class_id, class_number, attendance_date, subject)');
      }
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' || err.message.toLowerCase().includes('doesn\'t exist')) {
        return;
      }
      throw err;
    }
  };

  const checkDatabase = async () => {
    try {
      const connection = await pool.getConnection();
      await connection.ping();
      await ensureAttendanceColumns(connection);
      connection.release();
      databaseAvailable = true;
      console.log('MySQL connection established');
    } catch (error) {
      databaseAvailable = false;
      console.warn('MySQL unavailable, falling back to in-memory data:', error.message);
      setTimeout(checkDatabase, 5000);
    }
  };

  checkDatabase();

  module.exports = {
    pool,
    dbType: 'mysql',
    get databaseAvailable() {
      return databaseAvailable;
    },
    checkDatabase,
  };
}
