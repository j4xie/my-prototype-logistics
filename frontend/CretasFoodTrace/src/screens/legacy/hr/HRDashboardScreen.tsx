import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Card,
  Appbar,
  ActivityIndicator,
  IconButton,
  Chip,
  Avatar,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ManagementStackParamList } from '../../../types/navigation';
import { useAuthStore } from '../../../store/authStore';
import { hrApiClient, HRDashboardData, AttendanceAnomaly } from '../../../services/api/hrApiClient';
import { handleError } from '../../../utils/errorHandler';
import { logger } from '../../../utils/logger';
import { HR_QUICK_ACTIONS, QuickActionItem } from '../../../types/hr';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// 创建专用logger
const hrLogger = logger.createContextLogger('HRDashboard');

type HRDashboardNavigationProp = NativeStackNavigationProp<
  ManagementStackParamList,
  'HRDashboard'
>;

interface ErrorState {
  message: string;
  canRetry: boolean;
}

/**
 * HR管理员仪表板
 *
 * 功能模块:
 * 1. 欢迎区域 (用户名 + 日期)
 * 2. 今日人员概览 (4个统计卡片)
 * 3. 待处理事项 (白名单待激活)
 * 4. 今日考勤异常 (迟到/未打卡)
 * 5. 快捷操作 (添加员工、考勤统计、白名单、部门管理)
 */
