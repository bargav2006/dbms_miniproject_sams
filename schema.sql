-- Student Attendance Management System - Schema
CREATE DATABASE IF NOT EXISTS sams;
USE sams;

-- Teachers
CREATE TABLE teachers (
    teacher_id INT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(15),
    department VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Classes
CREATE TABLE classes (
    class_id INT PRIMARY KEY AUTO_INCREMENT,
    class_name VARCHAR(50) NOT NULL,
    section VARCHAR(10) NOT NULL,
    semester INT,
    academic_year YEAR,
    teacher_id INT,
    FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id)
);

-- Students
CREATE TABLE students (
    student_id INT PRIMARY KEY AUTO_INCREMENT,
    roll_number VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(15),
    class_id INT,
    section VARCHAR(10),
    academic_year YEAR,
    status ENUM('active','inactive') DEFAULT 'active',
    FOREIGN KEY (class_id) REFERENCES classes(class_id)
);

-- Attendance (Core Table)
CREATE TABLE attendance (
    attendance_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    class_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    status ENUM('present', 'absent', 'late', 'excused') NOT NULL,
    marked_by INT NOT NULL,
    marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    remarks VARCHAR(255),
    UNIQUE KEY (student_id, class_id, attendance_date),
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (class_id) REFERENCES classes(class_id),
    FOREIGN KEY (marked_by) REFERENCES teachers(teacher_id)
);

-- Subject IA Marks
CREATE TABLE student_subject_marks (
    mark_id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    ia1 DECIMAL(5,2) NOT NULL,
    ia2 DECIMAL(5,2) NOT NULL,
    ia3 DECIMAL(5,2) NOT NULL,
    best_two_average DECIMAL(5,2) NOT NULL,
    status ENUM('Pass','Fail') NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY (student_id, subject),
    FOREIGN KEY (student_id) REFERENCES students(student_id)
);

-- Leave Requests
CREATE TABLE leave_requests (
    leave_id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason TEXT,
    status ENUM('pending','approved','rejected') DEFAULT 'pending',
    approved_by INT,
    FOREIGN KEY (student_id) REFERENCES students(student_id)
);