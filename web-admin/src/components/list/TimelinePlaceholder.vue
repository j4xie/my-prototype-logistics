<script setup lang="ts">
import { Clock } from '@element-plus/icons-vue';

/**
 * U-VIEW-1 — timeline view placeholder. Full impl Sprint 5.
 */
</script>

<template>
  <el-empty description="时间线视图将在 Sprint 5 上线" :image-size="120">
    <template #image>
      <el-icon :size="64" color="var(--el-text-color-placeholder)">
        <Clock />
      </el-icon>
    </template>
  </el-empty>
</template>
