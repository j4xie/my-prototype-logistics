/**
 * SmartBI - Finance Analysis Screen
 *
 * Provides financial analysis including profit, cost, receivables,
 * payables, and budget comparison.
 *
 * Features:
 * - Analysis type toggle (profit/cost/receivables/payables/budget)
 * - Date range selection
 * - KPI cards and charts
 * - Alert list for financial issues
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
import { Text, Card, Surface, ActivityIndicator, IconButton, Divider, Chip } from 'react-native-paper';
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

// Analysis types
type AnalysisType = 'profit' | 'cost' | 'receivable' | 'payable' | 'budget';

interface AnalysisTypeOption {
  key: AnalysisType;
  label: string;
  icon: MaterialCommunityIconName;
  color: string;
}

// Date range
interface DateRange {
  startDate: string;
  endDate: string;
}

// Finance KPI
interface FinanceKPI {
  revenue: number;
  cost: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
  revenueChange: number;
  costChange: number;
  profitChange: number;
}

// Cost breakdown item
interface CostBreakdownItem {
  id: string;
  category: string;
  amount: number;
  percentage: number;
  change: number;
}

// Trend data
interface FinanceTrendPoint {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
}

// Financial alert
interface FinanceAlert {
  id: string;
  level: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  amount?: number;
  suggestion?: string;
}

// Full finance data
interface FinanceAnalysisData {
  kpi: FinanceKPI;
  costBreakdown: CostBreakdownItem[];
  trends: FinanceTrendPoint[];
  alerts: FinanceAlert[];
}

type FinanceAnalysisRouteProp = RouteProp<SmartBIStackParamList, 'FinanceAnalysis'>;

// KPI Card Component
interface FinanceKPICardProps {
  title: string;
  value: string;
  change?: number;
  icon: MaterialCommunityIconName;
  color: string;
  isPercentage?: boolean;
}

const FinanceKPICard: React.FC<FinanceKPICardProps> = ({
  title,
  value,
  change,
  icon,
  color,
  isPercentage,
}) => {
  const hasChange = change !== undefined;
  const isPositive = change && change >= 0;

  return (
    <Surface style={styles.kpiCard} elevation={2}>
      <View style={[styles.kpiIconContainer, { backgroundColor: color + '20' }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiTitle}>{title}</Text>
      {hasChange && (
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
      )}
    </Surface>
  );
};

// Cost Breakdown Item Component
interface CostItemProps {
  item: CostBreakdownItem;
}

const CostBreakdownItemComponent: React.FC<CostItemProps> = ({ item }) => {
  const formatAmount = (value: number): string => {
    if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}万`;
    }
    return value.toLocaleString();
  };

  return (
    <View style={styles.costItem}>
      <View style={styles.costInfo}>
        <Text style={styles.costCategory}>{item.category}</Text>
        <View style={styles.costProgressContainer}>
          <View
            style={[
              styles.costProgress,
              { width: `${Math.min(item.percentage, 100)}%` },
            ]}
          />
        </View>
      </View>
      <View style={styles.costValues}>
        <Text style={styles.costAmount}>{formatAmount(item.amount)}</Text>
        <Text style={styles.costPercentage}>{item.percentage.toFixed(1)}%</Text>
      </View>
    </View>
  );
};

// Alert Item Component
interface AlertItemProps {
  alert: FinanceAlert;
  onPress: () => void;
}

const AlertItemComponent: React.FC<AlertItemProps> = ({ alert, onPress }) => {
  const getAlertConfig = (level: FinanceAlert['level']): { icon: MaterialCommunityIconName; color: string } => {
    switch (level) {
      case 'danger':
        return { icon: 'alert-circle', color: SMARTBI_THEME.danger };
      case 'warning':
        return { icon: 'alert', color: SMARTBI_THEME.warning };
      case 'info':
      default:
        return { icon: 'information', color: SMARTBI_THEME.info };
    }
  };

  const config = getAlertConfig(alert.level);

  return (
    <TouchableOpacity style={styles.alertItem} onPress={onPress}>
      <View style={[styles.alertIcon, { backgroundColor: config.color + '20' }]}>
        <MaterialCommunityIcons name={config.icon} size={20} color={config.color} />
      </View>
      <View style={styles.alertContent}>
        <Text style={styles.alertTitle}>{alert.title}</Text>
        <Text style={styles.alertMessage} numberOfLines={2}>
          {alert.message}
        </Text>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={SMARTBI_THEME.textMuted}
      />
    </TouchableOpacity>
  );
};

// Simple Trend Chart
interface TrendChartProps {
  data: FinanceTrendPoint[];
  type: 'revenue' | 'cost' | 'profit';
}

const SimpleTrendChart: React.FC<TrendChartProps> = ({ data, type }) => {
  if (data.length === 0) {
    return (
      <View style={styles.chartEmpty}>
        <MaterialCommunityIcons name="chart-line" size={32} color={SMARTBI_THEME.textMuted} />
        <Text style={styles.chartEmptyText}>暂无数据</Text>
      </View>
    );
  }

  const values = data.map((d) => d[type]);
  const maxValue = Math.max(...values, 1);
  const chartHeight = 100;

  const getColor = () => {
    switch (type) {
      case 'revenue':
        return SMARTBI_THEME.primary;
      case 'cost':
        return SMARTBI_THEME.warning;
      case 'profit':
        return SMARTBI_THEME.success;
      default:
        return SMARTBI_THEME.primary;
    }
  };

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartBody}>
        {data.slice(-7).map((point, index) => {
          const height = (point[type] / maxValue) * chartHeight;
          return (
            <View key={index} style={styles.chartBar}>
              <View
                style={[
                  styles.chartBarFill,
                  { height: Math.max(height, 4), backgroundColor: getColor() },
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

export function FinanceAnalysisScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SmartBIStackParamList>>();
  const route = useRoute<FinanceAnalysisRouteProp>();
  const { analysisType: initialType } = route.params || {};
  const { getFactoryId } = useAuthStore();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analysis type
  const [selectedType, setSelectedType] = useState<AnalysisType>(
    (initialType as AnalysisType) || 'profit'
  );

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
  const [financeData, setFinanceData] = useState<FinanceAnalysisData | null>(null);

  const ANALYSIS_TYPES: AnalysisTypeOption[] = [
    { key: 'profit', label: t('finance.profit', { defaultValue: '利润' }), icon: 'trending-up', color: SMARTBI_THEME.success },
    { key: 'cost', label: t('finance.cost', { defaultValue: '成本' }), icon: 'currency-usd-off', color: SMARTBI_THEME.warning },
    { key: 'receivable', label: t('finance.receivable', { defaultValue: '应收' }), icon: 'bank-transfer-in', color: SMARTBI_THEME.info },
    { key: 'payable', label: t('finance.payable', { defaultValue: '应付' }), icon: 'bank-transfer-out', color: SMARTBI_THEME.danger },
    { key: 'budget', label: t('finance.budget', { defaultValue: '预算' }), icon: 'calculator', color: SMARTBI_THEME.secondary },
  ];

  const DATE_RANGE_OPTIONS = [
    { label: '近7天', days: 7 },
    { label: '近30天', days: 30 },
    { label: '本季度', days: 90 },
    { label: '本年度', days: 365 },
  ];

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const factoryId = getFactoryId();

      const response = await smartBIApiClient.getFinanceAnalysis({
        analysisType: selectedType,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        factoryId: factoryId || undefined,
      });

      if (response.success && response.data) {
        setFinanceData(response.data);
      } else {
        setError(response.message || t('errors.loadFailed', { defaultValue: '加载失败' }));
      }
    } catch (err) {
      console.error('Load finance analysis failed:', err);
      setError(t('errors.loadFailed', { defaultValue: '数据加载失败，请重试' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedType, dateRange, getFactoryId, t]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    loadData();
  }, [selectedType, dateRange]);

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

  const handleAlertPress = (alert: FinanceAlert) => {
    Alert.alert(
      alert.title,
      `${alert.message}\n\n${alert.suggestion || ''}`,
      [{ text: t('common.ok', { defaultValue: '确定' }) }]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('finance.title', { defaultValue: '财务分析' })}
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
          {t('finance.title', { defaultValue: '财务分析' })}
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

        {/* Analysis Type Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.typeSelector}
          contentContainerStyle={styles.typeSelectorContent}
        >
          {ANALYSIS_TYPES.map((type) => (
            <Chip
              key={type.key}
              selected={selectedType === type.key}
              onPress={() => setSelectedType(type.key)}
              style={[
                styles.typeChip,
                selectedType === type.key && { backgroundColor: type.color + '20' },
              ]}
              textStyle={[
                styles.typeChipText,
                selectedType === type.key && { color: type.color },
              ]}
              icon={() => (
                <MaterialCommunityIcons
                  name={type.icon}
                  size={16}
                  color={selectedType === type.key ? type.color : SMARTBI_THEME.textSecondary}
                />
              )}
            >
              {type.label}
            </Chip>
          ))}
        </ScrollView>

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
        {financeData && (
          <View style={styles.kpiGrid}>
            <FinanceKPICard
              title={t('kpi.revenue', { defaultValue: '营收' })}
              value={formatCurrency(financeData.kpi.revenue)}
              change={financeData.kpi.revenueChange}
              icon="trending-up"
              color={SMARTBI_THEME.primary}
            />
            <FinanceKPICard
              title={t('kpi.cost', { defaultValue: '成本' })}
              value={formatCurrency(financeData.kpi.cost)}
              change={financeData.kpi.costChange}
              icon="currency-usd-off"
              color={SMARTBI_THEME.warning}
            />
            <FinanceKPICard
              title={t('kpi.grossMargin', { defaultValue: '毛利率' })}
              value={`${financeData.kpi.grossMargin.toFixed(1)}%`}
              icon="percent"
              color={SMARTBI_THEME.info}
              isPercentage
            />
            <FinanceKPICard
              title={t('kpi.netProfit', { defaultValue: '净利润' })}
              value={formatCurrency(financeData.kpi.netProfit)}
              change={financeData.kpi.profitChange}
              icon="cash"
              color={SMARTBI_THEME.success}
            />
          </View>
        )}

        {/* Trend Chart */}
        {financeData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('finance.trendChart', { defaultValue: '趋势图表' })}
            </Text>
            <Card style={styles.chartCard}>
              <Card.Content>
                <SimpleTrendChart
                  data={financeData.trends}
                  type={selectedType === 'cost' ? 'cost' : selectedType === 'profit' ? 'profit' : 'revenue'}
                />
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Cost Breakdown */}
        {financeData && financeData.costBreakdown.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('finance.costBreakdown', { defaultValue: '成本构成' })}
            </Text>
            <Card style={styles.breakdownCard}>
              <Card.Content>
                {financeData.costBreakdown.map((item, index) => (
                  <React.Fragment key={item.id}>
                    <CostBreakdownItemComponent item={item} />
                    {index < financeData.costBreakdown.length - 1 && (
                      <Divider style={styles.divider} />
                    )}
                  </React.Fragment>
                ))}
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Alerts */}
        {financeData && financeData.alerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t('finance.alerts', { defaultValue: '预警提醒' })}
              </Text>
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{financeData.alerts.length}</Text>
              </View>
            </View>
            <Card style={styles.alertCard}>
              {financeData.alerts.map((alert, index) => (
                <React.Fragment key={alert.id}>
                  <AlertItemComponent
                    alert={alert}
                    onPress={() => handleAlertPress(alert)}
                  />
                  {index < financeData.alerts.length - 1 && (
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
  typeSelector: {
    marginBottom: 16,
  },
  typeSelectorContent: {
    gap: 8,
  },
  typeChip: {
    backgroundColor: SMARTBI_THEME.cardBackground,
    borderRadius: 20,
  },
  typeChipText: {
    fontSize: 13,
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
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
  },
  alertBadge: {
    backgroundColor: SMARTBI_THEME.danger,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  alertBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
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
  breakdownCard: {
    borderRadius: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
  },
  costItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  costInfo: {
    flex: 1,
  },
  costCategory: {
    fontSize: 14,
    color: SMARTBI_THEME.textPrimary,
    marginBottom: 6,
  },
  costProgressContainer: {
    height: 6,
    backgroundColor: SMARTBI_THEME.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  costProgress: {
    height: '100%',
    backgroundColor: SMARTBI_THEME.warning,
    borderRadius: 3,
  },
  costValues: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  costAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
  },
  costPercentage: {
    fontSize: 12,
    color: SMARTBI_THEME.textSecondary,
    marginTop: 2,
  },
  alertCard: {
    borderRadius: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
    overflow: 'hidden',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
  },
  alertMessage: {
    fontSize: 12,
    color: SMARTBI_THEME.textSecondary,
    marginTop: 2,
  },
  divider: {
    marginHorizontal: 0,
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

export default FinanceAnalysisScreen;
