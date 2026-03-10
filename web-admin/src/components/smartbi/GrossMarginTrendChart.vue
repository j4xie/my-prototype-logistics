<script setup lang="ts">
/**
 * GrossMarginTrendChart - Chart 6: Gross Margin Year-over-Year Trend
 * Features: Line chart with YoY difference, KPI cards, data table
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import echarts from '@/utils/echarts';
import type { ECharts } from 'echarts';
import KPICard from './KPICard.vue';
import type { TrendDirection, StatusType } from './KPICard.vue';

export interface MarginMonthData {
  month: string;
  currentMargin: number;
  lastYearMargin: number;
}

interface Props {
  title?: string;
  data: MarginMonthData[];
  height?: number;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '毛利率同比趋势分析',
  height: 380,
  loading: false,
});

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);
let resizeObserver: ResizeObserver | null = null;
let rafId = 0;

// ---- Computed KPIs ----
const avgCurrentMargin = computed(() => {
  if (!props.data.length) return 0;
  const sum = props.data.reduce((s, d) => s + d.currentMargin, 0);
  return Math.round((sum / props.data.length) * 100) / 100;
});

const avgLastYearMargin = computed(() => {
  if (!props.data.length) return 0;
  const sum = props.data.reduce((s, d) => s + d.lastYearMargin, 0);
  return Math.round((sum / props.data.length) * 100) / 100;
});

const marginDiff = computed(() =>
  Math.round((avgCurrentMargin.value - avgLastYearMargin.value) * 100) / 100
);

const bestMonth = computed(() => {
  if (!props.data.length) return '-';
  const best = props.data.reduce((prev, curr) =>
    curr.currentMargin > prev.currentMargin ? curr : prev
  );
  return best.month;
});

const kpiList = computed(() => {
  const diffTrend: TrendDirection = marginDiff.value > 0 ? 'up' : marginDiff.value < 0 ? 'down' : 'flat';
  const diffStatus: StatusType = marginDiff.value > 0 ? 'success' : marginDiff.value < -2 ? 'danger' : 'warning';

  return [
    {
      title: '本年累计毛利率',
      value: avgCurrentMargin.value.toFixed(2),
      unit: '%',
      status: (avgCurrentMargin.value >= 30 ? 'success' : avgCurrentMargin.value >= 20 ? 'warning' : 'danger') as StatusType,
      trend: 'flat' as TrendDirection,
    },
    {
      title: '上年累计毛利率',
      value: avgLastYearMargin.value.toFixed(2),
      unit: '%',
      status: 'info' as StatusType,
      trend: 'flat' as TrendDirection,
    },
    {
      title: '差异(pp)',
      value: (marginDiff.value > 0 ? '+' : '') + marginDiff.value.toFixed(2),
      unit: 'pp',
      status: diffStatus,
      trend: diffTrend,
    },
    {
      title: '最佳月份',
      value: bestMonth.value,
      unit: '',
      status: 'success' as StatusType,
      trend: 'flat' as TrendDirection,
    },
  ];
});

// ---- ECharts Option ----
function buildOption() {
  const months = props.data.map(d => d.month);
  const currentData = props.data.map(d => d.currentMargin);
  const lastYearData = props.data.map(d => d.lastYearMargin);
  const diffData = props.data.map(d =>
    Math.round((d.currentMargin - d.lastYearMargin) * 100) / 100
  );

  return {
    grid: { top: 24, right: 50, bottom: 60, left: 60, containLabel: true },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown[]) => {
        const ps = params as Array<{ seriesName: string; value: number; color: string }>;
        const month = (params as Array<{ axisValue: string }>)[0]?.axisValue || '';
        let html = `<div style="font-weight:600;margin-bottom:4px;">${month}</div>`;
        for (const p of ps) {
          html += `<div style="display:flex;align-items:center;gap:6px;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}"></span>
            <span>${p.seriesName}:</span><strong>${p.value.toFixed(2)}${p.seriesName === '差异' ? 'pp' : '%'}</strong>
          </div>`;
        }
        return html;
      },
    },
    legend: {
      bottom: 0,
      data: ['上年毛利率', '本年毛利率', '差异'],
      itemWidth: 14,
      itemHeight: 10,
    },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: { fontSize: 11 },
    },
    yAxis: [
      {
        type: 'value',
        name: '毛利率(%)',
        nameTextStyle: { fontSize: 11, color: '#909399' },
        axisLabel: { fontSize: 11, formatter: '{value}%' },
        splitLine: { lineStyle: { type: 'dashed', color: '#f0f0f0' } },
      },
      {
        type: 'value',
        name: '差异(pp)',
        nameTextStyle: { fontSize: 11, color: '#909399' },
        axisLabel: { fontSize: 11, formatter: '{value}pp' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '上年毛利率',
        type: 'line',
        yAxisIndex: 0,
        data: lastYearData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#36B37E', width: 2, type: 'dashed' },
        itemStyle: { color: '#36B37E' },
      },
      {
        name: '本年毛利率',
        type: 'line',
        yAxisIndex: 0,
        data: currentData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#1B65A8', width: 2.5 },
        itemStyle: { color: '#1B65A8' },
      },
      {
        name: '差异',
        type: 'line',
        yAxisIndex: 1,
        data: diffData,
        smooth: true,
        symbol: 'diamond',
        symbolSize: 8,
        lineStyle: { color: '#FF5630', width: 2 },
        itemStyle: { color: '#FFAB00', borderColor: '#FF5630', borderWidth: 2 },
        label: {
          show: true,
          position: 'top',
          formatter: (p: { value: number }) => {
            const sign = p.value >= 0 ? '↑' : '↓';
            return `${sign}${Math.abs(p.value).toFixed(1)}pp`;
          },
          fontSize: 10,
          color: (p: { value: number }) => p.value >= 0 ? '#36B37E' : '#FF5630',
        },
      },
    ],
  };
}

function initChart() {
  if (!chartRef.value) return;
  // Defer if container has zero dimensions (not yet laid out)
  if (chartRef.value.clientWidth === 0 || chartRef.value.clientHeight === 0) {
    requestAnimationFrame(() => initChart());
    return;
  }
  if (chartInstance.value) chartInstance.value.dispose();
  chartInstance.value = echarts.init(chartRef.value);
  chartInstance.value.setOption(buildOption());
}

function scheduleResize() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    chartInstance.value?.resize();
  });
}

watch(() => props.data, () => {
  if (chartInstance.value) {
    chartInstance.value.setOption(buildOption(), { notMerge: true });
  }
}, { deep: true });

watch(() => props.loading, (loading) => {
  if (!chartInstance.value) return;
  if (loading) {
    chartInstance.value.showLoading({ text: '加载中...', color: '#1B65A8' });
  } else {
    chartInstance.value.hideLoading();
    chartInstance.value.setOption(buildOption(), { notMerge: true });
  }
});

onMounted(() => {
  initChart();
  resizeObserver = new ResizeObserver(scheduleResize);
  if (chartRef.value) resizeObserver.observe(chartRef.value);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  if (rafId) cancelAnimationFrame(rafId);
  chartInstance.value?.dispose();
  chartInstance.value = null;
});

defineExpose({ chartInstance });
</script>

<template>
  <div class="gross-margin-trend-chart">
    <!-- KPI Cards Row -->
    <div class="kpi-row">
      <KPICard
        v-for="kpi in kpiList"
        :key="kpi.title"
        :title="kpi.title"
        :value="kpi.value"
        :unit="kpi.unit"
        :status="kpi.status"
        :trend="kpi.trend"
        class="kpi-card-item"
      />
    </div>

    <!-- Chart Area -->
    <div
      ref="chartRef"
      :style="{ height: `${height}px`, width: '100%' }"
    />

    <!-- Data Table -->
    <div class="data-table-wrapper" v-if="data.length > 0">
      <table class="margin-table">
        <thead>
          <tr>
            <th class="row-label">指标</th>
            <th v-for="item in data" :key="item.month" class="month-col">{{ item.month }}</th>
          </tr>
        </thead>
        <tbody>
          <tr class="row-last-year">
            <td class="row-label">上年毛利率</td>
            <td v-for="item in data" :key="item.month" class="data-cell">
              {{ item.lastYearMargin.toFixed(1) }}%
            </td>
          </tr>
          <tr class="row-current">
            <td class="row-label">本年毛利率</td>
            <td v-for="item in data" :key="item.month" class="data-cell">
              {{ item.currentMargin.toFixed(1) }}%
            </td>
          </tr>
          <tr class="row-diff">
            <td class="row-label">差异(pp)</td>
            <td
              v-for="item in data"
              :key="item.month"
              class="data-cell"
              :class="{
                'positive': item.currentMargin - item.lastYearMargin > 0,
                'negative': item.currentMargin - item.lastYearMargin < 0
              }"
            >
              {{ (item.currentMargin - item.lastYearMargin) >= 0 ? '+' : '' }}{{ (item.currentMargin - item.lastYearMargin).toFixed(1) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.gross-margin-trend-chart {
  width: 100%;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

@media (max-width: 900px) {
  .kpi-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

.kpi-card-item {
  min-width: 0;
}

.data-table-wrapper {
  margin-top: 16px;
  overflow-x: auto;
}

.margin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  color: #606266;
}

.margin-table th,
.margin-table td {
  padding: 6px 10px;
  text-align: center;
  border: 1px solid #f0f0f0;
  white-space: nowrap;
}

.margin-table thead th {
  background: #f5f7fa;
  font-weight: 600;
  color: #303133;
}

.row-label {
  text-align: left !important;
  font-weight: 500;
  background: #fafafa;
  min-width: 90px;
}

.row-last-year td {
  background: rgba(54, 179, 126, 0.06);
}

.row-current td {
  background: rgba(27, 101, 168, 0.06);
  font-weight: 600;
}

.row-diff .data-cell.positive {
  color: #36B37E;
  font-weight: 600;
}

.row-diff .data-cell.negative {
  color: #FF5630;
  font-weight: 600;
}
</style>
