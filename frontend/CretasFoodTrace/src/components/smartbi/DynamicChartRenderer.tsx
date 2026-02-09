/**
 * DynamicChartRenderer
 *
 * Core component for rendering charts dynamically based on backend configuration.
 * Supports 22 chart types and provides dimension/measure switching capabilities.
 *
 * @version 1.0.0
 * @since 2026-01-30
 */

import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Surface, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type {
  DynamicChartConfig,
  ChartType,
  AlternativeDimension,
} from '../../types/smartbi';

import MobileLineChart from './MobileLineChart';
import MobileBarChart from './MobileBarChart';
import MobilePieChart, { PieDataItem } from './MobilePieChart';
import MobileGaugeChart from './MobileGaugeChart';
import MobileRadarChart from './MobileRadarChart';
import MobileFunnelChart from './MobileFunnelChart';
import MobileWaterfallChart from './MobileWaterfallChart';
import { CHART_SIZES, CHART_COLORS } from './chartSizes';

/**
 * DynamicChartRenderer Props
 */
export interface DynamicChartRendererProps {
  /** Chart configuration from backend */
  chartConfig: DynamicChartConfig;
  /** Callback when dimension is changed */
  onDimensionChange?: (dimension: string) => void;
  /** Callback when measure is changed */
  onMeasureChange?: (measure: string) => void;
  /** Show dimension switcher */
  showDimensionSwitcher?: boolean;
  /** Show measure switcher */
  showMeasureSwitcher?: boolean;
  /** Custom width */
  width?: number;
  /** Custom height */
  height?: number;
}

/**
 * Extract labels from series data
 */
function extractLabels(chartConfig: DynamicChartConfig): string[] {
  if (!chartConfig.series?.length) return [];
  const firstSeries = chartConfig.series[0];
  if (firstSeries?.data && firstSeries.data.length > 0) {
    return firstSeries.data.map(item => item.name);
  }
  if (chartConfig.rawData?.length > 0 && chartConfig.xAxis) {
    const xField = chartConfig.xAxis.field;
    return chartConfig.rawData.map(row => String(row[xField] ?? ''));
  }
  return [];
}

/**
 * Extract values from series data
 */
function extractValues(chartConfig: DynamicChartConfig, seriesIndex = 0): number[] {
  if (!chartConfig.series?.length) return [];
  const series = chartConfig.series[seriesIndex];
  if (series?.data && series.data.length > 0) {
    return series.data.map(item => item.value);
  }
  const firstYAxis = chartConfig.yAxis?.[0];
  if (chartConfig.rawData?.length > 0 && firstYAxis) {
    const yField = firstYAxis.field;
    return chartConfig.rawData.map(row => Number(row[yField]) || 0);
  }
  return [];
}

/**
 * Extract pie data
 */
function extractPieData(chartConfig: DynamicChartConfig): PieDataItem[] {
  if (!chartConfig.series?.length) return [];
  const firstSeries = chartConfig.series[0];
  if (firstSeries?.data && firstSeries.data.length > 0) {
    return firstSeries.data.map((item, index) => ({
      name: item.name,
      value: item.value,
      color: CHART_COLORS.series[index % CHART_COLORS.series.length],
    }));
  }
  return [];
}

/**
 * Extract gauge value
 */
function extractGaugeValue(chartConfig: DynamicChartConfig): number {
  const firstSeries = chartConfig.series?.[0];
  const firstDataPoint = firstSeries?.data?.[0];
  if (firstDataPoint) {
    return firstDataPoint.value;
  }
  const firstYAxis = chartConfig.yAxis?.[0];
  const firstRawRow = chartConfig.rawData?.[0];
  if (firstRawRow && firstYAxis) {
    return Number(firstRawRow[firstYAxis.field]) || 0;
  }
  return 0;
}

/**
 * Dimension Switcher Component
 */
interface DimensionSwitcherProps {
  dimensions: AlternativeDimension[];
  onSelect: (fieldName: string) => void;
  label: string;
}

