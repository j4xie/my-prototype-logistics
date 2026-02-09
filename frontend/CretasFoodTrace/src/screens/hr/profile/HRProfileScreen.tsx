/**
 * HR 个人中心
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform,
} from 'react-native';
import { Text, Card, Avatar, Divider, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '../../../store/authStore';
import { HR_THEME } from '../../../types/hrNavigation';
import { useLanguageStore, LANGUAGE_NAMES, type SupportedLanguage } from '../../../store/languageStore';

interface MenuItem {
  id: string;
  icon: string;
  label: string;
  route?: string;
  badge?: number;
  onPress?: () => void;
}

export default function HRProfileScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation('hr');
  const { language, setLanguage } = useLanguageStore();

  const toggleLanguage = () => {
    const newLang: SupportedLanguage = language === 'zh-CN' ? 'en-US' : 'zh-CN';
    setLanguage(newLang);
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm(t('profile.logoutMessage'))) {
        setLoading(true);
        try {
          await logout();
        } catch (error) {
          console.error('退出失败:', error);
        } finally {
          setLoading(false);
        }
      }
      return;
    }
    Alert.alert(t('profile.logoutConfirm'), t('profile.logoutMessage'), [
      { text: t('profile.cancel'), style: 'cancel' },
      { text: t('profile.confirm'), style: 'destructive', onPress: async () => {
        setLoading(true);
        try {
          await logout();
        } catch (error) {
          console.error('退出失败:', error);
        } finally {
          setLoading(false);
        }
      }},
    ]);
  };

  const menuSections: { title: string; items: MenuItem[] }[] = [
    {
      title: t('profile.sections.management'),
      items: [
        { id: 'department', icon: 'office-building', label: t('profile.menu.departmentManage'), route: 'DepartmentList' },
        { id: 'whitelist', icon: 'shield-check', label: t('profile.menu.whitelistManage'), route: 'WhitelistList' },
        { id: 'scheduling', icon: 'calendar-clock', label: t('profile.menu.schedulingManage'), route: 'WorkSchedule' },
      ],
    },
    {
      title: t('profile.sections.personal'),
      items: [
        { id: 'myinfo', icon: 'account-edit', label: t('profile.menu.myInfo'), route: 'MyInfo' },
        { id: 'myattendance', icon: 'calendar-check', label: t('profile.menu.myAttendance'), route: 'MyAttendance' },
        { id: 'notifications', icon: 'bell', label: t('profile.menu.notifications'), badge: 3 },
      ],
    },
    {
      title: t('profile.sections.system'),
      items: [
        { id: 'language', icon: 'translate', label: t('profile.menu.language') || '语言', onPress: toggleLanguage },
        { id: 'settings', icon: 'cog', label: t('profile.menu.settings') },
        { id: 'help', icon: 'help-circle', label: t('profile.menu.help') },
        { id: 'about', icon: 'information', label: t('profile.menu.about') },
      ],
    },
  ];

  const handleMenuPress = (item: MenuItem) => {
    if (item.route) {
      navigation.navigate(item.route as any);
    } else if (item.onPress) {
      item.onPress();
    } else {
      Alert.alert(t('messages.tip'), t('profile.comingSoon'));
    }
  };

  const renderMenuItem = (item: MenuItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.menuItem}
      onPress={() => handleMenuPress(item)}
    >
      <View style={styles.menuIcon}>
        <MaterialCommunityIcons name={item.icon as any} size={22} color={HR_THEME.primary} />
      </View>
      <Text style={styles.menuLabel}>{item.label}</Text>
      <View style={styles.menuRight}>
        {item.badge && item.badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        )}
        {item.id === 'language' && (
          <Text style={styles.languageText}>{LANGUAGE_NAMES[language]}</Text>
        )}
        {item.id !== 'language' && <MaterialCommunityIcons name="chevron-right" size={22} color={HR_THEME.textMuted} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 用户信息卡片 */}
        <Card style={styles.profileCard}>
          <Card.Content style={styles.profileContent}>
            <Avatar.Text
              size={72}
              label={user?.fullName?.substring(0, 1) || user?.username?.substring(0, 1) || 'U'}
              style={{ backgroundColor: HR_THEME.primary }}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{user?.fullName || user?.username || t('common.user')}</Text>
              <Text style={styles.userRole}>{t('profile.role')}</Text>
              <View style={styles.userMeta}>
                <MaterialCommunityIcons name="factory" size={14} color={HR_THEME.textMuted} />
                <Text style={styles.metaText}>{(user as any)?.factoryName || user?.factoryId || t('profile.noFactory')}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation.navigate('MyInfo' as any)}
            >
              <MaterialCommunityIcons name="pencil" size={20} color={HR_THEME.primary} />
            </TouchableOpacity>
          </Card.Content>
        </Card>

        {/* 快捷统计 */}
        <Card style={styles.statsCard}>
          <Card.Content style={styles.statsContent}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>45</Text>
              <Text style={styles.statLabel}>{t('profile.stats.activeStaff')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>5</Text>
              <Text style={styles.statLabel}>{t('profile.stats.departmentCount')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>96%</Text>
              <Text style={styles.statLabel}>{t('profile.stats.monthlyAttendance')}</Text>
            </View>
          </Card.Content>
        </Card>

        {/* 菜单列表 */}
        {menuSections.map((section, index) => (
          <Card key={index} style={styles.menuCard}>
            <Card.Content>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.items.map((item, itemIndex) => (
                <View key={item.id}>
                  {renderMenuItem(item)}
                  {itemIndex < section.items.length - 1 && <Divider style={styles.divider} />}
                </View>
              ))}
            </Card.Content>
          </Card>
        ))}

        {/* 退出登录 */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={HR_THEME.danger} />
          ) : (
            <>
              <MaterialCommunityIcons name="logout" size={20} color={HR_THEME.danger} />
              <Text style={styles.logoutText}>{t('profile.logout')}</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.version}>
          <Text style={styles.versionText}>{t('profile.version')} 1.0.0</Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HR_THEME.background },
  header: { padding: 16, backgroundColor: HR_THEME.primary },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  content: { flex: 1, padding: 16 },
  profileCard: { borderRadius: 12, marginBottom: 16, backgroundColor: HR_THEME.cardBackground },
  profileContent: { flexDirection: 'row', alignItems: 'center' },
  profileInfo: { flex: 1, marginLeft: 16 },
  userName: { fontSize: 20, fontWeight: 'bold', color: HR_THEME.textPrimary },
  userRole: { fontSize: 14, color: HR_THEME.primary, marginTop: 2 },
  userMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaText: { fontSize: 12, color: HR_THEME.textMuted, marginLeft: 4 },
  editBtn: { padding: 8 },
  statsCard: { borderRadius: 12, marginBottom: 16, backgroundColor: HR_THEME.cardBackground },
  statsContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: HR_THEME.primary },
  statLabel: { fontSize: 12, color: HR_THEME.textSecondary, marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: HR_THEME.border },
  menuCard: { borderRadius: 12, marginBottom: 16, backgroundColor: HR_THEME.cardBackground },
  sectionTitle: { fontSize: 13, fontWeight: '500', color: HR_THEME.textMuted, marginBottom: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  menuIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: HR_THEME.primary + '10', justifyContent: 'center', alignItems: 'center',
  },
  menuLabel: { flex: 1, fontSize: 15, color: HR_THEME.textPrimary, marginLeft: 12 },
  menuRight: { flexDirection: 'row', alignItems: 'center' },
  languageText: { fontSize: 14, color: HR_THEME.textMuted, marginRight: 4 },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: HR_THEME.danger, justifyContent: 'center', alignItems: 'center',
    marginRight: 8, paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
  divider: { marginLeft: 48 },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: HR_THEME.cardBackground, paddingVertical: 16, borderRadius: 12,
  },
  logoutText: { fontSize: 15, color: HR_THEME.danger, marginLeft: 8 },
  version: { alignItems: 'center', paddingVertical: 24 },
  versionText: { fontSize: 12, color: HR_THEME.textMuted },
  bottomSpacer: { height: 40 },
});
