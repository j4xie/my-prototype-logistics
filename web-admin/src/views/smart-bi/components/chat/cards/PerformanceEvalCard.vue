<template>
  <div class="performance-eval-card">
    <h4>绩效 KPI 评估</h4>
    <div class="grade-row">
      <el-tag :type="gradeTagType" size="large" class="grade-badge">综合得分: {{ data.total_score ?? 0 }} / 100 &nbsp;|&nbsp; 等级: {{ data.grade ?? '-' }}</el-tag>
    </div>
    <el-table v-if="kpiDetails.length" :data="kpiDetails" size="small" stripe class="kpi-table">
      <el-table-column prop="kpi" label="KPI 指标" />
      <el-table-column prop="weight" label="权重%" align="center" width="70" />
      <el-table-column prop="target" label="目标" align="right" width="90" />
      <el-table-column prop="actual" label="实际" align="right" width="90" />
      <el-table-column prop="achievement_pct" label="达成率%" align="center" width="90">
        <template #default="{ row }">
          <span :class="row.achievement_pct >= 100 ? 'achieved' : 'not-achieved'">{{ row.achievement_pct }}%</span>
        </template>
      </el-table-column>
      <el-table-column prop="weighted_score" label="加权分" align="right" width="80">
        <template #default="{ row }"><strong>{{ row.weighted_score }}</strong></template>
      </el-table-column>
    </el-table>
    <p v-if="!kpiDetails.length" class="empty">暂无 KPI 数据</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ data: Record<string, unknown> }>();
const kpiDetails = computed(() => (props.data?.kpi_details as Array<Record<string, unknown>>) ?? []);
const gradeTagType = computed(() => {
  const g = props.data?.grade as string;
  return g === 'A' ? 'success' : g === 'B' ? 'warning' : g === 'C' ? 'info' : 'danger';
});
</script>

<style scoped>
.performance-eval-card { padding: 12px; }
h4 { margin: 0 0 10px; font-size: 14px; color: #303133; }
.grade-row { margin-bottom: 14px; }
.grade-badge { font-size: 13px; font-weight: 600; }
.kpi-table { margin-top: 4px; }
.achieved { color: #67c23a; font-weight: 600; }
.not-achieved { color: #f56c6c; }
.empty { color: #909399; font-style: italic; font-size: 12px; }
</style>
