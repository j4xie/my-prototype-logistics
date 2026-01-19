import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { CHART_COLORS, CHART_SIZES } from './chartSizes';

/**
 * Threshold configuration for gauge zones
 */
export interface GaugeThresholds {
  /** Value below this is red (danger) */
  red: number;
  /** Value below this is yellow (warning), above red */
  yellow: number;
  /** Value at or above this is green (good) */
  green: number;
}

/**
 * MobileGaugeChart Props
 */
export interface MobileGaugeChartProps {
  /** Current value to display (0 to maxValue) */
  value: number;
  /** Maximum value for the gauge (default: 100) */
  maxValue?: number;
  /** Chart title displayed above the gauge */
  title: string;
  /** Unit suffix displayed after value (e.g., '%', 'kg') */
  unit?: string;
  /** Threshold values for color zones */
  thresholds?: GaugeThresholds;
  /** Size of the gauge in pixels (default: 180) */
  size?: number;
  /** Show value label in center (default: true) */
  showLabel?: boolean;
  /** Subtitle text below the value */
  subtitle?: string;
}

/**
 * Default threshold values (for metrics like OEE, completion rate)
 * - Below 60: Red (poor)
 * - 60-80: Yellow (needs improvement)
 * - Above 80: Green (good)
 */
const DEFAULT_THRESHOLDS: GaugeThresholds = {
  red: 60,
  yellow: 80,
  green: 80,
};

/**
 * Zone color mapping
 */
const ZONE_COLORS = {
  red: CHART_COLORS.danger,
  yellow: CHART_COLORS.warning,
  green: CHART_COLORS.secondary,
  background: '#E5E7EB',
  text: '#1F2937',
  subtext: '#6B7280',
};

/**
 * Convert polar coordinates to cartesian
 */
function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleInDegrees: number
): { x: number; y: number } {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians),
  };
}

/**
 * Generate arc path for SVG
 */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    'M', start.x, start.y,
    'A', r, r, 0, largeArcFlag, 0, end.x, end.y,
  ].join(' ');
}

/**
 * MobileGaugeChart Component
 *
 * A gauge/speedometer chart for displaying metrics like OEE, completion rate.
 * Shows a colored arc based on value thresholds (red/yellow/green zones).
 *
 * @example
 * ```tsx
 * <MobileGaugeChart
 *   value={72}
 *   title="OEE"
 *   unit="%"
 *   thresholds={{ red: 60, yellow: 80, green: 80 }}
 * />
 * ```
 */
