import React from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// ─── Tab button ───────────────────────────────────────────────────
function TabBtn({ icon, active, onPress }) {
  const { colors, isDark } = useTheme();
  const isAdd = icon === 'plus';
  return (
    <TouchableOpacity style={s.tab} onPress={onPress} activeOpacity={0.7}>
      <View style={[
        isAdd && s.addIconWrap, 
        isAdd && { backgroundColor: isDark ? colors.bg : 'rgba(79,70,229,0.08)', borderColor: colors.border },
        isAdd && active && { backgroundColor: isDark ? colors.primary : 'rgba(79,70,229,0.15)' }
      ]}>
        <Feather
          name={icon}
          size={isAdd ? 22 : 21}
          color={active ? colors.primary : (isAdd ? colors.primary : colors.textMuted)}
        />
      </View>
      {active && !isAdd && <View style={[s.activeDot, { backgroundColor: colors.primary }]} />}
    </TouchableOpacity>
  );
}

// ─── Floating Tab Bar ─────────────────────────────────────────────
export default function FloatingTabBar({ state, navigation, descriptors }) {
  const { colors, isDark } = useTheme();
  const activeRouteKey = state.routes[state.index].key;
  const { options } = descriptors[activeRouteKey];

  // Respect tabBarStyle: { display: 'none' }
  if (options.tabBarStyle?.display === 'none') {
    return null;
  }

  const activeRoute = state.routes[state.index].name;

  const onTab = (name) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: state.routes.find(r => r.name === name)?.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigation.navigate(name);
    }
  };

  return (
    <View style={s.container} pointerEvents="box-none">
      <View style={[s.bar, { backgroundColor: colors.navBg, borderColor: colors.border }]}>
        <TabBtn icon="home"     active={activeRoute === 'HomeTab'}     onPress={() => onTab('HomeTab')} />
        <TabBtn icon="search"   active={activeRoute === 'SearchTab'}   onPress={() => onTab('SearchTab')} />
        <TabBtn icon="plus"     active={activeRoute === 'AddTab'}      onPress={() => onTab('AddTab')} />
        <TabBtn icon="calendar" active={activeRoute === 'ScheduleTab'} onPress={() => onTab('ScheduleTab')} />
        <TabBtn icon="settings" active={activeRoute === 'SettingsTab'} onPress={() => onTab('SettingsTab')} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 100,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: '100%',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  addIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
