import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveTeacherId, saveTrainerName } from '../api/client';
import { useTheme } from '../context/ThemeContext';

export default function SetupScreen({ onDone }) {
  const { colors, isDark } = useTheme();
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    const trimmedId = id.trim().toLowerCase();
    const trimmedName = name.trim();
    
    if (!trimmedId) { setError('Please enter a Teacher ID.'); return; }
    if (!trimmedName) { setError('Please enter your Faculty Name.'); return; }
    
    if (trimmedId.length < 3) { setError('ID must be at least 3 characters.'); return; }
    if (!/^[a-z0-9_]+$/.test(trimmedId)) { setError('ID: Only letters, numbers and _ allowed.'); return; }
    
    await saveTeacherId(trimmedId);
    await saveTrainerName(trimmedName);
    onDone();
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.bg} />
      <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={[s.logoCircle, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
            <Text style={s.logoIcon}>✓</Text>
          </View>
          <Text style={[s.appName, { color: isDark ? colors.text : colors.primary }]}>Haziri</Text>
          <Text style={[s.appSub, { color: colors.textSecondary }]}>Attendance Tracker</Text>
        </View>

        {/* Card */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.cardTitle, { color: colors.text }]}>Complete Setup</Text>
          <Text style={[s.cardSub, { color: colors.textSecondary }]}>
            Set your identifiers to sync sessions and extract timetable details.
          </Text>

          <Text style={[s.label, { color: colors.text }]}>Teacher ID</Text>
          <TextInput
            style={[s.input, { color: colors.text, backgroundColor: isDark ? colors.bg : '#f8fafc', borderColor: colors.border }]}
            value={id}
            onChangeText={t => { setId(t); setError(''); }}
            placeholder="e.g. ET018"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="next"
          />
          <Text style={[s.hint, { color: colors.textMuted }]}>Used to sync with your browser extension.</Text>

          <View style={{ height: 20 }} />

          <Text style={[s.label, { color: colors.text }]}>Faculty Name (as in Timetable)</Text>
          <TextInput
            style={[s.input, { color: colors.text, backgroundColor: isDark ? colors.bg : '#f8fafc', borderColor: colors.border }]}
            value={name}
            onChangeText={t => { setName(t); setError(''); }}
            placeholder="e.g. Himanshu Sharma"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <Text style={[s.hint, { color: colors.textMuted }]}>Exact name used in the PDF schedule.</Text>

          {!!error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity style={[s.btn, { backgroundColor: colors.primary, shadowColor: colors.primary }]} onPress={submit} activeOpacity={0.85}>
            <Text style={s.btnTxt}>Enter App →</Text>
          </TouchableOpacity>
        </View>

        <Text style={[s.footer, { color: colors.textMuted }]}>You can change these later in Settings.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },

  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logoCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  logoIcon: { color: '#fff', fontSize: 32, fontWeight: '900' },
  appName: { fontSize: 36, fontWeight: '900', letterSpacing: -2 },
  appSub: { fontSize: 13, fontWeight: '600', marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase' },

  card: { width: '100%', padding: 24, borderRadius: 24, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 6 },
  cardTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  cardSub: { fontSize: 13, lineHeight: 20, marginBottom: 24 },

  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, fontSize: 15, fontWeight: '600', borderWidth: 1 },
  hint: { fontSize: 11, fontStyle: 'italic', marginTop: 4 },
  error: { color: '#dc2626', fontSize: 13, marginTop: 18, fontWeight: '700', textAlign: 'center' },

  btn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 24, width: '100%', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  footer: { fontSize: 11, marginTop: 32, textAlign: 'center', fontWeight: '500' },
});