export default function MobileGaugeChart({
  value,
  maxValue = 100,
  title,
  unit = '%',
  thresholds = DEFAULT_THRESHOLDS,
  size = 180,
  showLabel = true,
  subtitle,
}: MobileGaugeChartProps): React.ReactElement {
  // Normalize value to be within bounds
  const normalizedValue = Math.max(0, Math.min(value, maxValue));
  const percentage = (normalizedValue / maxValue) * 100;

  // Calculate dimensions
  const strokeWidth = size * 0.1;
  const radius = (size - strokeWidth) / 2 - 10;
  const centerX = size / 2;
  const centerY = size / 2;

  // Arc configuration (270 degrees, from bottom-left to bottom-right)
  const startAngle = -225;
  const endAngle = 45;
  const arcSpan = 270;

  /**
   * Determine the current zone color based on value
   */
  const currentColor = useMemo(() => {
    if (percentage < thresholds.red) {
      return ZONE_COLORS.red;
    } else if (percentage < thresholds.yellow) {
      return ZONE_COLORS.yellow;
    }
    return ZONE_COLORS.green;
  }, [percentage, thresholds]);

  /**
   * Calculate arc paths
   */
  const arcPaths = useMemo(() => {
    // Background arc (full)
    const backgroundArc = describeArc(
      centerX,
      centerY,
      radius,
      startAngle,
      endAngle
    );

    // Value arc (filled portion)
    const valueEndAngle = startAngle + (percentage / 100) * arcSpan;
    const valueArc = describeArc(
      centerX,
      centerY,
      radius,
      startAngle,
      Math.min(valueEndAngle, endAngle)
    );

    // Zone arcs for visual reference
    const redEndAngle = startAngle + (thresholds.red / 100) * arcSpan;
    const yellowEndAngle = startAngle + (thresholds.yellow / 100) * arcSpan;

    const redArc = describeArc(centerX, centerY, radius, startAngle, redEndAngle);
    const yellowArc = describeArc(centerX, centerY, radius, redEndAngle, yellowEndAngle);
    const greenArc = describeArc(centerX, centerY, radius, yellowEndAngle, endAngle);

    return {
      backgroundArc,
      valueArc,
      redArc,
      yellowArc,
      greenArc,
    };
  }, [percentage, thresholds, centerX, centerY, radius, startAngle, endAngle, arcSpan]);

  // Format the display value
  const displayValue = useMemo(() => {
    if (normalizedValue % 1 === 0) {
      return normalizedValue.toString();
    }
    return normalizedValue.toFixed(1);
  }, [normalizedValue]);

  // SVG height (account for arc extending above center)
  const svgHeight = size * 0.85;

  return (
    <Surface style={styles.container} elevation={1}>
      {/* Title */}
      <Text variant="titleMedium" style={styles.title}>
        {title}
      </Text>

      {/* Gauge SVG */}
      <View style={styles.gaugeContainer}>
        <Svg width={size} height={svgHeight} viewBox={`0 0 ${size} ${svgHeight}`}>
          <G>
            {/* Background arc */}
            <Path
              d={arcPaths.backgroundArc}
              fill="none"
              stroke={ZONE_COLORS.background}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />

            {/* Zone indicator arcs (subtle background) */}
            <Path
              d={arcPaths.redArc}
              fill="none"
              stroke={ZONE_COLORS.red}
              strokeWidth={strokeWidth * 0.3}
              strokeLinecap="round"
              opacity={0.2}
            />
            <Path
              d={arcPaths.yellowArc}
              fill="none"
              stroke={ZONE_COLORS.yellow}
              strokeWidth={strokeWidth * 0.3}
              opacity={0.2}
            />
            <Path
              d={arcPaths.greenArc}
              fill="none"
              stroke={ZONE_COLORS.green}
              strokeWidth={strokeWidth * 0.3}
              strokeLinecap="round"
              opacity={0.2}
            />

            {/* Value arc (main indicator) */}
            {percentage > 0 && (
              <Path
                d={arcPaths.valueArc}
                fill="none"
                stroke={currentColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            )}

            {/* Center decoration circle */}
            <Circle
              cx={centerX}
              cy={centerY}
              r={radius * 0.15}
              fill={currentColor}
              opacity={0.15}
            />
            <Circle
              cx={centerX}
              cy={centerY}
              r={radius * 0.08}
              fill={currentColor}
            />
          </G>
        </Svg>

        {/* Value display in center */}
        {showLabel && (
          <View style={[styles.valueContainer, { top: centerY - 20 }]}>
            <Text style={[styles.valueText, { color: currentColor }]}>
              {displayValue}
              <Text style={styles.unitText}>{unit}</Text>
            </Text>
            {subtitle && (
              <Text style={styles.subtitleText}>{subtitle}</Text>
            )}
          </View>
        )}
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: ZONE_COLORS.red }]} />
          <Text style={styles.legendText}>&lt;{thresholds.red}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: ZONE_COLORS.yellow }]} />
          <Text style={styles.legendText}>{thresholds.red}-{thresholds.yellow}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: ZONE_COLORS.green }]} />
          <Text style={styles.legendText}>&gt;{thresholds.yellow}</Text>
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  title: {
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  gaugeContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontSize: 32,
    fontWeight: '700',
  },
  unitText: {
    fontSize: 16,
    fontWeight: '500',
  },
  subtitleText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#6B7280',
  },
});
