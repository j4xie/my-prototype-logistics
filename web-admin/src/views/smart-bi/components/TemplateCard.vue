<template>
  <el-card class="tpl-card" shadow="hover">
    <template #header>
      <div class="tpl-header">
        <span class="tpl-title">{{ title }}</span>
        <span v-if="uploadLabel" class="tpl-badge">
          数据截至: {{ formattedDate }}
        </span>
      </div>
    </template>

    <!-- Loading -->
    <div v-if="status === 'loading'" class="tpl-loading">
      <el-skeleton :rows="4" animated />
    </div>

    <!-- Loaded: real chart + KPI + insight -->
    <template v-else-if="status === 'loaded' && item">
      <div v-if="kpis.length > 0" class="tpl-kpis">
        <div v-for="kpi in kpis" :key="kpi.label" class="tpl-kpi">
          <div class="tpl-kpi-label">{{ kpi.label }}</div>
          <div class="tpl-kpi-value">{{ kpi.value }}</div>
        </div>
      </div>
      <div ref="chartRef" class="tpl-chart" v-if="chartOption"></div>
      <div v-if="insightText" class="tpl-insight">
        {{ insightText }}
      </div>
    </template>

    <!-- Empty: code was in some upload but not this one -->
    <div v-else-if="status === 'missing'" class="tpl-empty">
      <div class="tpl-empty-icon">📭</div>
      <div class="tpl-empty-title">该数据集不包含 [{{ title }}] 所需字段</div>
      <div class="tpl-empty-hint">上传含 {{ requiredFields }} 的文件后将自动生成</div>
    </div>

    <!-- Empty: code never materialized for this factory -->
    <div v-else-if="status === 'never'" class="tpl-empty">
      <div class="tpl-empty-icon">📄</div>
      <div class="tpl-empty-title">尚未为该工厂生成过 [{{ title }}]</div>
      <div class="tpl-empty-hint">上传含 {{ requiredFields }} 的数据文件</div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
import type { ECharts } from 'echarts';
import type { AnalysisResultItem } from '@/api/smartbi/analysisResults';
import {
  getTemplateTitle,
  getRequiredFields,
} from '../composables/useTemplateMap';

type CardStatus = 'loading' | 'loaded' | 'missing' | 'never';

const props = defineProps<{
  code: string;
  item?: AnalysisResultItem;
  status: CardStatus;
}>();

const chartRef = ref<HTMLElement>();
let chartInstance: ECharts | null = null;

const title = computed(() => getTemplateTitle(props.code));
const requiredFields = computed(() => getRequiredFields(props.code));

const uploadLabel = computed(() => props.item?.uploadLabel);
const formattedDate = computed(() => {
  const d = props.item?.uploadCreatedAt;
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('zh-CN');
  } catch {
    return d.slice(0, 10);
  }
});

const kpis = computed(() => {
  const kv = props.item?.kpiValues;
  if (!kv || typeof kv !== 'object') return [];
  return Object.entries(kv)
    .slice(0, 4)
    .map(([label, value]) => ({
      label,
      value: typeof value === 'number'
        ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
        : String(value ?? '—'),
    }));
});

const chartOption = computed(() => {
  const configs = props.item?.chartConfigs;
  if (!Array.isArray(configs) || configs.length === 0) return null;
  return configs[0]; // render first chart; library view can show others later
});

const insightText = computed(() => {
  const insights = props.item?.insights;
  if (!Array.isArray(insights) || insights.length === 0) return '';
  return insights
    .map((i) => (typeof i === 'string' ? i : (i as { text?: string }).text || ''))
    .filter(Boolean)
    .join('\n');
});

function renderChart() {
  if (!chartRef.value || !chartOption.value) {
    chartInstance?.dispose();
    chartInstance = null;
    return;
  }
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value);
  }
  chartInstance.setOption(chartOption.value as echarts.EChartsOption, true);
}

onMounted(() => {
  nextTick(renderChart);
});

watch(
  () => [props.status, props.item],
  () => nextTick(renderChart),
  { deep: true },
);
</script>

<style scoped>
.tpl-card {
  margin-bottom: 16px;
}
.tpl-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.tpl-title {
  font-weight: 600;
  font-size: 14px;
}
.tpl-badge {
  font-size: 12px;
  color: #909399;
}
.tpl-kpis {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.tpl-kpi {
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  min-width: 80px;
}
.tpl-kpi-label {
  font-size: 12px;
  color: #606266;
}
.tpl-kpi-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}
.tpl-chart {
  height: 260px;
  width: 100%;
}
.tpl-insight {
  margin-top: 12px;
  padding: 10px;
  background: #f0f9ff;
  border-left: 3px solid #409eff;
  font-size: 13px;
  white-space: pre-wrap;
}
.tpl-empty {
  text-align: center;
  padding: 32px 16px;
  color: #909399;
}
.tpl-empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}
.tpl-empty-title {
  font-size: 14px;
  color: #606266;
  margin-bottom: 4px;
}
.tpl-empty-hint {
  font-size: 12px;
}
.tpl-loading {
  padding: 16px;
}
</style>
