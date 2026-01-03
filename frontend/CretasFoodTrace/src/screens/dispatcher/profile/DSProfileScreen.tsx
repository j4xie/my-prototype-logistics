/**
 * 调度员个人中心屏幕
 *
 * 功能:
 * - 个人信息展示（头像、姓名、工号、角色、工龄）
 * - 今日工作统计（待审批、已处理、调动、计划）
 * - 绩效指标（计划完成率、OTD、人员调配效率、响应时间）
 * - 功能菜单导航
 * - 账号管理
 * - 系统设置
 * - 退出登录
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

// 主题颜色
const DISPATCHER_THEME = {
  primary: '#722ed1',
  secondary: '#a18cd1',
  accent: '#fbc2eb',
  success: '#52c41a',
  warning: '#fa8c16',
  danger: '#ff4d4f',
  info: '#1890ff',
  background: '#f5f5f5',
  cardBackground: '#ffffff',
};

// 用户信息类型
interface UserProfile {
  name: string;
  code: string;
  role: string;
  department: string;
  hireDate: string;
  tenure: string;
  avatar: string;
}

// 统计数据类型
interface TodayStats {
  pendingApprovals: number;
  processed: number;
  transfers: number;
  plans: number;
}

// 绩效指标类型
interface PerformanceMetric {
  label: string;
  value: string;
  percentage?: number;
  change: string;
  changeType: 'up' | 'down';
  gradientColors: string[];
  note?: string;
}

// 菜单项类型
interface MenuItem {
  id: string;
  title: string;
  icon: string;
  iconType: 'ionicons' | 'material' | 'feather';
  badge?: string;
  badgeColor?: string;
  screen?: string;
}

// Mock 数据
const mockProfile: UserProfile = {
  name: '赵调度',
  code: '099',
  role: '调度员',
  department: '生产调度部',
  hireDate: '2022-06-15',
  tenure: '2年6个月',
  avatar: '赵',
};

const mockTodayStats: TodayStats = {
  pendingApprovals: 8,
  processed: 5,
  transfers: 3,
  plans: 12,
};

const mockPerformanceMetrics: PerformanceMetric[] = [
  {
    label: '计划完成率',
    value: '87%',
    percentage: 87,
    change: '↑5%',
    changeType: 'up',
    gradientColors: ['#52c41a', '#95de64'],
  },
  {
    label: '准时交付率(OTD)',
    value: '94%',
    percentage: 94,
    change: '↑2%',
    changeType: 'up',
    gradientColors: ['#1890ff', '#69c0ff'],
  },
  {
    label: '人员调配效率',
    value: '90%',
    percentage: 90,
    change: '↑3%',
    changeType: 'up',
    gradientColors: ['#a18cd1', '#fbc2eb'],
  },
  {
    label: '平均紧急响应时间',
    value: '15分钟',
    change: '↓3分钟',
    changeType: 'down',
    gradientColors: ['#722ed1', '#a18cd1'],
    note: '目标: <20分钟 · 达成',
  },
];

const functionMenuItems: MenuItem[] = [
  {
    id: 'approval',
    title: '我的审批记录',
    icon: 'checkmark-done-outline',
    iconType: 'ionicons',
    screen: 'ApprovalList',
  },
  {
    id: 'statistics',
    title: '调度统计',
    icon: 'stats-chart-outline',
    iconType: 'ionicons',
    screen: 'Statistics',
  },
  {
    id: 'personnel',
    title: '人员管理',
    icon: 'people-outline',
    iconType: 'ionicons',
    screen: 'PersonnelList',
  },
  {
    id: 'schedule',
    title: '排班日历',
    icon: 'calendar-outline',
    iconType: 'ionicons',
    screen: 'PersonnelSchedule',
  },
  {
    id: 'attendance',
    title: '考勤打卡',
    icon: 'time-outline',
    iconType: 'ionicons',
    screen: 'Attendance',
  },
];

const accountMenuItems: MenuItem[] = [
  {
    id: 'skills',
    title: '技能认证管理',
    icon: 'star-outline',
    iconType: 'ionicons',
    badge: '4项已认证',
    badgeColor: DISPATCHER_THEME.success,
  },
  {
    id: 'employeeCode',
    title: '工号绑定设置',
    icon: 'card-outline',
    iconType: 'ionicons',
    badge: '(099) 已绑定',
    badgeColor: DISPATCHER_THEME.secondary,
  },
];

const systemMenuItems: MenuItem[] = [
  {
    id: 'notifications',
    title: '消息通知',
    icon: 'notifications-outline',
    iconType: 'ionicons',
  },
  {
    id: 'password',
    title: '修改密码',
    icon: 'lock-closed-outline',
    iconType: 'ionicons',
  },
  {
    id: 'about',
    title: '关于系统',
    icon: 'information-circle-outline',
    iconType: 'ionicons',
  },
];

export default function DSProfileScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [profile] = useState<UserProfile>(mockProfile);
  const [todayStats] = useState<TodayStats>(mockTodayStats);
  const [metrics] = useState<PerformanceMetric[]>(mockPerformanceMetrics);

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: 调用API刷新数据
    // await schedulingApiClient.getDispatcherProfile();
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // 退出登录
  const handleLogout = () => {
    Alert.alert(
      '退出登录',
      '确定要退出登录吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: () => {
            // TODO: 调用登出API并清除token
            // authService.logout();
            console.log('Logout');
          },
        },
      ]
    );
  };

  // 菜单项点击 - 处理跨 Tab 导航
  const handleMenuPress = (item: MenuItem) => {
    if (item.screen) {
      // 跨 Tab 导航映射
      const crossTabNavigation: Record<string, { tab: string; screen: string }> = {
        ApprovalList: { tab: 'PlanTab', screen: 'ApprovalList' },
        Statistics: { tab: 'ProfileTab', screen: 'DSStatistics' },
        PersonnelList: { tab: 'PersonnelTab', screen: 'PersonnelList' },
        PersonnelSchedule: { tab: 'PersonnelTab', screen: 'PersonnelSchedule' },
        Attendance: { tab: 'HomeTab', screen: 'Attendance' },
      };

      const navConfig = crossTabNavigation[item.screen];
      if (navConfig) {
        (navigation as { navigate: (tab: string, params: { screen: string }) => void })
          .navigate(navConfig.tab, { screen: navConfig.screen });
      } else {
        (navigation as { navigate: (screen: string) => void }).navigate(item.screen);
      }
    } else {
      Alert.alert(item.title, '功能开发中...');
    }
  };

  // 渲染统计项
  const renderStatItem = (
    value: number,
    label: string,
    color: string
  ) => (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  // 渲染绩效指标
  const renderMetric = (metric: PerformanceMetric, index: number) => (
    <View key={index} style={styles.metricItem}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricLabel}>{metric.label}</Text>
        <View style={styles.metricValueContainer}>
          <Text style={styles.metricValue}>{metric.value}</Text>
          <Text style={[
            styles.metricChange,
            { color: metric.changeType === 'up' ? DISPATCHER_THEME.success : DISPATCHER_THEME.success }
          ]}>
            {metric.change}
          </Text>
        </View>
      </View>
      {metric.percentage !== undefined && (
        <View style={styles.progressBar}>
          <LinearGradient
            colors={metric.gradientColors as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${metric.percentage}%` }]}
          />
        </View>
      )}
      {metric.note && (
        <Text style={styles.metricNote}>{metric.note}</Text>
      )}
    </View>
  );

  // 渲染菜单项
  const renderMenuItem = (item: MenuItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.menuItem}
      onPress={() => handleMenuPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemLeft}>
        <Ionicons
          name={item.icon as any}
          size={22}
          color={DISPATCHER_THEME.primary}
        />
        <Text style={styles.menuItemText}>{item.title}</Text>
      </View>
      <View style={styles.menuItemRight}>
        {item.badge && (
          <Text style={[styles.menuBadge, { color: item.badgeColor }]}>
            {item.badge}
          </Text>
        )}
        <Ionicons name="chevron-forward" size={18} color="#ccc" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[DISPATCHER_THEME.primary]}
            tintColor={DISPATCHER_THEME.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 个人信息头部 */}
        <LinearGradient
          colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary, DISPATCHER_THEME.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile.avatar}</Text>
            </View>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>{profile.name}</Text>
              <View style={styles.codeBadge}>
                <Text style={styles.codeText}>({profile.code})</Text>
              </View>
            </View>
            <Text style={styles.profileRole}>
              {profile.role} · {profile.department}
            </Text>
            <Text style={styles.profileTenure}>
              入职: {profile.hireDate} · 工龄: {profile.tenure}
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* 今日工作统计 */}
          <View style={styles.statsContainer}>
            {renderStatItem(todayStats.pendingApprovals, '待审批', DISPATCHER_THEME.warning)}
            {renderStatItem(todayStats.processed, '已处理', DISPATCHER_THEME.success)}
            {renderStatItem(todayStats.transfers, '调动', DISPATCHER_THEME.primary)}
            {renderStatItem(todayStats.plans, '计划', DISPATCHER_THEME.info)}
          </View>

          {/* 绩效指标 */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>本月绩效</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>查看详情 &gt;</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.metricsCard}>
            {metrics.map((metric, index) => renderMetric(metric, index))}
          </View>

          {/* 功能菜单 */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>功能菜单</Text>
          </View>
          <View style={styles.menuCard}>
            {functionMenuItems.map(renderMenuItem)}
          </View>

          {/* 账号管理 */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>账号管理</Text>
          </View>
          <View style={styles.menuCard}>
            {accountMenuItems.map(renderMenuItem)}
          </View>

          {/* 系统设置 */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>系统设置</Text>
          </View>
          <View style={styles.menuCard}>
            {systemMenuItems.map(renderMenuItem)}
          </View>

          {/* 退出登录按钮 */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutButtonText}>退出登录</Text>
          </TouchableOpacity>

          {/* 版本信息 */}
          <Text style={styles.versionText}>白垩纪食品溯源系统 v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DISPATCHER_THEME.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerGradient: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  codeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  profileRole: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  profileTenure: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  content: {
    marginTop: -24,
    paddingHorizontal: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionLink: {
    fontSize: 12,
    color: DISPATCHER_THEME.secondary,
  },
  metricsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  metricItem: {
    marginBottom: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 13,
    color: '#666',
  },
  metricValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  metricChange: {
    fontSize: 11,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  metricNote: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    color: '#333',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuBadge: {
    fontSize: 11,
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: DISPATCHER_THEME.danger,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: DISPATCHER_THEME.danger,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginTop: 16,
    marginBottom: 20,
  },
});
