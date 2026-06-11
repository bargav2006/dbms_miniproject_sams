const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const classController = require('../controllers/classController');

router.get('/', requireAuth, classController.getAllClasses);
router.post('/', requireAdmin, classController.createClass);
router.put('/:id', requireAdmin, classController.updateClass);
router.delete('/:id', requireAdmin, classController.deleteClass);

module.exports = router;
