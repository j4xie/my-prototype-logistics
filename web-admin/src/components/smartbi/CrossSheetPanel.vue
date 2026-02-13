<script setup lang="ts">
/**
 * CrossSheetPanel — Cross-sheet comprehensive analysis dialog content.
 * Extracted from SmartBIAnalysis.vue (AUDIT-026) to reduce god-component size.
 *
 * Props: receives analysis result data from parent.
 * Emits: 'close' when user wants to dismiss the dialog.
 *
 * Chart rendering is handled internally via ECharts, using the same
 * resolveEChartsOptions / processEChartsOptions / enhanceChartOption / humanizeChartConfig
 * pipeline that was previously inline in the parent.
 */
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import { Loading } from '@element-plus/icons-vue';
import echarts from '@/utils/echarts';
import DOMPurify from 'dompurify';
import type { CrossSheetResult } from '@/api/smartbi';

/** Loose ECharts config shape from Python chart_builder */
interface EChartsLikeConfig extends Record<string, unknown> {
  series?: Array<Record<string, unknown>>;
  xAxis?: { type?: string; name?: string; data?: unknown[] } & Record<string, unknown>;
  yAxis?: ({ type?: string; name?: string } & Record<string, unknown>) | Array<Record<string, unknown>>;
  legend?: { data?: unknown[] } & Record<string, unknown>;
  chartOptions?: string;
  options?: Record<string, unknown>;
}

interface CrossSheetChart {
  chartType: string;
  title: string;
  config: EChartsLikeConfig;
}

const props = defineProps<{
  visible: boolean;
  loading: boolean;
  result: CrossSheetResult | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
}>();

const dialogVisible = ref(props.visible);
watch(() => props.visible, (v) => { dialogVisible.value = v; });
watch(dialogVisible, (v) => { emit('update:visible', v); });

// Chart instances for cleanup
const chartInstances: echarts.ECharts[] = [];

// KPI keys derived from the result
const crossSheetKpiKeys = ref<string[]>([]);

watch(() => props.result, (result) => {
  if (!result?.kpiComparison?.length) {
    crossSheetKpiKeys.value = [];
    return;
  }
  const keys = new Set<string>();
  for (const item of result.kpiComparison) {
    if (item.kpis) Object.keys(item.kpis).forEach(k => keys.add(k));
  }
  crossSheetKpiKeys.value = [...keys];
}, { immediate: true });

// Render charts when result changes
watch(() => props.result, async (result) => {
  if (!result?.charts?.length) return;
  await nextTick();
  // Wait a tick for dialog transition
  setTimeout(() => {
    renderCharts(result.charts as CrossSheetChart[]);
  }, 300);
}, { immediate: true });

function resolveEChartsOptions(config: EChartsLikeConfig): Record<string, unknown> | null {
  if (config.series || config.xAxis || config.yAxis) {
    return config;
  } else if (typeof config.chartOptions === 'string') {
    try { return JSON.parse(config.chartOptions); } catch { return null; }
  } else if (config.options) {
    return config.options;
  }
  return null;
}

function renderCharts(charts: CrossSheetChart[]) {
  // Dispose previous instances
  for (const inst of chartInstances) {
    inst.dispose();
  }
  chartInstances.length = 0;

  for (let idx = 0; idx < charts.length; idx++) {
    const chart = charts[idx];
    const dom = document.getElementById(`cross-chart-${idx}`);
    if (!dom) continue;

    try {
      const options = resolveEChartsOptions(chart.config);
      if (options) {
        const instance = echarts.init(dom, 'cretas');
        chartInstances.push(instance);
        instance.setOption(options, { notMerge: true });
      }
    } catch {
      // Cross-chart render error handled silently
    }
  }
}

function formatAnalysis(analysis: string): string {
  const html = analysis
    .replace(/\n/g, '<br/>')
    .replace(/\*\*trend\*\*/gi, '<strong>趋势</strong>')
    .replace(/\*\*anomaly\*\*/gi, '<strong>异常</strong>')
    .replace(/\*\*recommendation\*\*/gi, '<strong>建议</strong>')
    .replace(/\*\*comparison\*\*/gi, '<strong>对比</strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/【(.*?)】/g, '<span class="highlight">【$1】</span>')
    .replace(/(<br\/>)(\d+\.)\s/g, '$1<strong>$2</strong> ');
  return DOMPurify.sanitize(html);
}

onBeforeUnmount(() => {
  for (const inst of chartInstances) {
    inst.dispose();
  }
  chartInstances.length = 0;
});
</script>

<template>
  <el-dialog v-model="dialogVisible" title="全 Sheet 综合分析" width="90%" top="3vh" fullscreen>
    <div v-if="loading" class="cross-sheet-loading">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <p>正在汇总所有 Sheet 数据，生成跨表综合分析...</p>
    </div>

    <div v-else-if="result">
      <!-- 高管摘要 -->
      <div v-if="result.aiSummary" class="cross-summary-banner">
        <div class="summary-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
        </div>
        <div class="summary-text" v-html="formatAnalysis(result.aiSummary)"></div>
      </div>

      <!-- KPI 对比卡片 -->
      <div v-if="result.kpiComparison?.length" class="cross-kpi-section">
        <h3>各 Sheet 核心指标对比</h3>
        <el-table :data="result.kpiComparison" border stripe size="small">
          <el-table-column prop="sheetName" label="报表" min-width="180" fixed />
          <template v-for="kpiKey in crossSheetKpiKeys" :key="kpiKey">
            <el-table-column :label="kpiKey" min-width="120">
              <template #default="{ row }">
                {{ row.kpis?.[kpiKey] != null ? Number(row.kpis[kpiKey]).toLocaleString() : '-' }}
              </template>
            </el-table-column>
          </template>
        </el-table>
      </div>

      <!-- 综合图表 -->
      <div v-if="result.charts?.length" class="cross-charts-section">
        <h3>综合可视化</h3>
        <div class="cross-chart-grid">
          <div v-for="(chart, idx) in result.charts" :key="idx" class="cross-chart-item">
            <div class="chart-title">{{ chart.title || '分析图表' }}</div>
            <div :id="`cross-chart-${idx}`" class="cross-chart-container"></div>
          </div>
        </div>
      </div>
    </div>

    <el-empty v-else description="暂无综合分析数据" />
  </el-dialog>
</template>

<style lang="scss" scoped>
.cross-sheet-loading {
  text-align: center;
  padding: 80px 0;

  p {
    margin-top: 16px;
    color: #86909c;
  }
}

.cross-summary-banner {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #e8f5e9 0%, #e3f2fd 100%);
  border-radius: var(--radius-lg);
  margin-bottom: 24px;
  border: 1px solid #c8e6c9;

  .summary-icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    background: #4caf50;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
  }

  .summary-text {
    font-size: 14px;
    line-height: 1.8;
    color: #37474f;

    :deep(strong) {
      color: #1b5e20;
    }

    :deep(.highlight) {
      color: #e65100;
      font-weight: 600;
    }
  }
}

.cross-kpi-section {
  margin-bottom: 24px;

  h3 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #303133;
  }
}

.cross-charts-section {
  h3 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #303133;
  }
}

.cross-chart-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
  gap: 16px;
}

.cross-chart-item {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  background: #fff;

  .chart-title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 12px;
    text-align: center;
  }

  .cross-chart-container {
    height: 360px;
    width: 100%;
  }
}
</style>
