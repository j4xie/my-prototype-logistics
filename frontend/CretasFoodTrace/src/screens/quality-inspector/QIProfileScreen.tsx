/**
 * 个人中心页面
 * Quality Inspector - Profile Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QI_COLORS, QualityInspectorStackParamList } from '../../types/qualityInspector';
import { useAuthStore } from '../../store/authStore';

type NavigationProp = NativeStackNavigationProp<QualityInspectorStackParamList>;

interface MenuItem {
  id: string;
  icon: string;
  label: string;
  value?: string;
  badge?: number;
  onPress: () => void;
}

export default function QIProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();

  const [todayStats, setTodayStats] = useState({
    inspected: 12,
    passed: 11,
    workHours: '7.5',
  });

  const handleLogout = () => {
    Alert.alert('确认退出', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: () => {
          logout();
        },
      },
    ]);
  };

  const menuItems: MenuItem[][] = [
    [
      {
        id: 'clockIn',
        icon: 'time-outline',
        label: '考勤打卡',
        onPress: () => navigation.navigate('QIClockIn'),
      },
      {
        id: 'notifications',
        icon: 'notifications-outline',
        label: '消息通知',
        badge: 3,
        onPress: () => navigation.navigate('QINotifications'),
      },
      {
        id: 'records',
        icon: 'document-text-outline',
        label: '我的记录',
        onPress: () => navigation.navigate('QIRecords'),
      },
    ],
    [
      {
        id: 'settings',
        icon: 'settings-outline',
        label: '设置',
        onPress: () => navigation.navigate('QISettings'),
      },
      {
        id: 'help',
        icon: 'help-circle-outline',
        label: '帮助中心',
        onPress: () => Alert.alert('帮助中心', '如有问题请联系管理员'),
      },
      {
        id: 'about',
        icon: 'information-circle-outline',
        label: '关于',
        value: 'v1.0.0',
        onPress: () => Alert.alert('关于', '白垩纪食品溯源系统\n质检员版本 v1.0.0'),
      },
    ],
  ];

  const renderMenuItem = (item: MenuItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.menuItem}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuLeft}>
        <Ionicons name={item.icon as any} size={22} color={QI_COLORS.textSecondary} />
        <Text style={styles.menuLabel}>{item.label}</Text>
      </View>
      <View style={styles.menuRight}>
        {item.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        )}
        {item.value && <Text style={styles.menuValue}>{item.value}</Text>}
        <Ionicons name="chevron-forward" size={20} color={QI_COLORS.disabled} />
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
    >
      {/* 用户信息卡片 */}
      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={36} color="#fff" />
            </View>
          )}
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>质检员</Text>
          </View>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.fullName || user?.username || '质检员'}</Text>
          <Text style={styles.userDept}>{user?.department === 'quality' ? '质检部' : user?.department || '质检部'}</Text>
        </View>
        <TouchableOpacity style={styles.editBtn}>
          <Ionicons name="create-outline" size={20} color={QI_COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* 今日统计 */}
      <View style={styles.statsCard}>
        <View style={styles.statsItem}>
          <Text style={styles.statsValue}>{todayStats.inspected}</Text>
          <Text style={styles.statsLabel}>今日检验</Text>
        </View>
        <View style={styles.statsDivider} />
        <View style={styles.statsItem}>
          <Text style={styles.statsValue}>{todayStats.passed}</Text>
          <Text style={styles.statsLabel}>检验合格</Text>
        </View>
        <View style={styles.statsDivider} />
        <View style={styles.statsItem}>
          <Text style={styles.statsValue}>{todayStats.workHours}</Text>
          <Text style={styles.statsLabel}>工作时长</Text>
        </View>
      </View>

      {/* 快捷功能 */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => navigation.navigate('QIClockIn')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#E3F2FD' }]}>
            <Ionicons name="finger-print-outline" size={24} color="#1976D2" />
          </View>
          <Text style={styles.quickActionLabel}>打卡</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => navigation.navigate('QIInspectList')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="clipboard-outline" size={24} color={QI_COLORS.primary} />
          </View>
          <Text style={styles.quickActionLabel}>质检</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => navigation.navigate('QIRecords')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#FFF3E0' }]}>
            <Ionicons name="file-tray-full-outline" size={24} color="#FF9800" />
          </View>
          <Text style={styles.quickActionLabel}>记录</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => navigation.navigate('QIAnalysis')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#F3E5F5' }]}>
            <Ionicons name="stats-chart-outline" size={24} color="#9C27B0" />
          </View>
          <Text style={styles.quickActionLabel}>分析</Text>
        </TouchableOpacity>
      </View>

      {/* 菜单列表 */}
      {menuItems.map((group, groupIndex) => (
        <View key={groupIndex} style={styles.menuGroup}>
          {group.map(renderMenuItem)}
        </View>
      ))}

      {/* 退出登录 */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={QI_COLORS.danger} />
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QI_COLORS.background,
  },
  content: {
    padding: 16,
  },

  // 用户信息卡片
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: QI_COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: QI_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: QI_COLORS.secondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: QI_COLORS.card,
  },
  roleBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: QI_COLORS.text,
    marginBottom: 4,
  },
  userDept: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: QI_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 今日统计
  statsCard: {
    flexDirection: 'row',
    backgroundColor: QI_COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  statsItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsDivider: {
    width: 1,
    backgroundColor: QI_COLORS.border,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: QI_COLORS.text,
  },
  statsLabel: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
    marginTop: 4,
  },

  // 快捷功能
  quickActions: {
    flexDirection: 'row',
    backgroundColor: QI_COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    justifyContent: 'space-around',
  },
  quickActionItem: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    color: QI_COLORS.text,
  },

  // 菜单组
  menuGroup: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: QI_COLORS.border,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuLabel: {
    fontSize: 15,
    color: QI_COLORS.text,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuValue: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: QI_COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // 退出登录
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 15,
    color: QI_COLORS.danger,
    fontWeight: '500',
  },
});
