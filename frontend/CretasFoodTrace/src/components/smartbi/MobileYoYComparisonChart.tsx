import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Text, Surface } from 'react-native-paper';
import Svg, { Rect, G, Text as SvgText, Line } from 'react-native-svg';
import { CHART_COLORS, CHART_SIZES } from './chartSizes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * View mode type - YoY (Year-over-Year) or MoM (Month-over-Month)
 */
export type ViewMode = 'yoy' | 'mom';

/**
 * Comparison data item
 */
export interface ComparisonData {
  /** Period label (e.g., "1月", "Jan", "Q1") */
  period: string;
  /** Current period value */
  currentValue: number;
  /** Previous period value (same period last year for YoY) */
  previousValue: number;
  /** Year-over-Year growth rate (%) */
  yoyRate: number;
  /** Month-over-Month growth rate (%) */
  momRate: number;
}

/**
 * MobileYoYComparisonChart Props
 */
export interface MobileYoYComparisonChartProps {
  /** Chart data array */
  data: ComparisonData[];
  /** Chart title */
  title?: string;
  /** Chart height (default: 260) */
  height?: number;
  /** Metric name for display (e.g., "Sales", "Revenue") */
  metric?: string;
  /** Unit suffix (e.g., "万元", "件") */
  unit?: string;
  /** Positive growth is good (green) or bad (red) - default: true */
  positiveIsGood?: boolean;
  /** Show view mode toggle - default: true */
  showToggle?: boolean;
  /** Initial view mode - default: 'yoy' */
  defaultViewMode?: ViewMode;
  /** On view mode change callback */
  onViewModeChange?: (mode: ViewMode) => void;
  /** On bar press callback */
  onBarPress?: (index: number, data: ComparisonData) => void;
}

/**
 * Format number with K/M suffix
 */
function formatNumber(value: number, precision = 1): string {
  if (Math.abs(value) >= 1000000) {
    return (value / 1000000).toFixed(precision) + 'M';
  } else if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(precision) + 'K';
  }
  return value.toFixed(precision === 0 ? 0 : precision);
}

/**
 * Format rate with sign
 */
