<template>
  <div class="shift-analysis-card">
    <h4>排班结构分析</h4>
    <div class="summary">
      <span class="stat">总人数: <strong>{{ data.total_headcount ?? 0 }}</strong></span>
      <span class="divider">|</span>
      <span class="stat">全职: <strong>{{ data.full_time_count ?? 0 }}</strong></span>
      <span class="divider">|</span>
      <span class="stat">兼职: <strong>{{ data.part_time_count ?? 0 }}</strong></span>
      <span class="divider">|</span>
      <el-tag :type="ftRatioTagType" size="small">全职占比 {{ data.full_time_ratio ?? 0 }}%</el-tag>
    </div>
    <el-table :data="metricsRows" size="small" stripe class="metrics-table">
      <el-table-column prop="label" label="指标" width="160" />
      <el-table-column prop="value" label="数值" align="right" />
    </el-table>
    <div v-if="recommendations.length" class="recommendations">
      <div class="rec-title">建议</div>
      <ul>
        <li v-for="(rec, i) in recommendations" :key="i">{{ rec }}</li>
      </ul>
    </div>
    <p v-if="data.benchmark" class="benchmark">参考: {{ data.benchmark }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ data: Record<string, unknown> }>();
const recommendations = computed(() => (props.data?.recommendations as string[]) ?? []);
const ftRatioTagType = computed(() => {
  const ratio = Number(props.data?.full_time_ratio ?? 0);
  return ratio > 80 ? 'danger' : ratio > 65 ? 'warning' : 'success';
});
const metricsRows = computed(() => [
  { label: '全职人均工时', value: `${props.data?.full_time_avg_hours ?? 0} h` },
  { label: '兼职时薪', value: `¥${props.data?.part_time_hourly_cost ?? 0}` },
  { label: '总人力成本', value: `¥${Number(props.data?.total_labor_cost ?? 0).toLocaleString()}` },
  { label: '人力成本占比', value: `${props.data?.labor_cost_pct ?? 0}%` },
  { label: '人均产出', value: `¥${Number(props.data?.productivity_per_person ?? 0).toLocaleString()}` },
]);
</script>

<style scoped>
.shift-analysis-card { padding: 12px; }
h4 { margin: 0 0 10px; font-size: 14px; color: #303133; }
.summary { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 13px; color: #606266; flex-wrap: wrap; }
.stat { font-weight: 500; }
.divider { color: #dcdfe6; }
.metrics-table { margin-bottom: 12px; }
.recommendations { background: #f0f9eb; border: 1px solid #b3e19d; border-radius: 4px; padding: 10px 14px; margin-top: 10px; }
.rec-title { font-weight: 600; font-size: 12px; color: #529b2e; margin-bottom: 6px; }
.recommendations ul { margin: 0; padding-left: 16px; }
.recommendations li { font-size: 12px; color: #529b2e; line-height: 1.6; }
.benchmark { margin-top: 10px; font-size: 11px; color: #909399; font-style: italic; }
</style>
