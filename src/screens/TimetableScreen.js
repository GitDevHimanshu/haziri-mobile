import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTimetable } from '../api/client';
import { Feather } from '@expo/vector-icons';
import { TimetableScreenSkeleton } from '../components/SkeletonLoader';
import ScreenHeader from '../components/ScreenHeader';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const JS_DAYS   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TimetableScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const dayOffsets = useRef({}); // { Monday: yOffset, Tuesday: yOffset, … }
  const hasScrolled = useRef(false);

  const todayName = JS_DAYS[new Date().getDay()]; // e.g. "Tuesday"
  const todayLabel = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  useFocusEffect(
    useCallback(() => {
      hasScrolled.current = false; // Reset to allow auto-scroll when re-entering
      getTimetable().then(data => {
        setTimetable(data || []);
        setLoading(false);
      });
    }, [])
  );

  // Called when a day section finishes layout — store its Y offset
  const onDayLayout = useCallback((day, event) => {
    const { y } = event.nativeEvent.layout;
    dayOffsets.current[day] = y;

    // If this is Today's layout and we haven't scrolled yet, do a quick scroll
    if (day === todayName && !hasScrolled.current && scrollRef.current && !loading) {
      setTimeout(() => {
        if (!hasScrolled.current) {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - 10), animated: true });
          hasScrolled.current = true;
        }
      }, 300); // 300ms delay to allow siblings to settle
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

  // Group timetable entries by day
  const grouped = {};
  DAYS_FULL.forEach(day => grouped[day] = []);
  timetable.forEach(entry => {
    if (grouped[entry.dayOfWeek]) grouped[entry.dayOfWeek].push(entry);
  });

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.bg} />
      <ScreenHeader title="Schedule" subtext={todayLabel} />

      <ScrollView 
        ref={scrollRef}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {DAYS_FULL.map((day) => {
          const dayClasses = grouped[day];
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
                  <View key={idx} style={[s.classCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                          <Text style={[s.metaTxt, { color: colors.textSecondary }]}>{batchStr}</Text>
                        </View>
                        <View style={[s.metaItem, { backgroundColor: isDark ? colors.bg : '#f8fafc' }]}>
                          <Feather name="map-pin" size={11} color={colors.accent} />
                          <Text style={[s.metaTxt, { color: colors.accent, fontWeight: '800' }]}>{cls.roomCode || '—'}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}
        {timetable.length === 0 && (
           <View style={s.emptyWrap}>
             <Text style={s.emptyIco}>📅</Text>
             <Text style={[s.emptyTitle, { color: colors.text }]}>No Schedule Found</Text>
             <Text style={[s.emptySub, { color: colors.textSecondary }]}>Upload your timetable PDF on the Home screen to see your weekly classes here.</Text>
           </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
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
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
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

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 100, paddingHorizontal: 40 },
  emptyIco: { fontSize: 50, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '900', marginBottom: 8 },
  emptySub: { fontSize: 14, textAlign: 'center', color: '#6d6a9c', lineHeight: 22 },
});
