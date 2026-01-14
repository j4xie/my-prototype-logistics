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
  ProgressBar,
  IconButton,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { qualityInspectionApiClient } from '../../services/api/qualityInspectionApiClient';
import { reportApiClient, AnomalyReport } from '../../services/api/reportApiClient';
import { getFactoryId } from '../../types/auth';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { ReportStackParamList } from '../../types/navigation';

// 创建QualityReport专用logger
const qualityReportLogger = logger.createContextLogger('QualityReport');

/**
 * 质量报表页面
 * 集成数据来源:
 * - qualityInspectionApiClient: 质检记录、质检统计
 *
 * 展示内容:
 * - 质检合格率统计
 * - 问题分类分析
 * - 质量趋势
 */
type NavigationProp = NativeStackNavigationProp<ReportStackParamList>;

export default function QualityReportScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const { t } = useTranslation('reports');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('week');
  const [activeTab, setActiveTab] = useState('overview');

  // 数据状态
  const [qualityStats, setQualityStats] = useState<any>(null);
  const [recentInspections, setRecentInspections] = useState<any[]>([]);

  // 异常检测数据状态
  const [anomalyData, setAnomalyData] = useState<AnomalyReport | null>(null);
  const [anomalyLoading, setAnomalyLoading] = useState(false);

  /**
   * 加载质检数据
   */
  const loadQualityData = async () => {
    setLoading(true);
    try {
      const factoryId = getFactoryId(user);

      if (!factoryId) {
        Alert.alert(t('common.error'), t('quality.cannotGetFactoryInfo'));
        return;
      }

      qualityReportLogger.debug('加载质量报表数据', { timeRange, factoryId });

      // 加载质检记录列表
      const inspectionsResponse = await qualityInspectionApiClient.getInspections(
        {
          page: 1,
          size: 20,
        },
        factoryId
      );

      if (inspectionsResponse.success && inspectionsResponse.data) {
        const inspections = inspectionsResponse.data.content || inspectionsResponse.data || [];
        setRecentInspections(Array.isArray(inspections) ? inspections : []);

        // 计算统计数据
        const stats = calculateQualityStats(inspections);
        setQualityStats(stats);

        qualityReportLogger.info('质量报表数据加载成功', {
          inspectionCount: inspections.length,
          passRate: stats.passRate.toFixed(1) + '%',
          factoryId,
        });
      } else {
        qualityReportLogger.warn('获取质检数据失败', {
          message: inspectionsResponse.message,
          factoryId,
        });
        setRecentInspections([]);
        setQualityStats(null);
      }
    } catch (error) {
      qualityReportLogger.error('加载质量报表失败', error as Error, {
        factoryId: getFactoryId(user),
        timeRange,
      });
      handleError(error, {
        title: t('quality.loadFailed'),
        customMessage: t('quality.loadQualityDataFailed'),
      });
      setRecentInspections([]);
      setQualityStats(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 计算质检统计
   */
  const calculateQualityStats = (inspections: any[]) => {
    const totalInspections = inspections.length;
    const passedInspections = inspections.filter(
      (i) => i.result === 'PASSED' || i.result === 'passed' || i.inspectionResult === 'PASSED'
    ).length;
    const failedInspections = inspections.filter(
      (i) => i.result === 'FAILED' || i.result === 'failed' || i.inspectionResult === 'FAILED'
    ).length;
    const conditionalInspections = inspections.filter(
      (i) =>
        i.result === 'CONDITIONAL' ||
        i.result === 'conditional' ||
        i.inspectionResult === 'CONDITIONAL'
    ).length;

    const passRate = totalInspections > 0 ? (passedInspections / totalInspections) * 100 : 0;

    // 问题分类统计
    const issueCategories: Record<string, number> = {};
    inspections.forEach((inspection) => {
      if (inspection.issues && Array.isArray(inspection.issues)) {
        inspection.issues.forEach((issue: any) => {
          const category = issue.category || '其他问题';
          issueCategories[category] = (issueCategories[category] || 0) + 1;
        });
      }
    });

    return {
      totalInspections,
      passedInspections,
      failedInspections,
      conditionalInspections,
      passRate,
      issueCategories,
    };
  };

  /**
   * 加载异常检测数据
   */
  const loadAnomalyData = async () => {
    setAnomalyLoading(true);
    try {
      const factoryId = getFactoryId(user);

      if (!factoryId) {
        qualityReportLogger.warn('加载异常数据失败: 无法获取工厂ID');
        return;
      }

      // 计算日期范围 (根据 timeRange)
      const endDate = new Date();
      const startDate = new Date();
      if (timeRange === 'day') {
        startDate.setDate(startDate.getDate() - 1);
      } else if (timeRange === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else {
        startDate.setMonth(startDate.getMonth() - 1);
      }

      const formatDate = (date: Date) => date.toISOString().split('T')[0];

      qualityReportLogger.debug('加载异常检测数据', {
        factoryId,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
      });

      const response = await reportApiClient.getAnomalyReport({
        factoryId,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
      });
      // 解包嵌套的响应格式 {code, message, data}
      const actualData = (response as any)?.data ?? response;
      setAnomalyData(actualData);
      qualityReportLogger.info('异常检测数据加载成功', {
        totalAnomalies: actualData.totalAnomalies ?? 0,
        factoryId,
      });
    } catch (error) {
      // 静默处理错误，只记录日志
      qualityReportLogger.error('加载异常检测数据失败', error as Error, {
        factoryId: getFactoryId(user),
        timeRange,
      });
      setAnomalyData(null);
    } finally {
      setAnomalyLoading(false);
    }
  };

  /**
   * 刷新数据
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'anomaly') {
      await loadAnomalyData();
    } else {
      await loadQualityData();
    }
    setRefreshing(false);
  };

  /**
   * 页面聚焦时加载数据
   */
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'anomaly') {
        loadAnomalyData();
      } else {
        loadQualityData();
      }
    }, [timeRange, activeTab])
  );

  /**
   * 获取结果标签
   */
  const getResultChip = (result: string) => {
    const resultMap: Record<string, { label: string; color: string; bgColor: string }> = {
      PASSED: { label: t('quality.passed'), color: '#4CAF50', bgColor: '#E8F5E9' },
      passed: { label: t('quality.passed'), color: '#4CAF50', bgColor: '#E8F5E9' },
      FAILED: { label: t('quality.failed'), color: '#F44336', bgColor: '#FFEBEE' },
      failed: { label: t('quality.failed'), color: '#F44336', bgColor: '#FFEBEE' },
      CONDITIONAL: { label: t('quality.conditional'), color: '#FF9800', bgColor: '#FFF3E0' },
      conditional: { label: t('quality.conditional'), color: '#FF9800', bgColor: '#FFF3E0' },
    };

    const config = resultMap[result] ?? resultMap['CONDITIONAL'];

    return (
      <Chip
        mode="flat"
        compact
        style={{ backgroundColor: config?.bgColor ?? '#FFF3E0' }}
        textStyle={{ color: config?.color ?? '#FF9800', fontSize: 12 }}
      >
        {config?.label ?? t('quality.conditional')}
      </Chip>
    );
  };

  /**
   * 渲染异常检测Tab内容 - 使用真实API数据
   */
  const renderAnomalyTab = () => {
    // 从 API 数据中计算各级别异常数量
    const anomalies = anomalyData?.anomalies ?? [];
    const criticalCount = anomalies.filter((a) => a.level === 'CRITICAL').length;
    const warningCount = anomalies.filter((a) => a.level === 'WARNING').length;
    const infoCount = anomalies.filter((a) => a.level === 'INFO').length;
    const totalAnomalies = anomalyData?.totalAnomalies ?? anomalies.length;

    const getSeverityColor = (level: string) => {
      switch (level) {
        case 'CRITICAL': return '#F44336';
        case 'WARNING': return '#FF9800';
        case 'INFO': return '#2196F3';
        default: return '#666';
      }
    };

    const getSeverityBgColor = (level: string) => {
      switch (level) {
        case 'CRITICAL': return '#FFEBEE';
        case 'WARNING': return '#FFF3E0';
        case 'INFO': return '#E3F2FD';
        default: return '#F5F5F5';
      }
    };

    const getSeverityLabel = (level: string) => {
      switch (level) {
        case 'CRITICAL': return '严重';
        case 'WARNING': return '警告';
        case 'INFO': return '提示';
        default: return '未知';
      }
    };

    // 格式化检测时间
    const formatDetectedTime = (detectedAt: string) => {
      try {
        const date = new Date(detectedAt);
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      } catch {
        return detectedAt ?? '--:--';
      }
    };

    return (
      <View style={styles.tabContent}>
        {/* 异常统计概览 */}
        <Surface style={styles.anomalyStatsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.statsTitle}>
            异常检测统计
          </Text>
          <Divider style={styles.divider} />

          {anomalyLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
              <Text style={styles.loadingText}>{t('common.loading')}</Text>
            </View>
          ) : (
            <>
              {/* 异常数量统计 */}
              <View style={styles.anomalyStatsRow}>
                <View style={[styles.anomalyStatBox, { backgroundColor: '#FFEBEE' }]}>
                  <Text style={[styles.anomalyStatValue, { color: '#F44336' }]}>
                    {criticalCount}
                  </Text>
                  <Text style={styles.anomalyStatLabel}>严重</Text>
                </View>
                <View style={[styles.anomalyStatBox, { backgroundColor: '#FFF3E0' }]}>
                  <Text style={[styles.anomalyStatValue, { color: '#FF9800' }]}>
                    {warningCount}
                  </Text>
                  <Text style={styles.anomalyStatLabel}>警告</Text>
                </View>
                <View style={[styles.anomalyStatBox, { backgroundColor: '#E3F2FD' }]}>
                  <Text style={[styles.anomalyStatValue, { color: '#2196F3' }]}>
                    {infoCount}
                  </Text>
                  <Text style={styles.anomalyStatLabel}>提示</Text>
                </View>
                <View style={[styles.anomalyStatBox, { backgroundColor: '#F5F5F5' }]}>
                  <Text style={[styles.anomalyStatValue, { color: '#666' }]}>
                    {totalAnomalies}
                  </Text>
                  <Text style={styles.anomalyStatLabel}>总计</Text>
                </View>
              </View>

              <Divider style={styles.divider} />

              {/* 最近异常列表 */}
              <Text variant="bodyMedium" style={styles.anomalySectionTitle}>
                最近异常记录
              </Text>
              {anomalies.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>暂无异常记录</Text>
                </View>
              ) : (
                <View style={styles.anomalyList}>
                  {anomalies.map((item, index) => (
                    <View key={`${item.type}-${item.detectedAt}-${index}`} style={styles.anomalyItem}>
                      <View style={[styles.anomalySeverityDot, { backgroundColor: getSeverityColor(item.level) }]} />
                      <View style={styles.anomalyItemContent}>
                        <View style={styles.anomalyItemHeader}>
                          <Text style={styles.anomalyItemType}>{item.title ?? item.type}</Text>
                          <Chip
                            mode="flat"
                            compact
                            style={{ backgroundColor: getSeverityBgColor(item.level) }}
                            textStyle={{ color: getSeverityColor(item.level), fontSize: 10 }}
                          >
                            {getSeverityLabel(item.level)}
                          </Chip>
                        </View>
                        <Text style={styles.anomalyItemEquipment}>{item.description ?? '--'}</Text>
                        <View style={styles.anomalyItemDetails}>
                          <Text style={styles.anomalyItemValue}>
                            次数: <Text style={{ color: getSeverityColor(item.level), fontWeight: '600' }}>{item.count ?? 1}</Text>
                          </Text>
                          <Text style={styles.anomalyItemTime}>{formatDetectedTime(item.detectedAt)}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* AI 分析建议 */}
              {anomalyData?.aiAnalysis && (
                <>
                  <Divider style={styles.divider} />
                  <Text variant="bodyMedium" style={styles.anomalySectionTitle}>
                    AI 分析建议
                  </Text>
                  <Text style={styles.aiAnalysisText}>{anomalyData.aiAnalysis}</Text>
                </>
              )}
            </>
          )}
        </Surface>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('quality.managementTitle')} />
        <Appbar.Action icon="refresh" onPress={activeTab === 'anomaly' ? loadAnomalyData : loadQualityData} />
      </Appbar.Header>

      {/* 主Tab选择器 */}
      <Surface style={styles.mainTabCard} elevation={1}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={setActiveTab}
          buttons={[
            { value: 'overview', label: t('quality.overviewTab') },
            { value: 'anomaly', label: t('quality.anomalyTab') },
          ]}
          style={styles.mainTabButtons}
        />
      </Surface>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {activeTab === 'anomaly' ? (
          renderAnomalyTab()
        ) : (
          <>
            {/* 时间范围选择 */}
            <Surface style={styles.timeRangeCard} elevation={1}>
              <Text variant="bodyMedium" style={styles.sectionLabel}>
                {t('quality.timeRange')}
              </Text>
              <SegmentedButtons
                value={timeRange}
                onValueChange={setTimeRange}
                buttons={[
                  { value: 'day', label: t('quality.today') },
                  { value: 'week', label: t('quality.thisWeek') },
                  { value: 'month', label: t('quality.thisMonth') },
                ]}
                style={styles.segmentedButtons}
              />
            </Surface>

            {/* 统计概览 */}
            <Surface style={styles.statsCard} elevation={1}>
              <Text variant="titleMedium" style={styles.statsTitle}>
                {t('quality.qualityStats')}
              </Text>
              <Divider style={styles.divider} />

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" />
                  <Text style={styles.loadingText}>{t('common.loading')}</Text>
                </View>
              ) : qualityStats ? (
                <>
                  <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>{qualityStats.totalInspections}</Text>
                      <Text style={styles.statLabel}>{t('quality.totalInspections')}</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                        {qualityStats.passedInspections}
                      </Text>
                      <Text style={styles.statLabel}>{t('quality.passed')}</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={[styles.statValue, { color: '#F44336' }]}>
                        {qualityStats.failedInspections}
                      </Text>
                      <Text style={styles.statLabel}>{t('quality.failed')}</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={[styles.statValue, { color: '#FF9800' }]}>
                        {qualityStats.conditionalInspections}
                      </Text>
                      <Text style={styles.statLabel}>{t('quality.conditional')}</Text>
                    </View>
                  </View>

                  {/* 合格率 */}
                  <View style={styles.passRateContainer}>
                    <View style={styles.passRateHeader}>
                      <Text style={styles.passRateLabel}>{t('quality.passRate')}</Text>
                      <Text style={styles.passRateValue}>{(qualityStats.passRate ?? 0).toFixed(1)}%</Text>
                    </View>
                    <ProgressBar
                      progress={(qualityStats.passRate ?? 0) / 100}
                      color={(qualityStats.passRate ?? 0) >= 95 ? '#4CAF50' : '#FF9800'}
                      style={styles.progressBar}
                    />
                  </View>
                </>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{t('quality.noStatsData')}</Text>
                </View>
              )}
            </Surface>

            {/* 最近质检记录 */}
            <Card style={styles.card} mode="elevated">
              <Card.Title title={t('quality.recentInspectionRecords')} titleVariant="titleMedium" />
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title>{t('quality.batchNumber')}</DataTable.Title>
                  <DataTable.Title>{t('quality.inspector')}</DataTable.Title>
                  <DataTable.Title>{t('quality.result')}</DataTable.Title>
                </DataTable.Header>

                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" />
                  </View>
                ) : recentInspections.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text variant="bodyMedium" style={styles.emptyText}>
                      {t('quality.noInspectionRecords')}
                    </Text>
                  </View>
                ) : (
                  recentInspections.slice(0, 10).map((inspection, index) => (
                    <DataTable.Row key={inspection.id || index}>
                      <DataTable.Cell>
                        <Text variant="bodySmall">
                          {inspection.batchNumber || `批次${inspection.batchId}`}
                        </Text>
                      </DataTable.Cell>
                      <DataTable.Cell>
                        <Text variant="bodySmall">
                          {inspection.inspectorName || `质检员${inspection.inspectorId}`}
                        </Text>
                      </DataTable.Cell>
                      <DataTable.Cell>
                        {getResultChip(inspection.result || inspection.inspectionResult || 'CONDITIONAL')}
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))
                )}
              </DataTable>
            </Card>

            <View style={styles.bottomPadding} />
          </>
        )}
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
  mainTabCard: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mainTabButtons: {
    marginTop: 0,
  },
  tabContent: {
    padding: 16,
  },
  navigationCard: {
    marginBottom: 16,
  },
  navigationCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  navigationCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconButton: {
    margin: 0,
  },
  navigationCardText: {
    flex: 1,
  },
  navigationCardTitle: {
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  navigationCardDescription: {
    color: '#666',
  },
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  featureList: {
    marginTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  featureText: {
    color: '#666',
    flex: 1,
    marginLeft: -8,
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
  passRateContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  passRateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  passRateLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  passRateValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
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
  // 异常检测数据显示样式
  anomalyStatsCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  anomalyStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  anomalyStatBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  anomalyStatValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  anomalyStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  anomalySectionTitle: {
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  anomalyList: {
    gap: 12,
  },
  anomalyItem: {
    flexDirection: 'row',
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
  },
  anomalySeverityDot: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  anomalyItemContent: {
    flex: 1,
  },
  anomalyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  anomalyItemType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  anomalyItemEquipment: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  anomalyItemDetails: {
    flexDirection: 'row',
    gap: 12,
  },
  anomalyItemValue: {
    fontSize: 12,
    color: '#666',
  },
  anomalyItemThreshold: {
    fontSize: 12,
    color: '#999',
  },
  anomalyItemTime: {
    fontSize: 12,
    color: '#999',
  },
  aiAnalysisText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
});
