/**
 * 添加白名单
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, HelperText, Menu } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { whitelistApiClient } from '../../../services/api/whitelistApiClient';
import { HR_THEME, type WhitelistStatus, ROLE_OPTIONS } from '../../../types/hrNavigation';

export default function WhitelistAddScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [presetRole, setPresetRole] = useState('');
  const [presetRoleName, setPresetRoleName] = useState('');
  const [notes, setNotes] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phone) {
      setPhoneError('请输入手机号');
      return false;
    }
    if (!phoneRegex.test(phone)) {
      setPhoneError('请输入有效的11位手机号');
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validatePhone(phoneNumber)) return;

    if (!presetRole) {
      Alert.alert('提示', '请选择预设角色');
      return;
    }

    setLoading(true);
    try {
      const res = await whitelistApiClient.addWhitelist({
        phoneNumber,
        presetRole,
        presetRoleName,
        notes,
        status: 'pending' as WhitelistStatus,
      });

      if (res.success) {
        Alert.alert('成功', '白名单添加成功', [
          { text: '确定', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('失败', res.message || '添加失败');
      }
    } catch (error) {
      console.error('添加白名单失败:', error);
      Alert.alert('错误', '添加失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const selectRole = (role: { value: string; label: string }) => {
    setPresetRole(role.value);
    setPresetRoleName(role.label);
    setMenuVisible(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={HR_THEME.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>添加白名单</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>手机号 *</Text>
              <TextInput
                mode="outlined"
                value={phoneNumber}
                onChangeText={(text) => {
                  setPhoneNumber(text);
                  if (phoneError) validatePhone(text);
                }}
                placeholder="请输入11位手机号"
                keyboardType="phone-pad"
                maxLength={11}
                style={styles.input}
                outlineColor={HR_THEME.border}
                activeOutlineColor={HR_THEME.primary}
                error={!!phoneError}
              />
              {phoneError ? (
                <HelperText type="error" visible={!!phoneError}>
                  {phoneError}
                </HelperText>
              ) : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>预设角色 *</Text>
              <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => setMenuVisible(true)}
                  >
                    <Text style={presetRoleName ? styles.selectText : styles.selectPlaceholder}>
                      {presetRoleName || '请选择角色'}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={24} color={HR_THEME.textSecondary} />
                  </TouchableOpacity>
                }
              >
                {ROLE_OPTIONS.map((role) => (
                  <Menu.Item
                    key={role.value}
                    onPress={() => selectRole(role)}
                    title={role.label}
                    leadingIcon={presetRole === role.value ? 'check' : undefined}
                  />
                ))}
              </Menu>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>备注</Text>
              <TextInput
                mode="outlined"
                value={notes}
                onChangeText={setNotes}
                placeholder="可选填写备注信息"
                multiline
                numberOfLines={3}
                style={[styles.input, styles.textArea]}
                outlineColor={HR_THEME.border}
                activeOutlineColor={HR_THEME.primary}
              />
            </View>

            <View style={styles.tips}>
              <MaterialCommunityIcons name="information-outline" size={18} color={HR_THEME.info} />
              <Text style={styles.tipsText}>
                添加到白名单后，该手机号用户可以注册并获得预设角色权限
              </Text>
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
            取消
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={styles.submitButton}
            buttonColor={HR_THEME.primary}
          >
            添加
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
  tips: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: HR_THEME.info + '10', padding: 12, borderRadius: 8, marginTop: 8,
  },
  tipsText: { flex: 1, fontSize: 13, color: HR_THEME.textSecondary, marginLeft: 8, lineHeight: 18 },
  footer: {
    flexDirection: 'row', padding: 16,
    backgroundColor: HR_THEME.cardBackground, borderTopWidth: 1, borderTopColor: HR_THEME.border,
  },
  cancelButton: { flex: 1, marginRight: 12, borderColor: HR_THEME.border },
  submitButton: { flex: 1 },
});
