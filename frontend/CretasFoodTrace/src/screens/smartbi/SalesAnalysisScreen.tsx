/**
 * SmartBI - Sales Analysis Screen
 *
 * Provides detailed sales analysis with multiple dimensions
 * including personnel, products, customers, and regions.
 *
 * Features:
 * - Date range selection
 * - Dimension toggle (by person/product/customer/region)
 * - KPI cards
 * - Sales ranking list
 * - Sales trend chart
 * - Product distribution pie chart
 * - Drill-down capability
 *
 * @version 1.0.0
 * @since 2026-01-18
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Dimensions,
  Modal,
} from 'react-native';
import { Text, Card, Surface, ActivityIndicator, IconButton, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, RouteProp, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { smartBIApiClient } from '../../services/api/smartbi';
import { useAuthStore } from '../../store/authStore';
import { SmartBIStackParamList } from '../../types/smartbi';

// Type for MaterialCommunityIcons names
type MaterialCommunityIconName = keyof typeof MaterialCommunityIcons.glyphMap;

const { width: screenWidth } = Dimensions.get('window');

// Theme colors for SmartBI
const SMARTBI_THEME = {
  primary: '#4F46E5',
  secondary: '#7C3AED',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  background: '#F5F7FA',
  cardBackground: '#FFFFFF',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
};

// Chart colors
const CHART_COLORS = [
  '#4F46E5',
  '#7C3AED',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
];

// Analysis dimensions
type Dimension = 'person' | 'product' | 'customer' | 'region';

interface DimensionOption {
  key: Dimension;
  label: string;
  icon: MaterialCommunityIconName;
}

// Date range
interface DateRange {
  startDate: string;
  endDate: string;
}

// KPI Data
interface SalesKPI {
  totalSales: number;
  totalOrders: number;
  avgOrderValue: number;
  conversionRate: number;
  salesChange: number;
  ordersChange: number;
  avgOrderValueChange: number;
  conversionRateChange: number;
}

// Ranking Item
interface SalesRankingItem {
  id: string;
  rank: number;
  name: string;
  sales: number;
  orders: number;
  change: number;
  avatar?: string;
}

// Trend Data
interface TrendPoint {
  date: string;
  sales: number;
  orders: number;
}

// Distribution Data
interface DistributionItem {
  id: string;
  name: string;
  value: number;
  percentage: number;
}

// Full Sales Data
interface SalesAnalysisData {
  kpi: SalesKPI;
  ranking: SalesRankingItem[];
  trends: TrendPoint[];
  distribution: DistributionItem[];
}

type SalesAnalysisRouteProp = RouteProp<SmartBIStackParamList, 'SalesAnalysis'>;

// KPI Card Component
interface KPICardProps {
  title: string;
  value: string;
  change: number;
  icon: MaterialCommunityIconName;
  color: string;
}

const SalesKPICard: React.FC<KPICardProps> = ({ title, value, change, icon, color }) => {
  const isPositive = change >= 0;

  return (
    <Surface style={styles.kpiCard} elevation={2}>
      <View style={[styles.kpiIconContainer, { backgroundColor: color + '20' }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiTitle}>{title}</Text>
      <View style={styles.kpiChangeContainer}>
        <MaterialCommunityIcons
          name={isPositive ? 'arrow-up' : 'arrow-down'}
          size={12}
          color={isPositive ? SMARTBI_THEME.success : SMARTBI_THEME.danger}
        />
        <Text
          style={[
            styles.kpiChange,
            { color: isPositive ? SMARTBI_THEME.success : SMARTBI_THEME.danger },
          ]}
        >
          {Math.abs(change).toFixed(1)}%
        </Text>
      </View>
    </Surface>
  );
};

// Simple Bar Chart Component
interface BarChartProps {
  data: TrendPoint[];
}

const SimpleTrendChart: React.FC<BarChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <View style={styles.chartEmpty}>
        <MaterialCommunityIcons name="chart-line" size={32} color={SMARTBI_THEME.textMuted} />
        <Text style={styles.chartEmptyText}>暂无数据</Text>
      </View>
    );
  }

  const maxSales = Math.max(...data.map((d) => d.sales), 1);
  const chartHeight = 100;

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartBody}>
        {data.slice(-7).map((point, index) => {
          const height = (point.sales / maxSales) * chartHeight;
          return (
            <View key={index} style={styles.chartBar}>
              <View
                style={[
                  styles.chartBarFill,
                  { height, backgroundColor: SMARTBI_THEME.primary },
                ]}
              />
              <Text style={styles.chartBarLabel}>
                {new Date(point.date).getDate()}日
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// Simple Distribution Chart Component
interface PieChartProps {
  data: DistributionItem[];
}

const SimpleDistributionChart: React.FC<PieChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <View style={styles.chartEmpty}>
        <MaterialCommunityIcons name="chart-pie" size={32} color={SMARTBI_THEME.textMuted} />
        <Text style={styles.chartEmptyText}>暂无数据</Text>
      </View>
    );
  }

  return (
    <View style={styles.distributionContainer}>
      {data.slice(0, 5).map((item, index) => (
        <View key={item.id} style={styles.distributionItem}>
          <View style={styles.distributionInfo}>
            <View
              style={[
                styles.distributionDot,
                { backgroundColor: CHART_COLORS[index % CHART_COLORS.length] },
              ]}
            />
            <Text style={styles.distributionName} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <View style={styles.distributionBarContainer}>
            <View
              style={[
                styles.distributionBar,
                {
                  width: `${item.percentage}%`,
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                },
              ]}
            />
          </View>
          <Text style={styles.distributionPercentage}>{item.percentage.toFixed(1)}%</Text>
        </View>
      ))}
    </View>
  );
};

// Ranking Item Component
interface RankingItemProps {
  item: SalesRankingItem;
  onPress: () => void;
}

const SalesRankingItemComponent: React.FC<RankingItemProps> = ({ item, onPress }) => {
  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return SMARTBI_THEME.textSecondary;
  };

  const formatSales = (value: number): string => {
    if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}万`;
    }
    return value.toLocaleString();
  };

  return (
    <TouchableOpacity style={styles.rankingItem} onPress={onPress}>
      <View style={[styles.rankBadge, { backgroundColor: getRankColor(item.rank) + '20' }]}>
        <Text style={[styles.rankNumber, { color: getRankColor(item.rank) }]}>
          {item.rank}
        </Text>
      </View>
      <View style={styles.rankInfo}>
        <Text style={styles.rankName}>{item.name}</Text>
        <Text style={styles.rankOrders}>{item.orders}单</Text>
      </View>
      <View style={styles.rankSales}>
        <Text style={styles.rankSalesValue}>{formatSales(item.sales)}</Text>
        <View style={styles.rankChangeContainer}>
          <MaterialCommunityIcons
            name={item.change >= 0 ? 'arrow-up' : 'arrow-down'}
            size={12}
            color={item.change >= 0 ? SMARTBI_THEME.success : SMARTBI_THEME.danger}
          />
          <Text
            style={[
              styles.rankChangeText,
              { color: item.change >= 0 ? SMARTBI_THEME.success : SMARTBI_THEME.danger },
            ]}
          >
            {Math.abs(item.change).toFixed(1)}%
          </Text>
        </View>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={SMARTBI_THEME.textMuted}
      />
    </TouchableOpacity>
  );
};

export function SalesAnalysisScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SmartBIStackParamList>>();
  const route = useRoute<SalesAnalysisRouteProp>();
  const { department, region } = route.params || {};
  const { getFactoryId } = useAuthStore();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected dimension
  const [selectedDimension, setSelectedDimension] = useState<Dimension>('person');

  // Date range
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const startDateStr = start.toISOString().split('T')[0] ?? '';
    const endDateStr = end.toISOString().split('T')[0] ?? '';
    return {
      startDate: startDateStr,
      endDate: endDateStr,
    };
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [salesData, setSalesData] = useState<SalesAnalysisData | null>(null);

  const DIMENSIONS: DimensionOption[] = [
    { key: 'person', label: t('dimensions.person', { defaultValue: '按人员' }), icon: 'account' },
    { key: 'product', label: t('dimensions.product', { defaultValue: '按产品' }), icon: 'cube' },
    { key: 'customer', label: t('dimensions.customer', { defaultValue: '按客户' }), icon: 'domain' },
    { key: 'region', label: t('dimensions.region', { defaultValue: '按区域' }), icon: 'map-marker' },
  ];

  // Quick date range options
  const DATE_RANGE_OPTIONS = [
    { label: '近7天', days: 7 },
    { label: '近30天', days: 30 },
    { label: '近90天', days: 90 },
    { label: '本年', days: 365 },
  ];

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const factoryId = getFactoryId();

      const response = await smartBIApiClient.getSalesAnalysis({
        dimension: selectedDimension,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        factoryId: factoryId || undefined,
        department,
        region,
      });

      if (response.success && response.data) {
        setSalesData(response.data);
      } else {
        setError(response.message || t('errors.loadFailed', { defaultValue: '加载失败' }));
      }
    } catch (err) {
      console.error('Load sales analysis failed:', err);
      setError(t('errors.loadFailed', { defaultValue: '数据加载失败，请重试' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDimension, dateRange, getFactoryId, t, department, region]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    loadData();
  }, [selectedDimension, dateRange]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleDateRangeSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateRange({
      startDate: start.toISOString().split('T')[0] ?? '',
      endDate: end.toISOString().split('T')[0] ?? '',
    });
    setShowDatePicker(false);
  };

  const formatCurrency = (value: number): string => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(2)}亿`;
    }
    if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}万`;
    }
    return value.toLocaleString();
  };

  const handleDrillDown = (item: SalesRankingItem) => {
    navigation.navigate('DrillDown', {
      dimension: selectedDimension,
      value: item.id,
      parentContext: { name: item.name, sales: item.sales },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('sales.title', { defaultValue: '销售分析' })}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={SMARTBI_THEME.primary} />
          <Text style={styles.loadingText}>
            {t('common.loading', { defaultValue: '加载中...' })}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('sales.title', { defaultValue: '销售分析' })}
        </Text>
        <IconButton
          icon="calendar"
          size={24}
          onPress={() => setShowDatePicker(true)}
        />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[SMARTBI_THEME.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Date Range Display */}
        <TouchableOpacity
          style={styles.dateRangeDisplay}
          onPress={() => setShowDatePicker(true)}
        >
          <MaterialCommunityIcons
            name="calendar-range"
            size={18}
            color={SMARTBI_THEME.primary}
          />
          <Text style={styles.dateRangeText}>
            {dateRange.startDate} ~ {dateRange.endDate}
          </Text>
          <MaterialCommunityIcons
            name="chevron-down"
            size={18}
            color={SMARTBI_THEME.textSecondary}
          />
        </TouchableOpacity>

        {/* Dimension Selector */}
        <View style={styles.dimensionSelector}>
          {DIMENSIONS.map((dim) => (
            <TouchableOpacity
              key={dim.key}
              style={[
                styles.dimensionButton,
                selectedDimension === dim.key && styles.dimensionButtonActive,
              ]}
              onPress={() => setSelectedDimension(dim.key)}
            >
              <MaterialCommunityIcons
                name={dim.icon}
                size={16}
                color={
                  selectedDimension === dim.key ? '#fff' : SMARTBI_THEME.textSecondary
                }
              />
              <Text
                style={[
                  styles.dimensionButtonText,
                  selectedDimension === dim.key && styles.dimensionButtonTextActive,
                ]}
              >
                {dim.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Error Banner */}
        {error && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={20}
              color={SMARTBI_THEME.danger}
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* KPI Cards */}
        {salesData && (
          <View style={styles.kpiGrid}>
            <SalesKPICard
              title={t('kpi.totalSales', { defaultValue: '销售额' })}
              value={formatCurrency(salesData.kpi.totalSales)}
              change={salesData.kpi.salesChange}
              icon="currency-cny"
              color={SMARTBI_THEME.primary}
            />
            <SalesKPICard
              title={t('kpi.totalOrders', { defaultValue: '订单数' })}
              value={salesData.kpi.totalOrders.toLocaleString()}
              change={salesData.kpi.ordersChange}
              icon="shopping"
              color={SMARTBI_THEME.info}
            />
            <SalesKPICard
              title={t('kpi.avgOrderValue', { defaultValue: '客单价' })}
              value={`${salesData.kpi.avgOrderValue.toFixed(0)}`}
              change={salesData.kpi.avgOrderValueChange}
              icon="receipt"
              color={SMARTBI_THEME.success}
            />
            <SalesKPICard
              title={t('kpi.conversionRate', { defaultValue: '转化率' })}
              value={`${salesData.kpi.conversionRate.toFixed(1)}%`}
              change={salesData.kpi.conversionRateChange}
              icon="percent"
              color={SMARTBI_THEME.warning}
            />
          </View>
        )}

        {/* Sales Ranking */}
        {salesData && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t('sales.ranking', { defaultValue: '销售排行' })}
              </Text>
              <TouchableOpacity>
                <Text style={styles.viewAll}>
                  {t('common.viewAll', { defaultValue: '查看全部' })}
                </Text>
              </TouchableOpacity>
            </View>
            <Card style={styles.rankingCard}>
              {salesData.ranking.slice(0, 5).map((item, index) => (
                <React.Fragment key={item.id}>
                  <SalesRankingItemComponent
                    item={item}
                    onPress={() => handleDrillDown(item)}
                  />
                  {index < Math.min(salesData.ranking.length, 5) - 1 && (
                    <Divider style={styles.divider} />
                  )}
                </React.Fragment>
              ))}
            </Card>
          </View>
        )}

        {/* Sales Trend */}
        {salesData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('sales.trend', { defaultValue: '销售趋势' })}
            </Text>
            <Card style={styles.chartCard}>
              <Card.Content>
                <SimpleTrendChart data={salesData.trends} />
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Product Distribution */}
        {salesData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('sales.distribution', { defaultValue: '产品占比' })}
            </Text>
            <Card style={styles.chartCard}>
              <Card.Content>
                <SimpleDistributionChart data={salesData.distribution} />
              </Card.Content>
            </Card>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Date Range Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t('dateRange.title', { defaultValue: '选择日期范围' })}
            </Text>
            {DATE_RANGE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.days}
                style={styles.modalOption}
                onPress={() => handleDateRangeSelect(option.days)}
              >
                <Text style={styles.modalOptionText}>{option.label}</Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={SMARTBI_THEME.textMuted}
                />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.modalCancelText}>
                {t('common.cancel', { defaultValue: '取消' })}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SMARTBI_THEME.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SMARTBI_THEME.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: SMARTBI_THEME.textSecondary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  dateRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SMARTBI_THEME.cardBackground,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  dateRangeText: {
    fontSize: 14,
    color: SMARTBI_THEME.textPrimary,
  },
  dimensionSelector: {
    flexDirection: 'row',
    backgroundColor: SMARTBI_THEME.cardBackground,
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  dimensionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
    gap: 4,
  },
  dimensionButtonActive: {
    backgroundColor: SMARTBI_THEME.primary,
  },
  dimensionButtonText: {
    fontSize: 13,
    color: SMARTBI_THEME.textSecondary,
    fontWeight: '500',
  },
  dimensionButtonTextActive: {
    color: '#fff',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: SMARTBI_THEME.danger,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 16,
  },
  kpiCard: {
    width: (screenWidth - 48) / 2,
    margin: 4,
    padding: 12,
    borderRadius: 10,
    backgroundColor: SMARTBI_THEME.cardBackground,
    alignItems: 'center',
  },
  kpiIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: SMARTBI_THEME.textPrimary,
  },
  kpiTitle: {
    fontSize: 12,
    color: SMARTBI_THEME.textSecondary,
    marginTop: 2,
  },
  kpiChangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  kpiChange: {
    fontSize: 11,
    fontWeight: '500',
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
    color: SMARTBI_THEME.textPrimary,
  },
  viewAll: {
    fontSize: 14,
    color: SMARTBI_THEME.primary,
  },
  rankingCard: {
    borderRadius: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
    overflow: 'hidden',
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: 14,
    fontWeight: '500',
    color: SMARTBI_THEME.textPrimary,
  },
  rankOrders: {
    fontSize: 12,
    color: SMARTBI_THEME.textSecondary,
    marginTop: 2,
  },
  rankSales: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  rankSalesValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
  },
  rankChangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  rankChangeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  divider: {
    marginHorizontal: 12,
  },
  chartCard: {
    borderRadius: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
  },
  chartContainer: {
    paddingVertical: 8,
  },
  chartBody: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
    paddingBottom: 24,
  },
  chartBar: {
    alignItems: 'center',
    width: 32,
  },
  chartBarFill: {
    width: 20,
    borderRadius: 4,
  },
  chartBarLabel: {
    fontSize: 10,
    color: SMARTBI_THEME.textMuted,
    marginTop: 4,
  },
  chartEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  chartEmptyText: {
    marginTop: 8,
    fontSize: 14,
    color: SMARTBI_THEME.textMuted,
  },
  distributionContainer: {
    paddingVertical: 8,
  },
  distributionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  distributionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
  },
  distributionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  distributionName: {
    fontSize: 12,
    color: SMARTBI_THEME.textSecondary,
    flex: 1,
  },
  distributionBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: SMARTBI_THEME.border,
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  distributionBar: {
    height: '100%',
    borderRadius: 4,
  },
  distributionPercentage: {
    fontSize: 12,
    fontWeight: '500',
    color: SMARTBI_THEME.textPrimary,
    width: 50,
    textAlign: 'right',
  },
  bottomSpacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SMARTBI_THEME.border,
  },
  modalOptionText: {
    fontSize: 16,
    color: SMARTBI_THEME.textPrimary,
  },
  modalCancelButton: {
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: SMARTBI_THEME.background,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: SMARTBI_THEME.textSecondary,
  },
});

export default SalesAnalysisScreen;
