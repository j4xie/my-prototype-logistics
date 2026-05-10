<template>
  <div class="store-kpi-dashboard-card">
    <h4>店长 KPI 三维度健康度</h4>
    <div class="overall-row">
      <el-tag :type="overallTagType" size="large" class="overall-badge">
        综合健康度: {{ healthLabel(data.overall_health as string) }}
      </el-tag>
    </div>
    <div class="dimensions">
      <div
        v-for="dim in dimensions"
        :key="dim.name"
        :class="['dimension-card', `health-${dim.health?.toLowerCase()}`]"
      >
        <div class="dim-header">
          <span class="dim-name">{{ dim.name }}</span>
          <el-tag :type="healthTagType(dim.health)" size="small">{{ healthLabel(dim.health) }}</el-tag>
        </div>
        <div v-for="m in dim.metrics" :key="m.label" class="metric-row">
          <span class="metric-label">{{ m.label }}</span>
          <span :class="['metric-value', `status-${m.status?.toLowerCase()}`]">{{ m.value }}</span>
        </div>
      </div>
    </div>
    <div v-if="alerts.length" class="alerts-section">
      <div class="alerts-title">预警</div>
      <ul class="alerts-list">
        <li v-for="(alert, i) in alerts" :key="i">{{ alert }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface KpiMetric {
  label: string;
  value: string | number;
  status?: string;
}
interface KpiDimension {
  name: string;
  health?: string;
  metrics?: KpiMetric[];
}

const props = defineProps<{ data: Record<string, unknown> }>();
const dimensions = computed<KpiDimension[]>(() => (props.data?.dimensions as KpiDimension[]) ?? []);
const alerts = computed(() => (props.data?.alerts as string[]) ?? []);
const overallTagType = computed(() => healthTagType(props.data?.overall_health as string));
function healthTagType(h: string): string {
  return h === 'GOOD' ? 'success' : h === 'WARNING' ? 'warning' : h === 'CRITICAL' ? 'danger' : 'info';
}
function healthLabel(h: string): string {
  return h === 'GOOD' ? '健康' : h === 'WARNING' ? '警告' : h === 'CRITICAL' ? '危险' : h ?? '-';
}
</script>

<style scoped>
.store-kpi-dashboard-card { padding: 12px; }
h4 { margin: 0 0 10px; font-size: 14px; color: #303133; }
.overall-row { margin-bottom: 14px; }
.overall-badge { font-size: 13px; font-weight: 600; }
.dimensions { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.dimension-card { flex: 1; min-width: 180px; border-radius: 6px; padding: 10px 14px; border: 1px solid #e4e7ed; background: #fafafa; }
.health-good { border-color: #b3e19d; background: #f0f9eb; }
.health-warning { border-color: #f3d19e; background: #fdf6ec; }
.health-critical { border-color: #f89898; background: #fef0f0; }
.dim-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.dim-name { font-weight: 600; font-size: 13px; color: #303133; }
.metric-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: 12px; }
.metric-label { color: #606266; }
.metric-value { font-weight: 500; }
.status-good { color: #67c23a; }
.status-warning { color: #e6a23c; }
.status-critical { color: #f56c6c; }
.alerts-section { background: #fef0f0; border: 1px solid #f89898; border-radius: 4px; padding: 10px 14px; }
.alerts-title { font-weight: 600; font-size: 12px; color: #c45656; margin-bottom: 6px; }
.alerts-list { margin: 0; padding-left: 16px; }
.alerts-list li { font-size: 12px; color: #c45656; line-height: 1.6; }
</style>
