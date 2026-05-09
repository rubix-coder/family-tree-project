import axios from 'axios';
import Storage from './storage';

let baseURL = '';
let onUnauthorized = null;

export function setBaseURL(url) { baseURL = url; }
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

const client = axios.create({ timeout: 15000 });

client.interceptors.request.use(async (config) => {
  const url = await Storage.getServerUrl();
  config.baseURL = url || baseURL;
  const { accessToken } = await Storage.getTokens();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing = null;
client.interceptors.response.use(
  (r) => r,
  async (error) => {
    const orig = error.config;
    if (error.response?.status === 401 && !orig._retry) {
      orig._retry = true;
      if (!refreshing) {
        refreshing = (async () => {
          const { refreshToken } = await Storage.getTokens();
          if (!refreshToken) throw new Error('No refresh token');
          const url = await Storage.getServerUrl();
          const res = await axios.post(`${url}/api/auth/refresh`, { refreshToken });
          await Storage.setTokens(res.data.accessToken, res.data.refreshToken);
        })();
      }
      try {
        await refreshing;
        refreshing = null;
        return client(orig);
      } catch {
        refreshing = null;
        await Storage.clearTokens();
        await Storage.clearUser();
        if (onUnauthorized) onUnauthorized();
        return Promise.reject(error);
      }
    }
    const msg = error.response?.data?.error || error.message || 'Network error';
    return Promise.reject({ error: msg, status: error.response?.status });
  }
);

const get = (url, params) => client.get(url, { params }).then(r => r.data);
const post = (url, data) => client.post(url, data).then(r => r.data);
const patch = (url, data) => client.patch(url, data).then(r => r.data);
const del = (url) => client.delete(url).then(r => r.data);

export const API = {
  auth: {
    login: (d) => post('/api/auth/login', d),
    register: (d) => post('/api/auth/register', d),
    me: () => get('/api/auth/me'),
    logout: (refreshToken) => post('/api/auth/logout', { refreshToken }),
    updateProfile: (d) => patch('/api/users/me', d),
  },
  users: {
    get: (id) => get(`/api/users/${id}`),
    update: (d) => patch('/api/users/me', d),
    search: (q) => get('/api/users/search', { q }),
  },
  trees: {
    list: () => get('/api/trees'),
    get: (id) => get(`/api/trees/${id}`),
    create: (d) => post('/api/trees', d),
    update: (id, d) => patch(`/api/trees/${id}`, d),
    delete: (id) => del(`/api/trees/${id}`),
    collaborators: (id) => get(`/api/trees/${id}/collaborators`),
    addCollaborator: (id, d) => post(`/api/trees/${id}/collaborators`, d),
    removeCollaborator: (id, uid) => del(`/api/trees/${id}/collaborators/${uid}`),
  },
  members: {
    list: (treeId) => get(`/api/trees/${treeId}/members`),
    get: (treeId, id) => get(`/api/trees/${treeId}/members/${id}`),
    create: (treeId, d) => post(`/api/trees/${treeId}/members`, d),
    update: (treeId, id, d) => patch(`/api/trees/${treeId}/members/${id}`, d),
    delete: (treeId, id) => del(`/api/trees/${treeId}/members/${id}`),
  },
  social: {
    feed: (p) => get('/api/social/feed', { page: p }),
    treePosts: (id) => get(`/api/social/trees/${id}/posts`),
    createPost: (id, d) => post(`/api/social/trees/${id}/posts`, d),
    deletePost: (id) => del(`/api/social/posts/${id}`),
    comments: (id) => get(`/api/social/posts/${id}/comments`),
    addComment: (id, d) => post(`/api/social/posts/${id}/comments`, d),
    react: (id) => post(`/api/social/posts/${id}/react`, {}),
    addReaction: (id, type) => post(`/api/social/posts/${id}/react`, { type }),
    removeReaction: (id) => del(`/api/social/posts/${id}/react`),
  },
  notifications: {
    list: () => get('/api/social/notifications'),
    markRead: (id) => patch(`/api/social/notifications/${id}/read`, {}),
    markAllRead: () => patch('/api/social/notifications/read-all', {}),
    unreadCount: () => get('/api/social/notifications/unread-count'),
  },
  invitations: {
    send: (treeId, d) => post(`/api/invitations/trees/${treeId}`, d),
    list: (treeId) => get(`/api/invitations/trees/${treeId}`),
  },
};

export default API;
