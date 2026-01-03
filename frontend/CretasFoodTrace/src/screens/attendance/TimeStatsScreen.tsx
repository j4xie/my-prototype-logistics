import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Dimensions, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  SegmentedButtons,
  Surface,
  ActivityIndicator,
  DataTable,
  Chip,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { useTranslation } from 'react-i18next';
import { timeStatsApiClient } from '../../services/api/timeStatsApiClient';
import { useAuthStore } from '../../store/authStore';
import { getFactoryId } from '../../types/auth';
import { handleError, getErrorMsg } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建TimeStats专用logger
const timeStatsLogger = logger.createContextLogger('TimeStats');

const { width } = Dimensions.get('window');

/**
 * 工时统计分析页面
 * P1-考勤: 工时统计API集成 - 日/周/月统计
 *
 * 功能:
 * - 日/周/月工时统计
 * - 部门工时统计
 * - 效率分析报告
 * - 绩效排行榜
 * - 数据可视化展示
 */
export default function TimeStatsScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { t } = useTranslation('hr');
  const factoryId = getFactoryId(user);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  // Data state
  const [dailyStats, setDailyStats] = useState<any>(null);
  const [weeklyStats, setWeeklyStats] = useState<any>(null);
  const [monthlyStats, setMonthlyStats] = useState<any>(null);
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  const [efficiencyReport, setEfficiencyReport] = useState<any>(null);

  /**
   * 获取日期参数
   */
  const getDateParams = (): { today: string; weekStart: string; year: number; month: number } => {
    const now = new Date();
    const today = now.toISOString().split('T')[0] as string; // YYYY-MM-DD

    // 获取本周一
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 周日特殊处理
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    const weekStart = monday.toISOString().split('T')[0] as string;

    // 获取当前年月
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 0-based to 1-based

    return { today, weekStart, year, month };
  };

  /**
   * 加载统计数据
   */
  const loadData = async () => {
    setLoading(true);
    try {
      const { today, weekStart, year, month } = getDateParams();

      timeStatsLogger.debug('加载工时统计数据', {
        factoryId,
        timeRange,
        today,
        weekStart,
        year,
        month,
      });

      // 并行加载所有统计数据
      if (!factoryId) {
        console.error('❌ Factory ID not found');
        setLoading(false);
        return;
      }

      // Narrow the type to string
      const validFactoryId: string = factoryId;

      const [dailyResponse, weeklyResponse, monthlyResponse, performersResponse, efficiencyResponse] =
        await Promise.all([
          // API 1: 日统计
          timeStatsApiClient.getDailyStats(today, validFactoryId).catch(() => ({ data: null })),
          // API 2: 周统计
          timeStatsApiClient.getWeeklyStats(weekStart, validFactoryId).catch(() => ({ data: null })),
          // API 3: 月统计
          timeStatsApiClient.getMonthlyStats(year, month, validFactoryId).catch(() => ({ data: null })),
          // API 4: 绩效排行
          timeStatsApiClient.getTopPerformers(10, validFactoryId).catch(() => ({ data: [] })),
          // API 5: 效率报告
          timeStatsApiClient.getEfficiencyReport(undefined, validFactoryId).catch(() => ({ data: null })),
        ]);

      timeStatsLogger.info('工时统计数据加载成功', {
        factoryId,
        timeRange,
        hasDaily: !!dailyResponse.data,
        hasWeekly: !!weeklyResponse.data,
        hasMonthly: !!monthlyResponse.data,
        performersCount: performersResponse.data?.length ?? 0,
        hasEfficiency: !!efficiencyResponse.data,
      });

      // 更新状态
      setDailyStats(dailyResponse.data);
      setWeeklyStats(weeklyResponse.data);
      setMonthlyStats(monthlyResponse.data);
      setTopPerformers(performersResponse.data || []);
      setEfficiencyReport(efficiencyResponse.data);
    } catch (error) {
      timeStatsLogger.error('加载工时统计失败', error as Error, {
        factoryId,
        timeRange,
      });
      const errorMessage = getErrorMsg(error) || '无法加载工时统计，请稍后重试';
      Alert.alert('加载失败', errorMessage);

      // 清空数据（不使用降级）
      setDailyStats(null);
      setWeeklyStats(null);
      setMonthlyStats(null);
      setTopPerformers([]);
      setEfficiencyReport(null);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [timeRange])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  /**
   * 获取当前选中的统计数据
   */
  const getCurrentStats = () => {
    switch (timeRange) {
      case 'daily':
        return dailyStats;
      case 'weekly':
        return weeklyStats;
      case 'monthly':
        return monthlyStats;
      default:
        return null;
    }
  };

  /**
   * 格式化工时
   */
  const formatHours = (hours: number): string => {
    if (!hours) return `0${t('common.units.hour')}`;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}${t('common.units.hour')}${m}${t('common.units.minute')}` : `${h}${t('common.units.hour')}`;
  };

  /**
   * 获取统计概览数据
   */
  const getStatsOverview = () => {
    const stats = getCurrentStats();
    if (!stats) {
      return {
        totalHours: 0,
        regularHours: 0,
        overtimeHours: 0,
        totalEmployees: 0,
        avgHoursPerEmployee: 0,
      };
    }

    return {
      totalHours: stats.totalHours || 0,
      regularHours: stats.regularHours || 0,
      overtimeHours: stats.overtimeHours || 0,
      totalEmployees: stats.totalEmployees || stats.employeeCount || 0,
      avgHoursPerEmployee: stats.avgHoursPerEmployee || stats.averageHours || 0,
    };
  };

  const statsOverview = getStatsOverview();

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('attendance.timeStats.title')} />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* 时间范围选择 */}
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <SegmentedButtons
              value={timeRange}
              onValueChange={(value) => setTimeRange(value as 'daily' | 'weekly' | 'monthly')}
              buttons={[
                { value: 'daily', label: t('attendance.timeStats.periods.daily') },
                { value: 'weekly', label: t('attendance.timeStats.periods.weekly') },
                { value: 'monthly', label: t('attendance.timeStats.periods.monthly') },
              ]}
            />
          </Card.Content>
        </Card>

        {/* 统计概览 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title={t('attendance.timeStats.overview')} />
          <Card.Content>
            {loading ? (
              <View style={styles.statsRow}>
                <Text variant="bodyMedium" style={{ color: '#999' }}>
                  {t('attendance.timeStats.loading')}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text variant="headlineMedium" style={styles.statValue}>
                      {formatHours(statsOverview.totalHours)}
                    </Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      {t('attendance.timeStats.totalHours')}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="headlineMedium" style={[styles.statValue, { color: '#4CAF50' }]}>
                      {formatHours(statsOverview.regularHours)}
                    </Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      {t('attendance.timeStats.regularHours')}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="headlineMedium" style={[styles.statValue, { color: '#FF9800' }]}>
                      {formatHours(statsOverview.overtimeHours)}
                    </Text>
                    <Text variant="bodySmall" style={styles.statLabel}>
                      {t('attendance.timeStats.overtimeHours')}
                    </Text>
                  </View>
                </View>
                <View style={styles.statsDetailRow}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>{t('attendance.timeStats.employeeCount')}:</Text>
                    <Text style={styles.detailValue}>{statsOverview.totalEmployees}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>{t('attendance.timeStats.avgHoursPerEmployee')}:</Text>
                    <Text style={styles.detailValue}>{formatHours(statsOverview.avgHoursPerEmployee)}</Text>
                  </View>
                </View>
              </>
            )}
          </Card.Content>
        </Card>

        {/* 效率分析 */}
        {efficiencyReport && (
          <Card style={styles.card} mode="elevated">
            <Card.Title title={t('attendance.timeStats.efficiencyAnalysis')} />
            <Card.Content>
              <View style={styles.efficiencyRow}>
                <View style={styles.efficiencyItem}>
                  <Text style={styles.efficiencyLabel}>{t('attendance.timeStats.attendanceRate')}</Text>
                  <Text style={[styles.efficiencyValue, { color: '#4CAF50' }]}>
                    {(efficiencyReport.attendanceRate * 100).toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.efficiencyItem}>
                  <Text style={styles.efficiencyLabel}>{t('attendance.timeStats.productivityRate')}</Text>
                  <Text style={[styles.efficiencyValue, { color: '#2196F3' }]}>
                    {(efficiencyReport.productivityRate * 100).toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.efficiencyItem}>
                  <Text style={styles.efficiencyLabel}>{t('attendance.timeStats.overtimeRate')}</Text>
                  <Text style={[styles.efficiencyValue, { color: '#FF9800' }]}>
                    {(efficiencyReport.overtimeRate * 100).toFixed(1)}%
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* 绩效排行榜 */}
        {topPerformers.length > 0 && (
          <Card style={styles.card} mode="elevated">
            <Card.Title title={`${t('attendance.timeStats.performanceRanking')} (${t('attendance.timeStats.topPerformers')})`} />
            <Card.Content>
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title>{t('common.table.rank')}</DataTable.Title>
                  <DataTable.Title>{t('common.table.employee')}</DataTable.Title>
                  <DataTable.Title numeric>{t('common.table.workHours')}</DataTable.Title>
                  <DataTable.Title numeric>{t('common.table.efficiency')}</DataTable.Title>
                </DataTable.Header>
                {topPerformers.slice(0, 10).map((performer, index) => (
                  <DataTable.Row key={performer.employeeId || index}>
                    <DataTable.Cell>
                      <Chip
                        mode="flat"
                        style={{
                          backgroundColor:
                            index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#E0E0E0',
                        }}
                      >
                        {index + 1}
                      </Chip>
                    </DataTable.Cell>
                    <DataTable.Cell>{performer.employeeName || `${t('common.employee')}${performer.employeeId}`}</DataTable.Cell>
                    <DataTable.Cell numeric>{formatHours(performer.totalHours)}</DataTable.Cell>
                    <DataTable.Cell numeric>
                      {performer.efficiency ? `${(performer.efficiency * 100).toFixed(0)}%` : 'N/A'}
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            </Card.Content>
          </Card>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
  card: {
    margin: 16,
    marginBottom: 0,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
  },
  statsDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#212121',
  },
  efficiencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  efficiencyItem: {
    alignItems: 'center',
  },
  efficiencyLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  efficiencyValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  bottomPadding: {
    height: 80,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
