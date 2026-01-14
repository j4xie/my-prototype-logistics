import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Surface,
  Divider,
  Icon,
  ActivityIndicator,
  ProgressBar,
  Chip,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { ReportScreenProps } from '../../types/navigation';
import { reportApiClient } from '../../services/api/reportApiClient';
import { dashboardAPI } from '../../services/api/dashboardApiClient';
import { wageApiClient } from '../../services/api/wageApiClient';
import type { LaborCostAnalysis } from '../../services/api/wageApiClient';
import { getFactoryId } from '../../types/auth';
import { logger } from '../../utils/logger';

const reportDashboardLogger = logger.createContextLogger('ReportDashboard');

/**
 * 数据分析中心 - 综合仪表盘
 * 直接展示各类报表的核心数据，无需再次跳转
 */
export default function ReportDashboardScreen() {
  const navigation = useNavigation<ReportScreenProps<'ReportDashboard'>['navigation']>();
  const { user } = useAuthStore();
  const { t } = useTranslation('reports');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 数据状态
  const [productionData, setProductionData] = useState<{
    totalBatches: number;
    completedBatches: number;
    completionRate: number;
    totalOutput: number;
  } | null>(null);

  const [qualityData, setQualityData] = useState<{
    totalInspected: number;
    passed: number;
    failed: number;
    passRate: number;
  } | null>(null);

  const [efficiencyData, setEfficiencyData] = useState<{
    equipmentOEE: number;
    equipmentUtilization: number;
    laborEfficiency: number;
    overallEfficiency: number;
  } | null>(null);

  const [costData, setCostData] = useState<{
    totalCost: number;
    materialCost: number;
    laborCost: number;
    overheadCost: number;
  } | null>(null);

  const [laborCostAnalysis, setLaborCostAnalysis] = useState<LaborCostAnalysis | null>(null);

  /**
   * 加载所有报表数据
   */
  const loadAllData = async () => {
    const rawFactoryId = getFactoryId(user);
    if (!rawFactoryId) {
      Alert.alert('错误', '无法获取工厂信息');
      setLoading(false);
      return;
    }
    // 确保 factoryId 是 string 类型
    const factoryId: string = rawFactoryId;

    // 计算日期范围（近7天）
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    const formatDate = (date: Date): string => {
      return date.toISOString().split('T')[0] ?? '';
    };

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    reportDashboardLogger.debug('加载综合报表数据', { factoryId, startDateStr, endDateStr });

    try {
      // 并行加载所有报表数据
      const [
        overviewRes,
        qualityRes,
        efficiencyRes,
        financeRes,
        equipmentRes,
        laborCostRes,
      ] = await Promise.all([
        // 生产概览数据 (使用 dashboardAPI)
        dashboardAPI.getDashboardOverview('week', factoryId)
          .then(res => res.success ? res.data : null)
          .catch((err) => {
            reportDashboardLogger.warn('获取生产概览失败', err);
            return null;
          }),
        // 质量数据 (使用 dashboardAPI)
        dashboardAPI.getQualityDashboard('month', factoryId)
          .then(res => res.success ? res.data : null)
          .catch((err) => {
            reportDashboardLogger.warn('获取质量数据失败', err);
            return null;
          }),
        // 效率数据 (使用 reportApiClient.getEfficiencyAnalysis)
        reportApiClient.getEfficiencyAnalysis({ factoryId, startDate: startDateStr, endDate: endDateStr })
          .catch((err) => {
            reportDashboardLogger.warn('获取效率数据失败', err);
            return null;
          }),
        // 成本数据 (使用 reportApiClient.getFinanceReport)
        reportApiClient.getFinanceReport({ factoryId, startDate: startDateStr, endDate: endDateStr })
          .catch((err) => {
            reportDashboardLogger.warn('获取成本数据失败', err);
            return null;
          }),
        // 设备数据 (使用 dashboardAPI)
        dashboardAPI.getEquipmentDashboard(factoryId)
          .then(res => res.success ? res.data : null)
          .catch((err) => {
            reportDashboardLogger.warn('获取设备数据失败', err);
            return null;
          }),
        // 人力成本分析
        wageApiClient.analyzeLaborCost(startDateStr, endDateStr, factoryId)
          .catch((err) => {
            reportDashboardLogger.warn('获取人力成本数据失败', err);
            return null;
          }),
      ]);

      // 处理生产数据 (从 overview)
      if (overviewRes) {
        const summary = overviewRes.summary;
        const todayStats = overviewRes.todayStats;
        setProductionData({
          totalBatches: summary?.totalBatches ?? todayStats?.totalBatches ?? 0,
          completedBatches: summary?.completedBatches ?? 0,
          completionRate: todayStats?.productionEfficiency ?? overviewRes.kpi?.productionEfficiency ?? 0,
          totalOutput: todayStats?.todayOutputKg ?? 0,
        });

        // 从 overview 中获取效率数据（如果效率报表失败）
        if (!efficiencyRes && overviewRes.kpi) {
          setEfficiencyData({
            equipmentOEE: 0, // 需要从设备数据获取
            equipmentUtilization: overviewRes.kpi.equipmentUtilization ?? 0,
            laborEfficiency: overviewRes.kpi.productionEfficiency ?? 0,
            overallEfficiency: overviewRes.kpi.productionEfficiency ?? 0,
          });
        }
      }

      // 处理质量数据
      if (qualityRes) {
        setQualityData({
          totalInspected: qualityRes.totalInspections ?? 0,
          passed: qualityRes.passedInspections ?? 0,
          failed: qualityRes.failedInspections ?? 0,
          passRate: qualityRes.passRate ?? 0,
        });
      }

      // 处理效率数据 (解包嵌套的响应格式)
      const efficiencyActual = (efficiencyRes as any)?.data ?? efficiencyRes;
      if (efficiencyActual) {
        setEfficiencyData({
          equipmentOEE: efficiencyActual.equipmentOEE ?? 0,
          equipmentUtilization: equipmentRes?.averageUtilization ?? 0,
          laborEfficiency: 0,
          overallEfficiency: efficiencyActual.completionRate ?? 0,
        });
      }

      // 处理成本数据 (解包嵌套的响应格式)
      const financeActual = (financeRes as any)?.data ?? financeRes;
      if (financeActual) {
        setCostData({
          totalCost: financeActual.totalCost ?? 0,
          materialCost: financeActual.materialCost ?? 0,
          laborCost: financeActual.laborCost ?? 0,
          overheadCost: financeActual.otherCost ?? financeActual.equipmentCost ?? 0,
        });
      }

      // 处理人力成本分析 (解包嵌套的响应格式)
      const laborCostActual = (laborCostRes as any)?.data ?? laborCostRes;
      setLaborCostAnalysis(laborCostActual);

      reportDashboardLogger.info('综合报表数据加载完成', {
        hasProduction: !!overviewRes,
        hasQuality: !!qualityRes,
        hasEfficiency: !!efficiencyRes,
        hasCost: !!financeRes,
        hasLabor: !!laborCostRes,
      });
    } catch (error) {
      reportDashboardLogger.error('加载综合报表数据失败', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 刷新数据
   */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  }, []);

  /**
   * 页面聚焦时加载数据
   */
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadAllData();
    }, [])
  );

  /**
   * 格式化货币
   */
  const formatCurrency = (value: number) => {
    if (value >= 10000) {
      return `¥${(value / 10000).toFixed(1)}万`;
    }
    return `¥${value.toLocaleString()}`;
  };

  /**
   * 获取状态颜色
   */
  const getStatusColor = (value: number, threshold: number = 80) => {
    if (value >= threshold) return '#4CAF50';
    if (value >= threshold - 20) return '#FF9800';
    return '#F44336';
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="数据分析中心" />
        <Appbar.Action icon="refresh" onPress={handleRefresh} />
        <Appbar.Action icon="export" onPress={() => navigation.navigate('DataExport', {})} />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* 时间范围提示 */}
        <Surface style={styles.timeRangeCard} elevation={1}>
          <View style={styles.timeRangeRow}>
            <Icon source="calendar-range" size={20} color="#2196F3" />
            <Text style={styles.timeRangeText}>统计周期: 近7天</Text>
          </View>
        </Surface>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载数据中...</Text>
          </View>
        ) : (
          <>
            {/* 生产概览 */}
            <Card
              style={styles.card}
              mode="elevated"
              onPress={() => navigation.navigate('ProductionReport')}
            >
              <Card.Title
                title="生产概览"
                titleVariant="titleMedium"
                left={(props) => <Icon {...props} source="factory" color="#2196F3" />}
                right={() => <Icon source="chevron-right" size={24} color="#999" />}
              />
              <Card.Content>
                {productionData ? (
                  <View style={styles.metricsGrid}>
                    <View style={styles.metricItem}>
                      <Text style={[styles.metricValue, { color: '#2196F3' }]}>
                        {productionData.totalBatches}
                      </Text>
                      <Text style={styles.metricLabel}>总批次</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={[styles.metricValue, { color: '#4CAF50' }]}>
                        {productionData.completedBatches}
                      </Text>
                      <Text style={styles.metricLabel}>已完成</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={[styles.metricValue, { color: getStatusColor(productionData.completionRate) }]}>
                        {(productionData.completionRate ?? 0).toFixed(1)}%
                      </Text>
                      <Text style={styles.metricLabel}>完成率</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={[styles.metricValue, { color: '#9C27B0' }]}>
                        {productionData.totalOutput.toLocaleString()}
                      </Text>
                      <Text style={styles.metricLabel}>总产出</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.noDataText}>暂无生产数据</Text>
                )}
              </Card.Content>
            </Card>

            {/* 质量概览 */}
            <Card
              style={styles.card}
              mode="elevated"
              onPress={() => navigation.navigate('QualityReport')}
            >
              <Card.Title
                title="质量概览"
                titleVariant="titleMedium"
                left={(props) => <Icon {...props} source="check-circle" color="#4CAF50" />}
                right={() => <Icon source="chevron-right" size={24} color="#999" />}
              />
              <Card.Content>
                {qualityData ? (
                  <>
                    <View style={styles.metricsRow}>
                      <View style={styles.metricItemSmall}>
                        <Text style={styles.metricValueSmall}>{qualityData.totalInspected}</Text>
                        <Text style={styles.metricLabelSmall}>检验数</Text>
                      </View>
                      <View style={styles.metricItemSmall}>
                        <Text style={[styles.metricValueSmall, { color: '#4CAF50' }]}>{qualityData.passed}</Text>
                        <Text style={styles.metricLabelSmall}>合格</Text>
                      </View>
                      <View style={styles.metricItemSmall}>
                        <Text style={[styles.metricValueSmall, { color: '#F44336' }]}>{qualityData.failed}</Text>
                        <Text style={styles.metricLabelSmall}>不合格</Text>
                      </View>
                    </View>
                    <View style={styles.progressRow}>
                      <Text style={styles.progressLabel}>合格率</Text>
                      <Text style={[styles.progressValue, { color: getStatusColor(qualityData.passRate, 95) }]}>
                        {(qualityData.passRate ?? 0).toFixed(1)}%
                      </Text>
                    </View>
                    <ProgressBar
                      progress={(qualityData.passRate ?? 0) / 100}
                      color={getStatusColor(qualityData.passRate, 95)}
                      style={styles.progressBar}
                    />
                  </>
                ) : (
                  <Text style={styles.noDataText}>暂无质量数据</Text>
                )}
              </Card.Content>
            </Card>

            {/* 效率概览 */}
            <Card
              style={styles.card}
              mode="elevated"
              onPress={() => navigation.navigate('EfficiencyReport')}
            >
              <Card.Title
                title="效率概览"
                titleVariant="titleMedium"
                left={(props) => <Icon {...props} source="speedometer" color="#9C27B0" />}
                right={() => <Icon source="chevron-right" size={24} color="#999" />}
              />
              <Card.Content>
                {efficiencyData ? (
                  <>
                    <View style={styles.efficiencyRow}>
                      <Text style={styles.efficiencyLabel}>设备OEE</Text>
                      <Text style={[styles.efficiencyValue, { color: getStatusColor(efficiencyData.equipmentOEE, 85) }]}>
                        {(efficiencyData.equipmentOEE ?? 0).toFixed(1)}%
                      </Text>
                    </View>
                    <ProgressBar
                      progress={(efficiencyData.equipmentOEE ?? 0) / 100}
                      color={getStatusColor(efficiencyData.equipmentOEE, 85)}
                      style={styles.progressBar}
                    />
                    <View style={styles.efficiencyRow}>
                      <Text style={styles.efficiencyLabel}>设备利用率</Text>
                      <Text style={[styles.efficiencyValue, { color: getStatusColor(efficiencyData.equipmentUtilization) }]}>
                        {(efficiencyData.equipmentUtilization ?? 0).toFixed(1)}%
                      </Text>
                    </View>
                    <ProgressBar
                      progress={(efficiencyData.equipmentUtilization ?? 0) / 100}
                      color={getStatusColor(efficiencyData.equipmentUtilization)}
                      style={styles.progressBar}
                    />
                    <View style={styles.efficiencyRow}>
                      <Text style={styles.efficiencyLabel}>综合效率</Text>
                      <Text style={[styles.efficiencyValue, { color: getStatusColor(efficiencyData.overallEfficiency) }]}>
                        {(efficiencyData.overallEfficiency ?? 0).toFixed(1)}%
                      </Text>
                    </View>
                    <ProgressBar
                      progress={(efficiencyData.overallEfficiency ?? 0) / 100}
                      color={getStatusColor(efficiencyData.overallEfficiency)}
                      style={styles.progressBar}
                    />
                  </>
                ) : (
                  <Text style={styles.noDataText}>暂无效率数据</Text>
                )}
              </Card.Content>
            </Card>

            {/* 成本概览 */}
            <Card
              style={styles.card}
              mode="elevated"
              onPress={() => navigation.navigate('CostReport')}
            >
              <Card.Title
                title="成本概览"
                titleVariant="titleMedium"
                left={(props) => <Icon {...props} source="currency-usd" color="#FF9800" />}
                right={() => <Icon source="chevron-right" size={24} color="#999" />}
              />
              <Card.Content>
                {costData ? (
                  <View style={styles.costGrid}>
                    <View style={styles.costItem}>
                      <Text style={[styles.costValue, { color: '#F44336' }]}>
                        {formatCurrency(costData.totalCost)}
                      </Text>
                      <Text style={styles.costLabel}>总成本</Text>
                    </View>
                    <View style={styles.costItem}>
                      <Text style={[styles.costValue, { color: '#FF9800' }]}>
                        {formatCurrency(costData.materialCost)}
                      </Text>
                      <Text style={styles.costLabel}>材料</Text>
                    </View>
                    <View style={styles.costItem}>
                      <Text style={[styles.costValue, { color: '#2196F3' }]}>
                        {formatCurrency(costData.laborCost)}
                      </Text>
                      <Text style={styles.costLabel}>人工</Text>
                    </View>
                    <View style={styles.costItem}>
                      <Text style={[styles.costValue, { color: '#9C27B0' }]}>
                        {formatCurrency(costData.overheadCost)}
                      </Text>
                      <Text style={styles.costLabel}>制造费用</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.noDataText}>暂无成本数据</Text>
                )}
              </Card.Content>
            </Card>

            {/* 人效概览 */}
            <Card
              style={styles.card}
              mode="elevated"
              onPress={() => navigation.navigate('PersonnelReport')}
            >
              <Card.Title
                title="人效概览"
                titleVariant="titleMedium"
                left={(props) => <Icon {...props} source="account-group" color="#795548" />}
                right={() => <Icon source="chevron-right" size={24} color="#999" />}
              />
              <Card.Content>
                {laborCostAnalysis ? (
                  <View style={styles.laborGrid}>
                    <View style={styles.laborItem}>
                      <Text style={[styles.laborValue, { color: '#795548' }]}>
                        {laborCostAnalysis.workerCount ?? 0}
                      </Text>
                      <Text style={styles.laborLabel}>工人数</Text>
                    </View>
                    <View style={styles.laborItem}>
                      <Text style={[styles.laborValue, { color: '#2196F3' }]}>
                        {(laborCostAnalysis.totalPieceCount ?? 0).toLocaleString()}
                      </Text>
                      <Text style={styles.laborLabel}>总计件</Text>
                    </View>
                    <View style={styles.laborItem}>
                      <Text style={[styles.laborValue, { color: '#4CAF50' }]}>
                        {(laborCostAnalysis.averageEfficiency ?? 0).toFixed(1)}
                      </Text>
                      <Text style={styles.laborLabel}>件/小时</Text>
                    </View>
                    <View style={styles.laborItem}>
                      <Text style={[styles.laborValue, { color: '#FF9800' }]}>
                        ¥{(laborCostAnalysis.costPerPiece ?? 0).toFixed(2)}
                      </Text>
                      <Text style={styles.laborLabel}>单件成本</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.noDataText}>暂无人效数据</Text>
                )}
              </Card.Content>
            </Card>

            {/* KPI概览 */}
            <Card
              style={styles.card}
              mode="elevated"
              onPress={() => navigation.navigate('KPIReport')}
            >
              <Card.Title
                title="更多报表"
                titleVariant="titleMedium"
                left={(props) => <Icon {...props} source="chart-bar" color="#3F51B5" />}
                right={() => <Icon source="chevron-right" size={24} color="#999" />}
              />
              <Card.Content>
                <View style={styles.moreReportsRow}>
                  <Chip
                    icon="chart-line"
                    style={styles.reportChip}
                    onPress={() => navigation.navigate('KPIReport')}
                  >
                    KPI指标
                  </Chip>
                  <Chip
                    icon="gauge"
                    style={styles.reportChip}
                    onPress={() => navigation.navigate('OeeReport')}
                  >
                    OEE分析
                  </Chip>
                  <Chip
                    icon="truck-delivery"
                    style={styles.reportChip}
                    onPress={() => navigation.navigate('OnTimeDeliveryReport')}
                  >
                    准时交付
                  </Chip>
                </View>
              </Card.Content>
            </Card>
          </>
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
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    margin: 16,
    marginBottom: 8,
  },
  timeRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeRangeText: {
    marginLeft: 8,
    color: '#1976D2',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  card: {
    margin: 16,
    marginTop: 8,
    marginBottom: 0,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  metricItemSmall: {
    alignItems: 'center',
  },
  metricValueSmall: {
    fontSize: 20,
    fontWeight: '700',
  },
  metricLabelSmall: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 14,
    color: '#333',
  },
  progressValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  efficiencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    marginTop: 8,
  },
  efficiencyLabel: {
    fontSize: 13,
    color: '#333',
  },
  efficiencyValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  costGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  costItem: {
    width: '48%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 8,
  },
  costValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  costLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  laborGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  laborItem: {
    alignItems: 'center',
    flex: 1,
  },
  laborValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  laborLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  moreReportsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reportChip: {
    marginBottom: 4,
  },
  noDataText: {
    color: '#999',
    textAlign: 'center',
    paddingVertical: 16,
  },
  bottomPadding: {
    height: 80,
  },
});
