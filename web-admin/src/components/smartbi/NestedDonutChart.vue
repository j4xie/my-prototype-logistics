<script setup lang="ts">
/**
 * SmartBI NestedDonutChart - Year-over-Year Category Structure Comparison (Nested Ring)
 * Features:
 * - Outer ring: Current year category distribution
 * - Inner ring: Previous year category distribution
 * - Different radius: outer [50%, 70%], inner [25%, 45%]
 * - Show percentage labels
 * - Hover tooltip with both years' data
 * - Click event for drill-down
 * - Legend showing categories
 * - Center text showing total
 * - Year labels for each ring
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import * as echarts from 'echarts';
import type { EChartsOption, ECharts } from 'echarts';

// Types
export interface NestedDonutDataItem {
  /** Category name */
  category: string;
  /** Current year value */
  currentValue: number;
  /** Previous year value */
  previousValue: number;
  /** Current year ratio/percentage (0-100) */
  currentRatio: number;
  /** Previous year ratio/percentage (0-100) */
  previousRatio: number;
  /** Optional color override */
  color?: string;
  /** Optional extra data for drill-down */
  extra?: Record<string, unknown>;
}

interface Props {
  /** Category comparison data array */
  data: NestedDonutDataItem[];
  /** Current year (default: current calendar year) */
  currentYear?: number;
  /** Previous year (default: current year - 1) */
  previousYear?: number;
  /** Loading state */
  loading?: boolean;
  /** Chart title */
  title?: string;
  /** Chart height (CSS value) */
  height?: string;
  /** Show percentage labels on rings */
  showLabel?: boolean;
  /** Unit for values (e.g., '万元', '件') */
  unit?: string;
  /** Custom color palette */
  colors?: string[];
  /** Show legend */
  showLegend?: boolean;
  /** Show center total text */
  showCenterTotal?: boolean;
  /** Custom center text (overrides total display) */
  centerText?: string;
  /** Custom center sub-text */
  centerSubText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  currentYear: () => new Date().getFullYear(),
  previousYear: () => new Date().getFullYear() - 1,
  loading: false,
  title: '',
  height: '400px',
  showLabel: true,
  unit: '万元',
  colors: () => [
    '#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399',
    '#00d4ff', '#ff6b9d', '#c084fc', '#fbbf24', '#34d399'
  ],
  showLegend: true,
  showCenterTotal: true,
  centerText: '',
  centerSubText: ''
});

const emit = defineEmits<{
  (e: 'categoryClick', data: { item: NestedDonutDataItem; year: 'current' | 'previous' }): void;
  (e: 'drillDown', data: NestedDonutDataItem): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);

// Computed: Calculate totals
const totals = computed(() => {
  const currentTotal = props.data.reduce((sum, d) => sum + d.currentValue, 0);
  const previousTotal = props.data.reduce((sum, d) => sum + d.previousValue, 0);
  const yoyChange = previousTotal !== 0
    ? ((currentTotal - previousTotal) / previousTotal) * 100
    : 0;

  return {
    currentTotal,
    previousTotal,
    yoyChange,
    yoyAmount: currentTotal - previousTotal
  };
});

// Format number with K/M suffix
const formatNumber = (value: number, precision = 1): string => {
  if (Math.abs(value) >= 1000000) {
    return (value / 1000000).toFixed(precision) + 'M';
  } else if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(precision) + 'K';
  }
  return value.toFixed(precision);
};

// Format currency for display
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

// Get color for category
const getColor = (index: number, item: NestedDonutDataItem): string => {
  return item.color || props.colors[index % props.colors.length];
};

// Get growth color
const getGrowthColor = (value: number): string => {
  if (value > 0.5) return '#67c23a';
  if (value < -0.5) return '#f56c6c';
  return '#909399';
};

