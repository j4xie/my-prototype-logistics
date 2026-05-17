<script setup lang="ts">
/**
 * C-WIDGET-1 — chart widget. Minimal placeholder using a simple bar layout.
 * Real ECharts integration follows existing pattern in smartbi/ — deferred to
 * follow-up to avoid coupling this PR to a heavy ECharts import.
 *
 * Config: { type: 'bar' | 'line', series: Array<{ label, value }> }
 */
import { computed } from 'vue';

const props = defineProps<{
  config: { type?: 'bar' | 'line'; series?: Array<{ label: string; value: number }> };
  title?: string;
}>();

const max = computed(() => {
  const vs = (props.config.series ?? []).map((s) => s.value);
  return vs.length ? Math.max(...vs, 1) : 1;
});
</script>

<template>
  <el-card shadow="never" class="chart-widget">
    <div class="chart-widget-title">{{ title || '图表' }}</div>
    <div v-if="!config.series?.length" class="chart-widget-empty">暂无数据</div>
    <div v-else class="chart-widget-bars">
      <div v-for="item in config.series" :key="item.label" class="chart-widget-bar-row">
        <span class="chart-widget-bar-label">{{ item.label }}</span>
        <div class="chart-widget-bar-track">
          <div class="chart-widget-bar-fill" :style="{ width: `${(item.value / max) * 100}%` }" />
        </div>
        <span class="chart-widget-bar-value">{{ item.value }}</span>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.chart-widget { height: 100%; }
.chart-widget-title { font-weight: 600; margin-bottom: 12px; }
.chart-widget-empty { color: var(--el-text-color-secondary); padding: 16px; text-align: center; }
.chart-widget-bars { display: flex; flex-direction: column; gap: 6px; }
.chart-widget-bar-row { display: flex; gap: 8px; align-items: center; font-size: 12px; }
.chart-widget-bar-label { width: 80px; color: var(--el-text-color-secondary); }
.chart-widget-bar-track { flex: 1; height: 8px; background: var(--el-fill-color-light); border-radius: 4px; overflow: hidden; }
.chart-widget-bar-fill { height: 100%; background: var(--el-color-primary); }
.chart-widget-bar-value { width: 40px; text-align: right; font-weight: 600; }
</style>
