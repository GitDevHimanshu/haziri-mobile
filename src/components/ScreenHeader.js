import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Modal, 
  TextInput, KeyboardAvoidingView, Platform, Pressable, 
  ActivityIndicator, Alert, StatusBar
} from 'react-native';
import { getTeacherId, saveTeacherId } from '../api/client';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { Feather } from '@expo/vector-icons';

export default function ScreenHeader({ title, subtext }) {
  const { isDark, toggleTheme, colors } = useTheme();
  const [teacherId, setTeacherId] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [newId, setNewId] = useState('');
  const [saving, setSaving] = useState(false);

  const refreshId = useCallback(() => {
    getTeacherId().then(id => {
      const displayId = (id && id !== 'default') ? id.toUpperCase() : 'SET ID';
      setTeacherId(displayId);
      setNewId(id === 'default' ? '' : id);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshId();
    }, [refreshId])
  );

  const handleSave = async () => {
    const trimmed = newId.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('Error', 'Teacher ID cannot be empty');
      return;
    }
    setSaving(true);
    try {
      await saveTeacherId(trimmed);
      setTeacherId(trimmed.toUpperCase());
      setModalVisible(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to save ID');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[h.headerContainer, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.bg} />
      <View style={h.appHeader}>
        <View style={h.leftSide}>
          <Text style={[h.appName, { color: isDark ? colors.text : colors.primary }]}>{title || 'Haziri'}</Text>
          {subtext && <Text style={[h.appSub, { color: colors.textSecondary }]}>{subtext}</Text>}
        </View>
        
        <View style={h.rightWrap}>
          <TouchableOpacity 
            style={[h.themeToggle, { backgroundColor: colors.card, borderColor: colors.border }]} 
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Feather name={isDark ? 'sun' : 'moon'} size={18} color={isDark ? '#fbbf24' : colors.accent} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[h.teacherBadge, { backgroundColor: colors.card, borderColor: colors.border }]} 
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={[h.teacherBadgeTxt, { color: isDark ? colors.text : colors.primary }]}>{teacherId}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Edit Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable 
          style={h.modalOverlay} 
          onPress={() => !saving && setModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={h.modalCentered}
          >
            <Pressable style={[h.modalContent, { backgroundColor: colors.card }]} onPress={e => e.stopPropagation()}>
              <View style={h.modalHeader}>
                <Text style={[h.modalTitle, { color: colors.text }]}>Update Identifier</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={[h.closeTxt, { color: colors.textMuted }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={[h.modalSub, { color: colors.textSecondary }]}>
                Change your Teacher ID to sync attendance data across your browser and mobile device.
              </Text>

              <View style={[h.inputBox, { backgroundColor: isDark ? colors.bg : '#f5f3ff', borderColor: colors.border }]}>
                <Text style={[h.inputLabel, { color: colors.primary }]}>TEACHER ID</Text>
                <TextInput
                  style={[h.input, { color: colors.text }]}
                  value={newId}
                  onChangeText={setNewId}
                  placeholder="e.g. ET018"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                />
              </View>

              <TouchableOpacity 
                style={[h.saveBtn, { backgroundColor: colors.primary }, saving && h.saveBtnDisabled]} 
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={h.saveBtnTxt}>Update Identity</Text>
                )}
              </TouchableOpacity>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const h = StyleSheet.create({
  headerContainer: {
    paddingTop: Platform.OS === 'android' ? 0 : 0,
  },
  appHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20, 
    paddingTop: 18, 
    paddingBottom: 10,
  },
  appName: { fontSize: 24, fontWeight: '900', letterSpacing: -1.2 },
  appSub: { fontSize: 11, fontWeight: '700', marginTop: -2, opacity: 0.8 },
  subRow: { flexDirection: 'row', alignItems: 'center' },
  leftSide: { flex: 1 },
  rightWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  
  themeToggle: {
    width: 38, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },

  teacherBadge: { 
    height: 36,
    borderWidth: 1.5, 
    borderRadius: 12, 
    paddingHorizontal: 12, 
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  teacherBadgeTxt: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCentered: {
    justifyContent: 'center',
  },
  modalContent: {
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  modalSub: { fontSize: 13, lineHeight: 20, marginBottom: 24 },
  closeTxt: { fontSize: 20, fontWeight: '600' },

  inputBox: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  inputLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  input: {
    fontSize: 18,
    fontWeight: '800',
    padding: 0,
  },

  saveBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
