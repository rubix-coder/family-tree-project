const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { JWT_SECRET, authenticate } = require('../middleware/auth');

const router = express.Router();

const ACCESS_TTL = '15m';
const REFRESH_TTL_DAYS = 7;

function issueTokens(userId) {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TTL });
  const refreshToken = uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86400000).toISOString();
  db.prepare('INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), userId, refreshToken, expiresAt);
  return { accessToken, refreshToken };
}

router.post('/register', (req, res) => {
  const { username, email, password, display_name } = req.body;
  if (!username || !email || !password || !display_name) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 alphanumeric characters or underscores' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email.toLowerCase(), username.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email or username already taken' });

  const hash = bcrypt.hashSync(password, 10);
  const id = uuidv4();
  db.prepare('INSERT INTO users (id, username, email, password_hash, display_name) VALUES (?, ?, ?, ?, ?)')
    .run(id, username.toLowerCase(), email.toLowerCase(), hash, display_name);

  const { accessToken, refreshToken } = issueTokens(id);
  const user = db.prepare('SELECT id, username, email, display_name, avatar, bio, created_at FROM users WHERE id = ?').get(id);
  res.status(201).json({ user, accessToken, refreshToken });
});

router.post('/login', (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) return res.status(400).json({ error: 'Login and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?')
    .get(login.toLowerCase(), login.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  db.prepare("UPDATE users SET last_seen = datetime('now') WHERE id = ?").run(user.id);
  const { accessToken, refreshToken } = issueTokens(user.id);
  const { password_hash, ...safeUser } = user;
  res.json({ user: safeUser, accessToken, refreshToken });
});

router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  const row = db.prepare("SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime('now')").get(refreshToken);
  if (!row) return res.status(401).json({ error: 'Invalid or expired refresh token' });

  db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(row.id);
  const { accessToken, refreshToken: newRefresh } = issueTokens(row.user_id);
  res.json({ accessToken, refreshToken: newRefresh });
});

router.post('/logout', authenticate, (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ? AND user_id = ?').run(refreshToken, req.user.id);
  }
  res.json({ message: 'Logged out' });
});

router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, username, email, display_name, avatar, bio, created_at, last_seen FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

module.exports = router;
