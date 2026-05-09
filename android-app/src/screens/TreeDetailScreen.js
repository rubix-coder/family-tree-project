import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../services/api';
import TreeVisualization from '../components/TreeVisualization';

const TABS = ['Tree', 'Members', 'Feed'];

export default function TreeDetailScreen({ route, navigation }) {
  const { treeId } = route.params;
  const [tree, setTree] = useState(null);
  const [members, setMembers] = useState([]);
  const [tab, setTab] = useState('Tree');
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, m] = await Promise.all([API.trees.get(treeId), API.members.list(treeId)]);
      setTree(t);
      setMembers(m);
      navigation.setOptions({ headerTitle: t.name });
    } catch { }
    setLoading(false);
  }, [treeId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function loadFeed() {
    try { const d = await API.social.treePosts(treeId); setPosts(d.posts || []); } catch { }
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a2744" /></View>;
  if (!tree) return <View style={s.center}><Text>Tree not found</Text></View>;

  const canEdit = tree.my_role !== 'viewer';

  return (
    <View style={s.container}>
      {/* Tab Bar */}
      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabActive]}
            onPress={() => { setTab(t); if (t === 'Feed') loadFeed(); }}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
        {canEdit && (
          <TouchableOpacity style={s.addMemberBtn}
            onPress={() => navigation.navigate('AddMember', { treeId, members, onSave: load })}>
            <Text style={s.addMemberText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tree View */}
      {tab === 'Tree' && (
        <TreeVisualization members={members} onMemberPress={(id) => navigation.navigate('MemberDetail', { treeId, memberId: id, onSave: load })} />
      )}

      {/* Members List */}
      {tab === 'Members' && (
        <FlatList data={members} keyExtractor={m => m.id} contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<View style={s.empty}><Text style={{ fontSize: 36 }}>👨‍👩‍👧</Text><Text style={s.emptyText}>No members yet</Text></View>}
          renderItem={({ item: m }) => (
            <TouchableOpacity style={s.memberCard}
              onPress={() => navigation.navigate('MemberDetail', { treeId, memberId: m.id, onSave: load })}>
              <View style={[s.avatar, { backgroundColor: m.gender === 'male' ? 'rgba(59,130,246,.15)' : m.gender === 'female' ? 'rgba(236,72,153,.15)' : 'rgba(139,92,246,.15)' }]}>
                <Text style={{ color: m.gender === 'male' ? '#3b82f6' : m.gender === 'female' ? '#ec4899' : '#8b5cf6', fontWeight: '700', fontSize: 16 }}>
                  {m.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.memberName}>{m.name}</Text>
                <Text style={s.memberMeta}>{[m.birth_year ? `b. ${m.birth_year}` : '', m.birth_place || ''].filter(Boolean).join(' · ')}</Text>
              </View>
              <Text style={{ color: '#94a3b8' }}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Feed */}
      {tab === 'Feed' && (
        <FlatList data={posts} keyExtractor={p => p.id} contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<View style={s.empty}><Text style={{ fontSize: 36 }}>📰</Text><Text style={s.emptyText}>No posts yet</Text></View>}
          renderItem={({ item: p }) => (
            <View style={s.postCard}>
              <Text style={s.postAuthor}>{p.author_name} · <Text style={{ color: '#94a3b8', fontWeight: '400' }}>{p.type}</Text></Text>
              <Text style={s.postContent}>{p.content}</Text>
              <Text style={s.postMeta}>❤️ {p.reaction_count || 0} · 💬 {p.comment_count || 0}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f5f0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tabBtn: { flex: 1, padding: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#c9a84c' },
  tabText: { fontWeight: '600', color: '#94a3b8', fontSize: 14 },
  tabTextActive: { color: '#1a2744' },
  addMemberBtn: { paddingHorizontal: 14, justifyContent: 'center', backgroundColor: 'rgba(201,168,76,.1)' },
  addMemberText: { color: '#c9a84c', fontWeight: '700', fontSize: 13 },
  memberCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, elevation: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  memberName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  memberMeta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { color: '#94a3b8', fontSize: 15 },
  postCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, elevation: 2 },
  postAuthor: { fontWeight: '700', color: '#1e293b', marginBottom: 6, fontSize: 14 },
  postContent: { color: '#475569', lineHeight: 22 },
  postMeta: { color: '#94a3b8', fontSize: 12, marginTop: 10 },
});
