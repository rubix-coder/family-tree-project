const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/trees/:treeId/invite', authenticate, (req, res) => {
  const tree = db.prepare('SELECT * FROM trees WHERE id = ?').get(req.params.treeId);
  if (!tree) return res.status(404).json({ error: 'Tree not found' });
  if (tree.owner_id !== req.user.id) {
    const collab = db.prepare('SELECT role FROM tree_collaborators WHERE tree_id = ? AND user_id = ?').get(req.params.treeId, req.user.id);
    if (!collab || collab.role !== 'editor') return res.status(403).json({ error: 'Only owners and editors can invite' });
  }

  const { email, username, role, message } = req.body;
  if (!email && !username) return res.status(400).json({ error: 'Email or username required' });

  let invitedUser = null;
  if (username) {
    invitedUser = db.prepare('SELECT id, email FROM users WHERE username = ?').get(username.toLowerCase());
    if (!invitedUser) return res.status(404).json({ error: 'User not found' });
    const existing = db.prepare('SELECT id FROM tree_collaborators WHERE tree_id = ? AND user_id = ?').get(req.params.treeId, invitedUser.id);
    if (existing || invitedUser.id === tree.owner_id) return res.status(409).json({ error: 'User is already a collaborator' });
  }

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const id = uuidv4();
  const targetEmail = email || invitedUser?.email;

  db.prepare('INSERT INTO invitations (id, tree_id, invited_by, email, token, role, message, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.params.treeId, req.user.id, targetEmail, token, role || 'editor', message || null, expiresAt);

  if (invitedUser) {
    db.prepare('INSERT INTO notifications (id, user_id, type, title, body, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), invitedUser.id, 'invitation', `You've been invited to a family tree`, `${req.user.display_name} invited you to join "${tree.name}"`, id, 'invitation');
  }

  res.status(201).json({ id, token, invite_link: `/invite/${token}`, message: 'Invitation created' });
});

router.get('/invite/:token', (req, res) => {
  const inv = db.prepare("SELECT i.*, t.name as tree_name, u.display_name as inviter_name FROM invitations i JOIN trees t ON i.tree_id = t.id JOIN users u ON i.invited_by = u.id WHERE i.token = ? AND i.status = 'pending' AND i.expires_at > datetime('now')").get(req.params.token);
  if (!inv) return res.status(404).json({ error: 'Invitation not found or expired' });
  res.json({ id: inv.id, tree_id: inv.tree_id, tree_name: inv.tree_name, inviter_name: inv.inviter_name, role: inv.role, message: inv.message });
});

router.post('/invite/:token/accept', authenticate, (req, res) => {
  const inv = db.prepare("SELECT * FROM invitations WHERE token = ? AND status = 'pending' AND expires_at > datetime('now')").get(req.params.token);
  if (!inv) return res.status(404).json({ error: 'Invitation not found or expired' });

  const existing = db.prepare('SELECT id FROM tree_collaborators WHERE tree_id = ? AND user_id = ?').get(inv.tree_id, req.user.id);
  if (!existing) {
    db.prepare('INSERT INTO tree_collaborators (id, tree_id, user_id, role, invited_by) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), inv.tree_id, req.user.id, inv.role, inv.invited_by);
  }

  db.prepare("UPDATE invitations SET status = 'accepted' WHERE id = ?").run(inv.id);

  db.prepare('INSERT INTO notifications (id, user_id, type, title, body, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uuidv4(), inv.invited_by, 'invite_accepted', 'Invitation accepted', `${req.user.display_name} joined your family tree`, inv.tree_id, 'tree');

  const tree = db.prepare('SELECT * FROM trees WHERE id = ?').get(inv.tree_id);
  res.json({ message: 'Invitation accepted', tree });
});

router.post('/invite/:token/decline', authenticate, (req, res) => {
  const inv = db.prepare("SELECT * FROM invitations WHERE token = ? AND status = 'pending'").get(req.params.token);
  if (!inv) return res.status(404).json({ error: 'Invitation not found' });
  db.prepare("UPDATE invitations SET status = 'declined' WHERE id = ?").run(inv.id);
  res.json({ message: 'Invitation declined' });
});

router.get('/trees/:treeId/invitations', authenticate, (req, res) => {
  const tree = db.prepare('SELECT owner_id FROM trees WHERE id = ?').get(req.params.treeId);
  if (!tree || tree.owner_id !== req.user.id) return res.status(403).json({ error: 'Only owner can view invitations' });
  const invitations = db.prepare(`
    SELECT i.*, u.display_name as inviter_name
    FROM invitations i JOIN users u ON i.invited_by = u.id
    WHERE i.tree_id = ? ORDER BY i.created_at DESC
  `).all(req.params.treeId);
  res.json(invitations);
});

router.delete('/trees/:treeId/invitations/:invId', authenticate, (req, res) => {
  const tree = db.prepare('SELECT owner_id FROM trees WHERE id = ?').get(req.params.treeId);
  if (!tree || tree.owner_id !== req.user.id) return res.status(403).json({ error: 'Only owner can revoke invitations' });
  db.prepare('DELETE FROM invitations WHERE id = ? AND tree_id = ?').run(req.params.invId, req.params.treeId);
  res.json({ message: 'Invitation revoked' });
});

module.exports = router;
