/**
 * HR 首页仪表板
 *
 * 功能:
 * - 今日出勤/迟到/待激活白名单/本月入职统计卡片
 * - 快捷操作入口
 * - 异常告警列表
 *
 * 对应原型: /docs/prd/prototype/hr-admin/index.html
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, Card, Surface, ActivityIndicator, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { hrApiClient } from '../../../services/api/hrApiClient';
import { useAuthStore } from '../../../store/authStore';
import {
  HR_THEME,
  HR_QUICK_ACTIONS,
  ANOMALY_TYPE_CONFIG,
  type HRDashboardStats,
  type AttendanceAnomaly,
  type HRHomeStackParamList,
} from '../../../types/hrNavigation';

type NavigationProp = NativeStackNavigationProp<HRHomeStackParamList>;

interface StatCardProps {
  title: string;
  value: number | string;
  icon: string;
  color: string;
  subtext?: string;
  onPress?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color,
  subtext,
  onPress,
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={styles.statCardWrapper}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <Surface style={styles.statCard} elevation={2}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
        <MaterialCommunityIcons name={icon as any} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtext && <Text style={styles.statSubtext}>{subtext}</Text>}
    </Surface>
  </TouchableOpacity>
);

export default function HRHomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<HRDashboardStats | null>(null);
  const [anomalies, setAnomalies] = useState<AttendanceAnomaly[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [dashboardData, anomalyData] = await Promise.all([
        hrApiClient.getDashboardData(),
        hrApiClient.getTodayAnomalies(),
      ]);

      // API returns data directly, not wrapped in {success, data}
      if (dashboardData) {
        setStats(dashboardData);
      }
      if (anomalyData) {
        // Map API response (id: number) to UI type (id: string)
        const mappedAnomalies: AttendanceAnomaly[] = anomalyData.slice(0, 5).map(a => ({
          ...a,
          id: String(a.id),
          // Ensure resolvedBy is number if present
          resolvedBy: a.resolvedBy != null ? Number(a.resolvedBy) : undefined,
        }));
        setAnomalies(mappedAnomalies);
      }
    } catch (error) {
      console.error('加载 HR 仪表板数据失败:', error);
      Alert.alert('错误', '加载数据失败，请稍后重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleQuickAction = (route: string) => {
    navigation.navigate(route as any);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={HR_THEME.primary} />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerGradient}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>人事管理</Text>
              <Text style={styles.headerSubtitle}>
                {user?.username || 'HR管理员'}
              </Text>
            </View>
            <IconButton
              icon="bell-outline"
              iconColor="#fff"
              size={24}
              onPress={() => Alert.alert('提示', '通知功能即将上线')}
            />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 统计卡片 */}
        <View style={styles.statsGrid}>
          <StatCard
            title="在岗人数"
            value={stats?.todayOnSite ?? 0}
            icon="account-check"
            color={HR_THEME.success}
            subtext={`总员工 ${stats?.totalStaff ?? 0}`}
          />
          <StatCard
            title="今日迟到"
            value={stats?.lateCount ?? 0}
            icon="clock-alert"
            color={HR_THEME.warning}
            onPress={() => navigation.navigate('AttendanceAnomaly' as any)}
          />
          <StatCard
            title="待激活白名单"
            value={stats?.whitelistPending ?? 0}
            icon="shield-check"
            color={HR_THEME.primary}
            onPress={() => navigation.navigate('WhitelistList' as any)}
          />
          <StatCard
            title="本月入职"
            value={stats?.thisMonthNewHires ?? 0}
            icon="account-plus"
            color={HR_THEME.accent}
            subtext={stats?.lastMonthNewHires !== undefined
              ? `上月 ${stats.lastMonthNewHires}`
              : undefined
            }
            onPress={() => navigation.navigate('NewHires')}
          />
        </View>

        {/* 出勤率 */}
        <Card style={styles.attendanceCard}>
          <Card.Content>
            <View style={styles.attendanceHeader}>
              <Text style={styles.sectionTitle}>今日出勤率</Text>
              <Text style={styles.attendanceRate}>
                {((stats?.attendanceRate ?? 0) * 100).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(stats?.attendanceRate ?? 0) * 100}%` },
                ]}
              />
            </View>
          </Card.Content>
        </Card>

        {/* 快捷操作 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>快捷操作</Text>
          <View style={styles.quickActions}>
            {HR_QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.quickActionItem}
                onPress={() => handleQuickAction(action.route)}
              >
                <View
                  style={[
                    styles.quickActionIcon,
                    { backgroundColor: action.color + '20' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={action.icon as any}
                    size={24}
                    color={action.color}
                  />
                </View>
                <Text style={styles.quickActionText}>{action.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 考勤异常 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>考勤异常</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('AttendanceAnomaly' as any)}
            >
              <Text style={styles.viewAll}>查看全部</Text>
            </TouchableOpacity>
          </View>

          {anomalies.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Card.Content style={styles.emptyContent}>
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={48}
                  color={HR_THEME.success}
                />
                <Text style={styles.emptyText}>今日暂无考勤异常</Text>
              </Card.Content>
            </Card>
          ) : (
            anomalies.map((anomaly) => {
              const config = ANOMALY_TYPE_CONFIG[anomaly.anomalyType];
              return (
                <Card key={anomaly.id} style={styles.anomalyCard}>
                  <Card.Content style={styles.anomalyContent}>
                    <View
                      style={[
                        styles.anomalyIcon,
                        { backgroundColor: config.color + '20' },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={config.icon as any}
                        size={20}
                        color={config.color}
                      />
                    </View>
                    <View style={styles.anomalyInfo}>
                      <Text style={styles.anomalyName}>{anomaly.userName}</Text>
                      <Text style={styles.anomalyType}>{config.label}</Text>
                    </View>
                    <Text style={styles.anomalyTime}>
                      {anomaly.anomalyTime?.split(' ')[1] || anomaly.anomalyTime}
                    </Text>
                  </Card.Content>
                </Card>
              );
            })
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HR_THEME.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: HR_THEME.background,
  },
  loadingText: {
    marginTop: 12,
    color: HR_THEME.textSecondary,
  },
  header: {
    backgroundColor: HR_THEME.primary,
  },
  headerGradient: {
    backgroundColor: HR_THEME.primary,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 16,
  },
  statCardWrapper: {
    width: '50%',
    padding: 6,
  },
  statCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: HR_THEME.cardBackground,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: HR_THEME.textPrimary,
  },
  statTitle: {
    fontSize: 14,
    color: HR_THEME.textSecondary,
    marginTop: 4,
  },
  statSubtext: {
    fontSize: 12,
    color: HR_THEME.textMuted,
    marginTop: 2,
  },
  attendanceCard: {
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: HR_THEME.cardBackground,
  },
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  attendanceRate: {
    fontSize: 24,
    fontWeight: 'bold',
    color: HR_THEME.primary,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: HR_THEME.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: HR_THEME.primary,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: HR_THEME.textPrimary,
  },
  viewAll: {
    fontSize: 14,
    color: HR_THEME.primary,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
    marginTop: 8,
  },
  quickActionItem: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: HR_THEME.textSecondary,
    textAlign: 'center',
  },
  emptyCard: {
    borderRadius: 12,
    backgroundColor: HR_THEME.cardBackground,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: HR_THEME.textSecondary,
    marginTop: 12,
  },
  anomalyCard: {
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: HR_THEME.cardBackground,
  },
  anomalyContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  anomalyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  anomalyInfo: {
    flex: 1,
  },
  anomalyName: {
    fontSize: 14,
    fontWeight: '500',
    color: HR_THEME.textPrimary,
  },
  anomalyType: {
    fontSize: 12,
    color: HR_THEME.textSecondary,
    marginTop: 2,
  },
  anomalyTime: {
    fontSize: 12,
    color: HR_THEME.textMuted,
  },
  bottomSpacer: {
    height: 80,
  },
});
