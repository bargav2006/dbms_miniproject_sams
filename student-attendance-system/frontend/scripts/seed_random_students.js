require('dotenv').config();

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

const firstNames = [
  'Aarav', 'Vivaan', 'Anya', 'Diya', 'Kabir', 'Riya', 'Aditya', 'Ishita', 'Arjun', 'Saanvi',
  'Neil', 'Aadhya', 'Ira', 'Reyansh', 'Anya', 'Pari', 'Krishna', 'Tara', 'Aarush', 'Mira'
];

const lastNames = [
  'Mehta', 'Sharma', 'Verma', 'Iyer', 'Rao', 'Singh', 'Nair', 'Gupta', 'Pandey', 'Bhat',
  'Menon', 'Joshi', 'Kapoor', 'Agarwal', 'Chawla', 'Reddy', 'Malhotra', 'Sen', 'Das', 'Ghosh'
];

const randomChoice = (array) => array[Math.floor(Math.random() * array.length)];

const formatDate = (date) => date.toISOString().split('T')[0];

const seed = async () => {
  try {
    const [classes] = await pool.query('SELECT class_id, class_name, section FROM classes ORDER BY class_id');

    if (!classes.length) {
      console.log('No classes found. Create classes first.');
      return;
    }

    const studentRows = [];
    const attendanceRows = [];

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 59);

    for (const classItem of classes) {
      const [existingStudents] = await pool.query('SELECT roll_number FROM students WHERE class_id = ?', [classItem.class_id]);
      const existingRolls = new Set(existingStudents.map((row) => row.roll_number));

      for (let index = 1; index <= 20; index += 1) {
        const roll_number = String(classItem.class_id * 1000 + index).padStart(4, '0');

        if (existingRolls.has(roll_number)) {
          continue;
        }

        const firstName = randomChoice(firstNames);
        const lastName = randomChoice(lastNames);
        const fullName = `${firstName} ${lastName}`;
        const email = `${fullName.toLowerCase().replace(/\s+/g, '.')}${classItem.class_id}${index}@example.edu`;
        const username = `${firstName.toLowerCase()}_${roll_number}`;
        const password = 'password123';

        studentRows.push([username, password, roll_number, fullName, classItem.class_id, email, `9${Math.floor(100000000 + Math.random() * 900000000)}`]);
        existingRolls.add(roll_number);
      }
    }

    if (studentRows.length) {
      await pool.query(
        'INSERT INTO students (username, password, roll_number, full_name, class_id, email, phone) VALUES ?',
        [studentRows]
      );
      console.log(`Inserted ${studentRows.length} students.`);
    } else {
      console.log('No new students inserted.');
    }

    const [allStudents] = await pool.query('SELECT student_id, class_id FROM students ORDER BY student_id');

    for (const student of allStudents) {
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const status = Math.random() < 0.8 ? 'Present' : 'Absent';
        attendanceRows.push([student.student_id, student.class_id, formatDate(currentDate), status]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    if (attendanceRows.length) {
      const batchSize = 1000;
      for (let index = 0; index < attendanceRows.length; index += batchSize) {
        const batch = attendanceRows.slice(index, index + batchSize);
        await pool.query(
          'INSERT INTO attendance (student_id, class_id, attendance_date, status) VALUES ? ON DUPLICATE KEY UPDATE status = VALUES(status)',
          [batch]
        );
      }
      console.log(`Inserted ${attendanceRows.length} attendance rows.`);
    } else {
      console.log('No attendance rows generated.');
    }
  } catch (error) {
    console.error('Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

seed();
