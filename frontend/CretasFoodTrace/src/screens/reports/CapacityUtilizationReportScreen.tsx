import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Chip,
  ActivityIndicator,
  Divider,
  Surface,
  SegmentedButtons,
  ProgressBar,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { reportApiClient } from '../../services/api/reportApiClient';
import { getFactoryId } from '../../types/auth';
import { getErrorMsg } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建CapacityUtilizationReport专用logger
const capacityReportLogger = logger.createContextLogger('CapacityUtilizationReport');

// 目标利用率
const TARGET_UTILIZATION = 80;

// 实际API响应类型 (基于用户提供的结构)
interface CapacityUtilizationReportDTO {
  factoryId: string;
  startDate: string;
  endDate: string;
  totalEquipment: number;
  averageUtilization: number;
  utilizationTarget: number;
  equipmentUtilization: Array<{
    equipmentId: number;
    equipmentName: string;
    utilization: number;
    status: string; // running, maintenance, idle, inactive
  }>;
  dailyUtilization: Array<{
    date: string;
    utilization: number;
    output: number;
    dayOfWeek: number;
    weekOfYear: number;
  }>;
}

/**
 * 产能利用率报表页面
 *
 * 展示内容:
 * - 总览统计: 总设备数、平均利用率、目标利用率
 * - 设备利用率列表 (带进度条和状态标签)
 * - 每日利用率趋势 (简化文本列表)
 */
