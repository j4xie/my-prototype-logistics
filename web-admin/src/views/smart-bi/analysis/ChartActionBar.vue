<template>
  <div class="chart-action-bar">
    <el-button
      size="small"
      type="primary"
      plain
      :loading="refreshAllLoading"
      @click="$emit('refresh-all')"
    >
      <el-icon><Refresh /></el-icon>
      换一批图表
    </el-button>
    <el-button
      size="small"
      type="success"
      plain
      @click="$emit('export-excel')"
    >
      <el-icon><Download /></el-icon>
      导出 Excel
    </el-button>
    <el-button
      size="small"
      type="warning"
      plain
      @click="$emit('export-pdf')"
    >
      <el-icon><Document /></el-icon>
      导出 PDF
    </el-button>
    <span class="chart-count-hint">{{ chartCount }} 个图表</span>
    <!-- P2: Layout mode toggle -->
    <el-radio-group
      :model-value="layoutMode"
      @update:model-value="(v) => $emit('update:layoutMode', v as LayoutMode)"
      size="small"
      style="margin-left: auto;"
    >
      <el-radio-button value="compact">紧凑</el-radio-button>
      <el-radio-button value="comfortable">舒适</el-radio-button>
      <el-radio-button value="presentation">演示</el-radio-button>
    </el-radio-group>
  </div>
</template>

<script setup lang="ts">
import { Refresh, Download, Document } from '@element-plus/icons-vue';

type LayoutMode = 'compact' | 'comfortable' | 'presentation';

defineProps<{
  refreshAllLoading: boolean;
  chartCount: number;
  layoutMode: LayoutMode;
}>();

defineEmits<{
  (e: 'refresh-all'): void;
  (e: 'export-excel'): void;
  (e: 'export-pdf'): void;
  (e: 'update:layoutMode', mode: LayoutMode): void;
}>();
</script>
