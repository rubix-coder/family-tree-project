const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { authenticate, requireTreeAccess } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

function userCanAccessTree(userId, treeId) {
  const tree = db.prepare('SELECT owner_id, privacy FROM trees WHERE id = ?').get(treeId);
  if (!tree) return false;
  if (tree.owner_id === userId) return true;
  if (tree.privacy === 'public') return true;
  return !!db.prepare('SELECT id FROM tree_collaborators WHERE tree_id = ? AND user_id = ?').get(treeId, userId);
}

router.get('/feed', authenticate, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const posts = db.prepare(`
    SELECT p.*, u.display_name, u.avatar, u.username,
           t.name as tree_name,
           tm.name as member_name,
           (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) as reaction_count,
           (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
           (SELECT type FROM reactions WHERE post_id = p.id AND user_id = ?) as my_reaction
    FROM posts p
    JOIN users u ON p.user_id = u.id
    JOIN trees t ON p.tree_id = t.id
    LEFT JOIN tree_members tm ON p.member_id = tm.id
    WHERE p.tree_id IN (
      SELECT id FROM trees WHERE owner_id = ?
      UNION
      SELECT tree_id FROM tree_collaborators WHERE user_id = ?
    )
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).all(req.user.id, req.user.id, req.user.id, limit, offset);

  res.json({ posts, page, has_more: posts.length === limit });
});

router.get('/trees/:treeId/posts', authenticate, (req, res) => {
  if (!userCanAccessTree(req.user.id, req.params.treeId)) return res.status(403).json({ error: 'Access denied' });
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const posts = db.prepare(`
    SELECT p.*, u.display_name, u.avatar, u.username,
           tm.name as member_name,
           (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) as reaction_count,
           (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
           (SELECT type FROM reactions WHERE post_id = p.id AND user_id = ?) as my_reaction
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN tree_members tm ON p.member_id = tm.id
    WHERE p.tree_id = ?
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).all(req.user.id, req.params.treeId, limit, offset);

  res.json({ posts, page, has_more: posts.length === limit });
});

router.post('/trees/:treeId/posts', authenticate, (req, res) => {
  if (!userCanAccessTree(req.user.id, req.params.treeId)) return res.status(403).json({ error: 'Access denied' });
  const { content, type, member_id } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });

  const id = uuidv4();
  db.prepare('INSERT INTO posts (id, tree_id, user_id, content, type, member_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.params.treeId, req.user.id, content.trim(), type || 'update', member_id || null);

  const tree = db.prepare('SELECT owner_id, name FROM trees WHERE id = ?').get(req.params.treeId);
  const collabs = db.prepare('SELECT user_id FROM tree_collaborators WHERE tree_id = ?').all(req.params.treeId);
  const recipients = new Set(collabs.map(c => c.user_id));
  recipients.add(tree.owner_id);
  recipients.delete(req.user.id);
  for (const uid of recipients) {
    db.prepare('INSERT INTO notifications (id, user_id, type, title, body, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), uid, 'new_post', 'New post in your family tree', `${req.user.display_name} posted in "${tree.name}"`, id, 'post');
  }

  const post = db.prepare(`
    SELECT p.*, u.display_name, u.avatar, u.username, 0 as reaction_count, 0 as comment_count, NULL as my_reaction
    FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?
  `).get(id);
  res.status(201).json(post);
});

router.post('/trees/:treeId/posts/with-image', authenticate, upload.single('image'), (req, res) => {
  if (!userCanAccessTree(req.user.id, req.params.treeId)) return res.status(403).json({ error: 'Access denied' });
  const { content, type, member_id } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });

  const id = uuidv4();
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  db.prepare('INSERT INTO posts (id, tree_id, user_id, content, type, member_id, image) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.params.treeId, req.user.id, content.trim(), type || 'update', member_id || null, imageUrl);

  const post = db.prepare(`
    SELECT p.*, u.display_name, u.avatar, u.username, 0 as reaction_count, 0 as comment_count, NULL as my_reaction
    FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?
  `).get(id);
  res.status(201).json(post);
});

router.delete('/posts/:postId', authenticate, (req, res) => {
  const post = db.prepare('SELECT user_id, tree_id FROM posts WHERE id = ?').get(req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const tree = db.prepare('SELECT owner_id FROM trees WHERE id = ?').get(post.tree_id);
  if (post.user_id !== req.user.id && tree.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.postId);
  res.json({ message: 'Post deleted' });
});

router.get('/posts/:postId/comments', authenticate, (req, res) => {
  const post = db.prepare('SELECT tree_id FROM posts WHERE id = ?').get(req.params.postId);
  if (!post || !userCanAccessTree(req.user.id, post.tree_id)) return res.status(403).json({ error: 'Access denied' });
  const comments = db.prepare(`
    SELECT c.*, u.display_name, u.avatar, u.username
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ? ORDER BY c.created_at ASC
  `).all(req.params.postId);
  res.json(comments);
});

router.post('/posts/:postId/comments', authenticate, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.postId);
  if (!post || !userCanAccessTree(req.user.id, post.tree_id)) return res.status(403).json({ error: 'Access denied' });
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });

  const id = uuidv4();
  db.prepare('INSERT INTO comments (id, post_id, user_id, content) VALUES (?, ?, ?, ?)').run(id, req.params.postId, req.user.id, content.trim());

  if (post.user_id !== req.user.id) {
    db.prepare('INSERT INTO notifications (id, user_id, type, title, body, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), post.user_id, 'comment', 'New comment on your post', `${req.user.display_name} commented on your post`, req.params.postId, 'post');
  }

  const comment = db.prepare('SELECT c.*, u.display_name, u.avatar, u.username FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?').get(id);
  res.status(201).json(comment);
});

router.post('/posts/:postId/react', authenticate, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.postId);
  if (!post || !userCanAccessTree(req.user.id, post.tree_id)) return res.status(403).json({ error: 'Access denied' });

  const existing = db.prepare('SELECT id FROM reactions WHERE post_id = ? AND user_id = ?').get(req.params.postId, req.user.id);
  if (existing) {
    db.prepare('DELETE FROM reactions WHERE id = ?').run(existing.id);
    return res.json({ reacted: false });
  }
  db.prepare('INSERT INTO reactions (id, post_id, user_id, type) VALUES (?, ?, ?, ?)').run(uuidv4(), req.params.postId, req.user.id, 'heart');
  if (post.user_id !== req.user.id) {
    db.prepare('INSERT INTO notifications (id, user_id, type, title, body, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), post.user_id, 'reaction', 'Someone reacted to your post', `${req.user.display_name} reacted to your post`, req.params.postId, 'post');
  }
  res.json({ reacted: true });
});

router.get('/notifications', authenticate, (req, res) => {
  const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
  const unread = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0').get(req.user.id).c;
  res.json({ notifications, unread });
});

router.patch('/notifications/read', authenticate, (req, res) => {
  const { ids } = req.body;
  if (ids && ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`UPDATE notifications SET read = 1 WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, req.user.id);
  } else {
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  }
  res.json({ message: 'Notifications marked as read' });
});

module.exports = router;
