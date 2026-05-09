import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import API from '../services/api';
import Storage from '../services/storage';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ display_name: '', bio: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await API.auth.me();
      setUser(data);
      setForm({ display_name: data.display_name || '', bio: data.bio || '' });
      await Storage.setUser(data);
    } catch {
      const cached = await Storage.getUser();
      if (cached) { setUser(cached); setForm({ display_name: cached.display_name || '', bio: cached.bio || '' }); }
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function saveProfile() {
    setSaving(true);
    try {
      const updated = await API.auth.updateProfile(form);
      setUser(updated);
      await Storage.setUser(updated);
      setEditing(false);
    } catch (e) {
      Alert.alert('Error', e.error || 'Failed to save');
    }
    setSaving(false);
  }

  async function logout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          try { await API.auth.logout(); } catch { }
          await Storage.clear();
          navigation.replace('Auth');
        }
      }
    ]);
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a2744" /></View>;
  if (!user) return <View style={s.center}><Text>Not signed in</Text></View>;

  const initials = (user.display_name || user.username || '?').charAt(0).toUpperCase();

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20 }}>
      <View style={s.profileCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <Text style={s.displayName}>{user.display_name || user.username}</Text>
        <Text style={s.username}>@{user.username}</Text>
        {user.email && <Text style={s.email}>{user.email}</Text>}
        {user.bio && !editing && <Text style={s.bio}>{user.bio}</Text>}
      </View>

      {editing ? (
        <View style={s.editCard}>
          <Text style={s.sectionTitle}>Edit Profile</Text>
          <Text style={s.label}>Display Name</Text>
          <TextInput style={s.input} value={form.display_name} onChangeText={v => setForm(f => ({ ...f, display_name: v }))}
            placeholder="Your name" autoCapitalize="words" />
          <Text style={s.label}>Bio</Text>
          <TextInput style={[s.input, { height: 80 }]} value={form.bio} onChangeText={v => setForm(f => ({ ...f, bio: v }))}
            placeholder="Tell your family about yourself..." multiline />
          <View style={s.editActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setEditing(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={saveProfile} disabled={saving}>
              <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={s.editProfileBtn} onPress={() => setEditing(true)}>
          <Text style={s.editProfileBtnText}>✏️ Edit Profile</Text>
        </TouchableOpacity>
      )}

      <View style={s.menuCard}>
        <TouchableOpacity style={s.menuItem} onPress={() => navigation.navigate('Trees')}>
          <Text style={s.menuIcon}>🌳</Text>
          <Text style={s.menuLabel}>My Family Trees</Text>
          <Text style={s.menuArrow}>›</Text>
        </TouchableOpacity>
        <View style={s.divider} />
        <TouchableOpacity style={s.menuItem} onPress={() => navigation.navigate('Notifications')}>
          <Text style={s.menuIcon}>🔔</Text>
          <Text style={s.menuLabel}>Notifications</Text>
          <Text style={s.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.logoutBtn} onPress={logout}>
        <Text style={s.logoutBtnText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={s.version}>FamilyTree Social • v1.0.0</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f5f0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  profileCard: { backgroundColor: '#1a2744', borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#c9a84c', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#1a2744' },
  displayName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 2 },
  username: { color: 'rgba(201,168,76,.8)', fontSize: 14, marginBottom: 4 },
  email: { color: 'rgba(255,255,255,.5)', fontSize: 13 },
  bio: { color: 'rgba(255,255,255,.7)', fontSize: 14, marginTop: 10, textAlign: 'center', lineHeight: 20 },
  editProfileBtn: { backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16, borderWidth: 1.5, borderColor: '#e2e8f0' },
  editProfileBtnText: { color: '#1a2744', fontWeight: '700', fontSize: 15 },
  editCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, elevation: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a2744', marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 11, fontSize: 15, color: '#1e293b', marginBottom: 14 },
  editActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontWeight: '600' },
  saveBtn: { flex: 2, backgroundColor: '#1a2744', borderRadius: 10, padding: 12, alignItems: 'center' },
  saveBtnText: { color: '#c9a84c', fontWeight: '700' },
  menuCard: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 1, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  menuIcon: { fontSize: 20 },
  menuLabel: { flex: 1, fontSize: 15, color: '#1e293b', fontWeight: '500' },
  menuArrow: { color: '#94a3b8', fontSize: 18 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 16 },
  logoutBtn: { borderWidth: 2, borderColor: '#fecaca', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16 },
  logoutBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
  version: { textAlign: 'center', color: '#94a3b8', fontSize: 12, marginBottom: 32 },
});
