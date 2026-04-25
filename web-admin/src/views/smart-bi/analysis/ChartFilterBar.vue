<template>
  <div v-if="filter" class="chart-filter-bar">
    <el-icon><Filter /></el-icon>
    <span>过滤: {{ filter.dimension }} = <strong>{{ filter.value }}</strong></span>
    <el-button type="primary" link size="small" @click="$emit('clear')">清除过滤</el-button>
  </div>
</template>

<script setup lang="ts">
import { Filter } from '@element-plus/icons-vue';

defineProps<{
  filter: { dimension: string; value: string } | null;
}>();

defineEmits<{
  (e: 'clear'): void;
}>();
</script>
