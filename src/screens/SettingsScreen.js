import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, StatusBar, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTeacherId, saveTeacherId, getServerUrl, saveServerUrl, getTrainerName, saveTrainerName } from '../api/client';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../context/ThemeContext';
import { Feather } from '@expo/vector-icons';

const Row = ({ label, value, onEdit, isEditing, onChange, onSave, saved, placeholder, icon }) => {
  const { colors, isDark } = useTheme();
  return (
    <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.secHeader}>
        <View style={s.secTitleRow}>
          <Feather name={icon} size={16} color={colors.primary} style={s.secIcon} />
          <Text style={[s.secLabel, { color: colors.textSecondary }]}>{label}</Text>
        </View>
        {!isEditing && (
          <TouchableOpacity onPress={onEdit}>
            <Text style={[s.editBtn, { color: colors.primary }]}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {isEditing ? (
        <View style={s.editWrap}>
          <TextInput
            style={[s.input, { color: colors.text, backgroundColor: isDark ? colors.bg : '#f8fafc', borderColor: colors.border }]}
            value={value}
            onChangeText={onChange}
            autoFocus
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
          />
          <View style={s.btnRow}>
             <TouchableOpacity style={[s.cancelBtn, { borderColor: colors.border }]} onPress={() => onEdit()}>
               <Text style={[s.cancelBtnTxt, { color: colors.textSecondary }]}>Cancel</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={onSave}>
               <Text style={s.saveBtnTxt}>Save Changes</Text>
             </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={s.valRow}>
          <Text style={[s.val, { color: colors.text }]}>{value || 'Not set'}</Text>
          {saved && <Text style={s.saved}>✓ Saved</Text>}
        </View>
      )}
    </View>
  );
};

export default function SettingsScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const [teacherId,    setTeacherId]    = useState('');
  const [trainerName,  setTrainerName]  = useState('');
  const [serverUrl,    setServerUrl]    = useState('');
  const [teacherSaved, setTeacherSaved] = useState(false);
  const [trainerSaved, setTrainerSaved] = useState(false);
  const [urlSaved,     setUrlSaved]     = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(false);
  const [editingName,    setEditingName]    = useState(false);
  const [editingUrl,   setEditingUrl]   = useState(false);
  const [testing,      setTesting]      = useState(false);

  useEffect(() => {
    getTeacherId().then(id => setTeacherId(id === 'default' ? '' : id.toUpperCase()));
    getTrainerName().then(name => setTrainerName(name));
    getServerUrl().then(url => setServerUrl(url));
  }, []);

  const saveTeacher = async () => {
    const v = teacherId.trim();
    if (!v) { Alert.alert('Error', 'Teacher ID cannot be empty.'); return; }
    await saveTeacherId(v);
    setTeacherSaved(true);
    setEditingTeacher(false);
    setTimeout(() => setTeacherSaved(false), 2000);
  };

  const saveName = async () => {
    const v = trainerName.trim();
    if (!v) { Alert.alert('Error', 'Faculty Name cannot be empty.'); return; }
    await saveTrainerName(v);
    setTrainerSaved(true);
    setEditingName(false);
    setTimeout(() => setTrainerSaved(false), 2000);
  };

  const saveUrl = async () => {
    const v = serverUrl.trim().replace(/\/$/, '');
    if (!v.startsWith('http')) { Alert.alert('Error', 'URL must start with https://'); return; }
    await saveServerUrl(v);
    setUrlSaved(true);
    setEditingUrl(false);
    setTimeout(() => setUrlSaved(false), 2000);
  };

  const testServer = async () => {
    setTesting(true);
    try {
      const res = await fetch(`${serverUrl}/`);
      const data = await res.json();
      if (data.status === 'ok') Alert.alert('Success', 'Server is online and responding.');
      else throw new Error();
    } catch {
      Alert.alert('Error', 'Could not reach server. Verify URL.');
    } finally { setTesting(false); }
  };



  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.bg} />
      <ScreenHeader title="Settings" />
      
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={[s.groupHeader, { color: colors.primary }]}>ACCOUNT & IDENTITY</Text>
        <Row
          label="TEACHER ID"
          icon="user"
          value={teacherId}
          isEditing={editingTeacher}
          onEdit={() => setEditingTeacher(!editingTeacher)}
          onChange={setTeacherId}
          onSave={saveTeacher}
          saved={teacherSaved}
          placeholder="e.g. ET018"
        />
        <Row
          label="NAME IN TIMETABLE"
          icon="book"
          value={trainerName}
          isEditing={editingName}
          onEdit={() => setEditingName(!editingName)}
          onChange={setTrainerName}
          onSave={saveName}
          saved={trainerSaved}
          placeholder="e.g. Himanshu Sharma"
        />

        <View style={{ height: 20 }} />
        <Text style={[s.groupHeader, { color: colors.primary }]}>NETWORK CONFIG</Text>
        <Row
          label="SERVER URL"
          icon="server"
          value={serverUrl}
          isEditing={editingUrl}
          onEdit={() => setEditingUrl(!editingUrl)}
          onChange={setServerUrl}
          onSave={saveUrl}
          saved={urlSaved}
          placeholder="https://..."
        />

        <TouchableOpacity 
          style={[s.testBtn, { borderColor: colors.primary }]} 
          onPress={testServer} 
          disabled={testing}
        >
          <Text style={[s.testBtnTxt, { color: colors.primary }]}>
            {testing ? 'Testing...' : 'Test Server Connection'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
        <Text style={[s.groupHeader, { color: colors.primary }]}>EXTERNAL</Text>
        <TouchableOpacity 
          style={[s.linkCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => Linking.openURL('https://github.com/himanshu8443/chalkpad-extension')}
        >
          <View style={[s.iconCircle, { backgroundColor: isDark ? colors.bg : '#ede9fe' }]}>
            <Feather name="chrome" size={18} color={colors.primary} />
          </View>
          <View style={s.linkInfo}>
             <Text style={[s.linkTitle, { color: colors.text }]}>Browser Extension</Text>
             <Text style={[s.linkSub, { color: colors.textSecondary }]}>Download the Chrome extension</Text>
          </View>
          <Feather name="external-link" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        <Text style={[s.footer, { color: colors.textMuted }]}>
          Haziri v1.2.0 • Build 2024.4
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 },

  groupHeader: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12, marginTop: 10 },
  section: { 
    borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  secHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  secTitleRow: { flexDirection: 'row', alignItems: 'center' },
  secIcon: { marginRight: 8 },
  secLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  editBtn: { fontSize: 13, fontWeight: '800' },

  valRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  val: { fontSize: 16, fontWeight: '700' },
  saved: { color: '#16a34a', fontSize: 12, fontWeight: '800' },

  editWrap: { marginTop: 4 },
  input: { 
    padding: 14, borderRadius: 12, fontSize: 15, fontWeight: '700', borderWidth: 1, marginBottom: 16
  },
  btnRow: { flexDirection: 'row', gap: 10 },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  cancelBtnTxt: { fontSize: 13, fontWeight: '800' },

  testBtn: { 
    marginTop: 4, paddingVertical: 15, borderRadius: 16, alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed'
  },
  testBtnTxt: { fontSize: 14, fontWeight: '800' },

  linkCard: { 
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 24, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  linkInfo: { flex: 1 },
  linkTitle: { fontSize: 15, fontWeight: '800' },
  linkSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  footer: { textAlign: 'center', marginTop: 40, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
});
