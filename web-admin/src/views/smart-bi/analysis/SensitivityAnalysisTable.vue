<template>
  <div v-if="rows.length" class="sensitivity-analysis-section">
    <h4 style="margin: 16px 0 8px; color: var(--el-text-color-primary); font-size: 14px;">
      <el-icon style="margin-right: 4px; vertical-align: middle;"><Warning /></el-icon>
      关键驱动因素敏感性分析
    </h4>
    <el-table
      :data="rows"
      size="small"
      stripe
      :border="false"
      style="width: 100%;"
    >
      <el-table-column prop="factor" label="驱动因素" min-width="120">
        <template #default="{ row }">{{ row.factor || '-' }}</template>
      </el-table-column>
      <el-table-column prop="current_value" label="当前值" min-width="100">
        <template #default="{ row }">{{ row.current_value || '-' }}</template>
      </el-table-column>
      <el-table-column prop="impact_description" label="变动影响" min-width="240">
        <template #default="{ row }">{{ row.impact_description || '-' }}</template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { Warning } from '@element-plus/icons-vue';

interface SensitivityRow {
  factor: string;
  current_value: string;
  impact_description: string;
}

defineProps<{
  rows: SensitivityRow[];
}>();
</script>
