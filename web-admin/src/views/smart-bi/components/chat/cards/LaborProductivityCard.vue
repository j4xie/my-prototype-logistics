<template>
  <div class="labor-productivity-card">
    <h4>人效监控</h4>
    <div class="headline">
      <span class="productivity">¥{{ formatNum(data.productivity) }}</span>
      <span class="per">/人/月</span>
      <el-tag :type="tagType" size="small">{{ zoneLabel }}</el-tag>
    </div>
    <p class="diagnosis">{{ data.diagnosis }}</p>
    <div class="detail">
      <span>营收 ¥{{ formatNum(data.revenue) }} / {{ data.headcount }} 人</span>
      <span class="range">健康区间: ¥{{ formatNum(thresholds.low) }}-¥{{ formatNum(thresholds.high) }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ data: Record<string, unknown> }>();
const thresholds = computed(() => (props.data?.thresholds as Record<string, number>) ?? { low: 30000, high: 40000 });
const tagType = computed(() => {
  const z = props.data.zone;
  return z === 'HEALTHY' ? 'success' : z === 'OVERSTAFFED' ? 'warning' : 'danger';
});
const zoneLabel = computed(() => {
  const z = props.data.zone;
  return z === 'HEALTHY' ? '健康' : z === 'OVERSTAFFED' ? '用人偏多' : '人手不足';
});
function formatNum(v: unknown): string {
  return Number(v || 0).toLocaleString();
}
</script>
<style scoped>
.labor-productivity-card { padding: 12px; }
.headline { display: flex; align-items: baseline; gap: 4px; margin-bottom: 8px; }
.productivity { font-size: 28px; font-weight: bold; }
.per { color: #909399; font-size: 14px; }
.diagnosis { margin: 8px 0; }
.detail { display: flex; justify-content: space-between; font-size: 12px; color: #909399; }
</style>
