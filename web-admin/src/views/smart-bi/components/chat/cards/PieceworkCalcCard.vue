<template>
  <div class="piecework-calc-card">
    <h4>计件提成计算</h4>
    <div class="summary">
      <span class="stat">岗位数: <strong>{{ data.roles_counted ?? 0 }}</strong></span>
      <span class="divider">|</span>
      <span class="stat">总发放: <strong class="highlight">¥{{ Number(data.total_payout ?? 0).toLocaleString() }}</strong></span>
    </div>
    <el-table v-if="roleResults.length" :data="roleResults" size="small" stripe>
      <el-table-column prop="role" label="岗位" width="80" />
      <el-table-column label="模式" width="70" align="center">
        <template #default="{ row }">
          <el-tag :type="row.calc_mode === 'TEAM' ? 'info' : 'success'" size="small">{{ row.calc_mode }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="actual_units" label="实际量" align="right" width="80" />
      <el-table-column prop="threshold" label="起算量" align="right" width="80" />
      <el-table-column prop="base_earned" label="底薪" align="right" width="80">
        <template #default="{ row }">¥{{ row.base_earned }}</template>
      </el-table-column>
      <el-table-column prop="bonus" label="奖金" align="right" width="80">
        <template #default="{ row }">
          <span :class="row.bonus > 0 ? 'bonus-positive' : ''">¥{{ row.bonus }}</span>
        </template>
      </el-table-column>
      <el-table-column label="合计/人" align="right">
        <template #default="{ row }">
          <strong>¥{{ row.per_person ?? row.total }}</strong>
          <span v-if="row.team_size" class="team-hint"> (×{{ row.team_size }}人)</span>
        </template>
      </el-table-column>
    </el-table>
    <p v-if="!roleResults.length" class="empty">暂无岗位数据</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ data: Record<string, unknown> }>();
const roleResults = computed(() => (props.data?.role_results as Array<Record<string, unknown>>) ?? []);
</script>

<style scoped>
.piecework-calc-card { padding: 12px; }
h4 { margin: 0 0 10px; font-size: 14px; color: #303133; }
.summary { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 13px; color: #606266; }
.stat { font-weight: 500; }
.divider { color: #dcdfe6; }
.highlight { color: #e6a23c; font-size: 15px; }
.bonus-positive { color: #67c23a; font-weight: 600; }
.team-hint { color: #909399; font-size: 11px; }
.empty { color: #909399; font-style: italic; font-size: 12px; }
</style>
