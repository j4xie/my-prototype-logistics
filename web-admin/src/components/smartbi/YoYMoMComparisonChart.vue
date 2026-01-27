<script setup lang="ts">
/**
 * SmartBI YoYMoMComparisonChart - Year-over-Year & Month-over-Month Comparison Chart
 * Features:
 * - Top KPI cards row (last year cumulative, current year cumulative, YoY growth amount, YoY growth rate)
 * - Monthly bar chart (current period vs same period last year)
 * - MoM growth rate line chart
 * - Quarter YoY data annotations
 * - Toggle between YoY and MoM views
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import * as echarts from 'echarts';
import type { EChartsOption, ECharts } from 'echarts';

// Types
export interface ComparisonData {
  /** Period (month) - e.g., '1月', '2月', 'Jan', 'Feb' */
  period: string;
  /** Current period value */
  current: number;
  /** Same period last year */
  lastYearSame: number;
  /** Last period value (for MoM calculation) */
  lastPeriod?: number;
  /** Year-over-Year growth rate (%) */
  yoyGrowth: number;
  /** Month-over-Month growth rate (%) */
  momGrowth?: number;
  /** Optional: Quarter identifier for grouping */
  quarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
}

export type ViewMode = 'yoy' | 'mom' | 'both';

interface Props {
  title?: string;
  data: ComparisonData[];
  /** Metric name (e.g., "Sales", "Revenue") */
  metric?: string;
  /** Unit (e.g., "万元", "件") */
  unit?: string;
  height?: number;
  /** Show data zoom slider */
  showDataZoom?: boolean;
  /** Initial view mode */
  defaultViewMode?: ViewMode;
  /** Show view mode toggle */
  showViewToggle?: boolean;
  /** Positive growth is good (green) or bad (red) */
  positiveIsGood?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  metric: '数值',
  unit: '',
  height: 400,
  showDataZoom: false,
  defaultViewMode: 'yoy',
  showViewToggle: true,
  positiveIsGood: true
});

const emit = defineEmits<{
  (e: 'viewModeChange', mode: ViewMode): void;
  (e: 'dataClick', data: { period: string; dataPoint: ComparisonData }): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);
const viewMode = ref<ViewMode>(props.defaultViewMode);

// Color palette
const colors = {
  currentPeriod: '#409eff',      // Blue - current period
  lastYearSame: '#91cc75',       // Light green - last year same period
  yoyGrowthLine: '#ee6666',      // Red - YoY growth line
  momGrowthLine: '#fac858',      // Yellow - MoM growth line
  positiveGrowth: '#67c23a',     // Green - positive
  negativeGrowth: '#f56c6c',     // Red - negative
  quarterBg: 'rgba(64, 158, 255, 0.05)'
};

