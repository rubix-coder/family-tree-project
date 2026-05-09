import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../services/api';

export default function TreesScreen({ navigation }) {
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', privacy: 'family' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await API.trees.list();
      setTrees(data);
    } catch { }
    setLoading(false); setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function createTree() {
    if (!form.name.trim()) return Alert.alert('Error', 'Name required');
    setCreating(true);
    try {
      const tree = await API.trees.create(form);
      setShowCreate(false);
      setForm({ name: '', description: '', privacy: 'family' });
      navigation.navigate('TreeDetail', { treeId: tree.id });
    } catch (e) { Alert.alert('Error', e.error || 'Failed'); }
    setCreating(false);
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a2744" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>🌳 Family Trees</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowCreate(true)}>
          <Text style={s.addBtnText}>+ New Tree</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={trees}
        keyExtractor={t => t.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48 }}>🌱</Text>
            <Text style={s.emptyTitle}>No family trees yet</Text>
            <Text style={s.emptySub}>Create your first tree to get started</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => setShowCreate(true)}>
              <Text style={s.emptyBtnText}>+ Create Tree</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item: t }) => (
          <TouchableOpacity style={s.card} onPress={() => navigation.navigate('TreeDetail', { treeId: t.id })}>
            <View style={s.cardHeader}>
              <Text style={s.cardName}>{t.name}</Text>
              <View style={[s.privacyBadge, { backgroundColor: t.privacy === 'public' ? '#dcfce7' : t.privacy === 'family' ? '#dbeafe' : '#f1f5f9' }]}>
                <Text style={[s.privacyText, { color: t.privacy === 'public' ? '#166534' : t.privacy === 'family' ? '#1e40af' : '#475569' }]}>{t.privacy}</Text>
              </View>
            </View>
            {t.description ? <Text style={s.cardDesc} numberOfLines={2}>{t.description}</Text> : null}
            <View style={s.cardMeta}>
              <Text style={s.metaText}>👥 {t.member_count || 0} members</Text>
              <Text style={s.metaText}>🤝 {t.collaborator_count || 0} collaborators</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>New Family Tree</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}><Text style={s.closeBtn}>✕</Text></TouchableOpacity>
          </View>
          <Text style={s.label}>Tree Name *</Text>
          <TextInput style={s.input} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Patel Family" />
          <Text style={s.label}>Description</Text>
          <TextInput style={[s.input, { height: 80 }]} value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} placeholder="Optional description" multiline />
          <Text style={s.label}>Privacy</Text>
          <View style={s.privacyRow}>
            {['public', 'family', 'private'].map(p => (
              <TouchableOpacity key={p} style={[s.privacyOpt, form.privacy === p && s.privacyOptActive]} onPress={() => setForm(f => ({ ...f, privacy: p }))}>
                <Text style={[s.privacyOptText, form.privacy === p && { color: '#fff' }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[s.createBtn, creating && { opacity: 0.6 }]} onPress={createTree} disabled={creating}>
            <Text style={s.createBtnText}>{creating ? 'Creating…' : 'Create Tree'}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f5f0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#1a2744', padding: 20, paddingTop: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#c9a84c', fontSize: 20, fontWeight: '800' },
  addBtn: { backgroundColor: 'rgba(201,168,76,.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#c9a84c' },
  addBtnText: { color: '#c9a84c', fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardName: { fontSize: 17, fontWeight: '700', color: '#1e293b', flex: 1 },
  privacyBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginLeft: 8 },
  privacyText: { fontSize: 11, fontWeight: '700' },
  cardDesc: { color: '#64748b', fontSize: 13, marginBottom: 10 },
  cardMeta: { flexDirection: 'row', gap: 14 },
  metaText: { color: '#94a3b8', fontSize: 12 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 12 },
  emptySub: { color: '#94a3b8', marginTop: 6, marginBottom: 20 },
  emptyBtn: { backgroundColor: '#1a2744', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#c9a84c', fontWeight: '700' },
  modal: { flex: 1, padding: 24, paddingTop: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1a2744' },
  closeBtn: { fontSize: 18, color: '#94a3b8', padding: 4 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 15, color: '#1e293b', marginBottom: 16 },
  privacyRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  privacyOpt: { flex: 1, borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, alignItems: 'center' },
  privacyOptActive: { backgroundColor: '#1a2744', borderColor: '#1a2744' },
  privacyOptText: { fontWeight: '600', color: '#64748b', textTransform: 'capitalize' },
  createBtn: { backgroundColor: '#1a2744', borderRadius: 12, padding: 16, alignItems: 'center' },
  createBtnText: { color: '#c9a84c', fontWeight: '700', fontSize: 16 },
});
