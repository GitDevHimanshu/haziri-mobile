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

const Stack = createNativeStackNavigator();

// ── Intro Screen ─────────────────────────────────────────────────
function IntroScreen({ onDone }) {
  const iconScale = useRef(new Animated.Value(0.7)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // Icon pops in
      Animated.parallel([
        Animated.spring(iconScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(iconOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      // Text fades in
      Animated.timing(textOpacity, { toValue: 1, duration: 300, delay: 100, useNativeDriver: true }),
      // Hold
      Animated.delay(900),
      // Fade everything out
      Animated.timing(fadeOut, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View style={[s.intro, { opacity: fadeOut }]}>
      {/* Glow circle */}
      <View style={s.glow} />
      {/* Icon */}
      <Animated.Image
        source={require('./assets/icon.png')}
        style={[s.introIcon, { opacity: iconOpacity, transform: [{ scale: iconScale }] }]}
        resizeMode="contain"
      />
      {/* Text */}
      <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
        <Text style={s.introName}>Haziri</Text>
        <Text style={s.introSub}>A T T E N D A N C E</Text>
      </Animated.View>
    </Animated.View>
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
        <IntroScreen onDone={() => setShowIntro(false)} />
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
      <SetupScreen onDone={() => setHasTeacher(true)} />
    </SafeAreaProvider>
  );

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Detail" component={DetailScreen}
            options={({ route }) => ({
              title: route.params?.session?.group || 'Session Detail',
              headerStyle: { backgroundColor: '#312e81' },
              headerTintColor: '#ffffff',
              headerTitleStyle: { fontWeight: '800', fontSize: 16 },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: '#ede9fe' },
            })}
          />
          <Stack.Screen name="Settings" component={SettingsScreen}
            options={{
              title: 'Settings',
              headerStyle: { backgroundColor: '#312e81' },
              headerTintColor: '#ffffff',
              headerTitleStyle: { fontWeight: '800', fontSize: 16 },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: '#ede9fe' },
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
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
