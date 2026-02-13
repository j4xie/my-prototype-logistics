<script setup lang="ts">
/**
 * SmartBI CategoryStructureComparisonChart - Year-over-Year Category Structure Comparison
 * Features:
 * - Toggle between bar (grouped bars) and pie (dual pie charts) views
 * - Summary KPI cards showing totals and YoY change
 * - Grouped bar chart with growth rate line on secondary axis
 * - Side-by-side pie charts showing category distribution per year
 * - Detailed breakdown table
 * - Color coding for growth rates (positive=green, negative=red)
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import echarts from '@/utils/echarts';
import type { EChartsOption, ECharts } from 'echarts';

// Types
export interface CategoryComparisonData {
  /** Category name */
  category: string;
  /** Current year amount */
  currentAmount: number;
  /** Compare (previous) year amount */
  compareAmount: number;
  /** Current year ratio/percentage of total */
  currentRatio: number;
  /** Compare year ratio/percentage of total */
  compareRatio: number;
  /** Year-over-Year growth rate (%) */
  yoyGrowthRate: number;
  /** Ratio change (currentRatio - compareRatio) */
  ratioChange: number;
  /** Current year (e.g., 2026) */
  currentYear: number;
  /** Compare year (e.g., 2025) */
  compareYear: number;
}

export interface CategorySummary {
  /** Total amount for current year */
  currentTotal: number;
  /** Total amount for compare year */
  compareTotal: number;
  /** Overall YoY growth rate */
  totalYoyGrowthRate: number;
}

export type ChartViewMode = 'bar' | 'pie';

interface Props {
  /** Chart title */
  title?: string;
  /** Category comparison data array */
  data: CategoryComparisonData[];
  /** Loading state */
  loading?: boolean;
  /** Chart height */
  height?: string;
  /** Summary data for KPI cards */
  summary?: CategorySummary;
  /** Currency/unit label */
  unit?: string;
  /** Show table view */
  showTable?: boolean;
  /** Initial view mode */
  defaultViewMode?: ChartViewMode;
}

const props = withDefaults(defineProps<Props>(), {
  title: '品类结构对比',
  loading: false,
  height: '400px',
  unit: '万元',
  showTable: true,
  defaultViewMode: 'bar'
});

const emit = defineEmits<{
  (e: 'viewModeChange', mode: ChartViewMode): void;
  (e: 'categoryClick', data: CategoryComparisonData): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);
const viewMode = ref<ChartViewMode>(props.defaultViewMode);

// Color palette
const colors = {
  currentYear: '#409eff',      // Blue - current year
  compareYear: '#91cc75',      // Light green - compare year
  growthLine: '#ee6666',       // Red - growth rate line
  positive: '#67c23a',         // Green - positive growth
  negative: '#f56c6c',         // Red - negative growth
  neutral: '#909399',          // Gray - neutral
  pieColors: [
    '#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399',
    '#00d4ff', '#ff6b9d', '#c084fc', '#fbbf24', '#34d399'
  ]
};

// Computed: Get years from data
const years = computed(() => {
  if (props.data.length === 0) {
    return { current: new Date().getFullYear(), compare: new Date().getFullYear() - 1 };
  }
  return {
    current: props.data[0].currentYear,
    compare: props.data[0].compareYear
  };
});

// Computed: KPI summary data
const kpiData = computed(() => {
  if (!props.summary) {
    // Calculate from data if summary not provided
    const currentTotal = props.data.reduce((sum, d) => sum + d.currentAmount, 0);
    const compareTotal = props.data.reduce((sum, d) => sum + d.compareAmount, 0);
    const yoyRate = compareTotal !== 0
      ? ((currentTotal - compareTotal) / compareTotal) * 100
      : 0;

    return {
      currentTotal,
      compareTotal,
      totalYoyGrowthRate: yoyRate
    };
  }
  return props.summary;
});