// KPI calculations
const kpiData = computed(() => {
  if (!props.data || props.data.length === 0) {
    return {
      lastYearCumulative: 0,
      currentYearCumulative: 0,
      yoyGrowthAmount: 0,
      yoyGrowthRate: 0
    };
  }

  const lastYearCumulative = props.data.reduce((sum, d) => sum + (d.lastYearSame || 0), 0);
  const currentYearCumulative = props.data.reduce((sum, d) => sum + (d.current || 0), 0);
  const yoyGrowthAmount = currentYearCumulative - lastYearCumulative;
  const yoyGrowthRate = lastYearCumulative !== 0
    ? ((currentYearCumulative - lastYearCumulative) / lastYearCumulative) * 100
    : 0;

  return {
    lastYearCumulative,
    currentYearCumulative,
    yoyGrowthAmount,
    yoyGrowthRate
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

// Determine trend direction based on value and positiveIsGood setting
const getTrendDirection = (value: number): 'up' | 'down' | 'flat' => {
  if (value > 0.5) return 'up';
  if (value < -0.5) return 'down';
  return 'flat';
};

// Get trend color (considering positiveIsGood setting)
const getTrendColor = (value: number): string => {
  const isPositive = value > 0;
  if (props.positiveIsGood) {
    return isPositive ? colors.positiveGrowth : colors.negativeGrowth;
  } else {
    return isPositive ? colors.negativeGrowth : colors.positiveGrowth;
  }
};

// Build quarter mark areas
const buildQuarterMarkAreas = () => {
  const quarters: { start: number; end: number; label: string }[] = [];
  let currentQuarter: string | null = null;
  let startIdx = 0;

  props.data.forEach((item, idx) => {
    if (item.quarter && item.quarter !== currentQuarter) {
      if (currentQuarter !== null) {
        quarters.push({
          start: startIdx,
          end: idx - 1,
          label: currentQuarter
        });
      }
      currentQuarter = item.quarter;
      startIdx = idx;
    }
  });

  // Push last quarter
  if (currentQuarter !== null) {
    quarters.push({
      start: startIdx,
      end: props.data.length - 1,
      label: currentQuarter
    });
  }

  if (quarters.length === 0) return undefined;

  return {
    silent: true,
    data: quarters.map((q, idx) => [
      {
        xAxis: props.data[q.start].period,
        itemStyle: {
          color: idx % 2 === 0 ? 'rgba(64, 158, 255, 0.03)' : 'rgba(103, 194, 58, 0.03)'
        }
      },
      { xAxis: props.data[q.end].period }
    ])
  };
};

// Build YoY mark points for significant changes
const buildYoYMarkPoints = () => {
  const significantChanges = props.data.filter(d => Math.abs(d.yoyGrowth) >= 20);

  if (significantChanges.length === 0) return undefined;

  return {
    symbol: 'pin',
    symbolSize: 40,
    label: {
      show: true,
      position: 'top',
      formatter: (params: { data: { value: string } }) => params.data.value,
      fontSize: 10,
      fontWeight: 'bold',
      color: '#fff'
    },
    data: significantChanges.map(d => ({
      value: (d.yoyGrowth > 0 ? '+' : '') + d.yoyGrowth.toFixed(1) + '%',
      coord: [d.period, d.current],
      itemStyle: {
        color: getTrendColor(d.yoyGrowth)
      }
    }))
  };
};

// Chart options
const chartOptions = computed<EChartsOption>(() => {
  const periods = props.data.map(d => d.period);
  const currentValues = props.data.map(d => d.current);
  const lastYearValues = props.data.map(d => d.lastYearSame);
  const yoyGrowthValues = props.data.map(d => d.yoyGrowth);
  const momGrowthValues = props.data.map(d => d.momGrowth ?? null);

  const markAreaConfig = buildQuarterMarkAreas();
  const markPointConfig = buildYoYMarkPoints();

  // Build series based on view mode
  const series: echarts.SeriesOption[] = [];

  // Always show bar chart for current vs last year
  series.push({
    name: `本期${props.metric}`,
    type: 'bar',
    barWidth: '35%',
    barGap: '10%',
    data: currentValues,
    itemStyle: {
      color: colors.currentPeriod,
      borderRadius: [4, 4, 0, 0]
    },
    emphasis: {
      itemStyle: {
        shadowBlur: 10,
        shadowColor: 'rgba(0, 0, 0, 0.2)'
      }
    },
    ...(markAreaConfig ? { markArea: markAreaConfig } : {}),
    ...(viewMode.value === 'yoy' && markPointConfig ? { markPoint: markPointConfig } : {})
  } as echarts.BarSeriesOption);

  series.push({
    name: `去年同期${props.metric}`,
    type: 'bar',
    barWidth: '35%',
    data: lastYearValues,
    itemStyle: {
      color: colors.lastYearSame,
      borderRadius: [4, 4, 0, 0]
    },
    emphasis: {
      itemStyle: {
        shadowBlur: 10,
        shadowColor: 'rgba(0, 0, 0, 0.2)'
      }
    }
  } as echarts.BarSeriesOption);

  // Add growth rate lines based on view mode
  if (viewMode.value === 'yoy' || viewMode.value === 'both') {
    series.push({
      name: '同比增长率',
      type: 'line',
      yAxisIndex: 1,
      data: yoyGrowthValues,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      itemStyle: {
        color: colors.yoyGrowthLine
      },
      lineStyle: {
        width: 2
      },
      emphasis: {
        focus: 'series'
      }
    } as echarts.LineSeriesOption);
  }

  if (viewMode.value === 'mom' || viewMode.value === 'both') {
    series.push({
      name: '环比增长率',
      type: 'line',
      yAxisIndex: 1,
      data: momGrowthValues,
      smooth: true,
      symbol: 'diamond',
      symbolSize: 6,
      itemStyle: {
        color: colors.momGrowthLine
      },
      lineStyle: {
        width: 2,
        type: 'dashed'
      },
      emphasis: {
        focus: 'series'
      }
    } as echarts.LineSeriesOption);
  }

  const options: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        crossStyle: {
          color: '#999'
        }
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#ebeef5',
      borderWidth: 1,
      textStyle: {
        color: '#303133'
      },
      formatter: (params) => {
        if (!Array.isArray(params)) return '';
        const period = params[0]?.axisValue || '';
        const dataPoint = props.data.find(d => d.period === period);

        let html = `<div style="font-weight: 600; margin-bottom: 8px;">${period}</div>`;

        params.forEach((param) => {
          const isGrowthRate = param.seriesName?.includes('增长率');
          const unit = isGrowthRate ? '%' : props.unit;
          const value = param.value !== null && param.value !== undefined
            ? (isGrowthRate ? (param.value as number).toFixed(1) : formatNumber(param.value as number))
            : '-';

          // Determine shape based on series type
          const isLine = param.seriesName?.includes('增长率');
          const shape = isLine ? '50%' : '2px';

          html += `
            <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: ${shape}; background: ${param.color};"></span>
              <span>${param.seriesName}: </span>
              <span style="font-weight: 600;">${value}${unit}</span>
            </div>
          `;
        });

        // Add YoY/MoM analysis
        if (dataPoint) {
          html += '<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #ebeef5; font-size: 12px;">';

          const yoyDiff = dataPoint.current - dataPoint.lastYearSame;
          const yoyColor = getTrendColor(yoyDiff);
          const yoyArrow = yoyDiff > 0 ? '&#8593;' : (yoyDiff < 0 ? '&#8595;' : '&#8594;');

          html += `<div style="color: ${yoyColor};">同比: ${yoyArrow} ${yoyDiff > 0 ? '+' : ''}${formatNumber(yoyDiff)}${props.unit} (${dataPoint.yoyGrowth > 0 ? '+' : ''}${dataPoint.yoyGrowth.toFixed(1)}%)</div>`;

          if (dataPoint.momGrowth !== undefined && dataPoint.lastPeriod !== undefined) {
            const momDiff = dataPoint.current - dataPoint.lastPeriod;
            const momColor = getTrendColor(momDiff);
            const momArrow = momDiff > 0 ? '&#8593;' : (momDiff < 0 ? '&#8595;' : '&#8594;');
            html += `<div style="color: ${momColor};">环比: ${momArrow} ${momDiff > 0 ? '+' : ''}${formatNumber(momDiff)}${props.unit} (${dataPoint.momGrowth > 0 ? '+' : ''}${dataPoint.momGrowth.toFixed(1)}%)</div>`;
          }

          html += '</div>';
        }

        return html;
      }
    },
    legend: {
      bottom: 0,
      icon: 'rect',
      itemWidth: 14,
      itemHeight: 8,
      textStyle: {
        color: '#606266',
        fontSize: 12
      }
    },
    grid: {
      top: 30,
      right: 60,
      bottom: props.showDataZoom ? 80 : 50,
      left: 60,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: periods,
      axisPointer: {
        type: 'shadow'
      },
      axisLine: {
        lineStyle: {
          color: '#dcdfe6'
        }
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#909399',
        fontSize: 11
      }
    },
    yAxis: [
      {
        type: 'value',
        name: props.metric + (props.unit ? ` (${props.unit})` : ''),
        nameLocation: 'middle',
        nameGap: 50,
        nameTextStyle: {
          color: '#909399'
        },
        splitLine: {
          lineStyle: {
            color: '#ebeef5',
            type: 'dashed'
          }
        },
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
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
        nameTextStyle: {
          color: '#909399'
        },
        splitLine: {
          show: false
        },
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          color: '#909399',
          fontSize: 11,
          formatter: '{value}%'
        }
      }
    ],
    series
  };

  // Add data zoom if enabled
  if (props.showDataZoom) {
    options.dataZoom = [
      {
        type: 'slider',
        show: true,
        xAxisIndex: 0,
        start: 0,
        end: 100,
        bottom: 30,
        height: 20,
        borderColor: '#dcdfe6',
        fillerColor: 'rgba(64, 158, 255, 0.2)',
        handleStyle: {
          color: '#409eff'
        }
      },
      {
        type: 'inside',
        xAxisIndex: 0
      }
    ];
  }

  return options;
});

