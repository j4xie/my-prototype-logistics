/**
 * 个人信息页面
 * 查看和编辑用户个人信息
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/authStore';
import { userApiClient } from '../../../services/api/userApiClient';

interface UserInfo {
  id: number;
  username: string;
  realName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
}

export function PersonalInfoScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { t } = useTranslation('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo>({
    id: 0,
    username: '',
    realName: '',
    email: '',
    phone: '',
    department: '',
    position: '',
  });

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      setLoading(true);
      if (user?.id) {
        const data = await userApiClient.getUserById(Number(user.id));
        setUserInfo({
          id: data.id,
          username: data.username,
          realName: data.realName || data.fullName || '',
          email: data.email || '',
          phone: data.phone || '',
          department: data.departmentDisplayName || data.department || '',
          position: data.position || '',
        });
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
      // 使用本地 store 数据作为 fallback
      if (user) {
        setUserInfo({
          id: Number(user.id) || 0,
          username: user.username || '',
          realName: (user as any).realName || (user as any).fullName || user.username || '',
          email: user.email || '',
          phone: user.phone || '',
          department: '',
          position: '',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await userApiClient.updateUser(userInfo.id, {
        realName: userInfo.realName,
        email: userInfo.email,
        phone: userInfo.phone,
        position: userInfo.position,
      });
      Alert.alert(t('messages.saveSuccess'), t('personalInfo.updateSuccess'));
      setEditing(false);
    } catch (error) {
      console.error('Update failed:', error);
      Alert.alert(t('messages.saveFailed'), t('personalInfo.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const InfoRow = ({ label, value, editable = false, field }: {
    label: string;
    value: string;
    editable?: boolean;
    field?: keyof UserInfo;
  }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      {editing && editable && field ? (
        <TextInput
          style={styles.infoInput}
          value={value}
          onChangeText={(text) => setUserInfo({ ...userInfo, [field]: text })}
          placeholder={t('personalInfo.enterPlaceholder', { field: label })}
        />
      ) : (
        <Text style={styles.infoValue}>{value || '-'}</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>{t('personalInfo.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('personalInfo.title')}</Text>
        <TouchableOpacity
          onPress={() => editing ? handleSave() : setEditing(true)}
          disabled={saving}
        >
          <Text style={[styles.editButton, saving && styles.editButtonDisabled]}>
            {saving ? t('personalInfo.saving') : editing ? t('personalInfo.save') : t('personalInfo.edit')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* 头像区域 */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Icon source="account" size={50} color="#fff" />
          </View>
          <Text style={styles.username}>{userInfo.username}</Text>
        </View>

        {/* 基本信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('personalInfo.basicInfo')}</Text>
          <View style={styles.infoCard}>
            <InfoRow label={t('personalInfo.username')} value={userInfo.username} />
            <InfoRow label={t('personalInfo.realName')} value={userInfo.realName} editable field="realName" />
            <InfoRow label={t('personalInfo.email')} value={userInfo.email} editable field="email" />
            <InfoRow label={t('personalInfo.phone')} value={userInfo.phone} editable field="phone" />
          </View>
        </View>

        {/* 工作信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('personalInfo.workInfo')}</Text>
          <View style={styles.infoCard}>
            <InfoRow label={t('personalInfo.department')} value={userInfo.department} />
            <InfoRow label={t('personalInfo.position')} value={userInfo.position} editable field="position" />
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  editButton: {
    fontSize: 16,
    color: '#667eea',
    fontWeight: '500',
  },
  editButtonDisabled: {
    color: '#ccc',
  },
  content: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#999',
    marginLeft: 20,
    marginBottom: 8,
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 15,
    color: '#666',
    width: 80,
  },
  infoValue: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    textAlign: 'right',
  },
  infoInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    textAlign: 'right',
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#667eea',
  },
});

export default PersonalInfoScreen;
