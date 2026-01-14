import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Modal, Pressable } from 'react-native';
import { Text, Surface, IconButton } from 'react-native-paper';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';

/**
 * 热力图数据点
 */
export interface HeatmapDataPoint {
  x: string;
  y: string;
  value: number;
}

/**
 * 热力图组件 Props
 */
export interface HeatmapChartProps {
  /** 数据点数组 */
  data: HeatmapDataPoint[];
  /** X轴标签（如设备名称） */
  xLabels: string[];
  /** Y轴标签（如时间段） */
  yLabels: string[];
  /** 图表标题 */
  title?: string;
  /** 颜色渐变 [低值颜色, 中值颜色, 高值颜色] */
  colorScale?: [string, string, string];
  /** 图表宽度（默认屏幕宽度-32） */
  width?: number;
  /** 图表高度（默认根据Y轴标签数量自动计算） */
  height?: number;
  /** 是否显示格子中的数值 */
  showValues?: boolean;
  /** 数值格式化函数 */
  valueFormatter?: (value: number) => string;
  /** 单位后缀（如 %） */
  valueSuffix?: string;
  /** 最小值（用于颜色映射，默认自动计算） */
  minValue?: number;
  /** 最大值（用于颜色映射，默认自动计算） */
  maxValue?: number;
}

/**
 * 格子详情弹窗数据
 */
interface CellDetail {
  x: string;
  y: string;
  value: number;
  color: string;
}

/**
 * 默认颜色渐变：绿色（低）-> 黄色（中）-> 红色（高）
 */
const DEFAULT_COLOR_SCALE: [string, string, string] = ['#4CAF50', '#FFC107', '#F44336'];

/**
 * 根据值在范围内的位置计算颜色
 */
function interpolateColor(
  value: number,
  minVal: number,
  maxVal: number,
  colorScale: [string, string, string]
): string {
  const range = maxVal - minVal;
  if (range === 0) return colorScale[1]; // 中间颜色

  const normalized = (value - minVal) / range;

  // 解析颜色
  const parseHex = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || result.length < 4) {
      return [0, 0, 0];
    }
    return [
      parseInt(result[1] ?? '0', 16),
      parseInt(result[2] ?? '0', 16),
      parseInt(result[3] ?? '0', 16),
    ];
  };

  const lowColor = parseHex(colorScale[0]);
  const midColor = parseHex(colorScale[1]);
  const highColor = parseHex(colorScale[2]);

  let r: number, g: number, b: number;

  if (normalized <= 0.5) {
    // 低值到中值插值
    const t = normalized * 2;
    r = Math.round(lowColor[0] + (midColor[0] - lowColor[0]) * t);
    g = Math.round(lowColor[1] + (midColor[1] - lowColor[1]) * t);
    b = Math.round(lowColor[2] + (midColor[2] - lowColor[2]) * t);
  } else {
    // 中值到高值插值
    const t = (normalized - 0.5) * 2;
    r = Math.round(midColor[0] + (highColor[0] - midColor[0]) * t);
    g = Math.round(midColor[1] + (highColor[1] - midColor[1]) * t);
    b = Math.round(midColor[2] + (highColor[2] - midColor[2]) * t);
  }

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * 计算文字颜色（基于背景色亮度）
 */
function getContrastTextColor(bgColor: string): string {
  const parseHex = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || result.length < 4) {
      return [0, 0, 0];
    }
    return [
      parseInt(result[1] ?? '0', 16),
      parseInt(result[2] ?? '0', 16),
      parseInt(result[3] ?? '0', 16),
    ];
  };

  const [r, g, b] = parseHex(bgColor);
  // 计算相对亮度
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#212121' : '#FFFFFF';
}