function initChart() {
  if (!chartRef.value) return;

  chartInstance.value = echarts.init(chartRef.value);
  chartInstance.value.setOption(chartOptions.value);

  // Click event
  chartInstance.value.on('click', (params) => {
    if (params.componentType === 'series' && params.dataIndex !== undefined) {
      const dataPoint = props.data[params.dataIndex as number];
      if (dataPoint) {
        emit('dataClick', {
          period: params.name as string,
          dataPoint
        });
      }
    }
  });
}

function updateChart() {
  if (chartInstance.value) {
    chartInstance.value.setOption(chartOptions.value, true);
  }
}

function handleResize() {
  chartInstance.value?.resize();
}

function onViewModeChange(mode: ViewMode) {
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
  <div class="yoy-mom-chart">
    <!-- Header with title and view mode toggle -->
    <div v-if="title || showViewToggle" class="chart-header">
      <h3 v-if="title">{{ title }}</h3>
      <el-radio-group
        v-if="showViewToggle"
        v-model="viewMode"
        size="small"
        @change="onViewModeChange"
      >
        <el-radio-button value="yoy">同比</el-radio-button>
        <el-radio-button value="mom">环比</el-radio-button>
        <el-radio-button value="both">综合</el-radio-button>
      </el-radio-group>
    </div>

    <!-- KPI Cards Row -->
    <div class="kpi-cards-row">
      <!-- Last Year Cumulative -->
      <div class="kpi-card">
        <div class="kpi-title">上年累计</div>
        <div class="kpi-value">
          {{ formatNumber(kpiData.lastYearCumulative) }}
          <span class="kpi-unit">{{ unit }}</span>
        </div>
      </div>

      <!-- Current Year Cumulative -->
      <div class="kpi-card highlight">
        <div class="kpi-title">本年累计</div>
        <div class="kpi-value primary">
          {{ formatNumber(kpiData.currentYearCumulative) }}
          <span class="kpi-unit">{{ unit }}</span>
        </div>
      </div>

      <!-- YoY Growth Amount -->
      <div class="kpi-card">
        <div class="kpi-title">同比增长额</div>
        <div
          class="kpi-value"
          :class="{
            positive: kpiData.yoyGrowthAmount > 0,
            negative: kpiData.yoyGrowthAmount < 0
          }"
        >
          <span class="trend-arrow">
            <template v-if="kpiData.yoyGrowthAmount > 0">&#8593;</template>
            <template v-else-if="kpiData.yoyGrowthAmount < 0">&#8595;</template>
            <template v-else>&#8594;</template>
          </span>
          {{ kpiData.yoyGrowthAmount > 0 ? '+' : '' }}{{ formatNumber(kpiData.yoyGrowthAmount) }}
          <span class="kpi-unit">{{ unit }}</span>
        </div>
      </div>

      <!-- YoY Growth Rate -->
      <div class="kpi-card">
        <div class="kpi-title">同比增长率</div>
        <div
          class="kpi-value"
          :class="{
            positive: kpiData.yoyGrowthRate > 0,
            negative: kpiData.yoyGrowthRate < 0
          }"
        >
          <span class="trend-arrow">
            <template v-if="kpiData.yoyGrowthRate > 0">&#8593;</template>
            <template v-else-if="kpiData.yoyGrowthRate < 0">&#8595;</template>
            <template v-else>&#8594;</template>
          </span>
          {{ kpiData.yoyGrowthRate > 0 ? '+' : '' }}{{ kpiData.yoyGrowthRate.toFixed(1) }}
          <span class="kpi-unit">%</span>
        </div>
      </div>
    </div>

    <!-- Chart -->
    <div ref="chartRef" :style="{ width: '100%', height: height + 'px' }"></div>
  </div>
</template>

<style lang="scss" scoped>
.yoy-mom-chart {
  width: 100%;

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
  }

  .kpi-cards-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 20px;

    .kpi-card {
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #ebeef5;
      transition: all 0.2s ease;

      &.highlight {
        background: linear-gradient(135deg, #ecf5ff 0%, #f0f9eb 100%);
        border-color: #b3d8ff;
      }

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }

      .kpi-title {
        font-size: 12px;
        color: #909399;
        margin-bottom: 8px;
        font-weight: 500;
      }

      .kpi-value {
        font-size: 24px;
        font-weight: 700;
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

        .trend-arrow {
          font-size: 18px;
          font-weight: bold;
          margin-right: 2px;
        }

        .kpi-unit {
          font-size: 12px;
          font-weight: 400;
          color: #909399;
          margin-left: 2px;
        }
      }
    }
  }
}

// Responsive adjustments
@media (max-width: 1200px) {
  .yoy-mom-chart {
    .kpi-cards-row {
      grid-template-columns: repeat(2, 1fr);
    }
  }
}

@media (max-width: 768px) {
  .yoy-mom-chart {
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
