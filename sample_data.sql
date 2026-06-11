USE sams;

-- Sample Teachers
INSERT INTO teachers (full_name, department) VALUES 
('Dr. Priya Sharma', 'CSE'),
('Prof. Rahul Verma', 'CSE');

-- Sample Classes
INSERT INTO classes (class_name, section, semester, academic_year, teacher_id) VALUES 
('B.Tech CSE', 'A', 4, 2026, 1);

-- Sample Students
INSERT INTO students (roll_number, full_name, class_id, section) VALUES 
('CSE20231', 'Aarav Kumar', 1, 'A'),
('CSE20232', 'Sneha Patel', 1, 'A'),
('CSE20233', 'Vikram Singh', 1, 'A');

-- Sample Attendance
INSERT INTO attendance (student_id, class_id, attendance_date, status, marked_by) VALUES 
(1, 1, CURDATE(), 'present', 1),
(2, 1, CURDATE(), 'present', 1),
(3, 1, CURDATE(), 'absent', 1);