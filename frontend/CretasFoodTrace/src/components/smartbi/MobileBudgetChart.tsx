import React, { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import Svg, { Rect, Text as SvgText, G, Line } from 'react-native-svg';
import { CHART_COLORS, CHART_SIZES } from './chartSizes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Budget data item for each month
 */
export interface BudgetData {
  /** Month label (e.g., "1月", "2月") */
  month: string;
  /** Budget amount */
  budget: number;
  /** Actual amount */
  actual: number;
  /** Achievement rate as percentage (0-100+) */
  achievementRate: number;
}

/**
 * MobileBudgetChart Props
 */
export interface MobileBudgetChartProps {
  /** Budget data array (typically 12 months) */
  data: BudgetData[];
  /** Chart title */
  title?: string;
  /** Year for display */
  year?: number;
  /** Chart height (default: 280) */
  height?: number;
  /** Show KPI summary cards (default: true) */
  showKPIs?: boolean;
}

/**
 * KPI Summary Card component
 */
interface KPISummaryCardProps {
  label: string;
  value: string;
  subValue?: string;
  status?: 'green' | 'red' | 'neutral';
}

function KPISummaryCard({ label, value, subValue, status = 'neutral' }: KPISummaryCardProps): React.ReactElement {
  const statusColor = status === 'green'
    ? CHART_COLORS.secondary
    : status === 'red'
      ? CHART_COLORS.danger
      : CHART_COLORS.gray;

  return (
    <View style={kpiStyles.card}>
      <Text style={kpiStyles.label} numberOfLines={1}>{label}</Text>
      <Text style={[kpiStyles.value, { color: statusColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {subValue && (
        <Text style={kpiStyles.subValue} numberOfLines={1}>{subValue}</Text>
      )}
    </View>
  );
}

const kpiStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
  },
  subValue: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
});

/**
 * Tooltip component for showing details
 */
interface TooltipData {
  month: string;
  budget: number;
  actual: number;
  achievementRate: number;
  x: number;
  y: number;
}

/**
 * Format number with localized thousands separator
 */
function formatNumber(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 10000) {
    return (value / 10000).toFixed(1) + '万';
  }
  return value.toLocaleString('zh-CN');
}

/**
 * Get achievement rate status color
 */
function getAchievementStatus(rate: number): 'green' | 'red' | 'neutral' {
  if (rate >= 100) return 'green';
  if (rate < 80) return 'red';
  return 'neutral';
}

/**
 * Get achievement rate color
 */
function getAchievementColor(rate: number): string {
  if (rate >= 100) return CHART_COLORS.secondary;
  if (rate < 80) return CHART_COLORS.danger;
  return CHART_COLORS.warning;
}

/**
 * MobileBudgetChart Component
 *
 * A mobile-optimized budget achievement chart with grouped bars,
 * KPI summary cards, and achievement rate indicators.
 *
 * @example
 * ```tsx
 * const budgetData: BudgetData[] = [
 *   { month: '1月', budget: 100000, actual: 95000, achievementRate: 95 },
 *   { month: '2月', budget: 120000, actual: 125000, achievementRate: 104.2 },
 *   // ... more months
 * ];
 *
 * <MobileBudgetChart
 *   data={budgetData}
 *   title="2024年预算执行情况"
 *   year={2024}
 *   showKPIs
 * />
 * ```
 */
