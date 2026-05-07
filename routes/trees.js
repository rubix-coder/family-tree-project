const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { authenticate, requireTreeAccess } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

function notifyCollaborators(treeId, excludeUserId, type, title, body, referenceId) {
  const collabs = db.prepare('SELECT user_id FROM tree_collaborators WHERE tree_id = ?').all(treeId);
  const tree = db.prepare('SELECT owner_id FROM trees WHERE id = ?').get(treeId);
  const recipients = new Set(collabs.map(c => c.user_id));
  if (tree) recipients.add(tree.owner_id);
  recipients.delete(excludeUserId);
  const stmt = db.prepare('INSERT INTO notifications (id, user_id, type, title, body, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const uid of recipients) {
    stmt.run(uuidv4(), uid, type, title, body, referenceId, 'tree');
  }
}

router.get('/', authenticate, (req, res) => {
  const owned = db.prepare('SELECT t.*, u.display_name as owner_name FROM trees t JOIN users u ON t.owner_id = u.id WHERE t.owner_id = ?').all(req.user.id);
  const collab = db.prepare(`
    SELECT t.*, u.display_name as owner_name, tc.role as my_role
    FROM trees t
    JOIN tree_collaborators tc ON t.id = tc.tree_id
    JOIN users u ON t.owner_id = u.id
    WHERE tc.user_id = ?
  `).all(req.user.id);

  const withCounts = (trees) => trees.map(t => {
    const memberCount = db.prepare('SELECT COUNT(*) as c FROM tree_members WHERE tree_id = ?').get(t.id).c;
    const collaboratorCount = db.prepare('SELECT COUNT(*) as c FROM tree_collaborators WHERE tree_id = ?').get(t.id).c;
    return { ...t, member_count: memberCount, collaborator_count: collaboratorCount };
  });

  res.json({ owned: withCounts(owned), collaborating: withCounts(collab) });
});

router.post('/', authenticate, (req, res) => {
  const { name, description, privacy } = req.body;
  if (!name) return res.status(400).json({ error: 'Tree name is required' });
  const id = uuidv4();
  db.prepare('INSERT INTO trees (id, owner_id, name, description, privacy) VALUES (?, ?, ?, ?, ?)').run(id, req.user.id, name, description || '', privacy || 'family');
  const tree = db.prepare('SELECT * FROM trees WHERE id = ?').get(id);
  res.status(201).json(tree);
});

router.get('/:id', authenticate, (req, res) => {
  const tree = db.prepare('SELECT t.*, u.display_name as owner_name, u.username as owner_username FROM trees t JOIN users u ON t.owner_id = u.id WHERE t.id = ?').get(req.params.id);
  if (!tree) return res.status(404).json({ error: 'Tree not found' });

  const isOwner = tree.owner_id === req.user.id;
  const collab = db.prepare('SELECT role FROM tree_collaborators WHERE tree_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!isOwner && !collab) return res.status(403).json({ error: 'Access denied' });

  const collaborators = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar, tc.role, tc.joined_at
    FROM tree_collaborators tc JOIN users u ON tc.user_id = u.id
    WHERE tc.tree_id = ?
  `).all(req.params.id);

  const memberCount = db.prepare('SELECT COUNT(*) as c FROM tree_members WHERE tree_id = ?').get(req.params.id).c;
  res.json({ ...tree, collaborators, member_count: memberCount, my_role: isOwner ? 'owner' : collab.role });
});

router.patch('/:id', authenticate, requireTreeAccess('editor'), (req, res) => {
  const { name, description, privacy } = req.body;
  const updates = [];
  const params = [];
  if (name) { updates.push('name = ?'); params.push(name); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (privacy) { updates.push('privacy = ?'); params.push(privacy); }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);
  db.prepare(`UPDATE trees SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json(db.prepare('SELECT * FROM trees WHERE id = ?').get(req.params.id));
});

router.post('/:id/cover', authenticate, requireTreeAccess('editor'), upload.single('cover'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE trees SET cover_photo = ? WHERE id = ?').run(url, req.params.id);
  res.json({ cover_photo: url });
});

router.delete('/:id', authenticate, (req, res) => {
  const tree = db.prepare('SELECT owner_id FROM trees WHERE id = ?').get(req.params.id);
  if (!tree) return res.status(404).json({ error: 'Tree not found' });
  if (tree.owner_id !== req.user.id) return res.status(403).json({ error: 'Only the owner can delete a tree' });
  db.prepare('DELETE FROM trees WHERE id = ?').run(req.params.id);
  res.json({ message: 'Tree deleted' });
});

router.get('/:id/members', authenticate, requireTreeAccess('viewer'), (req, res) => {
  const members = db.prepare('SELECT * FROM tree_members WHERE tree_id = ? ORDER BY name').all(req.params.id);
  res.json(members);
});

router.post('/:id/collaborators/:userId/role', authenticate, (req, res) => {
  const tree = db.prepare('SELECT owner_id FROM trees WHERE id = ?').get(req.params.id);
  if (!tree || tree.owner_id !== req.user.id) return res.status(403).json({ error: 'Only owner can change roles' });
  const { role } = req.body;
  if (!['viewer', 'editor'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  db.prepare('UPDATE tree_collaborators SET role = ? WHERE tree_id = ? AND user_id = ?').run(role, req.params.id, req.params.userId);
  res.json({ message: 'Role updated' });
});

router.delete('/:id/collaborators/:userId', authenticate, (req, res) => {
  const tree = db.prepare('SELECT owner_id FROM trees WHERE id = ?').get(req.params.id);
  if (!tree) return res.status(404).json({ error: 'Tree not found' });
  if (tree.owner_id !== req.user.id && req.params.userId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  db.prepare('DELETE FROM tree_collaborators WHERE tree_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  res.json({ message: 'Removed from tree' });
});

module.exports = router;
