import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../services/api';
import Storage from '../services/storage';

export default function DashboardScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [u, feed] = await Promise.all([Storage.getUser(), API.social.feed()]);
      setUser(u);
      setPosts(feed.posts || []);
    } catch { }
    setLoading(false); setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggleReaction(post) {
    try {
      if (post.my_reaction) {
        await API.social.removeReaction(post.id);
      } else {
        await API.social.addReaction(post.id, 'heart');
      }
      setPosts(ps => ps.map(p => p.id === post.id
        ? { ...p, my_reaction: !p.my_reaction, reaction_count: p.reaction_count + (p.my_reaction ? -1 : 1) }
        : p));
    } catch { }
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a2744" /></View>;

  const renderPost = ({ item: p }) => (
    <View style={s.postCard}>
      <View style={s.postHeader}>
        <View style={s.avatarCircle}>
          <Text style={s.avatarText}>{p.author_name?.charAt(0).toUpperCase() || '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.authorName}>{p.author_name}</Text>
          <Text style={s.postMeta}>{p.tree_name} · <Text style={s.postType}>{p.type}</Text></Text>
        </View>
      </View>
      <Text style={s.postContent}>{p.content}</Text>
      <View style={s.postActions}>
        <TouchableOpacity style={s.actionBtn} onPress={() => toggleReaction(p)}>
          <Text style={[s.actionIcon, p.my_reaction && { color: '#ef4444' }]}>
            {p.my_reaction ? '❤️' : '🤍'} {p.reaction_count || 0}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn}>
          <Text style={s.actionIcon}>💬 {p.comment_count || 0}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Welcome back,</Text>
          <Text style={s.userName}>{user?.display_name || user?.username || 'Friend'} 👋</Text>
        </View>
        <TouchableOpacity style={s.treeBtn} onPress={() => navigation.navigate('Trees')}>
          <Text style={s.treeBtnText}>My Trees</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#1a2744" />}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View style={s.statsRow}>
            <TouchableOpacity style={s.statCard} onPress={() => navigation.navigate('Trees')}>
              <Text style={s.statIcon}>🌳</Text>
              <Text style={s.statLabel}>My Trees</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.statCard} onPress={() => navigation.navigate('Notifications')}>
              <Text style={s.statIcon}>🔔</Text>
              <Text style={s.statLabel}>Alerts</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.statCard} onPress={() => navigation.navigate('Profile')}>
              <Text style={s.statIcon}>👤</Text>
              <Text style={s.statLabel}>Profile</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 44 }}>📰</Text>
            <Text style={s.emptyTitle}>Your feed is empty</Text>
            <Text style={s.emptySub}>Create a family tree and add members to see activity here</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('Trees')}>
              <Text style={s.emptyBtnText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={renderPost}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f5f0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#1a2744', padding: 20, paddingTop: 55, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  greeting: { color: 'rgba(255,255,255,.6)', fontSize: 13 },
  userName: { color: '#c9a84c', fontSize: 20, fontWeight: '800' },
  treeBtn: { backgroundColor: 'rgba(201,168,76,.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#c9a84c' },
  treeBtnText: { color: '#c9a84c', fontWeight: '700', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, elevation: 2 },
  statIcon: { fontSize: 24, marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  postCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, elevation: 2 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1a2744', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#c9a84c', fontWeight: '700', fontSize: 15 },
  authorName: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  postMeta: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  postType: { color: '#c9a84c', fontWeight: '600' },
  postContent: { color: '#475569', lineHeight: 22, fontSize: 14 },
  postActions: { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionIcon: { fontSize: 14, color: '#64748b' },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 12 },
  emptySub: { color: '#94a3b8', marginTop: 6, marginBottom: 20, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { backgroundColor: '#1a2744', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#c9a84c', fontWeight: '700' },
});
