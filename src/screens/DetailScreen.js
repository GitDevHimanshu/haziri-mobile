import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, StatusBar, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchSessionById } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { Feather } from '@expo/vector-icons';

// ── Segmented Filter Tab ──────────────────────────────────────────
function FilterTab({ label, count, active, onPress }) {
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity
      style={[
        s.tab, 
        { borderColor: colors.border },
        active && { backgroundColor: colors.primary, borderColor: colors.primary }
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[s.tabTxt, { color: colors.textSecondary }, active && { color: '#fff' }]}>{label}</Text>
      <View style={[
        s.tabBadge, 
        { backgroundColor: isDark ? colors.bg : 'rgba(0,0,0,0.05)' },
        active && { backgroundColor: 'rgba(255,255,255,0.2)' }
      ]}>
        <Text style={[s.tabBadgeTxt, { color: colors.textSecondary }, active && { color: '#fff' }]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Elegant Student Row ───────────────────────────────────────────
function StudentRow({ student, index }) {
  const { colors, isDark } = useTheme();
  const isAbsent = student.status === 'A';
  return (
    <View style={[s.row, { borderBottomColor: colors.border }]}>
      <Text style={[s.serial, { color: colors.textMuted }]}>{index + 1}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[s.studentName, { color: colors.text }]} numberOfLines={1}>{student.roll || '—'}</Text>
      </View>
      <View style={[
        s.statusPill, 
        { backgroundColor: isAbsent ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)' }
      ]}>
        <Text style={[
          s.pillTxt, 
          { color: isAbsent ? colors.absent : colors.present }
        ]}>
          {isAbsent ? '✗' : '✓'}
        </Text>
      </View>
    </View>
  );
}

// ── Optimized Screen ──────────────────────────────────────────────
export default function DetailScreen({ route, navigation }) {
  const { colors, isDark } = useTheme();
  const preview = route.params?.session;

  const [session,    setSession]    = useState(preview || null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [filter,     setFilter]     = useState('ALL'); // ALL, P, A

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    if (!preview?._id) return;
    try {
      const data = await fetchSessionById(preview._id);
      setSession(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [preview?._id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const students = session?.allStudents || [];
  const pList = students.filter(s => s.status === 'P');
  const aList = students.filter(s => s.status === 'A');

  const filteredData = 
    filter === 'P' ? pList :
    filter === 'A' ? aList : students;

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.bg} />
      
      {/* Dynamic Header */}
      <View style={[s.header, { backgroundColor: colors.bg }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={s.headerTitleWrap}>
          <Text style={[s.headerTitle, { color: colors.text }]}>Attendance Details</Text>
          <Text style={[s.headerDate, { color: colors.textSecondary }]}>{session?.date || '—'}</Text>
        </View>
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={(item, i) => item._id || i.toString()}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        ListHeaderComponent={
          <>
            <View style={[s.mainCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
               <View style={s.cardTop}>
                  <View style={[s.subjectBadge, { backgroundColor: isDark ? colors.bg : '#f0f9ff', flexShrink: 1 }]}>
                     <Text style={[s.subjectTxt, { color: colors.accent }]} numberOfLines={1}>{session?.subject || 'N/A'}</Text>
                  </View>
                  <Text style={[s.periodTxt, { color: colors.textSecondary, marginLeft: 12 }]}>Period {(session?.periods || []).join(', ')}</Text>
               </View>

               <View style={s.cardMain}>
                  <View style={s.statCol}>
                    <Text style={[s.statVal, { color: colors.text }]}>{pList.length}</Text>
                    <Text style={[s.statLabel, { color: colors.present }]}>Present</Text>
                  </View>
                  <View style={[s.statDivider, { backgroundColor: colors.border }]} />
                  <View style={s.statCol}>
                    <Text style={[s.statVal, { color: colors.text }]}>{aList.length}</Text>
                    <Text style={[s.statLabel, { color: colors.absent }]}>Absent</Text>
                  </View>
                  <View style={[s.statDivider, { backgroundColor: colors.border }]} />
                  <View style={s.statCol}>
                    <Text style={[s.statVal, { color: colors.text }]}>{students.length}</Text>
                    <Text style={[s.statLabel, { color: colors.textSecondary }]}>Total</Text>
                  </View>
               </View>

               <View style={[s.groupStrip, { backgroundColor: isDark ? colors.bg : '#f8fafc', borderColor: colors.border }]}>
                  <Text style={[s.groupLabel, { color: colors.textSecondary }]}>CLASS GROUP</Text>
                  <Text style={[s.groupName, { color: colors.text, flex: 1, textAlign: 'right', marginLeft: 10 }]} numberOfLines={1}>{session?.group || '—'}</Text>
               </View>
            </View>

            <View style={s.filterRow}>
              <FilterTab label="All" count={students.length} active={filter === 'ALL'} onPress={() => setFilter('ALL')} />
              <FilterTab label="Present" count={pList.length} active={filter === 'P'} onPress={() => setFilter('P')} />
              <FilterTab label="Absent" count={aList.length} active={filter === 'A'} onPress={() => setFilter('A')} />
            </View>
          </>
        }
        renderItem={({ item, index }) => <StudentRow student={item} index={index} />}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 14, 
    paddingBottom: 20,
    gap: 16,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  headerDate: { fontSize: 13, fontWeight: '600', marginTop: 1 },

  list: { paddingHorizontal: 20, paddingBottom: 60 },

  mainCard: { 
    borderRadius: 24, padding: 20, borderWidth: 1, 
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 6,
    marginBottom: 24,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  subjectBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  subjectTxt: { fontSize: 14, fontWeight: '800' },
  periodTxt: { fontSize: 13, fontWeight: '700' },

  cardMain: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 },
  statCol: { alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: '900', marginBottom: 4 },
  statLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 30, opacity: 0.5 },

  groupStrip: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    padding: 14, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5,
  },
  groupLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  groupName: { fontSize: 14, fontWeight: '800' },

  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  tab: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    paddingVertical: 10, borderRadius: 14, borderWidth: 1, gap: 8 
  },
  tabBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tabBadgeTxt: { fontSize: 11, fontWeight: '800' },
  tabTxt: { fontSize: 13, fontWeight: '700' },

  row: { 
    flexDirection: 'row', alignItems: 'center', py: 14, gap: 16, borderBottomWidth: 1,
    paddingVertical: 14,
  },
  serial: { fontSize: 12, fontWeight: '800', width: 24 },
  studentName: { fontSize: 15, fontWeight: '700' },
  statusPill: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pillTxt: { fontSize: 14, fontWeight: '900' },
});
