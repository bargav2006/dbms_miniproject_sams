const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const teacherController = require('../controllers/teacherController');

router.get('/', requireAdmin, teacherController.getAllTeachers);
router.post('/', requireAdmin, teacherController.createTeacher);
router.put('/:id', requireAdmin, teacherController.updateTeacher);
router.delete('/:id', requireAdmin, teacherController.deleteTeacher);

module.exports = router;
