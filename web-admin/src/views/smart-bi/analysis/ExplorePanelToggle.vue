<template>
  <div v-if="visible" class="explore-panel-toggle">
    <el-button size="small" text @click="$emit('toggle')">
      <el-icon><Operation /></el-icon>
      {{ expanded ? '收起探索面板' : '展开探索面板' }}
      <el-badge v-if="selectedCount" :value="selectedCount" type="primary" />
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { Operation } from '@element-plus/icons-vue';

defineProps<{
  visible: boolean;
  expanded: boolean;
  selectedCount: number;
}>();

defineEmits<{
  (e: 'toggle'): void;
}>();
</script>
