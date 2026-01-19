import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import Svg, { Polygon, Line, Circle, G, Text as SvgText } from 'react-native-svg';
import { CHART_COLORS, CHART_SIZES } from './chartSizes';

/**
 * Dataset for radar chart (represents one data series)
 */
export interface RadarDataset {
  /** Label for this dataset (e.g., "Supplier A") */
  label: string;
  /** Data values corresponding to each axis label */
  data: number[];
  /** Color for this dataset (default: uses CHART_COLORS.series) */
  color?: string;
  /** Fill opacity for the area (default: 0.2) */
  fillOpacity?: number;
}

/**
 * MobileRadarChart Props
 */
export interface MobileRadarChartProps {
  /** Labels for each axis (e.g., ["Quality", "Price", "Speed", "Service"]) */
  labels: string[];
  /** Datasets to display (can compare multiple datasets) */
  datasets: RadarDataset[];
  /** Maximum value for all axes (default: 100) */
  maxValue?: number;
  /** Chart title */
  title?: string;
  /** Size of the chart in pixels (default: 250) */
  size?: number;
  /** Number of grid levels (default: 5) */
  levels?: number;
  /** Show data point dots (default: true) */
  showDots?: boolean;
  /** Show legend (default: true when multiple datasets) */
  showLegend?: boolean;
}

/**
 * Grid and text colors
 */
const RADAR_COLORS = {
  grid: '#E5E7EB',
  axis: '#D1D5DB',
  labelText: '#4B5563',
  levelText: '#9CA3AF',
};

/**
 * Calculate point position on radar chart
 */
function getRadarPoint(
  centerX: number,
  centerY: number,
  radius: number,
  angleIndex: number,
  totalAngles: number,
  value: number,
  maxValue: number
): { x: number; y: number } {
  const angle = (angleIndex * 2 * Math.PI) / totalAngles - Math.PI / 2;
  const normalizedValue = Math.min(value, maxValue) / maxValue;
  const x = centerX + radius * normalizedValue * Math.cos(angle);
  const y = centerY + radius * normalizedValue * Math.sin(angle);
  return { x, y };
}

/**
 * Generate polygon points string for SVG
 */
function getPolygonPoints(
  centerX: number,
  centerY: number,
  radius: number,
  values: number[],
  maxValue: number
): string {
  return values
    .map((value, index) => {
      const point = getRadarPoint(centerX, centerY, radius, index, values.length, value, maxValue);
      return `${point.x},${point.y}`;
    })
    .join(' ');
}

/**
 * MobileRadarChart Component
 *
 * A radar/spider chart for multi-dimensional comparison of data.
 * Supports comparing multiple datasets on the same chart.
 *
 * @example
 * ```tsx
 * <MobileRadarChart
 *   title="Supplier Comparison"
 *   labels={["Quality", "Price", "Speed", "Service", "Reliability"]}
 *   datasets={[
 *     { label: "Supplier A", data: [80, 70, 90, 85, 75] },
 *     { label: "Supplier B", data: [75, 85, 70, 80, 90], color: "#10B981" },
 *   ]}
 *   maxValue={100}
 * />
 * ```
 */
