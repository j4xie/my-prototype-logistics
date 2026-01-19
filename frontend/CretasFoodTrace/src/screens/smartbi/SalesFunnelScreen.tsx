/**
 * SmartBI - Sales Funnel Screen
 *
 * Provides comprehensive sales pipeline analytics including conversion funnel,
 * customer RFM segmentation, and product ABC analysis.
 *
 * Features:
 * - FUNNEL chart: Sales conversion funnel
 * - SCATTER view: Customer RFM segmentation (simplified as grouped list)
 * - PIE chart: Product ABC distribution
 * - KPI cards: Leads, Conversion rate, Average deal size
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
import { Text, Card, Surface, ActivityIndicator, IconButton, Divider, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
  MobileFunnelChart,
  MobilePieChart,
  MobileKPICard,
} from '../../components/smartbi';
import type { FunnelStage, PieDataItem } from '../../components/smartbi';
import { smartBIApiClient } from '../../services/api/smartbi';
import { useAuthStore } from '../../store/authStore';
import type { SmartBIStackParamList, SalesFunnelStage, CustomerRFMSegment, ProductABCItem } from '../../types/smartbi';

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

// RFM Segment colors
const RFM_COLORS: Record<string, string> = {
  'champions': '#10B981',
  'loyal_customers': '#3B82F6',
  'potential_loyalists': '#6366F1',
  'recent_customers': '#8B5CF6',
  'promising': '#A855F7',
  'needs_attention': '#F59E0B',
  'about_to_sleep': '#FB923C',
  'at_risk': '#EF4444',
  'cant_lose': '#DC2626',
  'hibernating': '#9CA3AF',
  'lost': '#6B7280',
};

// ABC Category colors
const ABC_COLORS = {
  A: '#10B981',
  B: '#3B82F6',
  C: '#F59E0B',
};

// Date range options
const DATE_RANGE_OPTIONS = [
  { label: '今日', key: 'today', days: 0 },
  { label: '本周', key: 'week', days: 7 },
  { label: '本月', key: 'month', days: 30 },
  { label: '本季', key: 'quarter', days: 90 },
];

// KPI data interface
interface SalesFunnelKPI {
  totalLeads: number;
  leadsChange: number;
  conversionRate: number;
  conversionChange: number;
  avgDealSize: number;
  dealSizeChange: number;
  totalRevenue: number;
  revenueChange: number;
}

// Mock data generator for demonstration
function generateMockData() {
  const funnelKPI: SalesFunnelKPI = {
    totalLeads: 1250,
    leadsChange: 15.3,
    conversionRate: 8.5,
    conversionChange: 1.2,
    avgDealSize: 12500,
    dealSizeChange: 5.8,
    totalRevenue: 1328750,
    revenueChange: 22.4,
  };

  const funnelStages: SalesFunnelStage[] = [
    { stage: '线索', count: 1250, value: 0, percentage: 100, conversionRate: 100 },
    { stage: '商机', count: 680, value: 8500000, percentage: 54.4, conversionRate: 54.4 },
    { stage: '报价', count: 320, value: 4000000, percentage: 25.6, conversionRate: 47.1 },
    { stage: '谈判', count: 180, value: 2250000, percentage: 14.4, conversionRate: 56.3 },
    { stage: '成交', count: 106, value: 1328750, percentage: 8.5, conversionRate: 58.9 },
  ];

  const rfmSegments: CustomerRFMSegment[] = [
    { segment: 'champions', description: '冠军客户', count: 45, percentage: 12.5, avgValue: 28500, strategy: '保持高端服务，提供专属权益' },
    { segment: 'loyal_customers', description: '忠诚客户', count: 82, percentage: 22.8, avgValue: 18200, strategy: '交叉销售，增加复购频率' },
    { segment: 'potential_loyalists', description: '潜力客户', count: 65, percentage: 18.1, avgValue: 12800, strategy: '提升服务体验，培养忠诚度' },
    { segment: 'recent_customers', description: '新客户', count: 48, percentage: 13.3, avgValue: 8500, strategy: '欢迎礼遇，引导二次购买' },
    { segment: 'needs_attention', description: '需要关注', count: 35, percentage: 9.7, avgValue: 6200, strategy: '主动回访，了解需求' },
    { segment: 'at_risk', description: '流失风险', count: 42, percentage: 11.7, avgValue: 4800, strategy: '紧急挽回，提供优惠' },
    { segment: 'hibernating', description: '休眠客户', count: 28, percentage: 7.8, avgValue: 2500, strategy: '激活营销，唤醒需求' },
    { segment: 'lost', description: '流失客户', count: 15, percentage: 4.2, avgValue: 1200, strategy: '分析原因，针对性召回' },
  ];

  const abcItems: ProductABCItem[] = [
    { category: 'A', productCount: 25, revenue: 4500000, revenuePercentage: 72.0 },
    { category: 'B', productCount: 45, revenue: 1250000, revenuePercentage: 20.0 },
    { category: 'C', productCount: 130, revenue: 500000, revenuePercentage: 8.0 },
  ];

  return { funnelKPI, funnelStages, rfmSegments, abcItems };
}

// RFM Segment Card Component
interface RFMSegmentCardProps {
  segment: CustomerRFMSegment;
  onPress?: () => void;
}

const RFMSegmentCard: React.FC<RFMSegmentCardProps> = ({ segment, onPress }) => {
  const segmentColor = RFM_COLORS[segment.segment] || SMARTBI_THEME.textMuted;

  const formatCurrency = (value: number): string => {
    if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}万`;
    }
    return value.toLocaleString();
  };

  return (
    <TouchableOpacity
      style={styles.rfmCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rfmHeader}>
        <View style={[styles.rfmColorBar, { backgroundColor: segmentColor }]} />
        <View style={styles.rfmTitleRow}>
          <Text style={styles.rfmTitle}>{segment.description}</Text>
          <Chip
            mode="flat"
            compact
            style={[styles.rfmChip, { backgroundColor: segmentColor + '20' }]}
            textStyle={[styles.rfmChipText, { color: segmentColor }]}
          >
            {segment.count}人
          </Chip>
        </View>
      </View>
      <View style={styles.rfmBody}>
        <View style={styles.rfmMetric}>
          <Text style={styles.rfmMetricValue}>{segment.percentage}%</Text>
          <Text style={styles.rfmMetricLabel}>占比</Text>
        </View>
        <View style={styles.rfmMetric}>
          <Text style={styles.rfmMetricValue}>{formatCurrency(segment.avgValue)}</Text>
          <Text style={styles.rfmMetricLabel}>平均价值</Text>
        </View>
      </View>
      <Text style={styles.rfmStrategy} numberOfLines={2}>
        {segment.strategy}
      </Text>
    </TouchableOpacity>
  );
};

export function SalesFunnelScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SmartBIStackParamList>>();
  const { getFactoryId } = useAuthStore();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState('month');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Data states
  const [funnelKPI, setFunnelKPI] = useState<SalesFunnelKPI | null>(null);
  const [funnelStages, setFunnelStages] = useState<SalesFunnelStage[]>([]);
  const [rfmSegments, setRFMSegments] = useState<CustomerRFMSegment[]>([]);
  const [abcItems, setABCItems] = useState<ProductABCItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      // TODO: Replace with actual API call when backend is ready
      // const factoryId = getFactoryId();
      // const response = await smartBIApiClient.getSalesFunnel({ period: selectedDateRange, factoryId });

      // Mock data for now
      await new Promise(resolve => setTimeout(resolve, 800));
      const mockData = generateMockData();
      setFunnelKPI(mockData.funnelKPI);
      setFunnelStages(mockData.funnelStages);
      setRFMSegments(mockData.rfmSegments);
      setABCItems(mockData.abcItems);
    } catch (err) {
      console.error('Load sales funnel failed:', err);
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

  // Prepare funnel chart data
  const funnelData: FunnelStage[] = useMemo(() => {
    return funnelStages.map(stage => ({
      label: stage.stage,
      value: stage.count,
      percentage: stage.percentage,
    }));
  }, [funnelStages]);

  // Prepare ABC pie chart data
  const abcPieData: PieDataItem[] = useMemo(() => {
    return abcItems.map(item => ({
      name: `${item.category}类 (${item.revenuePercentage}%)`,
      value: item.revenue,
      color: ABC_COLORS[item.category],
    }));
  }, [abcItems]);

  // Format currency for display
  const formatCurrency = (value: number): string => {
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(2)}亿`;
    }
    if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}万`;
    }
    return value.toLocaleString();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('salesFunnel.title', { defaultValue: '销售漏斗' })}
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
          {t('salesFunnel.title', { defaultValue: '销售漏斗' })}
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
        {funnelKPI && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('salesFunnel.keyMetrics', { defaultValue: '关键指标' })}
            </Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="总线索"
                  value={funnelKPI.totalLeads}
                  unit="个"
                  changeRate={funnelKPI.leadsChange}
                  trend={funnelKPI.leadsChange >= 0 ? 'up' : 'down'}
                  status="neutral"
                  width={(screenWidth - 48) / 2}
                />
              </View>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="转化率"
                  value={funnelKPI.conversionRate}
                  unit="%"
                  changeRate={funnelKPI.conversionChange}
                  trend={funnelKPI.conversionChange >= 0 ? 'up' : 'down'}
                  status={funnelKPI.conversionRate >= 10 ? 'green' : funnelKPI.conversionRate >= 5 ? 'yellow' : 'red'}
                  width={(screenWidth - 48) / 2}
                />
              </View>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="平均订单"
                  value={formatCurrency(funnelKPI.avgDealSize)}
                  changeRate={funnelKPI.dealSizeChange}
                  trend={funnelKPI.dealSizeChange >= 0 ? 'up' : 'down'}
                  status="neutral"
                  isCurrency
                  width={(screenWidth - 48) / 2}
                />
              </View>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="总营收"
                  value={formatCurrency(funnelKPI.totalRevenue)}
                  changeRate={funnelKPI.revenueChange}
                  trend={funnelKPI.revenueChange >= 0 ? 'up' : 'down'}
                  status={funnelKPI.revenueChange >= 0 ? 'green' : 'red'}
                  isCurrency
                  width={(screenWidth - 48) / 2}
                />
              </View>
            </View>
          </View>
        )}

        {/* Sales Funnel Chart */}
        {funnelData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('salesFunnel.conversionFunnel', { defaultValue: '转化漏斗' })}
            </Text>
            <Card style={styles.chartCard}>
              <Card.Content>
                <MobileFunnelChart
                  data={funnelData}
                  height={320}
                  width={screenWidth - 64}
                  showConversion
                  showPercentage
                />
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Funnel Stage Details Table */}
        {funnelStages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('salesFunnel.stageDetails', { defaultValue: '阶段详情' })}
            </Text>
            <Card style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>阶段</Text>
                <Text style={styles.tableHeaderCell}>数量</Text>
                <Text style={styles.tableHeaderCell}>转化率</Text>
                <Text style={styles.tableHeaderCell}>累计</Text>
              </View>
              {funnelStages.map((stage, index) => (
                <View key={stage.stage} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 1.2, fontWeight: '500' }]}>
                    {stage.stage}
                  </Text>
                  <Text style={styles.tableCell}>{stage.count}</Text>
                  <Text style={[styles.tableCell, { color: SMARTBI_THEME.primary }]}>
                    {index === 0 ? '-' : `${stage.conversionRate.toFixed(1)}%`}
                  </Text>
                  <Text style={styles.tableCell}>{stage.percentage.toFixed(1)}%</Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* Customer RFM Segmentation */}
        {rfmSegments.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t('salesFunnel.customerRFM', { defaultValue: '客户RFM分群' })}
              </Text>
              <TouchableOpacity>
                <Text style={styles.viewAll}>
                  {t('common.viewAll', { defaultValue: '查看全部' })}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>
              基于最近购买、购买频率、消费金额进行客户分群
            </Text>
            <View style={styles.rfmGrid}>
              {rfmSegments.slice(0, 6).map((segment) => (
                <RFMSegmentCard
                  key={segment.segment}
                  segment={segment}
                  onPress={() => {
                    // Navigate to segment detail
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* Product ABC Distribution */}
        {abcItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('salesFunnel.productABC', { defaultValue: '产品ABC分析' })}
            </Text>
            <Card style={styles.chartCard}>
              <Card.Content>
                <MobilePieChart
                  data={abcPieData}
                  width={screenWidth - 64}
                  height={240}
                  hasLegend
                />
              </Card.Content>
            </Card>
            {/* ABC Summary Table */}
            <View style={styles.abcTable}>
              <View style={styles.abcHeader}>
                <Text style={[styles.abcHeaderCell, { flex: 0.8 }]}>分类</Text>
                <Text style={styles.abcHeaderCell}>产品数</Text>
                <Text style={styles.abcHeaderCell}>销售额</Text>
                <Text style={styles.abcHeaderCell}>占比</Text>
              </View>
              {abcItems.map((item) => (
                <View key={item.category} style={styles.abcRow}>
                  <View style={[styles.abcCell, { flex: 0.8, flexDirection: 'row', alignItems: 'center' }]}>
                    <View style={[styles.abcDot, { backgroundColor: ABC_COLORS[item.category] }]} />
                    <Text style={styles.abcCellText}>{item.category}类</Text>
                  </View>
                  <Text style={[styles.abcCell, styles.abcCellText]}>{item.productCount}</Text>
                  <Text style={[styles.abcCell, styles.abcCellText]}>{formatCurrency(item.revenue)}</Text>
                  <Text style={[styles.abcCell, styles.abcCellText, { color: ABC_COLORS[item.category] }]}>
                    {item.revenuePercentage}%
                  </Text>
                </View>
              ))}
            </View>
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
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: SMARTBI_THEME.textMuted,
    marginBottom: 12,
    marginTop: -8,
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
  tableCard: {
    borderRadius: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SMARTBI_THEME.border,
  },
  tableCell: {
    flex: 1,
    fontSize: 13,
    color: SMARTBI_THEME.textSecondary,
    textAlign: 'center',
  },
  rfmGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  rfmCard: {
    width: (screenWidth - 44) / 2,
    margin: 6,
    backgroundColor: SMARTBI_THEME.cardBackground,
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  rfmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rfmColorBar: {
    width: 4,
    height: 32,
    borderRadius: 2,
    marginRight: 8,
  },
  rfmTitleRow: {
    flex: 1,
  },
  rfmTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
    marginBottom: 4,
  },
  rfmChip: {
    height: 20,
    alignSelf: 'flex-start',
  },
  rfmChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  rfmBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rfmMetric: {
    alignItems: 'center',
  },
  rfmMetricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: SMARTBI_THEME.textPrimary,
  },
  rfmMetricLabel: {
    fontSize: 10,
    color: SMARTBI_THEME.textMuted,
    marginTop: 2,
  },
  rfmStrategy: {
    fontSize: 11,
    color: SMARTBI_THEME.textSecondary,
    lineHeight: 16,
  },
  abcTable: {
    marginTop: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
    borderRadius: 8,
    overflow: 'hidden',
  },
  abcHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  abcHeaderCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
    textAlign: 'center',
  },
  abcRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SMARTBI_THEME.border,
    alignItems: 'center',
  },
  abcCell: {
    flex: 1,
    textAlign: 'center',
  },
  abcCellText: {
    fontSize: 13,
    color: SMARTBI_THEME.textSecondary,
  },
  abcDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
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

export default SalesFunnelScreen;