// Computed: Growth amount
const growthAmount = computed(() => {
  return kpiData.value.currentTotal - kpiData.value.compareTotal;
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

// Get color based on value (positive/negative)
const getGrowthColor = (value: number): string => {
  if (value > 0.5) return colors.positive;
  if (value < -0.5) return colors.negative;
  return colors.neutral;
};

// Get growth class for styling
const getGrowthClass = (value: number): string => {
  if (value > 0.5) return 'positive';
  if (value < -0.5) return 'negative';
  return 'neutral';
};

// Build bar chart options
const buildBarChartOptions = (): EChartsOption => {
  const categories = props.data.map(d => d.category);
  const currentValues = props.data.map(d => d.currentAmount);
  const compareValues = props.data.map(d => d.compareAmount);
  const growthRates = props.data.map(d => d.yoyGrowthRate);

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        crossStyle: { color: '#999' }
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#ebeef5',
      borderWidth: 1,
      textStyle: { color: '#303133' },
      formatter: (params) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const dataIndex = params[0].dataIndex as number;
        const item = props.data[dataIndex];
        if (!item) return '';

        const growthColor = getGrowthColor(item.yoyGrowthRate);
        const growthArrow = item.yoyGrowthRate > 0 ? '&#8593;' : (item.yoyGrowthRate < 0 ? '&#8595;' : '&#8594;');

        return `
          <div style="font-weight: 600; margin-bottom: 8px;">${item.category}</div>
          <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${colors.currentYear};"></span>
            <span>${years.value.current}年: </span>
            <span style="font-weight: 600;">${formatCurrency(item.currentAmount)} ${props.unit}</span>
            <span style="color: #909399; font-size: 12px;">(${item.currentRatio.toFixed(1)}%)</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${colors.compareYear};"></span>
            <span>${years.value.compare}年: </span>
            <span style="font-weight: 600;">${formatCurrency(item.compareAmount)} ${props.unit}</span>
            <span style="color: #909399; font-size: 12px;">(${item.compareRatio.toFixed(1)}%)</span>
          </div>
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #ebeef5;">
            <div style="display: flex; align-items: center; gap: 8px; color: ${growthColor};">
              <span>${growthArrow}</span>
              <span>同比增长: ${item.yoyGrowthRate > 0 ? '+' : ''}${item.yoyGrowthRate.toFixed(1)}%</span>
            </div>
            <div style="color: ${getGrowthColor(item.ratioChange)}; font-size: 12px; margin-top: 4px;">
              占比变化: ${item.ratioChange > 0 ? '+' : ''}${item.ratioChange.toFixed(1)}pp
            </div>
          </div>
        `;
      }
    },
    legend: {
      bottom: 0,
      data: [`${years.value.current}年`, `${years.value.compare}年`, '同比增长率'],
      icon: 'rect',
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: '#606266', fontSize: 12 }
    },
    grid: {
      top: 40,
      right: 60,
      bottom: 50,
      left: 60,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisPointer: { type: 'shadow' },
      axisLine: { lineStyle: { color: '#dcdfe6' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#909399',
        fontSize: 11,
        rotate: categories.length > 8 ? 30 : 0
      }
    },
    yAxis: [
      {
        type: 'value',
        name: `金额 (${props.unit})`,
        nameLocation: 'middle',
        nameGap: 50,
        nameTextStyle: { color: '#909399' },
        splitLine: { lineStyle: { color: '#ebeef5', type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#909399',
          fontSize: 11,
          formatter: (value: number) => formatNumber(value, 0)
        }
      },
      {
        type: 'value',
        name: '增长率 (%)',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: { color: '#909399' },
        splitLine: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#909399',
          fontSize: 11,
          formatter: '{value}%'
        }
      }
    ],
    series: [
      {
        name: `${years.value.current}年`,
        type: 'bar',
        barWidth: '30%',
        barGap: '10%',
        data: currentValues,
        itemStyle: {
          color: colors.currentYear,
          borderRadius: [4, 4, 0, 0]
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          }
        }
      },
      {
        name: `${years.value.compare}年`,
        type: 'bar',
        barWidth: '30%',
        data: compareValues,
        itemStyle: {
          color: colors.compareYear,
          borderRadius: [4, 4, 0, 0]
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          }
        }
      },
      {
        name: '同比增长率',
        type: 'line',
        yAxisIndex: 1,
        data: growthRates,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 2, color: colors.growthLine },
        itemStyle: {
          color: (params) => {
            const rate = growthRates[params.dataIndex as number];
            return getGrowthColor(rate);
          }
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { type: 'dashed', color: '#909399' },
          data: [
            { yAxis: 0, label: { show: true, formatter: '0%', position: 'end' } }
          ]
        }
      }
    ]
  };
};

