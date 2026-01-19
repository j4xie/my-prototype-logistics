import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import Svg, { Polygon, G } from 'react-native-svg';
import { CHART_COLORS, CHART_SIZES } from './chartSizes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Single stage in the funnel
 */
export interface FunnelStage {
  /** Label for this stage (e.g., "Leads", "Qualified", "Proposals") */
  label: string;
  /** Value for this stage */
  value: number;
  /** Conversion percentage (optional, auto-calculated if not provided) */
  percentage?: number;
  /** Custom color for this stage (optional) */
  color?: string;
}

/**
 * MobileFunnelChart Props
 */
export interface MobileFunnelChartProps {
  /** Funnel stages data (from top to bottom) */
  data: FunnelStage[];
  /** Chart title */
  title?: string;
  /** Total height of the funnel (default: 280) */
  height?: number;
  /** Total width of the funnel (default: screen width - 64) */
  width?: number;
  /** Minimum width ratio for the bottom stage (default: 0.3) */
  minWidthRatio?: number;
  /** Show conversion rates between stages (default: true) */
  showConversion?: boolean;
  /** Show percentage labels (default: true) */
  showPercentage?: boolean;
  /** Unit for values (e.g., "units", "CNY") */
  unit?: string;
}

/**
 * Default funnel colors (gradient from top to bottom)
 */
const DEFAULT_FUNNEL_COLORS = [
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#A855F7', // Violet
  '#D946EF', // Fuchsia
  '#EC4899', // Pink
];

/**
 * Format number with thousand separators
 */
function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN');
}

/**
 * Calculate conversion rate between two values
 */
function calculateConversion(current: number, previous: number): number {
  if (previous === 0) return 0;
  return (current / previous) * 100;
}

/**
 * MobileFunnelChart Component
 *
 * A funnel chart for visualizing sales pipelines, conversion rates, and
 * sequential data flow. Each stage is represented as a trapezoid shape.
 *
 * @example
 * ```tsx
 * <MobileFunnelChart
 *   title="Sales Funnel"
 *   data={[
 *     { label: "Leads", value: 1000 },
 *     { label: "Qualified", value: 750 },
 *     { label: "Proposals", value: 400 },
 *     { label: "Negotiations", value: 200 },
 *     { label: "Closed", value: 100 },
 *   ]}
 * />
 * ```
 */
export default function MobileFunnelChart({
  data,
  title,
  height = 280,
  width = SCREEN_WIDTH - 64,
  minWidthRatio = 0.3,
  showConversion = true,
  showPercentage = true,
  unit,
}: MobileFunnelChartProps): React.ReactElement {
  // Calculate the maximum value for scaling
  const maxValue = useMemo(() => {
    return Math.max(...data.map(d => d.value), 1);
  }, [data]);

  // Calculate stage dimensions and colors
  const stages = useMemo(() => {
    const stageHeight = height / data.length;
    const padding = 20; // Left/right padding
    const availableWidth = width - padding * 2;
    const minWidth = availableWidth * minWidthRatio;
    const maxWidth = availableWidth;

    return data.map((stage, index) => {
      // Calculate width based on value (proportional)
      const widthRatio = stage.value / maxValue;
      const currentWidth = minWidth + (maxWidth - minWidth) * widthRatio;

      // Calculate next stage width for trapezoid bottom
      const nextStage = data[index + 1];
      const nextWidthRatio = nextStage ? nextStage.value / maxValue : widthRatio * 0.8;
      const nextWidth = minWidth + (maxWidth - minWidth) * nextWidthRatio;

      // Calculate Y positions
      const y = index * stageHeight;

      // Calculate X positions (centered)
      const centerX = width / 2;
      const topLeft = centerX - currentWidth / 2;
      const topRight = centerX + currentWidth / 2;
      const bottomLeft = centerX - nextWidth / 2;
      const bottomRight = centerX + nextWidth / 2;

      // Create polygon points for trapezoid
      const points = `${topLeft},${y} ${topRight},${y} ${bottomRight},${y + stageHeight} ${bottomLeft},${y + stageHeight}`;

      // Calculate percentage (from first stage or provided)
      const firstValue = data[0]?.value ?? 1;
      const percentage = stage.percentage ??
        (firstValue > 0 ? (stage.value / firstValue) * 100 : 0);

      // Get color
      const color = stage.color || DEFAULT_FUNNEL_COLORS[index % DEFAULT_FUNNEL_COLORS.length];

      // Calculate conversion from previous stage
      const prevStage = data[index - 1];
      const conversion = prevStage ? calculateConversion(stage.value, prevStage.value) : 100;

      return {
        ...stage,
        points,
        y,
        height: stageHeight,
        width: currentWidth,
        color,
        percentage,
        conversion,
        centerY: y + stageHeight / 2,
      };
    });
  }, [data, height, width, minWidthRatio, maxValue]);

  return (
    <Surface style={styles.container} elevation={1}>
      {/* Title */}
      {title && (
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
      )}

      {/* Funnel Chart */}
      <View style={styles.chartContainer}>
        {/* SVG Funnel */}
        <Svg width={width} height={height}>
          <G>
            {stages.map((stage, index) => (
              <Polygon
                key={`stage-${index}`}
                points={stage.points}
                fill={stage.color}
                opacity={0.9}
              />
            ))}
          </G>
        </Svg>

        {/* Stage Labels (overlaid on funnel) */}
        <View style={[styles.labelsContainer, { height }]}>
          {stages.map((stage, index) => (
            <View
              key={`label-${index}`}
              style={[
                styles.stageLabel,
                {
                  height: stage.height,
                  top: stage.y,
                },
              ]}
            >
              <Text style={styles.stageLabelText} numberOfLines={1}>
                {stage.label}
              </Text>
              <Text style={styles.stageValueText}>
                {formatNumber(stage.value)}
                {unit && <Text style={styles.unitText}> {unit}</Text>}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Conversion Rates / Percentages */}
      {(showConversion || showPercentage) && (
        <View style={styles.metricsContainer}>
          {stages.map((stage, index) => (
            <View key={`metric-${index}`} style={styles.metricRow}>
              <View style={[styles.metricColorDot, { backgroundColor: stage.color }]} />
              <Text style={styles.metricLabel} numberOfLines={1}>
                {stage.label}
              </Text>
              {showPercentage && (
                <Text style={styles.metricPercentage}>
                  {stage.percentage.toFixed(1)}%
                </Text>
              )}
              {showConversion && index > 0 && (
                <Text style={styles.metricConversion}>
                  ({stage.conversion.toFixed(0)}% conv.)
                </Text>
              )}
            </View>
          ))}
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
  },
  title: {
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  chartContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  labelsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  stageLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  stageLabelText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  stageValueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  unitText: {
    fontSize: 12,
    fontWeight: '500',
  },
  metricsContainer: {
    marginTop: 16,
    gap: 8,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
  },
  metricColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  metricLabel: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  metricPercentage: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600',
    marginLeft: 8,
  },
  metricConversion: {
    fontSize: 11,
    color: '#6B7280',
    marginLeft: 4,
  },
});
