/**
 * 今日产量详情页面
 * 显示今日生产统计数据和批次列表
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { FAHomeStackParamList } from '../../../types/navigation';
import { dashboardAPI, ProductionStatisticsData } from '../../../services/api/dashboardApiClient';

type NavigationProp = NativeStackNavigationProp<FAHomeStackParamList, 'TodayProduction'>;

export function TodayProductionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation('home');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ProductionStatisticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const response = await dashboardAPI.getProductionStatistics({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
      });
      if (response.success && response.data) {
        setData(response.data);
      }
    } catch (err) {
      console.error('加载生产数据失败:', err);
      setError(t('todayProduction.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // 计算总产量
  const totalQuantity = data?.batchStatusDistribution?.reduce(
    (sum, item) => sum + (item.totalQuantity || 0),
    0
  ) ?? 0;

  const totalBatches = data?.batchStatusDistribution?.reduce(
    (sum, item) => sum + (item.count || 0),
    0
  ) ?? 0;

  // 获取状态标签（使用i18n）
  const getStatusLabelTranslated = (status: string): string => {
    const normalizedStatus = status?.toUpperCase();
    const statusKeys: Record<string, string> = {
      PLANNED: 'todayProduction.status.planned',
      PENDING: 'todayProduction.status.pending',
      IN_PROGRESS: 'todayProduction.status.inProgress',
      PROCESSING: 'todayProduction.status.processing',
      COMPLETED: 'todayProduction.status.completed',
      CANCELLED: 'todayProduction.status.cancelled',
      PAUSED: 'todayProduction.status.paused',
    };
    const key = statusKeys[normalizedStatus];
    return key ? t(key) : status;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('todayProduction.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
        }
      >
        {/* 错误提示 */}
        {error && (
          <View style={styles.errorBanner}>
            <Icon source="alert-circle" size={20} color="#e53e3e" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* 总产量卡片 */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalQuantity.toFixed(0)}</Text>
              <Text style={styles.summaryLabel}>{t('todayProduction.totalOutput')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalBatches}</Text>
              <Text style={styles.summaryLabel}>{t('todayProduction.batchCount')}</Text>
            </View>
          </View>
        </View>

        {/* 状态分布 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('todayProduction.statusDistribution')}</Text>
          {data?.batchStatusDistribution?.map((item, index) => (
            <View key={index} style={styles.statusItem}>
              <View style={styles.statusLeft}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                <Text style={styles.statusName}>{getStatusLabelTranslated(item.status)}</Text>
              </View>
              <View style={styles.statusRight}>
                <Text style={styles.statusCount}>{item.count} {t('todayProduction.batchUnit')}</Text>
                <Text style={styles.statusQty}>{item.totalQuantity?.toFixed(0) ?? 0} kg</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 产品类型统计 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('todayProduction.productTypeStats')}</Text>
          {data?.productTypeStats?.map((item, index) => (
            <View key={index} style={styles.productItem}>
              <View style={styles.productLeft}>
                <View style={[styles.productIcon, { backgroundColor: getProductColor(index) }]}>
                  <Icon source="cube-outline" size={16} color="#fff" />
                </View>
                <Text style={styles.productName} numberOfLines={1}>
                  {(item as any).productTypeName || item.productType || (item as any).productTypeId || t('todayProduction.unknownProduct')}
                </Text>
              </View>
              <View style={styles.productStats}>
                <Text style={styles.productCount}>{item.count} {t('todayProduction.batchUnit')}</Text>
                <Text style={styles.productQty}>{item.totalQuantity?.toFixed(0) ?? 0} kg</Text>
              </View>
            </View>
          ))}
          {(!data?.productTypeStats || data.productTypeStats.length === 0) && (
            <Text style={styles.emptyText}>{t('todayProduction.noProductData')}</Text>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// 获取状态颜色
function getStatusColor(status: string): string {
  const normalizedStatus = status?.toUpperCase();
  const colors: Record<string, string> = {
    PLANNED: '#ed8936',
    PENDING: '#ed8936',
    IN_PROGRESS: '#667eea',
    PROCESSING: '#667eea',
    COMPLETED: '#48bb78',
    CANCELLED: '#a0aec0',
    PAUSED: '#a0aec0',
  };
  return colors[normalizedStatus] || '#a0aec0';
}

// 获取状态标签（中文）- 该函数需要在组件内部调用以使用t函数
function getStatusLabel(status: string): string {
  // Note: This is a fallback. The actual translation happens in the component
  const normalizedStatus = status?.toUpperCase();
  return normalizedStatus || status;
}

// 获取产品颜色
function getProductColor(index: number): string {
  const colors = ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#9f7aea', '#38b2ac', '#f56565', '#4299e1'];
  return colors[index % colors.length] ?? '#667eea';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
  },
  scrollView: {
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fed7d7',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#c53030',
  },
  summaryCard: {
    margin: 16,
    padding: 20,
    backgroundColor: '#667eea',
    borderRadius: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 16,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusName: {
    fontSize: 15,
    color: '#333',
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusCount: {
    fontSize: 14,
    color: '#666',
    marginRight: 12,
  },
  statusQty: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  productLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  productIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  productName: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  productStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productCount: {
    fontSize: 14,
    color: '#666',
    marginRight: 12,
  },
  productQty: {
    fontSize: 14,
    fontWeight: '500',
    color: '#667eea',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default TodayProductionScreen;
