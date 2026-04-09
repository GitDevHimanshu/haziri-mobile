import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// ─── Base shimmer block ────────────────────────────────────────────
function ShimmerBlock({ style }) {
  const { colors, isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return <Animated.View style={[
    sk.block, 
    { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(79,70,229,0.06)' },
    style, 
    { opacity }
  ]} />;
}

// ─── HomeScreen session card skeleton ─────────────────────────────
export function SessionCardSkeleton() {
  const { colors, isDark } = useTheme();
  return (
    <View style={[sk.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={sk.row}>
        <ShimmerBlock style={sk.chipSq} />
        <View style={{ flex: 1, gap: 6, marginHorizontal: 10 }}>
          <ShimmerBlock style={{ height: 13, borderRadius: 6, width: '70%' }} />
          <ShimmerBlock style={{ height: 10, borderRadius: 6, width: '45%' }} />
        </View>
        <ShimmerBlock style={sk.chipSq} />
      </View>
      <ShimmerBlock style={sk.bar} />
      <View style={[sk.row, { marginTop: 10 }]}>
        <ShimmerBlock style={{ height: 10, width: 28, borderRadius: 5 }} />
        <ShimmerBlock style={{ height: 10, width: 40, borderRadius: 5, marginLeft: 6 }} />
        <ShimmerBlock style={{ height: 10, width: 28, borderRadius: 5, marginLeft: 14 }} />
        <ShimmerBlock style={{ height: 10, width: 44, borderRadius: 5, marginLeft: 6 }} />
      </View>
    </View>
  );
}

// ─── TimetableScreen class card skeleton ──────────────────────────
export function TimetableCardSkeleton() {
  const { colors, isDark } = useTheme();
  return (
    <View style={[sk.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[sk.row, sk.timeRowBorder, { borderBottomColor: colors.border }]}>
        <ShimmerBlock style={{ width: 14, height: 14, borderRadius: 7 }} />
        <ShimmerBlock style={{ height: 12, width: '55%', borderRadius: 6, marginLeft: 8 }} />
      </View>
      <View style={sk.row}>
        <View style={{ flex: 1, gap: 8 }}>
          <ShimmerBlock style={{ height: 14, borderRadius: 6, width: '80%' }} />
          <ShimmerBlock style={{ height: 11, borderRadius: 6, width: '50%' }} />
        </View>
        <ShimmerBlock style={sk.roomChip} />
      </View>
    </View>
  );
}

// ─── Day section skeleton (label + 2 cards) ───────────────────────
export function DaySectionSkeleton({ cards = 2 }) {
  return (
    <View style={{ marginBottom: 28 }}>
      <View style={[sk.row, { marginBottom: 12 }]}>
        <ShimmerBlock style={{ height: 14, width: 100, borderRadius: 8 }} />
      </View>
      {Array.from({ length: cards }).map((_, i) => (
        <TimetableCardSkeleton key={i} />
      ))}
    </View>
  );
}

// ─── Full HomeScreen skeleton (3 cards) ───────────────────────────
export function HomeScreenSkeleton() {
  return (
    <View style={{ padding: 16, paddingTop: 16 }}>
      {[0, 1, 2].map((_, i) => <SessionCardSkeleton key={i} />)}
    </View>
  );
}

// ─── Full TimetableScreen skeleton (3 day sections) ───────────────
export function TimetableScreenSkeleton() {
  return (
    <View style={{ padding: 16 }}>
      <DaySectionSkeleton cards={3} />
      <DaySectionSkeleton cards={2} />
      <DaySectionSkeleton cards={2} />
    </View>
  );
}

const sk = StyleSheet.create({
  block: {
    borderRadius: 8,
  },
  card: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipSq: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  bar: {
    height: 3,
    borderRadius: 2,
    marginVertical: 14,
  },
  timeRowBorder: {
    paddingBottom: 12,
    marginBottom: 14,
    borderBottomWidth: 1,
  },
  roomChip: {
    width: 72,
    height: 32,
    borderRadius: 10,
  },
});
