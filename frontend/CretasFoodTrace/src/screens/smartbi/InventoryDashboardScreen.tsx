/**
 * SmartBI - Inventory Dashboard Screen
 *
 * Provides comprehensive inventory analytics including turnover rate,
 * aging distribution, and expiry risk monitoring.
 *
 * Features:
 * - GAUGE chart: Turnover rate
 * - PIE chart: Inventory aging distribution (0-30, 31-60, 61-90, 90+ days)
 * - BAR chart: Expiry warning (near-expiry batches)
 * - KPI cards: Inventory value, Turnover days, Expiry risk rate, Loss rate
 * - Ranking list: Near-expiry items
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
  MobileGaugeChart,
  MobilePieChart,
  MobileBarChart,
  MobileKPICard,
  MobileRankingList,
} from '../../components/smartbi';
import type { PieDataItem, BarDataItem, RankingItem } from '../../components/smartbi';
import { smartBIApiClient } from '../../services/api/smartbi';
import { useAuthStore } from '../../store/authStore';
import type { SmartBIStackParamList, InventoryHealthKPI, InventoryAgingItem, ExpiryRiskItem } from '../../types/smartbi';

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

// Aging period colors
const AGING_COLORS = {
  '0-30天': '#10B981',
  '31-60天': '#3B82F6',
  '61-90天': '#F59E0B',
  '90+天': '#EF4444',
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
  const inventoryKPI: InventoryHealthKPI = {
    inventoryValue: 2856000,
    valueChange: 5.2,
    turnoverRate: 4.5,
    turnoverChange: 8.3,
    inventoryDays: 28.5,
    daysChange: -3.2,
    expiryRiskRate: 3.8,
    riskChange: -1.2,
    lossRate: 0.8,
    lossChange: -0.3,
  };

  const agingDistribution: InventoryAgingItem[] = [
    { range: '0-30天', value: 1580000, percentage: 55.3 },
    { range: '31-60天', value: 856000, percentage: 30.0 },
    { range: '61-90天', value: 312000, percentage: 10.9 },
    { range: '90+天', value: 108000, percentage: 3.8 },
  ];

  const expiryRiskItems: ExpiryRiskItem[] = [
    { id: '1', batchNumber: 'B2026011801', materialName: '有机全麦粉', quantity: 500, unit: 'kg', expiryDate: '2026-02-01', daysToExpiry: 14, status: 'warning' },
    { id: '2', batchNumber: 'B2026011802', materialName: '食用植物油', quantity: 200, unit: 'L', expiryDate: '2026-01-25', daysToExpiry: 7, status: 'critical' },
    { id: '3', batchNumber: 'B2026011803', materialName: '鲜牛奶', quantity: 100, unit: 'L', expiryDate: '2026-01-20', daysToExpiry: 2, status: 'critical' },
    { id: '4', batchNumber: 'B2026011804', materialName: '食品添加剂A', quantity: 50, unit: 'kg', expiryDate: '2026-02-15', daysToExpiry: 28, status: 'safe' },
    { id: '5', batchNumber: 'B2026011805', materialName: '包装材料', quantity: 1000, unit: '个', expiryDate: '2026-03-01', daysToExpiry: 42, status: 'safe' },
  ];

  // Generate expiry warning bar data (batches by expiry window)
  const expiryWarningData: BarDataItem[] = [
    { label: '已过期', value: 2 },
    { label: '7天内', value: 5 },
    { label: '7-15天', value: 8 },
    { label: '15-30天', value: 12 },
    { label: '30天以上', value: 45 },
  ];

  return { inventoryKPI, agingDistribution, expiryRiskItems, expiryWarningData };
}

// Expiry Risk Item Component
interface ExpiryItemProps {
  item: ExpiryRiskItem;
  onPress?: () => void;
}

const ExpiryItem: React.FC<ExpiryItemProps> = ({ item, onPress }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return SMARTBI_THEME.danger;
      case 'warning': return SMARTBI_THEME.warning;
      case 'safe': return SMARTBI_THEME.success;
      default: return SMARTBI_THEME.textMuted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'critical': return '紧急';
      case 'warning': return '预警';
      case 'safe': return '安全';
      default: return '未知';
    }
  };

  return (
    <TouchableOpacity style={styles.expiryItem} onPress={onPress}>
      <View style={styles.expiryInfo}>
        <Text style={styles.expiryName}>{item.materialName}</Text>
        <Text style={styles.expiryBatch}>{item.batchNumber}</Text>
      </View>
      <View style={styles.expiryMeta}>
        <Text style={styles.expiryQuantity}>
          {item.quantity} {item.unit}
        </Text>
        <View style={styles.expiryDateRow}>
          <Text style={[styles.expiryDays, { color: getStatusColor(item.status) }]}>
            {item.daysToExpiry <= 0 ? '已过期' : `${item.daysToExpiry}天后过期`}
          </Text>
          <Chip
            mode="flat"
            compact
            style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) + '20' }]}
            textStyle={[styles.statusChipText, { color: getStatusColor(item.status) }]}
          >
            {getStatusLabel(item.status)}
          </Chip>
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

export function InventoryDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SmartBIStackParamList>>();
  const { getFactoryId } = useAuthStore();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState('month');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Data states
  const [inventoryKPI, setInventoryKPI] = useState<InventoryHealthKPI | null>(null);
  const [agingDistribution, setAgingDistribution] = useState<InventoryAgingItem[]>([]);
  const [expiryRiskItems, setExpiryRiskItems] = useState<ExpiryRiskItem[]>([]);
  const [expiryWarningData, setExpiryWarningData] = useState<BarDataItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      // TODO: Replace with actual API call when backend is ready
      // const factoryId = getFactoryId();
      // const response = await smartBIApiClient.getInventoryDashboard({ period: selectedDateRange, factoryId });

      // Mock data for now
      await new Promise(resolve => setTimeout(resolve, 800));
      const mockData = generateMockData();
      setInventoryKPI(mockData.inventoryKPI);
      setAgingDistribution(mockData.agingDistribution);
      setExpiryRiskItems(mockData.expiryRiskItems);
      setExpiryWarningData(mockData.expiryWarningData);
    } catch (err) {
      console.error('Load inventory dashboard failed:', err);
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

  // Prepare pie chart data for aging distribution
  const agingPieData: PieDataItem[] = useMemo(() => {
    return agingDistribution.map(item => ({
      name: `${item.range} (${item.percentage}%)`,
      value: item.value,
      color: AGING_COLORS[item.range as keyof typeof AGING_COLORS] || SMARTBI_THEME.textMuted,
    }));
  }, [agingDistribution]);

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

  // Get critical and warning items count
  const criticalCount = expiryRiskItems.filter(item => item.status === 'critical').length;
  const warningCount = expiryRiskItems.filter(item => item.status === 'warning').length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('inventory.title', { defaultValue: '库存分析' })}
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
          {t('inventory.title', { defaultValue: '库存分析' })}
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

        {/* Alert Summary */}
        {(criticalCount > 0 || warningCount > 0) && (
          <View style={styles.alertSummary}>
            {criticalCount > 0 && (
              <View style={[styles.alertBadge, { backgroundColor: SMARTBI_THEME.danger + '15' }]}>
                <MaterialCommunityIcons name="alert-circle" size={16} color={SMARTBI_THEME.danger} />
                <Text style={[styles.alertBadgeText, { color: SMARTBI_THEME.danger }]}>
                  {criticalCount}个紧急
                </Text>
              </View>
            )}
            {warningCount > 0 && (
              <View style={[styles.alertBadge, { backgroundColor: SMARTBI_THEME.warning + '15' }]}>
                <MaterialCommunityIcons name="alert" size={16} color={SMARTBI_THEME.warning} />
                <Text style={[styles.alertBadgeText, { color: SMARTBI_THEME.warning }]}>
                  {warningCount}个预警
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Turnover Rate Gauge */}
        {inventoryKPI && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('inventory.turnoverRate', { defaultValue: '库存周转率' })}
            </Text>
            <View style={styles.gaugeCenter}>
              <MobileGaugeChart
                value={inventoryKPI.turnoverRate}
                maxValue={12}
                title="周转率"
                unit="次/年"
                size={200}
                thresholds={{ red: 2, yellow: 4, green: 4 }}
                subtitle="Turnover Rate"
              />
            </View>
          </View>
        )}

        {/* KPI Cards */}
        {inventoryKPI && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('inventory.keyMetrics', { defaultValue: '关键指标' })}
            </Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="库存金额"
                  value={formatCurrency(inventoryKPI.inventoryValue)}
                  changeRate={inventoryKPI.valueChange}
                  trend={inventoryKPI.valueChange >= 0 ? 'up' : 'down'}
                  status="neutral"
                  isCurrency
                  width={(screenWidth - 48) / 2}
                />
              </View>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="周转天数"
                  value={inventoryKPI.inventoryDays}
                  unit="天"
                  changeRate={inventoryKPI.daysChange}
                  trend={inventoryKPI.daysChange <= 0 ? 'up' : 'down'}
                  status={inventoryKPI.inventoryDays <= 30 ? 'green' : inventoryKPI.inventoryDays <= 60 ? 'yellow' : 'red'}
                  width={(screenWidth - 48) / 2}
                />
              </View>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="临期风险率"
                  value={inventoryKPI.expiryRiskRate}
                  unit="%"
                  changeRate={inventoryKPI.riskChange}
                  trend={inventoryKPI.riskChange <= 0 ? 'up' : 'down'}
                  status={inventoryKPI.expiryRiskRate <= 3 ? 'green' : inventoryKPI.expiryRiskRate <= 5 ? 'yellow' : 'red'}
                  width={(screenWidth - 48) / 2}
                />
              </View>
              <View style={styles.kpiCardWrapper}>
                <MobileKPICard
                  title="损耗率"
                  value={inventoryKPI.lossRate}
                  unit="%"
                  changeRate={inventoryKPI.lossChange}
                  trend={inventoryKPI.lossChange <= 0 ? 'up' : 'down'}
                  status={inventoryKPI.lossRate <= 1 ? 'green' : inventoryKPI.lossRate <= 2 ? 'yellow' : 'red'}
                  width={(screenWidth - 48) / 2}
                />
              </View>
            </View>
          </View>
        )}

        {/* Inventory Aging Distribution */}
        {agingDistribution.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('inventory.agingDistribution', { defaultValue: '库龄分布' })}
            </Text>
            <Card style={styles.chartCard}>
              <Card.Content>
                <MobilePieChart
                  data={agingPieData}
                  width={screenWidth - 64}
                  height={280}
                  hasLegend
                />
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Expiry Warning Chart */}
        {expiryWarningData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('inventory.expiryWarning', { defaultValue: '效期预警分布' })}
            </Text>
            <Card style={styles.chartCard}>
              <Card.Content>
                <MobileBarChart
                  labels={expiryWarningData.map(item => item.label)}
                  data={expiryWarningData.map(item => item.value)}
                  width={screenWidth - 64}
                  height={200}
                  horizontal={false}
                  showValuesOnTopOfBars
                  barColor={SMARTBI_THEME.warning}
                />
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Near-Expiry Items List */}
        {expiryRiskItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t('inventory.nearExpiryItems', { defaultValue: '临期物料清单' })}
              </Text>
              <TouchableOpacity>
                <Text style={styles.viewAll}>
                  {t('common.viewAll', { defaultValue: '查看全部' })}
                </Text>
              </TouchableOpacity>
            </View>
            <Card style={styles.listCard}>
              {expiryRiskItems.slice(0, 5).map((item, index) => (
                <React.Fragment key={item.id}>
                  <ExpiryItem
                    item={item}
                    onPress={() => {
                      // Navigate to item detail
                    }}
                  />
                  {index < Math.min(expiryRiskItems.length, 5) - 1 && (
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
  alertSummary: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  alertBadgeText: {
    fontSize: 13,
    fontWeight: '600',
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
  listCard: {
    borderRadius: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
    overflow: 'hidden',
  },
  expiryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  expiryInfo: {
    flex: 1,
  },
  expiryName: {
    fontSize: 14,
    fontWeight: '500',
    color: SMARTBI_THEME.textPrimary,
  },
  expiryBatch: {
    fontSize: 12,
    color: SMARTBI_THEME.textSecondary,
    marginTop: 2,
  },
  expiryMeta: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  expiryQuantity: {
    fontSize: 13,
    color: SMARTBI_THEME.textPrimary,
  },
  expiryDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  expiryDays: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusChip: {
    height: 22,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
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

export default InventoryDashboardScreen;
