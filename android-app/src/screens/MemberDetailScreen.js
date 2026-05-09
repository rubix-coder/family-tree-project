import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import API from '../services/api';

const GENDER_COLORS = { male: '#3b82f6', female: '#ec4899', other: '#8b5cf6' };
const GENDER_BG = { male: 'rgba(59,130,246,.12)', female: 'rgba(236,72,153,.12)', other: 'rgba(139,92,246,.12)' };

export default function MemberDetailScreen({ route, navigation }) {
  const { treeId, memberId, onSave } = route.params;
  const [member, setMember] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [memberId]);

  async function load() {
    setLoading(true);
    try {
      const [m, ms] = await Promise.all([API.members.get(treeId, memberId), API.members.list(treeId)]);
      setMember(m);
      setMembers(ms);
      setForm({
        name: m.name || '',
        gender: m.gender || 'other',
        birth_year: m.birth_year ? String(m.birth_year) : '',
        death_year: m.death_year ? String(m.death_year) : '',
        birth_place: m.birth_place || '',
        bio: m.bio || '',
        paternal_parent_id: m.paternal_parent_id || '',
        maternal_parent_id: m.maternal_parent_id || '',
        spouse_id: m.spouse_id || '',
      });
      navigation.setOptions({ headerTitle: m.name });
    } catch { }
    setLoading(false);
  }

  async function save() {
    if (!form.name.trim()) return Alert.alert('Error', 'Name is required');
    setSaving(true);
    try {
      const payload = {
        ...form,
        birth_year: form.birth_year ? parseInt(form.birth_year) : null,
        death_year: form.death_year ? parseInt(form.death_year) : null,
        paternal_parent_id: form.paternal_parent_id || null,
        maternal_parent_id: form.maternal_parent_id || null,
        spouse_id: form.spouse_id || null,
      };
      await API.members.update(treeId, memberId, payload);
      if (onSave) onSave();
      await load();
      setEditing(false);
    } catch (e) {
      Alert.alert('Error', e.error || 'Failed to save');
    }
    setSaving(false);
  }

  async function deleteMember() {
    Alert.alert('Delete Member', `Remove ${member.name} from the tree?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await API.members.delete(treeId, memberId);
            if (onSave) onSave();
            navigation.goBack();
          } catch (e) {
            Alert.alert('Error', e.error || 'Failed to delete');
          }
        }
      }
    ]);
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1a2744" /></View>;
  if (!member) return <View style={s.center}><Text>Member not found</Text></View>;

  const gc = GENDER_COLORS[member.gender] || GENDER_COLORS.other;
  const gbg = GENDER_BG[member.gender] || GENDER_BG.other;
  const initials = member.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const lifespan = [member.birth_year, member.death_year].filter(Boolean).join(' – ');

  const otherMembers = members.filter(m => m.id !== memberId);

  const findMember = (id) => members.find(m => m.id === id);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  if (editing) {
    return (
      <ScrollView style={s.container} contentContainerStyle={{ padding: 20 }}>
        <Text style={s.sectionTitle}>Edit Member</Text>

        <Text style={s.label}>Full Name *</Text>
        <TextInput style={s.input} value={form.name} onChangeText={set('name')} placeholder="Full name" />

        <Text style={s.label}>Gender</Text>
        <View style={s.genderRow}>
          {['male', 'female', 'other'].map(g => (
            <TouchableOpacity key={g} style={[s.genderOpt, form.gender === g && { backgroundColor: '#1a2744', borderColor: '#1a2744' }]}
              onPress={() => set('gender')(g)}>
              <Text style={[s.genderText, form.gender === g && { color: '#fff' }]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Birth Year</Text>
            <TextInput style={s.input} value={form.birth_year} onChangeText={set('birth_year')} placeholder="1950" keyboardType="number-pad" />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Death Year</Text>
            <TextInput style={s.input} value={form.death_year} onChangeText={set('death_year')} placeholder="Leave blank" keyboardType="number-pad" />
          </View>
        </View>

        <Text style={s.label}>Birth Place</Text>
        <TextInput style={s.input} value={form.birth_place} onChangeText={set('birth_place')} placeholder="City, Country" />

        <Text style={s.label}>Father (Paternal Parent)</Text>
        <View style={s.pickerBox}>
          <TouchableOpacity style={s.clearBtn} onPress={() => set('paternal_parent_id')('')}>
            <Text style={{ color: '#94a3b8', fontSize: 12 }}>Clear</Text>
          </TouchableOpacity>
          {otherMembers.map(m => (
            <TouchableOpacity key={m.id} style={[s.memberOpt, form.paternal_parent_id === m.id && s.memberOptActive]}
              onPress={() => set('paternal_parent_id')(m.id)}>
              <Text style={[s.memberOptText, form.paternal_parent_id === m.id && { color: '#fff' }]}>{m.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Mother (Maternal Parent)</Text>
        <View style={s.pickerBox}>
          <TouchableOpacity style={s.clearBtn} onPress={() => set('maternal_parent_id')('')}>
            <Text style={{ color: '#94a3b8', fontSize: 12 }}>Clear</Text>
          </TouchableOpacity>
          {otherMembers.map(m => (
            <TouchableOpacity key={m.id} style={[s.memberOpt, form.maternal_parent_id === m.id && s.memberOptActive]}
              onPress={() => set('maternal_parent_id')(m.id)}>
              <Text style={[s.memberOptText, form.maternal_parent_id === m.id && { color: '#fff' }]}>{m.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Spouse</Text>
        <View style={s.pickerBox}>
          <TouchableOpacity style={s.clearBtn} onPress={() => set('spouse_id')('')}>
            <Text style={{ color: '#94a3b8', fontSize: 12 }}>Clear</Text>
          </TouchableOpacity>
          {otherMembers.map(m => (
            <TouchableOpacity key={m.id} style={[s.memberOpt, form.spouse_id === m.id && s.memberOptActive]}
              onPress={() => set('spouse_id')(m.id)}>
              <Text style={[s.memberOptText, form.spouse_id === m.id && { color: '#fff' }]}>{m.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Bio</Text>
        <TextInput style={[s.input, { height: 100 }]} value={form.bio} onChangeText={set('bio')} placeholder="Short biography..." multiline />

        <View style={s.editActions}>
          <TouchableOpacity style={s.cancelBtn} onPress={() => setEditing(false)}>
            <Text style={s.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20 }}>
      {/* Profile card */}
      <View style={s.profileCard}>
        <View style={[s.bigAvatar, { backgroundColor: gbg }]}>
          <Text style={[s.bigInitials, { color: gc }]}>{initials}</Text>
        </View>
        <Text style={s.memberName}>{member.name}</Text>
        <View style={[s.genderBadge, { backgroundColor: gbg }]}>
          <Text style={[s.genderBadgeText, { color: gc }]}>{member.gender || 'unknown'}</Text>
        </View>
        {lifespan ? <Text style={s.lifespan}>{lifespan}</Text> : null}
        {member.birth_place ? <Text style={s.birthPlace}>📍 {member.birth_place}</Text> : null}
      </View>

      {/* Relations */}
      {(member.paternal_parent_id || member.maternal_parent_id || member.spouse_id) && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Family Relations</Text>
          {member.paternal_parent_id && (
            <View style={s.relationRow}>
              <Text style={s.relationLabel}>Father</Text>
              <TouchableOpacity onPress={() => navigation.push('MemberDetail', { treeId, memberId: member.paternal_parent_id, onSave })}>
                <Text style={s.relationName}>{findMember(member.paternal_parent_id)?.name || 'Unknown'} ›</Text>
              </TouchableOpacity>
            </View>
          )}
          {member.maternal_parent_id && (
            <View style={s.relationRow}>
              <Text style={s.relationLabel}>Mother</Text>
              <TouchableOpacity onPress={() => navigation.push('MemberDetail', { treeId, memberId: member.maternal_parent_id, onSave })}>
                <Text style={s.relationName}>{findMember(member.maternal_parent_id)?.name || 'Unknown'} ›</Text>
              </TouchableOpacity>
            </View>
          )}
          {member.spouse_id && (
            <View style={s.relationRow}>
              <Text style={s.relationLabel}>Spouse</Text>
              <TouchableOpacity onPress={() => navigation.push('MemberDetail', { treeId, memberId: member.spouse_id, onSave })}>
                <Text style={s.relationName}>{findMember(member.spouse_id)?.name || 'Unknown'} ›</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Bio */}
      {member.bio && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Biography</Text>
          <Text style={s.bioText}>{member.bio}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={s.actionRow}>
        <TouchableOpacity style={s.editBtn} onPress={() => setEditing(true)}>
          <Text style={s.editBtnText}>✏️ Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.deleteBtn} onPress={deleteMember}>
          <Text style={s.deleteBtnText}>🗑 Delete</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f5f0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  profileCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, elevation: 3 },
  bigAvatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  bigInitials: { fontSize: 28, fontWeight: '800' },
  memberName: { fontSize: 22, fontWeight: '800', color: '#1e293b', marginBottom: 6 },
  genderBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8 },
  genderBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  lifespan: { color: '#64748b', fontSize: 14, marginBottom: 4 },
  birthPlace: { color: '#94a3b8', fontSize: 13 },
  section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 1 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  relationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  relationLabel: { color: '#64748b', fontSize: 14 },
  relationName: { color: '#1a2744', fontWeight: '600', fontSize: 14 },
  bioText: { color: '#475569', lineHeight: 22 },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  editBtn: { flex: 1, backgroundColor: '#1a2744', borderRadius: 12, padding: 14, alignItems: 'center' },
  editBtnText: { color: '#c9a84c', fontWeight: '700', fontSize: 15 },
  deleteBtn: { backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca', minWidth: 80 },
  deleteBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 15, color: '#1e293b', marginBottom: 16 },
  row: { flexDirection: 'row' },
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  genderOpt: { flex: 1, borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, alignItems: 'center' },
  genderText: { fontWeight: '600', color: '#64748b', textTransform: 'capitalize' },
  pickerBox: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 8, marginBottom: 16, maxHeight: 160, overflow: 'scroll' },
  clearBtn: { padding: 6, marginBottom: 4 },
  memberOpt: { padding: 8, borderRadius: 8, marginBottom: 4 },
  memberOptActive: { backgroundColor: '#1a2744' },
  memberOptText: { color: '#1e293b', fontSize: 14 },
  editActions: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontWeight: '700' },
  saveBtn: { flex: 2, backgroundColor: '#1a2744', borderRadius: 12, padding: 14, alignItems: 'center' },
  saveBtnText: { color: '#c9a84c', fontWeight: '700' },
});
