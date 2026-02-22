/**
 * SmartBI - Quality Dashboard Screen
 *
 * Provides comprehensive quality analytics including FPY,
 * defect analysis, and quality grade distribution.
 *
 * Features:
 * - GAUGE chart: FPY (First Pass Yield)
 * - PIE chart: Quality grade distribution (A/B/C/D)
 * - BAR chart: Defect Pareto (Top 5 types)
 * - LINE chart: Quality trend by product line
 * - KPI cards: FPY, Defect rate, Rework cost, Scrap cost
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
import { Text, Card, Surface, ActivityIndicator, IconButton, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { formatNumberWithCommas } from '../../utils/formatters';

import {
  MobileGaugeChart,
  MobileLineChart,
  MobileBarChart,
  MobilePieChart,
  MobileKPICard,
} from '../../components/smartbi';
import type { LineDataSeries, LineDataPoint, BarDataItem, PieDataItem } from '../../components/smartbi';
import { smartBIApiClient } from '../../services/api/smartbi';
import { useAuthStore } from '../../store/authStore';
import type { SmartBIStackParamList, QualityKPI, DefectItem, QualityGradeDistribution } from '../../types/smartbi';

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

// Quality grade colors
const GRADE_COLORS = {
  A: '#10B981',
  B: '#3B82F6',
  C: '#F59E0B',
  D: '#EF4444',
};

// Date range options
const DATE_RANGE_OPTIONS = [
  { label: '今日', key: 'today', days: 0 },
  { label: '本周', key: 'week', days: 7 },
  { label: '本月', key: 'month', days: 30 },
  { label: '本季', key: 'quarter', days: 90 },
];

// Mock data generator for demonstration
function generateMockData() {
  const qualityKPI: QualityKPI = {
    fpy: 94.5,
    fpyChange: 2.3,
    defectRate: 3.2,
    defectRateChange: -0.8,
    reworkCost: 125680,
    reworkCostChange: -12.5,
    scrapCost: 45320,
    scrapCostChange: -8.2,
  };

  const gradeDistribution: QualityGradeDistribution[] = [
    { grade: 'A', count: 4520, percentage: 62.5 },
    { grade: 'B', count: 1850, percentage: 25.6 },
    { grade: 'C', count: 680, percentage: 9.4 },
    { grade: 'D', count: 180, percentage: 2.5 },
  ];

  const defectItems: DefectItem[] = [
    { type: '外观缺陷', count: 125, percentage: 35.2, cumulative: 35.2 },
    { type: '尺寸偏差', count: 85, percentage: 23.9, cumulative: 59.1 },
    { type: '包装破损', count: 65, percentage: 18.3, cumulative: 77.4 },
    { type: '标签错误', count: 48, percentage: 13.5, cumulative: 90.9 },
    { type: '其他', count: 32, percentage: 9.0, cumulative: 100 },
  ];

  // Generate quality trend data for the last 7 days
  const qualityTrend: LineDataPoint[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    qualityTrend.push({
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      value: 90 + Math.random() * 8,
    });
  }

  return { qualityKPI, gradeDistribution, defectItems, qualityTrend };
}

export function QualityDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SmartBIStackParamList>>();
  const { getFactoryId } = useAuthStore();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState('month');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Data states
  const [qualityKPI, setQualityKPI] = useState<QualityKPI | null>(null);
  const [gradeDistribution, setGradeDistribution] = useState<QualityGradeDistribution[]>([]);
  const [defectItems, setDefectItems] = useState<DefectItem[]>([]);
  const [qualityTrend, setQualityTrend] = useState<LineDataPoint[]>([]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      // TODO: Replace with actual API call when backend is ready
      // const factoryId = getFactoryId();
      // const response = await smartBIApiClient.getQualityDashboard({ period: selectedDateRange, factoryId });

      // Mock data for now
      await new Promise(resolve => setTimeout(resolve, 800));
      const mockData = generateMockData();
      setQualityKPI(mockData.qualityKPI);
      setGradeDistribution(mockData.gradeDistribution);
      setDefectItems(mockData.defectItems);
      setQualityTrend(mockData.qualityTrend);
    } catch (err) {
      console.error('Load quality dashboard failed:', err);
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

  // Prepare pie chart data for grade distribution
  const pieChartData: PieDataItem[] = useMemo(() => {
    return gradeDistribution.map(item => ({
      name: `${item.grade}级 (${item.percentage}%)`,
      value: item.count,
      color: GRADE_COLORS[item.grade],
    }));
  }, [gradeDistribution]);

  // Prepare bar chart data for defect pareto
  const barChartData: BarDataItem[] = useMemo(() => {
    return defectItems.map(item => ({
      label: item.type,
      value: item.count,
    }));
  }, [defectItems]);

  // Prepare trend data for MobileLineChart
  const trendLabels: string[] = useMemo(() => {
    return qualityTrend.map(item => item.label);
  }, [qualityTrend]);

  const trendData: LineDataSeries[] = useMemo(() => {
    return [{
      name: 'FPY',
      data: qualityTrend.map(item => item.value),
      color: SMARTBI_THEME.secondary,
    }];
  }, [qualityTrend]);

  // Format currency for display
  const formatCurrency = (value: number): string => {
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
            {t('quality.title', { defaultValue: '质量分析' })}
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
          {t('quality.title', { defaultValue: '质量分析' })}
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

        {/* FPY Gauge Chart */}
        {qualityKPI && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('quality.fpy', { defaultValue: '首次合格率 (FPY)' })}
            </Text>
            <View style={styles.gaugeCenter}>
              <MobileGaugeChart
                value={qualityKPI.fpy}
                title="FPY"
                unit="%"
                size={200}
                thresholds={{ red: 85, yellow: 95, green: 95 }}
                subtitle="First Pass Yield"
              />
            </View>
          </View>
        )}

        {/* KPI Cards */}
        {qualityKPI && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('quality.keyMetrics', { defaultValue: '关键指标' })}
            </Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="首次合格率"
                  value={qualityKPI.fpy}
                  unit="%"
                  changeRate={qualityKPI.fpyChange}
                  trend={qualityKPI.fpyChange >= 0 ? 'up' : 'down'}
                  status={qualityKPI.fpy >= 95 ? 'green' : qualityKPI.fpy >= 85 ? 'yellow' : 'red'}
                  width={(screenWidth - 48) / 2}
                />
              </View>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="不良率"
                  value={qualityKPI.defectRate}
                  unit="%"
                  changeRate={qualityKPI.defectRateChange}
                  trend={qualityKPI.defectRateChange <= 0 ? 'up' : 'down'}
                  status={qualityKPI.defectRate <= 2 ? 'green' : qualityKPI.defectRate <= 5 ? 'yellow' : 'red'}
                  width={(screenWidth - 48) / 2}
                />
              </View>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="返工成本"
                  value={formatCurrency(qualityKPI.reworkCost)}
                  changeRate={qualityKPI.reworkCostChange}
                  trend={qualityKPI.reworkCostChange <= 0 ? 'up' : 'down'}
                  status={qualityKPI.reworkCostChange <= 0 ? 'green' : 'red'}
                  isCurrency
                  width={(screenWidth - 48) / 2}
                />
              </View>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="报废成本"
                  value={formatCurrency(qualityKPI.scrapCost)}
                  changeRate={qualityKPI.scrapCostChange}
                  trend={qualityKPI.scrapCostChange <= 0 ? 'up' : 'down'}
                  status={qualityKPI.scrapCostChange <= 0 ? 'green' : 'red'}
                  isCurrency
                  width={(screenWidth - 48) / 2}
                />
              </View>
            </View>
          </View>
        )}

        {/* Quality Grade Distribution */}
        {gradeDistribution.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('quality.gradeDistribution', { defaultValue: '质量等级分布' })}
            </Text>
            <Card style={styles.chartCard}>
              <Card.Content>
                <MobilePieChart
                  data={pieChartData}
                  width={screenWidth - 64}
                  height={280}
                  hasLegend
                />
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Defect Pareto Chart */}
        {defectItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('quality.defectPareto', { defaultValue: '缺陷帕累托分析' })}
            </Text>
            <Card style={styles.chartCard}>
              <Card.Content>
                <MobileBarChart
                  labels={barChartData.map(item => item.label)}
                  data={barChartData.map(item => item.value)}
                  width={screenWidth - 64}
                  height={220}
                  horizontal={false}
                  showValuesOnTopOfBars
                  barColor={SMARTBI_THEME.danger}
                />
              </Card.Content>
            </Card>
            {/* Pareto Table */}
            <View style={styles.paretoTable}>
              <View style={styles.paretoHeader}>
                <Text style={[styles.paretoCell, styles.paretoHeaderText, { flex: 2 }]}>缺陷类型</Text>
                <Text style={[styles.paretoCell, styles.paretoHeaderText]}>数量</Text>
                <Text style={[styles.paretoCell, styles.paretoHeaderText]}>占比</Text>
                <Text style={[styles.paretoCell, styles.paretoHeaderText]}>累计</Text>
              </View>
              {defectItems.map((item, index) => (
                <View key={item.type} style={styles.paretoRow}>
                  <Text style={[styles.paretoCell, { flex: 2 }]}>{item.type}</Text>
                  <Text style={styles.paretoCell}>{item.count}</Text>
                  <Text style={styles.paretoCell}>{item.percentage.toFixed(1)}%</Text>
                  <Text style={[styles.paretoCell, { color: SMARTBI_THEME.primary }]}>
                    {item.cumulative.toFixed(1)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Quality Trend Chart */}
        {qualityTrend.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('quality.trend', { defaultValue: 'FPY 趋势' })}
            </Text>
            <Card style={styles.chartCard}>
              <Card.Content>
                <MobileLineChart
                  labels={trendLabels}
                  datasets={trendData}
                  width={screenWidth - 64}
                  height={200}
                  showDots
                  yAxisSuffix="%"
                />
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
    marginBottom: 12,
  },
  gaugeCenter: {
    alignItems: 'center',
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
  paretoTable: {
    marginTop: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
    borderRadius: 8,
    overflow: 'hidden',
  },
  paretoHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  paretoHeaderText: {
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
  },
  paretoRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SMARTBI_THEME.border,
  },
  paretoCell: {
    flex: 1,
    fontSize: 13,
    color: SMARTBI_THEME.textSecondary,
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

export default QualityDashboardScreen;
