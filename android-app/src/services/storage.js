import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'current_user',
  SERVER_URL: 'server_url',
};

export const Storage = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)),
  remove: (key) => AsyncStorage.removeItem(key),

  getServerUrl: () => AsyncStorage.getItem(KEYS.SERVER_URL),
  setServerUrl: (url) => AsyncStorage.setItem(KEYS.SERVER_URL, url.replace(/\/$/, '')),

  getTokens: async () => ({
    accessToken: await AsyncStorage.getItem(KEYS.ACCESS_TOKEN),
    refreshToken: await AsyncStorage.getItem(KEYS.REFRESH_TOKEN),
  }),
  setTokens: (access, refresh) => Promise.all([
    AsyncStorage.setItem(KEYS.ACCESS_TOKEN, access),
    AsyncStorage.setItem(KEYS.REFRESH_TOKEN, refresh),
  ]),
  clearTokens: () => Promise.all([
    AsyncStorage.removeItem(KEYS.ACCESS_TOKEN),
    AsyncStorage.removeItem(KEYS.REFRESH_TOKEN),
  ]),

  getUser: async () => {
    const u = await AsyncStorage.getItem(KEYS.USER);
    return u ? JSON.parse(u) : null;
  },
  setUser: (user) => AsyncStorage.setItem(KEYS.USER, JSON.stringify(user)),
  clearUser: () => AsyncStorage.removeItem(KEYS.USER),
};

export default Storage;
