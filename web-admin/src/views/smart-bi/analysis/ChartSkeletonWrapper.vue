<template>
  <div v-if="visible" class="chart-skeleton-wrapper">
    <div v-if="chartsTotal" class="chart-progress-hint">
      图表加载中 {{ charts }}/{{ chartsTotal }}...
    </div>
    <ChartSkeleton type="chart" />
    <ChartSkeleton type="chart" />
  </div>
</template>

<script setup lang="ts">
import ChartSkeleton from '@/components/smartbi/ChartSkeleton.vue';

defineProps<{
  visible: boolean;
  charts: number;
  chartsTotal: number;
}>();
</script>
