<template>
  <div class="seat-occupancy-card">
    <h4>桌位配置分析</h4>
    <el-table v-if="rows.length" :data="rows" size="small" stripe>
      <el-table-column prop="seat_type" label="桌型" width="100" />
      <el-table-column prop="table_count" label="桌数" align="right" width="80" />
      <el-table-column prop="demand_count" label="需求量" align="right" width="80" />
      <el-table-column prop="gap" label="缺口" align="right" width="80">
        <template #default="{ row }">
          <span :class="Number(row.gap) > 0 ? 'red' : Number(row.gap) < 0 ? 'orange' : ''">
            {{ Number(row.gap) > 0 ? '+' : '' }}{{ row.gap }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag
            :type="row.status === 'SHORTAGE' ? 'danger' : row.status === 'SURPLUS' ? 'warning' : 'success'"
            size="small"
          >
            {{ row.status === 'SHORTAGE' ? '不足' : row.status === 'SURPLUS' ? '过剩' : '均衡' }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>
    <ul v-if="recommendations.length" class="recommendations">
      <li v-for="(r, i) in recommendations" :key="i">{{ r }}</li>
    </ul>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ data: Record<string, unknown> }>();
const rows = computed(() => (props.data?.seat_types as Array<Record<string, unknown>>) ?? []);
const recommendations = computed(() => (props.data?.recommendations as string[]) ?? []);
</script>
<style scoped>
.seat-occupancy-card { padding: 12px; }
.recommendations { margin-top: 12px; padding-left: 18px; font-size: 13px; color: #606266; }
.recommendations li { margin-bottom: 4px; }
.red { color: #f56c6c; }
.orange { color: #e6a23c; }
</style>
