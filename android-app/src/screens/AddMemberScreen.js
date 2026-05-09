import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import API from '../services/api';

const EMPTY_ENTRY = () => ({
  name: '', gender: 'other', birth_year: '', death_year: '',
  birth_place: '', bio: '', paternal_parent_id: '', maternal_parent_id: '', spouse_id: '',
});

export default function AddMemberScreen({ route, navigation }) {
  const { treeId, members: initialMembers = [], onSave } = route.params;
  const [entries, setEntries] = useState([EMPTY_ENTRY()]);
  const [allMembers, setAllMembers] = useState(initialMembers);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initialMembers.length) {
      API.members.list(treeId).then(setAllMembers).catch(() => {});
    }
  }, []);

  function updateEntry(index, key, value) {
    setEntries(es => es.map((e, i) => i === index ? { ...e, [key]: value } : e));
  }

  function addEntry() {
    if (entries.length >= 6) return Alert.alert('Limit', 'Maximum 6 members at once');
    setEntries(es => [...es, EMPTY_ENTRY()]);
  }

  function removeEntry(index) {
    if (entries.length === 1) return;
    setEntries(es => es.filter((_, i) => i !== index));
  }

  async function save() {
    const invalid = entries.find(e => !e.name.trim());
    if (invalid) return Alert.alert('Error', 'All entries need a name');
    setSaving(true);
    let saved = 0, failed = 0;
    for (const entry of entries) {
      try {
        await API.members.create(treeId, {
          ...entry,
          birth_year: entry.birth_year ? parseInt(entry.birth_year) : null,
          death_year: entry.death_year ? parseInt(entry.death_year) : null,
          paternal_parent_id: entry.paternal_parent_id || null,
          maternal_parent_id: entry.maternal_parent_id || null,
          spouse_id: entry.spouse_id || null,
        });
        saved++;
      } catch { failed++; }
    }
    setSaving(false);
    if (onSave) onSave();
    if (failed) Alert.alert('Partial Success', `${saved} added, ${failed} failed`);
    navigation.goBack();
  }

  const MemberPicker = ({ label, value, onSelect, exclude = [] }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.hScroll}>
        <TouchableOpacity style={[s.pill, !value && s.pillActive]} onPress={() => onSelect('')}>
          <Text style={[s.pillText, !value && s.pillTextActive]}>None</Text>
        </TouchableOpacity>
        {allMembers.filter(m => !exclude.includes(m.id)).map(m => (
          <TouchableOpacity key={m.id} style={[s.pill, value === m.id && s.pillActive]} onPress={() => onSelect(m.id)}>
            <Text style={[s.pillText, value === m.id && s.pillTextActive]}>{m.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20 }}>
      {entries.map((entry, index) => (
        <View key={index} style={s.entryCard}>
          <View style={s.entryHeader}>
            <Text style={s.entryNum}>Member {index + 1}</Text>
            {entries.length > 1 && (
              <TouchableOpacity onPress={() => removeEntry(index)}>
                <Text style={s.removeBtn}>✕ Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={s.label}>Full Name *</Text>
          <TextInput style={s.input} value={entry.name} onChangeText={v => updateEntry(index, 'name', v)}
            placeholder="e.g. Arjun Patel" autoCapitalize="words" />

          <Text style={s.label}>Gender</Text>
          <View style={s.genderRow}>
            {['male', 'female', 'other'].map(g => (
              <TouchableOpacity key={g} style={[s.genderOpt, entry.gender === g && s.genderOptActive]}
                onPress={() => updateEntry(index, 'gender', g)}>
                <Text style={[s.genderText, entry.gender === g && { color: '#fff' }]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Birth Year</Text>
              <TextInput style={s.input} value={entry.birth_year} onChangeText={v => updateEntry(index, 'birth_year', v)}
                placeholder="1980" keyboardType="number-pad" />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Death Year</Text>
              <TextInput style={s.input} value={entry.death_year} onChangeText={v => updateEntry(index, 'death_year', v)}
                placeholder="Optional" keyboardType="number-pad" />
            </View>
          </View>

          <Text style={s.label}>Birth Place</Text>
          <TextInput style={s.input} value={entry.birth_place} onChangeText={v => updateEntry(index, 'birth_place', v)}
            placeholder="City, Country" />

          {allMembers.length > 0 && (
            <>
              <MemberPicker label="Father (Paternal Parent)" value={entry.paternal_parent_id}
                onSelect={v => updateEntry(index, 'paternal_parent_id', v)} />
              <MemberPicker label="Mother (Maternal Parent)" value={entry.maternal_parent_id}
                onSelect={v => updateEntry(index, 'maternal_parent_id', v)} />
              <MemberPicker label="Spouse" value={entry.spouse_id}
                onSelect={v => updateEntry(index, 'spouse_id', v)} />
            </>
          )}

          <Text style={s.label}>Biography</Text>
          <TextInput style={[s.input, { height: 70 }]} value={entry.bio} onChangeText={v => updateEntry(index, 'bio', v)}
            placeholder="Optional short biography..." multiline />
        </View>
      ))}

      {entries.length < 6 && (
        <TouchableOpacity style={s.addMoreBtn} onPress={addEntry}>
          <Text style={s.addMoreText}>+ Add Another Member</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving
          ? <ActivityIndicator color="#c9a84c" />
          : <Text style={s.saveBtnText}>Save {entries.length > 1 ? `${entries.length} Members` : 'Member'}</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f5f0' },
  entryCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, elevation: 2 },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  entryNum: { fontSize: 14, fontWeight: '700', color: '#1a2744' },
  removeBtn: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  label: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 11, fontSize: 14, color: '#1e293b', marginBottom: 12 },
  row: { flexDirection: 'row' },
  genderRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  genderOpt: { flex: 1, borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 8, padding: 8, alignItems: 'center' },
  genderOptActive: { backgroundColor: '#1a2744', borderColor: '#1a2744' },
  genderText: { fontWeight: '600', color: '#64748b', fontSize: 13, textTransform: 'capitalize' },
  hScroll: { flexDirection: 'row' },
  pill: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 },
  pillActive: { backgroundColor: '#1a2744', borderColor: '#1a2744' },
  pillText: { color: '#64748b', fontSize: 13, fontWeight: '500' },
  pillTextActive: { color: '#c9a84c', fontWeight: '700' },
  addMoreBtn: { borderWidth: 2, borderColor: '#c9a84c', borderRadius: 12, borderStyle: 'dashed', padding: 14, alignItems: 'center', marginBottom: 14 },
  addMoreText: { color: '#c9a84c', fontWeight: '700', fontSize: 14 },
  saveBtn: { backgroundColor: '#1a2744', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 32 },
  saveBtnText: { color: '#c9a84c', fontWeight: '700', fontSize: 16 },
});
