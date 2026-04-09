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
  bg: '#ede9fe',
  bgSecondary: '#f5f3ff',
  card: '#f5f3ff',
  text: '#1e1b4b',
  textSecondary: '#6d6a9c',
  textMuted: '#9490c0',
  primary: '#4f46e5',
  accent: '#4f46e5',
  present: '#16a34a',
  absent: '#dc2626',
  border: 'rgba(109,40,217,0.08)',
  shadow: '#4c1d95',
  glass: 'rgba(255,255,255,0.8)',
  statusBar: 'dark-content',
  navBg: '#f5f3ff',
};

const darkColors = {
  bg: '#0f172a',
  bgSecondary: '#1e293b',
  card: '#1e293b',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  primary: '#3730a3', // Dark deeper indigo (Keep bars dark)
  accent: '#4f46e5',  // Middle-ground indigo (Keep labels readable)
  present: '#059669',
  absent: '#991b1b',
  border: 'rgba(255,255,255,0.06)',
  shadow: '#000000',
  glass: 'rgba(15,23,42,0.8)',
  statusBar: 'light-content',
  navBg: '#1e293b',
};
