import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, RefreshControl,
  StatusBar, Animated, PanResponder, Alert, Dimensions, BackHandler,
  Modal, Pressable, Platform
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
import * as Clipboard from 'expo-clipboard';

const SCREEN_H = Dimensions.get('window').height;
const SCREEN_W = Dimensions.get('window').width;

// ─── Custom Calendar Modal ───────────────────────────────────────
function CalendarModal({ visible, selectedDate, onClose, onSelect }) {
  const { colors, isDark } = useTheme();
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  useEffect(() => {
    if (visible) {
      setViewDate(new Date(selectedDate));
    }
  }, [visible, selectedDate]);
  
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
  const isTodaySelected = selectedDate && new Date(selectedDate).toDateString() === new Date().toDateString();

  const handleGoToToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    onSelect(today);
    onClose();
  };

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

          {!isTodaySelected && (
            <TouchableOpacity 
              onPress={handleGoToToday}
              style={{ marginTop: 20, alignItems: 'center', paddingVertical: 10 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontWeight: '900', color: colors.primary, fontSize: 13, textDecorationLine: 'underline', letterSpacing: 0.5 }}>TODAY</Text>
            </TouchableOpacity>
          )}
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
function SessionCard({ session, onPress, onDelete }) {
  const { colors, isDark } = useTheme();
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

  const confirmDelete = () => Alert.alert('Delete Session', 'Remove this session?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => onDelete(session._id) },
  ]);

  return (
    <View style={g.cardWrap}>
      <TouchableOpacity 
        style={[g.card, { backgroundColor: colors.card, borderColor: colors.border }]} 
        onPress={() => onPress(session)} 
        onLongPress={confirmDelete}
        delayLongPress={500}
        activeOpacity={0.92}
      >
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
          
          <Text style={[g.time, { color: colors.textMuted }]}>{pct}%</Text>
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
  const [importModalVisible, setImportModalVisible] = useState(false);
  const parserRef = useRef(null);

  const today = new Date(); today.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (route.params?.openSearch) {
      setSearchOpen(true);
      navigation.setParams({ openSearch: false });
    }
    if (route.params?.triggerAdd) {
      setImportModalVisible(true);
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

  const handleCopyPrompt = async () => {
    try {
      const name = await getTrainerName();
      const promptText = `You are a precise data extraction assistant specializing in university timetables. 
Your task is to parse raw text, table structures, or copy-pasted content of a timetable and extract its schedule into a structured JSON array.

Please follow these strict parsing rules and constraints to match the application's internal parser logic:

### 1. Data Schema
Extract the timetable entries into a JSON array of objects. Each object MUST have the following structure:
- \`dayOfWeek\`: Normalised name of the day (e.g. "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Sunday").
- \`startTime\`: ISO 8601 string of the start time (use the current date as the base date).
- \`endTime\`: ISO 8601 string of the end time (use the current date as the base date).
- \`timeRange\`: String formatted as "h:mm A - h:mm A" (e.g. "9:00 AM - 10:40 AM").
- \`subject\`: String. The subject name or code.
- \`roomCode\`: String. The room code, formatted as uppercase with no spaces (e.g., "CVR410R" instead of "CVR 410R").
- \`batch\`: String. The batch code, typically containing a hyphen and no spaces (e.g., "BCA-4A").
- \`group\`: String or null. Contains details if it is group-specific (e.g., "Group 1", "Group 2").

### 2. Logic Constraints & Rules
- **Exclude Saturdays**: Skip any timetable entries on "Saturday".
- **Time Parsing & Merging**: 
  - Standard time formats (e.g., \`9:00-10:40\` or \`10-12\`) should be converted to correct start and end times.
  - If an entry spans across multiple consecutive periods/slots, merge them into a single entry, updating the final \`endTime\` and duration accordingly.
- **Room Code Extraction**:
  - Room codes follow a pattern of 1-4 letters, optional space/hyphen, 1-4 digits, and an optional 'R' at the end (e.g., "CVR 410R", "RJ-101", "CL 3").
  - Clean and normalize them by stripping spaces/hyphens and converting to uppercase (e.g., "CVR-410R" -> "CVR410R").
  - Do NOT mistake metadata tags like "GROUP", "BATCH", "BCA", "MCA", "BTECH" for room codes.
- **Batch Extraction**:
  - A batch is usually identified by a hyphen without spaces and must contain a digit (e.g. "BCA-4A").
- **Group Extraction**:
  - If a line contains the word "Group" (case-insensitive), classify it as the \`group\` field (e.g. "Group 1").
- **Subject Extraction**:
  - Any remaining unrecognized text in a timetable slot after removing room, batch, and group details should be combined and treated as the \`subject\`.

### 3. Output Format
Respond ONLY with the raw JSON array containing the extracted entries. Do not include markdown code block formatting (\`\`\`json) unless explicitly asked, and do not write any introductory or explanatory text.

---
Here is the timetable data to parse:
`;
      await Clipboard.setStringAsync(promptText);
      Alert.alert('Copied!', 'The system prompt has been copied to your clipboard. You can paste it into Gemini AI with your timetable text.');
    } catch (e) {
      Alert.alert('Error', 'Failed to copy to clipboard. ' + String(e));
    }
  };

  const handlePasteJson = async (jsonText) => {
    if (!jsonText || !jsonText.trim()) {
      Alert.alert('Validation Error', 'Please paste the JSON content.');
      return;
    }

    try {
      let cleanJson = jsonText.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(cleanJson);
      
      if (!Array.isArray(parsed)) {
        Alert.alert('Validation Error', 'The pasted content must be a JSON array of objects.');
        return;
      }

      const isValid = parsed.every(item => 
        item &&
        typeof item === 'object' &&
        typeof item.dayOfWeek === 'string' &&
        typeof item.subject === 'string'
      );

      if (!isValid) {
        Alert.alert(
          'Validation Error',
          'Some entries in the JSON array are missing required fields (dayOfWeek or subject).'
        );
        return;
      }

      const normalizedEntries = parsed.map(item => {
        let startTimeVal = item.startTime;
        let endTimeVal = item.endTime;

        const parseTimePart = (timeVal) => {
          if (!timeVal) return { hours: 0, minutes: 0 };
          
          if (typeof timeVal === 'string') {
            if (timeVal.includes('T')) {
              // Extract the HH:MM part directly from ISO string: "2026-07-23T17:50:00.000Z"
              const timeMatch = timeVal.match(/T(\d{2}):(\d{2})/);
              if (timeMatch) {
                return {
                  hours: parseInt(timeMatch[1], 10),
                  minutes: parseInt(timeMatch[2], 10)
                };
              }
            }

            // Match 24-hour format: "17:50" or "5:50"
            const match24 = timeVal.match(/^(\d{1,2}):(\d{2})$/);
            if (match24) {
              return {
                hours: parseInt(match24[1], 10),
                minutes: parseInt(match24[2], 10)
              };
            }

            // Match 12-hour format: "05:50 PM" or "5:50 PM"
            const match12 = timeVal.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
            if (match12) {
              let h = parseInt(match12[1], 10);
              const m = parseInt(match12[2], 10);
              const ampm = match12[3].toUpperCase();
              if (ampm === 'PM' && h < 12) h += 12;
              if (ampm === 'AM' && h === 12) h = 0;
              return { hours: h, minutes: m };
            }
          }

          // Fallback to standard Date parsing
          const d = new Date(timeVal);
          if (!isNaN(d.getTime())) {
            return { hours: d.getHours(), minutes: d.getMinutes() };
          }
          return { hours: 0, minutes: 0 };
        };

        const startParts = parseTimePart(startTimeVal);
        const endParts = parseTimePart(endTimeVal);

        const now = new Date();
        const startLocalDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startParts.hours, startParts.minutes);
        const endLocalDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endParts.hours, endParts.minutes);

        return {
          dayOfWeek: item.dayOfWeek,
          startTime: startLocalDate.toISOString(),
          endTime: endLocalDate.toISOString(),
          timeRange: item.timeRange || 'N/A',
          subject: item.subject,
          roomCode: item.roomCode || '',
          batch: item.batch || '',
          group: item.group || null
        };
      });

      const filteredEntries = normalizedEntries.filter(entry => entry.dayOfWeek !== 'Saturday');

      if (filteredEntries.length === 0) {
        Alert.alert('Notice', 'No classes found (classes on Saturday are ignored).');
        return;
      }

      setImportModalVisible(false);
      await saveTimetable(filteredEntries);
      const scheduledCount = await scheduleTimetableNotifications(filteredEntries, true);
      Alert.alert('Success', `Imported ${filteredEntries.length} classes manually!\nScheduled ${scheduledCount} weekly class reminders.`);
      load();
    } catch (e) {
      Alert.alert('Parse Error', 'Failed to parse JSON. Please make sure the JSON format is correct.\n\nError: ' + e.message);
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
    onMoveShouldSetPanResponder: (_, gg) => Math.abs(gg.dx) > 40 && Math.abs(gg.dy) < 30,
    onPanResponderRelease: (_, gg) => {
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
                onDelete={handleDelete} />
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

      <ImportTimetableModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onUploadPdf={startUploadTimetable}
        onCopyPrompt={handleCopyPrompt}
        onPasteJson={handlePasteJson}
      />

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

  cardWrap: { marginBottom: 16 },

  card: { borderRadius: 24, padding: 18, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
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
  miniCard: { borderRadius: 24, padding: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
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
  pager: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, paddingVertical: 10, paddingHorizontal: 10, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
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

function ImportTimetableModal({ visible, onClose, onUploadPdf, onCopyPrompt, onPasteJson }) {
  const { colors, isDark } = useTheme();
  const [isPasting, setIsPasting] = useState(false);
  const [jsonText, setJsonText] = useState('');

  useEffect(() => {
    if (!visible) {
      setIsPasting(false);
      setJsonText('');
    }
  }, [visible]);

  const handlePasteSubmit = () => {
    onPasteJson(jsonText);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={imStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[imStyles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          
          {/* Header */}
          <View style={imStyles.header}>
            <Text style={[imStyles.title, { color: colors.text }]}>Add Timetable</Text>
            <TouchableOpacity onPress={onClose} style={[imStyles.closeBtn, { backgroundColor: isDark ? colors.bg : '#f1f5f9' }]}>
              <Feather name="x" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          {!isPasting ? (
            <View style={imStyles.content}>
              <Text style={[imStyles.subtitle, { color: colors.textSecondary }]}>
                Choose how you want to import your weekly schedule and set class reminders.
              </Text>

              {/* Option 1: PDF Upload */}
              <TouchableOpacity 
                style={[imStyles.optionCard, { backgroundColor: isDark ? colors.bg : '#f8fafc', borderColor: colors.border }]}
                onPress={() => {
                  onClose();
                  onUploadPdf();
                }}
              >
                <View style={[imStyles.iconCircle, { backgroundColor: isDark ? '#1e293b' : '#ede9fe' }]}>
                  <Feather name="file-text" size={20} color={colors.primary} />
                </View>
                <View style={imStyles.optionInfo}>
                  <Text style={[imStyles.optionTitle, { color: colors.text }]}>Upload PDF Timetable</Text>
                  <Text style={[imStyles.optionDesc, { color: colors.textSecondary }]}>
                    Select your official PDF timetable to extract schedules automatically.
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              {/* Option 2: Copy Gemini Prompt */}
              <TouchableOpacity 
                style={[imStyles.optionCard, { backgroundColor: isDark ? colors.bg : '#f8fafc', borderColor: colors.border }]}
                onPress={onCopyPrompt}
              >
                <View style={[imStyles.iconCircle, { backgroundColor: isDark ? '#1e293b' : '#ede9fe' }]}>
                  <Feather name="copy" size={20} color={colors.primary} />
                </View>
                <View style={imStyles.optionInfo}>
                  <Text style={[imStyles.optionTitle, { color: colors.text }]}>1. Copy Gemini Prompt</Text>
                  <Text style={[imStyles.optionDesc, { color: colors.textSecondary }]}>
                    Copy the custom system instructions to feed into Gemini AI for extraction.
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              {/* Option 3: Paste JSON */}
              <TouchableOpacity 
                style={[imStyles.optionCard, { backgroundColor: isDark ? colors.bg : '#f8fafc', borderColor: colors.border }]}
                onPress={() => setIsPasting(true)}
              >
                <View style={[imStyles.iconCircle, { backgroundColor: isDark ? '#1e293b' : '#ede9fe' }]}>
                  <Feather name="clipboard" size={20} color={colors.primary} />
                </View>
                <View style={imStyles.optionInfo}>
                  <Text style={[imStyles.optionTitle, { color: colors.text }]}>2. Paste Timetable JSON</Text>
                  <Text style={[imStyles.optionDesc, { color: colors.textSecondary }]}>
                    Paste the JSON structure returned by Gemini to setup your schedule.
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={imStyles.content}>
              <View style={imStyles.backRow}>
                <TouchableOpacity onPress={() => setIsPasting(false)} style={imStyles.backBtn}>
                  <Feather name="arrow-left" size={16} color={colors.primary} />
                  <Text style={[imStyles.backTxt, { color: colors.primary }]}>Back to options</Text>
                </TouchableOpacity>
              </View>

              <Text style={[imStyles.subtitle, { color: colors.textSecondary }]}>
                Paste the JSON array extracted by Gemini below:
              </Text>

              <TextInput
                multiline
                style={[imStyles.textArea, { 
                  backgroundColor: isDark ? colors.bg : '#f8fafc', 
                  borderColor: colors.border,
                  color: colors.text 
                }]}
                placeholder='[{"dayOfWeek": "Monday", "subject": "Math", ...}]'
                placeholderTextColor={colors.textMuted}
                value={jsonText}
                onChangeText={setJsonText}
                autoCorrect={false}
                autoCapitalize="none"
              />

              <TouchableOpacity 
                style={[imStyles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={handlePasteSubmit}
              >
                <Feather name="check" size={18} color="#fff" />
                <Text style={imStyles.submitBtnTxt}>Import & Set Reminders</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
}

const imStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionInfo: {
    flex: 1,
    marginRight: 8,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  backRow: {
    marginBottom: 14,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  backTxt: {
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
  },
  textArea: {
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnTxt: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
});
