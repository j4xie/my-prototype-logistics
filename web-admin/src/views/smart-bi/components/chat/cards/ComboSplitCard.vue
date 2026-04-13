<template>
  <div class="combo-split-card">
    <h4>套餐拆单统计</h4>
    <el-table v-if="rows.length" :data="rows" size="small" stripe>
      <el-table-column prop="dish" label="菜品" min-width="120" />
      <el-table-column prop="single_sales" label="单点销量" align="right" width="90" />
      <el-table-column prop="combo_sales" label="套餐销量" align="right" width="90" />
      <el-table-column prop="total_sales" label="合计" align="right" width="80" />
      <el-table-column label="套餐占比" align="right" width="90">
        <template #default="{ row }">
          <strong :class="Number(row.combo_pct) > 60 ? 'highlight' : ''">
            {{ row.combo_pct }}%
          </strong>
        </template>
      </el-table-column>
    </el-table>
    <p v-if="!rows.length" class="empty">暂无套餐拆单数据</p>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ data: Record<string, unknown> }>();
const rows = computed(() => (props.data?.dishes as Array<Record<string, unknown>>) ?? []);
</script>
<style scoped>
.combo-split-card { padding: 12px; }
.highlight { color: #e6a23c; }
.empty { color: #909399; font-size: 13px; margin-top: 8px; }
</style>
