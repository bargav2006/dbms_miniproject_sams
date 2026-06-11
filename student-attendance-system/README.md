# Student Attendance Management System (SAMS)

A full-stack Student Attendance Management System built with Node.js + Express.js + MySQL/SQLite and a Bootstrap-based frontend.

## Features
- User authentication (Teachers, Students, Admins) with JWT tokens
- Student, teacher, and class management
- Attendance marking by class with daily tracking
- Subject-based marks tracking (IA1, IA2, IA3, and best two average calculation)
- Attendance reporting and low attendance detection
- Student dashboard and teacher dashboard
- Responsive Bootstrap-based UI
- Support for both MySQL and SQLite databases

## Project Structure
```
backend/
  controllers/     - Business logic for each feature
  routes/          - API endpoints
  middleware/      - Authentication middleware
  database.js      - Database connection setup
  server.js        - Express server
frontend/
  index.html       - Main dashboard
  login.html       - Login page
  public/          - CSS, JS, and other assets
scripts/
  seed_random_students.js - Database seeding utility
```

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create MySQL database and tables by importing `schema.sql`:
   ```bash
   mysql -u root -p < schema.sql
   ```
3. Create `.env` file in the root directory:
   ```
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=sams
   DB_PORT=3306
   JWT_SECRET=your_jwt_secret_key
   ```
4. Start the server:
   ```bash
   npm start
   ```
   The server will run on `http://localhost:5000`

## Development
Run with auto-reload using nodemon:
```bash
npm run dev
```

## Database Migration
For existing databases:
- Migrate MySQL schema: `npm run migrate-mysql`
- Migrate to SQLite: `npm run migrate-sqlite`

## API Routes

### Authentication
- `POST /api/login` - User login (returns JWT token)

### Students
- `GET /api/students` - List all students
- `POST /api/students` - Create new student
- `GET /api/students/:id` - Get student details
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

### Teachers
- `GET /api/teachers` - List all teachers
- `POST /api/teachers` - Create new teacher
- `GET /api/teachers/:id` - Get teacher details
- `PUT /api/teachers/:id` - Update teacher
- `DELETE /api/teachers/:id` - Delete teacher

### Classes
- `GET /api/classes` - List all classes
- `POST /api/classes` - Create new class
- `GET /api/classes/:id` - Get class details
- `PUT /api/classes/:id` - Update class
- `DELETE /api/classes/:id` - Delete class

### Attendance
- `POST /api/attendance` - Mark student attendance
- `GET /api/attendance/daily` - Get daily attendance records
- `GET /api/attendance/report` - Get attendance report
- `GET /api/attendance/summary` - Get attendance summary
- `GET /api/attendance/low` - Get low attendance students
- `POST /api/attendance/subject-marks` - Save subject marks (IA1, IA2, IA3)
- `GET /api/attendance/subject-marks` - Get subject marks

## Database Schema
The system uses the following main tables:
- `teachers` - Teacher accounts and profiles
- `students` - Student accounts and enrollment
- `classes` - Class information
- `attendance` - Attendance records with subject tracking
- `student_subject_marks` - Subject-wise marks

See `schema.sql` for complete schema details.

## Default Credentials
After running `schema.sql`, you can log in with:
- **Teacher**: asha_rao / password123
- **Teacher**: mohit_verma / password123
- **Students**: Check schema.sql for student credentials

## Technologies Used
- **Backend**: Node.js, Express.js
- **Database**: MySQL / SQLite
- **Authentication**: JWT (jsonwebtoken)
- **Security**: bcryptjs for password hashing
- **Frontend**: HTML5, Bootstrap 5, JavaScript
- **API Format**: JSON
