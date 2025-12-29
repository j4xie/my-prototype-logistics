/**
 * HR 个人中心
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { Text, Card, Avatar, Divider, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '../../../store/authStore';
import { HR_THEME } from '../../../types/hrNavigation';

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

  const handleLogout = () => {
    Alert.alert('确认退出', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: async () => {
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
      title: '管理功能',
      items: [
        { id: 'department', icon: 'office-building', label: '部门管理', route: 'DepartmentList' },
        { id: 'whitelist', icon: 'shield-check', label: '白名单管理', route: 'WhitelistList' },
        { id: 'scheduling', icon: 'calendar-clock', label: '排班管理', route: 'WorkSchedule' },
      ],
    },
    {
      title: '个人设置',
      items: [
        { id: 'myinfo', icon: 'account-edit', label: '个人信息', route: 'MyInfo' },
        { id: 'myattendance', icon: 'calendar-check', label: '我的考勤', route: 'MyAttendance' },
        { id: 'notifications', icon: 'bell', label: '消息通知', badge: 3 },
      ],
    },
    {
      title: '系统',
      items: [
        { id: 'settings', icon: 'cog', label: '系统设置' },
        { id: 'help', icon: 'help-circle', label: '帮助中心' },
        { id: 'about', icon: 'information', label: '关于' },
      ],
    },
  ];

  const handleMenuPress = (item: MenuItem) => {
    if (item.route) {
      navigation.navigate(item.route as any);
    } else if (item.onPress) {
      item.onPress();
    } else {
      Alert.alert('提示', '功能开发中');
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
        <MaterialCommunityIcons name="chevron-right" size={22} color={HR_THEME.textMuted} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>个人中心</Text>
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
              <Text style={styles.userName}>{user?.fullName || user?.username || '用户'}</Text>
              <Text style={styles.userRole}>人力资源管理员</Text>
              <View style={styles.userMeta}>
                <MaterialCommunityIcons name="factory" size={14} color={HR_THEME.textMuted} />
                <Text style={styles.metaText}>{(user as any)?.factoryName || user?.factoryId || '未分配工厂'}</Text>
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
              <Text style={styles.statLabel}>在职员工</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>5</Text>
              <Text style={styles.statLabel}>部门数量</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>96%</Text>
              <Text style={styles.statLabel}>本月出勤</Text>
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
              <Text style={styles.logoutText}>退出登录</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.version}>
          <Text style={styles.versionText}>版本 1.0.0</Text>
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
