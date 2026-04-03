import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveTeacherId } from '../api/client';

export default function SetupScreen({ onDone }) {
  const [id, setId] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    const trimmed = id.trim().toLowerCase();
    if (!trimmed) { setError('Please enter a Teacher ID.'); return; }
    if (trimmed.length < 3) { setError('ID must be at least 3 characters.'); return; }
    if (!/^[a-z0-9_]+$/.test(trimmed)) { setError('Only letters, numbers and _ allowed.'); return; }
    await saveTeacherId(trimmed);
    onDone();
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1e1b4b" />
      <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.logoCircle}>
            <Text style={s.logoIcon}>✓</Text>
          </View>
          <Text style={s.appName}>Haziri</Text>
          <Text style={s.appSub}>Attendance Tracker</Text>
        </View>

        {/* Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Set up your account</Text>
          <Text style={s.cardSub}>
            Enter a unique Teacher ID. Only sessions submitted with this ID will appear in your app.
          </Text>

          <Text style={s.label}>Teacher ID</Text>
          <TextInput
            style={s.input}
            value={id}
            onChangeText={t => { setId(t); setError(''); }}
            placeholder="e.g. himanshu"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <Text style={s.hint}>Use the same ID in your browser extension.</Text>
          {!!error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity style={s.btn} onPress={submit} activeOpacity={0.85}>
            <Text style={s.btnTxt}>Get Started →</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>You can change this later by clearing app data.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },

  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logoCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 5, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  logoIcon: { fontSize: 32, color: '#2563EB', fontWeight: '800' },
  appName: { fontSize: 32, fontWeight: '900', color: '#1e293b', letterSpacing: -1 },
  appSub: { fontSize: 13, color: '#94A3B8', fontWeight: '600', marginTop: 4 },

  card: { width: '100%', backgroundColor: '#fff', borderRadius: 28, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.04, shadowRadius: 30, elevation: 10, borderWidth: 1, borderColor: '#F8FAFC' },
  cardTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b', marginBottom: 8, letterSpacing: -0.5 },
  cardSub: { fontSize: 13, color: '#64748B', lineHeight: 20, marginBottom: 24, fontWeight: '500' },

  label: { fontSize: 11, fontWeight: '800', color: '#2563EB', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, color: '#1e293b', fontSize: 15, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8 },
  hint: { fontSize: 12, color: '#94A3B8', marginBottom: 16, fontWeight: '500' },
  error: { fontSize: 12, color: '#EF4444', marginBottom: 12, fontWeight: '700' },

  btn: { backgroundColor: '#2563EB', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 15, elevation: 5 },
  btnTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },

  footer: { fontSize: 11, color: '#CBD5E1', marginTop: 32, textAlign: 'center', fontWeight: '700' },
});
