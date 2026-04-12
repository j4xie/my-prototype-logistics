<template>
  <div class="bom-variance-card">
    <h4>BOM 成本差异归因</h4>
    <div v-if="summary" class="summary">
      <el-tag :type="severity === 'HIGH' ? 'danger' : severity === 'MEDIUM' ? 'warning' : 'success'" size="small">
        {{ severity }}
      </el-tag>
      <span class="dominant">主因: {{ summary.dominant_factor === 'supply_chain' ? '供应链 (采购价)' : '管理 (用量)' }}</span>
    </div>
    <el-table v-if="items.length" :data="items" size="small" stripe>
      <el-table-column prop="sku" label="SKU" width="120" />
      <el-table-column prop="price_variance" label="供应链差异" align="right">
        <template #default="{ row }">
          <span :class="row.price_variance > 0 ? 'red' : 'green'">{{ formatCurrency(row.price_variance) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="usage_variance" label="管理差异" align="right">
        <template #default="{ row }">
          <span :class="row.usage_variance > 0 ? 'red' : 'green'">{{ formatCurrency(row.usage_variance) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="total_variance" label="总差异" align="right">
        <template #default="{ row }">
          <strong :class="row.total_variance > 0 ? 'red' : 'green'">{{ formatCurrency(row.total_variance) }}</strong>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ data: Record<string, unknown> }>();
const items = computed(() => (props.data?.items as Array<Record<string, unknown>>) ?? []);
const summary = computed(() => props.data?.summary as Record<string, unknown> | undefined);
const severity = computed(() => (summary.value?.severity as string) ?? 'LOW');
function formatCurrency(v: unknown): string {
  const n = Number(v);
  return (n >= 0 ? '+' : '') + n.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' });
}
</script>
<style scoped>
.bom-variance-card { padding: 12px; }
.summary { margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
.red { color: #f56c6c; }
.green { color: #67c23a; }
</style>
