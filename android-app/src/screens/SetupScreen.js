import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import Storage from '../services/storage';
import API from '../services/api';

export default function SetupScreen({ navigation }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  async function connect() {
    let serverUrl = url.trim();
    if (!serverUrl) return Alert.alert('Error', 'Enter your server URL');
    if (!serverUrl.startsWith('http')) serverUrl = `http://${serverUrl}`;
    serverUrl = serverUrl.replace(/\/$/, '');
    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/auth/me`).catch(() => null);
      // Any response (even 401) means the server is reachable
      if (!res && res !== null) throw new Error('Unreachable');
      await Storage.setServerUrl(serverUrl);
      navigation.replace('Auth');
    } catch {
      Alert.alert('Cannot connect', `Could not reach ${serverUrl}\n\nMake sure:\n• Server is running (npm start)\n• URL is correct\n• Phone and server are on same WiFi`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.bg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.card}>
        <Text style={s.logo}>🌳</Text>
        <Text style={s.title}>FamilyTree Social</Text>
        <Text style={s.sub}>Connect to your server to get started</Text>

        <Text style={s.label}>Server URL</Text>
        <TextInput
          style={s.input}
          value={url}
          onChangeText={setUrl}
          placeholder="http://192.168.1.x:3000"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={connect}
        />
        <Text style={s.hint}>Enter the IP address of the computer running your family tree server</Text>

        <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]} onPress={connect} disabled={loading}>
          <Text style={s.btnText}>{loading ? 'Connecting…' : 'Connect'}</Text>
        </TouchableOpacity>

        <View style={s.tipBox}>
          <Text style={s.tipTitle}>How to find your server IP:</Text>
          <Text style={s.tipText}>1. Run the server: <Text style={s.code}>npm start</Text></Text>
          <Text style={s.tipText}>2. On your computer, run: <Text style={s.code}>hostname -I</Text></Text>
          <Text style={s.tipText}>3. Enter that IP with :3000</Text>
          <Text style={s.tipText}>4. Both devices must be on the same WiFi</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#1a2744', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 28 },
  logo: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#1a2744', textAlign: 'center', marginBottom: 4 },
  sub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 16, color: '#1e293b', marginBottom: 6 },
  hint: { fontSize: 12, color: '#94a3b8', marginBottom: 20 },
  btn: { backgroundColor: '#1a2744', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 24 },
  btnText: { color: '#c9a84c', fontWeight: '700', fontSize: 16 },
  tipBox: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 14 },
  tipTitle: { fontWeight: '700', color: '#334155', marginBottom: 8, fontSize: 13 },
  tipText: { color: '#64748b', fontSize: 12, marginBottom: 4 },
  code: { fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier', color: '#1a2744', fontWeight: '600' },
});
