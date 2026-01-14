import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, StyleProp, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, {
  Rect,
  Line,
  Text as SvgText,
  G,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { theme } from '../../theme';

/**
 * 瀑布图数据项类型
 */
export interface WaterfallDataItem {
  /** 项目名称 */
  name: string;
  /** 数值 */
  value: number;
  /** 类型: start-起始值, increase-增加, decrease-减少, total-合计 */
  type: 'start' | 'increase' | 'decrease' | 'total';
}

/**
 * 瀑布图组件Props
 */
export interface WaterfallChartProps {
  /** 图表数据 */
  data: WaterfallDataItem[];
  /** 图表标题 */
  title?: string;
  /** 图表宽度 (默认为屏幕宽度-32) */
  width?: number;
  /** 图表高度 (默认280) */
  height?: number;
  /** 增加的颜色 (默认红色, 表示超支) */
  positiveColor?: string;
  /** 减少的颜色 (默认绿色, 表示节约) */
  negativeColor?: string;
  /** 合计的颜色 (默认主题色) */
  totalColor?: string;
  /** 起始值的颜色 (默认蓝色) */
  startColor?: string;
  /** 容器样式 */
  style?: StyleProp<ViewStyle>;
  /** 是否显示连接线 */
  showConnectors?: boolean;
  /** 是否显示数值标签 */
  showLabels?: boolean;
  /** 数值格式化函数 */
  formatValue?: (value: number) => string;
}

// 默认配置
const DEFAULT_WIDTH = Dimensions.get('window').width - 32;
const DEFAULT_HEIGHT = 280;
const PADDING = { top: 40, right: 16, bottom: 60, left: 50 };
const BAR_PADDING = 0.2; // 柱子间距比例

/**
 * 成本差异瀑布图组件
 *
 * 用于展示成本从BOM到实际的变化过程:
 * - start: 起始值（BOM成本）
 * - increase: 正向变化（超支部分，红色）
 * - decrease: 负向变化（节约部分，绿色）
 * - total: 最终值（实际成本）
 *
 * @example
 * ```tsx
 * <WaterfallChart
 *   title="成本差异分析"
 *   data={[
 *     { name: 'BOM成本', value: 1000, type: 'start' },
 *     { name: '原料超支', value: 150, type: 'increase' },
 *     { name: '人工节约', value: 80, type: 'decrease' },
 *     { name: '实际成本', value: 1070, type: 'total' },
 *   ]}
 * />
 * ```
 */
export const WaterfallChart: React.FC<WaterfallChartProps> = ({
  data,
  title,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  positiveColor = theme.colors.error, // 红色表示超支
  negativeColor = theme.colors.success, // 绿色表示节约
  totalColor = theme.custom.colors.primary,
  startColor = '#1890FF',
  style,
  showConnectors = true,
  showLabels = true,
  formatValue = (v: number) => `¥${v.toFixed(0)}`,
}) => {
  // 计算图表尺寸
  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;

  // 计算每个柱子的累计位置和高度
  const processedData = useMemo(() => {
    const result: Array<{
      name: string;
      value: number;
      type: WaterfallDataItem['type'];
      startY: number;
      endY: number;
      barColor: string;
    }> = [];

    let runningTotal = 0;

    data.forEach((item) => {
      let startY: number;
      let endY: number;
      let barColor: string;

      switch (item.type) {
        case 'start':
          startY = 0;
          endY = item.value;
          runningTotal = item.value;
          barColor = startColor;
          break;
        case 'increase':
          startY = runningTotal;
          endY = runningTotal + item.value;
          runningTotal = endY;
          barColor = positiveColor;
          break;
        case 'decrease':
          startY = runningTotal - item.value;
          endY = runningTotal;
          runningTotal = startY;
          barColor = negativeColor;
          break;
        case 'total':
          startY = 0;
          endY = item.value;
          barColor = totalColor;
          break;
        default:
          startY = runningTotal;
          endY = runningTotal;
          barColor = '#999';
      }

      result.push({
        name: item.name,
        value: item.value,
        type: item.type,
        startY,
        endY,
        barColor,
      });
    });

    return result;
  }, [data, startColor, positiveColor, negativeColor, totalColor]);

  // 计算Y轴范围
  const { minValue, maxValue, yScale } = useMemo(() => {
    let min = 0;
    let max = 0;

    processedData.forEach((item) => {
      min = Math.min(min, item.startY, item.endY);
      max = Math.max(max, item.startY, item.endY);
    });

    // 添加10%的边距
    const range = max - min;
    const padding = range * 0.1;
    min = min - padding;
    max = max + padding;

    const scale = (value: number) => {
      return chartHeight - ((value - min) / (max - min)) * chartHeight;
    };

    return { minValue: min, maxValue: max, yScale: scale };
  }, [processedData, chartHeight]);

  // 计算柱子宽度和位置
  const barWidth = (chartWidth / data.length) * (1 - BAR_PADDING);
  const barSpacing = chartWidth / data.length;

  // 生成Y轴刻度
  const yTicks = useMemo(() => {
    const tickCount = 5;
    const range = maxValue - minValue;
    const step = range / (tickCount - 1);
    const ticks: number[] = [];

    for (let i = 0; i < tickCount; i++) {
      const value = minValue + step * i;
      // 取整到最近的10
      ticks.push(Math.round(value / 10) * 10);
    }

    return ticks;
  }, [minValue, maxValue]);

  // 如果没有数据，显示空状态
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, style]}>
        {title && <Text variant="titleMedium" style={styles.title}>{title}</Text>}
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>暂无数据</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {title && <Text variant="titleMedium" style={styles.title}>{title}</Text>}

      <Svg width={width} height={height}>
        <Defs>
          {/* 渐变定义 */}
          <LinearGradient id="startGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={startColor} stopOpacity={1} />
            <Stop offset="100%" stopColor={startColor} stopOpacity={0.8} />
          </LinearGradient>
          <LinearGradient id="increaseGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={positiveColor} stopOpacity={1} />
            <Stop offset="100%" stopColor={positiveColor} stopOpacity={0.8} />
          </LinearGradient>
          <LinearGradient id="decreaseGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={negativeColor} stopOpacity={1} />
            <Stop offset="100%" stopColor={negativeColor} stopOpacity={0.8} />
          </LinearGradient>
          <LinearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={totalColor} stopOpacity={1} />
            <Stop offset="100%" stopColor={totalColor} stopOpacity={0.8} />
          </LinearGradient>
        </Defs>

        <G transform={`translate(${PADDING.left}, ${PADDING.top})`}>
          {/* Y轴 */}
          <Line
            x1={0}
            y1={0}
            x2={0}
            y2={chartHeight}
            stroke={theme.colors.border}
            strokeWidth={1}
          />

          {/* Y轴刻度和标签 */}
          {yTicks.map((tick, index) => {
            const y = yScale(tick);
            return (
              <G key={`y-tick-${index}`}>
                {/* 网格线 */}
                <Line
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke={theme.colors.divider}
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
                {/* 刻度标签 */}
                <SvgText
                  x={-8}
                  y={y + 4}
                  fontSize={10}
                  fill={theme.colors.textSecondary}
                  textAnchor="end"
                >
                  {formatValue(tick)}
                </SvgText>
              </G>
            );
          })}

          {/* X轴 */}
          <Line
            x1={0}
            y1={chartHeight}
            x2={chartWidth}
            y2={chartHeight}
            stroke={theme.colors.border}
            strokeWidth={1}
          />

          {/* 柱子和连接线 */}
          {processedData.map((item, index) => {
            const x = index * barSpacing + (barSpacing - barWidth) / 2;
            const y1 = yScale(item.endY);
            const y2 = yScale(item.startY);
            const barHeight = Math.abs(y2 - y1);
            const barY = Math.min(y1, y2);

            // 选择渐变
            const gradientId =
              item.type === 'start'
                ? 'startGradient'
                : item.type === 'increase'
                  ? 'increaseGradient'
                  : item.type === 'decrease'
                    ? 'decreaseGradient'
                    : 'totalGradient';

            // 下一个柱子的位置（用于连接线）
            const nextItem = processedData[index + 1];
            const nextX = (index + 1) * barSpacing + (barSpacing - barWidth) / 2;

            return (
              <G key={`bar-${index}`}>
                {/* 连接线 */}
                {showConnectors && nextItem && item.type !== 'total' && (
                  <Line
                    x1={x + barWidth}
                    y1={yScale(item.type === 'decrease' ? item.startY : item.endY)}
                    x2={nextX}
                    y2={yScale(item.type === 'decrease' ? item.startY : item.endY)}
                    stroke={theme.colors.textTertiary}
                    strokeWidth={1}
                    strokeDasharray="4,2"
                  />
                )}

                {/* 柱子 */}
                <Rect
                  x={x}
                  y={barY}
                  width={barWidth}
                  height={barHeight > 0 ? barHeight : 2}
                  fill={`url(#${gradientId})`}
                  rx={4}
                  ry={4}
                />

                {/* 数值标签 */}
                {showLabels && (
                  <SvgText
                    x={x + barWidth / 2}
                    y={barY - 6}
                    fontSize={11}
                    fontWeight="600"
                    fill={item.barColor}
                    textAnchor="middle"
                  >
                    {item.type === 'increase'
                      ? `+${formatValue(item.value)}`
                      : item.type === 'decrease'
                        ? `-${formatValue(item.value)}`
                        : formatValue(item.value)}
                  </SvgText>
                )}

                {/* X轴标签 */}
                <SvgText
                  x={x + barWidth / 2}
                  y={chartHeight + 16}
                  fontSize={10}
                  fill={theme.colors.text}
                  textAnchor="middle"
                >
                  {item.name.length > 5 ? `${item.name.slice(0, 5)}...` : item.name}
                </SvgText>

                {/* 类型标签 */}
                <SvgText
                  x={x + barWidth / 2}
                  y={chartHeight + 30}
                  fontSize={8}
                  fill={theme.colors.textTertiary}
                  textAnchor="middle"
                >
                  {item.type === 'start'
                    ? '起始'
                    : item.type === 'increase'
                      ? '超支'
                      : item.type === 'decrease'
                        ? '节约'
                        : '合计'}
                </SvgText>
              </G>
            );
          })}
        </G>
      </Svg>

      {/* 图例 */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: startColor }]} />
          <Text style={styles.legendText}>起始值</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: positiveColor }]} />
          <Text style={styles.legendText}>超支</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: negativeColor }]} />
          <Text style={styles.legendText}>节约</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: totalColor }]} />
          <Text style={styles.legendText}>合计</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.custom.borderRadius.m,
    padding: theme.custom.spacing.m,
  },
  title: {
    marginBottom: theme.custom.spacing.m,
    fontWeight: '600',
    color: theme.colors.text,
  },
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textTertiary,
    fontSize: 14,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: theme.custom.spacing.m,
    paddingTop: theme.custom.spacing.s,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});

export default WaterfallChart;
