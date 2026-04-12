<template>
  <div class="sales-plan-card">
    <h4>销售计划追踪</h4>
    <div class="metrics">
      <div class="metric">
        <span class="label">目标</span>
        <span class="value">¥{{ formatNum(data.target_revenue) }}</span>
      </div>
      <div class="metric">
        <span class="label">实际</span>
        <span class="value">¥{{ formatNum(data.actual_revenue) }}</span>
      </div>
      <div class="metric">
        <span class="label">完成度</span>
        <span class="value" :class="statusClass">{{ data.completion_pct }}%</span>
      </div>
    </div>
    <el-progress :percentage="Math.min(Number(data.completion_pct) || 0, 100)"
                 :status="data.status === 'ON_TRACK' ? 'success' : data.status === 'BEHIND' ? 'exception' : 'warning'" />
    <p v-if="data.status === 'BEHIND'" class="alert">
      还差 ¥{{ formatNum(data.gap) }}, 剩余 {{ data.remaining_days }} 天需日均 ¥{{ formatNum(data.daily_needed) }}
    </p>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ data: Record<string, unknown> }>();
const statusClass = computed(() =>
  props.data.status === 'ON_TRACK' ? 'green' : props.data.status === 'BEHIND' ? 'red' : 'orange');
function formatNum(v: unknown): string {
  return Number(v || 0).toLocaleString();
}
</script>
<style scoped>
.sales-plan-card { padding: 12px; }
.metrics { display: flex; gap: 24px; margin-bottom: 12px; }
.metric { display: flex; flex-direction: column; }
.label { font-size: 12px; color: #909399; }
.value { font-size: 18px; font-weight: bold; }
.alert { color: #f56c6c; margin-top: 8px; }
.green { color: #67c23a; }
.orange { color: #e6a23c; }
.red { color: #f56c6c; }
</style>