function formatRate(rate: number): string {
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate.toFixed(1)}%`;
}

/**
 * Summary row component
 */
interface SummaryRowProps {
  currentTotal: number;
  previousTotal: number;
  yoyChange: number;
  yoyRate: number;
  unit?: string;
  positiveIsGood: boolean;
}

function SummaryRow({
  currentTotal,
  previousTotal,
  yoyChange,
  yoyRate,
  unit = '',
  positiveIsGood,
}: SummaryRowProps): React.ReactElement {
  const isPositive = yoyChange > 0;
  const trendColor = positiveIsGood
    ? (isPositive ? CHART_COLORS.secondary : CHART_COLORS.danger)
    : (isPositive ? CHART_COLORS.danger : CHART_COLORS.secondary);
  const trendArrow = isPositive ? '\u2191' : (yoyChange < 0 ? '\u2193' : '\u2192');

  return (
    <View style={summaryStyles.container}>
      {/* Previous Total */}
      <View style={summaryStyles.card}>
        <Text style={summaryStyles.label}>上年累计</Text>
        <Text style={summaryStyles.value}>
          {formatNumber(previousTotal, 0)}
          <Text style={summaryStyles.unit}>{unit}</Text>
        </Text>
      </View>

      {/* Current Total */}
      <View style={[summaryStyles.card, summaryStyles.highlightCard]}>
        <Text style={summaryStyles.label}>本年累计</Text>
        <Text style={[summaryStyles.value, summaryStyles.primaryValue]}>
          {formatNumber(currentTotal, 0)}
          <Text style={summaryStyles.unit}>{unit}</Text>
        </Text>
      </View>

      {/* YoY Change */}
      <View style={summaryStyles.card}>
        <Text style={summaryStyles.label}>同比变化</Text>
        <View style={summaryStyles.trendRow}>
          <Text style={[summaryStyles.trendArrow, { color: trendColor }]}>
            {trendArrow}
          </Text>
          <Text style={[summaryStyles.trendValue, { color: trendColor }]}>
            {formatRate(yoyRate)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  card: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EBEEF5',
  },
  highlightCard: {
    backgroundColor: '#ECF5FF',
    borderColor: '#B3D8FF',
  },
  label: {
    fontSize: 10,
    color: '#909399',
    marginBottom: 4,
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: '#303133',
  },
  primaryValue: {
    color: CHART_COLORS.primary,
  },
  unit: {
    fontSize: 10,
    fontWeight: '400',
    color: '#909399',
    marginLeft: 2,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendArrow: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 2,
  },
  trendValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});

/**
 * View mode toggle component
 */
interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

function ViewToggle({ mode, onChange }: ViewToggleProps): React.ReactElement {
  return (
    <View style={toggleStyles.container}>
      <TouchableOpacity
        style={[
          toggleStyles.button,
          mode === 'yoy' && toggleStyles.activeButton,
        ]}
        onPress={() => onChange('yoy')}
        activeOpacity={0.7}
      >
        <Text
          style={[
            toggleStyles.buttonText,
            mode === 'yoy' && toggleStyles.activeButtonText,
          ]}
        >
          同比
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          toggleStyles.button,
          mode === 'mom' && toggleStyles.activeButton,
        ]}
        onPress={() => onChange('mom')}
        activeOpacity={0.7}
      >
        <Text
          style={[
            toggleStyles.buttonText,
            mode === 'mom' && toggleStyles.activeButtonText,
          ]}
        >
          环比
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const toggleStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F0F2F5',
    borderRadius: 6,
    padding: 2,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  activeButton: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonText: {
    fontSize: 12,
    color: '#909399',
    fontWeight: '500',
  },
  activeButtonText: {
    color: CHART_COLORS.primary,
    fontWeight: '600',
  },
});

/**
 * Growth badge component
 */
interface GrowthBadgeProps {
  rate: number;
  positiveIsGood: boolean;
  x: number;
  y: number;
}

function GrowthBadge({ rate, positiveIsGood, x, y }: GrowthBadgeProps): React.ReactElement {
  const isPositive = rate > 0;
  const bgColor = positiveIsGood
    ? (isPositive ? '#DCFCE7' : '#FEE2E2')
    : (isPositive ? '#FEE2E2' : '#DCFCE7');
  const textColor = positiveIsGood
    ? (isPositive ? '#15803D' : '#DC2626')
    : (isPositive ? '#DC2626' : '#15803D');
  const arrow = isPositive ? '\u2191' : (rate < 0 ? '\u2193' : '');

  const badgeWidth = 40;
  const badgeHeight = 16;

  return (
    <G>
      <Rect
        x={x - badgeWidth / 2}
        y={y - badgeHeight - 4}
        width={badgeWidth}
        height={badgeHeight}
        rx={8}
        fill={bgColor}
      />
      <SvgText
        x={x}
        y={y - badgeHeight / 2 - 4 + 4}
        textAnchor="middle"
        fontSize={9}
        fontWeight="600"
        fill={textColor}
      >
        {arrow}{Math.abs(rate).toFixed(0)}%
      </SvgText>
    </G>
  );
}

/**
 * MobileYoYComparisonChart Component
 *
 * A mobile-optimized year-over-year and month-over-month comparison chart.
 * Features grouped bar chart with current vs previous period comparison,
 * growth rate badges, and summary KPI row.
 *
 * @example
 * ```tsx
 * <MobileYoYComparisonChart
 *   title="Monthly Revenue Comparison"
 *   data={[
 *     { period: '1月', currentValue: 120, previousValue: 100, yoyRate: 20, momRate: 5 },
 *     { period: '2月', currentValue: 150, previousValue: 130, yoyRate: 15.4, momRate: 25 },
 *   ]}
 *   metric="Revenue"
 *   unit="万元"
 * />
 * ```
 */
export default function MobileYoYComparisonChart({
  data,
  title,
  height = 260,
  metric = '数值',
  unit = '',
  positiveIsGood = true,
  showToggle = true,
  defaultViewMode = 'yoy',
  onViewModeChange,
  onBarPress,
}: MobileYoYComparisonChartProps): React.ReactElement {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Handle view mode change
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    onViewModeChange?.(mode);
  }, [onViewModeChange]);

  // Calculate summary values
  const summary = useMemo(() => {
    if (!data || data.length === 0) {
      return { currentTotal: 0, previousTotal: 0, yoyChange: 0, yoyRate: 0 };
    }

    const currentTotal = data.reduce((sum, d) => sum + (d.currentValue || 0), 0);
    const previousTotal = data.reduce((sum, d) => sum + (d.previousValue || 0), 0);
    const yoyChange = currentTotal - previousTotal;
    const yoyRate = previousTotal !== 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : 0;

    return { currentTotal, previousTotal, yoyChange, yoyRate };
  }, [data]);

  // Chart dimensions
  const chartWidth = SCREEN_WIDTH - 64; // Account for padding
  const chartHeight = height - 40; // Reserve space for labels
  const barGroupWidth = data.length > 0 ? Math.min(60, (chartWidth - 40) / data.length) : 60;
  const barWidth = (barGroupWidth - 8) / 2; // Two bars with gap
  const contentWidth = Math.max(chartWidth, data.length * barGroupWidth + 40);

  // Calculate max value for scaling
  const maxValue = useMemo(() => {
    if (!data || data.length === 0) return 100;
    const values = data.flatMap(d => [d.currentValue, d.previousValue]);
    return Math.max(...values, 1) * 1.2; // Add 20% padding
  }, [data]);

  // Scale value to chart height
  const scaleY = useCallback((value: number): number => {
    const availableHeight = chartHeight - 60; // Reserve space for labels and badges
    return availableHeight - (value / maxValue) * availableHeight + 30;
  }, [chartHeight, maxValue]);

  // Handle bar press
  const handleBarPress = useCallback((index: number) => {
    setSelectedIndex(index);
    if (onBarPress && data[index]) {
      onBarPress(index, data[index]);
    }
  }, [data, onBarPress]);

  // Empty data check
  if (!data || data.length === 0) {
    return (
      <Surface style={styles.container} elevation={1}>
        {title && (
          <View style={styles.header}>
            <Text variant="titleMedium" style={styles.title}>{title}</Text>
          </View>
        )}
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>暂无数据</Text>
        </View>
      </Surface>
    );
  }

  // Get rate based on view mode
  const getRate = (item: ComparisonData): number => {
    return viewMode === 'yoy' ? item.yoyRate : item.momRate;
  };

  return (
    <Surface style={styles.container} elevation={1}>
      {/* Header */}
      <View style={styles.header}>
        {title && (
          <Text variant="titleMedium" style={styles.title}>{title}</Text>
        )}
        {showToggle && (
          <ViewToggle mode={viewMode} onChange={handleViewModeChange} />
        )}
      </View>

      {/* Summary Row */}
      <SummaryRow
        currentTotal={summary.currentTotal}
        previousTotal={summary.previousTotal}
        yoyChange={summary.yoyChange}
        yoyRate={summary.yoyRate}
        unit={unit}
        positiveIsGood={positiveIsGood}
      />

      {/* Chart */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartScrollContent}
      >
        <View style={styles.chartContainer}>
          <Svg width={contentWidth} height={chartHeight}>
            {/* Y-axis grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = scaleY(maxValue * (1 - ratio));
              return (
                <G key={`grid-${i}`}>
                  <Line
                    x1={35}
                    y1={y}
                    x2={contentWidth - 10}
                    y2={y}
                    stroke="#E5E7EB"
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                  <SvgText
                    x={30}
                    y={y + 4}
                    textAnchor="end"
                    fontSize={10}
                    fill="#9CA3AF"
                  >
                    {formatNumber(maxValue * (1 - ratio), 0)}
                  </SvgText>
                </G>
              );
            })}

            {/* Bars */}
            {data.map((item, index) => {
              const groupX = 45 + index * barGroupWidth;
              const currentHeight = (item.currentValue / maxValue) * (chartHeight - 60);
              const previousHeight = (item.previousValue / maxValue) * (chartHeight - 60);
              const currentY = scaleY(item.currentValue);
              const previousY = scaleY(item.previousValue);
              const isSelected = selectedIndex === index;
              const rate = getRate(item);

              return (
                <G key={`bar-${index}`} onPress={() => handleBarPress(index)}>
                  {/* Previous period bar (gray) */}
                  <Rect
                    x={groupX}
                    y={previousY}
                    width={barWidth}
                    height={previousHeight}
                    rx={3}
                    fill={isSelected ? '#9CA3AF' : '#D1D5DB'}
                  />

                  {/* Current period bar (blue) */}
                  <Rect
                    x={groupX + barWidth + 4}
                    y={currentY}
                    width={barWidth}
                    height={currentHeight}
                    rx={3}
                    fill={isSelected ? '#2563EB' : CHART_COLORS.primary}
                  />

                  {/* Growth badge */}
                  <GrowthBadge
                    rate={rate}
                    positiveIsGood={positiveIsGood}
                    x={groupX + barGroupWidth / 2 - 2}
                    y={Math.min(currentY, previousY)}
                  />

                  {/* X-axis label */}
                  <SvgText
                    x={groupX + barGroupWidth / 2 - 2}
                    y={chartHeight - 5}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={isSelected ? '600' : '400'}
                    fill={isSelected ? '#1F2937' : '#6B7280'}
                  >
                    {item.period}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: CHART_COLORS.primary }]} />
          <Text style={styles.legendText}>本期{metric}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#D1D5DB' }]} />
          <Text style={styles.legendText}>去年同期</Text>
        </View>
      </View>

      {/* Selected item detail */}
      {selectedIndex !== null && data[selectedIndex] && (
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>{data[selectedIndex].period}</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>本期: </Text>
            <Text style={styles.detailValue}>
              {formatNumber(data[selectedIndex].currentValue, 1)}{unit}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>去年同期: </Text>
            <Text style={styles.detailValue}>
              {formatNumber(data[selectedIndex].previousValue, 1)}{unit}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {viewMode === 'yoy' ? '同比' : '环比'}:
            </Text>
            <Text
              style={[
                styles.detailValue,
                {
                  color: positiveIsGood
                    ? (getRate(data[selectedIndex]) >= 0 ? CHART_COLORS.secondary : CHART_COLORS.danger)
                    : (getRate(data[selectedIndex]) >= 0 ? CHART_COLORS.danger : CHART_COLORS.secondary),
                },
              ]}
            >
              {formatRate(getRate(data[selectedIndex]))}
            </Text>
          </View>
        </View>
      )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  chartScrollContent: {
    paddingRight: 16,
  },
  chartContainer: {
    marginLeft: -8,
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
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#6B7280',
  },
  detailCard: {
    marginTop: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EBEEF5',
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
});
