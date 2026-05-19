const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { authenticate, requireTreeAccess } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router({ mergeParams: true });

function createNotification(userId, type, title, body, refId) {
  db.prepare('INSERT INTO notifications (id, user_id, type, title, body, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uuidv4(), userId, type, title, body, refId, 'member');
}

router.get('/', authenticate, requireTreeAccess('viewer'), (req, res) => {
  const members = db.prepare('SELECT * FROM tree_members WHERE tree_id = ? ORDER BY name').all(req.params.treeId);
  res.json(members);
});

router.post('/', authenticate, requireTreeAccess('editor'), (req, res) => {
  const { name, birth_year, death_year, birth_place, gender, bio, paternal_parent_id, maternal_parent_id, spouse_id, partner_ids, linked_user_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const id = uuidv4();
  db.prepare(`
    INSERT INTO tree_members (id, tree_id, name, birth_year, death_year, birth_place, gender, bio, paternal_parent_id, maternal_parent_id, spouse_id, partner_ids, linked_user_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.treeId, name, birth_year || null, death_year || null, birth_place || null, gender || 'other', bio || null, paternal_parent_id || null, maternal_parent_id || null, spouse_id || null, partner_ids || '[]', linked_user_id || null, req.user.id);

  db.prepare("UPDATE trees SET updated_at = datetime('now') WHERE id = ?").run(req.params.treeId);

  const member = db.prepare('SELECT * FROM tree_members WHERE id = ?').get(id);

  const collabs = db.prepare('SELECT user_id FROM tree_collaborators WHERE tree_id = ?').all(req.params.treeId);
  const tree = db.prepare('SELECT owner_id, name as tree_name FROM trees WHERE id = ?').get(req.params.treeId);
  const recipients = new Set(collabs.map(c => c.user_id));
  recipients.add(tree.owner_id);
  recipients.delete(req.user.id);
  for (const uid of recipients) {
    createNotification(uid, 'member_added', `New member added`, `${req.user.display_name} added ${name} to "${tree.tree_name}"`, id);
  }

  res.status(201).json(member);
});

router.get('/:memberId', authenticate, requireTreeAccess('viewer'), (req, res) => {
  const member = db.prepare('SELECT * FROM tree_members WHERE id = ? AND tree_id = ?').get(req.params.memberId, req.params.treeId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  res.json(member);
});

router.patch('/:memberId', authenticate, requireTreeAccess('editor'), (req, res) => {
  const member = db.prepare('SELECT id FROM tree_members WHERE id = ? AND tree_id = ?').get(req.params.memberId, req.params.treeId);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const fields = ['name', 'birth_year', 'death_year', 'birth_place', 'gender', 'bio', 'paternal_parent_id', 'maternal_parent_id', 'spouse_id', 'partner_ids', 'linked_user_id'];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f] || null); }
  }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
  updates.push("updated_at = datetime('now')");
  params.push(req.params.memberId);
  db.prepare(`UPDATE tree_members SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  db.prepare("UPDATE trees SET updated_at = datetime('now') WHERE id = ?").run(req.params.treeId);
  res.json(db.prepare('SELECT * FROM tree_members WHERE id = ?').get(req.params.memberId));
});

router.post('/:memberId/photo', authenticate, requireTreeAccess('editor'), upload.single('photo'), (req, res) => {
  const member = db.prepare('SELECT id FROM tree_members WHERE id = ? AND tree_id = ?').get(req.params.memberId, req.params.treeId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE tree_members SET photo = ? WHERE id = ?').run(url, req.params.memberId);
  res.json({ photo: url });
});

router.delete('/:memberId', authenticate, requireTreeAccess('editor'), (req, res) => {
  const member = db.prepare('SELECT id FROM tree_members WHERE id = ? AND tree_id = ?').get(req.params.memberId, req.params.treeId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  db.prepare('UPDATE tree_members SET paternal_parent_id = NULL WHERE paternal_parent_id = ?').run(req.params.memberId);
  db.prepare('UPDATE tree_members SET maternal_parent_id = NULL WHERE maternal_parent_id = ?').run(req.params.memberId);
  db.prepare('UPDATE tree_members SET spouse_id = NULL WHERE spouse_id = ?').run(req.params.memberId);
  db.prepare('DELETE FROM tree_members WHERE id = ?').run(req.params.memberId);
  res.json({ message: 'Member deleted' });
});

module.exports = router;
