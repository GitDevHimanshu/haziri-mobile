import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, StatusBar, Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { getTeacherId, saveTeacherId, getServerUrl, saveServerUrl, getTrainerName, saveTrainerName } from '../api/client';
import ScreenHeader from '../components/ScreenHeader';
import { useTheme } from '../context/ThemeContext';
import { Feather } from '@expo/vector-icons';

const getInitials = (name) => {
  if (!name) return 'HZ';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const SettingRow = ({
  label, value, editingValue, isEditing, onEdit, onChange, onSave, saved, placeholder, icon, errorMsg, hideBorder
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View style={[s.rowWrap, { borderBottomColor: colors.border, borderBottomWidth: hideBorder ? 0 : 1 }]}>
      <View style={s.rowHeader}>
        <View style={s.rowLeft}>
          <View style={[s.iconBox, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(79,70,229,0.06)' }]}>
            <Feather name={icon} size={16} color={colors.primary} />
          </View>
          <View style={s.rowMeta}>
            <Text style={[s.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
            {!isEditing && (
              <View style={s.valueRow}>
                <Text style={[s.rowValue, { color: colors.text }]}>{value || 'Not set'}</Text>
                {saved && <Text style={s.savedBadge}>✓ Saved</Text>}
              </View>
            )}
          </View>
        </View>

        {!isEditing && (
          <TouchableOpacity onPress={onEdit} style={[s.rowActionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }]} activeOpacity={0.7}>
            <Text style={[s.editBtnTxt, { color: colors.primary }]}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {isEditing && (
        <View style={s.rowEditContainer}>
          <TextInput
            style={[s.rowInput, { color: colors.text, backgroundColor: isDark ? colors.bg : '#f8fafc', borderColor: colors.border }]}
            value={editingValue}
            onChangeText={onChange}
            autoFocus
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            autoCapitalize={label.includes("ID") ? "characters" : "none"}
            autoCorrect={false}
          />
          <View style={s.rowEditActions}>
            <TouchableOpacity style={[s.cancelBtn, { borderColor: colors.border }]} onPress={onEdit} activeOpacity={0.7}>
              <Text style={[s.cancelBtnTxt, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={onSave} activeOpacity={0.8}>
              <Text style={s.saveBtnTxt}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

export default function SettingsScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  
  // Confirmed saved values
  const [teacherId, setTeacherId] = useState('');
  const [trainerName, setTrainerName] = useState('');
  const [serverUrl, setServerUrl] = useState('');

  // Statuses
  const [teacherSaved, setTeacherSaved] = useState(false);
  const [trainerSaved, setTrainerSaved] = useState(false);
  const [urlSaved, setUrlSaved] = useState(false);
  const [testing, setTesting] = useState(false);

  // Edit states & values
  const [editingTeacher, setEditingTeacher] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingUrl, setEditingUrl] = useState(false);

  const [draftTeacherId, setDraftTeacherId] = useState('');
  const [draftTrainerName, setDraftTrainerName] = useState('');
  const [draftServerUrl, setDraftServerUrl] = useState('');

  useEffect(() => {
    getTeacherId().then(id => {
      const cleanId = id === 'default' ? '' : id.toUpperCase();
      setTeacherId(cleanId);
    });
    getTrainerName().then(name => setTrainerName(name));
    getServerUrl().then(url => setServerUrl(url));
  }, []);

  const handleStartEditTeacher = () => {
    setDraftTeacherId(teacherId);
    setEditingTeacher(true);
  };

  const handleStartEditName = () => {
    setDraftTrainerName(trainerName);
    setEditingName(true);
  };

  const handleStartEditUrl = () => {
    setDraftServerUrl(serverUrl);
    setEditingUrl(true);
  };

  const saveTeacher = async () => {
    const v = draftTeacherId.trim().toUpperCase();
    if (!v) { Alert.alert('Error', 'Teacher ID cannot be empty.'); return; }
    await saveTeacherId(v.toLowerCase());
    setTeacherId(v);
    setTeacherSaved(true);
    setEditingTeacher(false);
    setTimeout(() => setTeacherSaved(false), 2000);
  };

  const saveName = async () => {
    const v = draftTrainerName.trim();
    if (!v) { Alert.alert('Error', 'Faculty Name cannot be empty.'); return; }
    await saveTrainerName(v);
    setTrainerName(v);
    setTrainerSaved(true);
    setEditingName(false);
    setTimeout(() => setTrainerSaved(false), 2000);
  };

  const saveUrl = async () => {
    const v = draftServerUrl.trim().replace(/\/$/, '');
    if (!v.startsWith('http')) { Alert.alert('Error', 'URL must start with https:// or http://'); return; }
    await saveServerUrl(v);
    setServerUrl(v);
    setUrlSaved(true);
    setEditingUrl(false);
    setTimeout(() => setUrlSaved(false), 2000);
  };

  const testServer = async () => {
    setTesting(true);
    try {
      const res = await fetch(`${serverUrl}/`);
      const data = await res.json();
      if (data.status === 'ok') {
        Alert.alert('Success', 'Server is online and responding.');
      } else {
        throw new Error();
      }
    } catch {
      Alert.alert('Error', 'Could not reach server. Verify URL.');
    } finally {
      setTesting(false);
    }
  };

  const initials = getInitials(trainerName);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.bg} />
      <ScreenHeader title="Profile" />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Profile Card */}
        <View style={[s.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <LinearGradient
            colors={isDark ? ['#4f46e5', '#1e1b4b'] : ['#818cf8', '#4f46e5']}
            style={s.avatar}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={s.avatarText}>{initials}</Text>
          </LinearGradient>
          <View style={s.profileInfo}>
            <Text style={[s.profileName, { color: colors.text }]} numberOfLines={1}>{trainerName || 'Haziri Faculty'}</Text>
            <View style={[s.profileBadge, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(79,70,229,0.06)' }]}>
              <Text style={[s.profileBadgeTxt, { color: colors.accent }]}>{teacherId || 'NO IDENTIFIER'}</Text>
            </View>
          </View>
        </View>

        {/* Section: Account & Identity */}
        <Text style={[s.groupHeader, { color: colors.textSecondary }]}>ACCOUNT & IDENTITY</Text>
        <View style={[s.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            label="TEACHER ID"
            icon="user"
            value={teacherId}
            editingValue={draftTeacherId}
            isEditing={editingTeacher}
            onEdit={handleStartEditTeacher}
            onChange={setDraftTeacherId}
            onSave={saveTeacher}
            saved={teacherSaved}
            placeholder="e.g. ET018"
          />
          <SettingRow
            label="NAME IN TIMETABLE"
            icon="book"
            value={trainerName}
            editingValue={draftTrainerName}
            isEditing={editingName}
            onEdit={handleStartEditName}
            onChange={setDraftTrainerName}
            onSave={saveName}
            saved={trainerSaved}
            placeholder="e.g. Himanshu Sharma"
            hideBorder
          />
        </View>

        {/* Section: Network Config */}
        <Text style={[s.groupHeader, { color: colors.textSecondary }]}>NETWORK CONFIG</Text>
        <View style={[s.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow
            label="SERVER URL"
            icon="server"
            value={serverUrl}
            editingValue={draftServerUrl}
            isEditing={editingUrl}
            onEdit={handleStartEditUrl}
            onChange={setDraftServerUrl}
            onSave={saveUrl}
            saved={urlSaved}
            placeholder="https://..."
            hideBorder
          />
          
          <TouchableOpacity
            style={[s.testBtn, { borderColor: colors.accent }]}
            onPress={testServer}
            disabled={testing}
            activeOpacity={0.7}
          >
            {testing ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={[s.testBtnTxt, { color: colors.accent }]}>
                Test Server Connection
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Section: External */}
        <Text style={[s.groupHeader, { color: colors.textSecondary }]}>EXTERNAL</Text>
        <TouchableOpacity
          style={[s.linkCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => Linking.openURL('https://github.com/GitDevHimanshu/chalkpad-extention')}
          activeOpacity={0.8}
        >
          <View style={[s.iconCircle, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : '#ede9fe' }]}>
            <Feather name="chrome" size={18} color={colors.accent} />
          </View>
          <View style={s.linkInfo}>
            <Text style={[s.linkTitle, { color: colors.text }]}>Browser Extension</Text>
            <Text style={[s.linkSub, { color: colors.textSecondary }]}>Download the Chrome extension</Text>
          </View>
          <Feather name="external-link" size={16} color={colors.textMuted} style={s.linkArrow} />
        </TouchableOpacity>

        <Text style={[s.footer, { color: colors.textMuted }]}>
          Haziri v2.0.1 • Build 2026
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 },

  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  profileBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  profileBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Setting Group Card
  groupHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 6,
    marginTop: 8,
  },
  groupCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },

  // Row Styles
  rowWrap: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowMeta: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  savedBadge: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
  },
  rowActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editBtnTxt: {
    fontSize: 12,
    fontWeight: '800',
  },

  // Editing container inside the row
  rowEditContainer: {
    marginTop: 12,
  },
  rowInput: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    marginBottom: 10,
  },
  rowEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  saveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnTxt: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cancelBtnTxt: {
    fontSize: 12,
    fontWeight: '800',
  },

  // Test Server button inside Group Card
  testBtn: {
    margin: 12,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  testBtnTxt: {
    fontSize: 13,
    fontWeight: '800',
  },

  // External link card
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 24,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  linkInfo: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  linkSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  linkArrow: {
    marginLeft: 8,
  },

  footer: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