// Build pie chart options (dual pies)
const buildPieChartOptions = (): EChartsOption => {
  const currentPieData = props.data.map((d, idx) => ({
    name: d.category,
    value: d.currentAmount,
    itemStyle: { color: colors.pieColors[idx % colors.pieColors.length] }
  }));

  const comparePieData = props.data.map((d, idx) => ({
    name: d.category,
    value: d.compareAmount,
    itemStyle: { color: colors.pieColors[idx % colors.pieColors.length] }
  }));

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#ebeef5',
      borderWidth: 1,
      textStyle: { color: '#303133' },
      formatter: (params: { name: string; value: number; percent: number; seriesName: string }) => {
        const item = props.data.find(d => d.category === params.name);
        if (!item) return '';

        const isCurrentYear = params.seriesName.includes(String(years.value.current));
        const ratio = isCurrentYear ? item.currentRatio : item.compareRatio;

        return `
          <div style="font-weight: 600; margin-bottom: 8px;">${params.name}</div>
          <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
            <span>金额: </span>
            <span style="font-weight: 600;">${formatCurrency(params.value)} ${props.unit}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
            <span>占比: </span>
            <span style="font-weight: 600;">${ratio.toFixed(1)}%</span>
          </div>
        `;
      }
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#606266', fontSize: 12 }
    },
    series: [
      {
        name: `${years.value.current}年`,
        type: 'pie',
        center: ['30%', '50%'],
        radius: ['35%', '60%'],
        avoidLabelOverlap: true,
        label: {
          show: true,
          formatter: '{b}\n{d}%',
          fontSize: 11
        },
        labelLine: {
          length: 10,
          length2: 15
        },
        emphasis: {
          label: {
            fontSize: 14,
            fontWeight: 'bold'
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          }
        },
        data: currentPieData
      },
      {
        name: `${years.value.compare}年`,
        type: 'pie',
        center: ['70%', '50%'],
        radius: ['35%', '60%'],
        avoidLabelOverlap: true,
        label: {
          show: true,
          formatter: '{b}\n{d}%',
          fontSize: 11
        },
        labelLine: {
          length: 10,
          length2: 15
        },
        emphasis: {
          label: {
            fontSize: 14,
            fontWeight: 'bold'
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          }
        },
        data: comparePieData
      }
    ],
    title: [
      {
        text: `${years.value.current}年`,
        left: '30%',
        top: '85%',
        textAlign: 'center',
        textStyle: {
          fontSize: 14,
          fontWeight: 600,
          color: '#303133'
        }
      },
      {
        text: `${years.value.compare}年`,
        left: '70%',
        top: '85%',
        textAlign: 'center',
        textStyle: {
          fontSize: 14,
          fontWeight: 600,
          color: '#303133'
        }
      }
    ]
  };
};

// Computed: Chart options based on view mode
const chartOptions = computed<EChartsOption>(() => {
  if (viewMode.value === 'pie') {
    return buildPieChartOptions();
  }
  return buildBarChartOptions();
});