/**
 * 热力图组件
 *
 * 用于展示二维数据的可视化，如产能利用率（设备 x 时间段）
 *
 * @example
 * ```tsx
 * <HeatmapChart
 *   data={[
 *     { x: '设备A', y: '8:00', value: 85 },
 *     { x: '设备A', y: '9:00', value: 92 },
 *     { x: '设备B', y: '8:00', value: 78 },
 *     { x: '设备B', y: '9:00', value: 65 },
 *   ]}
 *   xLabels={['设备A', '设备B']}
 *   yLabels={['8:00', '9:00']}
 *   title="产能利用率"
 *   showValues
 *   valueSuffix="%"
 * />
 * ```
 */
export default function HeatmapChart({
  data,
  xLabels,
  yLabels,
  title,
  colorScale = DEFAULT_COLOR_SCALE,
  width,
  height,
  showValues = false,
  valueFormatter,
  valueSuffix = '',
  minValue,
  maxValue,
}: HeatmapChartProps) {
  const [selectedCell, setSelectedCell] = useState<CellDetail | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // 计算布局尺寸
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = width ?? screenWidth - 32;

  // Y轴标签预留宽度
  const yAxisWidth = 60;
  // X轴标签预留高度
  const xAxisHeight = 40;
  // 图例高度
  const legendHeight = 30;

  // 计算格子尺寸
  const cellWidth = (chartWidth - yAxisWidth) / xLabels.length;
  const cellHeight = Math.max(36, Math.min(48, 300 / yLabels.length));

  // 计算图表高度
  const chartHeight = height ?? (yLabels.length * cellHeight + xAxisHeight + legendHeight + 20);

  // 计算数据范围
  const { computedMin, computedMax, dataMap } = useMemo(() => {
    const values = data.map(d => d.value);
    const min = minValue ?? Math.min(...values);
    const max = maxValue ?? Math.max(...values);

    // 创建数据映射
    const map = new Map<string, number>();
    data.forEach(d => {
      map.set(`${d.x}-${d.y}`, d.value);
    });

    return { computedMin: min, computedMax: max, dataMap: map };
  }, [data, minValue, maxValue]);

  // 格式化数值
  const formatValue = useCallback((value: number): string => {
    if (valueFormatter) {
      return valueFormatter(value);
    }
    if (Number.isInteger(value)) {
      return `${value}${valueSuffix}`;
    }
    return `${value.toFixed(1)}${valueSuffix}`;
  }, [valueFormatter, valueSuffix]);

  // 处理格子点击
  const handleCellPress = useCallback((x: string, y: string, value: number, color: string) => {
    setSelectedCell({ x, y, value, color });
    setModalVisible(true);
  }, []);

  // 关闭弹窗
  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedCell(null);
  }, []);

  // 渲染格子
  const renderCells = () => {
    const cells: React.ReactNode[] = [];

    yLabels.forEach((yLabel, yIndex) => {
      xLabels.forEach((xLabel, xIndex) => {
        const value = dataMap.get(`${xLabel}-${yLabel}`);
        const hasValue = value !== undefined;
        const cellValue = hasValue ? value : 0;
        const color = hasValue
          ? interpolateColor(cellValue, computedMin, computedMax, colorScale)
          : '#E0E0E0';

        const x = yAxisWidth + xIndex * cellWidth;
        const y = yIndex * cellHeight;
        const textColor = hasValue ? getContrastTextColor(color) : '#9E9E9E';

        cells.push(
          <G key={`cell-${xIndex}-${yIndex}`}>
            <Rect
              x={x + 1}
              y={y + 1}
              width={cellWidth - 2}
              height={cellHeight - 2}
              fill={color}
              rx={4}
              ry={4}
              onPress={() => hasValue && handleCellPress(xLabel, yLabel, cellValue, color)}
            />
            {showValues && hasValue && (
              <SvgText
                x={x + cellWidth / 2}
                y={y + cellHeight / 2 + 4}
                textAnchor="middle"
                fill={textColor}
                fontSize={cellWidth > 50 ? 12 : 10}
                fontWeight="600"
              >
                {formatValue(cellValue)}
              </SvgText>
            )}
          </G>
        );
      });
    });

    return cells;
  };

  // 渲染Y轴标签
  const renderYLabels = () => {
    return yLabels.map((label, index) => (
      <SvgText
        key={`y-label-${index}`}
        x={yAxisWidth - 8}
        y={index * cellHeight + cellHeight / 2 + 4}
        textAnchor="end"
        fill="#666"
        fontSize={11}
      >
        {label.length > 6 ? `${label.slice(0, 6)}...` : label}
      </SvgText>
    ));
  };

  // 渲染X轴标签
  const renderXLabels = () => {
    return xLabels.map((label, index) => (
      <SvgText
        key={`x-label-${index}`}
        x={yAxisWidth + index * cellWidth + cellWidth / 2}
        y={yLabels.length * cellHeight + 20}
        textAnchor="middle"
        fill="#666"
        fontSize={11}
        transform={`rotate(-30, ${yAxisWidth + index * cellWidth + cellWidth / 2}, ${yLabels.length * cellHeight + 20})`}
      >
        {label.length > 8 ? `${label.slice(0, 8)}...` : label}
      </SvgText>
    ));
  };

  // 渲染图例
  const renderLegend = () => {
    const legendY = yLabels.length * cellHeight + xAxisHeight;
    const legendWidth = chartWidth - yAxisWidth - 60;
    const legendX = yAxisWidth + 30;
    const gradientSteps = 10;
    const stepWidth = legendWidth / gradientSteps;

    const gradientRects = [];
    for (let i = 0; i < gradientSteps; i++) {
      const value = computedMin + (computedMax - computedMin) * (i / (gradientSteps - 1));
      const color = interpolateColor(value, computedMin, computedMax, colorScale);
      gradientRects.push(
        <Rect
          key={`legend-${i}`}
          x={legendX + i * stepWidth}
          y={legendY}
          width={stepWidth + 1}
          height={12}
          fill={color}
        />
      );
    }

    return (
      <G>
        {gradientRects}
        <SvgText
          x={legendX - 5}
          y={legendY + 10}
          textAnchor="end"
          fill="#666"
          fontSize={10}
        >
          {formatValue(computedMin)}
        </SvgText>
        <SvgText
          x={legendX + legendWidth + 5}
          y={legendY + 10}
          textAnchor="start"
          fill="#666"
          fontSize={10}
        >
          {formatValue(computedMax)}
        </SvgText>
      </G>
    );
  };

  return (
    <Surface style={styles.container} elevation={1}>
      {title && (
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
      )}

      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={chartHeight}>
          {/* Y轴标签 */}
          {renderYLabels()}

          {/* 热力图格子 */}
          {renderCells()}

          {/* X轴标签 */}
          {renderXLabels()}

          {/* 图例 */}
          {renderLegend()}
        </Svg>
      </View>

      {/* 格子详情弹窗 */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseModal}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            {selectedCell && (
              <>
                <View style={styles.modalHeader}>
                  <Text variant="titleMedium" style={styles.modalTitle}>
                    详情
                  </Text>
                  <IconButton
                    icon="close"
                    size={20}
                    onPress={handleCloseModal}
                    style={styles.modalCloseButton}
                  />
                </View>

                <View style={styles.modalBody}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>X轴</Text>
                    <Text style={styles.detailValue}>{selectedCell.x}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Y轴</Text>
                    <Text style={styles.detailValue}>{selectedCell.y}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>数值</Text>
                    <View style={styles.valueContainer}>
                      <View
                        style={[styles.colorIndicator, { backgroundColor: selectedCell.color }]}
                      />
                      <Text style={styles.detailValueLarge}>
                        {formatValue(selectedCell.value)}
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  title: {
    marginBottom: 16,
    fontWeight: '600',
  },
  chartContainer: {
    alignItems: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: '80%',
    maxWidth: 320,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontWeight: '600',
  },
  modalCloseButton: {
    margin: -8,
  },
  modalBody: {
    padding: 16,
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  detailValueLarge: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
});
