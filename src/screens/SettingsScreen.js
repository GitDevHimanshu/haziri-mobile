import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Switch, StatusBar, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTeacherId, saveTeacherId, getServerUrl, saveServerUrl } from '../api/client';

export default function SettingsScreen({ navigation }) {
  const [teacherId,    setTeacherId]    = useState('');
  const [serverUrl,    setServerUrl]    = useState('');
  const [teacherSaved, setTeacherSaved] = useState(false);
  const [urlSaved,     setUrlSaved]     = useState(false);
  const [editingUrl,   setEditingUrl]   = useState(false);
  const [testing,      setTesting]      = useState(false);

  useEffect(() => {
    getTeacherId().then(id => setTeacherId(id === 'default' ? '' : id.toUpperCase()));
    getServerUrl().then(url => setServerUrl(url));
  }, []);

  const saveTeacher = async () => {
    const v = teacherId.trim();
    if (!v) { Alert.alert('Error', 'Teacher ID cannot be empty.'); return; }
    await saveTeacherId(v);
    setTeacherSaved(true);
    setTimeout(() => setTeacherSaved(false), 2000);
  };

  const saveUrl = async () => {
    const v = serverUrl.trim().replace(/\/$/, '');
    if (!v.startsWith('http')) { Alert.alert('Error', 'URL must start with https://'); return; }
    await saveServerUrl(v);
    setUrlSaved(true);
    setEditingUrl(false);
    setTimeout(() => setUrlSaved(false), 2000);
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const res  = await fetch(serverUrl.trim().replace(/\/$/, '') + '/');
      const data = await res.json();
      Alert.alert('✓ Connected', data.message || 'Server is reachable.');
    } catch (e) {
      Alert.alert('✗ Failed', e.message);
    } finally { setTesting(false); }
  };


  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#312e81" />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* ── ACCOUNT ─────────────────────────────── */}
        <Text style={s.groupLabel}>Account</Text>
        <View style={s.group}>
          {/* Teacher ID row */}
          <View style={s.row}>
            <View style={s.rowIcon}><Text style={s.rowIconTxt}>👤</Text></View>
            <View style={s.rowBody}>
              <Text style={s.rowTitle}>Teacher ID</Text>
              <Text style={s.rowSub}>Identifies your sessions across devices</Text>
              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  value={teacherId}
                  onChangeText={t => { setTeacherId(t); setTeacherSaved(false); }}
                  placeholder="e.g. ET018"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={saveTeacher}
                />
                <TouchableOpacity
                  style={[s.pill, teacherSaved && s.pillGreen]}
                  onPress={saveTeacher} activeOpacity={0.8}
                >
                  <Text style={s.pillTxt}>{teacherSaved ? '✓' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* ── SERVER ──────────────────────────────── */}
        <Text style={s.groupLabel}>Server</Text>
        <View style={s.group}>
          {/* URL row */}
          <View style={s.row}>
            <View style={s.rowIcon}><Text style={s.rowIconTxt}>🌐</Text></View>
            <View style={s.rowBody}>
              <Text style={s.rowTitle}>Server URL</Text>
              {!editingUrl ? (
                <View style={s.editDisplayRow}>
                  <Text style={s.editDisplayVal} numberOfLines={1}>{serverUrl}</Text>
                  <TouchableOpacity style={s.editBtn} onPress={() => setEditingUrl(true)} activeOpacity={0.8}>
                    <Text style={s.editBtnTxt}>Edit</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={s.rowSub}>Your Render deployment endpoint</Text>
                  <View style={s.inputRow}>
                    <TextInput
                      style={s.input}
                      value={serverUrl}
                      onChangeText={t => { setServerUrl(t); setUrlSaved(false); }}
                      placeholder="https://your-app.onrender.com"
                      placeholderTextColor="#8b83c3"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      returnKeyType="done"
                      onSubmitEditing={saveUrl}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={[s.pill, urlSaved && s.pillGreen]}
                      onPress={saveUrl} activeOpacity={0.8}
                    >
                      <Text style={s.pillTxt}>{urlSaved ? '✓' : 'Save'}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={s.divider} />

          {/* Test connection */}
          <TouchableOpacity style={s.row} onPress={testConnection} activeOpacity={0.7}>
            <View style={s.rowIcon}><Text style={s.rowIconTxt}>📡</Text></View>
            <View style={s.rowBody}>
              <Text style={s.rowTitle}>{testing ? 'Testing…' : 'Test Connection'}</Text>
              <Text style={s.rowSub}>Verify server is reachable</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── EXTENSION ──────────────────────────────── */}
        <Text style={s.groupLabel}>Browser Extension</Text>
        <View style={s.group}>



          {/* GitHub button */}
          <TouchableOpacity
            style={s.row}
            onPress={() => Linking.openURL('https://github.com/GitDevHimanshu/chalkpad-extention').catch(() => Alert.alert('Error', 'Could not open link.'))}
            activeOpacity={0.7}
          >
            <View style={s.rowIcon}><Text style={s.rowIconTxt}>⬇️</Text></View>
            <View style={s.rowBody}>
              <Text style={s.rowTitle}>Download Extension</Text>
              <Text style={s.rowSub}>github.com/GitDevHimanshu/chalkpad-extention</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>

          <View style={s.divider} />

          {/* ZIP instructions */}
          <TouchableOpacity
            style={s.row}
            onPress={() => Alert.alert(
              'How to install',
              '1. Open the GitHub link\n2. Click Code → Download ZIP\n3. Extract the ZIP folder\n4. Open Chrome browser\n5. Go to chrome://extensions\n6. Enable Developer Mode (top right)\n7. Click Load unpacked → select the extracted folder\n8. Done! Open Chalkpad and tap the extension icon.',
              [{ text: 'Got it' }]
            )}
            activeOpacity={0.7}
          >
            <View style={s.rowIcon}><Text style={s.rowIconTxt}>📖</Text></View>
            <View style={s.rowBody}>
              <Text style={s.rowTitle}>Installation Guide</Text>
              <Text style={s.rowSub}>Step by step for Chrome browser</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>

        </View>

        {/* ── ABOUT ───────────────────────────────── */}
        <Text style={s.groupLabel}>About</Text>
        <View style={s.group}>
          {[
            { icon:'✓', label:'App',      val:'Haziri' },
            { icon:'🏷', label:'Version',  val:'1.0.0' },

          ].map((item, i, arr) => (
            <View key={item.label}>
              <View style={s.row}>
                <View style={s.rowIcon}><Text style={s.rowIconTxt}>{item.icon}</Text></View>
                <View style={s.rowBody}>
                  <Text style={s.rowTitle}>{item.label}</Text>
                </View>
                <Text style={s.rowVal}>{item.val}</Text>
              </View>
              {i < arr.length - 1 && <View style={s.divider} />}
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex:1, backgroundColor:'#ede9fe' },
  scroll:  { padding:16, paddingBottom:48 },

  groupLabel: {
    fontSize:11, fontWeight:'700', color:'#6d28d9',
    letterSpacing:1.2, textTransform:'uppercase',
    marginBottom:8, marginLeft:4, marginTop:12,
  },
  group: {
    backgroundColor:'rgba(255,255,255,0.92)',
    borderRadius:16, overflow:'hidden',
    borderWidth:1, borderColor:'rgba(255,255,255,0.7)',
    shadowColor:'#4c1d95', shadowOffset:{width:0,height:4},
    shadowOpacity:0.15, shadowRadius:12, elevation:5,
  },

  row: {
    flexDirection:'row', alignItems:'center',
    paddingHorizontal:16, paddingVertical:14, gap:12,
    backgroundColor:'transparent',
  },
  rowIcon: {
    width:36, height:36, borderRadius:10,
    backgroundColor:'rgba(109,40,217,0.15)',
    alignItems:'center', justifyContent:'center',
    flexShrink:0,
  },
  rowIconTxt: { fontSize:18 },
  rowBody:    { flex:1 },
  rowTitle:   { fontSize:14, fontWeight:'600', color:'#2d1b69', marginBottom:2 },
  rowSub:     { fontSize:11, color:'#8b83c3', lineHeight:16 },
  rowVal:     { fontSize:13, fontWeight:'700', color:'#6d28d9' },
  chevron:    { fontSize:20, color:'#94a3b8', marginLeft:4 },
  divider:    { height:1, backgroundColor:'rgba(109,40,217,0.08)', marginLeft:64 },

  inputRow: { flexDirection:'row', gap:8, marginTop:10 },
  input: {
    flex:1, backgroundColor:'rgba(109,40,217,0.12)',
    borderWidth:1, borderColor:'rgba(109,40,217,0.22)',
    borderRadius:10, color:'#2d1b69',
    fontSize:13, paddingHorizontal:12, paddingVertical:9,
  },
  pill: {
    backgroundColor:'#6d28d9', borderRadius:10,
    paddingHorizontal:14, justifyContent:'center', alignItems:'center',
  },
  pillGreen: { backgroundColor:'#059669' },
  pillTxt:   { fontSize:12, fontWeight:'700', color:'#fff' },


  editDisplayRow: { flexDirection:'row', alignItems:'center', marginTop:4, gap:8 },
  editDisplayVal: { flex:1, fontSize:12, color:'#6d28d9', fontWeight:'500' },
  editBtn:        { backgroundColor:'rgba(109,40,217,0.10)', borderWidth:1, borderColor:'rgba(109,40,217,0.2)',
                    borderRadius:8, paddingHorizontal:12, paddingVertical:5 },
  editBtnTxt:     { fontSize:11, fontWeight:'700', color:'#6d28d9' },
});