export default function CapacityUtilizationReportScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { t } = useTranslation('reports');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('week');

  // 数据状态
  const [reportData, setReportData] = useState<CapacityUtilizationReportDTO | null>(null);

  /**
   * 计算日期范围
   */
  const getDateRange = useCallback(() => {
    const endDate = new Date();
    const startDate = new Date();

    if (timeRange === 'day') {
      // 当天
      startDate.setHours(0, 0, 0, 0);
    } else if (timeRange === 'week') {
      startDate.setDate(endDate.getDate() - 7);
    } else if (timeRange === 'month') {
      startDate.setMonth(endDate.getMonth() - 1);
    }

    return {
      startDate: startDate.toISOString().split('T')[0] as string,
      endDate: endDate.toISOString().split('T')[0] as string,
    };
  }, [timeRange]);

  /**
   * 加载产能利用率数据
   */
  const loadData = async () => {
    setLoading(true);
    try {
      const factoryId = getFactoryId(user);

      if (!factoryId) {
        Alert.alert('错误', '无法获取工厂信息');
        return;
      }

      const { startDate, endDate } = getDateRange();

      capacityReportLogger.debug('加载产能利用率数据', { timeRange, factoryId, startDate, endDate });

      const response = await reportApiClient.getCapacityUtilizationReport({
        factoryId,
        startDate,
        endDate,
      });

      if (response) {
        // 类型断言为实际API响应类型
        setReportData(response as unknown as CapacityUtilizationReportDTO);
        capacityReportLogger.info('产能利用率数据加载成功', {
          factoryId,
          totalEquipment: (response as unknown as CapacityUtilizationReportDTO).totalEquipment,
          averageUtilization: (response as unknown as CapacityUtilizationReportDTO).averageUtilization,
        });
      } else {
        capacityReportLogger.warn('获取产能利用率数据失败', { factoryId });
        setReportData(null);
      }
    } catch (error) {
      capacityReportLogger.error('加载产能利用率报表失败', error as Error, {
        factoryId: getFactoryId(user),
        timeRange,
      });
      const errorMessage = getErrorMsg(error) || '加载产能利用率数据失败';
      Alert.alert('加载失败', errorMessage);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 刷新数据
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  /**
   * 页面聚焦时加载数据
   */
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [timeRange])
  );

  /**
   * 获取利用率状态颜色
   */
  const getUtilizationColor = (value: number): string => {
    const target = reportData?.utilizationTarget || TARGET_UTILIZATION;
    if (value >= target) return '#4CAF50';
    if (value >= target * 0.7) return '#FF9800';
    return '#F44336';
  };

  /**
   * 获取利用率状态标签
   */
  const getUtilizationLabel = (value: number): string => {
    const target = reportData?.utilizationTarget || TARGET_UTILIZATION;
    if (value >= target) return '达标';
    if (value >= target * 0.7) return '接近';
    return '待改善';
  };

  /**
   * 获取设备状态颜色
   */
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'running':
        return '#4CAF50'; // 绿色
      case 'maintenance':
        return '#FF9800'; // 橙色
      case 'idle':
        return '#9E9E9E'; // 灰色
      case 'inactive':
        return '#F44336'; // 红色
      default:
        return '#9E9E9E';
    }
  };

  /**
   * 获取设备状态标签
   */
  const getStatusLabel = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'running':
        return '运行中';
      case 'maintenance':
        return '维护中';
      case 'idle':
        return '空闲';
      case 'inactive':
        return '停机';
      default:
        return status;
    }
  };

  /**
   * 格式化日期标签
   */
  const formatDateLabel = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } catch {
      return dateString.slice(-5);
    }
  };

  /**
   * 获取星期几名称
   */
  const getDayOfWeekName = (dayOfWeek: number): string => {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[dayOfWeek] || '';
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="产能利用率" />
        <Appbar.Action icon="refresh" onPress={loadData} />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* 时间范围选择 */}
        <Surface style={styles.timeRangeCard} elevation={1}>
          <Text variant="bodyMedium" style={styles.sectionLabel}>
            时间范围
          </Text>
          <SegmentedButtons
            value={timeRange}
            onValueChange={setTimeRange}
            buttons={[
              { value: 'day', label: '今日' },
              { value: 'week', label: '近7天' },
              { value: 'month', label: '近30天' },
            ]}
            style={styles.segmentedButtons}
          />
        </Surface>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : reportData ? (
          <>
            {/* 总览统计卡片 */}
            <Surface style={styles.overviewCard} elevation={1}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                总览统计
              </Text>
              <Divider style={styles.divider} />

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{reportData.totalEquipment ?? 0}</Text>
                  <Text style={styles.statLabel}>总设备数</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text
                    style={[
                      styles.statValue,
                      { color: getUtilizationColor(reportData.averageUtilization ?? 0) },
                    ]}
                  >
                    {(reportData.averageUtilization ?? 0).toFixed(1)}%
                  </Text>
                  <Text style={styles.statLabel}>平均利用率</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {reportData.utilizationTarget || TARGET_UTILIZATION}%
                  </Text>
                  <Text style={styles.statLabel}>目标利用率</Text>
                </View>
              </View>

              {/* 利用率进度条 */}
              <View style={styles.mainProgressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>当前利用率</Text>
                  <Chip
                    mode="flat"
                    style={[
                      styles.statusChip,
                      { backgroundColor: `${getUtilizationColor(reportData.averageUtilization ?? 0)}20` },
                    ]}
                    textStyle={[
                      styles.statusChipText,
                      { color: getUtilizationColor(reportData.averageUtilization ?? 0) },
                    ]}
                  >
                    {getUtilizationLabel(reportData.averageUtilization ?? 0)}
                  </Chip>
                </View>
                <ProgressBar
                  progress={(reportData.averageUtilization ?? 0) / 100}
                  color={getUtilizationColor(reportData.averageUtilization ?? 0)}
                  style={styles.mainProgressBar}
                />
                <View style={styles.progressMarkers}>
                  <Text style={styles.markerText}>0%</Text>
                  <Text style={styles.markerText}>
                    目标: {reportData.utilizationTarget || TARGET_UTILIZATION}%
                  </Text>
                  <Text style={styles.markerText}>100%</Text>
                </View>
              </View>

              {/* 达标/差距提示 */}
              {(reportData.averageUtilization ?? 0) >= (reportData.utilizationTarget || TARGET_UTILIZATION) ? (
                <View style={styles.achievementBadge}>
                  <Text style={styles.achievementText}>
                    已达成目标 (+
                    {(
                      (reportData.averageUtilization ?? 0) -
                      (reportData.utilizationTarget || TARGET_UTILIZATION)
                    ).toFixed(1)}
                    %)
                  </Text>
                </View>
              ) : (
                <View style={styles.gapBadge}>
                  <Text style={styles.gapText}>
                    距目标差{' '}
                    {(
                      (reportData.utilizationTarget || TARGET_UTILIZATION) -
                      (reportData.averageUtilization ?? 0)
                    ).toFixed(1)}
                    %
                  </Text>
                </View>
              )}
            </Surface>

            {/* 设备利用率列表 */}
            {reportData.equipmentUtilization && reportData.equipmentUtilization.length > 0 && (
              <Card style={styles.card} mode="elevated">
                <Card.Title title="设备利用率明细" titleVariant="titleMedium" />
                <Card.Content>
                  {reportData.equipmentUtilization.map((equipment) => (
                    <View key={equipment.equipmentId} style={styles.equipmentItem}>
                      <View style={styles.equipmentHeader}>
                        <Text style={styles.equipmentName} numberOfLines={1}>
                          {equipment.equipmentName}
                        </Text>
                        <Chip
                          mode="flat"
                          compact
                          style={[
                            styles.equipmentStatusChip,
                            { backgroundColor: `${getStatusColor(equipment.status)}20` },
                          ]}
                          textStyle={[
                            styles.equipmentStatusText,
                            { color: getStatusColor(equipment.status) },
                          ]}
                        >
                          {getStatusLabel(equipment.status)}
                        </Chip>
                      </View>
                      <View style={styles.equipmentProgressRow}>
                        <ProgressBar
                          progress={(equipment.utilization ?? 0) / 100}
                          color={getUtilizationColor(equipment.utilization ?? 0)}
                          style={styles.equipmentProgressBar}
                        />
                        <Text
                          style={[
                            styles.equipmentUtilization,
                            { color: getUtilizationColor(equipment.utilization ?? 0) },
                          ]}
                        >
                          {(equipment.utilization ?? 0).toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </Card.Content>
              </Card>
            )}

            {/* 每日利用率趋势 */}
            {reportData.dailyUtilization && reportData.dailyUtilization.length > 0 && (
              <Surface style={styles.trendCard} elevation={1}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  每日利用率趋势
                </Text>
                <Divider style={styles.divider} />

                {reportData.dailyUtilization.slice(-7).map((day, index) => (
                  <View key={index} style={styles.dailyItem}>
                    <View style={styles.dailyLeft}>
                      <Text style={styles.dailyDate}>{formatDateLabel(day.date)}</Text>
                      <Text style={styles.dailyDayOfWeek}>
                        {getDayOfWeekName(day.dayOfWeek)}
                      </Text>
                    </View>
                    <View style={styles.dailyMiddle}>
                      <ProgressBar
                        progress={day.utilization / 100}
                        color={getUtilizationColor(day.utilization)}
                        style={styles.dailyProgressBar}
                      />
                    </View>
                    <View style={styles.dailyRight}>
                      <Text
                        style={[
                          styles.dailyUtilization,
                          { color: getUtilizationColor(day.utilization ?? 0) },
                        ]}
                      >
                        {(day.utilization ?? 0).toFixed(1)}%
                      </Text>
                      <Text style={styles.dailyOutput}>产出: {day.output}</Text>
                    </View>
                  </View>
                ))}

                {/* 图例说明 */}
                <View style={styles.legendContainer}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                    <Text style={styles.legendText}>达标</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
                    <Text style={styles.legendText}>接近目标</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#F44336' }]} />
                    <Text style={styles.legendText}>待改善</Text>
                  </View>
                </View>
              </Surface>
            )}

            {/* 状态图例 */}
            <Surface style={styles.statusLegendCard} elevation={1}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                设备状态说明
              </Text>
              <Divider style={styles.divider} />

              <View style={styles.statusLegendRow}>
                <View style={styles.statusLegendItem}>
                  <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
                  <Text style={styles.statusLegendText}>运行中</Text>
                </View>
                <View style={styles.statusLegendItem}>
                  <View style={[styles.statusDot, { backgroundColor: '#FF9800' }]} />
                  <Text style={styles.statusLegendText}>维护中</Text>
                </View>
                <View style={styles.statusLegendItem}>
                  <View style={[styles.statusDot, { backgroundColor: '#9E9E9E' }]} />
                  <Text style={styles.statusLegendText}>空闲</Text>
                </View>
                <View style={styles.statusLegendItem}>
                  <View style={[styles.statusDot, { backgroundColor: '#F44336' }]} />
                  <Text style={styles.statusLegendText}>停机</Text>
                </View>
              </View>
            </Surface>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无产能利用率数据</Text>
            <Text style={styles.emptySubtext}>请确认工厂已配置设备产能监控</Text>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
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
  timeRangeCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  sectionLabel: {
    color: '#666',
    marginBottom: 12,
    fontWeight: '500',
  },
  segmentedButtons: {
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  overviewCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#212121',
  },
  divider: {
    marginVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#212121',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  mainProgressContainer: {
    marginTop: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  statusChip: {
    height: 28,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  mainProgressBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
  },
  progressMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  markerText: {
    fontSize: 10,
    color: '#999',
  },
  achievementBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  achievementText: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 14,
  },
  gapBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  gapText: {
    color: '#FF9800',
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    margin: 16,
    marginBottom: 8,
  },
  equipmentItem: {
    marginBottom: 16,
  },
  equipmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  equipmentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
    flex: 1,
    marginRight: 8,
  },
  equipmentStatusChip: {
    height: 24,
  },
  equipmentStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  equipmentProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  equipmentProgressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  equipmentUtilization: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 55,
    textAlign: 'right',
  },
  trendCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  dailyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dailyLeft: {
    width: 60,
  },
  dailyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  dailyDayOfWeek: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  dailyMiddle: {
    flex: 1,
    paddingHorizontal: 12,
  },
  dailyProgressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  dailyRight: {
    width: 70,
    alignItems: 'flex-end',
  },
  dailyUtilization: {
    fontSize: 14,
    fontWeight: '600',
  },
  dailyOutput: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  statusLegendCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  statusLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusLegendText: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  bottomPadding: {
    height: 80,
  },
});