export default function MobileBudgetChart({
  data,
  title,
  year,
  height = 280,
  showKPIs = true,
}: MobileBudgetChartProps): React.ReactElement {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [showTooltipModal, setShowTooltipModal] = useState(false);

  // Calculate KPI summary values
  const kpiSummary = useMemo(() => {
    if (data.length === 0) {
      return {
        totalBudget: 0,
        totalActual: 0,
        overallRate: 0,
        achievedMonths: 0,
      };
    }

    const totalBudget = data.reduce((sum, item) => sum + item.budget, 0);
    const totalActual = data.reduce((sum, item) => sum + item.actual, 0);
    const overallRate = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
    const achievedMonths = data.filter(item => item.achievementRate >= 100).length;

    return {
      totalBudget,
      totalActual,
      overallRate,
      achievedMonths,
    };
  }, [data]);

  // Chart dimensions
  const chartConfig = useMemo(() => {
    const barGroupWidth = 56; // Width for each month group
    const chartWidth = Math.max(data.length * barGroupWidth + 40, SCREEN_WIDTH - 32);
    const chartHeight = height - (showKPIs ? 80 : 0) - (title ? 40 : 0) - 40; // Reserve space for status dots
    const barWidth = 18;
    const barGap = 4;
    const paddingTop = 20;
    const paddingBottom = 30;
    const paddingLeft = 10;

    // Find max value for scaling
    const maxValue = Math.max(
      ...data.map(d => Math.max(d.budget, d.actual)),
      1
    );

    return {
      chartWidth,
      chartHeight,
      barWidth,
      barGap,
      barGroupWidth,
      paddingTop,
      paddingBottom,
      paddingLeft,
      maxValue,
      drawableHeight: chartHeight - paddingTop - paddingBottom,
    };
  }, [data, height, showKPIs, title]);

  // Handle bar press
  const handleBarPress = useCallback((item: BudgetData, index: number) => {
    const x = chartConfig.paddingLeft + index * chartConfig.barGroupWidth + chartConfig.barGroupWidth / 2;
    const y = chartConfig.paddingTop;

    setTooltip({
      month: item.month,
      budget: item.budget,
      actual: item.actual,
      achievementRate: item.achievementRate,
      x,
      y,
    });
    setShowTooltipModal(true);
  }, [chartConfig]);

  // Close tooltip
  const closeTooltip = useCallback(() => {
    setShowTooltipModal(false);
    setTooltip(null);
  }, []);

  // Edge case: Empty data
  if (data.length === 0) {
    return (
      <Surface style={styles.container} elevation={1}>
        {title && (
          <Text variant="titleMedium" style={styles.title}>
            {title}
          </Text>
        )}
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>暂无预算数据</Text>
        </View>
      </Surface>
    );
  }

  // Calculate bar heights
  const getBarHeight = (value: number): number => {
    return (value / chartConfig.maxValue) * chartConfig.drawableHeight;
  };

  // Get Y position for bar (from bottom)
  const getBarY = (value: number): number => {
    return chartConfig.paddingTop + chartConfig.drawableHeight - getBarHeight(value);
  };

  return (
    <Surface style={styles.container} elevation={1}>
      {/* Title */}
      {title && (
        <Text variant="titleMedium" style={styles.title}>
          {title}
          {year && <Text style={styles.yearLabel}> ({year}年)</Text>}
        </Text>
      )}

      {/* KPI Summary Cards */}
      {showKPIs && (
        <View style={styles.kpiRow}>
          <KPISummaryCard
            label="总预算"
            value={formatNumber(kpiSummary.totalBudget, true)}
            status="neutral"
          />
          <KPISummaryCard
            label="实际完成"
            value={formatNumber(kpiSummary.totalActual, true)}
            subValue={`${kpiSummary.overallRate.toFixed(1)}%`}
            status={getAchievementStatus(kpiSummary.overallRate)}
          />
          <KPISummaryCard
            label="达标月份"
            value={`${kpiSummary.achievedMonths}/${data.length}`}
            status={kpiSummary.achievedMonths >= data.length / 2 ? 'green' : 'red'}
          />
        </View>
      )}

      {/* Chart Area with Horizontal Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartScrollContent}
        style={styles.chartScrollView}
      >
        <Svg
          width={chartConfig.chartWidth}
          height={chartConfig.chartHeight}
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
            const y = chartConfig.paddingTop + chartConfig.drawableHeight * (1 - ratio);
            return (
              <Line
                key={`grid-${index}`}
                x1={chartConfig.paddingLeft}
                y1={y}
                x2={chartConfig.chartWidth - 10}
                y2={y}
                stroke="#E5E7EB"
                strokeWidth={1}
                strokeDasharray={ratio === 0 ? '' : '4,4'}
              />
            );
          })}

          {/* Bars and Labels */}
          {data.map((item, index) => {
            const groupX = chartConfig.paddingLeft + index * chartConfig.barGroupWidth;
            const budgetX = groupX + (chartConfig.barGroupWidth - chartConfig.barWidth * 2 - chartConfig.barGap) / 2;
            const actualX = budgetX + chartConfig.barWidth + chartConfig.barGap;

            const budgetHeight = getBarHeight(item.budget);
            const actualHeight = getBarHeight(item.actual);
            const budgetY = getBarY(item.budget);
            const actualY = getBarY(item.actual);

            return (
              <G key={`bar-group-${index}`}>
                {/* Budget bar */}
                <Rect
                  x={budgetX}
                  y={budgetY}
                  width={chartConfig.barWidth}
                  height={budgetHeight}
                  fill={CHART_COLORS.primary}
                  rx={3}
                  onPress={() => handleBarPress(item, index)}
                />

                {/* Actual bar */}
                <Rect
                  x={actualX}
                  y={actualY}
                  width={chartConfig.barWidth}
                  height={actualHeight}
                  fill={getAchievementColor(item.achievementRate)}
                  rx={3}
                  onPress={() => handleBarPress(item, index)}
                />

                {/* Month label */}
                <SvgText
                  x={groupX + chartConfig.barGroupWidth / 2}
                  y={chartConfig.chartHeight - 8}
                  fontSize={11}
                  fill="#6B7280"
                  textAnchor="middle"
                >
                  {item.month}
                </SvgText>

                {/* Achievement rate label above bars */}
                <SvgText
                  x={groupX + chartConfig.barGroupWidth / 2}
                  y={Math.min(budgetY, actualY) - 4}
                  fontSize={9}
                  fill={getAchievementColor(item.achievementRate)}
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {item.achievementRate.toFixed(0)}%
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: CHART_COLORS.primary }]} />
          <Text style={styles.legendText}>预算</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: CHART_COLORS.secondary }]} />
          <Text style={styles.legendText}>{'实际(>=100%)'}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: CHART_COLORS.danger }]} />
          <Text style={styles.legendText}>{'实际(<80%)'}</Text>
        </View>
      </View>

      {/* Monthly Status Dots Row */}
      <View style={styles.statusDotsContainer}>
        <Text style={styles.statusDotsLabel}>月度达标:</Text>
        <View style={styles.statusDotsRow}>
          {data.map((item, index) => (
            <TouchableOpacity
              key={`dot-${index}`}
              style={[
                styles.statusDot,
                { backgroundColor: getAchievementColor(item.achievementRate) },
              ]}
              onPress={() => handleBarPress(item, index)}
              activeOpacity={0.7}
            >
              <Text style={styles.statusDotText}>
                {item.month.replace('月', '')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tooltip Modal */}
      <Modal
        visible={showTooltipModal}
        transparent
        animationType="fade"
        onRequestClose={closeTooltip}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeTooltip}
        >
          {tooltip && (
            <View style={styles.tooltipContainer}>
              <Text style={styles.tooltipTitle}>{tooltip.month}预算执行</Text>
              <View style={styles.tooltipRow}>
                <View style={[styles.tooltipDot, { backgroundColor: CHART_COLORS.primary }]} />
                <Text style={styles.tooltipLabel}>预算:</Text>
                <Text style={styles.tooltipValue}>{formatNumber(tooltip.budget)}</Text>
              </View>
              <View style={styles.tooltipRow}>
                <View style={[styles.tooltipDot, { backgroundColor: getAchievementColor(tooltip.achievementRate) }]} />
                <Text style={styles.tooltipLabel}>实际:</Text>
                <Text style={styles.tooltipValue}>{formatNumber(tooltip.actual)}</Text>
              </View>
              <View style={styles.tooltipDivider} />
              <View style={styles.tooltipRow}>
                <Text style={styles.tooltipLabel}>达成率:</Text>
                <Text style={[
                  styles.tooltipRate,
                  { color: getAchievementColor(tooltip.achievementRate) }
                ]}>
                  {tooltip.achievementRate.toFixed(1)}%
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
  },
  title: {
    fontWeight: '600',
    marginBottom: 12,
    color: '#1F2937',
  },
  yearLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
  },
  kpiRow: {
    flexDirection: 'row',
    marginBottom: 12,
    marginHorizontal: -4,
  },
  chartScrollView: {
    marginHorizontal: -16,
  },
  chartScrollContent: {
    paddingHorizontal: 16,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 2,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#6B7280',
  },
  statusDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statusDotsLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginRight: 8,
  },
  statusDotsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
  },
  statusDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
    marginBottom: 4,
  },
  statusDotText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  noDataContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tooltipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  tooltipLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginRight: 8,
  },
  tooltipValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    textAlign: 'right',
  },
  tooltipDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  tooltipRate: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
});