// Build chart options
const chartOptions = computed<EChartsOption>(() => {
  // Prepare data for outer ring (current year)
  const outerRingData = props.data.map((item, index) => ({
    name: item.category,
    value: item.currentValue,
    itemStyle: {
      color: getColor(index, item)
    },
    _originalData: item
  }));

  // Prepare data for inner ring (previous year) with slightly dimmer colors
  const innerRingData = props.data.map((item, index) => ({
    name: item.category,
    value: item.previousValue,
    itemStyle: {
      color: getColor(index, item),
      opacity: 0.7
    },
    _originalData: item
  }));

  // Build graphic elements for center text
  const graphicElements: echarts.GraphicComponentOption[] = [];

  if (props.showCenterTotal || props.centerText) {
    const centerTextDisplay = props.centerText || formatNumber(totals.value.currentTotal);
    const subTextDisplay = props.centerSubText || `同比 ${totals.value.yoyChange >= 0 ? '+' : ''}${totals.value.yoyChange.toFixed(1)}%`;

    graphicElements.push({
      type: 'group',
      left: 'center',
      top: 'middle',
      children: [
        {
          type: 'text',
          z: 100,
          left: 'center',
          top: -20,
          style: {
            fill: '#303133',
            text: centerTextDisplay,
            font: 'bold 24px sans-serif',
            textAlign: 'center'
          }
        },
        {
          type: 'text',
          z: 100,
          left: 'center',
          top: 10,
          style: {
            fill: props.unit ? '#909399' : getGrowthColor(totals.value.yoyChange),
            text: props.centerSubText ? subTextDisplay : `${props.unit}`,
            font: '12px sans-serif',
            textAlign: 'center'
          }
        },
        {
          type: 'text',
          z: 100,
          left: 'center',
          top: 28,
          style: {
            fill: getGrowthColor(totals.value.yoyChange),
            text: props.centerSubText ? '' : subTextDisplay,
            font: '12px sans-serif',
            textAlign: 'center'
          }
        }
      ]
    });
  }

  const options: EChartsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#ebeef5',
      borderWidth: 1,
      textStyle: {
        color: '#303133'
      },
      formatter: (params: { name: string; value: number; percent: number; seriesName: string; color: string; data: { _originalData?: NestedDonutDataItem } }) => {
        const item = params.data._originalData;
        if (!item) return '';

        const isCurrentYear = params.seriesName.includes(String(props.currentYear));
        const yearLabel = isCurrentYear ? `${props.currentYear}年` : `${props.previousYear}年`;
        const otherYearLabel = isCurrentYear ? `${props.previousYear}年` : `${props.currentYear}年`;
        const currentValue = isCurrentYear ? item.currentValue : item.previousValue;
        const otherValue = isCurrentYear ? item.previousValue : item.currentValue;
        const currentRatio = isCurrentYear ? item.currentRatio : item.previousRatio;
        const otherRatio = isCurrentYear ? item.previousRatio : item.currentRatio;

        // Calculate YoY change for this category
        const categoryYoyChange = item.previousValue !== 0
          ? ((item.currentValue - item.previousValue) / item.previousValue) * 100
          : (item.currentValue > 0 ? 100 : 0);
        const categoryYoyAmount = item.currentValue - item.previousValue;
        const growthColor = getGrowthColor(categoryYoyChange);
        const growthArrow = categoryYoyChange > 0 ? '&#8593;' : (categoryYoyChange < 0 ? '&#8595;' : '&#8594;');

        return `
          <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">${params.name}</div>
          <div style="display: flex; align-items: center; gap: 8px; margin: 6px 0;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${params.color}; ${isCurrentYear ? '' : 'opacity: 0.7;'}"></span>
            <span style="color: #606266;">${yearLabel}:</span>
            <span style="font-weight: 600; color: #303133;">${formatCurrency(currentValue)} ${props.unit}</span>
            <span style="color: #909399; font-size: 12px;">(${currentRatio.toFixed(1)}%)</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; margin: 6px 0;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${params.color}; opacity: ${isCurrentYear ? '0.7' : '1'};"></span>
            <span style="color: #606266;">${otherYearLabel}:</span>
            <span style="font-weight: 600; color: #303133;">${formatCurrency(otherValue)} ${props.unit}</span>
            <span style="color: #909399; font-size: 12px;">(${otherRatio.toFixed(1)}%)</span>
          </div>
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #ebeef5; font-size: 12px;">
            <div style="display: flex; align-items: center; gap: 6px; color: ${growthColor};">
              <span>${growthArrow}</span>
              <span>同比: ${categoryYoyChange > 0 ? '+' : ''}${categoryYoyChange.toFixed(1)}%</span>
              <span style="color: #909399;">|</span>
              <span>${categoryYoyAmount > 0 ? '+' : ''}${formatNumber(categoryYoyAmount)} ${props.unit}</span>
            </div>
            <div style="margin-top: 4px; color: ${getGrowthColor(item.currentRatio - item.previousRatio)};">
              占比变化: ${(item.currentRatio - item.previousRatio) > 0 ? '+' : ''}${(item.currentRatio - item.previousRatio).toFixed(1)}pp
            </div>
          </div>
        `;
      }
    },
    legend: props.showLegend ? {
      orient: 'horizontal',
      bottom: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 16,
      textStyle: {
        color: '#606266',
        fontSize: 12
      },
      formatter: (name: string) => {
        const item = props.data.find(d => d.category === name);
        if (item) {
          return `${name}  ${item.currentRatio.toFixed(1)}%`;
        }
        return name;
      }
    } : undefined,
    series: [
      // Outer ring - Current year
      {
        name: `${props.currentYear}年分布`,
        type: 'pie',
        radius: ['50%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: props.showLabel ? {
          show: true,
          position: 'outside',
          formatter: (params: { name: string; percent: number }) => {
            return `${params.name}\n${params.percent.toFixed(1)}%`;
          },
          color: '#606266',
          fontSize: 11,
          lineHeight: 16
        } : { show: false },
        labelLine: props.showLabel ? {
          show: true,
          length: 15,
          length2: 10,
          lineStyle: {
            color: '#dcdfe6'
          }
        } : { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold'
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          }
        },
        data: outerRingData
      },
      // Inner ring - Previous year
      {
        name: `${props.previousYear}年分布`,
        type: 'pie',
        radius: ['25%', '45%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 3,
          borderColor: '#fff',
          borderWidth: 1
        },
        label: {
          show: false
        },
        labelLine: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            position: 'center',
            formatter: (params: { name: string; percent: number }) => {
              return `${params.name}\n${params.percent.toFixed(1)}%`;
            },
            fontSize: 12,
            fontWeight: 'bold',
            color: '#303133'
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          }
        },
        data: innerRingData
      }
    ],
    graphic: graphicElements.length > 0 ? graphicElements : undefined
  };

  // Add year labels as annotations
  if (props.showLabel) {
    (options as { title?: echarts.TitleComponentOption[] }).title = [
      {
        text: `${props.currentYear}年`,
        left: '82%',
        top: '35%',
        textStyle: {
          fontSize: 12,
          fontWeight: 500,
          color: '#409eff'
        }
      },
      {
        text: `${props.previousYear}年`,
        left: '82%',
        top: '50%',
        textStyle: {
          fontSize: 12,
          fontWeight: 500,
          color: '#909399'
        }
      }
    ];
  }

  return options;
});

