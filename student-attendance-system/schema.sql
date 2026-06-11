-- Student Attendance Management System (SAMS) Database Schema
-- Compatible with MySQL 5.7+

CREATE DATABASE IF NOT EXISTS `sams`;
USE `sams`;

-- Teachers table
CREATE TABLE IF NOT EXISTS teachers (
  teacher_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(20),
  department VARCHAR(100),
  role ENUM('teacher','admin') NOT NULL DEFAULT 'teacher',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  class_id INT AUTO_INCREMENT PRIMARY KEY,
  class_name VARCHAR(100) NOT NULL,
  section VARCHAR(20),
  teacher_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id) ON DELETE SET NULL
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
  student_id VARCHAR(20) PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  roll_number VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  class_id INT,
  email VARCHAR(100),
  phone VARCHAR(20),
  role ENUM('student','admin') NOT NULL DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE SET NULL
);

-- Attendance table - tracks daily class attendance with subject information
CREATE TABLE IF NOT EXISTS attendance (
  attendance_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL,
  class_id INT NOT NULL,
  class_number INT NOT NULL DEFAULT 1,
  attendance_date DATE NOT NULL,
  status ENUM('Present','Absent') NOT NULL,
  subject VARCHAR(100) NOT NULL DEFAULT 'General',
  marked_by INT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  edit_count INT NOT NULL DEFAULT 0,
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
  UNIQUE KEY unique_daily_record (student_id, class_id, class_number, attendance_date, subject)
);

-- Subject marks table - tracks continuous assessment marks (IA1, IA2, IA3)
CREATE TABLE IF NOT EXISTS student_subject_marks (
  mark_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  ia1 INT NOT NULL,
  ia2 INT NOT NULL,
  ia3 INT NOT NULL,
  best_two_average DECIMAL(5,2) NOT NULL,
  status ENUM('Pass','Fail') NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_student_subject (student_id, subject),
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX idx_student_class ON attendance(student_id, class_id);
CREATE INDEX idx_attendance_date ON attendance(attendance_date);

-- Sample data - Default credentials: password123
INSERT INTO teachers (username, password, full_name, email, phone, department, role) VALUES
('asha_rao', 'password123', 'Dr. Asha Rao', 'asha@example.com', '9876543210', 'Computer Science', 'teacher'),
('mohit_verma', 'password123', 'Prof. Mohit Verma', 'mohit@example.com', '9876543211', 'Mathematics', 'teacher')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role = VALUES(role);

INSERT INTO classes (class_name, section, teacher_id) VALUES
('AIML', 'A', 1),
('AIML', 'B', 2)
ON DUPLICATE KEY UPDATE class_name = VALUES(class_name);

INSERT INTO students (student_id, username, password, roll_number, full_name, class_id, email, phone) VALUES
('101', 'Aarav Mehta', 'password123', '101', 'Aarav Mehta', 1, 'aarav@example.com', '9000000001'),
('102', 'Diya Sharma', 'password123', '102', 'Diya Sharma', 1, 'diya@example.com', '9000000002'),
('201', 'Rohan Iyer', 'password123', '201', 'Rohan Iyer', 2, 'rohan@example.com', '9000000003')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), username = VALUES(username);
