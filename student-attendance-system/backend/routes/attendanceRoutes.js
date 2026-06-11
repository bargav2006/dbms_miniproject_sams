const express = require('express');
const router = express.Router();
const { requireAuth, requireTeacher, requireAdmin, requireTeacherOrAdmin, requireStudent } = require('../middleware/auth');
const attendanceController = require('../controllers/attendanceController');

router.get('/summary', requireTeacherOrAdmin, attendanceController.getSummary);
router.post('/', requireTeacherOrAdmin, attendanceController.markAttendance);  // Teachers/Admin can mark
router.post('/subject-marks', requireTeacherOrAdmin, attendanceController.saveSubjectMarks);  // Teachers/Admin can save marks
router.get('/subject-marks', requireAuth, attendanceController.getSubjectMarks);  // Authenticated users can view their marks
router.get('/daily', requireTeacherOrAdmin, attendanceController.getDailyAttendance);  // Teachers/Admin can view daily
router.get('/report', requireAuth, attendanceController.getAttendanceReport);  // Authenticated users can view own/allowed reports
router.get('/low', requireTeacherOrAdmin, attendanceController.getLowAttendanceStudents);  // Teachers/Admin

module.exports = router;
