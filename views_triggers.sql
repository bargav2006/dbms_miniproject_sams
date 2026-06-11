USE sams;

-- View for Summary
CREATE VIEW attendance_summary AS
SELECT s.full_name, AVG(CASE WHEN status='present' THEN 100 ELSE 0 END) as avg_attendance
FROM students s
LEFT JOIN attendance a ON s.student_id = a.student_id
GROUP BY s.student_id;