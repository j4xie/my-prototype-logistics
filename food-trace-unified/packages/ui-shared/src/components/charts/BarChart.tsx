import React from 'react';
import { View, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';

export interface BarDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarDataPoint[];
  width?: number;
  height?: number;
  defaultColor?: string;
  showValues?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  title?: string;
  horizontal?: boolean;
  style?: ViewStyle;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  width = Dimensions.get('window').width - 32,
  height = 200,
  defaultColor = '#2196F3',
  showValues = true,
  showGrid = true,
  showLabels = true,
  title,
  horizontal = false,
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
  const values = data.map(d => d.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(0, Math.min(...values));
  const valueRange = maxValue - minValue || 1;

  // 生成柱状图
  const generateBars = () => {
    const bars = [];
    const barSpacing = horizontal ? chartHeight / data.length : chartWidth / data.length;
    const barWidth = barSpacing * 0.8;
    const barGap = barSpacing * 0.2;

    data.forEach((item, index) => {
      if (horizontal) {
        // 水平柱状图
        const barHeight = barWidth;
        const barLength = (item.value / maxValue) * chartWidth;
        const y = padding + (title ? 30 : 0) + index * barSpacing + barGap / 2;
        const x = padding;

        bars.push(
          <Rect
            key={index}
            x={x}
            y={y}
            width={barLength}
            height={barHeight}
            fill={item.color || defaultColor}
            rx={2}
          />
        );

        // 数值标签
        if (showValues) {
          bars.push(
            <SvgText
              key={`value-${index}`}
              x={x + barLength + 5}
              y={y + barHeight / 2 + 4}
              fontSize="10"
              fill="#666"
            >
              {item.value}
            </SvgText>
          );
        }
      } else {
        // 垂直柱状图
        const barWidth_ = barWidth;
        const barHeight_ = (item.value / maxValue) * chartHeight;
        const x = padding + index * barSpacing + barGap / 2;
        const y = padding + (title ? 30 : 0) + chartHeight - barHeight_;

        bars.push(
          <Rect
            key={index}
            x={x}
            y={y}
            width={barWidth_}
            height={barHeight_}
            fill={item.color || defaultColor}
            rx={2}
          />
        );

        // 数值标签
        if (showValues) {
          bars.push(
            <SvgText
              key={`value-${index}`}
              x={x + barWidth_ / 2}
              y={y - 5}
              fontSize="10"
              fill="#666"
              textAnchor="middle"
            >
              {item.value}
            </SvgText>
          );
        }
      }
    });

    return bars;
  };

  // 生成网格线
  const generateGridLines = () => {
    if (!showGrid) return [];

    const lines = [];
    const gridCount = 5;

    if (horizontal) {
      // 垂直网格线（水平图表）
      for (let i = 0; i <= gridCount; i++) {
        const x = padding + (i / gridCount) * chartWidth;
        lines.push(
          <Line
            key={`grid-${i}`}
            x1={x}
            y1={padding + (title ? 30 : 0)}
            x2={x}
            y2={padding + (title ? 30 : 0) + chartHeight}
            stroke="#e0e0e0"
            strokeWidth={0.5}
          />
        );
      }
    } else {
      // 水平网格线（垂直图表）
      for (let i = 0; i <= gridCount; i++) {
        const y = padding + (title ? 30 : 0) + (i / gridCount) * chartHeight;
        lines.push(
          <Line
            key={`grid-${i}`}
            x1={padding}
            y1={y}
            x2={padding + chartWidth}
            y2={y}
            stroke="#e0e0e0"
            strokeWidth={0.5}
          />
        );
      }
    }

    return lines;
  };

  // 生成轴标签
  const generateAxisLabels = () => {
    if (!showLabels) return [];

    const labels = [];
    const gridCount = 5;

    if (horizontal) {
      // X轴数值标签
      for (let i = 0; i <= gridCount; i++) {
        const value = (i / gridCount) * maxValue;
        const x = padding + (i / gridCount) * chartWidth;
        const y = height - padding + 15;
        
        labels.push(
          <SvgText
            key={`x-axis-${i}`}
            x={x}
            y={y}
            fontSize="10"
            fill="#666"
            textAnchor="middle"
          >
            {value.toFixed(0)}
          </SvgText>
        );
      }

      // Y轴类别标签
      data.forEach((item, index) => {
        const barSpacing = chartHeight / data.length;
        const y = padding + (title ? 30 : 0) + index * barSpacing + barSpacing / 2 + 4;
        
        labels.push(
          <SvgText
            key={`y-axis-${index}`}
            x={padding - 10}
            y={y}
            fontSize="10"
            fill="#666"
            textAnchor="end"
          >
            {item.label}
          </SvgText>
        );
      });
    } else {
      // Y轴数值标签
      for (let i = 0; i <= gridCount; i++) {
        const value = maxValue - (i / gridCount) * maxValue;
        const y = padding + (title ? 30 : 0) + (i / gridCount) * chartHeight + 4;
        
        labels.push(
          <SvgText
            key={`y-axis-${i}`}
            x={padding - 10}
            y={y}
            fontSize="10"
            fill="#666"
            textAnchor="end"
          >
            {value.toFixed(0)}
          </SvgText>
        );
      }

      // X轴类别标签
      data.forEach((item, index) => {
        const barSpacing = chartWidth / data.length;
        const x = padding + index * barSpacing + barSpacing / 2;
        const y = height - padding + 15;
        
        labels.push(
          <SvgText
            key={`x-axis-${index}`}
            x={x}
            y={y}
            fontSize="10"
            fill="#666"
            textAnchor="middle"
            transform={item.label.length > 6 ? `rotate(-45, ${x}, ${y})` : undefined}
          >
            {item.label.length > 8 ? item.label.substring(0, 8) + '...' : item.label}
          </SvgText>
        );
      });
    }

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
        
        {/* 柱状图 */}
        {generateBars()}
        
        {/* 坐标轴标签 */}
        {generateAxisLabels()}
      </Svg>
    </View>
  );
};

// 分组柱状图组件
export interface GroupedBarChartProps {
  data: Array<{
    label: string;
    values: Array<{
      label: string;
      value: number;
      color: string;
    }>;
  }>;
  width?: number;
  height?: number;
  showLegend?: boolean;
  title?: string;
  style?: ViewStyle;
}

export const GroupedBarChart: React.FC<GroupedBarChartProps> = ({
  data,
  width = Dimensions.get('window').width - 32,
  height = 200,
  showLegend = true,
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

  const legendHeight = showLegend ? 40 : 0;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2 - (title ? 30 : 0);

  // 获取所有值用于计算范围
  const allValues = data.flatMap(group => group.values.map(v => v.value));
  const maxValue = Math.max(...allValues);

  // 获取图例数据
  const legendItems = data[0]?.values || [];

  const generateGroupedBars = () => {
    const bars = [];
    const groupWidth = chartWidth / data.length;
    const barWidth = groupWidth / (data[0]?.values.length || 1) * 0.8;
    const groupPadding = groupWidth * 0.1;

    data.forEach((group, groupIndex) => {
      group.values.forEach((bar, barIndex) => {
        const barHeight = (bar.value / maxValue) * chartHeight;
        const x = padding + groupIndex * groupWidth + groupPadding + barIndex * barWidth;
        const y = padding + (title ? 30 : 0) + chartHeight - barHeight;

        bars.push(
          <Rect
            key={`${groupIndex}-${barIndex}`}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            fill={bar.color}
            rx={2}
          />
        );

        // 数值标签
        bars.push(
          <SvgText
            key={`value-${groupIndex}-${barIndex}`}
            x={x + barWidth / 2}
            y={y - 5}
            fontSize="9"
            fill="#666"
            textAnchor="middle"
          >
            {bar.value}
          </SvgText>
        );
      });

      // 组标签
      const groupCenterX = padding + groupIndex * groupWidth + groupWidth / 2;
      bars.push(
        <SvgText
          key={`group-label-${groupIndex}`}
          x={groupCenterX}
          y={height - padding + 15}
          fontSize="10"
          fill="#666"
          textAnchor="middle"
        >
          {group.label}
        </SvgText>
      );
    });

    return bars;
  };

  return (
    <View style={[styles.container, { width, height: height + legendHeight }, style]}>
      {title && (
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
      )}
      
      <Svg width={width} height={height - (title ? 30 : 0)}>
        {generateGroupedBars()}
      </Svg>
      
      {showLegend && (
        <View style={styles.legend}>
          {legendItems.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View 
                style={[
                  styles.legendColor, 
                  { backgroundColor: item.color }
                ]} 
              />
              <Text variant="bodySmall" style={styles.legendLabel}>
                {item.label}
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
    borderRadius: 2,
  } as ViewStyle,
  
  legendLabel: {
    opacity: 0.8,
  },
});