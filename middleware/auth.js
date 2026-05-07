const jwt = require('jsonwebtoken');
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'ft-social-secret-change-in-production';

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, email, display_name, avatar FROM users WHERE id = ?').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = db.prepare('SELECT id, username, email, display_name, avatar FROM users WHERE id = ?').get(payload.userId);
    } catch { /* ignore */ }
  }
  next();
}

function requireTreeAccess(role = 'viewer') {
  return (req, res, next) => {
    const treeId = req.params.treeId || req.params.id;
    const tree = db.prepare('SELECT * FROM trees WHERE id = ?').get(treeId);
    if (!tree) return res.status(404).json({ error: 'Tree not found' });

    if (tree.owner_id === req.user.id) {
      req.tree = tree;
      req.treeRole = 'owner';
      return next();
    }

    const collab = db.prepare('SELECT role FROM tree_collaborators WHERE tree_id = ? AND user_id = ?').get(treeId, req.user.id);
    if (!collab) return res.status(403).json({ error: 'Access denied' });

    const roles = ['viewer', 'editor', 'owner'];
    if (roles.indexOf(collab.role) < roles.indexOf(role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    req.tree = tree;
    req.treeRole = collab.role;
    next();
  };
}

module.exports = { authenticate, optionalAuth, requireTreeAccess, JWT_SECRET };