// Initialize chart
function initChart() {
  if (!chartRef.value) return;

  chartInstance.value = echarts.init(chartRef.value, 'cretas');
  chartInstance.value.setOption(chartOptions.value);

  // Click event
  chartInstance.value.on('click', (params) => {
    if (params.componentType === 'series' && params.dataIndex !== undefined) {
      const dataPoint = props.data[params.dataIndex as number];
      if (dataPoint) {
        emit('categoryClick', dataPoint);
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

// Handle view mode change
function onViewModeChange(mode: ChartViewMode) {
  viewMode.value = mode;
  emit('viewModeChange', mode);
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
watch(viewMode, updateChart);
watch(chartOptions, updateChart, { deep: true });

// Expose methods
defineExpose({
  resize: handleResize,
  getInstance: () => chartInstance.value,
  setViewMode: onViewModeChange
});
</script>

<template>
  <div v-loading="loading" class="category-structure-chart">
    <!-- Header with title and view mode toggle -->
    <div class="chart-header">
      <h3 v-if="title">{{ title }}</h3>
      <el-button-group size="small">
        <el-button
          :type="viewMode === 'bar' ? 'primary' : 'default'"
          @click="onViewModeChange('bar')"
        >
          <el-icon><i class="el-icon-data-analysis" /></el-icon>
          柱状图
        </el-button>
        <el-button
          :type="viewMode === 'pie' ? 'primary' : 'default'"
          @click="onViewModeChange('pie')"
        >
          <el-icon><i class="el-icon-pie-chart" /></el-icon>
          饼图
        </el-button>
      </el-button-group>
    </div>

    <!-- KPI Summary Cards -->
    <div class="kpi-cards-row">
      <!-- Compare Year Total -->
      <div class="kpi-card">
        <div class="kpi-title">{{ years.compare }}年总额</div>
        <div class="kpi-value">
          {{ formatNumber(kpiData.compareTotal) }}
          <span class="kpi-unit">{{ unit }}</span>
        </div>
      </div>

      <!-- Current Year Total -->
      <div class="kpi-card highlight">
        <div class="kpi-title">{{ years.current }}年总额</div>
        <div class="kpi-value primary">
          {{ formatNumber(kpiData.currentTotal) }}
          <span class="kpi-unit">{{ unit }}</span>
        </div>
      </div>

      <!-- YoY Growth Amount -->
      <div class="kpi-card">
        <div class="kpi-title">同比增长额</div>
        <div
          class="kpi-value"
          :class="getGrowthClass(growthAmount)"
        >
          <span class="trend-arrow">
            <template v-if="growthAmount > 0">&#8593;</template>
            <template v-else-if="growthAmount < 0">&#8595;</template>
            <template v-else>&#8594;</template>
          </span>
          {{ growthAmount > 0 ? '+' : '' }}{{ formatNumber(growthAmount) }}
          <span class="kpi-unit">{{ unit }}</span>
        </div>
      </div>

      <!-- YoY Growth Rate -->
      <div class="kpi-card">
        <div class="kpi-title">同比增长率</div>
        <div
          class="kpi-value"
          :class="getGrowthClass(kpiData.totalYoyGrowthRate)"
        >
          <span class="trend-arrow">
            <template v-if="kpiData.totalYoyGrowthRate > 0">&#8593;</template>
            <template v-else-if="kpiData.totalYoyGrowthRate < 0">&#8595;</template>
            <template v-else>&#8594;</template>
          </span>
          {{ kpiData.totalYoyGrowthRate > 0 ? '+' : '' }}{{ kpiData.totalYoyGrowthRate.toFixed(1) }}
          <span class="kpi-unit">%</span>
        </div>
      </div>
    </div>

    <!-- Chart Container -->
    <div ref="chartRef" :style="{ width: '100%', height: height }"></div>

    <!-- Detailed Table -->
    <div v-if="showTable" class="detail-table">
      <el-table :data="data" stripe size="small" style="width: 100%">
        <el-table-column prop="category" label="品类" min-width="120" fixed />
        <el-table-column :label="`${years.compare}年`" align="right" min-width="120">
          <template #default="{ row }">
            <div class="table-cell">
              <span class="amount">{{ formatCurrency(row.compareAmount) }}</span>
              <span class="ratio">({{ row.compareRatio.toFixed(1) }}%)</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="`${years.current}年`" align="right" min-width="120">
          <template #default="{ row }">
            <div class="table-cell">
              <span class="amount">{{ formatCurrency(row.currentAmount) }}</span>
              <span class="ratio">({{ row.currentRatio.toFixed(1) }}%)</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="同比增长率" align="right" min-width="100">
          <template #default="{ row }">
            <span :class="['growth-rate', getGrowthClass(row.yoyGrowthRate)]">
              {{ row.yoyGrowthRate > 0 ? '+' : '' }}{{ row.yoyGrowthRate.toFixed(1) }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column label="占比变化" align="right" min-width="100">
          <template #default="{ row }">
            <span :class="['ratio-change', getGrowthClass(row.ratioChange)]">
              {{ row.ratioChange > 0 ? '+' : '' }}{{ row.ratioChange.toFixed(1) }}pp
            </span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.category-structure-chart {
  width: 100%;
  background: #fff;
  border-radius: var(--radius-md);
  padding: 20px;

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }
  }

  .kpi-cards-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 20px;

    .kpi-card {
      padding: 16px;
      background: #f8f9fa;
      border-radius: var(--radius-md);
      border: 1px solid #ebeef5;
      transition: all 0.2s ease;

      &.highlight {
        background: linear-gradient(135deg, #ecf5ff 0%, #f0f9eb 100%);
        border-color: #b3d8ff;
      }

      &:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
      }

      .kpi-title {
        font-size: 12px;
        color: var(--color-text-secondary);
        margin-bottom: 8px;
        font-weight: 500;
      }

      .kpi-value {
        font-size: var(--font-size-xl);
        font-weight: 700;
        color: #303133;
        display: flex;
        align-items: baseline;
        gap: 4px;
        font-variant-numeric: tabular-nums;

        &.primary {
          color: #409eff;
        }

        &.positive {
          color: #67c23a;
        }

        &.negative {
          color: #f56c6c;
        }

        &.neutral {
          color: var(--color-text-secondary);
        }

        .trend-arrow {
          font-size: 18px;
          font-weight: bold;
          margin-right: 2px;
        }

        .kpi-unit {
          font-size: 12px;
          font-weight: 400;
          color: var(--color-text-secondary);
          margin-left: 2px;
        }
      }
    }
  }

  .detail-table {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #ebeef5;

    .table-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .amount {
        font-weight: 500;
        color: #303133;
      }

      .ratio {
        font-size: 12px;
        color: var(--color-text-secondary);
      }
    }

    .growth-rate,
    .ratio-change {
      font-weight: 600;

      &.positive {
        color: #67c23a;
      }

      &.negative {
        color: #f56c6c;
      }

      &.neutral {
        color: var(--color-text-secondary);
      }
    }
  }
}

// Responsive adjustments
@media (max-width: 1200px) {
  .category-structure-chart {
    .kpi-cards-row {
      grid-template-columns: repeat(2, 1fr);
    }
  }
}

@media (max-width: 768px) {
  .category-structure-chart {
    .kpi-cards-row {
      grid-template-columns: 1fr;
    }

    .chart-header {
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;
    }
  }
}
</style>
