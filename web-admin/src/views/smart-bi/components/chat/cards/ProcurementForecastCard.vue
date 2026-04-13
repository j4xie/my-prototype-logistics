<template>
  <div class="procurement-forecast-card">
    <h4>采购预测</h4>
    <div class="summary">
      <span class="stat">预测 {{ data.days_planned ?? 0 }} 天</span>
      <span class="divider">|</span>
      <span class="stat">预计总营收: <strong class="revenue">¥{{ formatNum(data.total_forecast_revenue) }}</strong></span>
      <span class="divider">|</span>
      <span class="stat">预计总客数: {{ formatNum(data.total_forecast_covers) }} 人</span>
    </div>
    <el-table v-if="plan.length" :data="plan" size="small" stripe>
      <el-table-column prop="day" label="日期/星期" width="120" />
      <el-table-column label="预测营收" align="right" width="120">
        <template #default="{ row }">
          <strong>¥{{ formatNum(row.forecast_revenue) }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="预测客数" align="right" width="100">
        <template #default="{ row }">{{ formatNum(row.forecast_covers) }} 人</template>
      </el-table-column>
      <el-table-column label="节假日系数" align="center" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.holiday_multiplier !== 1.0" type="warning" size="small">
            ×{{ row.holiday_multiplier }}
          </el-tag>
          <span v-else class="normal">正常</span>
        </template>
      </el-table-column>
    </el-table>
    <div class="total-row">
      <span>合计预测营收: <strong class="revenue">¥{{ formatNum(data.total_forecast_revenue) }}</strong></span>
    </div>
    <p v-if="data.note" class="note">{{ data.note }}</p>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ data: Record<string, unknown> }>();
const plan = computed(() => (props.data?.daily_plan as Array<Record<string, unknown>>) ?? []);
function formatNum(v: unknown): string {
  return Number(v || 0).toLocaleString();
}
</script>
<style scoped>
.procurement-forecast-card { padding: 12px; }
.summary { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 13px; color: #606266; }
.stat { font-weight: 500; }
.divider { color: #dcdfe6; }
.revenue { color: #409eff; font-size: 15px; }
.normal { color: #909399; font-size: 12px; }
.total-row { margin-top: 10px; padding: 8px 12px; background: #f0f7ff; border-radius: 4px; font-size: 13px; }
.note { margin-top: 10px; font-size: 12px; color: #909399; font-style: italic; }
</style>
