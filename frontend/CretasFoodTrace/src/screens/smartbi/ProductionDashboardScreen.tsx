/**
 * SmartBI - Production Dashboard Screen
 *
 * Provides comprehensive production analytics including OEE metrics,
 * equipment utilization, and production line efficiency rankings.
 *
 * Features:
 * - 3 GAUGE charts: OEE, Availability, Quality Rate
 * - LINE chart: OEE daily trend
 * - Ranking list: Production lines by efficiency
 * - KPI cards: Total output, Downtime hours, Equipment utilization
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

import {
  MobileGaugeChart,
  MobileLineChart,
  MobileKPICard,
  MobileRankingList,
} from '../../components/smartbi';
import type { RankingItem, LineDataPoint, LineDataSeries } from '../../components/smartbi';
import { smartBIApiClient } from '../../services/api/smartbi';
import { useAuthStore } from '../../store/authStore';
import type { SmartBIStackParamList, ProductionKPI, ProductionLineRanking, OEEMetrics } from '../../types/smartbi';

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

// Date range options
const DATE_RANGE_OPTIONS = [
  { label: '今日', key: 'today', days: 0 },
  { label: '本周', key: 'week', days: 7 },
  { label: '本月', key: 'month', days: 30 },
  { label: '本季', key: 'quarter', days: 90 },
];

// Mock data generator for demonstration
function generateMockData() {
  const oeeMetrics: OEEMetrics = {
    oee: 72.5,
    availability: 85.3,
    performance: 92.1,
    quality: 92.5,
    target: 85,
  };

  const productionKPI: ProductionKPI = {
    totalOutput: 125680,
    outputChange: 8.5,
    downtimeHours: 12.5,
    downtimeChange: -15.2,
    equipmentUtilization: 78.5,
    utilizationChange: 3.2,
    oee: oeeMetrics.oee,
    oeeChange: 2.1,
  };

  const productionLines: ProductionLineRanking[] = [
    { id: '1', rank: 1, name: '生产线A', oee: 89.2, output: 35680, status: 'green' },
    { id: '2', rank: 2, name: '生产线B', oee: 82.5, output: 31200, status: 'green' },
    { id: '3', rank: 3, name: '生产线C', oee: 75.8, output: 28500, status: 'yellow' },
    { id: '4', rank: 4, name: '生产线D', oee: 68.3, output: 18300, status: 'yellow' },
    { id: '5', rank: 5, name: '生产线E', oee: 58.2, output: 12000, status: 'red' },
  ];

  // Generate OEE trend data for the last 7 days
  const oeeTrend: LineDataPoint[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    oeeTrend.push({
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      value: 65 + Math.random() * 20,
    });
  }

  return { oeeMetrics, productionKPI, productionLines, oeeTrend };
}

// Production Line Ranking Item
interface ProductionLineItemProps {
  item: ProductionLineRanking;
  onPress?: () => void;
}

const ProductionLineItem: React.FC<ProductionLineItemProps> = ({ item, onPress }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'green': return SMARTBI_THEME.success;
      case 'yellow': return SMARTBI_THEME.warning;
      case 'red': return SMARTBI_THEME.danger;
      default: return SMARTBI_THEME.textMuted;
    }
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return SMARTBI_THEME.textSecondary;
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
        <Text style={styles.rankSubtext}>{item.output.toLocaleString()} 件</Text>
      </View>
      <View style={styles.rankOEE}>
        <Text style={styles.rankOEEValue}>{item.oee.toFixed(1)}%</Text>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={SMARTBI_THEME.textMuted}
      />
    </TouchableOpacity>
  );
};

export function ProductionDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SmartBIStackParamList>>();
  const { getFactoryId } = useAuthStore();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState('month');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Data states
  const [oeeMetrics, setOEEMetrics] = useState<OEEMetrics | null>(null);
  const [productionKPI, setProductionKPI] = useState<ProductionKPI | null>(null);
  const [productionLines, setProductionLines] = useState<ProductionLineRanking[]>([]);
  const [oeeTrend, setOEETrend] = useState<LineDataPoint[]>([]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      // TODO: Replace with actual API call when backend is ready
      // const factoryId = getFactoryId();
      // const response = await smartBIApiClient.getProductionDashboard({ period: selectedDateRange, factoryId });

      // Mock data for now
      await new Promise(resolve => setTimeout(resolve, 800));
      const mockData = generateMockData();
      setOEEMetrics(mockData.oeeMetrics);
      setProductionKPI(mockData.productionKPI);
      setProductionLines(mockData.productionLines);
      setOEETrend(mockData.oeeTrend);
    } catch (err) {
      console.error('Load production dashboard failed:', err);
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

  // Prepare ranking data for MobileRankingList
  const rankingData = useMemo(() => {
    return productionLines.map(line => ({
      id: line.id,
      label: line.name,
      value: line.oee,
      subtitle: `产量: ${line.output.toLocaleString()}件`,
    }));
  }, [productionLines]);

  // Prepare trend data for MobileLineChart
  const trendLabels: string[] = useMemo(() => {
    return oeeTrend.map(item => item.label);
  }, [oeeTrend]);

  const trendData: LineDataSeries[] = useMemo(() => {
    return [{
      name: 'OEE',
      data: oeeTrend.map(item => item.value),
      color: SMARTBI_THEME.primary,
    }];
  }, [oeeTrend]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('production.title', { defaultValue: '生产分析' })}
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
          {t('production.title', { defaultValue: '生产分析' })}
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

        {/* OEE Gauge Charts */}
        {oeeMetrics && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('production.oeeMetrics', { defaultValue: 'OEE 指标' })}
            </Text>
            <View style={styles.gaugeRow}>
              <View style={styles.gaugeItem}>
                <MobileGaugeChart
                  value={oeeMetrics.oee}
                  title="OEE"
                  unit="%"
                  size={140}
                  thresholds={{ red: 60, yellow: 80, green: 80 }}
                  subtitle="综合效率"
                />
              </View>
              <View style={styles.gaugeItem}>
                <MobileGaugeChart
                  value={oeeMetrics.availability}
                  title="可用率"
                  unit="%"
                  size={140}
                  thresholds={{ red: 70, yellow: 85, green: 85 }}
                  subtitle="Availability"
                />
              </View>
            </View>
            <View style={styles.gaugeRow}>
              <View style={styles.gaugeItem}>
                <MobileGaugeChart
                  value={oeeMetrics.performance}
                  title="性能率"
                  unit="%"
                  size={140}
                  thresholds={{ red: 70, yellow: 85, green: 85 }}
                  subtitle="Performance"
                />
              </View>
              <View style={styles.gaugeItem}>
                <MobileGaugeChart
                  value={oeeMetrics.quality}
                  title="质量率"
                  unit="%"
                  size={140}
                  thresholds={{ red: 85, yellow: 95, green: 95 }}
                  subtitle="Quality"
                />
              </View>
            </View>
          </View>
        )}

        {/* KPI Cards */}
        {productionKPI && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('production.keyMetrics', { defaultValue: '关键指标' })}
            </Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="总产量"
                  value={productionKPI.totalOutput}
                  unit="件"
                  changeRate={productionKPI.outputChange}
                  trend={productionKPI.outputChange >= 0 ? 'up' : 'down'}
                  status={productionKPI.outputChange >= 0 ? 'green' : 'red'}
                  width={(screenWidth - 48) / 2}
                />
              </View>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="停机时长"
                  value={productionKPI.downtimeHours}
                  unit="小时"
                  changeRate={productionKPI.downtimeChange}
                  trend={productionKPI.downtimeChange <= 0 ? 'up' : 'down'}
                  status={productionKPI.downtimeChange <= 0 ? 'green' : 'red'}
                  width={(screenWidth - 48) / 2}
                />
              </View>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="设备利用率"
                  value={productionKPI.equipmentUtilization}
                  unit="%"
                  changeRate={productionKPI.utilizationChange}
                  trend={productionKPI.utilizationChange >= 0 ? 'up' : 'down'}
                  status={productionKPI.utilizationChange >= 0 ? 'green' : 'yellow'}
                  width={(screenWidth - 48) / 2}
                />
              </View>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="OEE"
                  value={productionKPI.oee}
                  unit="%"
                  changeRate={productionKPI.oeeChange}
                  trend={productionKPI.oeeChange >= 0 ? 'up' : 'down'}
                  status={productionKPI.oee >= 80 ? 'green' : productionKPI.oee >= 60 ? 'yellow' : 'red'}
                  width={(screenWidth - 48) / 2}
                />
              </View>
            </View>
          </View>
        )}

        {/* OEE Trend Chart */}
        {oeeTrend.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('production.oeeTrend', { defaultValue: 'OEE 趋势' })}
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

        {/* Production Line Ranking */}
        {productionLines.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t('production.lineRanking', { defaultValue: '产线效率排行' })}
              </Text>
              <TouchableOpacity>
                <Text style={styles.viewAll}>
                  {t('common.viewAll', { defaultValue: '查看全部' })}
                </Text>
              </TouchableOpacity>
            </View>
            <Card style={styles.rankingCard}>
              {productionLines.map((line, index) => (
                <React.Fragment key={line.id}>
                  <ProductionLineItem
                    item={line}
                    onPress={() => {
                      // Navigate to line detail
                    }}
                  />
                  {index < productionLines.length - 1 && (
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
  gaugeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gaugeItem: {
    width: (screenWidth - 48) / 2,
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
  rankSubtext: {
    fontSize: 12,
    color: SMARTBI_THEME.textSecondary,
    marginTop: 2,
  },
  rankOEE: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  rankOEEValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
    marginRight: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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

export default ProductionDashboardScreen;
