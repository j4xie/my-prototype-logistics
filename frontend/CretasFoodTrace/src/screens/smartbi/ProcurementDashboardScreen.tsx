/**
 * SmartBI - Procurement Dashboard Screen
 *
 * Provides comprehensive procurement analytics including supplier evaluation,
 * procurement trends, and category distribution.
 *
 * Features:
 * - RADAR chart: Supplier evaluation (5 dimensions)
 * - LINE_BAR chart: Procurement trend (amount + unit price)
 * - PIE chart: Procurement by category
 * - Ranking list: Supplier performance ranking
 * - KPI cards: Total procurement, On-time rate, Quality pass rate
 *
 * @version 1.0.0
 * @since 2026-01-18
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { Text, Card, Surface, ActivityIndicator, IconButton, Divider, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { formatNumberWithCommas } from '../../utils/formatters';

import {
  MobileRadarChart,
  MobileLineChart,
  MobilePieChart,
  MobileKPICard,
  MobileRankingList,
} from '../../components/smartbi';
import type { RadarDataset, LineDataSeries, LineDataPoint, PieDataItem, RankingItem } from '../../components/smartbi';
import { smartBIApiClient } from '../../services/api/smartbi';
import { useAuthStore } from '../../store/authStore';
import type { SmartBIStackParamList, ProcurementKPI, SupplierEvaluation, ProcurementCategory } from '../../types/smartbi';

const { width: screenWidth } = Dimensions.get('window');

// Theme colors for SmartBI
const SMARTBI_THEME = {
  primary: '#4F46E5',
  secondary: '#10B981',
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

// Category colors
const CATEGORY_COLORS = [
  '#4F46E5',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
];

// Date range options
const DATE_RANGE_OPTIONS = [
  { label: '今日', key: 'today', days: 0 },
  { label: '本周', key: 'week', days: 7 },
  { label: '本月', key: 'month', days: 30 },
  { label: '本季', key: 'quarter', days: 90 },
];

// Radar chart dimension labels
const RADAR_LABELS = ['价格竞争力', '质量', '交付', '服务', '稳定性'];

// Mock data generator for demonstration
function generateMockData() {
  const procurementKPI: ProcurementKPI = {
    totalAmount: 5680000,
    amountChange: 12.5,
    batchCount: 256,
    countChange: 8.3,
    onTimeRate: 94.5,
    onTimeChange: 2.1,
    qualityPassRate: 98.2,
    passRateChange: 0.5,
  };

  const supplierEvaluations: SupplierEvaluation[] = [
    {
      supplierId: '1',
      supplierName: '优质供应商A',
      dimensions: { price: 85, quality: 92, delivery: 88, service: 90, stability: 86 },
      overallScore: 88.2,
      rank: 1,
    },
    {
      supplierId: '2',
      supplierName: '合作供应商B',
      dimensions: { price: 78, quality: 88, delivery: 82, service: 85, stability: 80 },
      overallScore: 82.6,
      rank: 2,
    },
    {
      supplierId: '3',
      supplierName: '新晋供应商C',
      dimensions: { price: 90, quality: 75, delivery: 78, service: 72, stability: 70 },
      overallScore: 77.0,
      rank: 3,
    },
    {
      supplierId: '4',
      supplierName: '稳定供应商D',
      dimensions: { price: 72, quality: 80, delivery: 85, service: 78, stability: 88 },
      overallScore: 80.6,
      rank: 4,
    },
    {
      supplierId: '5',
      supplierName: '经济供应商E',
      dimensions: { price: 92, quality: 70, delivery: 72, service: 68, stability: 65 },
      overallScore: 73.4,
      rank: 5,
    },
  ];

  const categories: ProcurementCategory[] = [
    { category: '原材料', amount: 2850000, percentage: 50.2, count: 120 },
    { category: '包装材料', amount: 1280000, percentage: 22.5, count: 68 },
    { category: '辅料', amount: 850000, percentage: 15.0, count: 45 },
    { category: '设备配件', amount: 420000, percentage: 7.4, count: 15 },
    { category: '其他', amount: 280000, percentage: 4.9, count: 8 },
  ];

  // Generate procurement trend data
  const procurementTrend: LineDataPoint[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    procurementTrend.push({
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      value: 700000 + Math.random() * 300000,
    });
  }

  return { procurementKPI, supplierEvaluations, categories, procurementTrend };
}

// Supplier Ranking Item Component
interface SupplierItemProps {
  supplier: SupplierEvaluation;
  onPress?: () => void;
}

const SupplierItem: React.FC<SupplierItemProps> = ({ supplier, onPress }) => {
  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return SMARTBI_THEME.textSecondary;
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return SMARTBI_THEME.success;
    if (score >= 70) return SMARTBI_THEME.warning;
    return SMARTBI_THEME.danger;
  };

  return (
    <TouchableOpacity style={styles.supplierItem} onPress={onPress}>
      <View style={[styles.rankBadge, { backgroundColor: getRankColor(supplier.rank) + '20' }]}>
        <Text style={[styles.rankNumber, { color: getRankColor(supplier.rank) }]}>
          {supplier.rank}
        </Text>
      </View>
      <View style={styles.supplierInfo}>
        <Text style={styles.supplierName}>{supplier.supplierName}</Text>
        <View style={styles.dimensionTags}>
          <Text style={styles.dimensionTag}>质量:{supplier.dimensions.quality}</Text>
          <Text style={styles.dimensionTag}>交付:{supplier.dimensions.delivery}</Text>
        </View>
      </View>
      <View style={styles.supplierScore}>
        <Text style={[styles.scoreValue, { color: getScoreColor(supplier.overallScore) }]}>
          {supplier.overallScore.toFixed(1)}
        </Text>
        <Text style={styles.scoreLabel}>综合评分</Text>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={SMARTBI_THEME.textMuted}
      />
    </TouchableOpacity>
  );
};

export function ProcurementDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SmartBIStackParamList>>();
  const { getFactoryId } = useAuthStore();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState('month');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierEvaluation | null>(null);

  // Data states
  const [procurementKPI, setProcurementKPI] = useState<ProcurementKPI | null>(null);
  const [supplierEvaluations, setSupplierEvaluations] = useState<SupplierEvaluation[]>([]);
  const [categories, setCategories] = useState<ProcurementCategory[]>([]);
  const [procurementTrend, setProcurementTrend] = useState<LineDataPoint[]>([]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      // TODO: Replace with actual API call when backend is ready
      // const factoryId = getFactoryId();
      // const response = await smartBIApiClient.getProcurementDashboard({ period: selectedDateRange, factoryId });

      // Mock data for now
      await new Promise(resolve => setTimeout(resolve, 800));
      const mockData = generateMockData();
      setProcurementKPI(mockData.procurementKPI);
      setSupplierEvaluations(mockData.supplierEvaluations);
      setCategories(mockData.categories);
      setProcurementTrend(mockData.procurementTrend);

      // Set default selected supplier for radar chart
      if (mockData.supplierEvaluations.length > 0) {
        setSelectedSupplier(mockData.supplierEvaluations[0] ?? null);
      }
    } catch (err) {
      console.error('Load procurement dashboard failed:', err);
      setError(t('errors.loadFailed', { defaultValue: '数据加载失败，请重试' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDateRange, getFactoryId, t]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [selectedDateRange]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleDateRangeSelect = (key: string) => {
    setSelectedDateRange(key);
    setShowDatePicker(false);
  };

  // Prepare radar chart data
  const radarDatasets: RadarDataset[] = useMemo(() => {
    if (!selectedSupplier) return [];

    return [{
      label: selectedSupplier.supplierName,
      data: [
        selectedSupplier.dimensions.price,
        selectedSupplier.dimensions.quality,
        selectedSupplier.dimensions.delivery,
        selectedSupplier.dimensions.service,
        selectedSupplier.dimensions.stability,
      ],
      color: SMARTBI_THEME.primary,
    }];
  }, [selectedSupplier]);

  // Compare top 2 suppliers
  const radarCompareDatasets: RadarDataset[] = useMemo(() => {
    if (supplierEvaluations.length < 2) return [];

    const supplier1 = supplierEvaluations[0];
    const supplier2 = supplierEvaluations[1];

    if (!supplier1 || !supplier2) return [];

    return [
      {
        label: supplier1.supplierName,
        data: [
          supplier1.dimensions.price,
          supplier1.dimensions.quality,
          supplier1.dimensions.delivery,
          supplier1.dimensions.service,
          supplier1.dimensions.stability,
        ],
        color: SMARTBI_THEME.primary,
      },
      {
        label: supplier2.supplierName,
        data: [
          supplier2.dimensions.price,
          supplier2.dimensions.quality,
          supplier2.dimensions.delivery,
          supplier2.dimensions.service,
          supplier2.dimensions.stability,
        ],
        color: SMARTBI_THEME.secondary,
      },
    ];
  }, [supplierEvaluations]);

  // Prepare pie chart data for categories
  const categoryPieData: PieDataItem[] = useMemo(() => {
    return categories.map((item, index) => ({
      name: `${item.category} (${item.percentage}%)`,
      value: item.amount,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }));
  }, [categories]);

  // Prepare line chart data for procurement trend
  const trendLabels: string[] = useMemo(() => {
    return procurementTrend.map(item => item.label);
  }, [procurementTrend]);

  const trendData: LineDataSeries[] = useMemo(() => {
    return [{
      name: '采购金额',
      data: procurementTrend.map(item => item.value),
      color: SMARTBI_THEME.primary,
    }];
  }, [procurementTrend]);

  // Format currency for display
  const formatCurrency = (value: number): string => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(2)}亿`;
    }
    if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}万`;
    }
    return formatNumberWithCommas(value);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('procurement.title', { defaultValue: '采购分析' })}
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
          {t('procurement.title', { defaultValue: '采购分析' })}
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
        {/* Date Range Selector */}
        <View style={styles.dateRangeSelector}>
          {DATE_RANGE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.dateRangeButton,
                selectedDateRange === option.key && styles.dateRangeButtonActive,
              ]}
              onPress={() => setSelectedDateRange(option.key)}
            >
              <Text
                style={[
                  styles.dateRangeButtonText,
                  selectedDateRange === option.key && styles.dateRangeButtonTextActive,
                ]}
              >
                {option.label}
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
        {procurementKPI && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('procurement.keyMetrics', { defaultValue: '关键指标' })}
            </Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="采购总额"
                  value={formatCurrency(procurementKPI.totalAmount)}
                  changeRate={procurementKPI.amountChange}
                  trend={procurementKPI.amountChange >= 0 ? 'up' : 'down'}
                  status="neutral"
                  isCurrency
                  width={(screenWidth - 48) / 2}
                />
              </View>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="采购批次"
                  value={procurementKPI.batchCount}
                  unit="批"
                  changeRate={procurementKPI.countChange}
                  trend={procurementKPI.countChange >= 0 ? 'up' : 'down'}
                  status="neutral"
                  width={(screenWidth - 48) / 2}
                />
              </View>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="准时交付率"
                  value={procurementKPI.onTimeRate}
                  unit="%"
                  changeRate={procurementKPI.onTimeChange}
                  trend={procurementKPI.onTimeChange >= 0 ? 'up' : 'down'}
                  status={procurementKPI.onTimeRate >= 95 ? 'green' : procurementKPI.onTimeRate >= 85 ? 'yellow' : 'red'}
                  width={(screenWidth - 48) / 2}
                />
              </View>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="质量合格率"
                  value={procurementKPI.qualityPassRate}
                  unit="%"
                  changeRate={procurementKPI.passRateChange}
                  trend={procurementKPI.passRateChange >= 0 ? 'up' : 'down'}
                  status={procurementKPI.qualityPassRate >= 98 ? 'green' : procurementKPI.qualityPassRate >= 95 ? 'yellow' : 'red'}
                  width={(screenWidth - 48) / 2}
                />
              </View>
            </View>
          </View>
        )}

        {/* Supplier Radar Chart (Compare Top 2) */}
        {radarCompareDatasets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('procurement.supplierComparison', { defaultValue: '供应商对比评估' })}
            </Text>
            <Card style={styles.chartCard}>
              <Card.Content>
                <MobileRadarChart
                  labels={RADAR_LABELS}
                  datasets={radarCompareDatasets}
                  maxValue={100}
                  size={screenWidth - 80}
                  showLegend
                />
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Procurement Trend Chart */}
        {procurementTrend.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('procurement.trend', { defaultValue: '采购趋势' })}
            </Text>
            <Card style={styles.chartCard}>
              <Card.Content>
                <MobileLineChart
                  labels={trendLabels}
                  datasets={trendData}
                  width={screenWidth - 64}
                  height={200}
                  showDots
                  yAxisSuffix="万"
                />
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Category Distribution */}
        {categories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('procurement.categoryDistribution', { defaultValue: '采购品类分布' })}
            </Text>
            <Card style={styles.chartCard}>
              <Card.Content>
                <MobilePieChart
                  data={categoryPieData}
                  width={screenWidth - 64}
                  height={280}
                  hasLegend
                />
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Supplier Ranking */}
        {supplierEvaluations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t('procurement.supplierRanking', { defaultValue: '供应商绩效排行' })}
              </Text>
              <TouchableOpacity>
                <Text style={styles.viewAll}>
                  {t('common.viewAll', { defaultValue: '查看全部' })}
                </Text>
              </TouchableOpacity>
            </View>
            <Card style={styles.listCard}>
              {supplierEvaluations.slice(0, 5).map((supplier, index) => (
                <React.Fragment key={supplier.supplierId}>
                  <SupplierItem
                    supplier={supplier}
                    onPress={() => setSelectedSupplier(supplier)}
                  />
                  {index < Math.min(supplierEvaluations.length, 5) - 1 && (
                    <Divider style={styles.divider} />
                  )}
                </React.Fragment>
              ))}
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
              {t('dateRange.title', { defaultValue: '选择时间范围' })}
            </Text>
            {DATE_RANGE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={styles.modalOption}
                onPress={() => handleDateRangeSelect(option.key)}
              >
                <Text style={styles.modalOptionText}>{option.label}</Text>
                {selectedDateRange === option.key && (
                  <MaterialCommunityIcons
                    name="check"
                    size={20}
                    color={SMARTBI_THEME.primary}
                  />
                )}
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
  dateRangeSelector: {
    flexDirection: 'row',
    backgroundColor: SMARTBI_THEME.cardBackground,
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  dateRangeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  dateRangeButtonActive: {
    backgroundColor: SMARTBI_THEME.primary,
  },
  dateRangeButtonText: {
    fontSize: 13,
    color: SMARTBI_THEME.textSecondary,
    fontWeight: '500',
  },
  dateRangeButtonTextActive: {
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
  section: {
    marginBottom: 20,
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
    marginBottom: 12,
  },
  viewAll: {
    fontSize: 14,
    color: SMARTBI_THEME.primary,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  kpiCardWrapper: {
    padding: 4,
  },
  chartCard: {
    borderRadius: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
  },
  listCard: {
    borderRadius: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
    overflow: 'hidden',
  },
  supplierItem: {
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
  supplierInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 14,
    fontWeight: '500',
    color: SMARTBI_THEME.textPrimary,
  },
  dimensionTags: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 8,
  },
  dimensionTag: {
    fontSize: 11,
    color: SMARTBI_THEME.textMuted,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  supplierScore: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 11,
    color: SMARTBI_THEME.textMuted,
    marginTop: 2,
  },
  divider: {
    marginHorizontal: 12,
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

export default ProcurementDashboardScreen;
