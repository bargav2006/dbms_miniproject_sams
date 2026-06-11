const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const token = authHeader.replace('Bearer ', '').trim();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

const requireRole = (roles) => (req, res, next) => {
  requireAuth(req, res, () => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `${roles.join(' or ')} access required` });
    }
    next();
  });
};

const requireTeacher = requireRole(['teacher']);
const requireStudent = requireRole(['student']);
const requireAdmin = requireRole(['admin']);
const requireTeacherOrAdmin = requireRole(['teacher', 'admin']);

module.exports = { requireAuth, requireTeacher, requireStudent, requireAdmin, requireTeacherOrAdmin };
