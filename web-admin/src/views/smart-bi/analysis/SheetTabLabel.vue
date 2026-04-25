<template>
  <span class="custom-tab-label" :class="{ 'is-index': isIndex, 'is-failed': !success }">
    <el-icon v-if="!success" color="#F56C6C"><WarningFilled /></el-icon>
    <el-icon v-else-if="isIndex"><List /></el-icon>
    <el-icon v-else><Document /></el-icon>
    <span>{{ displayName }}</span>
    <el-tag v-if="!success" size="small" type="danger">失败</el-tag>
    <el-tag v-else-if="!isIndex" size="small" type="info">{{ savedRows }}行</el-tag>
  </span>
</template>

<script setup lang="ts">
import { WarningFilled, List, Document } from '@element-plus/icons-vue';

defineProps<{
  isIndex: boolean;
  success: boolean;
  displayName: string;
  savedRows: number;
}>();
</script>
