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
    document.querySelector('.main-layout')?.classList.toggle('tree-page', route === 'tree');

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
    const pendingInvite = localStorage.getItem('pending_invite');
    if (pendingInvite) {
      localStorage.removeItem('pending_invite');
      await navigate('invite', { token: pendingInvite });
    } else {
      await navigate('dashboard');
    }
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
    if (!currentUser) {
      try { currentUser = await API.auth.me(); updateHeaderUser(); } catch { showAuth(); return; }
    }
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
    if (!currentUser) {
      try { currentUser = await API.auth.me(); updateHeaderUser(); } catch { showAuth(); return; }
    }
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
            ${tree.my_role !== 'viewer' ? `<button class="btn btn-outline btn-sm" onclick="App.importTreeJSON()" title="Import members from a JSON export">↑ Import JSON</button>` : ''}
            <button class="btn btn-outline btn-sm" onclick="App.exportTreeJSON()" title="Download tree as JSON">↓ JSON</button>
            <button class="btn btn-outline btn-sm" onclick="App.exportInteractiveHTML()" title="Download as standalone interactive HTML">↓ HTML</button>
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
          <div id="tree-tab-list" style="display:none"><div id="members-list-container"></div></div>
          <div id="tree-tab-feed" style="display:none"><div id="tree-feed-container"></div></div>
          <div id="tree-tab-collab" style="display:none"><div id="collab-container"></div></div>
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
      const tabEl = document.getElementById(`tree-tab-${t}`);
      if (tabEl) tabEl.style.display = t === tab ? 'flex' : 'none';
    });
    if (tab === 'viz') requestAnimationFrame(() => TreeViz.fitView());
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
    _memberEntries = 1;
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
        <div class="form-group"><label>Birth Year</label><input name="me_birth_year_${index}" class="form-control" type="number" min="1" max="2030" placeholder="e.g. 1985"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Death Year</label><input name="me_death_year_${index}" class="form-control" type="number" min="1" max="2030"></div>
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
    for (let i = 0; i < _memberEntries; i++) entries += _memberEntryHTML(i);
    const atMax = _memberEntries >= 6;
    return `<div id="multi-member-entries">${entries}</div>
      <button type="button" class="btn btn-ghost btn-sm" id="add-entry-btn" onclick="App._addMemberEntry()" style="margin-top:.5rem" ${atMax ? 'disabled' : ''}>+ Add another member</button>
      <div class="modal-footer" style="padding:0;margin-top:1rem">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal('member-form-modal')">Cancel</button>
        <button type="button" class="btn btn-primary" onclick="App.saveMultipleMembers()">Save Member(s)</button>
      </div>`;
  }

  let _memberEntries = 1;

  function _addMemberEntry() {
    if (_memberEntries >= 6) return;
    _memberEntries++;
    const container = document.getElementById('multi-member-entries');
    if (container) {
      const div = document.createElement('div');
      div.innerHTML = _memberEntryHTML(_memberEntries - 1);
      container.appendChild(div.firstElementChild);
    }
    if (_memberEntries >= 6) {
      const btn = document.getElementById('add-entry-btn');
      if (btn) btn.disabled = true;
    }
  }

  function _removeMemberEntry(index) {
    const el = document.getElementById(`member-entry-${index}`);
    if (el) { el.remove(); _memberEntries = Math.max(1, _memberEntries - 1); }
    const btn = document.getElementById('add-entry-btn');
    if (btn) btn.disabled = false;
  }

  async function saveMultipleMembers() {
    const container = document.getElementById('multi-member-entries');
    if (!container) return;
    const entries = [];
    container.querySelectorAll('.member-entry').forEach(el => {
      const nameInput = el.querySelector('[name^="me_name_"]');
      if (!nameInput) return;
      const name = nameInput.value.trim();
      if (!name) return;
      const idx = nameInput.name.replace('me_name_', '');
      const g = (n) => (el.querySelector(`[name="${n}"]`) || {}).value?.trim() || null;
      entries.push({
        name,
        gender: g(`me_gender_${idx}`) || 'male',
        birth_year: g(`me_birth_year_${idx}`) ? parseInt(g(`me_birth_year_${idx}`)) : null,
        death_year: g(`me_death_year_${idx}`) ? parseInt(g(`me_death_year_${idx}`)) : null,
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

  function _parsePartnerIds(raw) {
    try { const a = JSON.parse(raw || '[]'); return Array.isArray(a) ? a : []; }
    catch { return []; }
  }

  function renderMemberForm(member, members) {
    const others = member ? members.filter(m => m.id !== member.id) : members;
    const curPartners = _parsePartnerIds(member && member.partner_ids);
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
        <div class="form-group"><label>Birth Year</label><input name="birth_year" class="form-control" type="number" min="1" max="2030" value="${member && member.birth_year ? member.birth_year : ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Death Year</label><input name="death_year" class="form-control" type="number" min="1" max="2030" value="${member && member.death_year ? member.death_year : ''}"></div>
        <div class="form-group"><label>Birth Place</label><input name="birth_place" class="form-control" value="${member && member.birth_place ? escapeHtml(member.birth_place) : ''}"></div>
      </div>
      ${others.length ? `
      <div class="form-group"><label>Father (Paternal Parent)</label>
        <select name="paternal_parent_id" class="form-control"><option value="">— none —</option>${others.map(opt).join('')}</select></div>
      <div class="form-group"><label>Mother (Maternal Parent)</label>
        <select name="maternal_parent_id" class="form-control"><option value="">— none —</option>${others.map(optMat).join('')}</select></div>
      <div class="form-group"><label>Spouse / Partner (Primary)</label>
        <select name="spouse_id" class="form-control"><option value="">— none —</option>${others.map(optSp).join('')}</select></div>
      <div class="form-group"><label>Additional Partners</label>
        <select name="partner_ids" class="form-control" multiple style="min-height:78px">${others.map(m => `<option value="${m.id}" ${curPartners.includes(m.id) ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}</select>
        <p class="form-hint">Hold Ctrl/Cmd to select multiple past or present partners (shown side by side)</p></div>
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
    fd.forEach((v, k) => { data[k] = typeof v === 'string' ? (v.trim() || null) : v; });
    const psel = e.target.querySelector('[name="partner_ids"]');
    data.partner_ids = JSON.stringify(psel ? [...psel.selectedOptions].map(o => o.value).filter(Boolean) : []);
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

  // ── Import / Export ────────────────────────────────────────────────
  function exportTreeJSON() {
    if (!currentTree || !currentMembers.length) return toast('No tree data to export', 'error');
    const payload = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      tree: { name: currentTree.name, description: currentTree.description, privacy: currentTree.privacy },
      members: currentMembers.map(({ id, name, gender, birth_year, death_year, birth_place, bio,
        paternal_parent_id, maternal_parent_id, spouse_id, partner_ids }) =>
        ({ id, name, gender, birth_year, death_year, birth_place, bio, paternal_parent_id, maternal_parent_id, spouse_id, partner_ids: partner_ids || '[]' }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${currentTree.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-family-tree.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Tree exported as JSON', 'success');
  }

  let _pendingImportData = null;

  function importTreeJSON() {
    if (!currentTree || currentTree.my_role === 'viewer') return toast('Editor access required to import', 'error');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      let data;
      try { data = JSON.parse(await file.text()); } catch { return toast('Invalid JSON file', 'error'); }
      if (!Array.isArray(data.members)) return toast('File does not look like a family tree JSON export', 'error');
      _pendingImportData = data;
      const preview = data.members.slice(0, 15).map(m =>
        `<li>${escapeHtml(m.name)}${m.birth_year ? ` (${m.birth_year})` : ''}</li>`).join('');
      const extra = data.members.length > 15
        ? `<li style="color:var(--gray-400)">…and ${data.members.length - 15} more</li>` : '';
      openModal('import-json-modal', `
        <p>Found <strong>${data.members.length} member(s)</strong>${data.tree ? ` from <em>${escapeHtml(data.tree.name)}</em>` : ''}.</p>
        <p class="text-sm text-muted" style="margin:.5rem 0 .75rem">Members will be added to <strong>${escapeHtml(currentTree.name)}</strong>. Existing members are unaffected.</p>
        <ul class="text-sm" style="max-height:180px;overflow-y:auto;padding-left:1.25rem;margin:0 0 1rem">${preview}${extra}</ul>
        <div class="modal-footer" style="padding:0;margin-top:1rem">
          <button class="btn btn-ghost" onclick="App.closeModal('import-json-modal')">Cancel</button>
          <button class="btn btn-primary" id="do-import-btn" onclick="App._doImportJSON()">Import ${data.members.length} Member(s)</button>
        </div>`, 'Import Family Tree');
    };
    input.click();
  }

  async function _doImportJSON() {
    const data = _pendingImportData;
    if (!data || !currentTree) return;
    const btn = document.getElementById('do-import-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Importing…'; }
    try {
      const idMap = {};
      // Pass 1: create all members without relationships
      for (const m of data.members) {
        const created = await API.members.create(currentTree.id, {
          name: m.name, gender: m.gender || 'other',
          birth_year: m.birth_year || null, death_year: m.death_year || null,
          birth_place: m.birth_place || null, bio: m.bio || null
        });
        idMap[m.id] = created.id;
      }
      // Pass 2: patch relationships with remapped IDs
      for (const m of data.members) {
        const updates = {};
        if (m.paternal_parent_id && idMap[m.paternal_parent_id]) updates.paternal_parent_id = idMap[m.paternal_parent_id];
        if (m.maternal_parent_id && idMap[m.maternal_parent_id]) updates.maternal_parent_id = idMap[m.maternal_parent_id];
        if (m.spouse_id && idMap[m.spouse_id]) updates.spouse_id = idMap[m.spouse_id];
        const remapped = _parsePartnerIds(m.partner_ids).map(pid => idMap[pid]).filter(Boolean);
        if (remapped.length) updates.partner_ids = JSON.stringify(remapped);
        if (Object.keys(updates).length) await API.members.update(currentTree.id, idMap[m.id], updates);
      }
      toast(`Imported ${data.members.length} member(s) successfully`, 'success');
      closeModal('import-json-modal');
      _pendingImportData = null;
      currentMembers = await API.members.list(currentTree.id);
      TreeViz.update(currentMembers);
    } catch (ex) {
      toast(ex.error || 'Import failed', 'error');
      if (btn) { btn.disabled = false; btn.textContent = `Import ${data.members.length} Member(s)`; }
    }
  }

  function exportInteractiveHTML() {
    if (!currentTree || !currentMembers.length) return toast('No tree data to export', 'error');
    const members = currentMembers.map(({ id, name, gender, birth_year, death_year, birth_place, bio,
      paternal_parent_id, maternal_parent_id, spouse_id }) =>
      ({ id, name, gender, birth_year, death_year, birth_place, bio, paternal_parent_id, maternal_parent_id, spouse_id }));
    const html = _buildInteractiveHTML({ tree: { name: currentTree.name, description: currentTree.description }, members });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${currentTree.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-family-tree.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Interactive HTML exported', 'success');
  }

  function _buildInteractiveHTML(data) {
    const xe = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const dataJson = JSON.stringify(data).replace(/<\/script>/gi, '<\\/script>');
    const treeName = xe(data.tree.name);
    const treeDesc = data.tree.description ? xe(data.tree.description) : '';
    const exportDate = new Date().toLocaleDateString();

    const css = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f5ee;color:#1e293b;height:100vh;display:flex;flex-direction:column;overflow:hidden}
#hdr{background:#1e3a5f;color:#fff;padding:.75rem 1.25rem;display:flex;align-items:center;gap:1rem;flex-shrink:0}
#hdr h1{font-size:1.1rem;font-weight:700}
#hdr .sub{font-size:.78rem;opacity:.7;margin-top:.15rem}
#tb{background:#fff;border-bottom:1px solid #e2e8f0;padding:.5rem 1rem;display:flex;align-items:center;gap:.45rem;flex-wrap:wrap;flex-shrink:0}
.tb-btn{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:.3rem .65rem;font-size:.8rem;cursor:pointer;font-weight:500;color:#1e293b;transition:background .15s}
.tb-btn:hover{background:#e2e8f0}
.tb-btn.active{background:#1e3a5f;color:#fff;border-color:#1e3a5f}
.tb-sep{width:1px;height:20px;background:#e2e8f0;margin:0 .1rem}
.tb-lbl{font-size:.78rem;color:#64748b;font-weight:600}
select.tb-sel{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:.3rem .5rem;font-size:.8rem;cursor:pointer;color:#1e293b}
#main{display:flex;flex:1;overflow:hidden}
#tw{flex:1;overflow:auto;cursor:grab;position:relative}
#tw:active{cursor:grabbing}
#dp{width:300px;flex-shrink:0;background:#fff;border-left:1px solid #e2e8f0;overflow-y:auto;display:none}
.dh{background:#f8f5ee;padding:1rem;display:flex;gap:.75rem;align-items:flex-start;border-bottom:1px solid #e2e8f0;position:relative}
.da{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;flex-shrink:0}
.dh h2{font-size:1rem;font-weight:700;color:#1e3a5f;margin-bottom:.25rem}
.dm{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.35rem}
.dm span{background:#f1f5f9;border-radius:4px;padding:.15rem .4rem;font-size:.75rem;color:#475569}
.cx{position:absolute;top:.75rem;right:.75rem;background:none;border:none;font-size:1.3rem;cursor:pointer;color:#94a3b8;line-height:1}
.cx:hover{color:#1e3a5f}
.db{padding:.75rem 1rem;font-size:.875rem;color:#475569;border-bottom:1px solid #f1f5f9;line-height:1.5}
.dr{padding:.75rem 1rem}
.ri{display:flex;gap:.5rem;align-items:baseline;padding:.35rem 0;border-bottom:1px solid #f8f5ee;font-size:.85rem}
.rl{color:#94a3b8;font-size:.75rem;font-weight:600;width:55px;flex-shrink:0}
.ri a{color:#1e3a5f;cursor:pointer;font-weight:600;text-decoration:none}
.ri a:hover{text-decoration:underline}
.node{cursor:pointer}
.node rect{transition:stroke-width .1s}
.node:hover rect{stroke-width:3!important}
#ft{background:#fff;border-top:1px solid #e2e8f0;padding:.35rem 1rem;font-size:.72rem;color:#94a3b8;text-align:right;flex-shrink:0}`;

    const embeddedJS = `(function(){
var D=FAMILY_TREE,members=D.members;
var NW=150,NH=72,HG=60,VG=100,scale=1,vf='all',sel=null;
var fid=members.length?members[members.length-1].id:null;
var sm={},acof={};
for(var m of members){
  if(m.spouse_id){sm[m.id]=m.spouse_id;sm[m.spouse_id]=m.id;}
  for(var pid of [m.paternal_parent_id,m.maternal_parent_id].filter(Boolean)){
    if(!acof[pid])acof[pid]=[];
    if(!acof[pid].includes(m.id))acof[pid].push(m.id);
  }
}
function byId(id){return members.find(function(m){return m.id===id;});}
function xe(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function getVis(){
  if(vf==='all')return members.slice();
  var start=byId(fid)?fid:(members.length?members[members.length-1].id:null);
  if(!start)return [];
  var topId=start,cur=start,seen=new Set(),g=0;
  while(cur&&!seen.has(cur)&&g++<300){
    seen.add(cur);var mm=byId(cur);if(!mm)break;
    var pid=vf==='paternal'?mm.paternal_parent_id:mm.maternal_parent_id;
    if(pid&&byId(pid)){topId=pid;cur=pid;}else break;
  }
  var vis=new Set();
  function descend(id,d){
    if(!id||vis.has(id)||d>300)return;
    vis.add(id);var sid=sm[id];if(sid)vis.add(sid);
    for(var m of members){
      if(m.paternal_parent_id===id||m.maternal_parent_id===id||
         (sid&&(m.paternal_parent_id===sid||m.maternal_parent_id===sid)))descend(m.id,d+1);
    }
  }
  descend(topId,0);
  return members.filter(function(m){return vis.has(m.id);});
}
function layout(vis){
  var pos={},placed=new Set(),cof={};
  var visIds=new Set(vis.map(function(m){return m.id;}));
  for(var m of vis)for(var pid of [m.paternal_parent_id,m.maternal_parent_id].filter(Boolean)){
    if(!visIds.has(pid))continue;
    if(!cof[pid])cof[pid]=[];if(!cof[pid].includes(m.id))cof[pid].push(m.id);
  }
  function getKids(id){
    var sid=sm[id]&&visIds.has(sm[id])?sm[id]:null;
    var s=new Set((cof[id]||[]).concat(sid?(cof[sid]||[]):[]));
    return Array.from(s);
  }
  var hasVP=new Set(vis.filter(function(m){
    return (m.paternal_parent_id&&visIds.has(m.paternal_parent_id))||
           (m.maternal_parent_id&&visIds.has(m.maternal_parent_id));
  }).map(function(m){return m.id;}));
  var roots=vis.filter(function(m){
    if(hasVP.has(m.id))return false;
    var sid=sm[m.id],sV=sid&&visIds.has(sid);
    if(sV&&hasVP.has(sid))return false;
    if(sV)return m.id<sid;
    return true;
  });
  if(!roots.length&&vis.length)roots.push(vis[0]);
  function place(id,depth,leftCol){
    placed.add(id);
    var sid=sm[id]&&visIds.has(sm[id])?sm[id]:null;
    if(sid)placed.add(sid);
    var cw=sid?2:1;
    var kids=getKids(id).filter(function(k){return !placed.has(k);});
    if(kids.length===0){
      pos[id]={cx:leftCol,cy:depth};
      if(sid)pos[sid]={cx:leftCol+1,cy:depth};
      return leftCol+cw;
    }
    var c=leftCol,cen=[];
    for(var k of kids){
      if(placed.has(k))continue;
      var nx=place(k,depth+1,c);
      if(pos[k])cen.push(pos[k].cx);
      c=nx;
    }
    var center=cen.length?(Math.min.apply(null,cen)+Math.max.apply(null,cen))/2:leftCol;
    if(sid){pos[id]={cx:center-0.5,cy:depth};pos[sid]={cx:center+0.5,cy:depth};}
    else pos[id]={cx:center,cy:depth};
    return Math.max(c,center+cw/2+0.5);
  }
  var nc=0;
  roots.forEach(function(r){if(!placed.has(r.id)){nc=place(r.id,0,nc);nc=Math.ceil(nc)+1;}});
  vis.forEach(function(m){if(!pos[m.id]){pos[m.id]={cx:nc,cy:0};nc++;}});
  return pos;
}
function px(cx,cy){return{x:cx*(NW+HG)+40,y:cy*(NH+VG)+40};}
function render(){
  var vis=getVis(),pos=layout(vis);
  var tw=document.getElementById('tw');
  if(!vis.length){tw.innerHTML='<p style="text-align:center;padding:3rem;color:#64748b">No members to display.</p>';return;}
  var mCx=Math.max.apply(null,Object.values(pos).map(function(p){return p.cx;}));
  var mCy=Math.max.apply(null,Object.values(pos).map(function(p){return p.cy;}));
  var W=(mCx+2)*(NW+HG)+80,H=(mCy+1)*(NH+VG)+80;
  var edges='',drawn=new Set();
  for(var m of vis){
    var sid=sm[m.id];
    if(sid&&pos[m.id]&&pos[sid]){
      var k=[m.id,sid].sort().join('|');
      if(!drawn.has(k)){
        drawn.add(k);
        var p1=px(pos[m.id].cx,pos[m.id].cy),p2=px(pos[sid].cx,pos[sid].cy);
        edges+='<line x1="'+(p1.x+NW/2)+'" y1="'+(p1.y+NH/2)+'" x2="'+(p2.x+NW/2)+'" y2="'+(p2.y+NH/2)+'" stroke="#f472b6" stroke-width="2" stroke-dasharray="6,3" opacity="0.8"/>';
      }
    }
  }
  for(var m of vis){
    if(!pos[m.id])continue;
    var mp=px(pos[m.id].cx,pos[m.id].cy);
    var cx2=mp.x+NW/2,ty=mp.y;
    var pp=m.paternal_parent_id&&pos[m.paternal_parent_id]?px(pos[m.paternal_parent_id].cx,pos[m.paternal_parent_id].cy):null;
    var mp2=m.maternal_parent_id&&pos[m.maternal_parent_id]?px(pos[m.maternal_parent_id].cx,pos[m.maternal_parent_id].cy):null;
    var fx,fy,st;
    if(pp&&mp2&&m.paternal_parent_id!==m.maternal_parent_id){fx=(pp.x+NW/2+mp2.x+NW/2)/2;fy=pp.y+NH;st='#6366f1';}
    else if(pp){fx=pp.x+NW/2;fy=pp.y+NH;st='#c9a84c';}
    else if(mp2){fx=mp2.x+NW/2;fy=mp2.y+NH;st='#a78bfa';}
    else continue;
    var ctY=fy+(ty-fy)*0.5;
    edges+='<path d="M'+fx+','+fy+' C'+fx+','+ctY+' '+cx2+','+ctY+' '+cx2+','+ty+'" stroke="'+st+'" stroke-width="2" fill="none" opacity="0.8"/>';
  }
  var nodes='';
  for(var m of vis){
    var p=pos[m.id];if(!p)continue;
    var pt=px(p.cx,p.cy),x=pt.x,y=pt.y;
    var gc=m.gender==='male'?'#3b82f6':m.gender==='female'?'#ec4899':'#8b5cf6';
    var init=m.name.split(' ').map(function(w){return w[0];}).join('').toUpperCase().slice(0,2);
    var ls=[m.birth_year,m.death_year].filter(Boolean).join(' – ');
    var fs=m.name.length>14?'10':m.name.length>10?'11':'12';
    var dn=m.name.length>16?m.name.slice(0,15)+'…':m.name;
    var isSel=m.id===sel;
    nodes+='<g class="node" onclick="pickMember(\\''+m.id+'\\')">'+
      '<rect x="'+x+'" y="'+y+'" width="'+NW+'" height="'+NH+'" rx="10" fill="white" stroke="'+gc+'" stroke-width="'+(isSel?3.5:2)+'" filter="url(#sh)" '+(isSel?'stroke-dasharray="none"':'')+' />'+
      '<circle cx="'+(x+26)+'" cy="'+(y+26)+'" r="18" fill="'+gc+'" opacity="0.2"/>'+
      '<text x="'+(x+26)+'" y="'+(y+31)+'" text-anchor="middle" font-size="12" font-weight="700" fill="'+gc+'">'+xe(init)+'</text>'+
      '<text x="'+(x+54)+'" y="'+(y+24)+'" font-size="'+fs+'" font-weight="600" fill="#1e293b" dominant-baseline="middle">'+xe(dn)+'</text>'+
      (ls?'<text x="'+(x+54)+'" y="'+(y+42)+'" font-size="9" fill="#64748b">'+xe(ls)+'</text>':'')+
      (m.death_year?'<text x="'+(x+NW-22)+'" y="'+(y+13)+'" font-size="10" text-anchor="end" fill="#94a3b8">✝</text>':'')+
      '</g>';
  }
  tw.innerHTML='<svg id="tsv" width="'+W+'" height="'+H+'" xmlns="http://www.w3.org/2000/svg" style="transform:scale('+scale+');transform-origin:top left">'+
    '<defs><filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#00000022"/></filter></defs>'+
    edges+nodes+'</svg>';
  setupPan();
}
function setupPan(){
  var w=document.getElementById('tw');if(!w)return;
  var pan=false,sx=0,sy=0,sl=0,st=0;
  w.addEventListener('mousedown',function(e){
    if(e.target.closest('.node'))return;
    pan=true;sx=e.clientX;sy=e.clientY;sl=w.scrollLeft;st=w.scrollTop;w.style.cursor='grabbing';
  });
  window.addEventListener('mousemove',function(e){if(!pan)return;w.scrollLeft=sl-(e.clientX-sx);w.scrollTop=st-(e.clientY-sy);});
  window.addEventListener('mouseup',function(){pan=false;if(w)w.style.cursor='';});
  w.addEventListener('touchstart',function(e){if(e.touches.length!==1)return;pan=true;sx=e.touches[0].clientX;sy=e.touches[0].clientY;sl=w.scrollLeft;st=w.scrollTop;},{passive:true});
  w.addEventListener('touchmove',function(e){if(!pan||e.touches.length!==1)return;w.scrollLeft=sl-(e.touches[0].clientX-sx);w.scrollTop=st-(e.touches[0].clientY-sy);},{passive:true});
  w.addEventListener('touchend',function(){pan=false;});
}
window.pickMember=function(id){
  sel=id;render();
  var m=byId(id);if(!m)return;
  var dp=document.getElementById('dp');
  var gc=m.gender==='male'?'#3b82f6':m.gender==='female'?'#ec4899':'#8b5cf6';
  var init=m.name.split(' ').map(function(w){return w[0];}).join('').toUpperCase().slice(0,2);
  var father=byId(m.paternal_parent_id),mother=byId(m.maternal_parent_id),spouse=byId(m.spouse_id);
  var kids=members.filter(function(x){return x.paternal_parent_id===id||x.maternal_parent_id===id;});
  var rel='';
  if(father)rel+='<div class="ri"><span class="rl">Father</span><a onclick="pickMember(\\''+father.id+'\\')">'+xe(father.name)+'</a></div>';
  if(mother)rel+='<div class="ri"><span class="rl">Mother</span><a onclick="pickMember(\\''+mother.id+'\\')">'+xe(mother.name)+'</a></div>';
  if(spouse)rel+='<div class="ri"><span class="rl">Spouse</span><a onclick="pickMember(\\''+spouse.id+'\\')">'+xe(spouse.name)+'</a></div>';
  if(kids.length)rel+='<div class="ri"><span class="rl">Children</span><span>'+kids.map(function(c){return'<a onclick="pickMember(\\''+c.id+'\\')">'+xe(c.name)+'</a>';}).join(', ')+'</span></div>';
  dp.innerHTML=
    '<div class="dh">'+
      '<div class="da" style="background:'+gc+'22;color:'+gc+'">'+xe(init)+'</div>'+
      '<div><h2>'+xe(m.name)+'</h2>'+
      '<div class="dm">'+
        (m.birth_year?'<span>b. '+m.birth_year+'</span>':'')+
        (m.death_year?'<span>d. '+m.death_year+'</span>':'')+
        (m.birth_place?'<span>📍 '+xe(m.birth_place)+'</span>':'')+
        '<span style="color:'+gc+'">'+
          (m.gender==='male'?'♂ Male':m.gender==='female'?'♀ Female':'⚧ Other')+
        '</span>'+
      '</div></div>'+
      '<button class="cx" onclick="closeDetail()">×</button>'+
    '</div>'+
    (m.bio?'<p class="db">'+xe(m.bio)+'</p>':'')+
    (rel?'<div class="dr">'+rel+'</div>':'');
  dp.style.display='block';
};
window.closeDetail=function(){sel=null;document.getElementById('dp').style.display='none';render();};
window.doZoom=function(d){scale=Math.min(2.5,Math.max(0.25,scale+d));var s=document.getElementById('tsv');if(s)s.style.transform='scale('+scale+')';};
window.resetView=function(){scale=1;var s=document.getElementById('tsv');if(s)s.style.transform='scale(1)';var w=document.getElementById('tw');if(w){w.scrollLeft=0;w.scrollTop=0;}};
window.setFilter=function(f,btn){
  vf=f;
  document.querySelectorAll('.tb-btn[data-f]').forEach(function(b){b.classList.remove('active');});
  if(btn)btn.classList.add('active');
  render();
};
window.setFocal=function(id){fid=id;render();};
document.addEventListener('keydown',function(e){if(e.key==='Escape')window.closeDetail();});
var fsel=document.getElementById('fsel');
fsel.innerHTML=members.map(function(m){return'<option value="'+xe(m.id)+'"'+(m.id===fid?' selected':'')+'>'+xe(m.name)+'</option>';}).join('');
fsel.addEventListener('change',function(e){window.setFocal(e.target.value);});
render();
})();`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${treeName} — Family Tree</title>
<style>${css}</style>
</head>
<body>
<script>const FAMILY_TREE = ${dataJson};<\/script>
<div id="hdr">
  <div>
    <h1>${treeName}</h1>
    ${treeDesc ? `<div class="sub">${treeDesc}</div>` : ''}
  </div>
</div>
<div id="tb">
  <span class="tb-lbl">View from:</span>
  <select class="tb-sel" id="fsel" onchange="setFocal(this.value)"></select>
  <div class="tb-sep"></div>
  <button class="tb-btn active" data-f="all" onclick="setFilter('all',this)">All</button>
  <button class="tb-btn" data-f="paternal" onclick="setFilter('paternal',this)">👨 Paternal</button>
  <button class="tb-btn" data-f="maternal" onclick="setFilter('maternal',this)">👩 Maternal</button>
  <div class="tb-sep"></div>
  <button class="tb-btn" onclick="doZoom(0.2)" title="Zoom in">+</button>
  <button class="tb-btn" onclick="doZoom(-0.2)" title="Zoom out">−</button>
  <button class="tb-btn" onclick="resetView()" title="Reset view">⊙</button>
</div>
<div id="main">
  <div id="tw"></div>
  <div id="dp"></div>
</div>
<div id="ft">Exported ${exportDate} · ${data.members.length} member(s) · FamilyTree</div>
<script>
${embeddedJS}
<\/script>
</body>
</html>`;
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
      if (API.isLoggedIn()) {
        try {
          currentUser = JSON.parse(localStorage.getItem('current_user') || 'null');
          if (!currentUser) currentUser = await API.auth.me();
          localStorage.setItem('current_user', JSON.stringify(currentUser));
          updateHeaderUser();
          startNotifPoll();
        } catch { API.clearTokens(); }
      }
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
    showAddMember, saveMultipleMembers, _addMemberEntry, _removeMemberEntry,
    showEditMember, saveMember, deleteMember, uploadMemberPhoto,
    showTreeSettings, saveTreeSettings, deleteTree,
    showMemberDetail, switchTreeTab, removeCollaborator,
    renderProfile, renderSettings, saveProfile, changePassword, changeAvatar,
    renderNotificationsPage, toggleNotifDropdown, markAllRead,
    showInvitePage, acceptInvite, declineInvite,
    closeModal, openModal,
    exportTreeJSON, importTreeJSON, _doImportJSON, exportInteractiveHTML,
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
