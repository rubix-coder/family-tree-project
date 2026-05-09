import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import API from '../services/api';
import Storage from '../services/storage';

export default function AuthScreen({ navigation }) {
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ login: '', password: '', email: '', username: '', display_name: '' });
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  async function submit() {
    setLoading(true);
    try {
      let data;
      if (tab === 'login') {
        data = await API.auth.login({ login: form.login, password: form.password });
      } else {
        if (!form.display_name || !form.username || !form.email || !form.password)
          return Alert.alert('Error', 'All fields required');
        data = await API.auth.register({ display_name: form.display_name, username: form.username, email: form.email, password: form.password });
      }
      await Storage.setTokens(data.accessToken, data.refreshToken);
      await Storage.setUser(data.user);
      navigation.replace('Main');
    } catch (e) {
      Alert.alert('Error', e.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const inp = (placeholder, key, opts = {}) => (
    <TextInput style={s.input} placeholder={placeholder} placeholderTextColor="#94a3b8"
      value={form[key]} onChangeText={set(key)} {...opts} />
  );

  return (
    <KeyboardAvoidingView style={s.bg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
        <Text style={s.logo}>🌳</Text>
        <Text style={s.title}>FamilyTree Social</Text>
        <Text style={s.sub}>Connect your roots, share your story</Text>

        <View style={s.tabs}>
          {['login', 'register'].map(t => (
            <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabActive]} onPress={() => setTab(t)}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'login' ? 'Sign In' : 'Create Account'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.card}>
          {tab === 'register' && (
            <>
              <Text style={s.label}>Display Name</Text>
              {inp('John Smith', 'display_name', { autoCapitalize: 'words' })}
              <Text style={s.label}>Username</Text>
              {inp('johnsmith', 'username', { autoCapitalize: 'none' })}
              <Text style={s.label}>Email</Text>
              {inp('john@example.com', 'email', { keyboardType: 'email-address', autoCapitalize: 'none' })}
            </>
          )}
          {tab === 'login' && (
            <>
              <Text style={s.label}>Email or Username</Text>
              {inp('your@email.com', 'login', { autoCapitalize: 'none' })}
            </>
          )}
          <Text style={s.label}>Password</Text>
          {inp('••••••••', 'password', { secureTextEntry: true })}

          <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
            <Text style={s.btnText}>{loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.switchLink} onPress={() => { navigation.replace('Setup'); }}>
            <Text style={s.switchText}>← Change server</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#1a2744' },
  logo: { fontSize: 44, textAlign: 'center', marginBottom: 6 },
  title: { fontSize: 22, fontWeight: '800', color: '#c9a84c', textAlign: 'center' },
  sub: { fontSize: 13, color: 'rgba(255,255,255,.6)', textAlign: 'center', marginBottom: 24 },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,.12)', borderRadius: 12, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, padding: 10, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff' },
  tabText: { color: 'rgba(255,255,255,.7)', fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#1a2744' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 22 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 13, fontSize: 15, color: '#1e293b', marginBottom: 14 },
  btn: { backgroundColor: '#1a2744', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#c9a84c', fontWeight: '700', fontSize: 16 },
  switchLink: { alignItems: 'center', marginTop: 14 },
  switchText: { color: '#64748b', fontSize: 13 },
});
