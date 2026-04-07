import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, RefreshControl,
  StatusBar, Animated, PanResponder, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchSessions, deleteSession, getTeacherId, getTrainerName, getTimetable, uploadTimetablePdf, saveTimetable } from '../api/client';
import * as DocumentPicker from 'expo-document-picker';

const { width: SCREEN_W } = Dimensions.get('window');
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toDMY(date) {
  return String(date.getDate()).padStart(2, '0') + '/' +
    String(date.getMonth() + 1).padStart(2, '0') + '/' + date.getFullYear();
}
function formatLabel(date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const dt = new Date(date); dt.setHours(0, 0, 0, 0);
  if (dt.getTime() === today.getTime()) return 'Today';
  if (dt.getTime() === yesterday.getTime()) return 'Yesterday';
  return DAYS_FULL[date.getDay()] + ', ' + date.getDate() + ' ' +
    MONTHS_SHORT[date.getMonth()] + ' ' + date.getFullYear();
}
function addDays(date, n) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}
function relativeTime(iso) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    if (h < 24) return h + 'h ago';
    if (d === 1) return 'yesterday';
    if (d < 7) return d + 'd ago';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch { return ''; }
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning 🌤';
  if (h < 17) return 'Good Afternoon ☀️';
  return 'Good Evening 🌙';
}
function getHeaderDate() {
  const d = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()];
}

