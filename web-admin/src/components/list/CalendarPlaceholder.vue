<script setup lang="ts">
import { Calendar } from '@element-plus/icons-vue';

/**
 * U-VIEW-1 — calendar view placeholder. Full impl Sprint 5.
 */
</script>

<template>
  <el-empty description="日历视图将在 Sprint 5 上线" :image-size="120">
    <template #image>
      <el-icon :size="64" color="var(--el-text-color-placeholder)">
        <Calendar />
      </el-icon>
    </template>
  </el-empty>
</template>
