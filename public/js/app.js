/* Main SPA controller */
const App = (() => {
  let currentUser = null;
  let currentTree = null;
  let currentMembers = [];
  let notifPollTimer = null;

  // ── Toast ──────────────────────────────────────────────────────────
  function toast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // ── Navigation ─────────────────────────────────────────────────────
  async function navigate(route, params = {}) {
    const views = ['view-auth', 'view-main', 'view-invite'];
    if (!API.isLoggedIn() && route !== 'invite') {
      showAuth();
      return;
    }
    if (route === 'login' || route === 'register') { showAuth(route); return; }
    if (route === 'invite') { await showInvitePage(params.token); return; }

    document.getElementById('view-auth').style.display = 'none';
    document.getElementById('view-invite').style.display = 'none';
    document.getElementById('view-main').style.display = 'block';
    document.getElementById('app').className = 'ready';

    updateNavActive(route);

    switch (route) {
      case 'dashboard': await renderDashboard(); break;
      case 'trees': await renderTrees(); break;
      case 'tree': await renderTree(params.id); break;
      case 'profile': await renderProfile(); break;
      case 'settings': await renderSettings(); break;
      case 'notifications': await renderNotificationsPage(); break;
      default: await renderDashboard();
    }
  }

  function updateNavActive(route) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const nav = document.querySelector(`[data-nav="${route}"]`);
    if (nav) nav.classList.add('active');
  }

  // ── Auth ───────────────────────────────────────────────────────────
  function showAuth(tab = 'login') {
    document.getElementById('view-main').style.display = 'none';
    document.getElementById('view-invite').style.display = 'none';
    document.getElementById('view-auth').style.display = 'flex';
    document.getElementById('app').className = 'ready';
    switchAuthTab(tab);
  }

  function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('form-login').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';
  }

  async function handleLogin(e) {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    const err = document.getElementById('login-error');
    err.style.display = 'none';
    try {
      const data = await API.auth.login({ login: e.target.login.value, password: e.target.password.value });
      API.setTokens(data.accessToken, data.refreshToken);
      currentUser = data.user;
      localStorage.setItem('current_user', JSON.stringify(currentUser));
      await postLogin();
    } catch (ex) {
      err.textContent = ex.error || 'Login failed'; err.style.display = 'block';
    } finally { btn.disabled = false; btn.textContent = 'Sign In'; }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    const err = document.getElementById('register-error');
    err.style.display = 'none';
    try {
      const data = await API.auth.register({
        username: e.target.username.value, email: e.target.email.value,
        password: e.target.password.value, display_name: e.target.display_name.value
      });
      API.setTokens(data.accessToken, data.refreshToken);
      currentUser = data.user;
      localStorage.setItem('current_user', JSON.stringify(currentUser));
      await postLogin();
    } catch (ex) {
      err.textContent = ex.error || 'Registration failed'; err.style.display = 'block';
    } finally { btn.disabled = false; btn.textContent = 'Create Account'; }
  }

  async function postLogin() {
    updateHeaderUser();
    startNotifPoll();
    await navigate('dashboard');
  }

  async function logout() {
    const refresh = localStorage.getItem('refresh_token');
    try { await API.auth.logout(refresh); } catch {}
    API.clearTokens();
    currentUser = null;
    stopNotifPoll();
    showAuth('login');
    toast('Signed out successfully');
  }

  // ── Header ─────────────────────────────────────────────────────────
  function updateHeaderUser() {
    const u = currentUser;
    if (!u) return;
    const btn = document.getElementById('avatar-btn');
    btn.innerHTML = `${avatarHTML(u, 'sm')} <span class="text-sm hidden-mobile">${u.display_name}</span>`;
  }

  function avatarHTML(user, size = 'sm') {
    if (!user) return '';
    if (user.avatar) return `<img src="${user.avatar}" class="avatar-${size}" alt="${user.display_name}">`;
    const initials = user.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    return `<div class="avatar-${size}">${initials}</div>`;
  }

  // ── Notifications ──────────────────────────────────────────────────
  function startNotifPoll() {
    pollNotifications();
    notifPollTimer = setInterval(pollNotifications, 30000);
  }

  function stopNotifPoll() { clearInterval(notifPollTimer); }

  async function pollNotifications() {
    try {
      const data = await API.social.notifications();
      const badge = document.getElementById('notif-badge');
      if (data.unread > 0) {
        badge.textContent = data.unread > 9 ? '9+' : data.unread;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    } catch {}
  }

  function toggleNotifDropdown() {
    const dd = document.getElementById('notif-dropdown');
    dd.classList.toggle('open');
    if (dd.classList.contains('open')) renderNotificationsDropdown();
  }

  async function renderNotificationsDropdown() {
    const dd = document.getElementById('notif-dropdown');
    dd.innerHTML = `<div class="notif-header">Notifications <button class="btn btn-ghost btn-sm" onclick="App.markAllRead()">Mark all read</button></div><div class="loading-screen"><span class="spinner"></span></div>`;
    try {
      const data = await API.social.notifications();
      let html = `<div class="notif-header">Notifications <button class="btn btn-ghost btn-sm" onclick="App.markAllRead()">Mark all read</button></div>`;
      if (!data.notifications.length) {
        html += `<div style="padding:1.5rem;text-align:center;color:var(--gray-400)">No notifications yet</div>`;
      } else {
        html += data.notifications.map(n => `
          <div class="notif-item ${n.read ? '' : 'unread'}">
            <div class="notif-dot ${n.read ? 'read' : ''}"></div>
            <div class="notif-text">
              <div class="notif-title">${escapeHtml(n.title)}</div>
              ${n.body ? `<div class="notif-body">${escapeHtml(n.body)}</div>` : ''}
              <div class="notif-time">${timeAgo(n.created_at)}</div>
            </div>
          </div>`).join('');
      }
      dd.innerHTML = html;
    } catch {}
  }

  async function markAllRead() {
    await API.social.markRead();
    document.getElementById('notif-badge').style.display = 'none';
    renderNotificationsDropdown();
  }

  // ── Dashboard ──────────────────────────────────────────────────────
  async function renderDashboard() {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="loading-screen"><span class="spinner"></span></div>`;
    try {
      const [treesData, feedData] = await Promise.all([API.trees.list(), API.social.feed()]);
      const allTrees = [...treesData.owned, ...treesData.collaborating];
      const treeMap = {};
      allTrees.forEach(t => treeMap[t.id] = t);

      main.innerHTML = `
        <div class="page-header">
          <div><div class="page-title">Welcome back, ${escapeHtml(currentUser.display_name.split(' ')[0])} 👋</div>
          <div class="page-subtitle">Here's what's happening in your family trees</div></div>
        </div>
        ${allTrees.length === 0 ? renderDashboardEmpty() : ''}
        ${allTrees.length > 0 ? `
        <div class="flex gap-3 mb-4" style="overflow-x:auto;padding-bottom:.25rem">
          ${allTrees.slice(0, 6).map(t => `
            <div class="card" style="flex-shrink:0;padding:.75rem 1rem;cursor:pointer;min-width:160px" onclick="App.navigate('tree',{id:'${t.id}'})">
              <div class="font-bold text-sm text-navy">${escapeHtml(t.name)}</div>
              <div class="text-xs text-muted mt-1">${t.member_count} members</div>
            </div>`).join('')}
        </div>` : ''}
        <div class="feed-compose" id="feed-compose-wrap">
          <div class="compose-row">
            ${avatarHTML(currentUser, 'sm')}
            <textarea class="compose-input" id="compose-text" placeholder="Share a memory or update with your family..." rows="2"></textarea>
          </div>
          <div class="compose-actions">
            <div class="compose-tools">
              <select class="form-control" id="compose-tree" style="font-size:.82rem;padding:.35rem .6rem">
                <option value="">Select tree...</option>
                ${allTrees.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
              </select>
              <select class="form-control" id="compose-type" style="font-size:.82rem;padding:.35rem .6rem">
                <option value="update">Update</option>
                <option value="memory">Memory</option>
                <option value="milestone">Milestone</option>
              </select>
            </div>
            <button class="btn btn-primary btn-sm" onclick="App.submitPost()">Post</button>
          </div>
        </div>
        <div id="feed-container">${renderPostCards(feedData.posts, treeMap)}</div>
        ${feedData.has_more ? `<button class="btn btn-outline btn-full mt-3" onclick="App.loadMoreFeed(2)">Load More</button>` : ''}`;
    } catch (ex) {
      main.innerHTML = `<div class="alert alert-error">Failed to load dashboard: ${ex.error || ex.message}</div>`;
    }
  }

  function renderDashboardEmpty() {
    return `<div class="card mb-4"><div class="card-body"><div class="empty-state">
      <span class="empty-icon">🌳</span><h3>Start Your Family Story</h3>
      <p>Create your first family tree and invite your relatives to join.</p>
      <button class="btn btn-primary" onclick="App.showCreateTree()">Create Family Tree</button>
    </div></div></div>`;
  }

  async function submitPost() {
    const content = document.getElementById('compose-text').value.trim();
    const treeId = document.getElementById('compose-tree').value;
    const type = document.getElementById('compose-type').value;
    if (!content) return toast('Write something first', 'error');
    if (!treeId) return toast('Select a family tree', 'error');
    try {
      await API.social.createPost(treeId, { content, type });
      document.getElementById('compose-text').value = '';
      toast('Posted!', 'success');
      renderDashboard();
    } catch (ex) { toast(ex.error || 'Failed to post', 'error'); }
  }

  function renderPostCards(posts, treeMap = {}) {
    if (!posts.length) return `<div class="empty-state"><span class="empty-icon">📰</span><h3>No posts yet</h3><p>Be the first to share a memory or update.</p></div>`;
    return posts.map(p => renderPostCard(p, treeMap)).join('');
  }

  function renderPostCard(p, treeMap = {}) {
    const treeName = p.tree_name || (treeMap[p.tree_id] ? treeMap[p.tree_id].name : '');
    return `<div class="post-card" id="post-${p.id}">
      <div class="post-header">
        ${p.avatar ? `<img src="${p.avatar}" class="avatar-sm" alt="${escapeHtml(p.display_name)}">` : `<div class="avatar-sm">${escapeHtml(p.display_name.slice(0,2))}</div>`}
        <div style="flex:1">
          <div class="font-bold text-sm">${escapeHtml(p.display_name)} <span class="text-muted text-xs">in</span> <span class="text-gold text-xs font-bold">${escapeHtml(treeName)}</span>
            <span class="post-type-badge type-${p.type}">${p.type}</span></div>
          <div class="text-xs text-muted">${timeAgo(p.created_at)}</div>
        </div>
        ${p.user_id === currentUser.id ? `<button class="btn btn-ghost btn-sm" onclick="App.deletePost('${p.id}')">✕</button>` : ''}
      </div>
      <div class="post-body">${escapeHtml(p.content)}</div>
      ${p.image ? `<img src="${p.image}" class="post-image" alt="post image">` : ''}
      <div class="post-footer">
        <button class="post-action-btn ${p.my_reaction ? 'reacted' : ''}" onclick="App.reactPost('${p.id}', this)">
          ❤️ <span class="react-count">${p.reaction_count || 0}</span>
        </button>
        <button class="post-action-btn" onclick="App.toggleComments('${p.id}')">
          💬 <span>${p.comment_count || 0}</span>
        </button>
      </div>
      <div class="post-comments" id="comments-${p.id}">
        <div id="comments-list-${p.id}"></div>
        <div class="comment-form">
          ${avatarHTML(currentUser, 'sm')}
          <input class="comment-input" placeholder="Write a comment..." onkeydown="if(event.key==='Enter')App.addComment('${p.id}',this)">
        </div>
      </div>
    </div>`;
  }

  async function reactPost(postId, btn) {
    try {
      const data = await API.social.react(postId);
      btn.classList.toggle('reacted', data.reacted);
      const countEl = btn.querySelector('.react-count');
      if (countEl) countEl.textContent = parseInt(countEl.textContent) + (data.reacted ? 1 : -1);
    } catch {}
  }

  async function toggleComments(postId) {
    const panel = document.getElementById(`comments-${postId}`);
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      const listEl = document.getElementById(`comments-list-${postId}`);
      listEl.innerHTML = `<div class="text-xs text-muted" style="padding:.5rem">Loading...</div>`;
      try {
        const comments = await API.social.comments(postId);
        listEl.innerHTML = comments.length ? comments.map(c => `
          <div class="comment-item">
            ${c.avatar ? `<img src="${c.avatar}" class="avatar-sm" alt="">` : `<div class="avatar-sm">${escapeHtml(c.display_name.slice(0,2))}</div>`}
            <div class="comment-bubble">
              <div class="comment-author">${escapeHtml(c.display_name)}</div>
              <div class="comment-text">${escapeHtml(c.content)}</div>
            </div>
          </div>`).join('') : `<div class="text-xs text-muted" style="padding:.5rem">No comments yet.</div>`;
      } catch {}
    }
  }

  async function addComment(postId, input) {
    const content = input.value.trim();
    if (!content) return;
    input.value = '';
    try {
      const c = await API.social.addComment(postId, content);
      const listEl = document.getElementById(`comments-list-${postId}`);
      const item = document.createElement('div');
      item.className = 'comment-item';
      item.innerHTML = `
        ${c.avatar ? `<img src="${c.avatar}" class="avatar-sm" alt="">` : `<div class="avatar-sm">${escapeHtml(c.display_name.slice(0,2))}</div>`}
        <div class="comment-bubble">
          <div class="comment-author">${escapeHtml(c.display_name)}</div>
          <div class="comment-text">${escapeHtml(c.content)}</div>
        </div>`;
      listEl.appendChild(item);
    } catch (ex) { toast(ex.error || 'Failed to comment', 'error'); }
  }

  async function deletePost(postId) {
    if (!confirm('Delete this post?')) return;
    try {
      await API.social.deletePost(postId);
      document.getElementById(`post-${postId}`)?.remove();
      toast('Post deleted');
    } catch (ex) { toast(ex.error || 'Failed to delete', 'error'); }
  }

  // ── Trees Page ─────────────────────────────────────────────────────
  async function renderTrees() {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="loading-screen"><span class="spinner"></span></div>`;
    try {
      const data = await API.trees.list();
      main.innerHTML = `
        <div class="page-header">
          <div><div class="page-title">Family Trees</div>
          <div class="page-subtitle">Your family trees and ones you collaborate on</div></div>
          <button class="btn btn-primary" onclick="App.showCreateTree()">+ New Tree</button>
        </div>
        ${data.owned.length || data.collaborating.length ? '' : renderTreesEmpty()}
        ${data.owned.length ? `<div class="font-bold text-sm text-muted mb-3 mt-1">YOUR TREES</div>
        <div class="trees-grid mb-4">${data.owned.map(renderTreeCard).join('')}
          <div class="new-tree-card" onclick="App.showCreateTree()"><div class="icon">+</div><div class="text-sm">New Family Tree</div></div>
        </div>` : ''}
        ${data.collaborating.length ? `<div class="font-bold text-sm text-muted mb-3 mt-1">COLLABORATING</div>
        <div class="trees-grid">${data.collaborating.map(renderTreeCard).join('')}</div>` : ''}`;
    } catch (ex) {
      main.innerHTML = `<div class="alert alert-error">Failed to load trees</div>`;
    }
  }

  function renderTreesEmpty() {
    return `<div class="card mb-4"><div class="card-body"><div class="empty-state">
      <span class="empty-icon">🌳</span><h3>No family trees yet</h3>
      <p>Create your first tree to start building your family history.</p>
      <button class="btn btn-primary" onclick="App.showCreateTree()">Create Family Tree</button>
    </div></div></div>`;
  }

  function renderTreeCard(tree) {
    const privacy = tree.privacy || 'family';
    const isOwner = tree.owner_id === currentUser.id;
    return `<div class="tree-card" onclick="App.navigate('tree',{id:'${tree.id}'})">
      <div class="tree-card-cover">
        ${tree.cover_photo ? `<img src="${tree.cover_photo}" alt="">` : `<div class="tree-card-icon">🌳</div>`}
      </div>
      <div class="tree-card-body">
        <div class="tree-card-name">${escapeHtml(tree.name)}</div>
        <div class="tree-card-meta">
          <span>👥 ${tree.member_count || 0} members</span>
          <span>🤝 ${tree.collaborator_count || 0} collaborators</span>
        </div>
        ${tree.description ? `<div class="text-sm text-muted mt-2">${escapeHtml(tree.description.slice(0, 80))}${tree.description.length > 80 ? '...' : ''}</div>` : ''}
      </div>
      <div class="tree-card-footer">
        <span class="tree-privacy-badge privacy-${privacy}">${privacy}</span>
        ${!isOwner ? `<span class="tree-role-badge">${tree.my_role}</span>` : '<span class="tree-role-badge" style="background:rgba(201,168,76,.15);color:#8a6a10">owner</span>'}
      </div>
    </div>`;
  }

  // ── Tree View ──────────────────────────────────────────────────────
  async function renderTree(treeId) {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="loading-screen"><span class="spinner"></span></div>`;
    try {
      const [tree, members] = await Promise.all([API.trees.get(treeId), API.members.list(treeId)]);
      currentTree = tree;
      currentMembers = members;

      main.innerHTML = `
        <div class="page-header">
          <div>
            <div class="flex items-center gap-2">
              <button class="btn btn-ghost btn-sm" onclick="App.navigate('trees')">← Back</button>
              <div class="page-title">${escapeHtml(tree.name)}</div>
              <span class="tree-privacy-badge privacy-${tree.privacy}">${tree.privacy}</span>
            </div>
            <div class="page-subtitle">${tree.member_count} members · managed by ${escapeHtml(tree.owner_name)}</div>
          </div>
          <div class="flex gap-2 flex-wrap">
            ${tree.my_role !== 'viewer' ? `<button class="btn btn-primary btn-sm" onclick="App.showAddMember()">+ Add Member</button>` : ''}
            <button class="btn btn-outline btn-sm" onclick="App.showInviteModal('${tree.id}')">Invite</button>
            ${tree.owner_id === currentUser.id ? `<button class="btn btn-ghost btn-sm" onclick="App.showTreeSettings('${tree.id}')">⚙️ Settings</button>` : ''}
          </div>
        </div>
        <div class="tree-viewer">
          <div class="tree-tabs">
            <div class="tree-tab active" onclick="App.switchTreeTab('viz', this)">🌳 Tree View</div>
            <div class="tree-tab" onclick="App.switchTreeTab('list', this)">👥 Members</div>
            <div class="tree-tab" onclick="App.switchTreeTab('feed', this)">📰 Feed</div>
            <div class="tree-tab" onclick="App.switchTreeTab('collab', this)">🤝 People</div>
          </div>
          <div id="tree-tab-viz"><div id="tree-canvas"></div></div>
          <div id="tree-tab-list" style="display:none;padding:1.25rem"><div id="members-list-container"></div></div>
          <div id="tree-tab-feed" style="display:none;padding:1.25rem"><div id="tree-feed-container"></div></div>
          <div id="tree-tab-collab" style="display:none;padding:1.25rem"><div id="collab-container"></div></div>
        </div>`;

      TreeViz.init(treeId, members, tree.my_role, (memberId) => showMemberDetail(memberId));
    } catch (ex) {
      main.innerHTML = `<div class="alert alert-error">Failed to load tree: ${ex.error || ex.message}</div>`;
    }
  }

  async function switchTreeTab(tab, el) {
    document.querySelectorAll('.tree-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    ['viz', 'list', 'feed', 'collab'].forEach(t => {
      const el = document.getElementById(`tree-tab-${t}`);
      if (el) el.style.display = t === tab ? 'block' : 'none';
    });
    if (tab === 'list') await renderMembersList();
    if (tab === 'feed') await renderTreeFeed();
    if (tab === 'collab') await renderCollaborators();
  }

  async function renderMembersList() {
    const container = document.getElementById('members-list-container');
    container.innerHTML = `<div class="loading-screen"><span class="spinner"></span></div>`;
    try {
      const members = await API.members.list(currentTree.id);
      currentMembers = members;
      if (!members.length) {
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">👨‍👩‍👧</span><h3>No members yet</h3><p>Add your first family member to get started.</p>${currentTree.my_role !== 'viewer' ? '<button class="btn btn-primary" onclick="App.showAddMember()">Add Member</button>' : ''}</div>`;
        return;
      }
      container.innerHTML = `<div class="members-list">${members.map(m => `
        <div class="member-item" onclick="App.showMemberDetail('${m.id}')">
          <div class="member-photo" style="background:${m.gender === 'male' ? 'rgba(59,130,246,.15)' : m.gender === 'female' ? 'rgba(236,72,153,.15)' : 'rgba(139,92,246,.15)'}">
            ${m.photo ? `<img src="${m.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : `<span style="font-size:1rem">${m.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</span>`}
          </div>
          <div class="member-info">
            <div class="member-name">${escapeHtml(m.name)}</div>
            <div class="member-meta">${[m.birth_year ? `b. ${m.birth_year}` : '', m.death_year ? `d. ${m.death_year}` : '', m.birth_place || ''].filter(Boolean).join(' · ')}</div>
          </div>
          <span class="gender-badge gender-${m.gender || 'other'}"></span>
        </div>`).join('')}</div>`;
    } catch {}
  }

  async function renderTreeFeed() {
    const container = document.getElementById('tree-feed-container');
    container.innerHTML = `<div class="loading-screen"><span class="spinner"></span></div>`;
    try {
      const data = await API.social.treePosts(currentTree.id);
      container.innerHTML = `
        <div class="feed-compose mb-4">
          <div class="compose-row">
            ${avatarHTML(currentUser, 'sm')}
            <textarea class="compose-input" id="tree-compose-text" placeholder="Share something with this family tree..." rows="2"></textarea>
          </div>
          <div class="compose-actions">
            <select class="form-control" id="tree-compose-type" style="font-size:.82rem;padding:.35rem .6rem">
              <option value="update">Update</option>
              <option value="memory">Memory</option>
              <option value="milestone">Milestone</option>
            </select>
            <button class="btn btn-primary btn-sm" onclick="App.submitTreePost('${currentTree.id}')">Post</button>
          </div>
        </div>
        <div id="tree-feed-posts">${renderPostCards(data.posts)}</div>`;
    } catch {}
  }

  async function submitTreePost(treeId) {
    const content = document.getElementById('tree-compose-text').value.trim();
    const type = document.getElementById('tree-compose-type').value;
    if (!content) return toast('Write something first', 'error');
    try {
      await API.social.createPost(treeId, { content, type });
      document.getElementById('tree-compose-text').value = '';
      toast('Posted!', 'success');
      renderTreeFeed();
    } catch (ex) { toast(ex.error || 'Failed to post', 'error'); }
  }

  async function renderCollaborators() {
    const container = document.getElementById('collab-container');
    container.innerHTML = `<div class="loading-screen"><span class="spinner"></span></div>`;
    try {
      const tree = await API.trees.get(currentTree.id);
      let html = `<div class="font-bold mb-3">Owner</div>
        <div class="collab-item">
          <div class="avatar-sm">${tree.owner_name.slice(0,2).toUpperCase()}</div>
          <div style="flex:1"><div class="font-bold text-sm">${escapeHtml(tree.owner_name)}</div><div class="text-xs text-muted">@${escapeHtml(tree.owner_username)}</div></div>
          <span class="tree-role-badge" style="background:rgba(201,168,76,.15);color:#8a6a10">owner</span>
        </div>`;

      if (tree.collaborators.length) {
        html += `<hr class="divider"><div class="font-bold mb-3">Collaborators (${tree.collaborators.length})</div>`;
        html += tree.collaborators.map(c => `
          <div class="collab-item">
            ${c.avatar ? `<img src="${c.avatar}" class="avatar-sm" alt="">` : `<div class="avatar-sm">${c.display_name.slice(0,2).toUpperCase()}</div>`}
            <div style="flex:1"><div class="font-bold text-sm">${escapeHtml(c.display_name)}</div><div class="text-xs text-muted">@${escapeHtml(c.username)} · ${c.role}</div></div>
            ${tree.owner_id === currentUser.id ? `<button class="btn btn-danger btn-sm" onclick="App.removeCollaborator('${c.id}')">Remove</button>` : ''}
          </div>`).join('');
      }

      html += `<hr class="divider"><button class="btn btn-primary" onclick="App.showInviteModal('${currentTree.id}')">+ Invite People</button>`;
      container.innerHTML = html;
    } catch {}
  }

  async function removeCollaborator(userId) {
    if (!confirm('Remove this collaborator?')) return;
    try {
      await API.trees.removeCollaborator(currentTree.id, userId);
      toast('Collaborator removed');
      renderCollaborators();
    } catch (ex) { toast(ex.error || 'Failed to remove', 'error'); }
  }

  // ── Member Detail ──────────────────────────────────────────────────
  function showMemberDetail(memberId) {
    const member = currentMembers.find(m => m.id === memberId);
    if (!member) return;

    const getRelation = (id) => id ? (currentMembers.find(m => m.id === id) || null) : null;
    const father = getRelation(member.paternal_parent_id);
    const mother = getRelation(member.maternal_parent_id);
    const spouse = getRelation(member.spouse_id);
    const children = currentMembers.filter(m => m.paternal_parent_id === memberId || m.maternal_parent_id === memberId);

    const initials = member.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const photoHTML = member.photo ? `<img src="${member.photo}" class="member-detail-photo" alt="">` : `<div class="member-detail-photo">${initials}</div>`;

    const lifespan = [member.birth_year ? `b. ${member.birth_year}` : '', member.death_year ? `d. ${member.death_year}` : ''].filter(Boolean).join(' — ');

    const relations = [];
    if (father) relations.push(`<div class="relation-item"><span class="relation-label">Father</span><span onclick="App.showMemberDetail('${father.id}')" style="cursor:pointer;color:var(--navy);font-weight:600">${escapeHtml(father.name)}</span></div>`);
    if (mother) relations.push(`<div class="relation-item"><span class="relation-label">Mother</span><span onclick="App.showMemberDetail('${mother.id}')" style="cursor:pointer;color:var(--navy);font-weight:600">${escapeHtml(mother.name)}</span></div>`);
    if (spouse) relations.push(`<div class="relation-item"><span class="relation-label">Spouse</span><span onclick="App.showMemberDetail('${spouse.id}')" style="cursor:pointer;color:var(--navy);font-weight:600">${escapeHtml(spouse.name)}</span></div>`);
    if (children.length) relations.push(`<div class="relation-item"><span class="relation-label">Children</span><span>${children.map(c => `<span onclick="App.showMemberDetail('${c.id}')" style="cursor:pointer;color:var(--navy);font-weight:600">${escapeHtml(c.name)}</span>`).join(', ')}</span></div>`);

    const canEdit = currentTree && currentTree.my_role !== 'viewer';

    openModal('member-detail-modal', `
      <div class="member-detail-header">
        ${photoHTML}
        <div class="member-detail-info">
          <h2>${escapeHtml(member.name)}</h2>
          <div class="member-detail-tags">
            ${lifespan ? `<span class="tag">📅 ${lifespan}</span>` : ''}
            ${member.gender ? `<span class="tag">${member.gender === 'male' ? '♂' : member.gender === 'female' ? '♀' : '⚧'} ${member.gender}</span>` : ''}
            ${member.birth_place ? `<span class="tag">📍 ${escapeHtml(member.birth_place)}</span>` : ''}
          </div>
        </div>
      </div>
      ${member.bio ? `<p style="margin-bottom:1rem;color:var(--gray-600);font-size:.92rem">${escapeHtml(member.bio)}</p>` : ''}
      ${relations.length ? `<div class="member-relations">${relations.join('')}</div>` : ''}
      ${canEdit ? `<div class="flex gap-2 mt-4">
        <button class="btn btn-primary btn-sm" onclick="App.showEditMember('${memberId}')">Edit</button>
        <button class="btn btn-outline btn-sm" onclick="App.uploadMemberPhoto('${memberId}')">📷 Photo</button>
        <button class="btn btn-danger btn-sm" onclick="App.deleteMember('${memberId}')">Delete</button>
      </div>` : ''}`,
      member.name);
  }

  // ── Add / Edit Member ──────────────────────────────────────────────
  function showAddMember() {
    App._memberEntries = 1;
    openModal('member-form-modal', _buildMultiMemberBody(), 'Add Family Member(s)');
  }

  function _memberEntryHTML(index) {
    const others = currentMembers;
    const opt = (m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`;
    const sep = index > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-top:2px solid var(--gray-100);margin-top:.75rem">
      <strong style="font-size:.82rem;color:var(--gray-500)">Member ${index + 1}</strong>
      <button type="button" class="btn btn-ghost btn-sm" style="color:var(--red);padding:.2rem .5rem" onclick="App._removeMemberEntry(${index})">✕ Remove</button>
    </div>` : '';
    return `<div class="member-entry" id="member-entry-${index}">${sep}
      <div class="form-group"><label>Full Name${index === 0 ? ' *' : ''}</label><input name="me_name_${index}" class="form-control" placeholder="Full name" ${index === 0 ? 'required' : ''}></div>
      <div class="form-row">
        <div class="form-group"><label>Gender</label>
          <select name="me_gender_${index}" class="form-control">
            <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
          </select></div>
        <div class="form-group"><label>Birth Year</label><input name="me_birth_year_${index}" class="form-control" type="number" min="1" max="2025" placeholder="e.g. 1985"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Death Year</label><input name="me_death_year_${index}" class="form-control" type="number" min="1" max="2025"></div>
        <div class="form-group"><label>Birth Place</label><input name="me_birth_place_${index}" class="form-control" placeholder="City, Country"></div>
      </div>
      ${others.length ? `
      <div class="form-group"><label>Father (Paternal Parent)</label>
        <select name="me_paternal_${index}" class="form-control"><option value="">— none —</option>${others.map(opt).join('')}</select></div>
      <div class="form-group"><label>Mother (Maternal Parent)</label>
        <select name="me_maternal_${index}" class="form-control"><option value="">— none —</option>${others.map(opt).join('')}</select></div>
      <div class="form-group"><label>Spouse / Partner</label>
        <select name="me_spouse_${index}" class="form-control"><option value="">— none —</option>${others.map(opt).join('')}</select></div>
      ` : ''}
      <div class="form-group"><label>Biography</label><textarea name="me_bio_${index}" class="form-control" rows="2" placeholder="Optional short bio"></textarea></div>
    </div>`;
  }

  function _buildMultiMemberBody() {
    let entries = '';
    for (let i = 0; i < (App._memberEntries || 1); i++) entries += _memberEntryHTML(i);
    const atMax = (App._memberEntries || 1) >= 6;
    return `<div id="multi-member-entries">${entries}</div>
      <button type="button" class="btn btn-ghost btn-sm" id="add-entry-btn" onclick="App._addMemberEntry()" style="margin-top:.5rem" ${atMax ? 'disabled' : ''}>+ Add another member</button>
      <div class="modal-footer" style="padding:0;margin-top:1rem">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal('member-form-modal')">Cancel</button>
        <button type="button" class="btn btn-primary" onclick="App.saveMultipleMembers()">Save Member(s)</button>
      </div>`;
  }

  App._addMemberEntry = function() {
    if ((App._memberEntries || 1) >= 6) return;
    App._memberEntries = (App._memberEntries || 1) + 1;
    const container = document.getElementById('multi-member-entries');
    if (container) {
      const div = document.createElement('div');
      div.innerHTML = _memberEntryHTML(App._memberEntries - 1);
      container.appendChild(div.firstElementChild);
    }
    if (App._memberEntries >= 6) {
      const btn = document.getElementById('add-entry-btn');
      if (btn) btn.disabled = true;
    }
  };

  App._removeMemberEntry = function(index) {
    const el = document.getElementById(`member-entry-${index}`);
    if (el) { el.remove(); App._memberEntries = Math.max(1, (App._memberEntries || 1) - 1); }
    const btn = document.getElementById('add-entry-btn');
    if (btn) btn.disabled = false;
  };

  async function saveMultipleMembers() {
    const container = document.getElementById('multi-member-entries');
    if (!container) return;
    const entries = [];
    container.querySelectorAll('.member-entry').forEach(el => {
      const g = (n) => (el.querySelector(`[name="${n}"]`) || {}).value?.trim() || null;
      const name = g(el.querySelector('[name^="me_name_"]')?.name);
      if (!name) return;
      const idx = el.querySelector('[name^="me_name_"]').name.replace('me_name_', '');
      entries.push({
        name,
        gender: g(`me_gender_${idx}`) || 'male',
        birth_year: g(`me_birth_year_${idx}`),
        death_year: g(`me_death_year_${idx}`),
        birth_place: g(`me_birth_place_${idx}`),
        paternal_parent_id: g(`me_paternal_${idx}`),
        maternal_parent_id: g(`me_maternal_${idx}`),
        spouse_id: g(`me_spouse_${idx}`),
        bio: g(`me_bio_${idx}`)
      });
    });
    if (!entries.length) return toast('Enter at least one name', 'error');
    const btn = document.querySelector('#member-form-modal .btn-primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…'; }
    try {
      for (const e of entries) await API.members.create(currentTree.id, e);
      toast(`${entries.length} member${entries.length > 1 ? 's' : ''} added`, 'success');
      closeModal('member-form-modal');
      const mems = await API.members.list(currentTree.id);
      currentMembers = mems;
      TreeViz.update(mems);
    } catch (ex) {
      toast(ex.error || 'Failed to save', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Save Member(s)'; }
    }
  }

  function showEditMember(memberId) {
    const member = currentMembers.find(m => m.id === memberId);
    openModal('member-form-modal', renderMemberForm(member, currentMembers), 'Edit Member');
  }

  function renderMemberForm(member, members) {
    const others = member ? members.filter(m => m.id !== member.id) : members;
    const opt = (m) => `<option value="${m.id}" ${member && member.paternal_parent_id === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`;
    const optMat = (m) => `<option value="${m.id}" ${member && member.maternal_parent_id === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`;
    const optSp = (m) => `<option value="${m.id}" ${member && member.spouse_id === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`;

    return `<form id="member-form" onsubmit="App.saveMember(event, '${member ? member.id : ''}')">
      <div class="form-group"><label>Full Name *</label><input name="name" class="form-control" value="${member ? escapeHtml(member.name) : ''}" required></div>
      <div class="form-row">
        <div class="form-group"><label>Gender</label>
          <select name="gender" class="form-control">
            <option value="male" ${!member || member.gender === 'male' ? 'selected' : ''}>Male</option>
            <option value="female" ${member && member.gender === 'female' ? 'selected' : ''}>Female</option>
            <option value="other" ${member && member.gender === 'other' ? 'selected' : ''}>Other</option>
          </select></div>
        <div class="form-group"><label>Birth Year</label><input name="birth_year" class="form-control" type="number" min="1" max="2025" value="${member && member.birth_year ? member.birth_year : ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Death Year</label><input name="death_year" class="form-control" type="number" min="1" max="2025" value="${member && member.death_year ? member.death_year : ''}"></div>
        <div class="form-group"><label>Birth Place</label><input name="birth_place" class="form-control" value="${member && member.birth_place ? escapeHtml(member.birth_place) : ''}"></div>
      </div>
      ${others.length ? `
      <div class="form-group"><label>Father (Paternal Parent)</label>
        <select name="paternal_parent_id" class="form-control"><option value="">— none —</option>${others.map(opt).join('')}</select></div>
      <div class="form-group"><label>Mother (Maternal Parent)</label>
        <select name="maternal_parent_id" class="form-control"><option value="">— none —</option>${others.map(optMat).join('')}</select></div>
      <div class="form-group"><label>Spouse / Partner</label>
        <select name="spouse_id" class="form-control"><option value="">— none —</option>${others.map(optSp).join('')}</select></div>
      ` : ''}
      <div class="form-group"><label>Biography</label><textarea name="bio" class="form-control" rows="3">${member && member.bio ? escapeHtml(member.bio) : ''}</textarea></div>
      <div class="modal-footer" style="padding:0;margin-top:1rem">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal('member-form-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Member</button>
      </div>
    </form>`;
  }

  async function saveMember(e, memberId) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {};
    fd.forEach((v, k) => { data[k] = v.trim() || null; });
    try {
      if (memberId) {
        await API.members.update(currentTree.id, memberId, data);
        toast('Member updated', 'success');
      } else {
        await API.members.create(currentTree.id, data);
        toast('Member added', 'success');
      }
      closeModal('member-form-modal');
      const members = await API.members.list(currentTree.id);
      currentMembers = members;
      TreeViz.update(members);
    } catch (ex) { toast(ex.error || 'Failed to save', 'error'); }
  }

  async function deleteMember(memberId) {
    if (!confirm('Delete this family member? This cannot be undone.')) return;
    try {
      await API.members.delete(currentTree.id, memberId);
      toast('Member deleted');
      closeModal('member-detail-modal');
      closeModal('member-form-modal');
      const members = await API.members.list(currentTree.id);
      currentMembers = members;
      TreeViz.update(members);
    } catch (ex) { toast(ex.error || 'Failed to delete', 'error'); }
  }

  function uploadMemberPhoto(memberId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const fd = new FormData();
      fd.append('photo', input.files[0]);
      try {
        const data = await API.members.uploadPhoto(currentTree.id, memberId, fd);
        const m = currentMembers.find(m => m.id === memberId);
        if (m) m.photo = data.photo;
        toast('Photo updated', 'success');
        closeModal('member-detail-modal');
        TreeViz.update(currentMembers);
      } catch (ex) { toast(ex.error || 'Upload failed', 'error'); }
    };
    input.click();
  }

  // ── Create Tree Modal ──────────────────────────────────────────────
  function showCreateTree() {
    openModal('create-tree-modal', `
      <form id="create-tree-form" onsubmit="App.createTree(event)">
        <div class="form-group"><label>Tree Name *</label><input name="name" class="form-control" placeholder="e.g. The Johnson Family" required></div>
        <div class="form-group"><label>Description</label><textarea name="description" class="form-control" rows="2" placeholder="A brief description..."></textarea></div>
        <div class="form-group"><label>Privacy</label>
          <select name="privacy" class="form-control">
            <option value="family">Family — only invited members</option>
            <option value="private">Private — only you</option>
            <option value="public">Public — visible to everyone</option>
          </select></div>
        <div class="modal-footer" style="padding:0;margin-top:1rem">
          <button type="button" class="btn btn-ghost" onclick="App.closeModal('create-tree-modal')">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Tree</button>
        </div>
      </form>`, 'Create Family Tree');
  }

  async function createTree(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { name: fd.get('name'), description: fd.get('description'), privacy: fd.get('privacy') };
    try {
      const tree = await API.trees.create(data);
      toast('Family tree created!', 'success');
      closeModal('create-tree-modal');
      navigate('tree', { id: tree.id });
    } catch (ex) { toast(ex.error || 'Failed to create tree', 'error'); }
  }

  // ── Invite Modal ───────────────────────────────────────────────────
  function showInviteModal(treeId) {
    openModal('invite-modal', `
      <div id="invite-form-area">
        <div class="form-group">
          <label>Invite by Username or Email</label>
          <div class="flex gap-2">
            <input id="invite-target" class="form-control" placeholder="username or email address" style="flex:1">
            <button class="btn btn-primary" onclick="App.sendInvite('${treeId}')">Send Invite</button>
          </div>
          <div class="form-hint">They'll receive a notification to join your tree</div>
        </div>
        <div class="form-group">
          <label>Role</label>
          <select id="invite-role" class="form-control">
            <option value="editor">Editor — can add/edit members</option>
            <option value="viewer">Viewer — read only</option>
          </select>
        </div>
        <div class="form-group">
          <label>Personal Message (optional)</label>
          <textarea id="invite-message" class="form-control" rows="2" placeholder="I'd love you to join our family tree!"></textarea>
        </div>
      </div>
      <div id="invite-result" style="display:none">
        <div class="alert alert-success">Invitation sent! Share this link too:</div>
        <div class="invite-link-box" id="invite-link-display"></div>
        <button class="btn btn-outline btn-sm mt-2" onclick="App.copyInviteLink()">📋 Copy Link</button>
      </div>`, 'Invite to Family Tree');
  }

  async function sendInvite(treeId) {
    const target = document.getElementById('invite-target').value.trim();
    const role = document.getElementById('invite-role').value;
    const message = document.getElementById('invite-message').value.trim();
    if (!target) return toast('Enter a username or email', 'error');
    const data = { role, message };
    if (target.includes('@')) data.email = target; else data.username = target;
    try {
      const result = await API.invitations.invite(treeId, data);
      document.getElementById('invite-form-area').style.display = 'none';
      document.getElementById('invite-result').style.display = 'block';
      const link = `${location.origin}/invite/${result.token}`;
      document.getElementById('invite-link-display').textContent = link;
      document.getElementById('invite-link-display').dataset.link = link;
      toast('Invitation sent!', 'success');
    } catch (ex) { toast(ex.error || 'Failed to send invite', 'error'); }
  }

  function copyInviteLink() {
    const link = document.getElementById('invite-link-display').dataset.link;
    navigator.clipboard.writeText(link).then(() => toast('Link copied!', 'success'));
  }

  // ── Tree Settings ──────────────────────────────────────────────────
  function showTreeSettings(treeId) {
    const tree = currentTree;
    openModal('tree-settings-modal', `
      <form id="tree-settings-form" onsubmit="App.saveTreeSettings(event, '${treeId}')">
        <div class="form-group"><label>Tree Name</label><input name="name" class="form-control" value="${escapeHtml(tree.name)}" required></div>
        <div class="form-group"><label>Description</label><textarea name="description" class="form-control" rows="2">${escapeHtml(tree.description || '')}</textarea></div>
        <div class="form-group"><label>Privacy</label>
          <select name="privacy" class="form-control">
            <option value="family" ${tree.privacy === 'family' ? 'selected' : ''}>Family</option>
            <option value="private" ${tree.privacy === 'private' ? 'selected' : ''}>Private</option>
            <option value="public" ${tree.privacy === 'public' ? 'selected' : ''}>Public</option>
          </select></div>
        <hr class="divider">
        <div class="form-group"><label>Cover Photo</label>
          <input type="file" id="tree-cover-input" accept="image/*" class="form-control" style="padding:.4rem">
          <div class="form-hint">JPG, PNG up to 5MB</div></div>
        <hr class="divider">
        <button type="button" class="btn btn-danger btn-sm" onclick="App.deleteTree('${treeId}')">Delete Tree</button>
        <div class="modal-footer" style="padding:0;margin-top:1rem">
          <button type="button" class="btn btn-ghost" onclick="App.closeModal('tree-settings-modal')">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>`, 'Tree Settings');
  }

  async function saveTreeSettings(e, treeId) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { name: fd.get('name'), description: fd.get('description'), privacy: fd.get('privacy') };
    try {
      await API.trees.update(treeId, data);
      const coverInput = document.getElementById('tree-cover-input');
      if (coverInput && coverInput.files.length) {
        const cfd = new FormData(); cfd.append('cover', coverInput.files[0]);
        await API.postForm(`/trees/${treeId}/cover`, cfd);
      }
      toast('Settings saved', 'success');
      closeModal('tree-settings-modal');
      renderTree(treeId);
    } catch (ex) { toast(ex.error || 'Failed to save', 'error'); }
  }

  async function deleteTree(treeId) {
    if (!confirm('Delete this entire family tree? All members and posts will be permanently deleted.')) return;
    try {
      await API.trees.delete(treeId);
      toast('Tree deleted');
      closeModal('tree-settings-modal');
      navigate('trees');
    } catch (ex) { toast(ex.error || 'Failed to delete', 'error'); }
  }

  // ── Profile ────────────────────────────────────────────────────────
  async function renderProfile() {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="loading-screen"><span class="spinner"></span></div>`;
    try {
      const [user, treesData] = await Promise.all([API.auth.me(), API.trees.list()]);
      currentUser = user;
      localStorage.setItem('current_user', JSON.stringify(user));
      const totalMembers = [...treesData.owned, ...treesData.collaborating].reduce((s, t) => s + (t.member_count || 0), 0);

      main.innerHTML = `
        <div class="card">
          <div class="profile-cover">
            <div class="profile-avatar-wrap">${avatarHTML(user, 'lg')}</div>
          </div>
          <div class="profile-info">
            <div class="flex items-center gap-3" style="flex-wrap:wrap">
              <div><div class="profile-name">${escapeHtml(user.display_name)}</div>
              <div class="profile-username">@${escapeHtml(user.username)}</div>
              ${user.bio ? `<div class="profile-bio mt-2">${escapeHtml(user.bio)}</div>` : ''}</div>
              <button class="btn btn-outline btn-sm" style="margin-left:auto" onclick="App.renderSettings()">Edit Profile</button>
            </div>
            <div class="profile-stats">
              <div class="stat-item"><div class="stat-num">${treesData.owned.length}</div><div class="stat-label">Trees</div></div>
              <div class="stat-item"><div class="stat-num">${treesData.collaborating.length}</div><div class="stat-label">Collaborating</div></div>
              <div class="stat-item"><div class="stat-num">${totalMembers}</div><div class="stat-label">Members</div></div>
            </div>
          </div>
        </div>
        <div class="mt-4">
          <div class="font-bold text-sm text-muted mb-3">YOUR TREES</div>
          <div class="trees-grid">${treesData.owned.map(renderTreeCard).join('')}</div>
        </div>`;
    } catch {}
  }

  async function renderSettings() {
    const main = document.getElementById('main-content');
    const user = currentUser;
    main.innerHTML = `
      <div class="page-header"><div class="page-title">Settings</div></div>
      <div class="card mb-4">
        <div class="card-header"><div class="card-title">Profile</div></div>
        <div class="card-body">
          <form onsubmit="App.saveProfile(event)">
            <div class="flex items-center gap-3 mb-4">
              ${avatarHTML(user, 'lg')}
              <button type="button" class="btn btn-outline btn-sm" onclick="App.changeAvatar()">Change Photo</button>
            </div>
            <div class="form-group"><label>Display Name</label><input name="display_name" class="form-control" value="${escapeHtml(user.display_name)}"></div>
            <div class="form-group"><label>Bio</label><textarea name="bio" class="form-control" rows="3">${user.bio ? escapeHtml(user.bio) : ''}</textarea></div>
            <div class="form-group"><label>Username</label><input class="form-control" value="@${escapeHtml(user.username)}" disabled></div>
            <div class="form-group"><label>Email</label><input class="form-control" value="${escapeHtml(user.email)}" disabled></div>
            <button type="submit" class="btn btn-primary">Save Profile</button>
          </form>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Change Password</div></div>
        <div class="card-body">
          <form onsubmit="App.changePassword(event)">
            <div class="form-group"><label>Current Password</label><input name="current_password" type="password" class="form-control"></div>
            <div class="form-group"><label>New Password</label><input name="new_password" type="password" class="form-control"></div>
            <button type="submit" class="btn btn-primary">Update Password</button>
          </form>
        </div>
      </div>`;
  }

  async function saveProfile(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const user = await API.users.updateMe({ display_name: fd.get('display_name'), bio: fd.get('bio') });
      currentUser = { ...currentUser, ...user };
      localStorage.setItem('current_user', JSON.stringify(currentUser));
      updateHeaderUser();
      toast('Profile saved', 'success');
    } catch (ex) { toast(ex.error || 'Failed to save', 'error'); }
  }

  async function changePassword(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await API.users.changePassword({ current_password: fd.get('current_password'), new_password: fd.get('new_password') });
      e.target.reset();
      toast('Password updated', 'success');
    } catch (ex) { toast(ex.error || 'Failed to update password', 'error'); }
  }

  function changeAvatar() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => {
      const fd = new FormData(); fd.append('avatar', input.files[0]);
      try {
        const data = await API.users.updateAvatar(fd);
        currentUser.avatar = data.avatar;
        localStorage.setItem('current_user', JSON.stringify(currentUser));
        updateHeaderUser();
        renderSettings();
        toast('Avatar updated', 'success');
      } catch (ex) { toast(ex.error || 'Upload failed', 'error'); }
    };
    input.click();
  }

  // ── Notifications Page ─────────────────────────────────────────────
  async function renderNotificationsPage() {
    const main = document.getElementById('main-content');
    main.innerHTML = `<div class="loading-screen"><span class="spinner"></span></div>`;
    try {
      const data = await API.social.notifications();
      await API.social.markRead();
      document.getElementById('notif-badge').style.display = 'none';
      main.innerHTML = `
        <div class="page-header"><div class="page-title">Notifications</div></div>
        <div class="card">
          ${data.notifications.length ? data.notifications.map(n => `
            <div class="notif-item ${n.read ? '' : 'unread'}" style="border-bottom:1px solid var(--gray-100)">
              <div class="notif-dot ${n.read ? 'read' : ''}"></div>
              <div class="notif-text">
                <div class="notif-title">${escapeHtml(n.title)}</div>
                ${n.body ? `<div class="notif-body">${escapeHtml(n.body)}</div>` : ''}
                <div class="notif-time">${timeAgo(n.created_at)}</div>
              </div>
            </div>`).join('') : `<div class="empty-state"><span class="empty-icon">🔔</span><h3>No notifications</h3><p>You're all caught up!</p></div>`}
        </div>`;
    } catch {}
  }

  // ── Invite Accept Page ─────────────────────────────────────────────
  async function showInvitePage(token) {
    document.getElementById('view-main').style.display = 'none';
    document.getElementById('view-auth').style.display = 'none';
    const invView = document.getElementById('view-invite');
    invView.style.display = 'flex';
    document.getElementById('app').className = 'ready';

    invView.innerHTML = `<div class="invite-page"><div class="invite-card"><div class="loading-screen"><span class="spinner"></span></div></div></div>`;
    try {
      const inv = await API.invitations.getByToken(token);
      invView.innerHTML = `<div class="invite-page"><div class="invite-card">
        <div class="invite-icon">🌳</div>
        <h2 style="font-size:1.3rem;font-weight:800;color:var(--navy);margin-bottom:.5rem">${escapeHtml(inv.inviter_name)} invited you</h2>
        <p style="color:var(--gray-600);margin-bottom:1.5rem">Join <strong>${escapeHtml(inv.tree_name)}</strong> family tree as a <strong>${inv.role}</strong>.</p>
        ${inv.message ? `<div class="alert alert-info" style="text-align:left;margin-bottom:1rem">"${escapeHtml(inv.message)}"</div>` : ''}
        ${!API.isLoggedIn() ? `<p class="text-sm text-muted mb-3">You need an account to join. Sign up or log in first.</p>
          <div class="flex gap-2 justify-center">
            <button class="btn btn-primary" onclick="localStorage.setItem('pending_invite','${token}');App.showAuth('register')">Create Account</button>
            <button class="btn btn-outline" onclick="localStorage.setItem('pending_invite','${token}');App.showAuth('login')">Sign In</button>
          </div>` :
          `<div class="flex gap-2 justify-center">
            <button class="btn btn-primary" onclick="App.acceptInvite('${token}')">Join Family Tree</button>
            <button class="btn btn-ghost" onclick="App.declineInvite('${token}')">Decline</button>
          </div>`}
      </div></div>`;
    } catch {
      invView.innerHTML = `<div class="invite-page"><div class="invite-card">
        <div class="invite-icon">❌</div><h2 style="color:var(--navy)">Invitation Not Found</h2>
        <p style="color:var(--gray-600);margin:1rem 0">This invitation may have expired or already been used.</p>
        <button class="btn btn-primary" onclick="App.navigate('dashboard')">Go to Dashboard</button>
      </div></div>`;
    }
  }

  async function acceptInvite(token) {
    try {
      const data = await API.invitations.accept(token);
      toast(`Joined "${data.tree.name}"!`, 'success');
      navigate('tree', { id: data.tree.id });
    } catch (ex) { toast(ex.error || 'Failed to accept', 'error'); }
  }

  async function declineInvite(token) {
    await API.invitations.decline(token);
    navigate('dashboard');
    toast('Invitation declined');
  }

  // ── Modal Helpers ──────────────────────────────────────────────────
  function openModal(id, bodyHTML, title = '') {
    let overlay = document.getElementById(id);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = id;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(id); });
    }
    overlay.innerHTML = `<div class="modal">
      <div class="modal-header">
        <div class="modal-title">${escapeHtml(title)}</div>
        <button class="modal-close" onclick="App.closeModal('${id}')">✕</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
    </div>`;
    requestAnimationFrame(() => overlay.classList.add('open'));
  }

  function closeModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 200); }
  }

  // ── Utilities ──────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  // ── Init ───────────────────────────────────────────────────────────
  async function init() {
    document.getElementById('form-login').addEventListener('submit', handleLogin);
    document.getElementById('form-register').addEventListener('submit', handleRegister);
    document.querySelectorAll('.auth-tab').forEach(t => t.addEventListener('click', () => switchAuthTab(t.dataset.tab)));
    document.getElementById('notif-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleNotifDropdown(); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#notif-btn') && !e.target.closest('#notif-dropdown')) {
        document.getElementById('notif-dropdown').classList.remove('open');
      }
    });

    // Check for pending invite token in URL
    const path = location.pathname;
    const inviteMatch = path.match(/^\/invite\/([^/]+)$/);
    if (inviteMatch) {
      await navigate('invite', { token: inviteMatch[1] });
      return;
    }

    // Check for pending invite after login
    const pendingInvite = localStorage.getItem('pending_invite');

    if (API.isLoggedIn()) {
      try {
        currentUser = await API.auth.me();
        localStorage.setItem('current_user', JSON.stringify(currentUser));
        updateHeaderUser();
        startNotifPoll();
        if (pendingInvite) {
          localStorage.removeItem('pending_invite');
          await navigate('invite', { token: pendingInvite });
        } else {
          await navigate('dashboard');
        }
      } catch {
        API.clearTokens();
        showAuth();
      }
    } else {
      showAuth();
    }
  }

  return {
    init, navigate, logout, showAuth, switchAuthTab,
    submitPost, submitTreePost, reactPost, toggleComments, addComment, deletePost,
    showCreateTree, createTree, showInviteModal, sendInvite, copyInviteLink,
    showAddMember, saveMultipleMembers, showEditMember, saveMember, deleteMember, uploadMemberPhoto,
    showTreeSettings, saveTreeSettings, deleteTree,
    showMemberDetail, switchTreeTab, removeCollaborator,
    renderProfile, renderSettings, saveProfile, changePassword, changeAvatar,
    renderNotificationsPage, toggleNotifDropdown, markAllRead,
    showInvitePage, acceptInvite, declineInvite,
    closeModal, openModal,
    loadMoreFeed: async (page) => {
      const data = await API.social.feed(page);
      const treesData = await API.trees.list();
      const treeMap = {};
      [...treesData.owned, ...treesData.collaborating].forEach(t => treeMap[t.id] = t);
      const container = document.getElementById('feed-container');
      if (container) container.insertAdjacentHTML('beforeend', renderPostCards(data.posts, treeMap));
    },
  };
})();

document.addEventListener('DOMContentLoaded', App.init);

window.addEventListener('popstate', () => {
  const path = location.pathname;
  const inviteMatch = path.match(/^\/invite\/([^/]+)$/);
  if (inviteMatch) App.navigate('invite', { token: inviteMatch[1] });
});