// ─── AppHeader ───────────────────────────────────────────────────
function AppHeader({ onSettings, onAddPdf, parsing }) {
  const [teacherId, setTeacherId] = useState('');
  useEffect(() => {
    getTeacherId().then(id => {
      if (id && id !== 'default') setTeacherId(id.toUpperCase());
    });
  }, []);
  return (
    <View style={g.appHeader}>
      <View style={g.appLeft}>
        <View style={g.appNameWrap}>
          <Text style={g.appName}>Haziri</Text>
          {!!teacherId && (
            <View style={g.teacherBadge}>
              <Text style={g.teacherBadgeTxt}>{teacherId}</Text>
            </View>
          )}
        </View>
        <Text style={g.greetText}>{getGreeting()} · {getHeaderDate()}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TouchableOpacity style={g.settingsBtn} onPress={onAddPdf} activeOpacity={0.7} disabled={parsing}>
          {parsing ? <ActivityIndicator size="small" color="#e9d5ff" /> : <Text style={g.settingsIcon}>+</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={g.settingsBtn} onPress={onSettings} activeOpacity={0.7}>
          <Text style={g.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Search Overlay ───────────────────────────────────────────────
function SearchOverlay({ visible, onClose, sessions, onPress, onDelete }) {
  const [query, setQuery] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setQuery('');
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
      ]).start(() => inputRef.current?.focus());
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -60, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const q = query.trim().toLowerCase();
  const results = q ? sessions.filter(s =>
    (s.group || '').toLowerCase().includes(q) ||
    (s.subject || '').toLowerCase().includes(q) ||
    (s.date || '').toLowerCase().includes(q) ||
    (s.class || '').toLowerCase().includes(q)
  ) : [];

  if (!visible) return null;

  return (
    <Animated.View style={[g.overlay, { opacity: fadeAnim }]}>
      {/* Search bar at top */}
      <Animated.View style={[g.overlayBar, { transform: [{ translateY: slideAnim }] }]}>
        <Text style={g.overlayIco}>⌕</Text>
        <TextInput
          ref={inputRef}
          style={g.overlayInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search group, subject or date…"
          placeholderTextColor="rgba(255,255,255,0.35)"
          autoCorrect={false}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={g.overlayClose}>✕</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Results */}
      {q.length > 0 ? (
        results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={item => item._id}
            contentContainerStyle={g.overlayList}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <Text style={g.overlayCount}>{results.length} result{results.length !== 1 ? 's' : ''}</Text>
            }
            renderItem={({ item }) => (
              <SessionCard
                session={item}
                onPress={s => { onClose(); onPress(s); }}
                onDelete={onDelete}
              />
            )}
          />
        ) : (
          <View style={g.overlayEmpty}>
            <Text style={g.overlayEmptyIco}>🔍</Text>
            <Text style={g.overlayEmptyTxt}>No results found</Text>
          </View>
        )
      ) : (
        <View style={g.overlayEmpty}>
          <Text style={g.overlayEmptyIco}>⌕</Text>
          <Text style={g.overlayEmptyTxt}>Type to search sessions</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Session Card ─────────────────────────────────────────────────
function SessionCard({ session, onPress, onDelete, onSwipeStart, onSwipeEnd }) {
  const tx = useRef(new Animated.Value(0)).current;
  const delOpacity = useRef(new Animated.Value(0)).current;
  const [expanded, setExpanded] = useState(false);

  const absent     = (session.absentRolls || []).length;
  const periods    = (session.periods || []).join(', ') || '—';
  const total      = session.totalStudents || 0;
  const present    = session.presentCount  || 0;
  const pct        = total > 0 ? Math.round((present / total) * 100) : 0;
  // Section chip: last segment (e.g. "UP2024-cse-B2" → "B2")
  const rawGroup   = session.group || '—';
  const groupParts = rawGroup.split('-');
  const groupShort = groupParts.length > 1 ? groupParts[groupParts.length - 1] : rawGroup;
  // Class code subtitle: session.class or everything before the last segment
  const classCode  = groupParts.length > 1 ? groupParts.slice(0, -1).join('-') : '';

  const close = () => {
    Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();
    Animated.timing(delOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    onSwipeEnd && onSwipeEnd();
  };

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gg) => Math.abs(gg.dx) > 10 && Math.abs(gg.dy) < 15 && gg.dx < 0,
    onPanResponderGrant: () => { onSwipeStart && onSwipeStart(); },
    onPanResponderMove: (_, gg) => {
      if (gg.dx < 0) {
        tx.setValue(Math.max(gg.dx, -100));
        delOpacity.setValue(Math.min(Math.abs(gg.dx) / 80, 1));
      }
    },
    onPanResponderRelease: (_, gg) => {
      if (gg.dx < -70) {
        Animated.spring(tx, { toValue: -80, useNativeDriver: true }).start();
        Animated.timing(delOpacity, { toValue: 1, duration: 100, useNativeDriver: true }).start();
      } else close();
    },
    onPanResponderTerminate: close,
  })).current;

  const confirmDelete = () => Alert.alert('Delete Session', 'Remove this session?', [
    { text: 'Cancel', style: 'cancel', onPress: close },
    { text: 'Delete', style: 'destructive', onPress: () => { onDelete(session._id); close(); } },
  ]);

  return (
    <View style={g.swipeWrap}>
      <Animated.View style={[g.delBg, { opacity: delOpacity }]}>
        <TouchableOpacity style={g.delBtn} onPress={confirmDelete}>
          <Text style={g.delTxt}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: tx }] }} {...pan.panHandlers}>
        <TouchableOpacity style={g.card} onPress={() => { close(); onPress(session); }} activeOpacity={0.92}>
          {/* Three-column header: B2 chip | info | Period chip */}
          <View style={g.cardRow1}>
            {/* LEFT: section chip */}
            <View style={g.sectionChip}>
              <Text style={g.sectionChipTxt}>{groupShort}</Text>
            </View>

            {/* MIDDLE: subject + class code */}
            <View style={g.cardMid}>
              <Text style={g.subjectTxt} numberOfLines={1}>{session.subject || '—'}</Text>
              {!!classCode && <Text style={g.classCode} numberOfLines={1}>{classCode}</Text>}
            </View>

            {/* RIGHT: period chip */}
            <View style={g.periodChip}>
              <Text style={g.periodChipLbl}>Period</Text>
              <Text style={g.periodChipVal}>{periods}</Text>
            </View>
          </View>

          {/* Bar */}
          <View style={g.barBg}>
            <View style={[g.barFill, { width: pct + '%' }]} />
          </View>

          {/* Inline stats */}
          <View style={g.statsRow}>
            <Text style={g.siNum}>{total}</Text>
            <Text style={g.siLbl}> total</Text>
            <Text style={g.siDot}>  ·  </Text>
            <Text style={[g.siNum, { color: '#15803d' }]}>{present}</Text>
            <Text style={[g.siLbl, { color: '#16a34a' }]}> present</Text>
            <Text style={g.siDot}>  ·  </Text>
            <Text style={[g.siNum, absent > 0 ? { color: '#dc2626' } : { color: '#9490c0' }]}>{absent}</Text>
            <Text style={[g.siLbl, absent > 0 ? { color: '#ef4444' } : { color: '#9490c0' }]}> absent</Text>
            <View style={{ flex: 1 }} />
            <Text style={g.time}>{relativeTime(session.submittedAt)}</Text>
          </View>

          {/* Absent rolls */}
          {absent > 0 && (
            <TouchableOpacity style={g.rollsToggle} onPress={() => setExpanded(v => !v)}>
              <Text style={g.rollsToggleTxt}>
                {expanded ? '▲  Hide rolls' : '▼  ' + absent + ' absent · tap to view'}
              </Text>
              {expanded && <Text style={g.rollsText}>{(session.absentRolls || []).join('  ·  ')}</Text>}
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Date Nav Bar ─────────────────────────────────────────────────
function DateNavBar({ date, hasFuture, onOlder, onNewer }) {
  const label = formatLabel(date);
  const isSpecial = label === 'Today' || label === 'Yesterday';
  return (
    <View style={g.pager}>
      <TouchableOpacity style={g.pagerArrow} onPress={onOlder} activeOpacity={0.7}>
        <Text style={g.pagerArrowTxt}>‹</Text>
      </TouchableOpacity>
      <View style={g.pagerCenter}>
        <Text style={[g.pagerLabel, isSpecial && g.pagerLabelSpecial]}>{label}</Text>
        <Text style={g.pagerSub}>{toDMY(date)}</Text>
      </View>
      <TouchableOpacity style={[g.pagerArrow, !hasFuture && g.pagerArrowOff]}
        onPress={hasFuture ? onNewer : null} activeOpacity={0.7}>
        <Text style={[g.pagerArrowTxt, !hasFuture && { color: 'rgba(255,255,255,0.2)' }]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [allSessions, setAllSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [timetable, setTimetable] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const [undoVisible, setUndoVisible] = useState(false);
  const [undoSession, setUndoSession] = useState(null);
  const undoTimer = useRef(null);
  const [currentDate, setCurrentDate] = useState(new Date(today));

  const slideAnim = useRef(new Animated.Value(0)).current;
  const cardSwiping = useRef(false);
  const currentDateRef = useRef(currentDate);
  const todayRef = useRef(today);
  useEffect(() => { currentDateRef.current = currentDate; }, [currentDate]);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await fetchSessions({ limit: 1000 });
      setAllSessions(res.sessions || []);
      const tt = await getTimetable();
      setTimetable(tt || []);
    } catch (e) { setError(e.message || 'Could not connect.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const startUploadTimetable = async () => {
    const name = await getTrainerName();
    if (!name) {
      Alert.alert('Setup Required', 'Please set "Name in Timetable" in Settings first.');
      return;
    }
    
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setParsing(true);
        const fileUri = res.assets[0].uri;
        
        try {
          const resp = await uploadTimetablePdf(fileUri, name);
          if (resp.success && resp.entries) {
            await saveTimetable(resp.entries);
            setTimetable(resp.entries);
            Alert.alert('Success', `Extracted ${resp.entries.length} classes!`);
          } else {
            Alert.alert('Notice', 'No classes found or parse failed.');
          }
        } catch (serverErr) {
          Alert.alert('Server Error', serverErr.message);
        }
        setParsing(false);
      }
    } catch(e) {
      Alert.alert('Error', 'Failed to read PDF');
      setParsing(false);
    }
  };

  const q = search.trim().toLowerCase();
  const searchResults = q ? allSessions.filter(s =>
    (s.group || '').toLowerCase().includes(q) ||
    (s.subject || '').toLowerCase().includes(q) ||
    (s.date || '').toLowerCase().includes(q) ||
    (s.class || '').toLowerCase().includes(q)
  ) : [];

  const sessionMap = {};
  allSessions.forEach(s => {
    const k = s.date || ''; if (!sessionMap[k]) sessionMap[k] = []; sessionMap[k].push(s);
  });

  const currentKey = toDMY(currentDate);
  const currentSessions = sessionMap[currentKey] || [];
  const hasFuture = currentDate.getTime() < today.getTime();

  const animateTo = (dir, newDate) => {
    const out = dir === 'left' ? -SCREEN_W : SCREEN_W;
    Animated.timing(slideAnim, { toValue: out, duration: 200, useNativeDriver: true }).start(() => {
      setCurrentDate(newDate);
      slideAnim.setValue(-out);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    });
  };

  const goOlder = () => animateTo('right', addDays(currentDate, -1));
  const goNewer = () => { if (hasFuture) animateTo('left', addDays(currentDate, 1)); };

  const pagePan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gg) => !cardSwiping.current && Math.abs(gg.dx) > 40 && Math.abs(gg.dy) < 30,
    onPanResponderRelease: (_, gg) => {
      if (cardSwiping.current) return;
      const cur = currentDateRef.current;
      const isToday = cur.getTime() >= todayRef.current.getTime();
      if (gg.dx < -40 && !isToday) animateTo('left', addDays(cur, 1));
      else if (gg.dx > 40) animateTo('right', addDays(cur, -1));
    },
  })).current;

  const handleDelete = async (id) => {
    try { await deleteSession(id); setAllSessions(prev => prev.filter(s => s._id !== id)); }
    catch { Alert.alert('Error', 'Could not delete. Try again.'); }
  };

  if (loading && !refreshing) return (
    <View style={g.center}>
      <ActivityIndicator size="large" color="#a78bfa" />
      <Text style={g.loadTxt}>Loading sessions…</Text>
    </View>
  );

  if (error) return (
    <View style={g.center}>
      <Text style={g.errTitle}>Connection Error</Text>
      <Text style={g.errMsg}>{error}</Text>
      <TouchableOpacity style={g.retryBtn} onPress={load}>
        <Text style={g.retryTxt}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={g.safe} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#1e1b4b" />
      <View style={g.bgBottom} />

      {/* Dark top section */}
      <View style={g.darkSection}>
        <AppHeader 
          onSettings={() => navigation.navigate('Settings')} 
          onAddPdf={startUploadTimetable}
          parsing={parsing}
        />
        <View style={g.searchWrap}>
          <View style={g.searchBar}>
            <Text style={g.searchIco}>⌕</Text>
            <TextInput style={g.searchIn} value={search} onChangeText={setSearch}
              placeholder="Search group, subject or date…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              returnKeyType="search" autoCorrect={false} />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={g.clearX}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <DateNavBar date={currentDate} hasFuture={hasFuture} onOlder={goOlder} onNewer={goNewer} />
      </View>

      {/* Timetable Section */}
      {q.length === 0 && timetable.length > 0 && (
        <View style={g.ttSection}>
          <View style={g.ttHeader}>
            <Text style={g.ttTitle}>E X T R A C T E D  S C H E D U L E</Text>
            <TouchableOpacity onPress={() => setShowFullSchedule(!showFullSchedule)}>
              <Text style={g.ttToggle}>{showFullSchedule ? 'Hide All' : 'View Full'}</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            horizontal={!showFullSchedule} 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={showFullSchedule ? g.ttListVertical : g.ttListHorizontal}
          >
            {timetable
              .filter(item => showFullSchedule || item.dayOfWeek === DAYS_FULL[currentDate.getDay()])
              .map((item, idx) => (
                <View key={idx} style={[g.ttCard, showFullSchedule && g.ttCardFull]}>
                  <View style={g.ttCardTop}>
                    <Text style={g.ttDay}>{item.dayOfWeek.substring(0,3).toUpperCase()}</Text>
                    <Text style={g.ttTime}>{item.timeRange}</Text>
                  </View>
                  <Text style={g.ttSubject} numberOfLines={1}>{item.subject}</Text>
                  {!!item.group && (
                    <View style={g.ttGroupRow}>
                      <Text style={g.ttGroupTxt}>{item.group}</Text>
                    </View>
                  )}
                  <View style={g.ttCardBot}>
                    <Text style={g.ttBatch} numberOfLines={1}>{item.batch}</Text>
                    <Text style={g.ttRoom}>{item.roomCode || 'TBD'}</Text>
                  </View>
                </View>
              ))}
            {timetable.filter(item => !showFullSchedule && item.dayOfWeek === DAYS_FULL[currentDate.getDay()]).length === 0 && !showFullSchedule && (
              <View style={g.ttEmpty}>
                <Text style={g.ttEmptyTxt}>No classes for {DAYS_FULL[currentDate.getDay()]}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Sessions list */}
      {q.length > 0 ? (
        <FlatList
          data={searchResults}
          keyExtractor={item => item._id}
          contentContainerStyle={g.list}
          ListHeaderComponent={<Text style={g.dayCount}>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</Text>}
          ListEmptyComponent={<View style={g.emptyWrap}><Text style={g.emptyIco}>🔍</Text><Text style={g.emptyTitle}>No results</Text><Text style={g.emptySub}>Try a different search term</Text></View>}
          renderItem={({ item }) => (
            <SessionCard session={item}
              onPress={sess => navigation.navigate('Detail', { session: sess })}
              onDelete={handleDelete} />
          )}
        />
      ) : (
        <Animated.View style={[g.page, { transform: [{ translateX: slideAnim }] }]} {...pagePan.panHandlers}>
          <FlatList
            data={currentSessions}
            keyExtractor={item => item._id}
            contentContainerStyle={g.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a78bfa" colors={['#a78bfa']} />}
            ListHeaderComponent={null}
            renderItem={({ item }) => (
              <SessionCard session={item}
                onPress={sess => navigation.navigate('Detail', { session: sess })}
                onDelete={handleDelete}
                onSwipeStart={() => { cardSwiping.current = true; }}
                onSwipeEnd={() => { cardSwiping.current = false; }} />
            )}
            ListEmptyComponent={
              <View style={g.emptyWrap}>
                <Text style={g.emptyIco}>📋</Text>
                <Text style={g.emptyTitle}>No sessions</Text>
                <Text style={g.emptySub}>No attendance recorded{'\n'}for {toDMY(currentDate)}</Text>
                <View style={g.emptyNav}>
                  <TouchableOpacity style={g.navBtn} onPress={goOlder}><Text style={g.navBtnTxt}>‹ Previous</Text></TouchableOpacity>
                  {hasFuture && <TouchableOpacity style={g.navBtn} onPress={goNewer}><Text style={g.navBtnTxt}>Next ›</Text></TouchableOpacity>}
                </View>
              </View>
            }
          />
        </Animated.View>
      )}


    </SafeAreaView>
  );
}

const GLASS = 'rgba(255,255,255,0.12)';
const GLASS_BDR = 'rgba(255,255,255,0.20)';

const g = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1e1b4b' },
  bgBottom: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#ede9fe' },
  darkSection: { backgroundColor: '#312e81', paddingBottom: 8 },

  appHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  appLeft: { flex: 1 },
  appNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  appName: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  teacherBadge: { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  teacherBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#c4b5fd', letterSpacing: 0.5 },
  greetText: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.55)' },
  settingsBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  settingsIcon: { fontSize: 16, color: '#e9d5ff' },

  searchWrap: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: GLASS, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: GLASS_BDR },
  searchIco: { fontSize: 16, color: 'rgba(255,255,255,0.5)', marginRight: 8 },
  searchIn: { flex: 1, fontSize: 14, color: '#fff', padding: 0 },
  clearX: { fontSize: 12, color: 'rgba(255,255,255,0.4)', paddingHorizontal: 4 },
  dayCount: { fontSize: 11, fontWeight: '700', color: '#4c1d95', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },

  pager: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 4, backgroundColor: GLASS, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: GLASS_BDR },
  pagerArrow: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)' },
  pagerArrowOff: { opacity: 0.3 },
  pagerArrowTxt: { fontSize: 26, color: '#fff', fontWeight: '600', lineHeight: 30 },
  pagerCenter: { flex: 1, alignItems: 'center' },
  pagerLabel: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  pagerLabelSpecial: { color: '#ffffff' },
  pagerSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },

  page: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 16 },

  swipeWrap: { marginBottom: 10 },
  delBg: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', alignItems: 'center', justifyContent: 'center' },
  delBtn: { width: 80, height: '100%', alignItems: 'center', justifyContent: 'center' },
  delTxt: { fontSize: 12, color: '#ef4444', fontWeight: '700' },
  card:           { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(109,94,196,0.10)', shadowColor: '#4c1d95', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.10, shadowRadius: 10, elevation: 4 },
  // Three-column header
  cardRow1:       { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginBottom: 12 },
  // B2 chip — left
  sectionChip:    { backgroundColor: '#ede9fe', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(109,94,196,0.22)', alignItems: 'center', justifyContent: 'center', minWidth: 34 },
  sectionChipTxt: { fontSize: 13, fontWeight: '900', color: '#4c1d95', letterSpacing: -0.3 },
  // Middle info column
  cardMid:        { flex: 1, justifyContent: 'center', gap: 2 },
  subjectTxt:     { fontSize: 13, fontWeight: '700', color: '#1e1b4b', lineHeight: 17 },
  classCode:      { fontSize: 11, color: '#9490c0', fontWeight: '500', lineHeight: 15 },
  // Period chip — right (same shape as sectionChip)
  periodChip:     { backgroundColor: '#ede9fe', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(109,94,196,0.22)', alignItems: 'center', justifyContent: 'center', minWidth: 34 },
  periodChipLbl:  { fontSize: 7, fontWeight: '700', color: '#7c3aed', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 1 },
  periodChipVal:  { fontSize: 12, fontWeight: '900', color: '#4c1d95' },
  // Bar
  barBg:        { height: 3, backgroundColor: 'rgba(109,94,196,0.10)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 },
  barFill:      { height: 3, borderRadius: 2, backgroundColor: '#7c3aed' },
  // Inline stats
  statsRow:     { flexDirection: 'row', alignItems: 'center' },
  siNum:        { fontSize: 16, fontWeight: '800', color: '#1e1b4b' },
  siLbl:        { fontSize: 12, fontWeight: '500', color: '#9490c0' },
  siDot:        { fontSize: 12, color: '#c4b5fd' },
  time:         { fontSize: 10, color: '#a09bc7', fontStyle: 'italic' },
  rollsToggle:  { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: 'rgba(109,94,196,0.08)' },
  rollsToggleTxt:{ fontSize: 11, color: '#8b83c3', fontWeight: '500' },
  rollsText:    { fontSize: 11, color: '#6d6a9c', lineHeight: 18, marginTop: 5 },

  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIco: { fontSize: 40, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1e1b4b', marginBottom: 8 },
  emptySub: { fontSize: 13, color: '#6d6a9c', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  emptyNav: { flexDirection: 'row', gap: 10 },
  navBtn: { backgroundColor: 'rgba(109,94,196,0.12)', borderWidth: 1, borderColor: 'rgba(109,94,196,0.25)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  navBtnTxt: { fontSize: 13, color: '#5b21b6', fontWeight: '600' },

  // Search FAB
  fab: {
    position: 'absolute', bottom: 28, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1e1b4b', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 10,
  },
  fabIcon: { fontSize: 22, color: '#e9d5ff' },

  // Search Overlay
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(30,27,75,0.96)',
    zIndex: 999,
  },
  overlayBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    margin: 16, marginTop: 20,
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
  overlayIco: { fontSize: 16, color: 'rgba(255,255,255,0.5)', marginRight: 10 },
  overlayInput: { flex: 1, fontSize: 15, color: '#fff', padding: 0 },
  overlayClose: { fontSize: 14, color: 'rgba(255,255,255,0.5)', paddingLeft: 10, fontWeight: '700' },
  overlayList: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },
  overlayCount: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
  overlayEmpty: { alignItems: 'center', paddingTop: 80 },
  overlayEmptyIco: { fontSize: 36, marginBottom: 12 },
  overlayEmptyTxt: { fontSize: 14, color: 'rgba(255,255,255,0.35)' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#1e1b4b' },
  loadTxt: { marginTop: 12, color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  errTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 6 },
  errMsg: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 20 },
  retryBtn: { backgroundColor: 'rgba(167,139,250,0.2)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  retryTxt: { color: '#c4b5fd', fontWeight: '700', fontSize: 14 },

  ttSection: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(109,94,196,0.08)' },
  ttHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  ttTitle: { fontSize: 9, fontWeight: '900', color: '#6d28d9', letterSpacing: 1.5, opacity: 0.6 },
  ttToggle: { fontSize: 11, fontWeight: '700', color: '#7c3aed' },
  ttListHorizontal: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  ttListVertical: { paddingHorizontal: 16, gap: 10 },
  ttCard: { backgroundColor: '#fff', width: 140, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(109,94,196,0.12)', shadowColor: '#4c1d95', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  ttCardFull: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12 },
  ttCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  ttDay: { fontSize: 9, fontWeight: '900', color: '#7c3aed', backgroundColor: '#f5f3ff', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  ttTime: { fontSize: 10, fontWeight: '700', color: '#6d6a9c' },
  ttSubject: { fontSize: 12, fontWeight: '800', color: '#1e1b4b', marginBottom: 2 },
  ttGroupRow: { backgroundColor: 'rgba(109,94,196,0.1)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, alignSelf: 'flex-start', marginBottom: 6 },
  ttGroupTxt: { fontSize: 9, fontWeight: '700', color: '#6d28d9', letterSpacing: 0.3 },
  ttCardBot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ttBatch: { flex: 1, fontSize: 10, fontWeight: '600', color: '#9490c0', marginRight: 4 },
  ttRoom: { fontSize: 10, fontWeight: '900', color: '#6d28d9', backgroundColor: '#f5f3ff', paddingHorizontal: 4, borderRadius: 4 },
  ttEmpty: { height: 60, width: SCREEN_W - 32, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(109,94,196,0.05)', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(109,94,196,0.2)' },
  ttEmptyTxt: { fontSize: 11, color: '#9490c0', fontWeight: '500' },
});
