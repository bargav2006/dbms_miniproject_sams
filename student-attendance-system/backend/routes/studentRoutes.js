const express = require('express');
const router = express.Router();
const { requireAuth, requireTeacherOrAdmin, requireAdmin } = require('../middleware/auth');
const studentController = require('../controllers/studentController');

router.get('/', requireTeacherOrAdmin, studentController.getAllStudents);
router.post('/', requireTeacherOrAdmin, studentController.createStudent);
router.put('/:id', requireAdmin, studentController.updateStudent);
router.delete('/:id', requireAdmin, studentController.deleteStudent);

module.exports = router;
