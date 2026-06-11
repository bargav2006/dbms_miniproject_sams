const db = require('../database');
const pool = db.pool;
const dataStore = require('../dataStore');

const createLeaveRequest = async (req, res) => {
  const { student_id, leave_date, reason } = req.body;

  if (!student_id || !leave_date) {
    return res.status(400).json({ message: 'student_id and leave_date are required' });
  }

  try {
    if (!db.databaseAvailable) {
      const leave = dataStore.createLeaveRequest({ student_id, leave_date, reason });
      return res.status(201).json({ leave_id: leave.leave_id, message: 'Leave request submitted successfully' });
    }

    const [result] = await pool.query(
      'INSERT INTO leave_requests (student_id, leave_date, reason, status) VALUES (?, ?, ?, "Pending")',
      [student_id, leave_date, reason || null]
    );
    res.status(201).json({ leave_id: result.insertId, message: 'Leave request submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit leave request', error: error.message });
  }
};

const getLeaveRequests = async (req, res) => {
  try {
    if (!db.databaseAvailable) {
      return res.json(dataStore.listLeaveRequests());
    }

    const [rows] = await pool.query(`
      SELECT lr.leave_id, lr.student_id, lr.leave_date, lr.reason, lr.status, lr.created_at, s.full_name, s.roll_number
      FROM leave_requests lr
      JOIN students s ON lr.student_id = s.student_id
      ORDER BY lr.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch leave requests', error: error.message });
  }
};

const updateLeaveStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ message: 'status must be Approved or Rejected' });
  }

  try {
    if (!db.databaseAvailable) {
      const leave = dataStore.updateLeaveRequestStatus(id, status);
      if (!leave) {
        return res.status(404).json({ message: 'Leave request not found' });
      }
      return res.json({ message: `Leave request ${status.toLowerCase()} successfully` });
    }

    await pool.query('UPDATE leave_requests SET status = ? WHERE leave_id = ?', [status, id]);
    res.json({ message: `Leave request ${status.toLowerCase()} successfully` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update leave request', error: error.message });
  }
};

module.exports = { createLeaveRequest, getLeaveRequests, updateLeaveStatus };
