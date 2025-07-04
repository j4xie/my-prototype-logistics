import React from 'react';
import { View, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';

export interface DataPoint {
  x: number | string;
  y: number;
  label?: string;
}

export interface LineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  showDots?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  title?: string;
  style?: ViewStyle;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  width = Dimensions.get('window').width - 32,
  height = 200,
  color = '#2196F3',
  strokeWidth = 2,
  showDots = true,
  showGrid = true,
  showLabels = true,
  title,
  style,
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { width, height }, style]}>
        <Text variant="bodyMedium" style={styles.noData}>
          暂无数据
        </Text>
      </View>
    );
  }

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2 - (title ? 30 : 0);

  // 计算数据范围
  const yValues = data.map(d => d.y);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const yRange = maxY - minY || 1;

  // 生成路径
  const generatePath = () => {
    const points = data.map((point, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = padding + (title ? 30 : 0) + chartHeight - ((point.y - minY) / yRange) * chartHeight;
      return { x, y };
    });

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }

    return { path, points };
  };

  const { path, points } = generatePath();

  // 生成网格线
  const generateGridLines = () => {
    const lines = [];
    const gridCount = 5;

    if (showGrid) {
      // 水平网格线
      for (let i = 0; i <= gridCount; i++) {
        const y = padding + (title ? 30 : 0) + (i / gridCount) * chartHeight;
        lines.push(
          <Line
            key={`h-${i}`}
            x1={padding}
            y1={y}
            x2={padding + chartWidth}
            y2={y}
            stroke="#e0e0e0"
            strokeWidth={0.5}
          />
        );
      }

      // 垂直网格线
      for (let i = 0; i <= data.length - 1; i++) {
        const x = padding + (i / (data.length - 1)) * chartWidth;
        lines.push(
          <Line
            key={`v-${i}`}
            x1={x}
            y1={padding + (title ? 30 : 0)}
            x2={x}
            y2={padding + (title ? 30 : 0) + chartHeight}
            stroke="#e0e0e0"
            strokeWidth={0.5}
          />
        );
      }
    }

    return lines;
  };

  // 生成标签
  const generateLabels = () => {
    if (!showLabels) return [];

    const labels = [];

    // Y轴标签
    const gridCount = 5;
    for (let i = 0; i <= gridCount; i++) {
      const value = maxY - (i / gridCount) * yRange;
      const y = padding + (title ? 30 : 0) + (i / gridCount) * chartHeight;
      
      labels.push(
        <SvgText
          key={`y-label-${i}`}
          x={padding - 10}
          y={y + 4}
          fontSize="10"
          fill="#666"
          textAnchor="end"
        >
          {value.toFixed(0)}
        </SvgText>
      );
    }

    // X轴标签
    data.forEach((point, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = height - padding + 15;
      
      labels.push(
        <SvgText
          key={`x-label-${index}`}
          x={x}
          y={y}
          fontSize="10"
          fill="#666"
          textAnchor="middle"
        >
          {point.label || point.x}
        </SvgText>
      );
    });

    return labels;
  };

  return (
    <View style={[styles.container, { width, height }, style]}>
      {title && (
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
      )}
      
      <Svg width={width} height={height - (title ? 30 : 0)}>
        {/* 网格线 */}
        {generateGridLines()}
        
        {/* 数据线 */}
        <Path
          d={path}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* 数据点 */}
        {showDots && points.map((point, index) => (
          <Circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={4}
            fill={color}
            stroke="#fff"
            strokeWidth={2}
          />
        ))}
        
        {/* 标签 */}
        {generateLabels()}
      </Svg>
    </View>
  );
};

// 多线图表组件
export interface MultiLineChartProps {
  datasets: Array<{
    data: DataPoint[];
    color: string;
    label: string;
  }>;
  width?: number;
  height?: number;
  showLegend?: boolean;
  title?: string;
  style?: ViewStyle;
}

export const MultiLineChart: React.FC<MultiLineChartProps> = ({
  datasets,
  width = Dimensions.get('window').width - 32,
  height = 200,
  showLegend = true,
  title,
  style,
}) => {
  if (!datasets || datasets.length === 0) {
    return (
      <View style={[styles.container, { width, height }, style]}>
        <Text variant="bodyMedium" style={styles.noData}>
          暂无数据
        </Text>
      </View>
    );
  }

  const legendHeight = showLegend ? 40 : 0;

  return (
    <View style={[styles.container, { width, height: height + legendHeight }, style]}>
      {title && (
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
      )}
      
      <View style={styles.chartContainer}>
        {datasets.map((dataset, index) => (
          <View key={index} style={styles.lineContainer}>
            <LineChart
              data={dataset.data}
              width={width}
              height={height}
              color={dataset.color}
              showLabels={index === 0} // 只在第一个图表显示标签
              style={index > 0 ? styles.overlayChart : undefined}
            />
          </View>
        ))}
      </View>
      
      {showLegend && (
        <View style={styles.legend}>
          {datasets.map((dataset, index) => (
            <View key={index} style={styles.legendItem}>
              <View 
                style={[
                  styles.legendColor, 
                  { backgroundColor: dataset.color }
                ]} 
              />
              <Text variant="bodySmall" style={styles.legendLabel}>
                {dataset.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
  } as ViewStyle,
  
  title: {
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: 'bold',
  },
  
  noData: {
    textAlign: 'center',
    opacity: 0.7,
    flex: 1,
    textAlignVertical: 'center',
  },
  
  chartContainer: {
    position: 'relative',
  } as ViewStyle,
  
  lineContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  } as ViewStyle,
  
  overlayChart: {
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
  } as ViewStyle,
  
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
    gap: 16,
  } as ViewStyle,
  
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  } as ViewStyle,
  
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  } as ViewStyle,
  
  legendLabel: {
    opacity: 0.8,
  },
});