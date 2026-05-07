const API = (() => {
  const BASE = '/api';

  function getToken() { return localStorage.getItem('access_token'); }
  function getRefresh() { return localStorage.getItem('refresh_token'); }
  function setTokens(a, r) { localStorage.setItem('access_token', a); localStorage.setItem('refresh_token', r); }
  function clearTokens() { localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token'); localStorage.removeItem('current_user'); }

  async function refreshAccessToken() {
    const r = getRefresh();
    if (!r) return false;
    try {
      const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: r }) });
      if (!res.ok) { clearTokens(); return false; }
      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch { return false; }
  }

  async function request(method, path, body, isFormData = false, retry = true) {
    const headers = {};
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isFormData && body) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    const res = await fetch(`${BASE}${path}`, opts);

    if (res.status === 401 && retry) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return request(method, path, body, isFormData, false);
      clearTokens();
      window.App && App.navigate('login');
      return null;
    }

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text }; }

    if (!res.ok) throw { status: res.status, error: data.error || 'Request failed', data };
    return data;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    delete: (path) => request('DELETE', path),
    postForm: (path, formData) => request('POST', path, formData, true),

    setTokens,
    clearTokens,
    isLoggedIn: () => !!getToken(),

    auth: {
      register: (d) => request('POST', '/auth/register', d),
      login: (d) => request('POST', '/auth/login', d),
      logout: (r) => request('POST', '/auth/logout', { refreshToken: r }),
      me: () => request('GET', '/auth/me'),
    },
    users: {
      search: (q) => request('GET', `/users/search?q=${encodeURIComponent(q)}`),
      get: (id) => request('GET', `/users/${id}`),
      updateMe: (d) => request('PATCH', '/users/me', d),
      updateAvatar: (fd) => request('POST', '/users/me/avatar', fd, true),
      changePassword: (d) => request('POST', '/users/me/password', d),
    },
    trees: {
      list: () => request('GET', '/trees'),
      get: (id) => request('GET', `/trees/${id}`),
      create: (d) => request('POST', '/trees', d),
      update: (id, d) => request('PATCH', `/trees/${id}`, d),
      delete: (id) => request('DELETE', `/trees/${id}`),
      members: (id) => request('GET', `/trees/${id}/members`),
      removeCollaborator: (treeId, userId) => request('DELETE', `/trees/${treeId}/collaborators/${userId}`),
      updateCollaboratorRole: (treeId, userId, role) => request('POST', `/trees/${treeId}/collaborators/${userId}/role`, { role }),
    },
    members: {
      list: (treeId) => request('GET', `/trees/${treeId}/members`),
      get: (treeId, id) => request('GET', `/trees/${treeId}/members/${id}`),
      create: (treeId, d) => request('POST', `/trees/${treeId}/members`, d),
      update: (treeId, id, d) => request('PATCH', `/trees/${treeId}/members/${id}`, d),
      delete: (treeId, id) => request('DELETE', `/trees/${treeId}/members/${id}`),
      uploadPhoto: (treeId, id, fd) => request('POST', `/trees/${treeId}/members/${id}/photo`, fd, true),
    },
    social: {
      feed: (page = 1) => request('GET', `/feed?page=${page}`),
      treePosts: (treeId, page = 1) => request('GET', `/trees/${treeId}/posts?page=${page}`),
      createPost: (treeId, d) => request('POST', `/trees/${treeId}/posts`, d),
      deletePost: (id) => request('DELETE', `/posts/${id}`),
      comments: (postId) => request('GET', `/posts/${postId}/comments`),
      addComment: (postId, content) => request('POST', `/posts/${postId}/comments`, { content }),
      react: (postId) => request('POST', `/posts/${postId}/react`),
      notifications: () => request('GET', '/notifications'),
      markRead: (ids) => request('PATCH', '/notifications/read', ids ? { ids } : {}),
    },
    invitations: {
      invite: (treeId, d) => request('POST', `/trees/${treeId}/invite`, d),
      getByToken: (token) => request('GET', `/invite/${token}`),
      accept: (token) => request('POST', `/invite/${token}/accept`),
      decline: (token) => request('POST', `/invite/${token}/decline`),
      list: (treeId) => request('GET', `/trees/${treeId}/invitations`),
      revoke: (treeId, invId) => request('DELETE', `/trees/${treeId}/invitations/${invId}`),
    },
  };
})();
