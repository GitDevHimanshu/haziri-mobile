import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === 'dark');

  useEffect(() => {
    // Load saved preference
    AsyncStorage.getItem('themeMode').then(val => {
      if (val) setIsDark(val === 'dark');
    });
  }, []);

  const toggleTheme = async () => {
    const newVal = !isDark;
    setIsDark(newVal);
    await AsyncStorage.setItem('themeMode', newVal ? 'dark' : 'light');
  };

  const theme = {
    isDark,
    toggleTheme,
    colors: isDark ? darkColors : lightColors
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

const lightColors = {
  bg: '#f8fafc',
  bgSecondary: '#f1f5f9',
  card: '#ffffff',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  primary: '#4f46e5',
  accent: '#4f46e5',
  present: '#10b981',
  absent: '#ef4444',
  border: 'rgba(15,23,42,0.06)',
  shadow: '#0f172a',
  glass: 'rgba(255,255,255,0.8)',
  statusBar: 'dark-content',
  navBg: '#ffffff',
};

const darkColors = {
  bg: '#080d1a',
  bgSecondary: '#0f172a',
  card: '#131b2e',
  text: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  primary: '#6366f1',
  accent: '#6366f1',
  present: '#10b981',
  absent: '#ef4444',
  border: 'rgba(255,255,255,0.06)',
  shadow: '#000000',
  glass: 'rgba(8,13,26,0.8)',
  statusBar: 'light-content',
  navBg: '#131b2e',
};
