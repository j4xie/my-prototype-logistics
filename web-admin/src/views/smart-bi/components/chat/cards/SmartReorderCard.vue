<template>
  <div class="smart-reorder-card">
    <h4>智能叫货单</h4>
    <div class="summary">
      <span class="stat">共 {{ data.total_ingredients ?? 0 }} 种食材</span>
      <span class="divider">|</span>
      <span class="stat highlight">需下单: {{ data.ingredients_to_order ?? 0 }} 种</span>
      <span class="divider">|</span>
      <span class="stat">提前期 {{ data.lead_days ?? 1 }} 天 × 安全系数 {{ data.safety_factor ?? 1.2 }}</span>
    </div>
    <el-table v-if="orders.length" :data="orders" size="small" stripe>
      <el-table-column prop="ingredient" label="食材" width="120" />
      <el-table-column prop="unit" label="单位" width="60" align="center" />
      <el-table-column prop="daily_need" label="日需量" align="right" width="80" />
      <el-table-column prop="current_stock" label="当前库存" align="right" width="90" />
      <el-table-column prop="order_qty" label="建议下单量" align="right" width="100">
        <template #default="{ row }">
          <strong :class="row.order_qty > 0 ? 'need-order' : 'no-order'">{{ row.order_qty }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="优先级" align="center" width="90">
        <template #default="{ row }">
          <el-tag :type="row.priority === 'HIGH' ? 'danger' : row.priority === 'MEDIUM' ? 'warning' : 'info'" size="small">
            {{ row.priority }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>
    <p v-if="data.note" class="note">{{ data.note }}</p>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ data: Record<string, unknown> }>();
const orders = computed(() => (props.data?.suggested_orders as Array<Record<string, unknown>>) ?? []);
</script>
<style scoped>
.smart-reorder-card { padding: 12px; }
.summary { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 13px; color: #606266; }
.stat { font-weight: 500; }
.highlight { color: #e6a23c; font-weight: bold; }
.divider { color: #dcdfe6; }
.need-order { color: #f56c6c; }
.no-order { color: #67c23a; }
.note { margin-top: 10px; font-size: 12px; color: #909399; font-style: italic; }
</style>
