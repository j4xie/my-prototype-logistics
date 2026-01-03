/**
 * 添加部门
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useEffect } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text, TextInput, Button, Menu, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { departmentApiClient } from '../../../services/api/departmentApiClient';
import { userApiClient } from '../../../services/api/userApiClient';
import { HR_THEME } from '../../../types/hrNavigation';

interface Manager {
  id: number;
  fullName: string;
  username: string;
}

export default function DepartmentAddScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('hr');
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState<number | null>(null);
  const [managerName, setManagerName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [managers, setManagers] = useState<Manager[]>([]);

  useEffect(() => {
    loadManagers();
  }, []);

  const loadManagers = async () => {
    try {
      // getUsers returns PageResponse<UserDTO> directly (with content array)
      const res = await userApiClient.getUsers({ page: 0, size: 100 });
      if (res?.content) {
        const users = res.content.map(u => ({
          id: u.id || 0,
          fullName: u.fullName || u.realName || u.username || '',
          username: u.username || '',
        }));
        setManagers(users);
      }
    } catch (error) {
      console.error('加载管理人员失败:', error);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert(t('messages.hint'), t('department.add.validation.nameRequired'));
      return;
    }

    setLoading(true);
    try {
      const res = await departmentApiClient.createDepartment({
        name: name.trim(),
        description: description.trim(),
        managerUserId: managerId ?? undefined,
        isActive,
      });

      if (res.success) {
        Alert.alert(t('messages.success'), t('department.add.successMessage'), [
          { text: t('common.confirm'), onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert(t('messages.failed'), res.message || t('department.add.createFailed'));
      }
    } catch (error) {
      console.error('创建部门失败:', error);
      Alert.alert(t('messages.error'), t('department.add.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  const selectManager = (manager: Manager) => {
    setManagerId(manager.id);
    setManagerName(manager.fullName || manager.username);
    setMenuVisible(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={HR_THEME.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('department.add.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('department.add.fields.name')}</Text>
              <TextInput
                mode="outlined"
                value={name}
                onChangeText={setName}
                placeholder={t('department.add.placeholders.name')}
                style={styles.input}
                outlineColor={HR_THEME.border}
                activeOutlineColor={HR_THEME.primary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('department.add.fields.description')}</Text>
              <TextInput
                mode="outlined"
                value={description}
                onChangeText={setDescription}
                placeholder={t('department.add.placeholders.description')}
                multiline
                numberOfLines={3}
                style={[styles.input, styles.textArea]}
                outlineColor={HR_THEME.border}
                activeOutlineColor={HR_THEME.primary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('department.add.fields.manager')}</Text>
              <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => setMenuVisible(true)}
                  >
                    <Text style={managerName ? styles.selectText : styles.selectPlaceholder}>
                      {managerName || t('department.add.placeholders.manager')}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={24} color={HR_THEME.textSecondary} />
                  </TouchableOpacity>
                }
              >
                <Menu.Item
                  onPress={() => {
                    setManagerId(null);
                    setManagerName('');
                    setMenuVisible(false);
                  }}
                  title={t('department.add.noManager')}
                />
                {managers.map((m) => (
                  <Menu.Item
                    key={m.id}
                    onPress={() => selectManager(m)}
                    title={m.fullName || m.username}
                    leadingIcon={managerId === m.id ? 'check' : undefined}
                  />
                ))}
              </Menu>
            </View>

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.label}>{t('department.add.fields.status')}</Text>
                <Text style={styles.switchHint}>{t('department.add.statusHint')}</Text>
              </View>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                color={HR_THEME.primary}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.cancelButton}
            textColor={HR_THEME.textSecondary}
          >
            {t('common.cancel')}
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={styles.submitButton}
            buttonColor={HR_THEME.primary}
          >
            {t('department.add.submit')}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HR_THEME.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: HR_THEME.cardBackground, borderBottomWidth: 1, borderBottomColor: HR_THEME.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: HR_THEME.textPrimary },
  content: { flex: 1 },
  form: { padding: 16 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', color: HR_THEME.textPrimary, marginBottom: 8 },
  input: { backgroundColor: HR_THEME.cardBackground },
  textArea: { minHeight: 100 },
  selectButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: HR_THEME.cardBackground, borderWidth: 1, borderColor: HR_THEME.border,
    borderRadius: 4, paddingHorizontal: 14, paddingVertical: 16,
  },
  selectText: { fontSize: 16, color: HR_THEME.textPrimary },
  selectPlaceholder: { fontSize: 16, color: HR_THEME.textMuted },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: HR_THEME.cardBackground, padding: 16, borderRadius: 8,
  },
  switchHint: { fontSize: 12, color: HR_THEME.textSecondary, marginTop: 2 },
  footer: {
    flexDirection: 'row', padding: 16,
    backgroundColor: HR_THEME.cardBackground, borderTopWidth: 1, borderTopColor: HR_THEME.border,
  },
  cancelButton: { flex: 1, marginRight: 12, borderColor: HR_THEME.border },
  submitButton: { flex: 1 },
});
