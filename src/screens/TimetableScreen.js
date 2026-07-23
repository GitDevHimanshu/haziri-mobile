import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, Alert, Modal, TextInput, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTimetable, saveTimetable } from '../api/client';
import { Feather } from '@expo/vector-icons';
import { TimetableScreenSkeleton } from '../components/SkeletonLoader';
import ScreenHeader from '../components/ScreenHeader';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { scheduleTimetableNotifications } from '../utils/notifications';

const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const JS_DAYS   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const parseTimeToLocalIso = (timeStr) => {
  if (!timeStr || !timeStr.trim()) {
    const now = new Date();
    return now.toISOString();
  }
  let str = timeStr.trim();
  let hours = 0;
  let minutes = 0;

  const match12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match12) {
    hours = parseInt(match12[1], 10);
    minutes = parseInt(match12[2], 10);
    const ampm = match12[3] ? match12[3].toUpperCase() : null;
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
  } else {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      hours = d.getHours();
      minutes = d.getMinutes();
    }
  }

  const now = new Date();
  const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  return localDate.toISOString();
};

export default function TimetableScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classModalVisible, setClassModalVisible] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);

  const scrollRef = useRef(null);
  const dayOffsets = useRef({}); // { Monday: yOffset, Tuesday: yOffset, … }
  const hasScrolled = useRef(false);

  const todayName = JS_DAYS[new Date().getDay()]; // e.g. "Tuesday"
  const todayLabel = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  const handleClearTimetable = () => {
    Alert.alert(
      'Clear Timetable',
      'Are you sure you want to clear your current timetable? This will also cancel all scheduled notifications for these classes.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive', 
          onPress: async () => {
            setLoading(true);
            try {
              await saveTimetable([]);
              await scheduleTimetableNotifications([], true);
              setTimetable([]);
            } catch (err) {
              Alert.alert('Error', 'Failed to clear timetable.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleSaveClass = async (newClass, targetClass) => {
    try {
      let updatedList = [...timetable];
      if (targetClass) {
        const idx = updatedList.findIndex(
          c => c.dayOfWeek === targetClass.dayOfWeek && 
               c.startTime === targetClass.startTime && 
               c.subject === targetClass.subject
        );
        if (idx !== -1) {
          updatedList[idx] = newClass;
        } else {
          updatedList.push(newClass);
        }
      } else {
        updatedList.push(newClass);
      }

      setTimetable(updatedList);
      await saveTimetable(updatedList);
      const count = await scheduleTimetableNotifications(updatedList, true);
      setClassModalVisible(false);
      setSelectedClass(null);
      Alert.alert('Success', targetClass ? 'Class updated successfully!' : `Class added! Scheduled ${count} weekly notifications.`);
    } catch (err) {
      Alert.alert('Error', 'Failed to save class: ' + err.message);
    }
  };

  const handleDeleteClass = async (targetClass) => {
    Alert.alert(
      'Delete Class',
      `Remove "${targetClass.subject}" from ${targetClass.dayOfWeek}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedList = timetable.filter(
                c => !(c.dayOfWeek === targetClass.dayOfWeek && c.startTime === targetClass.startTime && c.subject === targetClass.subject)
              );
              setTimetable(updatedList);
              await saveTimetable(updatedList);
              await scheduleTimetableNotifications(updatedList, true);
              setClassModalVisible(false);
              setSelectedClass(null);
            } catch (err) {
              Alert.alert('Error', 'Failed to delete class.');
            }
          }
        }
      ]
    );
  };

  const headerActions = (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <TouchableOpacity 
        style={[s.headerAction, { backgroundColor: colors.card, borderColor: colors.border }]} 
        onPress={() => {
          setSelectedClass(null);
          setClassModalVisible(true);
        }}
        activeOpacity={0.7}
      >
        <Feather name="plus" size={18} color={colors.primary} />
      </TouchableOpacity>

      {timetable.length > 0 && (
        <TouchableOpacity 
          style={[s.headerAction, { backgroundColor: colors.card, borderColor: colors.border }]} 
          onPress={handleClearTimetable}
          activeOpacity={0.7}
        >
          <Feather name="trash-2" size={18} color="#ef4444" />
        </TouchableOpacity>
      )}
    </View>
  );

  useFocusEffect(
    useCallback(() => {
      hasScrolled.current = false; // Reset to allow auto-scroll when re-entering
      getTimetable().then(data => {
        setTimetable(data || []);
        setLoading(false);
      });
    }, [])
  );

  const onDayLayout = useCallback((day, event) => {
    const { y } = event.nativeEvent.layout;
    dayOffsets.current[day] = y;

    if (day === todayName && !hasScrolled.current && scrollRef.current && !loading) {
      setTimeout(() => {
        if (!hasScrolled.current) {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - 10), animated: true });
          hasScrolled.current = true;
        }
      }, 300);
    }
  }, [todayName, loading]);

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
        <StatusBar barStyle={colors.statusBar} backgroundColor={colors.bg} />
        <ScreenHeader title="Schedule" subtext={todayLabel} />
        <TimetableScreenSkeleton />
      </SafeAreaView>
    );
  }

  const grouped = {};
  DAYS_FULL.forEach(day => grouped[day] = []);
  timetable.forEach(entry => {
    if (grouped[entry.dayOfWeek]) grouped[entry.dayOfWeek].push(entry);
  });

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.bg} />
      <ScreenHeader title="Schedule" subtext={todayLabel} rightElement={headerActions} />

      <ScrollView 
        ref={scrollRef}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {DAYS_FULL.map((day) => {
          const dayClasses = (grouped[day] || []).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
          if (dayClasses.length === 0) return null;

          const isToday = day === todayName;

          return (
            <View key={day} onLayout={(e) => onDayLayout(day, e)} style={s.dayGroup}>
              {/* Day Header */}
              <View style={s.dayHeaderRow}>
                <Text style={[s.dayLabel, { color: isToday ? colors.accent : colors.text }]}>
                  {day.toUpperCase()} {isToday ? '• TODAY' : ''}
                </Text>
              </View>

              {/* Class Cards */}
              {dayClasses.map((cls, idx) => {
                const startTime = new Date(cls.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                const endTime   = new Date(cls.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                const batchStr = (cls.batch + (cls.group ? ' ' + cls.group : '')).trim();

                return (
                  <TouchableOpacity 
                    key={idx} 
                    style={[s.classCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => {
                      setSelectedClass(cls);
                      setClassModalVisible(true);
                    }}
                    onLongPress={() => handleDeleteClass(cls)}
                    activeOpacity={0.8}
                  >
                    <View style={s.timeColumn}>
                      <Text style={[s.startTime, { color: colors.text }]}>{startTime}</Text>
                      <View style={[s.timeDot, { backgroundColor: colors.primary }]} />
                      <Text style={[s.endTime, { color: colors.textMuted }]}>{endTime}</Text>
                    </View>

                    <View style={s.infoColumn}>
                      <Text style={[s.subject, { color: colors.text }]}>{cls.subject}</Text>
                      
                      <View style={s.metaRow}>
                        <View style={[s.metaItem, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]}>
                          <Feather name="users" size={12} color={colors.textMuted} />
                          <Text style={[s.metaTxt, { color: colors.textSecondary }]}>{batchStr || 'No Batch'}</Text>
                        </View>
                        <View style={[s.metaItem, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]}>
                          <Feather name="map-pin" size={11} color={colors.accent} />
                          <Text style={[s.metaTxt, { color: colors.accent, fontWeight: '800' }]}>{cls.roomCode || '—'}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
        {timetable.length === 0 && (
           <View style={s.emptyWrap}>
             <Text style={s.emptyIco}>📅</Text>
             <Text style={[s.emptyTitle, { color: colors.text }]}>No Schedule Found</Text>
             <Text style={[s.emptySub, { color: colors.textSecondary }]}>Upload your timetable PDF or tap the "+" button to add your weekly classes manually.</Text>
             <TouchableOpacity
               style={[s.addFirstBtn, { backgroundColor: colors.primary }]}
               onPress={() => {
                 setSelectedClass(null);
                 setClassModalVisible(true);
               }}
             >
               <Feather name="plus" size={16} color="#fff" />
               <Text style={s.addFirstBtnTxt}>Add Class Manually</Text>
             </TouchableOpacity>
           </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <ClassModal
        visible={classModalVisible}
        classData={selectedClass}
        onClose={() => {
          setClassModalVisible(false);
          setSelectedClass(null);
        }}
        onSave={handleSaveClass}
        onDelete={handleDeleteClass}
      />
    </SafeAreaView>
  );
}

function ClassModal({ visible, classData, onClose, onSave, onDelete }) {
  const { colors, isDark } = useTheme();
  const [dayOfWeek, setDayOfWeek] = useState('Monday');
  const [subject, setSubject] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [batch, setBatch] = useState('');
  const [group, setGroup] = useState('');
  const [startTimeStr, setStartTimeStr] = useState('');
  const [endTimeStr, setEndTimeStr] = useState('');

  const isEditing = !!classData;

  useEffect(() => {
    if (visible) {
      if (classData) {
        setDayOfWeek(classData.dayOfWeek || 'Monday');
        setSubject(classData.subject || '');
        setRoomCode(classData.roomCode || '');
        setBatch(classData.batch || '');
        setGroup(classData.group || '');

        const sTime = classData.startTime 
          ? new Date(classData.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          : '';
        const eTime = classData.endTime 
          ? new Date(classData.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          : '';
        
        setStartTimeStr(sTime);
        setEndTimeStr(eTime);
      } else {
        setDayOfWeek('Monday');
        setSubject('');
        setRoomCode('');
        setBatch('');
        setGroup('');
        setStartTimeStr('09:00 AM');
        setEndTimeStr('09:50 AM');
      }
    }
  }, [visible, classData]);

  const handleSave = () => {
    if (!subject.trim()) {
      Alert.alert('Validation Error', 'Please enter a subject name.');
      return;
    }
    if (!startTimeStr.trim() || !endTimeStr.trim()) {
      Alert.alert('Validation Error', 'Please specify both start and end times.');
      return;
    }

    const startIso = parseTimeToLocalIso(startTimeStr);
    const endIso = parseTimeToLocalIso(endTimeStr);

    const sFmt = new Date(startIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const eFmt = new Date(endIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const timeRange = `${sFmt} - ${eFmt}`;

    const newClass = {
      dayOfWeek,
      subject: subject.trim(),
      roomCode: roomCode.trim().toUpperCase(),
      batch: batch.trim(),
      group: group.trim() || null,
      startTime: startIso,
      endTime: endIso,
      timeRange
    };

    onSave(newClass, classData);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={cmStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[cmStyles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={cmStyles.header}>
            <Text style={[cmStyles.title, { color: colors.text }]}>
              {isEditing ? 'Edit Class' : 'Add New Class'}
            </Text>
            <TouchableOpacity onPress={onClose} style={[cmStyles.closeBtn, { backgroundColor: isDark ? colors.bg : '#f1f5f9' }]}>
              <Feather name="x" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            {/* Day Selector */}
            <Text style={[cmStyles.fieldLabel, { color: colors.textSecondary }]}>DAY OF WEEK</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={cmStyles.daysScroll}>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Sunday'].map(d => {
                const active = dayOfWeek === d;
                return (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setDayOfWeek(d)}
                    style={[
                      cmStyles.dayChip,
                      { backgroundColor: isDark ? colors.bg : '#f8fafc', borderColor: colors.border },
                      active && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                  >
                    <Text style={[cmStyles.dayChipTxt, { color: colors.textSecondary }, active && { color: '#fff' }]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Subject */}
            <Text style={[cmStyles.fieldLabel, { color: colors.textSecondary }]}>SUBJECT NAME *</Text>
            <TextInput
              style={[cmStyles.input, { backgroundColor: isDark ? colors.bg : '#f8fafc', borderColor: colors.border, color: colors.text }]}
              placeholder="e.g. Mathematics"
              placeholderTextColor={colors.textMuted}
              value={subject}
              onChangeText={setSubject}
            />

            {/* Room & Batch Row */}
            <View style={cmStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[cmStyles.fieldLabel, { color: colors.textSecondary }]}>ROOM CODE</Text>
                <TextInput
                  style={[cmStyles.input, { backgroundColor: isDark ? colors.bg : '#f8fafc', borderColor: colors.border, color: colors.text }]}
                  placeholder="e.g. CVR410R"
                  placeholderTextColor={colors.textMuted}
                  value={roomCode}
                  onChangeText={setRoomCode}
                  autoCapitalize="characters"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[cmStyles.fieldLabel, { color: colors.textSecondary }]}>BATCH</Text>
                <TextInput
                  style={[cmStyles.input, { backgroundColor: isDark ? colors.bg : '#f8fafc', borderColor: colors.border, color: colors.text }]}
                  placeholder="e.g. BCA-5A"
                  placeholderTextColor={colors.textMuted}
                  value={batch}
                  onChangeText={setBatch}
                />
              </View>
            </View>

            {/* Time Row */}
            <View style={cmStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[cmStyles.fieldLabel, { color: colors.textSecondary }]}>START TIME *</Text>
                <TextInput
                  style={[cmStyles.input, { backgroundColor: isDark ? colors.bg : '#f8fafc', borderColor: colors.border, color: colors.text }]}
                  placeholder="e.g. 09:00 AM"
                  placeholderTextColor={colors.textMuted}
                  value={startTimeStr}
                  onChangeText={setStartTimeStr}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[cmStyles.fieldLabel, { color: colors.textSecondary }]}>END TIME *</Text>
                <TextInput
                  style={[cmStyles.input, { backgroundColor: isDark ? colors.bg : '#f8fafc', borderColor: colors.border, color: colors.text }]}
                  placeholder="e.g. 09:50 AM"
                  placeholderTextColor={colors.textMuted}
                  value={endTimeStr}
                  onChangeText={setEndTimeStr}
                />
              </View>
            </View>

            {/* Group */}
            <Text style={[cmStyles.fieldLabel, { color: colors.textSecondary }]}>GROUP (OPTIONAL)</Text>
            <TextInput
              style={[cmStyles.input, { backgroundColor: isDark ? colors.bg : '#f8fafc', borderColor: colors.border, color: colors.text }]}
              placeholder="e.g. Group 1"
              placeholderTextColor={colors.textMuted}
              value={group}
              onChangeText={setGroup}
            />
          </ScrollView>

          {/* Action Buttons */}
          <View style={cmStyles.actionsRow}>
            {isEditing && (
              <TouchableOpacity
                style={[cmStyles.deleteBtn, { borderColor: '#ef4444' }]}
                onPress={() => onDelete(classData)}
              >
                <Feather name="trash-2" size={16} color="#ef4444" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[cmStyles.saveBtn, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={handleSave}
            >
              <Feather name="check" size={18} color="#fff" />
              <Text style={cmStyles.saveBtnTxt}>{isEditing ? 'Update Class' : 'Save Class'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  headerAction: {
    width: 38,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  content: { paddingHorizontal: 20, paddingTop: 10 },
  dayGroup: { marginBottom: 32 },
  dayHeaderRow: { marginBottom: 16, flexDirection: 'row', alignItems: 'center' },
  dayLabel: { fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },

  classCard: {
    flexDirection: 'row',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2,
  },
  timeColumn: {
    width: 65,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.05)',
    marginRight: 16,
    paddingRight: 8,
  },
  startTime: { fontSize: 13, fontWeight: '800' },
  timeDot: { width: 4, height: 4, borderRadius: 2, marginVertical: 6 },
  endTime: { fontSize: 11, fontWeight: '600' },

  infoColumn: { flex: 1, justifyContent: 'center' },
  subject: { fontSize: 15, fontWeight: '800', marginBottom: 10, lineHeight: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  metaTxt: { fontSize: 11, fontWeight: '700', marginLeft: 6 },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIco: { fontSize: 50, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '900', marginBottom: 8 },
  emptySub: { fontSize: 14, textAlign: 'center', color: '#6d6a9c', lineHeight: 22, marginBottom: 24 },
  addFirstBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16 },
  addFirstBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 14 },
});

const cmStyles = StyleSheet.create({
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
    marginBottom: 20,
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
  fieldLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 12,
  },
  daysScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  dayChipTxt: {
    fontSize: 12,
    fontWeight: '800',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  saveBtnTxt: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  deleteBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