export default function HRDashboardScreen() {
  const navigation = useNavigation<HRDashboardNavigationProp>();
  const { t } = useTranslation('hr');
  const { user } = useAuthStore();

  // 状态管理
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [dashboardData, setDashboardData] = useState<HRDashboardData>({
    todayOnSite: 0,
    totalStaff: 0,
    attendanceRate: 0,
    lateCount: 0,
    whitelistPending: 0,
    thisMonthNewHires: 0,
    newHiresChange: 0,
  });
  const [anomalies, setAnomalies] = useState<AttendanceAnomaly[]>([]);

  // 获取当前日期格式化
  const getFormattedDate = (): string => {
    const now = new Date();
    const days = [
      t('dashboard.weekdays.sun'),
      t('dashboard.weekdays.mon'),
      t('dashboard.weekdays.tue'),
      t('dashboard.weekdays.wed'),
      t('dashboard.weekdays.thu'),
      t('dashboard.weekdays.fri'),
      t('dashboard.weekdays.sat')
    ];
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const day = days[now.getDay()];
    return t('dashboard.dateFormat', { year, month, date, day });
  };

  // 获取问候语
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 6) return t('dashboard.greetings.earlyMorning');
    if (hour < 9) return t('dashboard.greetings.morning');
    if (hour < 12) return t('dashboard.greetings.lateMorning');
    if (hour < 14) return t('dashboard.greetings.noon');
    if (hour < 18) return t('dashboard.greetings.afternoon');
    if (hour < 22) return t('dashboard.greetings.evening');
    return t('dashboard.greetings.lateNight');
  };

  // 加载仪表板数据
  const loadDashboardData = useCallback(async () => {
    try {
      hrLogger.debug('开始加载HR仪表板数据');

      // 并行加载数据
      const [dashboardResult, anomaliesResult] = await Promise.allSettled([
        hrApiClient.getDashboardData(),
        hrApiClient.getTodayAnomalies(),
      ]);

      // 处理仪表板数据
      if (dashboardResult.status === 'fulfilled') {
        setDashboardData(dashboardResult.value);
        hrLogger.info('仪表板数据加载成功', dashboardResult.value);
      } else {
        hrLogger.warn('仪表板数据加载失败', dashboardResult.reason);
      }

      // 处理异常数据
      if (anomaliesResult.status === 'fulfilled') {
        setAnomalies(anomaliesResult.value);
        hrLogger.info('考勤异常加载成功', { count: anomaliesResult.value.length });
      } else {
        hrLogger.warn('考勤异常加载失败', anomaliesResult.reason);
      }

      setError(null);
    } catch (err) {
      hrLogger.error('加载HR仪表板数据失败', err);
      handleError(err, { showAlert: false, logError: true });
      setError({
        message: err instanceof Error ? err.message : t('dashboard.loadFailed'),
        canRetry: true,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // 下拉刷新
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  // 处理快捷操作点击
  const handleQuickAction = (action: QuickActionItem) => {
    hrLogger.debug('快捷操作点击', { actionId: action.id, route: action.route });

    // 类型安全的导航
    const routeName = action.route as keyof ManagementStackParamList;
    navigation.navigate(routeName as never);
  };

  // 渲染统计卡片
  const renderStatCard = (
    icon: string,
    iconColor: string,
    bgColor: string,
    value: string,
    label: string,
    trend?: { value: string; type: 'up' | 'down' | 'normal' | 'warning' }
  ) => (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}>
      <View style={[styles.statIconContainer, { backgroundColor: iconColor + '20' }]}>
        <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={20} color={iconColor} />
      </View>
      <View style={styles.statInfo}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      {trend && (
        <View style={[
          styles.trendBadge,
          trend.type === 'up' && styles.trendUp,
          trend.type === 'down' && styles.trendDown,
          trend.type === 'warning' && styles.trendWarning,
          trend.type === 'normal' && styles.trendNormal,
        ]}>
          <Text style={[
            styles.trendText,
            trend.type === 'up' && styles.trendTextUp,
            trend.type === 'down' && styles.trendTextDown,
            trend.type === 'warning' && styles.trendTextWarning,
            trend.type === 'normal' && styles.trendTextNormal,
          ]}>
            {trend.value}
          </Text>
        </View>
      )}
    </View>
  );

  // 渲染考勤异常列表项
  const renderAnomalyItem = (anomaly: AttendanceAnomaly) => (
    <View key={anomaly.id} style={styles.anomalyItem}>
      <Avatar.Text
        size={40}
        label={anomaly.userName?.charAt(0) || '?'}
        style={[
          styles.anomalyAvatar,
          anomaly.anomalyType === 'LATE' ? styles.avatarError : styles.avatarWarning,
        ]}
        labelStyle={styles.avatarLabel}
      />
      <View style={styles.anomalyContent}>
        <Text style={styles.anomalyName}>{anomaly.userName}</Text>
        <Text style={styles.anomalyMeta}>
          {anomaly.position || '操作员'} · {anomaly.department || '未分配'}
        </Text>
      </View>
      <Chip
        mode="flat"
        textStyle={styles.anomalyChipText}
        style={[
          styles.anomalyChip,
          anomaly.anomalyType === 'LATE' ? styles.chipError : styles.chipWarning,
        ]}
      >
        {anomaly.anomalyTypeDisplay}
      </Chip>
    </View>
  );

  // 渲染快捷操作按钮
  const renderQuickAction = (action: QuickActionItem) => (
    <TouchableOpacity
      key={action.id}
      style={styles.quickActionItem}
      onPress={() => handleQuickAction(action)}
      activeOpacity={0.7}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: action.backgroundColor }]}>
        <MaterialCommunityIcons name={action.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={action.iconColor} />
      </View>
      <Text style={styles.quickActionLabel}>{action.label}</Text>
    </TouchableOpacity>
  );

  // 计算待处理数量
  const pendingCount = dashboardData.whitelistPending + anomalies.length;

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header} elevated>
        <Appbar.Content title={t('dashboard.title')} titleStyle={styles.headerTitle} />
        <Appbar.Action icon="bell-outline" onPress={() => {}} color="#fff" />
        <Appbar.Action icon="refresh" onPress={loadDashboardData} color="#fff" />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 欢迎区域 */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeText}>
            <Text style={styles.greeting}>
              {getGreeting()}{t('dashboard.greetingSuffix')}{user?.fullName || user?.username || t('dashboard.defaultHRAdmin')}
            </Text>
            <Text style={styles.welcomeDate}>{getFormattedDate()}</Text>
          </View>
          <Avatar.Icon
            size={48}
            icon="account-circle"
            style={styles.welcomeAvatar}
          />
        </View>

        {/* 今日人员概览 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('dashboard.todayOverview')}</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
          </View>
        ) : error ? (
          <Card style={styles.errorCard}>
            <Card.Content style={styles.errorContent}>
              <IconButton icon="alert-circle-outline" size={48} iconColor="#F44336" />
              <Text style={styles.errorText}>{error.message}</Text>
              {error.canRetry && (
                <TouchableOpacity style={styles.retryButton} onPress={loadDashboardData}>
                  <Text style={styles.retryText}>{t('common:buttons.retry')}</Text>
                </TouchableOpacity>
              )}
            </Card.Content>
          </Card>
        ) : (
          <View style={styles.statGrid}>
            {renderStatCard(
              'account-group',
              '#1890ff',
              '#e6f7ff',
              `${dashboardData.todayOnSite}/${dashboardData.totalStaff}`,
              t('dashboard.onDutyCount'),
              { value: `${dashboardData.attendanceRate}%`, type: 'normal' }
            )}
            {renderStatCard(
              'clock-alert-outline',
              '#ff4d4f',
              '#fff1f0',
              String(dashboardData.lateCount),
              t('dashboard.lateCount'),
              dashboardData.lateCount > 0
                ? { value: t('dashboard.needsAttention'), type: 'warning' }
                : undefined
            )}
            {renderStatCard(
              'account-plus-outline',
              '#fa8c16',
              '#fff7e6',
              String(dashboardData.whitelistPending),
              t('dashboard.whitelistPending')
            )}
            {renderStatCard(
              'calendar-check',
              '#52c41a',
              '#f6ffed',
              String(dashboardData.thisMonthNewHires),
              t('dashboard.thisMonthNewHires'),
              dashboardData.newHiresChange !== undefined && dashboardData.newHiresChange !== 0
                ? {
                    value: dashboardData.newHiresChange > 0
                      ? `+${dashboardData.newHiresChange}`
                      : String(dashboardData.newHiresChange),
                    type: dashboardData.newHiresChange > 0 ? 'up' : 'down',
                  }
                : undefined
            )}
          </View>
        )}

        {/* 待处理事项 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('dashboard.pendingItems')}</Text>
          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{t('dashboard.pendingCount', { count: pendingCount })}</Text>
            </View>
          )}
        </View>

        <Card style={styles.todoCard}>
          <Card.Content style={styles.todoContent}>
            {dashboardData.whitelistPending > 0 && (
              <TouchableOpacity
                style={styles.todoItem}
                onPress={() => navigation.navigate('WhitelistManagement' as never)}
              >
                <View style={styles.todoIcon}>
                  <MaterialCommunityIcons name="shield-check" size={20} color="#fa8c16" />
                </View>
                <View style={styles.todoTextContent}>
                  <Text style={styles.todoTitle}>{t('dashboard.whitelistPending')}</Text>
                  <Text style={styles.todoDesc}>{t('dashboard.pendingActivation', { count: dashboardData.whitelistPending })}</Text>
                </View>
                <View style={styles.todoBadge}>
                  <Text style={styles.todoBadgeText}>{dashboardData.whitelistPending}</Text>
                </View>
              </TouchableOpacity>
            )}

            {anomalies.length > 0 && (
              <TouchableOpacity
                style={styles.todoItem}
                onPress={() => navigation.navigate('AttendanceStats' as never)}
              >
                <View style={styles.todoIcon}>
                  <MaterialCommunityIcons name="clock-alert-outline" size={20} color="#ff4d4f" />
                </View>
                <View style={styles.todoTextContent}>
                  <Text style={styles.todoTitle}>{t('dashboard.attendanceAnomaly')}</Text>
                  <Text style={styles.todoDesc}>{t('dashboard.needsProcessing', { count: anomalies.length })}</Text>
                </View>
                <View style={[styles.todoBadge, styles.todoBadgeError]}>
                  <Text style={styles.todoBadgeText}>{anomalies.length}</Text>
                </View>
              </TouchableOpacity>
            )}

            {pendingCount === 0 && (
              <View style={styles.emptyTodo}>
                <MaterialCommunityIcons name="check-circle-outline" size={48} color="#52c41a" />
                <Text style={styles.emptyTodoText}>{t('dashboard.noPendingItems')}</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* 今日考勤异常 */}
        {anomalies.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('dashboard.todayAttendanceAnomalies')}</Text>
            </View>
            <Card style={styles.anomalyCard}>
              <Card.Content>
                {anomalies.slice(0, 5).map(renderAnomalyItem)}
                {anomalies.length > 5 && (
                  <TouchableOpacity
                    style={styles.viewMoreButton}
                    onPress={() => navigation.navigate('AttendanceStats' as never)}
                  >
                    <Text style={styles.viewMoreText}>
                      {t('dashboard.viewAllRecords', { count: anomalies.length })}
                    </Text>
                  </TouchableOpacity>
                )}
              </Card.Content>
            </Card>
          </>
        )}

        {/* 快捷操作 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('dashboard.quickActions')}</Text>
        </View>
        <View style={styles.quickActionsGrid}>
          {HR_QUICK_ACTIONS.map(renderQuickAction)}
        </View>

        {/* 底部间距 */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#667eea',
  },
  headerTitle: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },

  // 欢迎区域
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  welcomeText: {
    flex: 1,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  welcomeDate: {
    fontSize: 13,
    color: '#757575',
  },
  welcomeAvatar: {
    backgroundColor: '#667eea',
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  pendingBadge: {
    backgroundColor: '#667eea',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },

  // 统计卡片
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  statCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statInfo: {
    flex: 1,
    marginLeft: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  statLabel: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trendUp: {
    backgroundColor: '#f6ffed',
  },
  trendDown: {
    backgroundColor: '#fff1f0',
  },
  trendWarning: {
    backgroundColor: '#fff7e6',
  },
  trendNormal: {
    backgroundColor: '#e6f7ff',
  },
  trendText: {
    fontSize: 11,
    fontWeight: '500',
  },
  trendTextUp: {
    color: '#52c41a',
  },
  trendTextDown: {
    color: '#ff4d4f',
  },
  trendTextWarning: {
    color: '#fa8c16',
  },
  trendTextNormal: {
    color: '#1890ff',
  },

  // Loading & Error
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    marginBottom: 16,
  },
  errorContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  errorText: {
    color: '#F44336',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  retryText: {
    color: '#F44336',
    fontWeight: '500',
  },

  // 待处理事项
  todoCard: {
    marginBottom: 8,
    borderRadius: 12,
  },
  todoContent: {
    paddingVertical: 8,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  todoIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fff7e6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  todoTextContent: {
    flex: 1,
    marginLeft: 12,
  },
  todoTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
  },
  todoDesc: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  todoBadge: {
    backgroundColor: '#fa8c16',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  todoBadgeError: {
    backgroundColor: '#ff4d4f',
  },
  todoBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyTodo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTodoText: {
    color: '#52c41a',
    marginTop: 8,
    fontSize: 14,
  },

  // 考勤异常
  anomalyCard: {
    marginBottom: 8,
    borderRadius: 12,
  },
  anomalyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  anomalyAvatar: {
    marginRight: 12,
  },
  avatarError: {
    backgroundColor: '#ff4d4f',
  },
  avatarWarning: {
    backgroundColor: '#fa8c16',
  },
  avatarLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  anomalyContent: {
    flex: 1,
  },
  anomalyName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
  },
  anomalyMeta: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  anomalyChip: {
    height: 28,
  },
  anomalyChipText: {
    fontSize: 11,
  },
  chipError: {
    backgroundColor: '#fff1f0',
  },
  chipWarning: {
    backgroundColor: '#fff7e6',
  },
  viewMoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  viewMoreText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '500',
  },

  // 快捷操作
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 12,
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
    color: '#424242',
    fontWeight: '500',
  },

  // Bottom
  bottomSpacing: {
    height: 24,
  },
});
