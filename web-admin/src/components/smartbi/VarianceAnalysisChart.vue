<script setup lang="ts">
/**
 * SmartBI VarianceAnalysisChart - Zebra BI-level Variance Analysis
 * Features: Budget vs Actual bars, variance labels, cumulative line, KPI row,
 *           integrated data table with conditional formatting, quarter markArea
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import echarts from '@/utils/echarts';
import type { EChartsOption, ECharts } from 'echarts';
import { processEChartsOptions } from '@/utils/echarts-fmt';

// Types
export interface VarianceData {
  period: string;
  budget: number;
  actual: number;
  label?: string;
}

interface Props {
  title?: string;
  data: VarianceData[];
  height?: string;
  loading?: boolean;
  showTable?: boolean;
  showCumulative?: boolean;
  unit?: string;
  positiveLabel?: string;
  negativeLabel?: string;
  echartsOption?: Record<string, unknown>;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: '600px',
  loading: false,
  showTable: true,
  showCumulative: true,
  unit: '万元',
  positiveLabel: '超额完成',
  negativeLabel: '未达标',
});

const emit = defineEmits<{
  (e: 'periodClick', data: VarianceData): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);
let resizeObserver: ResizeObserver | null = null;
let rafId = 0;

function formatValue(v: number): string {
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(1) + '亿';
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + '千';
  return v.toFixed(0);
}

function formatPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

// KPI summary
const kpiSummary = computed(() => {
  if (!props.data.length) return { totalBudget: 0, totalActual: 0, totalVariance: 0, achievementRate: 0 };
  const totalBudget = props.data.reduce((s, d) => s + d.budget, 0);
  const totalActual = props.data.reduce((s, d) => s + d.actual, 0);
  const totalVariance = totalActual - totalBudget;
  const achievementRate = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
  return { totalBudget, totalActual, totalVariance, achievementRate };
});

// Computed per-period metrics
const periodMetrics = computed(() =>
  props.data.map((d, i) => {
    const variance = d.actual - d.budget;
    const variancePct = d.budget !== 0 ? (variance / Math.abs(d.budget)) * 100 : 0;
    const achievementRate = d.budget !== 0 ? (d.actual / d.budget) * 100 : 0;
    // Cumulative variance YTD
    const cumulativeVariance = props.data
      .slice(0, i + 1)
      .reduce((s, x) => s + (x.actual - x.budget), 0);
    return { variance, variancePct, achievementRate, cumulativeVariance };
  })
);

// Quarter grouping for markArea
const quarterMarkAreas = computed(() => {
  const areas: Array<[Record<string, unknown>, Record<string, unknown>]> = [];
  let qStart = 0;
  props.data.forEach((d, i) => {
    const period = d.period;
    // Detect quarter boundaries by month number
    const monthMatch = period.match(/(\d+)月?$/);
    const month = monthMatch ? parseInt(monthMatch[1]) : i + 1;
    const quarter = Math.ceil(month / 3);
    if (i === 0) {
      qStart = i;
    } else {
      const prevMonth = (() => {
        const pm = props.data[i - 1].period.match(/(\d+)月?$/);
        return pm ? parseInt(pm[1]) : i;
      })();
      const prevQ = Math.ceil(prevMonth / 3);
      if (quarter !== prevQ) {
        if ((qStart / 2) % 1 !== 0) {
          areas.push([{ xAxis: props.data[qStart].period }, { xAxis: props.data[i - 1].period }]);
        }
        qStart = i;
      }
    }
  });
  // Last quarter
  if (props.data.length > 0) {
    const lastIdx = props.data.length - 1;
    if ((qStart / 1) % 2 === 1) {
      areas.push([{ xAxis: props.data[qStart].period }, { xAxis: props.data[lastIdx].period }]);
    }
  }
  return areas;
});

const chartOptions = computed<EChartsOption>(() => {
  if (props.echartsOption && Object.keys(props.echartsOption).length > 0) {
    return processEChartsOptions(props.echartsOption) as EChartsOption;
  }

  const periods = props.data.map((d) => d.period);
  const budgetData = props.data.map((d) => d.budget);
  const actualData = props.data.map((d, i) => ({
    value: d.actual,
    itemStyle: {
      color: periodMetrics.value[i].variance >= 0 ? '#36B37E' : '#FF5630',
      borderRadius: [3, 3, 0, 0],
    },
  }));
  const cumulativeData = periodMetrics.value.map((m) => m.cumulativeVariance);

  // Build variance label data for custom label series
  const varianceLabelData = props.data.map((d, i) => {
    const { variance, variancePct } = periodMetrics.value[i];
    const isPos = variance >= 0;
    return {
      value: Math.max(d.actual, d.budget) + Math.abs(d.budget) * 0.04,
      label: {
        show: true,
        position: 'top',
        formatter: () => {
          const arrow = isPos ? '▲' : '▼';
          const absV = formatValue(Math.abs(variance));
          const pctStr = formatPct(variancePct);
          return `{arrow|${arrow}${absV}${props.unit}}\n{pct|(${pctStr})}`;
        },
        rich: {
          arrow: {
            fontSize: 11,
            fontWeight: 700,
            color: periodMetrics.value[i].variance >= 0 ? '#36B37E' : '#FF5630',
            lineHeight: 16,
          },
          pct: {
            fontSize: 10,
            color: '#909399',
            lineHeight: 14,
          },
        },
      },
    };
  });

  const options: EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255,255,255,0.97)',
      borderColor: '#ebeef5',
      borderWidth: 1,
      textStyle: { color: '#303133', fontSize: 13 },
      formatter: (params: unknown) => {
        if (!Array.isArray(params)) return '';
        const periodIndex = (params[0] as { dataIndex: number }).dataIndex;
        const d = props.data[periodIndex];
        const m = periodMetrics.value[periodIndex];
        if (!d || !m) return '';
        const isPos = m.variance >= 0;
        return `
          <div style="font-weight:700;font-size:14px;margin-bottom:8px;">${d.period}</div>
          <div style="line-height:1.8;font-size:12px;">
            <span style="color:#C0C4CC;">■</span> <span style="color:#909399;">预算：</span><b>${formatValue(d.budget)}${props.unit}</b><br/>
            <span style="color:${isPos ? '#36B37E' : '#FF5630'};">■</span> <span style="color:#909399;">实际：</span><b>${formatValue(d.actual)}${props.unit}</b><br/>
            <span style="color:#909399;">差异：</span><b style="color:${isPos ? '#36B37E' : '#FF5630'}">${isPos ? '+' : ''}${formatValue(m.variance)}${props.unit}</b><br/>
            <span style="color:#909399;">达成率：</span><b style="color:${m.achievementRate >= 100 ? '#36B37E' : '#FF5630'}">${m.achievementRate.toFixed(1)}%</b><br/>
            <span style="color:#909399;">累计差异：</span><b style="color:${m.cumulativeVariance >= 0 ? '#36B37E' : '#FF5630'}">${isPos ? '+' : ''}${formatValue(m.cumulativeVariance)}${props.unit}</b>
          </div>`;
      },
    },
    legend: {
      top: 6,
      right: 10,
      data: [
        { name: '预算', icon: 'rect', itemStyle: { color: '#C0C4CC' } },
        { name: '实际', icon: 'rect', itemStyle: { color: '#36B37E' } },
        ...(props.showCumulative ? [{ name: '累计差异', icon: 'line', itemStyle: { color: '#1B65A8' } }] : []),
      ],
      textStyle: { color: '#606266', fontSize: 11 },
    },
    grid: {
      top: 44,
      left: 16,
      right: props.showCumulative ? 56 : 20,
      bottom: 24,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: periods,
      axisLine: { lineStyle: { color: '#dcdfe6' } },
      axisTick: { show: false },
      axisLabel: { color: '#909399', fontSize: 11 },
    },
    yAxis: [
      {
        type: 'value',
        name: `(${props.unit})`,
        nameTextStyle: { color: '#909399', fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#909399',
          fontSize: 10,
          formatter: (v: number) => formatValue(v),
        },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      ...(props.showCumulative
        ? [
            {
              type: 'value' as const,
              name: '累计',
              nameTextStyle: { color: '#1B65A8', fontSize: 11 },
              axisLine: { show: false },
              axisTick: { show: false },
              axisLabel: {
                color: '#1B65A8',
                fontSize: 10,
                formatter: (v: number) => formatValue(v),
              },
              splitLine: { show: false },
            },
          ]
        : []),
    ],
    series: [
      // Budget reference bars (gray, thin)
      {
        name: '预算',
        type: 'bar',
        barWidth: '30%',
        barGap: '10%',
        data: budgetData.map((v) => ({
          value: v,
          itemStyle: {
            color: '#C0C4CC',
            borderRadius: [3, 3, 0, 0],
          },
        })),
        emphasis: { itemStyle: { opacity: 0.85 } },
        markArea:
          quarterMarkAreas.value.length > 0
            ? {
                silent: true,
                data: quarterMarkAreas.value,
                itemStyle: { color: 'rgba(0,0,0,0.02)' },
              }
            : undefined,
      },
      // Actual bars (colored by variance)
      {
        name: '实际',
        type: 'bar',
        barWidth: '30%',
        data: actualData,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.2)',
          },
        },
      },
      // Invisible bar to carry variance labels on top
      {
        type: 'bar',
        barWidth: '30%',
        data: varianceLabelData,
        itemStyle: { color: 'transparent' },
        tooltip: { show: false },
        stack: undefined,
        z: 3,
        silent: true,
      },
      // Cumulative variance line
      ...(props.showCumulative
        ? [
            {
              name: '累计差异',
              type: 'line' as const,
              yAxisIndex: 1,
              data: cumulativeData.map((v, i) => ({
                value: v,
                itemStyle: { color: v >= 0 ? '#36B37E' : '#FF5630' },
              })),
              symbol: 'circle',
              symbolSize: 6,
              lineStyle: { type: 'dashed', color: '#1B65A8', width: 2 },
              itemStyle: { color: '#1B65A8', borderWidth: 2, borderColor: '#fff' },
              smooth: true,
            },
          ]
        : []),
    ],
  };

  return options;
});

function initChart() {
  if (!chartRef.value) return;
  chartInstance.value = echarts.init(chartRef.value, 'cretas');
  chartInstance.value.setOption(chartOptions.value);

  chartInstance.value.on('click', (params: Record<string, unknown>) => {
    const p = params as { dataIndex?: number; seriesIndex?: number };
    if (p.seriesIndex !== undefined && p.dataIndex !== undefined) {
      const d = props.data[p.dataIndex];
      if (d) emit('periodClick', d);
    }
  });
}

function updateChart() {
  if (chartInstance.value) {
    chartInstance.value.setOption(chartOptions.value, true);
  }
}

function handleResize() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    chartInstance.value?.resize();
  });
}

onMounted(() => {
  initChart();
  if (chartRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartRef.value);
  }
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (rafId) cancelAnimationFrame(rafId);
  window.removeEventListener('resize', handleResize);
  chartInstance.value?.dispose();
});

watch(() => props.data, updateChart, { deep: true });
watch(chartOptions, updateChart, { deep: true });

defineExpose({
  chartInstance,
  resize: handleResize,
  getInstance: () => chartInstance.value,
});
</script>

<template>
  <div v-loading="loading" class="variance-chart">
    <div v-if="title" class="chart-header">
      <h3>{{ title }}</h3>
    </div>

    <!-- KPI Summary Row -->
    <div v-if="data.length > 0" class="kpi-row">
      <div class="kpi-item">
        <span class="kpi-label">总预算</span>
        <span class="kpi-value">{{ formatValue(kpiSummary.totalBudget) }}{{ unit }}</span>
      </div>
      <div class="kpi-item">
        <span class="kpi-label">总实际</span>
        <span class="kpi-value" :class="kpiSummary.totalActual >= kpiSummary.totalBudget ? 'kpi-value--green' : 'kpi-value--red'">
          {{ formatValue(kpiSummary.totalActual) }}{{ unit }}
        </span>
      </div>
      <div class="kpi-item">
        <span class="kpi-label">总差异</span>
        <span class="kpi-value" :class="kpiSummary.totalVariance >= 0 ? 'kpi-value--green' : 'kpi-value--red'">
          {{ kpiSummary.totalVariance >= 0 ? '+' : '' }}{{ formatValue(kpiSummary.totalVariance) }}{{ unit }}
        </span>
      </div>
      <div class="kpi-item">
        <span class="kpi-label">达成率</span>
        <span class="kpi-value" :class="kpiSummary.achievementRate >= 100 ? 'kpi-value--green' : 'kpi-value--red'">
          {{ kpiSummary.achievementRate.toFixed(1) }}%
        </span>
      </div>
    </div>

    <!-- Chart Area -->
    <div class="chart-wrapper" :style="{ position: 'relative', width: '100%', height }">
      <div
        ref="chartRef"
        role="img"
        :aria-label="title || '差异分析图'"
        style="width: 100%; height: 100%"
      ></div>
      <div v-if="!loading && data.length === 0 && !(echartsOption && Object.keys(echartsOption).length > 0)" class="chart-empty">
        <el-empty description="暂无数据" :image-size="80" />
      </div>
    </div>

    <!-- Data Table -->
    <div v-if="showTable && data.length > 0" class="data-table-wrapper">
      <div class="table-scroll">
        <table class="variance-table">
          <thead>
            <tr>
              <th class="row-label"></th>
              <th v-for="d in data" :key="d.period" class="period-col">{{ d.period }}</th>
              <th class="total-col">累计</th>
            </tr>
          </thead>
          <tbody>
            <!-- Budget row -->
            <tr class="row-budget">
              <td class="row-label">预算</td>
              <td v-for="d in data" :key="d.period" class="data-cell">
                {{ formatValue(d.budget) }}
              </td>
              <td class="data-cell total-col">{{ formatValue(kpiSummary.totalBudget) }}</td>
            </tr>
            <!-- Actual row -->
            <tr class="row-actual">
              <td class="row-label">实际</td>
              <td v-for="(d, i) in data" :key="d.period" class="data-cell"
                :class="periodMetrics[i].variance >= 0 ? 'cell-positive' : 'cell-negative'">
                {{ formatValue(d.actual) }}
              </td>
              <td class="data-cell total-col"
                :class="kpiSummary.totalVariance >= 0 ? 'cell-positive' : 'cell-negative'">
                {{ formatValue(kpiSummary.totalActual) }}
              </td>
            </tr>
            <!-- Variance row -->
            <tr class="row-variance">
              <td class="row-label">差异</td>
              <td v-for="(d, i) in data" :key="d.period" class="data-cell variance-cell"
                :class="periodMetrics[i].variance >= 0 ? 'cell-positive' : 'cell-negative'">
                {{ periodMetrics[i].variance >= 0 ? '+' : '' }}{{ formatValue(periodMetrics[i].variance) }}
              </td>
              <td class="data-cell variance-cell total-col"
                :class="kpiSummary.totalVariance >= 0 ? 'cell-positive' : 'cell-negative'">
                {{ kpiSummary.totalVariance >= 0 ? '+' : '' }}{{ formatValue(kpiSummary.totalVariance) }}
              </td>
            </tr>
            <!-- Achievement rate row -->
            <tr class="row-rate">
              <td class="row-label">达成率</td>
              <td v-for="(d, i) in data" :key="d.period" class="data-cell rate-cell"
                :class="periodMetrics[i].achievementRate >= 100 ? 'cell-positive' : 'cell-negative'"
                :style="{ '--rate': Math.min(periodMetrics[i].achievementRate, 150) }">
                {{ periodMetrics[i].achievementRate.toFixed(1) }}%
              </td>
              <td class="data-cell rate-cell total-col"
                :class="kpiSummary.achievementRate >= 100 ? 'cell-positive' : 'cell-negative'"
                :style="{ '--rate': Math.min(kpiSummary.achievementRate, 150) }">
                {{ kpiSummary.achievementRate.toFixed(1) }}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.variance-chart {
  width: 100%;

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding: 0 4px;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }
  }

  .kpi-row {
    display: flex;
    gap: 0;
    margin-bottom: 12px;
    background: #f5f7fa;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #ebeef5;

    .kpi-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px 8px;
      border-right: 1px solid #ebeef5;

      &:last-child {
        border-right: none;
      }
    }

    .kpi-label {
      font-size: 11px;
      color: #909399;
      margin-bottom: 4px;
    }

    .kpi-value {
      font-size: 14px;
      font-weight: 700;
      color: #303133;

      &--green { color: #36B37E; }
      &--red { color: #FF5630; }
    }
  }

  .chart-wrapper {
    position: relative;
  }

  .chart-empty {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .data-table-wrapper {
    margin-top: 12px;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    overflow: hidden;

    .table-scroll {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
  }

  .variance-table {
    width: 100%;
    min-width: 600px;
    border-collapse: collapse;
    font-size: 12px;

    thead tr {
      background: #f5f7fa;

      th {
        padding: 8px 10px;
        text-align: center;
        font-weight: 600;
        color: #606266;
        border-bottom: 2px solid #ebeef5;
        white-space: nowrap;

        &.row-label {
          text-align: left;
          width: 60px;
          min-width: 60px;
          position: sticky;
          left: 0;
          background: #f5f7fa;
          z-index: 1;
        }

        &.total-col {
          font-weight: 700;
          color: #303133;
          background: #edf2fb;
          border-left: 2px solid #dce7f8;
        }

        &.period-col {
          min-width: 64px;
        }
      }
    }

    tbody {
      tr {
        transition: background 0.15s;

        &:hover {
          background: #f9fbff;
        }

        &:nth-child(odd) {
          background: #fafafa;
          &:hover {
            background: #f0f5ff;
          }
        }
      }

      .row-label {
        padding: 7px 10px;
        font-weight: 600;
        color: #606266;
        white-space: nowrap;
        text-align: left;
        position: sticky;
        left: 0;
        background: inherit;
        z-index: 1;
        border-right: 1px solid #ebeef5;
      }

      .data-cell {
        padding: 7px 10px;
        text-align: center;
        color: #303133;
        font-variant-numeric: tabular-nums;
        border-bottom: 1px solid #f5f7fa;
      }

      .total-col {
        font-weight: 700;
        border-left: 2px solid #dce7f8;
        background: #f0f5ff;
      }

      .variance-cell {
        font-weight: 700;

        &.cell-positive { color: #36B37E; background: rgba(54,179,126,0.06); }
        &.cell-negative { color: #FF5630; background: rgba(255,86,48,0.06); }
      }

      .cell-positive { color: #36B37E; }
      .cell-negative { color: #FF5630; }

      .rate-cell {
        font-weight: 700;
        position: relative;

        &.cell-positive {
          color: #36B37E;
          // Subtle green gradient based on achievement rate
          background: linear-gradient(
            to right,
            rgba(54,179,126,0.12) calc(var(--rate, 100) * 0.67%),
            transparent calc(var(--rate, 100) * 0.67%)
          );
        }

        &.cell-negative {
          color: #FF5630;
          background: linear-gradient(
            to right,
            rgba(255,86,48,0.1) calc(var(--rate, 100) * 0.67%),
            transparent calc(var(--rate, 100) * 0.67%)
          );
        }
      }

      .row-variance {
        border-top: 1px solid #ebeef5;
        border-bottom: 1px solid #ebeef5;
      }

      .row-rate {
        border-top: 1px solid #ebeef5;
      }
    }
  }
}
</style>
