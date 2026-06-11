require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const classRoutes = require('./routes/classRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

app.get('/', (req, res) => {
  res.redirect('/login.html');
});
app.get('/index.html', (req, res) => {
  res.redirect('/login.html');
});
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'login.html'));
});

const startPort = Number(process.env.PORT) || 5000;
const MAX_RETRIES = 10;

function startServer(p = startPort, remaining = MAX_RETRIES) {
  const server = app.listen(p, () => {
    process.env.PORT = String(p);
    console.log(`SAMS server running on http://localhost:${p}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${p} is already in use.`);
      if (remaining > 0) {
        const nextPort = p + 1;
        console.log(`Attempting next port ${nextPort} (${remaining - 1} retries left)...`);
        setTimeout(() => startServer(nextPort, remaining - 1), 200);
      } else {
        console.error(`No available ports found after ${MAX_RETRIES} attempts. Exiting.`);
        process.exit(1);
      }
    } else {
      throw error;
    }
  });
}

startServer();