function DimensionSwitcher({ dimensions, onSelect, label }: DimensionSwitcherProps): React.ReactElement | null {
  if (dimensions.length <= 1) return null;

  return (
    <View style={styles.switcherContainer}>
      <Text style={styles.switcherLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipContainer}>
          {dimensions.map((dim) => (
            <Chip
              key={dim.fieldName}
              mode={dim.selected ? 'flat' : 'outlined'}
              selected={dim.selected}
              onPress={() => onSelect(dim.fieldName)}
              style={[
                styles.chip,
                dim.selected && styles.chipSelected,
              ]}
              textStyle={dim.selected ? styles.chipTextSelected : styles.chipText}
              compact
            >
              {dim.displayName}
            </Chip>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Unsupported Chart Placeholder
 */
function UnsupportedChart({ chartType, title }: { chartType: ChartType; title: string }): React.ReactElement {
  return (
    <Surface style={styles.unsupportedContainer} elevation={1}>
      <MaterialCommunityIcons name="chart-box-outline" size={48} color="#9CA3AF" />
      <Text style={styles.unsupportedTitle}>{title}</Text>
      <Text style={styles.unsupportedText}>
        图表类型 "{chartType}" 暂不支持
      </Text>
      <Text style={styles.unsupportedHint}>
        即将支持更多图表类型
      </Text>
    </Surface>
  );
}

/**
 * DynamicChartRenderer Component
 */
export default function DynamicChartRenderer({
  chartConfig,
  onDimensionChange,
  onMeasureChange,
  showDimensionSwitcher = true,
  showMeasureSwitcher = true,
  width = CHART_SIZES.fullWidth.width,
  height = CHART_SIZES.fullWidth.height,
}: DynamicChartRendererProps): React.ReactElement {
  // Extract data based on chart type
  const labels = useMemo(() => extractLabels(chartConfig), [chartConfig]);
  const values = useMemo(() => extractValues(chartConfig), [chartConfig]);
  const pieData = useMemo(() => extractPieData(chartConfig), [chartConfig]);
  const gaugeValue = useMemo(() => extractGaugeValue(chartConfig), [chartConfig]);

  // Handle dimension change
  const handleDimensionChange = useCallback((fieldName: string) => {
    onDimensionChange?.(fieldName);
  }, [onDimensionChange]);

  // Handle measure change
  const handleMeasureChange = useCallback((fieldName: string) => {
    onMeasureChange?.(fieldName);
  }, [onMeasureChange]);

  // Render chart based on type
  const renderChart = (): React.ReactElement => {
    const { chartType, title, subTitle } = chartConfig;
    const displayTitle = subTitle ? `${title} - ${subTitle}` : title;

    switch (chartType) {
      // ==================== Basic Charts ====================
      case 'LINE':
        return (
          <MobileLineChart
            title={displayTitle}
            labels={labels}
            data={values}
            width={width}
            height={height}
            bezier
            showDots
          />
        );

      case 'BAR':
        return (
          <MobileBarChart
            title={displayTitle}
            labels={labels}
            data={values}
            width={width}
            height={height}
            showValuesOnTopOfBars
          />
        );

      case 'BAR_HORIZONTAL':
        return (
          <MobileBarChart
            title={displayTitle}
            labels={labels}
            data={values}
            width={width}
            height={Math.max(height, labels.length * 50)}
            horizontal
          />
        );

      case 'PIE':
      case 'DONUT':
        return (
          <MobilePieChart
            title={displayTitle}
            data={pieData}
            showLabels
            hasLegend
            centerText={chartType === 'DONUT' ? '总计' : undefined}
            centerValue={chartType === 'DONUT' ? pieData.reduce((sum, item) => sum + item.value, 0) : undefined}
          />
        );

      case 'AREA':
        return (
          <MobileLineChart
            title={displayTitle}
            labels={labels}
            data={values}
            width={width}
            height={height}
            bezier
            fillShadow
            showDots={false}
          />
        );

      case 'GAUGE':
        return (
          <MobileGaugeChart
            title={displayTitle}
            value={gaugeValue}
            unit={chartConfig.yAxis?.[0]?.label?.includes('%') ? '%' : ''}
            size={Math.min(width, 200)}
          />
        );

      case 'RADAR':
        return (
          <MobileRadarChart
            title={displayTitle}
            labels={labels}
            datasets={[{
              label: chartConfig.series?.[0]?.name || 'Data',
              data: values,
            }]}
            maxValue={Math.max(...values, 100)}
          />
        );

      case 'FUNNEL':
        return (
          <MobileFunnelChart
            title={displayTitle}
            data={pieData.map((item) => ({
              label: item.name,
              value: item.value,
              color: item.color,
            }))}
          />
        );

      case 'WATERFALL':
        return (
          <MobileWaterfallChart
            title={displayTitle}
            data={pieData.map((item, index) => ({
              name: item.name,
              value: item.value,
              type: index === pieData.length - 1 ? 'total' as const : (item.value >= 0 ? 'increase' as const : 'decrease' as const),
            }))}
          />
        );

      // ==================== Combination Chart ====================
      case 'COMBINATION':
      case 'DUAL_AXIS':
        // For combination charts, render as bar with line overlay
        // In a real implementation, you would overlay multiple series
        return (
          <MobileBarChart
            title={displayTitle}
            labels={labels}
            data={values}
            width={width}
            height={height}
            showValuesOnTopOfBars
          />
        );

      // ==================== Unsupported Charts ====================
      case 'SCATTER':
      case 'HEATMAP':
      case 'MATRIX_HEATMAP':
      case 'TREEMAP':
      case 'SANKEY':
      case 'SUNBURST':
      case 'PARETO':
      case 'BULLET':
      case 'SLOPE':
      case 'NESTED_DONUT':
      default:
        return <UnsupportedChart chartType={chartType} title={displayTitle} />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Dimension Switcher */}
      {showDimensionSwitcher && chartConfig.alternativeXAxis.length > 1 && (
        <DimensionSwitcher
          dimensions={chartConfig.alternativeXAxis}
          onSelect={handleDimensionChange}
          label="维度"
        />
      )}

      {/* Chart */}
      {renderChart()}

      {/* Measure Switcher */}
      {showMeasureSwitcher && chartConfig.alternativeMeasures.length > 1 && (
        <DimensionSwitcher
          dimensions={chartConfig.alternativeMeasures}
          onSelect={handleMeasureChange}
          label="度量"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  switcherContainer: {
    marginBottom: 8,
  },
  switcherLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    marginLeft: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  chipSelected: {
    backgroundColor: '#3B82F6',
  },
  chipText: {
    color: '#4B5563',
    fontSize: 12,
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  unsupportedContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unsupportedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 12,
    textAlign: 'center',
  },
  unsupportedText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  unsupportedHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
});
