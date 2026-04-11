import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, RefreshControl,
  StatusBar, Animated, PanResponder, Alert, Dimensions, BackHandler,
  Modal, Pressable
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { fetchSessions, deleteSession, getTeacherId, getTrainerName, getTimetable, saveTimetable } from '../api/client';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import PdfParserWebView from '../components/PdfParserWebView';
import { requestNotificationPermissions, scheduleTimetableNotifications } from '../utils/notifications';
import { Feather } from '@expo/vector-icons';
import FloatingTabBar from '../components/FloatingTabBar';
import ScreenHeader from '../components/ScreenHeader';
import { HomeScreenSkeleton } from '../components/SkeletonLoader';
import { useTheme } from '../context/ThemeContext';
import DetailModal from '../components/DetailModal';

const SCREEN_H = Dimensions.get('window').height;
const SCREEN_W = Dimensions.get('window').width;

// ─── Custom Calendar Modal ───────────────────────────────────────
function CalendarModal({ visible, selectedDate, onClose, onSelect }) {
  const { colors, isDark } = useTheme();
  const [viewDate, setViewDate] = useState(new Date(selectedDate));
  
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const firstDay = (y, m) => new Date(y, m, 1).getDay();

  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();
  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const days = [];
  const totalDays = daysInMonth(year, month);
  const offset = firstDay(year, month);

  for (let i = 0; i < offset; i++) days.push(null);
  for (let i = 1; i <= totalDays; i++) days.push(new Date(year, month, i));

  const changeMonth = (delta) => {
    const d = new Date(viewDate);
    d.setMonth(d.getMonth() + delta);
    if (d > new Date()) return;
    setViewDate(d);
  };

  const isSelected = (d) => d && d.toDateString() === selectedDate.toDateString();
  const isFuture = (d) => d && d > new Date();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={{ backgroundColor: colors.card, borderRadius: 32, padding: 20, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={{ padding: 10 }}>
              <Feather name="chevron-left" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '900', color: colors.text }}>{monthName.toUpperCase()}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={{ padding: 10 }}>
              <Feather name="chevron-right" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', marginBottom: 10 }}>
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '900', color: colors.textSecondary }}>{d}</Text>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {days.map((d, i) => {
              const selected = isSelected(d);
              const disabled = !d || isFuture(d);
              return (
                <TouchableOpacity 
                  key={i} 
                  disabled={disabled}
                  onPress={() => { onSelect(d); onClose(); }}
                  style={{ 
                    width: '14.28%', height: 40, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: selected ? colors.primary : 'transparent',
                    borderRadius: 12,
                    opacity: disabled ? 0.3 : 1
                  }}
                >
                  <Text style={{ 
                    fontSize: 14, fontWeight: '800', 
                    color: selected ? '#fff' : (disabled ? colors.textMuted : colors.text) 
                  }}>{d ? d.getDate() : ''}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity 
            onPress={onClose}
            style={{ marginTop: 20, alignItems: 'center', paddingVertical: 10 }}
          >
            <Text style={{ fontWeight: '900', color: '#ef4444', fontSize: 13, textDecorationLine: 'underline', letterSpacing: 0.5 }}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

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

// ─── Search Overlay ───────────────────────────────────────────────
function SearchOverlay({ visible, onClose, sessions, onPress, onDelete }) {
  const { colors, isDark } = useTheme();
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
    <Animated.View style={[g.overlay, { opacity: fadeAnim, backgroundColor: colors.glass }]}>
      <Animated.View style={[g.overlayBar, { transform: [{ translateY: slideAnim }], backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[g.overlayIco, { color: colors.primary }]}>⌕</Text>
        <TextInput
          ref={inputRef}
          style={[g.overlayInput, { color: colors.text }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search group…"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[g.overlayClose, { color: '#ef4444' }]}>✕</Text>
        </TouchableOpacity>
      </Animated.View>

      {q.length > 0 ? (
        results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={item => item._id}
            contentContainerStyle={g.overlayList}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <Text style={[g.overlayCount, { color: colors.primary }]}>{results.length} result{results.length !== 1 ? 's' : ''}</Text>
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
            <Text style={[g.overlayEmptyTxt, { color: colors.textSecondary }]}>No results found</Text>
          </View>
        )
      ) : (
        <View style={g.overlayEmpty}>
          <Text style={g.overlayEmptyIco}>⌕</Text>
          <Text style={[g.overlayEmptyTxt, { color: colors.textSecondary }]}>Type to search sessions</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Session Card ─────────────────────────────────────────────────
function SessionCard({ session, onPress, onDelete, onSwipeStart, onSwipeEnd }) {
  const { colors, isDark } = useTheme();
  const tx = useRef(new Animated.Value(0)).current;
  const delOpacity = useRef(new Animated.Value(0)).current;
  const [expanded, setExpanded] = useState(false);

  const absent     = (session.absentRolls || []).length;
  const periods    = (session.periods || []).join(', ') || '—';
  const total      = session.totalStudents || 0;
  const present    = session.presentCount  || 0;
  const pct        = total > 0 ? Math.round((present / total) * 100) : 0;
  const rawGroup   = session.group || '—';
  const groupParts = rawGroup.split('-');
  const groupShort = groupParts.length > 1 ? groupParts[groupParts.length - 1] : rawGroup;
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
        <TouchableOpacity style={[g.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => { close(); onPress(session); }} activeOpacity={0.92}>
          <View style={g.cardRow1}>
            <View style={[g.sectionChip, { backgroundColor: isDark ? colors.bg : '#ede9fe' }]}>
              <Text style={[g.sectionChipTxt, { color: colors.accent }]}>{groupShort}</Text>
            </View>

            <View style={g.cardMid}>
              <Text style={[g.subjectTxt, { color: colors.text }]} numberOfLines={1}>{session.subject || '—'}</Text>
              {!!classCode && <Text style={[g.classCode, { color: colors.textSecondary }]} numberOfLines={1}>{classCode}</Text>}
            </View>

            <View style={[g.periodChip, { backgroundColor: isDark ? colors.bg : 'rgba(79,70,229,0.05)' }]}>
              <Text style={[g.periodChipLbl, { color: colors.textMuted }]}>Period</Text>
              <Text style={[g.periodChipVal, { color: colors.accent }]}>{periods}</Text>
            </View>
          </View>

          <View style={[g.barBg, { backgroundColor: isDark ? colors.bg : '#f1f5f9' }]}>
            <View style={[g.barFill, { width: pct + '%', backgroundColor: colors.primary }]} />
          </View>

          <View style={g.statsRow}>
            <Text style={[g.siNum, { color: colors.text }]}>{total}</Text>
            <Text style={[g.siLbl, { color: colors.textSecondary }]}> total</Text>
            <Text style={[g.siDot, { color: colors.textMuted }]}>  ·  </Text>
            <Text style={[g.siNum, { color: colors.present }]}>{present}</Text>
            <Text style={[g.siLbl, { color: colors.present }]}> present</Text>
            <Text style={[g.siDot, { color: colors.textMuted }]}>  ·  </Text>
            <Text style={[g.siNum, absent > 0 ? { color: colors.absent } : { color: colors.textSecondary }]}>{absent}</Text>
            <Text style={[g.siLbl, absent > 0 ? { color: colors.absent } : { color: colors.textSecondary }]}> absent</Text>
            <View style={{ flex: 1 }} />
            <Text style={[g.time, { color: colors.textMuted }]}>{relativeTime(session.submittedAt)}</Text>
          </View>

          {absent > 0 && (
            <TouchableOpacity style={[g.rollsToggle, { borderTopColor: colors.border }]} onPress={() => setExpanded(v => !v)}>
              <Text style={[g.rollsToggleTxt, { color: colors.textSecondary }]}>
                {expanded ? '▲  Hide rolls' : '▼  ' + absent + ' absent · tap to view'}
              </Text>
              {expanded && <Text style={[g.rollsText, { color: colors.textSecondary }]}>{(session.absentRolls || []).join('  ·  ')}</Text>}
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Upcoming Class Card ──────────────────────────────────────────
function UpcomingClassCard({ item }) {
  const { colors, isDark } = useTheme();
  if (!item) return null;
  const batchStr = (item.batch + ' ' + (item.group || '')).trim() || 'No Batch';
  return (
    <View style={g.miniWrap}>
      <View style={g.miniHeaderRow}>
        <View style={[g.miniHeaderBar, { backgroundColor: colors.accent }]} />
        <Text style={[g.miniHeader, { color: colors.accent }]}>UP NEXT</Text>
      </View>

      <View style={[g.miniCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={g.miniTopRow}>
          <Text style={[g.miniSubject, { color: colors.text }]} numberOfLines={2}>{item.subject}</Text>
          <View style={[g.miniTimeBox, { backgroundColor: isDark ? colors.bg : colors.bgSecondary, borderColor: colors.border }]}>
            <Feather name="clock" size={11} color={colors.accent} />
            <Text style={[g.miniTime, { color: colors.accent }]}>{item.timeRange}</Text>
          </View>
        </View>
        
        <View style={g.miniChipsWrap}>
          <View style={[g.miniChip, { backgroundColor: isDark ? colors.bg : '#f8fafc', flex: 1 }]}>
            <Feather name="users" size={11} color={colors.textMuted} />
            <Text style={[g.miniChipTxt, { color: colors.textSecondary }]} numberOfLines={1}>{batchStr}</Text>
          </View>

          <View style={[g.miniChip, g.miniRoomChip, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]}>
            <Feather name="map-pin" size={10} color={colors.accent} />
            <Text style={[g.miniRoomTxt, { color: colors.accent }]}>{item.roomCode || '—'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function DateNavBar({ date, hasFuture, onOlder, onNewer, onPressCenter }) {
  const { colors, isDark } = useTheme();
  const label = formatLabel(date);
  const isToday = label === 'Today';
  return (
    <View style={g.pagerWrap}>
      <View style={[g.pager, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity style={g.pagerArrow} onPress={onOlder}>
          <Feather name="chevron-left" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={g.pagerCenter} onPress={onPressCenter} activeOpacity={0.7}>
          <Text style={[g.pagerLabel, { color: isToday ? colors.accent : colors.text }]}>{label.toUpperCase()}</Text>
          <Text style={[g.pagerSub, { color: colors.textSecondary }]}>{date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={g.pagerArrow} onPress={onNewer} disabled={!hasFuture}>
          <Feather name="chevron-right" size={18} color={hasFuture ? colors.textMuted : 'transparent'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────
export default function HomeScreen({ navigation, route }) {
  const { colors, isDark } = useTheme();
  const [allSessions, setAllSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const parserRef = useRef(null);

  const today = new Date(); today.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (route.params?.openSearch) {
      setSearchOpen(true);
      navigation.setParams({ openSearch: false });
    }
    if (route.params?.triggerAdd) {
      startUploadTimetable();
      navigation.setParams({ triggerAdd: false });
    }
  }, [route.params]);

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: { display: searchOpen ? 'none' : 'flex' }
    });
  }, [searchOpen]);

  useEffect(() => {
    const onBackPress = () => {
      if (searchOpen) {
        setSearchOpen(false);
        return true;
      }
      return false;
    };
    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
  }, [searchOpen]);

  const [currentDate, setCurrentDate] = useState(new Date(today));
  const [timetable, setTimetable] = useState([]);
  const [now, setNow] = useState(new Date());

  const slideAnim = useRef(new Animated.Value(0)).current;
  const cardSwiping = useRef(false);
  const currentDateRef = useRef(currentDate);
  const todayRef = useRef(today);
  useEffect(() => { currentDateRef.current = currentDate; }, [currentDate]);

  useEffect(() => {
    requestNotificationPermissions();
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const [res, ttable] = await Promise.all([
         fetchSessions({ limit: 1000 }),
         getTimetable()
      ]);
      setAllSessions(res.sessions || []);
      setTimetable(ttable || []);
      
      // Auto-refresh notifications if we have a timetable
      if (ttable && ttable.length > 0) {
        scheduleTimetableNotifications(ttable);
      }
    } catch (e) { setError(e.message || 'Could not connect.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => { setRefreshing(true); load(true); };

  const startUploadTimetable = async () => {
    const name = await getTrainerName();
    if (!name) {
      Alert.alert('Setup Required', 'Please set "Name in Timetable" in Settings first.');
      return;
    }
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setParsing(true);
        const fileUri = res.assets[0].uri;
        const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
        parserRef.current?.parsePdf(base64, name);
      }
    } catch(e) {
      Alert.alert('Error', 'Failed to read PDF. ' + String(e));
      setParsing(false);
    }
  };

  const handleParseResult = async (entries) => {
    setParsing(false);
    if (entries && entries.length > 0) {
      await saveTimetable(entries);
      const scheduledCount = await scheduleTimetableNotifications(entries, true);
      Alert.alert('Success', `Extracted ${entries.length} classes locally!\nScheduled ${scheduledCount} weekly class reminders.`);
      load();
    } else {
      Alert.alert('Notice', 'No matching timetable records found for your name.');
    }
  };

  const q = search.trim().toLowerCase();
  const sessionMap = {};
  allSessions.forEach(s => {
    const k = s.date || ''; if (!sessionMap[k]) sessionMap[k] = []; sessionMap[k].push(s);
  });

  const currentKey = toDMY(currentDate);
  const currentSessions = (sessionMap[currentKey] || []).sort((a, b) => {
    const p1 = (a.periods && a.periods.length > 0) ? parseInt(a.periods[0], 10) : 99;
    const p2 = (b.periods && b.periods.length > 0) ? parseInt(b.periods[0], 10) : 99;
    return p1 - p2;
  });
  const hasFuture = currentDate.getTime() < today.getTime();
  const isTodayView = currentDate.getTime() === today.getTime();

  let upcomingClass = null;
  if (isTodayView && timetable.length > 0) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = dayNames[now.getDay()];
    const todaysTable = timetable.filter(t => t.dayOfWeek === currentDayName);
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const parseTimeToMins = (iso) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
    todaysTable.sort((a, b) => parseTimeToMins(a.startTime) - parseTimeToMins(b.startTime));
    upcomingClass = todaysTable.find(t => parseTimeToMins(t.startTime) > currentMins);
  }

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

  const onDateChange = (event, date) => {
    setShowPicker(false);
    if (date) {
      const diff = date.getTime() - currentDate.getTime();
      const dir = diff > 0 ? 'left' : 'right';
      animateTo(dir, date);
    }
  };

  const pagePan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gg) => !cardSwiping.current && Math.abs(gg.dx) > 40 && Math.abs(gg.dy) < 30,
    onPanResponderRelease: (_, gg) => {
      if (cardSwiping.current) return;
      const cur = currentDateRef.current;
      if (gg.dx < -40 && cur.getTime() < todayRef.current.getTime()) animateTo('left', addDays(cur, 1));
      else if (gg.dx > 40) animateTo('right', addDays(cur, -1));
    },
  })).current;

  const handleDelete = async (id) => {
    try { await deleteSession(id); setAllSessions(prev => prev.filter(s => s._id !== id)); }
    catch { Alert.alert('Error', 'Could not delete. Try again.'); }
  };

  if (loading && !refreshing) return (
    <SafeAreaView style={[g.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.bg} />
      <ScreenHeader 
        subtext={getGreeting() + ' · ' + getHeaderDate()} 
      />
      <HomeScreenSkeleton />
    </SafeAreaView>
  );

  if (error) return (
    <View style={[g.center, { backgroundColor: colors.bg }]}>
      <Text style={[g.errTitle, { color: colors.text }]}>Connection Error</Text>
      <Text style={[g.errMsg, { color: colors.textSecondary }]}>{error}</Text>
      <TouchableOpacity style={[g.retryBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={load}>
        <Text style={[g.retryTxt, { color: colors.primary }]}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[g.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.bg} />
      
      {!searchOpen && (
        <>
          <ScreenHeader 
            subtext={getGreeting() + ' · ' + getHeaderDate()} 
          />
          <DateNavBar date={currentDate} hasFuture={hasFuture} onOlder={goOlder} onNewer={goNewer} onPressCenter={() => setShowPicker(true)} />
        </>
      )}

      {searchOpen ? (
        <SearchOverlay 
          visible={searchOpen} 
          onClose={() => setSearchOpen(false)} 
          sessions={allSessions}
          onPress={sess => { setSelectedSession(sess); setDetailVisible(true); }}
          onDelete={handleDelete}
        />
      ) : (
        <Animated.View style={[g.page, { transform: [{ translateX: slideAnim }] }]} {...pagePan.panHandlers}>
          <FlatList
            data={currentSessions}
            keyExtractor={item => item._id}
            contentContainerStyle={g.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
            ListHeaderComponent={
               upcomingClass ? (
                 <View>
                   <UpcomingClassCard item={upcomingClass} />
                   <View style={[g.sectionSplitter, { backgroundColor: colors.border }]} />
                 </View>
               ) : null
            }
            renderItem={({ item }) => (
              <SessionCard session={item}
                onPress={sess => { setSelectedSession(sess); setDetailVisible(true); }}
                onDelete={handleDelete}
                onSwipeStart={() => { cardSwiping.current = true; }}
                onSwipeEnd={() => { cardSwiping.current = false; }} />
            )}
            ListEmptyComponent={
              <View style={g.emptyWrap}>
                <Text style={g.emptyIco}>📋</Text>
                <Text style={[g.emptyTitle, { color: colors.text }]}>No sessions</Text>
                <Text style={[g.emptySub, { color: colors.textSecondary }]}>There are no sessions recorded for this date.</Text>
              </View>
            }
          />
        </Animated.View>
      )}

      {parsing && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }]}>
           <View style={[g.card, { padding: 30, alignItems: 'center', backgroundColor: colors.card }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[g.siLbl, { marginTop: 15, fontWeight: '800', color: colors.text }]}>Parsing Timetable...</Text>
           </View>
        </View>
      )}

      <PdfParserWebView ref={parserRef} onResult={handleParseResult} onError={(e) => { setParsing(false); Alert.alert('Parse Error', e.message); }} />

      <DetailModal 
        visible={detailVisible} 
        session={selectedSession} 
        onClose={() => setDetailVisible(false)} 
      />

      <CalendarModal 
        visible={showPicker}
        selectedDate={currentDate}
        onClose={() => setShowPicker(false)}
        onSelect={(date) => {
          const diff = date.getTime() - currentDate.getTime();
          const dir = diff > 0 ? 'left' : 'right';
          animateTo(dir, date);
        }}
      />
    </SafeAreaView>
  );
}

const g = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
  overlayBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderWidth: 1, marginHorizontal: 12, marginTop: 12, borderRadius: 20 },
  overlayIco: { fontSize: 18, marginRight: 10 },
  overlayInput: { flex: 1, fontSize: 16, paddingVertical: 8, fontWeight: '600' },
  overlayClose: { fontSize: 16, paddingLeft: 10, fontWeight: '800' },
  overlayList: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 16 },
  overlayCount: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 16 },
  overlayEmpty: { flex: 1, alignItems: 'center', paddingTop: 100 },
  overlayEmptyIco: { fontSize: 40, marginBottom: 16 },
  overlayEmptyTxt: { fontSize: 14, fontWeight: '500' },

  swipeWrap: { marginBottom: 16 },
  delBg: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, backgroundColor: '#ef4444', borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  delBtn: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  delTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },

  card: { borderRadius: 24, padding: 18, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 15, elevation: 4 },
  cardRow1: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  sectionChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  sectionChipTxt: { fontSize: 14, fontWeight: '900' },
  cardMid: { flex: 1 },
  subjectTxt: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  classCode: { fontSize: 11, fontWeight: '600' },
  periodChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignItems: 'center' },
  periodChipLbl: { fontSize: 8, fontWeight: '900', textTransform: 'uppercase', marginBottom: 1 },
  periodChipVal: { fontSize: 13, fontWeight: '900' },

  barBg: { height: 3, borderRadius: 2, marginBottom: 14, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },

  statsRow: { flexDirection: 'row', alignItems: 'center' },
  siNum: { fontSize: 14, fontWeight: '800' },
  siLbl: { fontSize: 12, fontWeight: '600' },
  siDot: { fontSize: 12, opacity: 0.5 },
  time: { fontSize: 11, fontWeight: '600' },

  rollsToggle: { marginTop: 14, paddingTop: 12, borderTopWidth: 1 },
  rollsToggleTxt: { fontSize: 12, fontWeight: '700' },
  rollsText: { fontSize: 11, fontWeight: '600', marginTop: 8, lineHeight: 18 },

  miniWrap: { paddingHorizontal: 16, marginBottom: 10, marginTop: 4 },
  miniHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  miniHeaderBar: { width: 3, height: 12, borderRadius: 2, marginRight: 8 },
  miniHeader: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  miniCard: { borderRadius: 24, padding: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5 },
  miniTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  miniSubject: { fontSize: 14, fontWeight: '800', lineHeight: 20, flex: 1, marginRight: 12 },
  miniTimeBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  miniTime: { fontSize: 10, fontWeight: '800', marginLeft: 4 },
  miniChipsWrap: { flexDirection: 'row', gap: 8 },
  miniChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  miniChipTxt: { fontSize: 11, fontWeight: '700', marginLeft: 6 },
  miniRoomChip: {},
  miniRoomTxt: { fontSize: 11, fontWeight: '900', marginLeft: 4 },

  pagerWrap: { paddingHorizontal: 16, marginBottom: 12, marginTop: 10 },
  pager: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, paddingVertical: 10, paddingHorizontal: 10, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  pagerArrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  pagerCenter: { flex: 1, alignItems: 'center' },
  pagerLabel: { fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  pagerSub: { fontSize: 10, marginTop: 2, fontWeight: '700', textTransform: 'uppercase' },

  sectionSplitter: { height: 1, marginHorizontal: 20, marginBottom: 16 },
  page: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 10 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIco: { fontSize: 50, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '900', marginBottom: 8 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  errTitle: { fontSize: 20, fontWeight: '900', marginBottom: 8 },
  errMsg: { fontSize: 14, textAlign: 'center', marginBottom: 24, paddingHorizontal: 40 },
  retryBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5 },
  retryTxt: { fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 },
});