export default function MobileRadarChart({
  labels,
  datasets,
  maxValue = 100,
  title,
  size = 250,
  levels = 5,
  showDots = true,
  showLegend,
}: MobileRadarChartProps): React.ReactElement {
  // Determine if legend should be shown
  const shouldShowLegend = showLegend ?? datasets.length > 1;

  // Calculate dimensions
  const padding = 40;
  const radius = (size - padding * 2) / 2;
  const centerX = size / 2;
  const centerY = size / 2;
  const numAxes = labels.length;

  /**
   * Generate grid levels
   */
  const gridLevels = useMemo(() => {
    const levelArray: { points: string; value: number }[] = [];
    for (let i = 1; i <= levels; i++) {
      const levelRadius = (radius * i) / levels;
      const points = Array.from({ length: numAxes }, (_, index) => {
        const point = getRadarPoint(centerX, centerY, levelRadius, index, numAxes, maxValue, maxValue);
        return `${point.x},${point.y}`;
      }).join(' ');
      levelArray.push({
        points,
        value: (maxValue * i) / levels,
      });
    }
    return levelArray;
  }, [levels, radius, centerX, centerY, numAxes, maxValue]);

  /**
   * Generate axis lines
   */
  const axisLines = useMemo(() => {
    return labels.map((_, index) => {
      const endPoint = getRadarPoint(centerX, centerY, radius, index, numAxes, maxValue, maxValue);
      return {
        x1: centerX,
        y1: centerY,
        x2: endPoint.x,
        y2: endPoint.y,
      };
    });
  }, [labels, centerX, centerY, radius, numAxes, maxValue]);

  /**
   * Generate label positions
   */
  const labelPositions = useMemo(() => {
    const labelRadius = radius + 20;
    return labels.map((label, index) => {
      const point = getRadarPoint(centerX, centerY, labelRadius, index, numAxes, maxValue, maxValue);
      const angle = (index * 2 * Math.PI) / numAxes - Math.PI / 2;

      // Determine text anchor based on position
      let textAnchor: 'start' | 'middle' | 'end' = 'middle';
      if (Math.cos(angle) > 0.1) textAnchor = 'start';
      else if (Math.cos(angle) < -0.1) textAnchor = 'end';

      // Adjust vertical position
      let dy = 0;
      if (Math.sin(angle) > 0.1) dy = 12;
      else if (Math.sin(angle) < -0.1) dy = -4;

      return {
        label,
        x: point.x,
        y: point.y + dy,
        textAnchor,
      };
    });
  }, [labels, centerX, centerY, radius, numAxes, maxValue]);

  /**
   * Generate dataset polygons and points
   */
  const datasetShapes = useMemo(() => {
    return datasets.map((dataset, datasetIndex) => {
      const color = dataset.color || CHART_COLORS.series[datasetIndex % CHART_COLORS.series.length];
      const fillOpacity = dataset.fillOpacity ?? 0.2;
      const points = getPolygonPoints(centerX, centerY, radius, dataset.data, maxValue);

      // Generate dot positions
      const dots = dataset.data.map((value, index) =>
        getRadarPoint(centerX, centerY, radius, index, numAxes, value, maxValue)
      );

      return {
        color,
        fillOpacity,
        points,
        dots,
        label: dataset.label,
      };
    });
  }, [datasets, centerX, centerY, radius, numAxes, maxValue]);

  return (
    <Surface style={styles.container} elevation={1}>
      {/* Title */}
      {title && (
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
      )}

      {/* Radar Chart SVG */}
      <View style={styles.chartContainer}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <G>
            {/* Grid levels (polygons) */}
            {gridLevels.map((level, index) => (
              <Polygon
                key={`level-${index}`}
                points={level.points}
                fill="none"
                stroke={RADAR_COLORS.grid}
                strokeWidth={1}
              />
            ))}

            {/* Axis lines */}
            {axisLines.map((line, index) => (
              <Line
                key={`axis-${index}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={RADAR_COLORS.axis}
                strokeWidth={1}
              />
            ))}

            {/* Dataset polygons (filled areas) */}
            {datasetShapes.map((shape, index) => (
              <Polygon
                key={`dataset-fill-${index}`}
                points={shape.points}
                fill={shape.color}
                fillOpacity={shape.fillOpacity}
                stroke={shape.color}
                strokeWidth={2}
              />
            ))}

            {/* Dataset dots */}
            {showDots &&
              datasetShapes.map((shape, datasetIndex) =>
                shape.dots.map((dot, dotIndex) => (
                  <Circle
                    key={`dot-${datasetIndex}-${dotIndex}`}
                    cx={dot.x}
                    cy={dot.y}
                    r={4}
                    fill="#FFFFFF"
                    stroke={shape.color}
                    strokeWidth={2}
                  />
                ))
              )}

            {/* Axis labels */}
            {labelPositions.map((labelInfo, index) => (
              <SvgText
                key={`label-${index}`}
                x={labelInfo.x}
                y={labelInfo.y}
                fill={RADAR_COLORS.labelText}
                fontSize={11}
                fontWeight="500"
                textAnchor={labelInfo.textAnchor}
              >
                {labelInfo.label}
              </SvgText>
            ))}

            {/* Center value labels (optional - show max level) */}
            <SvgText
              x={centerX + 4}
              y={centerY - radius + 12}
              fill={RADAR_COLORS.levelText}
              fontSize={9}
              textAnchor="start"
            >
              {maxValue}
            </SvgText>
          </G>
        </Svg>
      </View>

      {/* Legend */}
      {shouldShowLegend && (
        <View style={styles.legendContainer}>
          {datasetShapes.map((shape, index) => (
            <View key={`legend-${index}`} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: shape.color }]} />
              <Text style={styles.legendText}>{shape.label}</Text>
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
    alignItems: 'center',
  },
  title: {
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
});
