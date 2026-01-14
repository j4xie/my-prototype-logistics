import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Chip,
  DataTable,
  ActivityIndicator,
  Divider,
  Surface,
  SegmentedButtons,
  Button,
  IconButton,
  ProgressBar,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '../../store/authStore';
import { processingApiClient } from '../../services/api/processingApiClient';
import { reportApiClient, RealtimeData, CapacityUtilizationReport } from '../../services/api/reportApiClient';
import { getFactoryId } from '../../types/auth';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { ReportStackParamList } from '../../types/navigation';

// 创建ProductionReport专用logger
const productionReportLogger = logger.createContextLogger('ProductionReport');

/**
 * 生产报表页面
 * 集成数据来源:
 * - processingApiClient: 加工批次数据、生产统计
 *
 * 展示内容:
 * - 生产总量统计
 * - 批次完成情况
 * - 日/周/月生产趋势
 */
type NavigationProp = NativeStackNavigationProp<ReportStackParamList>;

// 主标签类型
type MainTab = 'overview' | 'realtime' | 'capacity';

export default function ProductionReportScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const { t } = useTranslation('reports');

  // 主标签状态
  const [mainTab, setMainTab] = useState<MainTab>('overview');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('week'); // day, week, month

  // 数据状态
  const [productionStats, setProductionStats] = useState<any>(null);
  const [recentBatches, setRecentBatches] = useState<any[]>([]);

  // 实时监控数据状态
  const [realtimeData, setRealtimeData] = useState<RealtimeData | null>(null);
  const [realtimeLoading, setRealtimeLoading] = useState(false);

  // 产能利用数据状态
  const [capacityData, setCapacityData] = useState<CapacityUtilizationReport | null>(null);
  const [capacityLoading, setCapacityLoading] = useState(false);

  /**
   * 加载生产数据
   */
  const loadProductionData = async () => {
    setLoading(true);
    try {
      const factoryId = getFactoryId(user);

      if (!factoryId) {
        Alert.alert(t('production.error'), t('production.cannotGetFactoryInfo'));
        return;
      }

      productionReportLogger.debug('加载生产报表数据', { timeRange, factoryId });

      // 加载最近的批次列表
      const batchesResponse = await processingApiClient.getBatches({
        page: 1,
        size: 10,
        status: 'completed', // 只看已完成的批次
        factoryId: factoryId
      });

      if (batchesResponse.success && batchesResponse.data) {
        const batches = batchesResponse.data.content || batchesResponse.data || [];
        setRecentBatches(Array.isArray(batches) ? batches : []);

        // 计算统计数据
        const stats = calculateProductionStats(batches);
        setProductionStats(stats);

        productionReportLogger.info('生产报表数据加载成功', {
          batchCount: batches.length,
          totalOutput: stats.totalOutput,
          completionRate: stats.completionRate.toFixed(1) + '%',
          factoryId,
        });
      } else {
        productionReportLogger.warn('获取生产数据失败', {
          message: batchesResponse.message,
          factoryId,
        });
        setRecentBatches([]);
        setProductionStats(null);
      }
    } catch (error) {
      productionReportLogger.error('加载生产报表失败', error as Error, {
        factoryId: getFactoryId(user),
        timeRange,
      });
      handleError(error, {
        title: t('production.loadFailed'),
        customMessage: t('production.loadProductionDataFailed'),
      });
      setRecentBatches([]);
      setProductionStats(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载实时监控数据
   */
  const loadRealtimeData = async () => {
    setRealtimeLoading(true);
    try {
      const factoryId = getFactoryId(user);
      if (!factoryId) {
        productionReportLogger.warn('无法获取工厂ID');
        return;
      }

      productionReportLogger.debug('加载实时监控数据', { factoryId });
      const response = await reportApiClient.getRealtimeData(factoryId);
      // 解包嵌套的响应格式 {code, message, data}
      const actualData = (response as any)?.data ?? response;
      setRealtimeData(actualData);
      productionReportLogger.info('实时监控数据加载成功', {
        runningPlans: actualData.runningPlans,
        todayOutput: actualData.todayOutput,
      });
    } catch (error) {
      productionReportLogger.error('加载实时监控数据失败', error as Error);
      // 静默处理，不弹窗
    } finally {
      setRealtimeLoading(false);
    }
  };

  /**
   * 加载产能利用数据
   */
  const loadCapacityData = async () => {
    setCapacityLoading(true);
    try {
      const factoryId = getFactoryId(user);
      if (!factoryId) {
        productionReportLogger.warn('无法获取工厂ID');
        return;
      }

      // 计算日期范围：最近7天
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const formatDate = (date: Date): string => {
        return date.toISOString().split('T')[0] ?? '';
      };

      productionReportLogger.debug('加载产能利用数据', {
        factoryId,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
      });

      const response = await reportApiClient.getCapacityUtilizationReport({
        factoryId,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
      });
      // 解包嵌套的响应格式 {code, message, data}
      const actualData = (response as any)?.data ?? response;
      setCapacityData(actualData);
      productionReportLogger.info('产能利用数据加载成功', {
        overallUtilization: actualData.overallUtilization,
        lineCount: actualData.utilizationByLine?.length ?? 0,
      });
    } catch (error) {
      productionReportLogger.error('加载产能利用数据失败', error as Error);
      // 静默处理，不弹窗
    } finally {
      setCapacityLoading(false);
    }
  };

  /**
   * 计算生产统计
   */
  const calculateProductionStats = (batches: any[]) => {
    const totalBatches = batches.length;
    const totalOutput = batches.reduce((sum, batch) => {
      const output = batch.actualOutput || batch.targetOutput || 0;
      return sum + output;
    }, 0);

    const completedBatches = batches.filter(
      (b) => b.status === 'completed' || b.status === 'COMPLETED'
    ).length;

    const avgOutput = totalBatches > 0 ? totalOutput / totalBatches : 0;

    // 计算合格率（如果有质检数据）
    const batchesWithQuality = batches.filter((b) => b.qualityRate !== undefined);
    const avgQualityRate =
      batchesWithQuality.length > 0
        ? batchesWithQuality.reduce((sum, b) => sum + (b.qualityRate || 0), 0) /
          batchesWithQuality.length
        : null;

    return {
      totalBatches,
      totalOutput,
      completedBatches,
      avgOutput,
      avgQualityRate,
      completionRate: totalBatches > 0 ? (completedBatches / totalBatches) * 100 : 0,
    };
  };

  /**
   * 刷新数据
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    if (mainTab === 'overview') {
      await loadProductionData();
    } else if (mainTab === 'realtime') {
      await loadRealtimeData();
    } else if (mainTab === 'capacity') {
      await loadCapacityData();
    }
    setRefreshing(false);
  };

  /**
   * 获取当前Tab的刷新函数
   */
  const getCurrentTabRefreshFn = () => {
    if (mainTab === 'overview') return loadProductionData;
    if (mainTab === 'realtime') return loadRealtimeData;
    if (mainTab === 'capacity') return loadCapacityData;
    return loadProductionData;
  };

  /**
   * 页面聚焦时加载数据
   */
  useFocusEffect(
    useCallback(() => {
      if (mainTab === 'overview') {
        loadProductionData();
      } else if (mainTab === 'realtime') {
        loadRealtimeData();
      } else if (mainTab === 'capacity') {
        loadCapacityData();
      }
    }, [timeRange, mainTab])
  );

  /**
   * 格式化数量
   */
  const formatQuantity = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(2);
  };

  /**
   * 获取状态标签
   */
  const getStatusChip = (status: string) => {
    const statusMap: Record<
      string,
      { label: string; color: string; bgColor: string }
    > = {
      completed: { label: t('status.completed'), color: '#4CAF50', bgColor: '#E8F5E9' },
      COMPLETED: { label: t('status.completed'), color: '#4CAF50', bgColor: '#E8F5E9' },
      in_progress: { label: t('status.inProgress'), color: '#2196F3', bgColor: '#E3F2FD' },
      pending: { label: t('status.pending'), color: '#FF9800', bgColor: '#FFF3E0' },
      cancelled: { label: t('status.cancelled'), color: '#F44336', bgColor: '#FFEBEE' },
    };

    const config = statusMap[status] || statusMap['pending'] || { label: t('status.unknown'), color: '#666', bgColor: '#f5f5f5' };

    return (
      <Chip
        mode="flat"
        compact
        style={{ backgroundColor: config.bgColor }}
        textStyle={{ color: config.color, fontSize: 12 }}
      >
        {config.label}
      </Chip>
    );
  };

  /**
   * 渲染概览标签内容
   */
  const renderOverviewTab = () => (
    <>
      {/* 时间范围选择 */}
      <Surface style={styles.timeRangeCard} elevation={1}>
        <Text variant="bodyMedium" style={styles.sectionLabel}>
          {t('production.timeRange')}
        </Text>
        <SegmentedButtons
          value={timeRange}
          onValueChange={setTimeRange}
          buttons={[
            { value: 'day', label: t('production.today') },
            { value: 'week', label: t('production.thisWeek') },
            { value: 'month', label: t('production.thisMonth') },
          ]}
          style={styles.segmentedButtons}
        />
      </Surface>

      {/* 统计概览 */}
      <Surface style={styles.statsCard} elevation={1}>
        <Text variant="titleMedium" style={styles.statsTitle}>
          {t('production.productionStats')}
        </Text>
        <Divider style={styles.divider} />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </View>
        ) : productionStats ? (
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{productionStats.totalBatches}</Text>
              <Text style={styles.statLabel}>{t('production.productionBatches')}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                {formatQuantity(productionStats.totalOutput)}
              </Text>
              <Text style={styles.statLabel}>{t('production.totalOutput')}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: '#2196F3' }]}>
                {(productionStats.completionRate ?? 0).toFixed(1)}%
              </Text>
              <Text style={styles.statLabel}>{t('production.completionRate')}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: '#FF9800' }]}>
                {formatQuantity(productionStats.avgOutput)}
              </Text>
              <Text style={styles.statLabel}>{t('production.avgOutput')}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('production.noStatsData')}</Text>
          </View>
        )}
      </Surface>

      {/* 最近批次列表 */}
      <Card style={styles.card} mode="elevated">
        <Card.Title title={t('production.recentCompletedBatches')} titleVariant="titleMedium" />
        <DataTable>
          <DataTable.Header>
            <DataTable.Title>{t('production.batchNumber')}</DataTable.Title>
            <DataTable.Title>{t('production.product')}</DataTable.Title>
            <DataTable.Title numeric>{t('production.output')}</DataTable.Title>
            <DataTable.Title>{t('production.status')}</DataTable.Title>
          </DataTable.Header>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" />
            </View>
          ) : recentBatches.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text variant="bodyMedium" style={styles.emptyText}>
                {t('production.noBatchRecords')}
              </Text>
            </View>
          ) : (
            recentBatches.slice(0, 10).map((batch, index) => (
              <DataTable.Row key={batch.id || index}>
                <DataTable.Cell>
                  <Text variant="bodySmall">{batch.batchNumber || `批次${batch.id}`}</Text>
                </DataTable.Cell>
                <DataTable.Cell>
                  <Text variant="bodySmall">
                    {batch.productTypeName || batch.productType || '-'}
                  </Text>
                </DataTable.Cell>
                <DataTable.Cell numeric>
                  <Text variant="bodySmall">
                    {formatQuantity(batch.actualOutput || batch.targetOutput)}
                  </Text>
                </DataTable.Cell>
                <DataTable.Cell>{getStatusChip(batch.status)}</DataTable.Cell>
              </DataTable.Row>
            ))
          )}
        </DataTable>
      </Card>
    </>
  );

  /**
   * 渲染实时监控标签内容 - 使用API数据
   */
  const renderRealtimeTab = () => {
    const getStatusColor = (status: string) => {
      return status === 'running' ? '#4CAF50' : status === 'stopped' ? '#F44336' : '#FF9800';
    };

    // 计算设备统计
    const runningEquipment = realtimeData?.equipmentStatus?.['running'] ?? 0;
    const stoppedEquipment = realtimeData?.equipmentStatus?.['stopped'] ?? 0;
    const maintenanceEquipment = realtimeData?.equipmentStatus?.['maintenance'] ?? 0;
    const totalEquipment = runningEquipment + stoppedEquipment + maintenanceEquipment;

    if (realtimeLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      );
    }

    if (!realtimeData) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>暂无实时监控数据</Text>
          <Button mode="outlined" onPress={loadRealtimeData} style={{ marginTop: 16 }}>
            重新加载
          </Button>
        </View>
      );
    }

    return (
      <View style={styles.realtimeContainer}>
        {/* 实时产量概览 */}
        <Surface style={styles.realtimeCard} elevation={1}>
          <Text variant="titleMedium" style={styles.statsTitle}>
            实时产量监控
          </Text>
          <Divider style={styles.divider} />

          {/* 当前产量 */}
          <View style={styles.realtimeMainStats}>
            <View style={styles.realtimeMainItem}>
              <Text style={styles.realtimeMainValue}>{realtimeData.todayOutput ?? 0}</Text>
              <Text style={styles.realtimeMainLabel}>今日产量</Text>
            </View>
            <View style={styles.realtimeMainItem}>
              <Text style={[styles.realtimeMainValue, { color: '#2196F3' }]}>{realtimeData.runningPlans ?? 0}</Text>
              <Text style={styles.realtimeMainLabel}>进行中计划</Text>
            </View>
            <View style={styles.realtimeMainItem}>
              <Text style={[styles.realtimeMainValue, { color: totalEquipment > 0 ? '#4CAF50' : '#999' }]}>
                {totalEquipment > 0 ? ((runningEquipment / totalEquipment) * 100).toFixed(1) : 0}%
              </Text>
              <Text style={styles.realtimeMainLabel}>设备运行率</Text>
            </View>
          </View>

          {/* 设备状态概览 */}
          <Divider style={styles.divider} />
          <View style={styles.realtimeStatusRow}>
            <View style={styles.realtimeStatusItem}>
              <IconButton icon="play-circle" size={20} iconColor="#4CAF50" />
              <Text style={styles.realtimeStatusText}>
                运行中: {runningEquipment}
              </Text>
            </View>
            <View style={styles.realtimeStatusItem}>
              <IconButton icon="stop-circle" size={20} iconColor="#F44336" />
              <Text style={styles.realtimeStatusText}>
                已停止: {stoppedEquipment}
              </Text>
            </View>
            <View style={styles.realtimeStatusItem}>
              <IconButton icon="wrench" size={20} iconColor="#FF9800" />
              <Text style={styles.realtimeStatusText}>
                维护中: {maintenanceEquipment}
              </Text>
            </View>
          </View>
        </Surface>

        {/* 设备状态详情 */}
        <Surface style={styles.realtimeCard} elevation={1}>
          <Text variant="titleMedium" style={styles.statsTitle}>
            设备状态汇总
          </Text>
          <Divider style={styles.divider} />
          <View style={styles.lineStatusList}>
            {Object.entries(realtimeData.equipmentStatus ?? {}).map(([status, count], index) => {
              const statusLabels: Record<string, string> = {
                running: '运行中',
                stopped: '已停止',
                maintenance: '维护中',
                idle: '空闲',
              };
              const statusColors: Record<string, string> = {
                running: '#4CAF50',
                stopped: '#F44336',
                maintenance: '#FF9800',
                idle: '#9E9E9E',
              };
              return (
                <View key={status} style={styles.lineStatusItem}>
                  <View style={styles.lineStatusLeft}>
                    <View style={[styles.lineStatusDot, { backgroundColor: statusColors[status] ?? '#666' }]} />
                    <Text style={styles.lineStatusName}>{statusLabels[status] ?? status}</Text>
                    <Chip
                      mode="flat"
                      compact
                      style={{ backgroundColor: status === 'running' ? '#E8F5E9' : status === 'stopped' ? '#FFEBEE' : '#FFF3E0' }}
                      textStyle={{ color: statusColors[status] ?? '#666', fontSize: 10 }}
                    >
                      {count} 台
                    </Chip>
                  </View>
                  <Text style={styles.lineStatusOutput}>
                    {totalEquipment > 0 ? ((count / totalEquipment) * 100).toFixed(1) : 0}%
                  </Text>
                </View>
              );
            })}
          </View>
        </Surface>
      </View>
    );
  };

  /**
   * 渲染产能利用标签内容 - 使用API数据
   */
  const renderCapacityTab = () => {
    const getUtilizationColor = (utilization: number) => {
      if (utilization >= 80) return '#4CAF50';
      if (utilization >= 60) return '#FF9800';
      return '#F44336';
    };

    if (capacityLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      );
    }

    if (!capacityData) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>暂无产能利用数据</Text>
          <Button mode="outlined" onPress={loadCapacityData} style={{ marginTop: 16 }}>
            重新加载
          </Button>
        </View>
      );
    }

    // 计算总产能和实际产出
    const totalPlannedCapacity = capacityData.utilizationByLine?.reduce(
      (sum, line) => sum + (line.plannedCapacity ?? 0),
      0
    ) ?? 0;
    const totalActualOutput = capacityData.utilizationByLine?.reduce(
      (sum, line) => sum + (line.actualOutput ?? 0),
      0
    ) ?? 0;

    // 计算时间分配（基于整体利用率估算）
    const overallUtilization = capacityData.overallUtilization ?? 0;
    const idleTime = Math.max(0, 100 - overallUtilization);

    return (
      <View style={styles.capacityContainer}>
        {/* 产能利用率概览 */}
        <Surface style={styles.capacityCard} elevation={1}>
          <Text variant="titleMedium" style={styles.statsTitle}>
            产能利用率分析
          </Text>
          <Divider style={styles.divider} />

          {/* 总体利用率 */}
          <View style={styles.capacityMainSection}>
            <View style={styles.capacityGauge}>
              <Text style={[styles.capacityMainValue, { color: getUtilizationColor(overallUtilization) }]}>
                {overallUtilization.toFixed(1)}%
              </Text>
              <Text style={styles.capacityMainLabel}>整体利用率</Text>
            </View>
            <View style={styles.capacityDetails}>
              <View style={styles.capacityDetailRow}>
                <Text style={styles.capacityDetailLabel}>计划产能</Text>
                <Text style={styles.capacityDetailValue}>{totalPlannedCapacity}</Text>
              </View>
              <View style={styles.capacityDetailRow}>
                <Text style={styles.capacityDetailLabel}>实际产出</Text>
                <Text style={[styles.capacityDetailValue, { color: '#4CAF50' }]}>{totalActualOutput}</Text>
              </View>
            </View>
          </View>

          {/* 时间分配 */}
          <Divider style={styles.divider} />
          <Text variant="bodyMedium" style={styles.capacitySectionTitle}>时间分配</Text>
          <View style={styles.timeDistribution}>
            <View style={[styles.timeBlock, { backgroundColor: '#E8F5E9', flex: Math.max(1, overallUtilization) }]}>
              <Text style={[styles.timeBlockText, { color: '#4CAF50' }]}>生产 {overallUtilization.toFixed(1)}%</Text>
            </View>
            {idleTime > 0 && (
              <View style={[styles.timeBlock, { backgroundColor: '#FFEBEE', flex: Math.max(1, idleTime) }]}>
                <Text style={[styles.timeBlockText, { color: '#F44336' }]}>空闲</Text>
              </View>
            )}
          </View>
          <View style={styles.timeLegend}>
            <View style={styles.timeLegendItem}>
              <View style={[styles.timeLegendDot, { backgroundColor: '#E8F5E9' }]} />
              <Text style={styles.timeLegendText}>生产 {overallUtilization.toFixed(1)}%</Text>
            </View>
            <View style={styles.timeLegendItem}>
              <View style={[styles.timeLegendDot, { backgroundColor: '#FFEBEE' }]} />
              <Text style={styles.timeLegendText}>空闲 {idleTime.toFixed(1)}%</Text>
            </View>
          </View>
        </Surface>

        {/* 各生产线产能详情 */}
        <Surface style={styles.capacityCard} elevation={1}>
          <Text variant="titleMedium" style={styles.statsTitle}>
            生产线产能详情
          </Text>
          <Divider style={styles.divider} />
          <View style={styles.equipmentCapacityList}>
            {(capacityData.utilizationByLine ?? []).length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>暂无生产线数据</Text>
              </View>
            ) : (
              capacityData.utilizationByLine.map((line) => (
                <View key={line.lineId} style={styles.equipmentCapacityItem}>
                  <View style={styles.equipmentCapacityHeader}>
                    <Text style={styles.equipmentName}>{line.lineName ?? line.lineId}</Text>
                    <Text style={[styles.equipmentUtilization, { color: getUtilizationColor(line.utilization ?? 0) }]}>
                      {(line.utilization ?? 0).toFixed(1)}%
                    </Text>
                  </View>
                  <ProgressBar
                    progress={(line.utilization ?? 0) / 100}
                    color={getUtilizationColor(line.utilization ?? 0)}
                    style={styles.equipmentProgressBar}
                  />
                  <Text style={styles.equipmentCapacityText}>
                    产出: {line.actualOutput ?? 0} / 产能: {line.plannedCapacity ?? 0}
                  </Text>
                </View>
              ))
            )}
          </View>
        </Surface>
      </View>
    );
  };

  /**
   * 渲染当前标签内容
   */
  const renderTabContent = () => {
    switch (mainTab) {
      case 'overview':
        return renderOverviewTab();
      case 'realtime':
        return renderRealtimeTab();
      case 'capacity':
        return renderCapacityTab();
      default:
        return renderOverviewTab();
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="生产监控" />
        <Appbar.Action icon="refresh" onPress={getCurrentTabRefreshFn()} />
      </Appbar.Header>

      {/* 主标签切换 */}
      <Surface style={styles.mainTabContainer} elevation={2}>
        <SegmentedButtons
          value={mainTab}
          onValueChange={(value) => setMainTab(value as MainTab)}
          buttons={[
            { value: 'overview', label: '生产概览', icon: 'chart-box' },
            { value: 'realtime', label: '实时监控', icon: 'pulse' },
            { value: 'capacity', label: '产能利用', icon: 'gauge' },
          ]}
          style={styles.mainTabButtons}
        />
      </Surface>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {renderTabContent()}
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
  mainTabContainer: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mainTabButtons: {
    // 默认样式即可
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
  statsCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  statsTitle: {
    fontWeight: '600',
    color: '#212121',
  },
  divider: {
    marginVertical: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 12,
    color: '#999',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statBox: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2196F3',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
  },
  card: {
    margin: 16,
    marginBottom: 0,
    marginTop: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
  },
  bottomPadding: {
    height: 80,
  },
  // 快速访问卡片样式
  quickAccessCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    margin: 16,
  },
  quickAccessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickAccessIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  quickAccessIcon: {
    margin: 0,
  },
  quickAccessInfo: {
    flex: 1,
  },
  quickAccessTitle: {
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  quickAccessDesc: {
    color: '#666',
    lineHeight: 18,
  },
  quickAccessDivider: {
    marginVertical: 16,
  },
  quickAccessFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  featureItem: {
    alignItems: 'center',
  },
  quickAccessButton: {
    borderRadius: 8,
  },
  quickAccessButtonContent: {
    paddingVertical: 6,
    flexDirection: 'row-reverse',
  },
  // 实时监控Tab样式
  realtimeContainer: {
    padding: 16,
    gap: 16,
  },
  realtimeCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  realtimeMainStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  realtimeMainItem: {
    alignItems: 'center',
  },
  realtimeMainValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4CAF50',
  },
  realtimeMainLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  realtimeStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  realtimeStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  realtimeStatusText: {
    fontSize: 12,
    color: '#666',
  },
  lineStatusList: {
    gap: 12,
  },
  lineStatusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  lineStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lineStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lineStatusName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  lineStatusOutput: {
    fontSize: 14,
    color: '#666',
  },
  // 产能利用Tab样式
  capacityContainer: {
    padding: 16,
    gap: 16,
  },
  capacityCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  capacityMainSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  capacityGauge: {
    alignItems: 'center',
  },
  capacityMainValue: {
    fontSize: 42,
    fontWeight: '700',
  },
  capacityMainLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  capacityDetails: {
    gap: 8,
  },
  capacityDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 140,
  },
  capacityDetailLabel: {
    fontSize: 13,
    color: '#666',
  },
  capacityDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  capacitySectionTitle: {
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  timeDistribution: {
    flexDirection: 'row',
    height: 24,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  timeBlock: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeBlockText: {
    fontSize: 10,
    fontWeight: '600',
  },
  timeLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  timeLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timeLegendText: {
    fontSize: 11,
    color: '#666',
  },
  equipmentCapacityList: {
    gap: 16,
  },
  equipmentCapacityItem: {
    marginBottom: 4,
  },
  equipmentCapacityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  equipmentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  equipmentUtilization: {
    fontSize: 16,
    fontWeight: '700',
  },
  equipmentProgressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  equipmentCapacityText: {
    fontSize: 11,
    color: '#999',
  },
});