// Initialize chart
function initChart() {
  if (!chartRef.value) return;

  chartInstance.value = echarts.init(chartRef.value);
  chartInstance.value.setOption(chartOptions.value);

  // Click event for drill-down
  chartInstance.value.on('click', (params: { componentType: string; seriesName?: string; dataIndex?: number; data?: { _originalData?: NestedDonutDataItem } }) => {
    if (params.componentType === 'series' && params.dataIndex !== undefined) {
      const item = params.data?._originalData;
      if (item) {
        const isCurrentYear = params.seriesName?.includes(String(props.currentYear));
        emit('categoryClick', {
          item,
          year: isCurrentYear ? 'current' : 'previous'
        });
        emit('drillDown', item);
      }
    }
  });
}

// Update chart
function updateChart() {
  if (chartInstance.value) {
    chartInstance.value.setOption(chartOptions.value, true);
  }
}

// Handle resize
function handleResize() {
  chartInstance.value?.resize();
}

// Lifecycle
onMounted(() => {
  initChart();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  chartInstance.value?.dispose();
});

// Watch for data changes
watch(() => props.data, updateChart, { deep: true });
watch(chartOptions, updateChart, { deep: true });

// Expose methods
defineExpose({
  resize: handleResize,
  getInstance: () => chartInstance.value,
  getTotals: () => totals.value
});
</script>

