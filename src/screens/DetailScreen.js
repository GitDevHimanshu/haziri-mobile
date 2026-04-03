import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchSessionById } from '../api/client';

const GLASS      = 'rgba(255,255,255,0.12)';
const GLASS_BDR  = 'rgba(255,255,255,0.20)';
const FILTERS    = ['all', 'present', 'absent'];

// ── Filter Tab ────────────────────────────────────────────────────
function FilterTab({ label, count, active, onPress }) {
  return (
    <TouchableOpacity
      style={[s.tab, active && s.tabActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[s.tabTxt, active && s.tabTxtActive]}>{label}</Text>
      <View style={[s.tabBadge, active && s.tabBadgeActive]}>
        <Text style={[s.tabBadgeTxt, active && s.tabBadgeTxtActive]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Student Row ───────────────────────────────────────────────────
function StudentRow({ student, index }) {
  const isAbsent = student.status === 'A';
  return (
    <View style={s.row}>
      {/* Serial number */}
      <Text style={s.serial}>{index + 1}</Text>

      {/* Name + Roll */}
      <View style={{ flex: 1 }}>
        <Text style={s.studentName} numberOfLines={1}>{student.roll || '—'}</Text>
      </View>

      {/* Status pill */}
      <View style={[s.statusPill, isAbsent ? s.pillAbsent : s.pillPresent]}>
        <Text style={[s.pillTxt, isAbsent ? s.pillTxtAbsent : s.pillTxtPresent]}>
          {isAbsent ? '✗' : '✓'}
        </Text>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────
export default function DetailScreen({ route, navigation }) {
  const preview = route.params?.session;

  const [session,    setSession]    = useState(preview || null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [filter,     setFilter]     = useState('all');

  const load = useCallback(async (isRefresh = false) => {
    if (!preview?._id) { setLoading(false); return; }
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const data = await fetchSessionById(preview._id);
      setSession(data);
    } catch (e) {
      setError(e.message || 'Could not load session.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [preview?._id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (session?.group) navigation.setOptions({ title: session.group });
  }, [session?.group]);

  const onRefresh = () => { setRefreshing(true); load(true); };





  if (loading && !refreshing) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#a78bfa" />
      <Text style={s.loadTxt}>Loading…</Text>
    </View>
  );

  if (error) return (
    <View style={s.center}>
      <Text style={s.errTitle}>Error</Text>
      <Text style={s.errMsg}>{error}</Text>
      <TouchableOpacity style={s.retryBtn} onPress={load}>
        <Text style={s.retryTxt}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  if (!session) return (
    <View style={s.center}>
      <Text style={s.errMsg}>No session data available.</Text>
    </View>
  );

  const allStudents  = session.allStudents || [];
  const presentCount = session.presentCount ?? allStudents.filter(st => st.status === 'P').length;
  const absentCount  = (session.absentRolls || []).length;
  const total        = session.totalStudents ?? allStudents.length;
  const pct          = total > 0 ? Math.round((presentCount / total) * 100) : 0;
  const periods      = (session.periods || []).join(', ') || '—';

  const filtered = filter === 'all'     ? allStudents
                 : filter === 'present' ? allStudents.filter(st => st.status === 'P')
                 :                        allStudents.filter(st => st.status === 'A');


  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#312e81" />

      {/* ── Fixed top section ── */}
      <View style={s.topSection}>

        {/* Session info row */}
        <View style={s.infoRow}>
          <View style={s.infoPill}>
            <Text style={s.infoPillTxt}>📅  {session.date || '—'}</Text>
          </View>
          <View style={s.infoPill}>
            <Text style={s.infoPillTxt}>Period  {periods}</Text>
          </View>
        </View>

        {/* Subject */}
        <Text style={s.subject} numberOfLines={1}>{session.subject || '—'}</Text>
        {session.class ? <Text style={s.classLbl}>{session.class}</Text> : null}

        {/* Progress bar */}
        <View style={s.barRow}>
          <View style={s.barBg}>
            <View style={[s.barFill, { width: pct + '%' }]} />
          </View>
          <Text style={s.barPct}>{pct}%</Text>
        </View>

        {/* Stat pills row */}
        <View style={s.statsRow}>
          <View style={s.statPill}>
            <Text style={s.statVal}>{total}</Text>
            <Text style={s.statLbl}>Total</Text>
          </View>
          <View style={s.statPill}>
            <Text style={[s.statVal, { color: '#6ee7b7' }]}>{presentCount}</Text>
            <Text style={s.statLbl}>Present</Text>
          </View>
          <View style={s.statPill}>
            <Text style={[s.statVal, { color: absentCount > 0 ? '#fca5a5' : '#c4b5fd' }]}>{absentCount}</Text>
            <Text style={s.statLbl}>Absent</Text>
          </View>
        </View>
      </View>

      {/* ── Fixed filter tabs ── */}
      <View style={s.tabBar}>
        <FilterTab label="All"     count={allStudents.length} active={filter==='all'}     onPress={() => setFilter('all')} />
        <FilterTab label="Present" count={presentCount}       active={filter==='present'} onPress={() => setFilter('present')} />
        <FilterTab label="Absent"  count={absentCount}        active={filter==='absent'}  onPress={() => setFilter('absent')} />
      </View>

      {/* ── Scrollable student list ── */}
      <View style={s.listWrap}>
        <FlatList
          data={filtered}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              tintColor="#a78bfa" colors={['#a78bfa']} />
          }
          renderItem={({ item, index }) => (
            <StudentRow student={item} index={index} />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTxt}>
                {allStudents.length === 0
                  ? 'No student data recorded.'
                  : 'No students match this filter.'}
              </Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 24 }} />}
        />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },

  // Fixed top
  topSection: {
    backgroundColor: '#312e81',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  infoRow:     { flexDirection: 'row', gap: 8, marginBottom: 10 },
  infoPill:    { backgroundColor: GLASS, borderRadius: 10, paddingHorizontal: 10,
                 paddingVertical: 5, borderWidth: 1, borderColor: GLASS_BDR },
  infoPillTxt: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  subject:  { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 2 },
  classLbl: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10 },

  barRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  barBg:   { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2, backgroundColor: '#a78bfa' },
  barPct:  { fontSize: 13, fontWeight: '800', color: '#c4b5fd', minWidth: 36, textAlign: 'right' },

  statsRow: { flexDirection: 'row', gap: 8 },
  statPill: { flex: 1, backgroundColor: GLASS, borderRadius: 12, paddingVertical: 10,
              alignItems: 'center', borderWidth: 1, borderColor: GLASS_BDR },
  statVal:  { fontSize: 20, fontWeight: '800', color: '#c4b5fd' },
  statLbl:  { fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: '600',
              textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },

  // Filter tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(109,40,217,0.08)',
  },
  tab:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  paddingVertical: 7, borderRadius: 10, gap: 6,
                  backgroundColor: 'rgba(109,40,217,0.08)', borderWidth: 1, borderColor: 'transparent' },
  tabActive:    { backgroundColor: '#6d28d9', borderColor: '#6d28d9' },
  tabTxt:       { fontSize: 12, fontWeight: '600', color: '#6d28d9' },
  tabTxtActive: { color: '#fff' },
  tabBadge:         { backgroundColor: 'rgba(109,40,217,0.12)', borderRadius: 8,
                      paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeActive:   { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeTxt:      { fontSize: 10, fontWeight: '700', color: '#6d28d9' },
  tabBadgeTxtActive:{ color: '#fff' },

  // List
  listWrap: { flex: 1, backgroundColor: '#ede9fe' },
  list:     { paddingHorizontal: 16, paddingTop: 10 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f5f3ff',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 6,
    borderWidth: 1, borderColor: 'rgba(109,40,217,0.10)',
  },
  serial:    { fontSize: 11, fontWeight: '700', color: '#a09bc7', width: 22, textAlign: 'right', marginRight: 10 },
  studentName: { fontSize: 13, fontWeight: '600', color: '#1e1b4b' },
  studentRoll: { fontSize: 11, color: '#a09bc7', marginTop: 1 },

  statusPill:      { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pillPresent:     { backgroundColor: '#ecfdf5' },
  pillAbsent:      { backgroundColor: '#fef2f2' },
  pillTxt:         { fontSize: 13, fontWeight: '800' },
  pillTxtPresent:  { color: '#059669' },
  pillTxtAbsent:   { color: '#dc2626' },

  empty:    { alignItems: 'center', paddingTop: 60 },
  emptyTxt: { fontSize: 14, color: '#8b83c3', textAlign: 'center' },

  center:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#312e81' },
  loadTxt:  { marginTop: 12, color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  errTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 6 },
  errMsg:   { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 20 },
  retryBtn: { backgroundColor: 'rgba(167,139,250,0.2)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)',
              paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  retryTxt: { color: '#c4b5fd', fontWeight: '700', fontSize: 14 },
});
