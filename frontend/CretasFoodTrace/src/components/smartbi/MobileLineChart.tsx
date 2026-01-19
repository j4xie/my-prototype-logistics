import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { LineChart as RNLineChart } from 'react-native-chart-kit';
import { CHART_COLORS, CHART_CONFIG, CHART_SIZES } from './chartSizes';

/**
 * Data point for line chart
 */
export interface LineDataPoint {
  /** X-axis label */
  label: string;
  /** Y-axis value */
  value: number;
}

/**
 * Data series for multi-line charts
 */
export interface LineDataSeries {
  /** Series name (for legend) */
  name: string;
  /** Data points */
  data: number[];
  /** Series color (optional, uses default from series array) */
  color?: string;
}

/**
 * MobileLineChart Props
 */
export interface MobileLineChartProps {
  /** Chart title */
  title?: string;
  /** X-axis labels */
  labels: string[];
  /** Single dataset (for simple line chart) */
  data?: number[];
  /** Multiple datasets (for multi-line comparison) */
  datasets?: LineDataSeries[];
  /** Chart width (default: fullWidth) */
  width?: number;
  /** Chart height (default: 220) */
  height?: number;
  /** Show legend for multi-line charts */
  showLegend?: boolean;
  /** Show dots on data points */
  showDots?: boolean;
  /** Use bezier curve (smooth line) */
  bezier?: boolean;
  /** Y-axis suffix (e.g., '%', 'kg') */
  yAxisSuffix?: string;
  /** Y-axis prefix (e.g., 'CNY') */
  yAxisPrefix?: string;
  /** Number of decimal places */
  decimalPlaces?: number;
  /** Hide point labels */
  hidePointLabels?: boolean;
  /** Fill area under line */
  fillShadow?: boolean;
  /** On data point press */
  onDataPointClick?: (data: { index: number; value: number; dataset: number }) => void;
}

/**
 * MobileLineChart Component
 *
 * A line chart component using react-native-chart-kit.
 * Supports single or multiple data series for trend comparison.
 *
 * @example
 * ```tsx
 * // Simple single line
 * <MobileLineChart
 *   title="Monthly Sales"
 *   labels={['Jan', 'Feb', 'Mar', 'Apr']}
 *   data={[100, 150, 120, 180]}
 *   yAxisSuffix=" units"
 * />
 *
 * // Multi-line comparison
 * <MobileLineChart
 *   title="Sales Comparison"
 *   labels={['Jan', 'Feb', 'Mar']}
 *   datasets={[
 *     { name: '2024', data: [100, 150, 120] },
 *     { name: '2023', data: [80, 130, 110] },
 *   ]}
 *   showLegend
 * />
 * ```
 */
export default function MobileLineChart({
  title,
  labels,
  data,
  datasets,
  width = CHART_SIZES.fullWidth.width,
  height = CHART_SIZES.fullWidth.height,
  showLegend = false,
  showDots = true,
  bezier = true,
  yAxisSuffix = '',
  yAxisPrefix = '',
  decimalPlaces = 0,
  hidePointLabels = true,
  fillShadow = false,
  onDataPointClick,
}: MobileLineChartProps): React.ReactElement {
  // Build chart data structure
  const chartData = useMemo(() => {
    // Single data series
    if (data && !datasets) {
      return {
        labels,
        datasets: [
          {
            data,
            color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
            strokeWidth: 2,
          },
        ],
        legend: [],
      };
    }

    // Multiple data series
    if (datasets) {
      return {
        labels,
        datasets: datasets.map((series, index) => ({
          data: series.data,
          color: (opacity = 1) => {
            const baseColor = series.color || CHART_COLORS.series[index % CHART_COLORS.series.length] || CHART_COLORS.primary;
            // Convert hex to rgba
            const r = parseInt(baseColor.slice(1, 3), 16);
            const g = parseInt(baseColor.slice(3, 5), 16);
            const b = parseInt(baseColor.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
          },
          strokeWidth: 2,
        })),
        legend: showLegend ? datasets.map(s => s.name) : [],
      };
    }

    // Empty fallback
    return {
      labels: [],
      datasets: [{ data: [0] }],
      legend: [],
    };
  }, [data, datasets, labels, showLegend]);

  // Chart configuration
  const chartConfig = useMemo(() => ({
    ...CHART_CONFIG,
    decimalPlaces,
    propsForDots: showDots
      ? {
          r: '4',
          strokeWidth: '2',
          stroke: CHART_COLORS.primary,
        }
      : {
          r: '0',
          strokeWidth: '0',
        },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: '#E5E7EB',
      strokeWidth: 1,
    },
    fillShadowGradient: fillShadow ? CHART_COLORS.primary : 'transparent',
    fillShadowGradientOpacity: fillShadow ? 0.2 : 0,
  }), [decimalPlaces, showDots, fillShadow]);

  // Handle data point click
  const handleDataPointClick = (pointData: {
    index: number;
    value: number;
    dataset: { data: number[] };
    x: number;
    y: number;
    getColor: (opacity: number) => string;
  }) => {
    if (onDataPointClick) {
      const datasetIndex = chartData.datasets.findIndex(
        ds => ds.data === pointData.dataset.data
      );
      onDataPointClick({
        index: pointData.index,
        value: pointData.value,
        dataset: datasetIndex >= 0 ? datasetIndex : 0,
      });
    }
  };

  return (
    <Surface style={styles.container} elevation={1}>
      {title && (
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
      )}

      {/* Legend */}
      {showLegend && chartData.legend.length > 0 && (
        <View style={styles.legendContainer}>
          {chartData.legend.map((name, index) => (
            <View key={name} style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  {
                    backgroundColor:
                      datasets?.[index]?.color ||
                      CHART_COLORS.series[index % CHART_COLORS.series.length],
                  },
                ]}
              />
              <Text style={styles.legendText}>{name}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.chartWrapper}>
        <RNLineChart
          data={chartData}
          width={width}
          height={height - (title ? 40 : 0) - (showLegend ? 30 : 0)}
          chartConfig={chartConfig}
          bezier={bezier}
          style={styles.chart}
          yAxisSuffix={yAxisSuffix}
          yAxisLabel={yAxisPrefix}
          withHorizontalLabels
          withVerticalLabels
          withInnerLines
          withOuterLines={false}
          withHorizontalLines
          withVerticalLines={false}
          withShadow={fillShadow}
          hidePointsAtIndex={hidePointLabels ? [] : undefined}
          onDataPointClick={onDataPointClick ? handleDataPointClick : undefined}
          fromZero
          segments={4}
        />
      </View>
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
    marginBottom: 8,
    color: '#1F2937',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
  },
  chartWrapper: {
    marginLeft: -16,
    marginRight: -16,
  },
  chart: {
    borderRadius: 8,
  },
});
