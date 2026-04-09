import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, Image, Animated, StyleSheet, ActivityIndicator } from 'react-native';

import { getTeacherId } from './src/api/client';
import SetupScreen from './src/screens/SetupScreen';
import HomeScreen from './src/screens/HomeScreen';
import DetailScreen from './src/screens/DetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TimetableScreen from './src/screens/TimetableScreen';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import FloatingTabBar from './src/components/FloatingTabBar';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ── Intro Screen ─────────────────────────────────────────────────
function IntroScreen({ onDone }) {
  const { colors, isDark } = useTheme();
  const iconScale = useRef(new Animated.Value(0.7)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(iconScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(iconOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 300, delay: 100, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(fadeOut, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View style={[s.intro, { opacity: fadeOut, backgroundColor: colors.bg }]}>
      <View style={[s.glow, { backgroundColor: colors.card, shadowColor: colors.primary }]} />
      <Animated.Image
        source={require('./assets/icon.png')}
        style={[s.introIcon, { opacity: iconOpacity, transform: [{ scale: iconScale }] }]}
        resizeMode="contain"
      />
      <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
        <Text style={[s.introName, { color: colors.text }]}>Haziri</Text>
        <Text style={[s.introSub, { color: colors.primary }]}>A T T E N D A N C E</Text>
      </Animated.View>
    </Animated.View>
  );
}

// ── Main Tab Navigator ───────────────────────────────────────────
function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="SearchTab" component={HomeScreen} listeners={({ navigation }) => ({
        tabPress: (e) => {
          e.preventDefault();
          navigation.navigate('HomeTab', { openSearch: true });
        },
      })} />
      <Tab.Screen name="AddTab" component={HomeScreen} listeners={({ navigation }) => ({
        tabPress: (e) => {
          e.preventDefault();
          navigation.navigate('HomeTab', { triggerAdd: true });
        },
      })} />
      <Tab.Screen name="ScheduleTab" component={TimetableScreen} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// ── App ───────────────────────────────────────────────────────────
export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [ready, setReady] = useState(false);
  const [hasTeacher, setHasTeacher] = useState(false);

  useEffect(() => {
    getTeacherId().then(id => {
      setHasTeacher(id !== 'default' && !!id);
      setReady(true);
    });
  }, []);

  if (showIntro) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <IntroScreen onDone={() => setShowIntro(false)} />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  if (!ready) return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#2563EB" />
    </View>
  );

  if (!hasTeacher) return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SetupScreen onDone={() => setHasTeacher(true)} />
      </ThemeProvider>
    </SafeAreaProvider>
  );

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen name="Detail" component={DetailScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Timetable" component={TimetableScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  intro: {
    flex: 1, backgroundColor: '#F8FAFC',
    alignItems: 'center', justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 340, height: 340, borderRadius: 170,
    backgroundColor: '#fff',
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.08, shadowRadius: 30, elevation: 5,
  },
  introIcon: {
    width: 140, height: 140,
    borderRadius: 36,
    marginBottom: 28,
  },
  introName: {
    fontSize: 42, fontWeight: '900', color: '#1e293b',
    letterSpacing: -1.5, marginBottom: 4,
  },
  introSub: {
    fontSize: 14, color: '#2563EB',
    letterSpacing: 4, fontWeight: '800',
  },
});
