import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { Text, Surface, IconButton } from 'react-native-paper';
import { PieChart as RNPieChart } from 'react-native-chart-kit';
import { CHART_COLORS, CHART_SIZES } from './chartSizes';

/**
 * Pie chart data item
 */
export interface PieDataItem {
  /** Segment name */
  name: string;
  /** Segment value */
  value: number;
  /** Optional color override */
  color?: string;
  /** Legend font color */
  legendFontColor?: string;
  /** Legend font size */
  legendFontSize?: number;
}

/**
 * MobilePieChart Props
 */
export interface MobilePieChartProps {
  /** Chart title */
  title?: string;
  /** Pie chart data */
  data: PieDataItem[];
  /** Chart width (default: pie.width) */
  width?: number;
  /** Chart height (default: pie.height) */
  height?: number;
  /** Show labels on pie segments */
  showLabels?: boolean;
  /** Accessor for determining segment size */
  accessor?: string;
  /** Background color */
  backgroundColor?: string;
  /** Padding left for chart */
  paddingLeft?: string;
  /** Show as donut chart */
  hasLegend?: boolean;
  /** Center text (for donut style) */
  centerText?: string;
  /** Center value (for donut style) */
  centerValue?: string | number;
  /** On segment press */
  onSegmentPress?: (item: PieDataItem, index: number) => void;
}

/**
 * Legend item for external legend display
 */
interface LegendItemProps {
  name: string;
  value: number;
  color: string;
  percentage: number;
  onPress?: () => void;
}

/**
 * LegendItem Component
 */
function LegendItem({
  name,
  value,
  color,
  percentage,
  onPress,
}: LegendItemProps): React.ReactElement {
  return (
    <Pressable style={legendStyles.item} onPress={onPress}>
      <View style={[legendStyles.colorDot, { backgroundColor: color }]} />
      <View style={legendStyles.textContainer}>
        <Text style={legendStyles.name} numberOfLines={1}>{name}</Text>
        <Text style={legendStyles.value}>
          {value.toLocaleString('zh-CN')} ({percentage.toFixed(1)}%)
        </Text>
      </View>
    </Pressable>
  );
}

const legendStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F9FAFB',
    marginBottom: 4,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 13,
    color: '#1F2937',
    flex: 1,
  },
  value: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
});

/**
 * MobilePieChart Component
 *
 * A pie chart component using react-native-chart-kit.
 * Displays proportional data with optional legend.
 *
 * @example
 * ```tsx
 * <MobilePieChart
 *   title="Category Distribution"
 *   data={[
 *     { name: 'Category A', value: 300 },
 *     { name: 'Category B', value: 200 },
 *     { name: 'Category C', value: 150 },
 *   ]}
 *   showLabels
 * />
 * ```
 */
export default function MobilePieChart({
  title,
  data,
  width = CHART_SIZES.pie.width,
  height = CHART_SIZES.pie.height,
  showLabels = true,
  accessor = 'value',
  backgroundColor = 'transparent',
  paddingLeft = '0',
  hasLegend = true,
  centerText,
  centerValue,
  onSegmentPress,
}: MobilePieChartProps): React.ReactElement {
  const [selectedItem, setSelectedItem] = useState<PieDataItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Calculate total for percentages
  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + item.value, 0);
  }, [data]);

  // Format data with colors
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      name: item.name,
      population: item.value,
      color: item.color || CHART_COLORS.series[index % CHART_COLORS.series.length],
      legendFontColor: item.legendFontColor || '#6B7280',
      legendFontSize: item.legendFontSize || 12,
    }));
  }, [data]);

  // Handle segment press
  const handleSegmentPress = (index: number) => {
    const item = data[index];
    if (item) {
      setSelectedItem(item);
      setModalVisible(true);
      onSegmentPress?.(item, index);
    }
  };

  // Close modal
  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedItem(null);
  };

  // Calculate actual chart size (smaller to fit legend)
  const chartSize = hasLegend ? Math.min(width, height) * 0.6 : Math.min(width, height);

  return (
    <Surface style={styles.container} elevation={1}>
      {title && (
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
      )}

      <View style={styles.chartContainer}>
        {/* Pie Chart */}
        <View style={styles.pieWrapper}>
          <RNPieChart
            data={chartData}
            width={chartSize}
            height={chartSize}
            chartConfig={{
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor="population"
            backgroundColor={backgroundColor}
            paddingLeft={paddingLeft}
            hasLegend={false} // We use custom legend
            absolute={showLabels}
          />

          {/* Center text for donut style */}
          {(centerText || centerValue) && (
            <View style={[styles.centerOverlay, { width: chartSize, height: chartSize }]}>
              {centerValue !== undefined && (
                <Text style={styles.centerValue}>{centerValue}</Text>
              )}
              {centerText && (
                <Text style={styles.centerText}>{centerText}</Text>
              )}
            </View>
          )}
        </View>

        {/* Custom Legend */}
        {hasLegend && (
          <View style={styles.legendContainer}>
            {data.map((item, index) => (
              <LegendItem
                key={`legend-${index}`}
                name={item.name}
                value={item.value}
                color={item.color || CHART_COLORS.series[index % CHART_COLORS.series.length] || CHART_COLORS.primary}
                percentage={total > 0 ? (item.value / total) * 100 : 0}
                onPress={() => handleSegmentPress(index)}
              />
            ))}
          </View>
        )}
      </View>

      {/* Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseModal}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            {selectedItem && (
              <>
                <View style={styles.modalHeader}>
                  <Text variant="titleMedium" style={styles.modalTitle}>
                    {selectedItem.name}
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
                    <Text style={styles.detailLabel}>Value</Text>
                    <Text style={styles.detailValue}>
                      {selectedItem.value.toLocaleString('zh-CN')}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Percentage</Text>
                    <Text style={styles.detailValue}>
                      {total > 0
                        ? ((selectedItem.value / total) * 100).toFixed(1)
                        : 0}%
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total</Text>
                    <Text style={styles.detailValue}>
                      {total.toLocaleString('zh-CN')}
                    </Text>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
  },
  title: {
    fontWeight: '600',
    marginBottom: 12,
    color: '#1F2937',
  },
  chartContainer: {
    alignItems: 'center',
  },
  pieWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  centerText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  legendContainer: {
    width: '100%',
    marginTop: 16,
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
    flex: 1,
  },
  modalCloseButton: {
    margin: -8,
  },
  modalBody: {
    padding: 16,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
});
