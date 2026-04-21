<template>
  <div class="mat-card" :class="{ 'mat-card--no-chart': !result.chartConfig }">
    <div class="mat-card__header">
      <span class="mat-card__title">{{ result.title }}</span>
      <span class="mat-card__code">{{ result.code }}</span>
    </div>

    <!-- KPI row -->
    <div v-if="kpiEntries.length > 0" class="mat-card__kpis">
      <div
        v-for="kpi in kpiEntries"
        :key="kpi.key"
        class="mat-kpi"
      >
        <div class="mat-kpi__label">{{ formatKpiLabel(kpi.key) }}</div>
        <div class="mat-kpi__value">{{ formatKpiValue(kpi.value) }}</div>
      </div>
    </div>

    <!-- Chart -->
    <div
      v-if="result.chartConfig"
      ref="chartRef"
      class="mat-card__chart"
      :style="{ height: chartHeight + 'px' }"
    />

    <!-- Table fallback for chart-less templates (anomaly) -->
    <div v-else-if="tableData.length > 0" class="mat-card__table-wrap">
      <el-table :data="tableData" size="small" :max-height="260" border>
        <el-table-column
          v-for="col in tableColumns"
          :key="col"
          :prop="col"
          :label="col"
        />
      </el-table>
    </div>

    <!-- Insight -->
    <div v-if="result.insightText" class="mat-card__insight">
      <el-icon><InfoFilled /></el-icon>
      <span>{{ result.insightText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import echarts from '@/utils/echarts';
import { InfoFilled } from '@element-plus/icons-vue';
import type { MaterializedResult } from '@/api/smartbi/materialized';

const props = defineProps<{
  result: MaterializedResult;
  chartHeight?: number;
}>();

const chartHeight = computed(() => props.chartHeight ?? 260);
const chartRef = ref<HTMLDivElement | null>(null);
let chartInstance: ReturnType<typeof echarts.init> | null = null;

const kpiEntries = computed(() =>
  Object.entries(props.result.kpis || {}).map(([key, value]) => ({ key, value }))
);

// For chart-less templates (anomaly), show outliers table if available
const tableData = computed(() => {
  const data = props.result.data;
  if (!data) return [];
  const outliers = data['outliers'];
  if (Array.isArray(outliers)) return (outliers as Record<string, unknown>[]).slice(0, 50);
  return [];
});

const tableColumns = computed(() => {
  if (tableData.value.length === 0) return [];
  return Object.keys(tableData.value[0]);
});

function formatKpiLabel(key: string): string {
  // snake_case → human-readable (Chinese labels for common keys)
  const labelMap: Record<string, string> = {
    top_label: '冠军',
    top_value: '冠军值',
    top_share_pct: '占比',
    dim_count: '维度数',
    total: '累计',
    peak_period: '峰值期',
    peak_value: '峰值',
    trough_period: '谷值期',
    trough_value: '谷值',
    period_count: '时段数',
    outlier_count: '异常数',
    mean: '均值',
    std: '标准差',
    min: '最小',
    max: '最大',
    category_count: '分类数',
    labels_for_80pct: 'Top X 贡献80%',
    labels_for_80pct_share: 'Top X 占比',
    total_labels: '总分类',
  };
  return labelMap[key] || key;
}

function formatKpiValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

function renderChart() {
  if (!chartRef.value || !props.result.chartConfig) return;
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value, 'cretas');
  }
  try {
    chartInstance.setOption(props.result.chartConfig as Parameters<typeof chartInstance.setOption>[0], true);
  } catch (err) {
    console.error(`[mat-card ${props.result.code}] chart render failed`, err);
  }
}

function handleResize() {
  chartInstance?.resize();
}

onMounted(() => {
  renderChart();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  chartInstance?.dispose();
  chartInstance = null;
});

watch(() => props.result, () => renderChart(), { deep: true });
</script>

<style scoped>
.mat-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 280px;
}

.mat-card__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  border-bottom: 1px solid #f0f2f5;
  padding-bottom: 8px;
}

.mat-card__title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.mat-card__code {
  font-size: 11px;
  color: #909399;
  font-family: monospace;
}

.mat-card__kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 8px;
}

.mat-kpi {
  padding: 6px 8px;
  background: #f5f7fa;
  border-radius: 4px;
  text-align: center;
}

.mat-kpi__label {
  font-size: 11px;
  color: #909399;
}

.mat-kpi__value {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-top: 2px;
}

.mat-card__chart {
  width: 100%;
}

.mat-card__table-wrap {
  flex: 1;
  overflow: auto;
}

.mat-card__insight {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  color: #606266;
  padding: 8px;
  background: #f0f9eb;
  border-left: 3px solid #67c23a;
  border-radius: 4px;
  line-height: 1.5;
}

.mat-card--no-chart .mat-card__chart {
  display: none;
}
</style>