<template>
  <div v-loading="loading" class="nested-donut-chart">
    <!-- Header -->
    <div v-if="title" class="chart-header">
      <h3>{{ title }}</h3>
      <div class="year-legend">
        <span class="year-item current">
          <span class="dot"></span>
          {{ currentYear }}年 (外环)
        </span>
        <span class="year-item previous">
          <span class="dot"></span>
          {{ previousYear }}年 (内环)
        </span>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="summary-stats">
      <div class="stat-item">
        <span class="stat-label">{{ previousYear }}年总计</span>
        <span class="stat-value">{{ formatNumber(totals.previousTotal) }} <span class="unit">{{ unit }}</span></span>
      </div>
      <div class="stat-item highlight">
        <span class="stat-label">{{ currentYear }}年总计</span>
        <span class="stat-value primary">{{ formatNumber(totals.currentTotal) }} <span class="unit">{{ unit }}</span></span>
      </div>
      <div class="stat-item">
        <span class="stat-label">同比变化</span>
        <span
          class="stat-value"
          :class="{
            positive: totals.yoyChange > 0,
            negative: totals.yoyChange < 0
          }"
        >
          <span class="arrow">
            <template v-if="totals.yoyChange > 0">&#8593;</template>
            <template v-else-if="totals.yoyChange < 0">&#8595;</template>
            <template v-else>&#8594;</template>
          </span>
          {{ totals.yoyChange > 0 ? '+' : '' }}{{ totals.yoyChange.toFixed(1) }}%
        </span>
      </div>
    </div>

    <!-- Chart Container -->
    <div ref="chartRef" :style="{ width: '100%', height: height }"></div>
  </div>
</template>

<style lang="scss" scoped>
.nested-donut-chart {
  width: 100%;
  background: #fff;
  border-radius: 8px;

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 0 4px;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }

    .year-legend {
      display: flex;
      gap: 16px;

      .year-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #606266;

        .dot {
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        &.current .dot {
          background: #409eff;
          box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
        }

        &.previous .dot {
          background: #909399;
          opacity: 0.7;
        }
      }
    }
  }

  .summary-stats {
    display: flex;
    gap: 24px;
    margin-bottom: 16px;
    padding: 12px 16px;
    background: #f8f9fa;
    border-radius: 8px;

    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 4px;

      &.highlight {
        padding: 0 16px;
        border-left: 1px solid #ebeef5;
        border-right: 1px solid #ebeef5;
      }

      .stat-label {
        font-size: 12px;
        color: #909399;
      }

      .stat-value {
        font-size: 18px;
        font-weight: 600;
        color: #303133;
        display: flex;
        align-items: baseline;
        gap: 4px;

        &.primary {
          color: #409eff;
        }

        &.positive {
          color: #67c23a;
        }

        &.negative {
          color: #f56c6c;
        }

        .unit {
          font-size: 12px;
          font-weight: 400;
          color: #909399;
        }

        .arrow {
          font-size: 14px;
          margin-right: 2px;
        }
      }
    }
  }
}

// Responsive adjustments
@media (max-width: 768px) {
  .nested-donut-chart {
    .chart-header {
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;
    }

    .summary-stats {
      flex-direction: column;
      gap: 12px;

      .stat-item.highlight {
        padding: 12px 0;
        border-left: none;
        border-right: none;
        border-top: 1px solid #ebeef5;
        border-bottom: 1px solid #ebeef5;
      }
    }
  }
}
</style>
