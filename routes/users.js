const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/search', authenticate, (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  const pattern = `%${q}%`;
  const users = db.prepare(
    'SELECT id, username, display_name, avatar FROM users WHERE (username LIKE ? OR display_name LIKE ?) AND id != ? LIMIT 10'
  ).all(pattern, pattern, req.user.id);
  res.json(users);
});

router.get('/:id', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, username, display_name, avatar, bio, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.patch('/me', authenticate, (req, res) => {
  const { display_name, bio } = req.body;
  const updates = [];
  const params = [];
  if (display_name !== undefined) { updates.push('display_name = ?'); params.push(display_name); }
  if (bio !== undefined) { updates.push('bio = ?'); params.push(bio); }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const user = db.prepare('SELECT id, username, email, display_name, avatar, bio FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

router.post('/me/avatar', authenticate, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(url, req.user.id);
  res.json({ avatar: url });
});

router.post('/me/password', authenticate, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'Password updated' });
});

module.exports = router;
