<script setup lang="ts">
/**
 * C-WIDGET-1 — KPI card widget.
 * Config: { label: string, value: number | string, suffix?: string, trend?: number }
 */
defineProps<{
  config: { label?: string; value?: number | string; suffix?: string; trend?: number };
  title?: string;
}>();
</script>

<template>
  <el-card shadow="never" class="kpi-widget">
    <div class="kpi-widget-label">{{ title || config.label || 'KPI' }}</div>
    <div class="kpi-widget-value">
      {{ config.value ?? '—' }}<span v-if="config.suffix" class="kpi-widget-suffix">{{ config.suffix }}</span>
    </div>
    <div v-if="config.trend != null" class="kpi-widget-trend" :class="{ up: config.trend > 0, down: config.trend < 0 }">
      <span v-if="config.trend > 0">↑</span>
      <span v-else-if="config.trend < 0">↓</span>
      <span v-else>—</span>
      {{ Math.abs(config.trend).toFixed(1) }}%
    </div>
  </el-card>
</template>

<style scoped>
.kpi-widget { height: 100%; }
.kpi-widget-label { font-size: 13px; color: var(--el-text-color-secondary); margin-bottom: 8px; }
.kpi-widget-value { font-size: 28px; font-weight: 600; color: var(--el-text-color-primary); }
.kpi-widget-suffix { font-size: 14px; font-weight: 400; color: var(--el-text-color-secondary); margin-left: 4px; }
.kpi-widget-trend { margin-top: 8px; font-size: 12px; color: var(--el-text-color-secondary); }
.kpi-widget-trend.up { color: var(--el-color-success); }
.kpi-widget-trend.down { color: var(--el-color-danger); }
</style>
