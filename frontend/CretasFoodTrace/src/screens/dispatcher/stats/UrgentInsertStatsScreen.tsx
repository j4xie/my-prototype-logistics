/**
 * 紧急插单统计页面
 *
 * 核心功能:
 * - 总体统计卡片（总插单次数、成功率、平均影响评分、强制插单比例）
 * - 按时段分布统计（早班/晚班）
 * - 按产品类型分布
 * - 最近插单记录列表
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { isAxiosError } from 'axios';
import { DISPATCHER_THEME, UrgentInsertStatistics } from '../../../types/dispatcher';
import { schedulingApiClient } from '../../../services/api/schedulingApiClient';

export default function UrgentInsertStatsScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<UrgentInsertStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const response = await schedulingApiClient.getUrgentInsertStatistics();
      if (response.success && response.data) {
        setStatistics(response.data);
      } else {
        console.error('API returned error:', response.message);
        setError(response.message || '加载统计数据失败');
        setStatistics(null);
      }
    } catch (err) {
      console.error('Failed to load urgent insert statistics:', err);
      if (isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) {
          Alert.alert('错误', '登录已过期，请重新登录');
        } else if (status === 404) {
          setError('暂无插单统计数据');
        } else {
          setError(err.response?.data?.message || '加载统计数据失败');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('加载统计数据失败');
      }
      setStatistics(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return DISPATCHER_THEME.success;
      case 'failed':
        return DISPATCHER_THEME.danger;
      case 'pending':
        return DISPATCHER_THEME.warning;
      default:
        return DISPATCHER_THEME.textMuted;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return '成功';
      case 'failed':
        return '失败';
      case 'pending':
        return '待处理';
      default:
        return status;
    }
  };

  const getImpactColor = (score: number) => {
    if (score <= 2) return DISPATCHER_THEME.success;
    if (score <= 3.5) return DISPATCHER_THEME.warning;
    return DISPATCHER_THEME.danger;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>插单统计</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // If no statistics data, show empty state message
  if (!statistics) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>插单统计</Text>
          <View style={styles.placeholder} />
        </View>
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.emptyStateContainer}
        >
          {error && (
            <View style={styles.errorBanner}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#d46b08" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="chart-bar" size={64} color={DISPATCHER_THEME.textMuted} />
            <Text style={styles.emptyStateText}>暂无插单统计数据</Text>
            <Text style={styles.emptyStateSubText}>下拉刷新重试</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const data = statistics;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>插单统计</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#d46b08" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Overview Statistics Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statsCard}>
            <View style={[styles.statsIconContainer, { backgroundColor: '#e6f7ff' }]}>
              <MaterialCommunityIcons name="flash" size={24} color="#1890ff" />
            </View>
            <Text style={styles.statsValue}>{data.totalInserts}</Text>
            <Text style={styles.statsLabel}>总插单次数</Text>
          </View>

          <View style={styles.statsCard}>
            <View style={[styles.statsIconContainer, { backgroundColor: '#f6ffed' }]}>
              <MaterialCommunityIcons name="check-circle" size={24} color="#52c41a" />
            </View>
            <Text style={[styles.statsValue, { color: DISPATCHER_THEME.success }]}>
              {data.successRate.toFixed(1)}%
            </Text>
            <Text style={styles.statsLabel}>成功率</Text>
          </View>

          <View style={styles.statsCard}>
            <View style={[styles.statsIconContainer, { backgroundColor: '#fff7e6' }]}>
              <MaterialCommunityIcons name="speedometer" size={24} color="#fa8c16" />
            </View>
            <Text style={[styles.statsValue, { color: getImpactColor(data.averageImpactScore) }]}>
              {data.averageImpactScore.toFixed(1)}
            </Text>
            <Text style={styles.statsLabel}>平均影响评分</Text>
          </View>

          <View style={styles.statsCard}>
            <View style={[styles.statsIconContainer, { backgroundColor: '#fff1f0' }]}>
              <MaterialCommunityIcons name="alert" size={24} color="#ff4d4f" />
            </View>
            <Text style={[styles.statsValue, { color: DISPATCHER_THEME.danger }]}>
              {data.forcedInsertRate.toFixed(1)}%
            </Text>
            <Text style={styles.statsLabel}>强制插单比例</Text>
          </View>
        </View>

        {/* Period Distribution */}
        {data.byPeriod && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="clock-outline" size={20} color={DISPATCHER_THEME.primary} />
              <Text style={styles.sectionTitle}>按时段分布</Text>
            </View>
            <View style={styles.periodContainer}>
              <View style={styles.periodItem}>
                <View style={styles.periodIcon}>
                  <MaterialCommunityIcons name="weather-sunny" size={20} color="#fa8c16" />
                </View>
                <View style={styles.periodInfo}>
                  <Text style={styles.periodLabel}>早班</Text>
                  <Text style={styles.periodValue}>{data.byPeriod.dayShift} 次</Text>
                </View>
                <View style={styles.periodBar}>
                  <View
                    style={[
                      styles.periodBarFill,
                      {
                        width: `${(data.byPeriod.dayShift / data.totalInserts) * 100}%`,
                        backgroundColor: '#fa8c16',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.periodPercent}>
                  {((data.byPeriod.dayShift / data.totalInserts) * 100).toFixed(0)}%
                </Text>
              </View>

              <View style={styles.periodItem}>
                <View style={styles.periodIcon}>
                  <MaterialCommunityIcons name="weather-night" size={20} color="#722ed1" />
                </View>
                <View style={styles.periodInfo}>
                  <Text style={styles.periodLabel}>晚班</Text>
                  <Text style={styles.periodValue}>{data.byPeriod.nightShift} 次</Text>
                </View>
                <View style={styles.periodBar}>
                  <View
                    style={[
                      styles.periodBarFill,
                      {
                        width: `${(data.byPeriod.nightShift / data.totalInserts) * 100}%`,
                        backgroundColor: '#722ed1',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.periodPercent}>
                  {((data.byPeriod.nightShift / data.totalInserts) * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Product Type Distribution */}
        {data.byProductType && data.byProductType.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="package-variant" size={20} color={DISPATCHER_THEME.primary} />
              <Text style={styles.sectionTitle}>按产品类型分布</Text>
            </View>
            <View style={styles.productTypeList}>
              {data.byProductType.map((item, index) => (
                <View key={index} style={styles.productTypeItem}>
                  <View style={styles.productTypeRank}>
                    <Text style={styles.productTypeRankText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.productTypeName}>{item.productTypeName}</Text>
                  <View style={styles.productTypeBar}>
                    <View
                      style={[
                        styles.productTypeBarFill,
                        {
                          width: `${(item.count / (data.byProductType?.[0]?.count || 1)) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.productTypeCount}>{item.count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Trend Chart (Simple Bar Representation) */}
        {data.trend && data.trend.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="chart-line" size={20} color={DISPATCHER_THEME.primary} />
              <Text style={styles.sectionTitle}>最近7天趋势</Text>
            </View>
            <View style={styles.trendContainer}>
              {data.trend.map((item, index) => {
                const maxCount = Math.max(...data.trend!.map(t => t.count));
                const height = (item.count / maxCount) * 80;
                const successHeight = (item.successCount / maxCount) * 80;
                return (
                  <View key={index} style={styles.trendItem}>
                    <View style={styles.trendBarContainer}>
                      <View style={[styles.trendBar, { height }]}>
                        <View style={[styles.trendBarSuccess, { height: successHeight }]} />
                      </View>
                    </View>
                    <Text style={styles.trendDate}>{item.date}</Text>
                    <Text style={styles.trendCount}>{item.count}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.trendLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#e6f7ff' }]} />
                <Text style={styles.legendText}>总数</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: DISPATCHER_THEME.primary }]} />
                <Text style={styles.legendText}>成功</Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent Insert Records */}
        {data.recentInserts && data.recentInserts.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="history" size={20} color={DISPATCHER_THEME.primary} />
              <Text style={styles.sectionTitle}>最近插单记录</Text>
            </View>
            <View style={styles.recordList}>
              {data.recentInserts.map((record) => (
                <View key={record.id} style={styles.recordItem}>
                  <View style={styles.recordLeft}>
                    <View style={styles.recordHeader}>
                      <Text style={styles.recordProduct}>{record.productName}</Text>
                      {record.isForced && (
                        <View style={styles.forcedBadge}>
                          <Text style={styles.forcedBadgeText}>强制</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.recordMeta}>
                      {record.quantity}kg | {record.createdAt}
                    </Text>
                  </View>
                  <View style={styles.recordRight}>
                    <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(record.status)}20` }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(record.status) }]}>
                        {getStatusText(record.status)}
                      </Text>
                    </View>
                    <View style={styles.impactScore}>
                      <MaterialCommunityIcons
                        name="speedometer"
                        size={14}
                        color={getImpactColor(record.impactScore)}
                      />
                      <Text style={[styles.impactValue, { color: getImpactColor(record.impactScore) }]}>
                        {record.impactScore.toFixed(1)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Summary Stats */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>成功插单</Text>
            <Text style={[styles.summaryValue, { color: DISPATCHER_THEME.success }]}>
              {data.successfulInserts} 次
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>失败插单</Text>
            <Text style={[styles.summaryValue, { color: DISPATCHER_THEME.danger }]}>
              {data.failedInserts} 次
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>强制插单</Text>
            <Text style={[styles.summaryValue, { color: DISPATCHER_THEME.warning }]}>
              {data.forcedInsertCount} 次
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DISPATCHER_THEME.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: DISPATCHER_THEME.primary,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: DISPATCHER_THEME.textMuted,
  },
  emptyStateContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: DISPATCHER_THEME.textPrimary,
    marginTop: 16,
  },
  emptyStateSubText: {
    fontSize: 14,
    color: DISPATCHER_THEME.textMuted,
    marginTop: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7e6',
    borderWidth: 1,
    borderColor: '#ffd591',
    borderRadius: 8,
    padding: 12,
    margin: 16,
    marginBottom: 0,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#d46b08',
    flex: 1,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statsCard: {
    width: '47%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: DISPATCHER_THEME.textPrimary,
  },
  statsLabel: {
    fontSize: 12,
    color: DISPATCHER_THEME.textMuted,
    marginTop: 4,
  },

  // Section Card
  sectionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: DISPATCHER_THEME.textPrimary,
  },

  // Period Distribution
  periodContainer: {
    gap: 16,
  },
  periodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  periodIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodInfo: {
    width: 60,
  },
  periodLabel: {
    fontSize: 12,
    color: DISPATCHER_THEME.textMuted,
  },
  periodValue: {
    fontSize: 14,
    fontWeight: '600',
    color: DISPATCHER_THEME.textPrimary,
  },
  periodBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  periodBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  periodPercent: {
    width: 40,
    fontSize: 13,
    fontWeight: '600',
    color: DISPATCHER_THEME.textSecondary,
    textAlign: 'right',
  },

  // Product Type Distribution
  productTypeList: {
    gap: 12,
  },
  productTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  productTypeRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: DISPATCHER_THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productTypeRankText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  productTypeName: {
    width: 80,
    fontSize: 13,
    color: DISPATCHER_THEME.textPrimary,
  },
  productTypeBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  productTypeBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: DISPATCHER_THEME.secondary,
  },
  productTypeCount: {
    width: 30,
    fontSize: 13,
    fontWeight: '600',
    color: DISPATCHER_THEME.textSecondary,
    textAlign: 'right',
  },

  // Trend Chart
  trendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 20,
  },
  trendItem: {
    alignItems: 'center',
    flex: 1,
  },
  trendBarContainer: {
    height: 80,
    justifyContent: 'flex-end',
  },
  trendBar: {
    width: 24,
    backgroundColor: '#e6f7ff',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  trendBarSuccess: {
    width: '100%',
    backgroundColor: DISPATCHER_THEME.primary,
    borderRadius: 4,
  },
  trendDate: {
    fontSize: 10,
    color: DISPATCHER_THEME.textMuted,
    marginTop: 6,
  },
  trendCount: {
    fontSize: 11,
    fontWeight: '600',
    color: DISPATCHER_THEME.textSecondary,
    marginTop: 2,
  },
  trendLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
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
    color: DISPATCHER_THEME.textMuted,
  },

  // Record List
  recordList: {
    gap: 12,
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  recordLeft: {
    flex: 1,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordProduct: {
    fontSize: 14,
    fontWeight: '500',
    color: DISPATCHER_THEME.textPrimary,
  },
  forcedBadge: {
    backgroundColor: '#fff1f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  forcedBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#ff4d4f',
  },
  recordMeta: {
    fontSize: 12,
    color: DISPATCHER_THEME.textMuted,
    marginTop: 4,
  },
  recordRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  impactScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  impactValue: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Summary Card
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryLabel: {
    fontSize: 14,
    color: DISPATCHER_THEME.textSecondary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
});
