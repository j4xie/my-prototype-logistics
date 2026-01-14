import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  Platform,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Appbar,
  Surface,
  Divider,
  ActivityIndicator,
  List,
  Chip,
  Button,
  SegmentedButtons,
  Icon,
  Card,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ReportStackParamList } from '../../types/navigation';
import DateTimePicker from '@react-native-community/datetimepicker';

import { GaugeChart } from '../../components/charts';
import { reportApiClient, KpiMetricsDTO } from '../../services/api/reportApiClient';
import { useAuthStore } from '../../store/authStore';
import { handleError, getErrorMsg } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// Create context logger
const log = logger.createContextLogger('KPIReport');

// Screen width for responsive layout
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAUGE_SIZE_LARGE = Math.min(200, SCREEN_WIDTH * 0.45);
const GAUGE_SIZE_SMALL = Math.min(140, (SCREEN_WIDTH - 64) / 2);

// Grade colors
const GRADE_COLORS: Record<string, string> = {
  A: '#4CAF50',
  B: '#8BC34A',
  C: '#FFC107',
  D: '#FF5722',
};

// Format date to YYYY-MM-DD
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format time display
function formatTimeDisplay(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}分钟`;
  }
  return `${hours.toFixed(1)}小时`;
}

// Metric item component
interface MetricItemProps {
  label: string;
  value: number | undefined | null;
  unit?: string;
  format?: 'percent' | 'number' | 'time' | 'count';
  inverted?: boolean; // Lower is better
}

function MetricItem({ label, value, unit = '%', format = 'percent', inverted = false }: MetricItemProps) {
  const displayValue = useMemo(() => {
    if (value === undefined || value === null) return '--';

    switch (format) {
      case 'percent':
        return `${(value * 100).toFixed(1)}${unit}`;
      case 'number':
        return `${value.toFixed(2)}${unit}`;
      case 'time':
        return formatTimeDisplay(value);
      case 'count':
        return `${Math.round(value)}${unit}`;
      default:
        return `${value}${unit}`;
    }
  }, [value, unit, format]);

  const getColor = () => {
    if (value === undefined || value === null) return '#757575';
    if (format === 'percent') {
      const percentage = value * 100;
      if (inverted) {
        // Lower is better (like scrap rate)
        if (percentage <= 5) return '#4CAF50';
        if (percentage <= 10) return '#FF9800';
        return '#F44336';
      }
      // Higher is better
      if (percentage >= 80) return '#4CAF50';
      if (percentage >= 60) return '#FF9800';
      return '#F44336';
    }
    return '#212121';
  };

  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: getColor() }]}>{displayValue}</Text>
    </View>
  );
}

// Tab definitions
type TabValue = 'kpi' | 'trend' | 'forecast' | 'delivery';

interface InsightNavCard {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  screen: keyof ReportStackParamList;
}

export default function KPIReportScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ReportStackParamList>>();
  const { getFactoryId } = useAuthStore();

  // State
  const [activeTab, setActiveTab] = useState<TabValue>('kpi');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpiData, setKpiData] = useState<KpiMetricsDTO | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Expanded accordion sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['production', 'quality']));

  // Load KPI data
  const loadKpiData = useCallback(async (showLoading = true) => {
    const factoryId = getFactoryId();
    if (!factoryId) {
      log.warn('No factoryId available');
      return;
    }

    try {
      if (showLoading) setLoading(true);

      const dateStr = formatDate(selectedDate);
      log.debug('Loading KPI metrics', { factoryId, date: dateStr });

      const data = await reportApiClient.getKpiMetrics({
        date: dateStr,
        factoryId,
      });

      setKpiData(data);
      log.info('KPI metrics loaded successfully', {
        overallScore: data.overallScore,
        scoreGrade: data.scoreGrade
      });
    } catch (error) {
      log.error('Failed to load KPI metrics', error);
      handleError(error, {
        title: '加载失败',
        customMessage: `无法加载KPI数据: ${getErrorMsg(error)}`,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getFactoryId, selectedDate]);

  // Load data on focus and date change
  useFocusEffect(
    useCallback(() => {
      loadKpiData();
    }, [loadKpiData])
  );

  // Refresh handler
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadKpiData(false);
  }, [loadKpiData]);

  // Date change handler
  const handleDateChange = (_event: unknown, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
    }
  };

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Render overall score card
  const renderOverallScoreCard = () => {
    const grade = kpiData?.scoreGrade || 'N/A';
    const gradeColor = GRADE_COLORS[grade] || '#757575';
    const periodChange = kpiData?.periodChange || 0;
    const changeText = periodChange >= 0 ? `+${(periodChange * 100).toFixed(1)}%` : `${(periodChange * 100).toFixed(1)}%`;
    const changeColor = periodChange >= 0 ? '#4CAF50' : '#F44336';

    return (
      <Surface style={styles.overallCard} elevation={2}>
        <Text style={styles.cardTitle}>综合评分</Text>
        <View style={styles.overallContent}>
          <View style={styles.gaugeWrapper}>
            <GaugeChart
              value={kpiData?.overallScore ?? 0}
              maxValue={100}
              title=""
              unit="分"
              size={GAUGE_SIZE_LARGE}
              thresholds={{ warning: 60, danger: 80 }}
              showTicks={true}
              showLabels={true}
            />
          </View>
          <View style={styles.gradeInfo}>
            <Text style={styles.gradeLabel}>评级</Text>
            <View style={[styles.gradeBadge, { backgroundColor: gradeColor }]}>
              <Text style={styles.gradeText}>{grade}</Text>
            </View>
            <View style={styles.changeRow}>
              <Text style={styles.changeLabel}>环比变化</Text>
              <Text style={[styles.changeValue, { color: changeColor }]}>{changeText}</Text>
            </View>
          </View>
        </View>
      </Surface>
    );
  };

  // Render core KPI gauges
  const renderCoreKPIGrid = () => {
    const coreKpis = [
      {
        key: 'oee',
        title: 'OEE',
        value: (kpiData?.oee ?? 0) * 100,
        thresholds: { warning: 60, danger: 85 }
      },
      {
        key: 'fpy',
        title: 'FPY',
        value: (kpiData?.fpy ?? 0) * 100,
        thresholds: { warning: 80, danger: 95 }
      },
      {
        key: 'otif',
        title: 'OTIF',
        value: (kpiData?.otif ?? 0) * 100,
        thresholds: { warning: 85, danger: 95 }
      },
      {
        key: 'capacityUtilization',
        title: '产能利用率',
        value: (kpiData?.capacityUtilization ?? 0) * 100,
        thresholds: { warning: 60, danger: 85 }
      },
    ];

    return (
      <Surface style={styles.coreKpiCard} elevation={1}>
        <Text style={styles.cardTitle}>核心KPI指标</Text>
        <Divider style={styles.divider} />
        <View style={styles.gaugeGrid}>
          {coreKpis.map((kpi) => (
            <View key={kpi.key} style={styles.gaugeCell}>
              <GaugeChart
                value={kpi.value}
                maxValue={100}
                title={kpi.title}
                unit="%"
                size={GAUGE_SIZE_SMALL}
                thresholds={kpi.thresholds}
                showTicks={false}
                showLabels={false}
              />
            </View>
          ))}
        </View>
      </Surface>
    );
  };

  // Render category sections
  const renderCategorySection = (
    key: string,
    title: string,
    icon: string,
    metrics: MetricItemProps[]
  ) => {
    const isExpanded = expandedSections.has(key);

    return (
      <List.Accordion
        key={key}
        title={title}
        left={(props) => <List.Icon {...props} icon={icon} />}
        expanded={isExpanded}
        onPress={() => toggleSection(key)}
        style={styles.accordion}
        titleStyle={styles.accordionTitle}
      >
        <View style={styles.metricsGrid}>
          {metrics.map((metric, index) => (
            <MetricItem key={index} {...metric} />
          ))}
        </View>
      </List.Accordion>
    );
  };

  // Category definitions
  const categories = useMemo(() => [
    {
      key: 'production',
      title: '生产效率',
      icon: 'factory',
      metrics: [
        { label: '产出完成率', value: kpiData?.outputCompletionRate, format: 'percent' as const },
        { label: '产能利用率', value: kpiData?.capacityUtilization, format: 'percent' as const },
        { label: '平均周期时间', value: kpiData?.avgCycleTime, unit: '小时', format: 'time' as const },
        { label: '产量', value: kpiData?.throughput, unit: '件', format: 'count' as const },
      ],
    },
    {
      key: 'quality',
      title: '质量指标',
      icon: 'check-decagram',
      metrics: [
        { label: '一次合格率(FPY)', value: kpiData?.fpy, format: 'percent' as const },
        { label: '综合质量率', value: kpiData?.overallQualityRate, format: 'percent' as const },
        { label: '废品率', value: kpiData?.scrapRate, format: 'percent' as const, inverted: true },
        { label: '返工率', value: kpiData?.reworkRate, format: 'percent' as const, inverted: true },
      ],
    },
    {
      key: 'cost',
      title: '成本指标',
      icon: 'currency-cny',
      metrics: [
        { label: '单位成本', value: kpiData?.unitCost, unit: '元', format: 'number' as const },
        { label: 'BOM差异率', value: kpiData?.bomVarianceRate, format: 'percent' as const, inverted: true },
        { label: '材料成本占比', value: kpiData?.materialCostRatio, format: 'percent' as const },
        { label: '人工成本占比', value: kpiData?.laborCostRatio, format: 'percent' as const },
      ],
    },
    {
      key: 'delivery',
      title: '交付指标',
      icon: 'truck-delivery',
      metrics: [
        { label: 'OTIF', value: kpiData?.otif, format: 'percent' as const },
        { label: '准时交付率', value: kpiData?.onTimeDeliveryRate, format: 'percent' as const },
        { label: '足量交付率', value: kpiData?.inFullDeliveryRate, format: 'percent' as const },
        { label: '平均交期', value: kpiData?.avgLeadTime, unit: '天', format: 'number' as const },
      ],
    },
    {
      key: 'equipment',
      title: '设备指标',
      icon: 'cog',
      metrics: [
        { label: '设备可用率', value: kpiData?.equipmentAvailability, format: 'percent' as const },
        { label: 'MTBF', value: kpiData?.mtbf, unit: '小时', format: 'time' as const },
        { label: 'MTTR', value: kpiData?.mttr, unit: '小时', format: 'time' as const },
        { label: '预防维护完成率', value: kpiData?.pmCompletionRate, format: 'percent' as const },
      ],
    },
    {
      key: 'personnel',
      title: '人员指标',
      icon: 'account-group',
      metrics: [
        { label: '人均产出', value: kpiData?.outputPerWorker, unit: '件', format: 'count' as const },
        { label: '出勤率', value: kpiData?.attendanceRate, format: 'percent' as const },
        { label: '加班率', value: kpiData?.overtimeRate, format: 'percent' as const, inverted: true },
      ],
    },
  ], [kpiData]);

  // Render date selector
  const renderDateSelector = () => (
    <View style={styles.dateSelector}>
      <Text style={styles.dateLabel}>报告日期:</Text>
      <Chip
        icon="calendar"
        onPress={() => setShowDatePicker(true)}
        style={styles.dateChip}
      >
        {formatDate(selectedDate)}
      </Chip>
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}
    </View>
  );

  // Navigation cards for insight tabs
  const insightCards: InsightNavCard[] = useMemo(() => [
    {
      key: 'trend',
      title: '趋势分析',
      subtitle: '查看生产数据历史趋势变化',
      icon: 'chart-line',
      iconColor: '#2196F3',
      screen: 'TrendReport',
    },
    {
      key: 'forecast',
      title: '预测分析',
      subtitle: 'AI智能预测与规划建议',
      icon: 'crystal-ball',
      iconColor: '#E91E63',
      screen: 'ForecastReport',
    },
    {
      key: 'delivery',
      title: '交付分析',
      subtitle: 'OTIF准时足量交付报表',
      icon: 'truck-delivery',
      iconColor: '#4CAF50',
      screen: 'OnTimeDeliveryReport',
    },
  ], []);

  // Get current tab's navigation cards
  const getCurrentTabCards = useCallback(() => {
    switch (activeTab) {
      case 'trend':
        return insightCards.filter(c => c.key === 'trend');
      case 'forecast':
        return insightCards.filter(c => c.key === 'forecast');
      case 'delivery':
        return insightCards.filter(c => c.key === 'delivery');
      default:
        return [];
    }
  }, [activeTab, insightCards]);

  // Render navigation card
  const renderNavCard = (card: InsightNavCard) => (
    <TouchableOpacity
      key={card.key}
      onPress={() => navigation.navigate(card.screen as any)}
      activeOpacity={0.7}
    >
      <Card style={styles.navCard}>
        <Card.Content style={styles.navCardContent}>
          <View style={[styles.navCardIcon, { backgroundColor: `${card.iconColor}15` }]}>
            <Icon source={card.icon} size={32} color={card.iconColor} />
          </View>
          <View style={styles.navCardText}>
            <Text variant="titleMedium" style={styles.navCardTitle}>{card.title}</Text>
            <Text variant="bodySmall" style={styles.navCardSubtitle}>{card.subtitle}</Text>
          </View>
          <Icon source="chevron-right" size={24} color="#9E9E9E" />
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  // Render insight tab content (for trend, forecast, delivery tabs)
  const renderInsightTabContent = () => {
    const cards = getCurrentTabCards();
    if (cards.length === 0) return null;

    const card = cards[0];
    if (!card) return null;

    return (
      <ScrollView style={styles.content} contentContainerStyle={styles.insightContentContainer}>
        <Surface style={styles.insightCard} elevation={1}>
          <View style={styles.insightHeader}>
            <Icon
              source={card.icon}
              size={48}
              color={card.iconColor}
            />
            <Text variant="headlineSmall" style={styles.insightTitle}>
              {card.title}
            </Text>
            <Text variant="bodyMedium" style={styles.insightDescription}>
              {card.subtitle}
            </Text>
          </View>
          <Button
            mode="contained"
            onPress={() => navigation.navigate(card.screen as any)}
            style={styles.insightButton}
            icon="arrow-right"
            contentStyle={styles.insightButtonContent}
          >
            查看详情
          </Button>
        </Surface>
      </ScrollView>
    );
  };

  // Render tab selector
  const renderTabSelector = () => (
    <View style={styles.tabContainer}>
      <SegmentedButtons
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabValue)}
        buttons={[
          { value: 'kpi', label: 'KPI指标' },
          { value: 'trend', label: '趋势' },
          { value: 'forecast', label: '预测' },
          { value: 'delivery', label: '交付' },
        ]}
        style={styles.segmentedButtons}
      />
    </View>
  );

  // Render loading state
  if (loading && !kpiData && activeTab === 'kpi') {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="数据洞察" />
        </Appbar.Header>
        {renderTabSelector()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载KPI数据...</Text>
        </View>
      </View>
    );
  }

  // Render empty state for KPI tab
  if (!kpiData && activeTab === 'kpi') {
    return (
      <View style={styles.container}>
        <Appbar.Header elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="数据洞察" />
          <Appbar.Action icon="refresh" onPress={handleRefresh} />
        </Appbar.Header>
        {renderTabSelector()}
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>暂无KPI数据</Text>
          <Button mode="contained" onPress={() => loadKpiData()} style={styles.retryButton}>
            重新加载
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="数据洞察" />
        {activeTab === 'kpi' && (
          <Appbar.Action icon="refresh" onPress={handleRefresh} disabled={refreshing} />
        )}
      </Appbar.Header>

      {renderTabSelector()}

      {activeTab === 'kpi' ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Date Selector */}
          {renderDateSelector()}

          {/* Overall Score Card */}
          {renderOverallScoreCard()}

          {/* Core KPI Grid */}
          {renderCoreKPIGrid()}

          {/* Category Sections */}
          <Surface style={styles.categoriesCard} elevation={1}>
            <Text style={styles.cardTitle}>详细指标</Text>
            <Divider style={styles.divider} />
            {categories.map((category) =>
              renderCategorySection(
                category.key,
                category.title,
                category.icon,
                category.metrics
              )
            )}
          </Surface>

          {/* Update time */}
          <Text style={styles.updateTime}>
            更新时间: {kpiData?.updatedAt ? new Date(kpiData.updatedAt).toLocaleString('zh-CN') : '--'}
          </Text>
        </ScrollView>
      ) : (
        renderInsightTabContent()
      )}
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
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#757575',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 8,
  },

  // Date selector
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 14,
    color: '#757575',
    marginRight: 8,
  },
  dateChip: {
    backgroundColor: '#E3F2FD',
  },

  // Overall score card
  overallCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  overallContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gaugeWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  gradeInfo: {
    alignItems: 'center',
    paddingLeft: 16,
  },
  gradeLabel: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 4,
  },
  gradeBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gradeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  changeRow: {
    alignItems: 'center',
  },
  changeLabel: {
    fontSize: 11,
    color: '#9E9E9E',
  },
  changeValue: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Core KPI card
  coreKpiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  divider: {
    marginVertical: 12,
  },
  gaugeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  gaugeCell: {
    alignItems: 'center',
    marginVertical: 8,
    width: '48%',
  },

  // Categories card
  categoriesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  accordion: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    marginBottom: 8,
  },
  accordionTitle: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Metrics grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  metricItem: {
    width: '50%',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },

  // Update time
  updateTime: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
    marginTop: 8,
  },

  // Tab selector
  tabContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  segmentedButtons: {
    borderRadius: 8,
  },

  // Navigation card styles
  navCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  navCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  navCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  navCardText: {
    flex: 1,
  },
  navCardTitle: {
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  navCardSubtitle: {
    color: '#757575',
  },

  // Insight tab content
  insightContentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  insightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  insightHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  insightTitle: {
    fontWeight: '600',
    color: '#212121',
    marginTop: 16,
    marginBottom: 8,
  },
  insightDescription: {
    color: '#757575',
    textAlign: 'center',
  },
  insightButton: {
    borderRadius: 8,
  },
  insightButtonContent: {
    flexDirection: 'row-reverse',
    paddingVertical: 4,
  },
});
