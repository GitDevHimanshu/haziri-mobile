import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, 
  Modal, Animated, Dimensions, Pressable, Platform,
  PanResponder
} from 'react-native';
import { fetchSessionById } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { Feather } from '@expo/vector-icons';

const { height: SCREEN_H } = Dimensions.get('window');

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

export default function DetailModal({ visible, session: preview, onClose }) {
  const { colors, isDark } = useTheme();
  const [session, setSession] = useState(preview || null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('ALL');
  
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    if (!preview?._id) return;
    try {
      const data = await fetchSessionById(preview._id);
      setSession(data);
    } catch (err) {
      console.log('Error fetching session:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [preview?._id]);

  useEffect(() => {
    if (visible) {
      setSession(preview);
      setFilter('ALL');
      load();
      Animated.spring(slideAnim, {
        toValue: SCREEN_H * 0.1,
        useNativeDriver: true,
        tension: 50,
        friction: 10
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_H,
        duration: 250,
        useNativeDriver: true
      }).start();
    }
  }, [visible, preview, load]);

  const handleClose = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_H,
      duration: 200,
      useNativeDriver: true
    }).start(onClose);
  }, [onClose]);

  const students = session?.allStudents || [];
  const pList = students.filter(s => s.status === 'P');
  const aList = students.filter(s => s.status === 'A');
  const pct = students.length > 0 ? Math.round((pList.length / students.length) * 100) : 0;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return dy > 8 && Math.abs(dy) > Math.abs(dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(SCREEN_H * 0.1 + gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Lowered threshold and added vertical velocity check for easier closing
        if (gestureState.dy > 100 || gestureState.vy > 0.4) {
          handleClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: SCREEN_H * 0.1,
            useNativeDriver: true,
            tension: 50,
            friction: 10
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(slideAnim, {
          toValue: SCREEN_H * 0.1,
          useNativeDriver: true,
          tension: 50,
          friction: 10
        }).start();
      }
    })
  ).current;

  const filteredData = filter === 'P' ? pList : filter === 'A' ? aList : students;
  const groupFull = session?.group || '—';
  const groupShort = groupFull.includes('-') ? groupFull.split('-').pop() : groupFull;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <Animated.View 
          style={[s.sheet, { backgroundColor: colors.bg, transform: [{ translateY: slideAnim }] }]}
        >
          <View style={{ flex: 1 }}>
            <View style={s.handleWrap} {...panResponder.panHandlers}>
              <View style={[s.handle, { backgroundColor: colors.border }]} />
            </View>

            <View style={s.header} {...panResponder.panHandlers}>
              <View style={s.headerTitleWrap}>
                <Text style={[s.headerTitle, { color: colors.text }]}>Attendance Details</Text>
                <Text style={[s.headerDate, { color: colors.textSecondary }]}>{session?.date || '—'}</Text>
              </View>
            </View>

            <View style={s.fixedContent} {...panResponder.panHandlers}>
               <View style={[s.mainCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={s.cardHeader}>
                    <View style={[s.groupBadge, { backgroundColor: isDark ? colors.bg : '#ede9fe' }]}>
                      <Text style={[s.groupTxt, { color: colors.accent }]}>{groupShort}</Text>
                    </View>
                    <Text style={[s.periodLabel, { color: colors.textSecondary }]}>{(session?.periods || []).join(', ')}</Text>
                  </View>

                  <Text style={[s.subjectTitle, { color: colors.text }]} numberOfLines={1}>{session?.subject || 'N/A'}</Text>

                  <View style={s.progressBox}>
                    <View style={[s.barBg, { backgroundColor: isDark ? colors.bg : '#f1f5f9' }]}>
                      <View style={[s.barFill, { width: pct + '%', backgroundColor: colors.primary }]} />
                    </View>
                    
                    <View style={s.progressLabelRow}>
                      <Text style={[s.pctTxt, { color: colors.primary }]}>{pct}% Presence</Text>
                      <View style={s.statsFinalRow}>
                        <View style={s.statItem}>
                          <Text style={[s.statMiniVal, { color: colors.present }]}>{pList.length}</Text>
                          <Text style={[s.statMiniLab, { color: colors.present }]}>PRES</Text>
                        </View>
                        <View style={s.statItem}>
                          <Text style={[s.statMiniVal, { color: colors.absent }]}>{aList.length}</Text>
                          <Text style={[s.statMiniLab, { color: colors.absent }]}>ABS</Text>
                        </View>
                        <View style={s.statItem}>
                          <Text style={[s.statMiniVal, { color: colors.textSecondary }]}>{students.length}</Text>
                          <Text style={[s.statMiniLab, { color: colors.textSecondary }]}>TOT</Text>
                        </View>
                      </View>
                    </View>
                  </View>
               </View>

               <View style={s.filterRow}>
                  <FilterTab label="All" count={students.length} active={filter === 'ALL'} onPress={() => setFilter('ALL')} />
                  <FilterTab label="Present" count={pList.length} active={filter === 'P'} onPress={() => setFilter('P')} />
                  <FilterTab label="Absent" count={aList.length} active={filter === 'A'} onPress={() => setFilter('A')} />
               </View>
            </View>

            {loading && !refreshing && (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            )}

            {!loading || refreshing ? (
              <FlatList
                data={filteredData}
                keyExtractor={(item, i) => item._id || i.toString()}
                contentContainerStyle={s.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
                renderItem={({ item, index }) => <StudentRow student={item} index={index} />}
              />
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { 
    height: SCREEN_H * 0.9, 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    paddingBottom: 20,
    overflow: 'hidden',
  },
  handleWrap: { alignItems: 'center', paddingVertical: 12 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingBottom: 20,
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  headerDate: { fontSize: 13, fontWeight: '600', marginTop: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  fixedContent: { paddingHorizontal: 24, paddingBottom: 10 },
  list: { paddingHorizontal: 24, paddingBottom: 60 },
  mainCard: { 
    borderRadius: 24, padding: 20, borderWidth: 1, 
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4,
    marginBottom: 16,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  groupBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  groupTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  periodLabel: { fontSize: 12, fontWeight: '700' },
  
  subjectTitle: { fontSize: 16, fontWeight: '900', marginBottom: 16 },

  progressBox: { marginTop: 4 },
  barBg: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  barFill: { height: '100%', borderRadius: 3 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pctTxt: { fontSize: 13, fontWeight: '900' },

  statsFinalRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  statItem: { alignItems: 'center' },
  statMiniVal: { fontSize: 13, fontWeight: '900' },
  statMiniLab: { fontSize: 8, fontWeight: '800', opacity: 0.6, marginTop: -2 },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    paddingVertical: 10, borderRadius: 14, borderWidth: 1, gap: 6 
  },
  tabBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tabBadgeTxt: { fontSize: 10, fontWeight: '800' },
  tabTxt: { fontSize: 11, fontWeight: '700' },

  row: { 
    flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: 1,
    paddingVertical: 14,
  },
  serial: { fontSize: 12, fontWeight: '800', width: 24 },
  studentName: { fontSize: 14, fontWeight: '700' },
  statusPill: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pillTxt: { fontSize: 12, fontWeight: '900' },
});
