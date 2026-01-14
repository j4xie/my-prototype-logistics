import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  DataTable,
  ActivityIndicator,
  Divider,
  Surface,
  SegmentedButtons,
  Icon,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { processingApiClient } from '../../services/api/processingApiClient';
import { reportApiClient, CostVarianceReportDTO } from '../../services/api/reportApiClient';
import { getFactoryId } from '../../types/auth';
import { ReportStackParamList } from '../../types/navigation';
import { handleError , getErrorMsg} from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建CostReport专用logger
const costReportLogger = logger.createContextLogger('CostReport');

/**
 * 成本报表页面
 * 集成数据来源:
 * - processingApiClient: 批次成本数据、物料消耗
 *
 * 展示内容:
 * - 成本总览统计
 * - 批次成本分析
 * - 成本趋势
 */
export default function CostReportScreen() {
  const navigation = useNavigation<NavigationProp<ReportStackParamList>>();
  const { user } = useAuthStore();
  const { t } = useTranslation('reports');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('week');
  const [activeTab, setActiveTab] = useState<'overview' | 'variance'>('overview');

  // 数据状态
  const [costStats, setCostStats] = useState<any>(null);
  const [batchCosts, setBatchCosts] = useState<any[]>([]);
  const [costVarianceData, setCostVarianceData] = useState<CostVarianceReportDTO | null>(null);
  const [varianceLoading, setVarianceLoading] = useState(false);

  /**
   * 加载成本数据
   */
  const loadCostData = async () => {
    setLoading(true);
    try {
      const factoryId = getFactoryId(user);

      if (!factoryId) {
        Alert.alert(t('common.error'), t('cost.cannotGetFactoryInfo'));
        return;
      }

      costReportLogger.debug('加载成本报表数据', { timeRange, factoryId });

      // 加载批次列表（包含成本信息）
      const batchesResponse = await processingApiClient.getBatches({
        factoryId,
        page: 1,
        size: 20
      });

      if (batchesResponse.success && batchesResponse.data) {
        const batches = batchesResponse.data.content || batchesResponse.data || [];
        setBatchCosts(Array.isArray(batches) ? batches : []);

        // 计算成本统计
        const stats = calculateCostStats(batches);
        setCostStats(stats);

        costReportLogger.info('成本报表数据加载成功', {
          batchCount: batches.length,
          totalCost: stats.totalCost.toFixed(2),
          avgCostPerBatch: stats.avgCostPerBatch.toFixed(2),
          factoryId,
        });
      } else {
        costReportLogger.warn('获取成本数据失败', {
          message: batchesResponse.message,
          factoryId,
        });
        setBatchCosts([]);
        setCostStats(null);
      }
    } catch (error) {
      costReportLogger.error('加载成本报表失败', error as Error, {
        factoryId: getFactoryId(user),
        timeRange,
      });
      const errorMessage =
        getErrorMsg(error) || t('cost.error');
      Alert.alert(t('cost.error'), errorMessage);
      setBatchCosts([]);
      setCostStats(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 计算成本统计
   */
  const calculateCostStats = (batches: any[]) => {
    const totalBatches = batches.length;
    let totalCost = 0;
    let totalMaterialCost = 0;
    let totalLaborCost = 0;
    let totalOverheadCost = 0;

    batches.forEach((batch) => {
      // 尝试从多个可能的字段获取成本数据
      const batchTotalCost = batch.totalCost || batch.cost || 0;
      const materialCost = batch.materialCost || batch.rawMaterialCost || 0;
      const laborCost = batch.laborCost || batch.labourCost || 0;
      const overheadCost = batch.overheadCost || batch.overhead || 0;

      totalCost += batchTotalCost;
      totalMaterialCost += materialCost;
      totalLaborCost += laborCost;
      totalOverheadCost += overheadCost;
    });

    const avgCostPerBatch = totalBatches > 0 ? totalCost / totalBatches : 0;

    // 计算各成本占比
    const materialCostRatio = totalCost > 0 ? (totalMaterialCost / totalCost) * 100 : 0;
    const laborCostRatio = totalCost > 0 ? (totalLaborCost / totalCost) * 100 : 0;
    const overheadCostRatio = totalCost > 0 ? (totalOverheadCost / totalCost) * 100 : 0;

    return {
      totalBatches,
      totalCost,
      totalMaterialCost,
      totalLaborCost,
      totalOverheadCost,
      avgCostPerBatch,
      materialCostRatio,
      laborCostRatio,
      overheadCostRatio,
    };
  };

  /**
   * 加载成本差异数据
   */
  const loadCostVarianceData = async () => {
    setVarianceLoading(true);
    try {
      const factoryId = getFactoryId(user);
      if (!factoryId) {
        costReportLogger.warn('无法获取工厂ID');
        return;
      }

      // 计算日期范围（基于timeRange）
      const endDate = new Date();
      const startDate = new Date();
      if (timeRange === 'day') {
        startDate.setDate(endDate.getDate() - 1);
      } else if (timeRange === 'week') {
        startDate.setDate(endDate.getDate() - 7);
      } else {
        startDate.setMonth(endDate.getMonth() - 1);
      }

      const formatDate = (date: Date): string => date.toISOString().split('T')[0] ?? '';

      const response = await reportApiClient.getCostVarianceReport({
        factoryId,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
      });
      // 解包嵌套的响应格式 {code, message, data}
      const actualData = (response as any)?.data ?? response;
      if (actualData) {
        setCostVarianceData(actualData);
        costReportLogger.info('成本差异数据加载成功', {
          totalVariance: actualData.totalVariance,
          varianceRate: actualData.totalVarianceRate,
        });
      }
    } catch (error) {
      costReportLogger.warn('加载成本差异数据失败', error as Error);
      // 不弹窗，静默处理
    } finally {
      setVarianceLoading(false);
    }
  };

  /**
   * 刷新数据
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCostData();
    setRefreshing(false);
  };

  /**
   * 页面聚焦时加载数据
   */
  useFocusEffect(
    useCallback(() => {
      loadCostData();
      if (activeTab === 'variance') {
        loadCostVarianceData();
      }
    }, [timeRange, activeTab])
  );

  /**
   * Tab切换时加载对应数据
   */
  const handleTabChange = (value: string) => {
    setActiveTab(value as 'overview' | 'variance');
    if (value === 'variance' && !costVarianceData) {
      loadCostVarianceData();
    }
  };

  /**
   * 格式化金额
   */
  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    return `¥${value.toFixed(2)}`;
  };

  /**
   * 导航到成本差异分析
   */
  const navigateToCostVariance = () => {
    navigation.navigate('CostVarianceReport');
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('cost.analysisTitle', '成本分析')} />
        <Appbar.Action icon="refresh" onPress={loadCostData} />
      </Appbar.Header>

      {/* 主标签切换 */}
      <Surface style={styles.tabContainer} elevation={1}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={handleTabChange}
          buttons={[
            { value: 'overview', label: t('cost.overviewTab', '成本概览') },
            { value: 'variance', label: t('cost.varianceTab', '成本差异') },
          ]}
          style={styles.tabButtons}
        />
      </Surface>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {activeTab === 'overview' ? (
          <>
            {/* 时间范围选择 */}
            <Surface style={styles.timeRangeCard} elevation={1}>
              <Text variant="bodyMedium" style={styles.sectionLabel}>
                {t('cost.timeRange')}
              </Text>
              <SegmentedButtons
                value={timeRange}
                onValueChange={setTimeRange}
                buttons={[
                  { value: 'day', label: t('cost.today') },
                  { value: 'week', label: t('cost.thisWeek') },
                  { value: 'month', label: t('cost.thisMonth') },
                ]}
                style={styles.segmentedButtons}
              />
            </Surface>

        {/* 成本总览 */}
        <Surface style={styles.statsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.statsTitle}>
            {t('cost.costOverview')}
          </Text>
          <Divider style={styles.divider} />

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
              <Text style={styles.loadingText}>{t('common.loading')}</Text>
            </View>
          ) : costStats ? (
            <>
              <View style={styles.totalCostContainer}>
                <Text style={styles.totalCostLabel}>{t('cost.totalCost')}</Text>
                <Text style={styles.totalCostValue}>{formatCurrency(costStats.totalCost)}</Text>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { fontSize: 20, color: '#FF9800' }]}>
                    {formatCurrency(costStats.totalMaterialCost)}
                  </Text>
                  <Text style={styles.statLabel}>
                    {t('cost.materialCost')} ({(costStats.materialCostRatio ?? 0).toFixed(1)}%)
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { fontSize: 20, color: '#2196F3' }]}>
                    {formatCurrency(costStats.totalLaborCost)}
                  </Text>
                  <Text style={styles.statLabel}>
                    {t('cost.laborCost')} ({(costStats.laborCostRatio ?? 0).toFixed(1)}%)
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { fontSize: 20, color: '#9C27B0' }]}>
                    {formatCurrency(costStats.totalOverheadCost)}
                  </Text>
                  <Text style={styles.statLabel}>
                    {t('cost.overheadCost')} ({(costStats.overheadCostRatio ?? 0).toFixed(1)}%)
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { fontSize: 20, color: '#4CAF50' }]}>
                    {formatCurrency(costStats.avgCostPerBatch)}
                  </Text>
                  <Text style={styles.statLabel}>{t('cost.avgCostPerBatch')}</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('cost.noCostData')}</Text>
            </View>
          )}
        </Surface>

        {/* 批次成本列表 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title={t('cost.batchCostDetails')} titleVariant="titleMedium" />
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>{t('cost.batchNumber')}</DataTable.Title>
              <DataTable.Title>{t('cost.product')}</DataTable.Title>
              <DataTable.Title numeric>{t('cost.totalCost')}</DataTable.Title>
            </DataTable.Header>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : batchCosts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  {t('cost.noBatchData')}
                </Text>
              </View>
            ) : (
              batchCosts.slice(0, 10).map((batch, index) => {
                const batchCost = batch.totalCost || batch.cost || 0;
                return (
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
                      <Text variant="bodySmall" style={{ color: '#FF9800' }}>
                        {formatCurrency(batchCost)}
                      </Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })
            )}
          </DataTable>
        </Card>

            <View style={styles.bottomPadding} />
          </>
        ) : (
          <>
            {/* 成本差异分析 - 使用真实API数据 */}
            <Surface style={styles.varianceDataCard} elevation={1}>
              <Text variant="titleMedium" style={styles.statsTitle}>
                成本差异分析
              </Text>
              <Divider style={styles.divider} />

              {varianceLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" />
                  <Text style={styles.loadingText}>{t('common.loading')}</Text>
                </View>
              ) : costVarianceData ? (
                <>
                  {/* 计划vs实际对比 - 使用真实数据 */}
                  <View style={styles.varianceCompareSection}>
                    <Text variant="bodyMedium" style={styles.varianceSectionTitle}>
                      计划成本 vs 实际成本
                    </Text>
                    <View style={styles.varianceCompareRow}>
                      <View style={styles.varianceCompareItem}>
                        <Text style={styles.varianceCompareLabel}>计划成本</Text>
                        <Text style={[styles.varianceCompareValue, { color: '#2196F3' }]}>
                          ¥{(costVarianceData.totalPlannedCost ?? 0).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.varianceCompareItem}>
                        <Text style={styles.varianceCompareLabel}>实际成本</Text>
                        <Text style={[styles.varianceCompareValue, { color: '#FF9800' }]}>
                          ¥{(costVarianceData.totalActualCost ?? 0).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.varianceCompareItem}>
                        <Text style={styles.varianceCompareLabel}>差异</Text>
                        <Text style={[styles.varianceCompareValue, {
                          color: (costVarianceData.totalVariance ?? 0) > 0 ? '#F44336' : '#4CAF50'
                        }]}>
                          {(costVarianceData.totalVariance ?? 0) > 0 ? '+' : ''}
                          ¥{(costVarianceData.totalVariance ?? 0).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Divider style={styles.divider} />

                  {/* 按类别差异分析 - 使用真实数据 */}
                  <Text variant="bodyMedium" style={styles.varianceSectionTitle}>
                    按类别差异分析
                  </Text>
                  <View style={styles.varianceCategoryList}>
                    {(costVarianceData.varianceByCategory || []).map((category, index) => {
                      const colors = ['#FF9800', '#2196F3', '#9C27B0', '#4CAF50', '#795548'];
                      return (
                        <View key={category.category || index} style={styles.varianceCategoryItem}>
                          <View style={styles.varianceCategoryLeft}>
                            <View style={[styles.varianceDot, { backgroundColor: colors[index % colors.length] }]} />
                            <Text style={styles.varianceCategoryName}>{category.category}</Text>
                          </View>
                          <View style={styles.varianceCategoryRight}>
                            <Text style={styles.varianceCategoryValue}>
                              ¥{(category.actualCost ?? 0).toFixed(2)}
                            </Text>
                            <Text style={[styles.varianceCategoryDiff, {
                              color: (category.varianceRate ?? 0) > 0 ? '#F44336' : '#4CAF50'
                            }]}>
                              {(category.varianceRate ?? 0) > 0 ? '+' : ''}{(category.varianceRate ?? 0).toFixed(1)}%
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                    {(!costVarianceData.varianceByCategory || costVarianceData.varianceByCategory.length === 0) && (
                      <Text style={styles.emptyText}>暂无分类差异数据</Text>
                    )}
                  </View>

                  <Divider style={styles.divider} />

                  {/* 差异最大项目 */}
                  <Text variant="bodyMedium" style={styles.varianceSectionTitle}>
                    差异最大项目
                  </Text>
                  <View style={styles.varianceReasonList}>
                    {(costVarianceData.topVarianceItems || []).slice(0, 3).map((item, index) => (
                      <View key={item.itemName || index} style={styles.varianceReasonItem}>
                        <Icon
                          source={(item.variance ?? 0) > 0 ? "alert-circle" : "check-circle"}
                          size={18}
                          color={(item.variance ?? 0) > 0 ? '#F44336' : '#4CAF50'}
                        />
                        <Text style={styles.varianceReasonText}>
                          {item.itemName}: {(item.varianceRate ?? 0) > 0 ? '+' : ''}{(item.varianceRate ?? 0).toFixed(1)}%
                          (¥{Math.abs(item.variance ?? 0).toFixed(2)})
                        </Text>
                      </View>
                    ))}
                    {(!costVarianceData.topVarianceItems || costVarianceData.topVarianceItems.length === 0) && (
                      <Text style={styles.emptyText}>暂无差异项目数据</Text>
                    )}
                  </View>
                </>
              ) : costStats ? (
                // 如果API失败，回退使用 costStats 计算（备用方案）
                <>
                  <View style={styles.varianceCompareSection}>
                    <Text variant="bodyMedium" style={styles.varianceSectionTitle}>
                      成本概况（基于批次数据计算）
                    </Text>
                    <View style={styles.varianceCompareRow}>
                      <View style={styles.varianceCompareItem}>
                        <Text style={styles.varianceCompareLabel}>物料成本</Text>
                        <Text style={[styles.varianceCompareValue, { color: '#FF9800' }]}>
                          ¥{(costStats.totalMaterialCost ?? 0).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.varianceCompareItem}>
                        <Text style={styles.varianceCompareLabel}>人工成本</Text>
                        <Text style={[styles.varianceCompareValue, { color: '#2196F3' }]}>
                          ¥{(costStats.totalLaborCost ?? 0).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.varianceCompareItem}>
                        <Text style={styles.varianceCompareLabel}>间接成本</Text>
                        <Text style={[styles.varianceCompareValue, { color: '#9C27B0' }]}>
                          ¥{(costStats.totalOverheadCost ?? 0).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>详细差异分析需要后端配置计划成本数据</Text>
                  </View>
                </>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>暂无成本差异数据</Text>
                </View>
              )}
            </Surface>

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
  tabContainer: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabButtons: {
    // Tab按钮样式
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
  totalCostContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  totalCostLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  totalCostValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FF9800',
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
    fontSize: 24,
    fontWeight: '700',
    color: '#2196F3',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
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
  // 成本差异Tab样式
  varianceIntroCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    marginBottom: 8,
  },
  varianceIntroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  varianceIntroTitle: {
    fontWeight: '600',
    color: '#212121',
    flex: 1,
  },
  varianceIntroDescription: {
    color: '#666',
    lineHeight: 22,
    marginBottom: 16,
  },
  varianceFeatureList: {
    gap: 10,
  },
  varianceFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  varianceFeatureText: {
    color: '#333',
  },
  varianceNavCard: {
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
  },
  varianceNavContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  varianceNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  varianceNavTextContainer: {
    flex: 1,
  },
  varianceNavTitle: {
    fontWeight: '600',
    color: '#6750A4',
  },
  varianceNavSubtitle: {
    color: '#666',
    marginTop: 2,
  },
  // 成本差异数据样式
  varianceDataCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  varianceCompareSection: {
    marginBottom: 8,
  },
  varianceSectionTitle: {
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  varianceCompareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  varianceCompareItem: {
    alignItems: 'center',
    flex: 1,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  varianceCompareLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  varianceCompareValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  varianceCategoryList: {
    gap: 12,
  },
  varianceCategoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  varianceCategoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  varianceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  varianceCategoryName: {
    fontSize: 14,
    color: '#333',
  },
  varianceCategoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  varianceCategoryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  varianceCategoryDiff: {
    fontSize: 13,
    fontWeight: '600',
  },
  varianceReasonList: {
    gap: 10,
  },
  varianceReasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  varianceReasonText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
});
