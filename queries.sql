USE sams;

-- Daily Attendance
SELECT s.roll_number, s.full_name, a.status 
FROM students s 
LEFT JOIN attendance a ON s.student_id = a.student_id 
WHERE a.attendance_date = CURDATE();

-- Attendance Percentage
SELECT 
    s.full_name,
    COUNT(*) as total_days,
    SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
    ROUND(SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END)*100/COUNT(*), 2) as percentage
FROM attendance a
JOIN students s ON a.student_id = s.student_id
GROUP BY s.student_id;