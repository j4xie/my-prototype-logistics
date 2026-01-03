/**
 * 个人信息
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text, TextInput, Button, Avatar, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '../../../store/authStore';
import { userApiClient } from '../../../services/api/userApiClient';
import { HR_THEME } from '../../../types/hrNavigation';

export default function MyInfoScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { t } = useTranslation('hr');

  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert(t('messages.tip'), t('profile.myInfo.form.nameRequired'));
      return;
    }

    setLoading(true);
    try {
      // updateUser returns UserDTO directly, not wrapped in ApiResponse
      const res = await userApiClient.updateUser(user?.id || 0, {
        realName: fullName.trim(), // API uses realName not fullName
        phone: phone.trim(),
        email: email.trim(),
      });

      if (res) {
        Alert.alert(t('messages.success'), t('profile.myInfo.alerts.updateSuccess'));
        setIsEditing(false);
      } else {
        Alert.alert(t('messages.error'), t('profile.myInfo.alerts.updateFailed'));
      }
    } catch (error) {
      console.error('更新用户信息失败:', error);
      Alert.alert(t('messages.error'), t('profile.myInfo.alerts.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFullName(user?.fullName || '');
    setPhone(user?.phone || '');
    setEmail(user?.email || '');
    setIsEditing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={HR_THEME.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.myInfo.title')}</Text>
        {!isEditing ? (
          <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editBtn}>
            <MaterialCommunityIcons name="pencil" size={22} color={HR_THEME.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 32 }} />
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* 头像 */}
          <View style={styles.avatarSection}>
            <Avatar.Text
              size={80}
              label={fullName?.substring(0, 1) || user?.username?.substring(0, 1) || 'U'}
              style={{ backgroundColor: HR_THEME.primary }}
            />
            <TouchableOpacity style={styles.changeAvatarBtn}>
              <Text style={styles.changeAvatarText}>{t('profile.myInfo.changeAvatar')}</Text>
            </TouchableOpacity>
          </View>

          {/* 基本信息 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.myInfo.basicInfo')}</Text>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('profile.myInfo.username')}</Text>
              <Text style={styles.infoValue}>{user?.username || '-'}</Text>
            </View>
            <Divider style={styles.divider} />

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('profile.myInfo.realName')}</Text>
              {isEditing ? (
                <TextInput
                  mode="outlined"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder={t('profile.myInfo.form.namePlaceholder')}
                  style={styles.input}
                  outlineColor={HR_THEME.border}
                  activeOutlineColor={HR_THEME.primary}
                  dense
                />
              ) : (
                <Text style={styles.infoValue}>{fullName || '-'}</Text>
              )}
            </View>
            <Divider style={styles.divider} />

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('profile.myInfo.phone')}</Text>
              {isEditing ? (
                <TextInput
                  mode="outlined"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder={t('profile.myInfo.form.phonePlaceholder')}
                  keyboardType="phone-pad"
                  style={styles.input}
                  outlineColor={HR_THEME.border}
                  activeOutlineColor={HR_THEME.primary}
                  dense
                />
              ) : (
                <Text style={styles.infoValue}>{phone || '-'}</Text>
              )}
            </View>
            <Divider style={styles.divider} />

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('profile.myInfo.email')}</Text>
              {isEditing ? (
                <TextInput
                  mode="outlined"
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('profile.myInfo.form.emailPlaceholder')}
                  keyboardType="email-address"
                  style={styles.input}
                  outlineColor={HR_THEME.border}
                  activeOutlineColor={HR_THEME.primary}
                  dense
                />
              ) : (
                <Text style={styles.infoValue}>{email || '-'}</Text>
              )}
            </View>
          </View>

          {/* 工作信息 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.myInfo.workInfo')}</Text>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('profile.myInfo.role')}</Text>
              <Text style={styles.infoValue}>{t('profile.role')}</Text>
            </View>
            <Divider style={styles.divider} />

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('profile.myInfo.factory')}</Text>
              <Text style={styles.infoValue}>{(user as any)?.factoryName || user?.factoryId || '-'}</Text>
            </View>
            <Divider style={styles.divider} />

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('profile.myInfo.hireDate')}</Text>
              <Text style={styles.infoValue}>{(user as any)?.hireDate?.split('T')[0] || '-'}</Text>
            </View>
            <Divider style={styles.divider} />

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('profile.myInfo.employeeCode')}</Text>
              <Text style={styles.infoValue}>{(user as any)?.employeeCode || '-'}</Text>
            </View>
          </View>

          {/* 账号安全 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.myInfo.security')}</Text>

            <TouchableOpacity style={styles.securityItem}>
              <View style={styles.securityLeft}>
                <MaterialCommunityIcons name="lock" size={20} color={HR_THEME.textSecondary} />
                <Text style={styles.securityLabel}>{t('profile.myInfo.changePassword')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={HR_THEME.textMuted} />
            </TouchableOpacity>
            <Divider style={styles.divider} />

            <TouchableOpacity style={styles.securityItem}>
              <View style={styles.securityLeft}>
                <MaterialCommunityIcons name="cellphone" size={20} color={HR_THEME.textSecondary} />
                <Text style={styles.securityLabel}>{t('profile.myInfo.bindDevice')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={HR_THEME.textMuted} />
            </TouchableOpacity>
          </View>

          {isEditing && (
            <View style={styles.editActions}>
              <Button
                mode="outlined"
                onPress={handleCancel}
                style={styles.cancelButton}
                textColor={HR_THEME.textSecondary}
              >
                {t('profile.myInfo.cancel')}
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                loading={loading}
                disabled={loading}
                style={styles.saveButton}
                buttonColor={HR_THEME.primary}
              >
                {t('profile.myInfo.save')}
              </Button>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
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
  editBtn: { padding: 4 },
  content: { flex: 1 },
  avatarSection: { alignItems: 'center', paddingVertical: 24, backgroundColor: HR_THEME.cardBackground },
  changeAvatarBtn: { marginTop: 12 },
  changeAvatarText: { fontSize: 14, color: HR_THEME.primary },
  section: {
    backgroundColor: HR_THEME.cardBackground, marginTop: 12, paddingHorizontal: 16, paddingVertical: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: '500', color: HR_THEME.textMuted, marginBottom: 12 },
  infoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  infoLabel: { width: 80, fontSize: 14, color: HR_THEME.textSecondary },
  infoValue: { flex: 1, fontSize: 14, color: HR_THEME.textPrimary, textAlign: 'right' },
  input: { flex: 1, backgroundColor: HR_THEME.background, height: 40 },
  divider: { marginLeft: 80 },
  securityItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  securityLeft: { flexDirection: 'row', alignItems: 'center' },
  securityLabel: { fontSize: 14, color: HR_THEME.textPrimary, marginLeft: 12 },
  editActions: { flexDirection: 'row', padding: 16, marginTop: 12 },
  cancelButton: { flex: 1, marginRight: 12, borderColor: HR_THEME.border },
  saveButton: { flex: 1 },
  bottomSpacer: { height: 40 },
});
