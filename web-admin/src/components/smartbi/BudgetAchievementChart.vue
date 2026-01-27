<script setup lang="ts">
/**
 * SmartBI BudgetAchievementChart - Budget Achievement Analysis Chart
 * Features: KPI cards, quarterly timeline, monthly status indicators, grouped bar chart
 * Style: FanSoft-inspired budget completion dashboard
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import * as echarts from 'echarts';
import type { EChartsOption, ECharts } from 'echarts';
import KPICard from './KPICard.vue';
import type { TrendDirection, StatusType } from './KPICard.vue';

// Types
export interface BudgetData {
  period: string;           // Month/Quarter (e.g., '1月', '2月', 'Q1')
  budget: number;           // Budget amount
  actual: number;           // Actual amount
  achievementRate: number;  // Achievement rate (0-100)
  yoyGrowth?: number;       // Year-over-year growth rate
}

interface Props {
  title?: string;
  data: BudgetData[];
  yearTarget?: number;      // Annual target
  yearActual?: number;      // Annual actual
  height?: number;
  showKPICards?: boolean;
  showTimeline?: boolean;
  showStatusIndicators?: boolean;
  currency?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '预算达成分析',
  height: 400,
  showKPICards: true,
  showTimeline: true,
  showStatusIndicators: true,
  currency: '万元'
});

const emit = defineEmits<{
  (e: 'periodClick', data: BudgetData): void;
  (e: 'kpiClick', kpi: string): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);

// Color configuration
const colors = {
  budget: '#409eff',       // Blue for budget/target
  actual: '#67c23a',       // Green for actual
  overAchieve: '#67c23a',  // Green for >100%
  onTrack: '#e6a23c',      // Yellow for 80-100%
  underAchieve: '#f56c6c', // Red for <80%
  quarterBg: [
    'rgba(64, 158, 255, 0.05)',   // Q1
    'rgba(103, 194, 58, 0.05)',   // Q2
    'rgba(230, 162, 60, 0.05)',   // Q3
    'rgba(245, 108, 108, 0.05)'   // Q4
  ]
};

// Computed: Year achievement rate
const yearAchievementRate = computed(() => {
  if (!props.yearTarget || !props.yearActual) return 0;
  return Math.round((props.yearActual / props.yearTarget) * 100);
});

// Computed: Year-over-year growth (average of all periods)
const averageYoyGrowth = computed(() => {
  const validData = props.data.filter(d => d.yoyGrowth !== undefined);
  if (validData.length === 0) return 0;
  const total = validData.reduce((sum, d) => sum + (d.yoyGrowth || 0), 0);
  return Math.round(total / validData.length * 10) / 10;
});

// Computed: KPI card data
const kpiData = computed(() => {
  const rate = yearAchievementRate.value;
  let status: StatusType = 'success';
  if (rate < 80) status = 'danger';
  else if (rate < 100) status = 'warning';

  const trend: TrendDirection = averageYoyGrowth.value > 0 ? 'up' :
                                averageYoyGrowth.value < 0 ? 'down' : 'flat';

  return {
    yearTarget: {
      title: '年度目标',
      value: props.yearTarget || 0,
      unit: props.currency,
      status: 'info' as StatusType
    },
    yearActual: {
      title: '实际完成',
      value: props.yearActual || 0,
      unit: props.currency,
      status: status
    },
    achievementRate: {
      title: '达成率',
      value: rate,
      unit: '%',
      status: status
    },
    yoyGrowth: {
      title: '同比增长',
      value: averageYoyGrowth.value,
      unit: '%',
      trend: trend,
      trendValue: Math.abs(averageYoyGrowth.value),
      status: trend === 'up' ? 'success' : trend === 'down' ? 'danger' : 'info'
    }
  };
});

// Computed: Quarterly data grouping
const quarterlyData = computed(() => {
  const quarters: { name: string; achievementRate: number; months: BudgetData[] }[] = [];
  const monthsPerQuarter = Math.ceil(props.data.length / 4);

  for (let i = 0; i < 4; i++) {
    const start = i * monthsPerQuarter;
    const end = Math.min(start + monthsPerQuarter, props.data.length);
    const monthsInQuarter = props.data.slice(start, end);

    if (monthsInQuarter.length > 0) {
      const totalBudget = monthsInQuarter.reduce((sum, m) => sum + m.budget, 0);
      const totalActual = monthsInQuarter.reduce((sum, m) => sum + m.actual, 0);
      const rate = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;

      quarters.push({
        name: `Q${i + 1}`,
        achievementRate: rate,
        months: monthsInQuarter
      });
    }
  }

  return quarters;
});

// Get status color based on achievement rate
function getStatusColor(rate: number): string {
  if (rate >= 100) return colors.overAchieve;
  if (rate >= 80) return colors.onTrack;
  return colors.underAchieve;
}

// Get status class based on achievement rate
function getStatusClass(rate: number): string {
  if (rate >= 100) return 'status-success';
  if (rate >= 80) return 'status-warning';
  return 'status-danger';
}

// Build chart options
const chartOptions = computed<EChartsOption>(() => {
  const categories = props.data.map(d => d.period);
  const budgetData = props.data.map(d => d.budget);
  const actualData = props.data.map(d => d.actual);
  const achievementRates = props.data.map(d => d.achievementRate);

  // Build markArea for quarterly backgrounds
  const markAreaData: Array<Array<{ xAxis: string; itemStyle?: { color: string } }>> = [];
  let startIdx = 0;
  quarterlyData.value.forEach((quarter, qi) => {
    const endIdx = startIdx + quarter.months.length - 1;
    if (quarter.months.length > 0) {
      markAreaData.push([
        {
          xAxis: categories[startIdx],
          itemStyle: { color: colors.quarterBg[qi % 4] }
        },
        { xAxis: categories[endIdx] }
      ]);
    }
    startIdx = endIdx + 1;
  });

  const options: EChartsOption = {
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

        const rateColor = getStatusColor(item.achievementRate);
        let html = `<div style="font-weight: 600; margin-bottom: 8px;">${item.period}</div>`;
        html += `
          <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${colors.budget};"></span>
            <span>预算: </span>
            <span style="font-weight: 600;">${item.budget} ${props.currency}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${colors.actual};"></span>
            <span>实际: </span>
            <span style="font-weight: 600;">${item.actual} ${props.currency}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${rateColor};"></span>
            <span>达成率: </span>
            <span style="font-weight: 600; color: ${rateColor};">${item.achievementRate}%</span>
          </div>
        `;
        if (item.yoyGrowth !== undefined) {
          const yoyColor = item.yoyGrowth >= 0 ? colors.overAchieve : colors.underAchieve;
          const arrow = item.yoyGrowth >= 0 ? '↑' : '↓';
          html += `
            <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
              <span style="color: ${yoyColor};">${arrow}</span>
              <span>同比: </span>
              <span style="font-weight: 600; color: ${yoyColor};">${item.yoyGrowth}%</span>
            </div>
          `;
        }
        return html;
      }
    },
    legend: {
      bottom: 0,
      data: ['预算', '实际', '达成率'],
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
      axisLabel: { color: '#909399', fontSize: 11 }
    },
    yAxis: [
      {
        type: 'value',
        name: `金额 (${props.currency})`,
        nameLocation: 'middle',
        nameGap: 45,
        nameTextStyle: { color: '#909399' },
        splitLine: { lineStyle: { color: '#ebeef5', type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#909399', fontSize: 11 }
      },
      {
        type: 'value',
        name: '达成率 (%)',
        nameLocation: 'middle',
        nameGap: 45,
        nameTextStyle: { color: '#909399' },
        min: 0,
        max: 120,
        splitLine: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#909399', fontSize: 11 }
      }
    ],
    series: [
      {
        name: '预算',
        type: 'bar',
        data: budgetData,
        barGap: '0%',
        itemStyle: {
          color: colors.budget,
          borderRadius: [4, 4, 0, 0]
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          }
        },
        markArea: {
          silent: true,
          data: markAreaData as echarts.MarkAreaComponentOption['data']
        }
      },
      {
        name: '实际',
        type: 'bar',
        data: actualData,
        barGap: '0%',
        itemStyle: {
          color: colors.actual,
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
        name: '达成率',
        type: 'line',
        yAxisIndex: 1,
        data: achievementRates,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 2, color: '#e6a23c' },
        itemStyle: {
          color: (params) => {
            const rate = achievementRates[params.dataIndex as number];
            return getStatusColor(rate);
          }
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { type: 'dashed', color: '#f56c6c' },
          data: [
            { yAxis: 80, label: { show: true, formatter: '80%', position: 'end' } },
            { yAxis: 100, label: { show: true, formatter: '100%', position: 'end' }, lineStyle: { color: '#67c23a' } }
          ]
        }
      }
    ]
  };

  return options;
});

// Initialize chart
function initChart() {
  if (!chartRef.value) return;

  chartInstance.value = echarts.init(chartRef.value);
  chartInstance.value.setOption(chartOptions.value);

  // Click event
  chartInstance.value.on('click', (params) => {
    if (params.componentType === 'series' && params.dataIndex !== undefined) {
      const dataPoint = props.data[params.dataIndex as number];
      if (dataPoint) {
        emit('periodClick', dataPoint);
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

// Handle KPI click
function handleKPIClick(kpiName: string) {
  emit('kpiClick', kpiName);
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
  getInstance: () => chartInstance.value
});
</script>

<template>
  <div class="budget-achievement-chart">
    <!-- Title -->
    <div v-if="title" class="chart-header">
      <h3>{{ title }}</h3>
    </div>

    <!-- KPI Cards Row -->
    <div v-if="showKPICards" class="kpi-row">
      <KPICard
        v-bind="kpiData.yearTarget"
        format="currency"
        clickable
        @click="handleKPIClick('yearTarget')"
      />
      <KPICard
        v-bind="kpiData.yearActual"
        format="currency"
        clickable
        @click="handleKPIClick('yearActual')"
      />
      <KPICard
        v-bind="kpiData.achievementRate"
        format="percent"
        :show-progress="true"
        :target-value="100"
        clickable
        @click="handleKPIClick('achievementRate')"
      />
      <KPICard
        v-bind="kpiData.yoyGrowth"
        format="percent"
        :prefix="averageYoyGrowth >= 0 ? '+' : ''"
        clickable
        @click="handleKPIClick('yoyGrowth')"
      />
    </div>

    <!-- Quarterly Timeline -->
    <div v-if="showTimeline && quarterlyData.length > 0" class="quarterly-timeline">
      <div
        v-for="quarter in quarterlyData"
        :key="quarter.name"
        class="quarter-item"
      >
        <div class="quarter-name">{{ quarter.name }}</div>
        <div
          class="quarter-rate"
          :class="getStatusClass(quarter.achievementRate)"
        >
          {{ quarter.achievementRate }}%
        </div>
      </div>
    </div>

    <!-- Monthly Status Indicators -->
    <div v-if="showStatusIndicators" class="status-indicators">
      <div class="indicator-label">月度状态:</div>
      <div class="indicator-dots">
        <div
          v-for="item in data"
          :key="item.period"
          class="indicator-dot"
          :class="getStatusClass(item.achievementRate)"
          :title="`${item.period}: ${item.achievementRate}%`"
        >
          <span class="dot-label">{{ item.period }}</span>
        </div>
      </div>
      <div class="indicator-legend">
        <span class="legend-item">
          <span class="legend-dot status-success"></span>
          <span>&ge;100%</span>
        </span>
        <span class="legend-item">
          <span class="legend-dot status-warning"></span>
          <span>80-99%</span>
        </span>
        <span class="legend-item">
          <span class="legend-dot status-danger"></span>
          <span>&lt;80%</span>
        </span>
      </div>
    </div>

    <!-- ECharts Container -->
    <div ref="chartRef" :style="{ width: '100%', height: height + 'px' }"></div>
  </div>
</template>

<style lang="scss" scoped>
.budget-achievement-chart {
  width: 100%;
  background: #fff;
  border-radius: 8px;
  padding: 20px;

  .chart-header {
    margin-bottom: 20px;

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }
  }

  .kpi-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;

    @media (max-width: 1200px) {
      grid-template-columns: repeat(2, 1fr);
    }

    @media (max-width: 600px) {
      grid-template-columns: 1fr;
    }
  }

  .quarterly-timeline {
    display: flex;
    justify-content: space-around;
    padding: 16px 20px;
    margin-bottom: 20px;
    background: linear-gradient(90deg,
      rgba(64, 158, 255, 0.08) 0%,
      rgba(64, 158, 255, 0.08) 25%,
      rgba(103, 194, 58, 0.08) 25%,
      rgba(103, 194, 58, 0.08) 50%,
      rgba(230, 162, 60, 0.08) 50%,
      rgba(230, 162, 60, 0.08) 75%,
      rgba(245, 108, 108, 0.08) 75%,
      rgba(245, 108, 108, 0.08) 100%
    );
    border-radius: 8px;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 10%;
      right: 10%;
      height: 2px;
      background: #dcdfe6;
      z-index: 0;
    }

    .quarter-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      z-index: 1;

      .quarter-name {
        font-size: 14px;
        font-weight: 600;
        color: #606266;
        background: #fff;
        padding: 4px 12px;
        border-radius: 12px;
        border: 1px solid #ebeef5;
      }

      .quarter-rate {
        font-size: 16px;
        font-weight: 700;
        padding: 6px 14px;
        border-radius: 16px;
        background: #fff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

        &.status-success {
          color: #67c23a;
          border: 2px solid #67c23a;
        }

        &.status-warning {
          color: #e6a23c;
          border: 2px solid #e6a23c;
        }

        &.status-danger {
          color: #f56c6c;
          border: 2px solid #f56c6c;
        }
      }
    }
  }

  .status-indicators {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    background: #f8f9fa;
    border-radius: 6px;
    margin-bottom: 16px;
    flex-wrap: wrap;

    .indicator-label {
      font-size: 13px;
      font-weight: 500;
      color: #606266;
      white-space: nowrap;
    }

    .indicator-dots {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      flex: 1;

      .indicator-dot {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s;
        position: relative;

        &:hover {
          transform: scale(1.2);

          .dot-label {
            opacity: 1;
            visibility: visible;
          }
        }

        &.status-success {
          background: #67c23a;
        }

        &.status-warning {
          background: #e6a23c;
        }

        &.status-danger {
          background: #f56c6c;
        }

        .dot-label {
          position: absolute;
          bottom: -22px;
          font-size: 10px;
          color: #909399;
          white-space: nowrap;
          opacity: 0;
          visibility: hidden;
          transition: all 0.2s;
        }
      }
    }

    .indicator-legend {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: #909399;

      .legend-item {
        display: flex;
        align-items: center;
        gap: 4px;

        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;

          &.status-success {
            background: #67c23a;
          }

          &.status-warning {
            background: #e6a23c;
          }

          &.status-danger {
            background: #f56c6c;
          }
        }
      }
    }
  }
}
</style>
