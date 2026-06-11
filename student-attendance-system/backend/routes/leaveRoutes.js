const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const leaveController = require('../controllers/leaveController');

router.post('/', requireAuth, leaveController.createLeaveRequest);
router.get('/', requireAuth, leaveController.getLeaveRequests);
router.patch('/:id/status', requireAuth, leaveController.updateLeaveStatus);

module.exports = router;
