<template>
  <div v-if="visible" class="demo-cache-banner">
    <div class="cache-banner-left">
      <el-icon><CircleCheckFilled /></el-icon>
      <span>已从缓存加载「{{ fileName }}」的分析结果，无需等待</span>
    </div>
    <el-button type="primary" link size="small" @click="$emit('refresh')">
      <el-icon><Refresh /></el-icon>
      从服务器刷新
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { CircleCheckFilled, Refresh } from '@element-plus/icons-vue';

defineProps<{
  visible: boolean;
  fileName: string;
}>();

defineEmits<{
  (e: 'refresh'): void;
}>();
</script>
