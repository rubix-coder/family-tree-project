import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../services/api';

const NOTIF_ICONS = {
  invite: '📩',
  comment: '💬',
  reaction: '❤️',
  post: '📝',
  member_added: '👤',
  default: '🔔',
};

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await API.notifications.list();
      setNotifications(data.notifications || []);
    } catch { }
    setLoading(false); setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function markRead(id) {
    try {
      await API.notifications.markRead(id);
      setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
    } catch { }
  }

  async function markAllRead() {
    try {
      await API.notifications.markAllRead();
      setNotifications(ns => ns.map(n => ({ ...n, read: true })));
    } catch { }
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a2744" /></View>;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={s.markAllBtn}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={n => n.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#1a2744" />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 44 }}>🔔</Text>
            <Text style={s.emptyTitle}>All caught up!</Text>
            <Text style={s.emptySub}>No new notifications</Text>
          </View>
        }
        renderItem={({ item: n }) => (
          <TouchableOpacity
            style={[s.notifCard, !n.read && s.notifUnread]}
            onPress={() => { markRead(n.id); if (n.tree_id) navigation.navigate('TreeDetail', { treeId: n.tree_id }); }}
          >
            <Text style={s.notifIcon}>{NOTIF_ICONS[n.type] || NOTIF_ICONS.default}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.notifMessage, !n.read && s.notifMessageBold]}>{n.message}</Text>
              {n.tree_name && <Text style={s.notifSub}>{n.tree_name}</Text>}
            </View>
            {!n.read && <View style={s.dot} />}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f5f0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#1a2744', padding: 20, paddingTop: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#c9a84c', fontSize: 20, fontWeight: '800' },
  markAllBtn: { color: 'rgba(201,168,76,.7)', fontSize: 13, fontWeight: '600' },
  notifCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 1 },
  notifUnread: { borderLeftWidth: 3, borderLeftColor: '#c9a84c' },
  notifIcon: { fontSize: 22 },
  notifMessage: { color: '#475569', fontSize: 14, lineHeight: 20 },
  notifMessageBold: { color: '#1e293b', fontWeight: '600' },
  notifSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#c9a84c' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 12 },
  emptySub: { color: '#94a3b8', marginTop: 6 },
});
