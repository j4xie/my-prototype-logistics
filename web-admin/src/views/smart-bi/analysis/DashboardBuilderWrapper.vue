<template>
  <div v-show="visible" class="builder-wrapper">
    <DashboardBuilder
      :layout="layout"
      :available-charts="availableCharts"
      :editable="true"
      @layout-change="(l: DashboardLayout) => $emit('layout-change', l)"
      @save="(l: DashboardLayout) => $emit('save', l)"
      @card-configure="() => {}"
    >
      <template #card-content="{ card }">
        <!-- ECharts mounts into id 'builder-chart-${card.id}' from script-side composables -->
        <div :id="`builder-chart-${card.id}`" class="builder-chart-el" style="width:100%;height:100%;"></div>
      </template>
    </DashboardBuilder>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import type { DashboardLayout, ChartDefinition } from '@/components/smartbi/DashboardBuilder.vue';

const DashboardBuilder = defineAsyncComponent(() => import('@/components/smartbi/DashboardBuilder.vue'));

defineProps<{
  visible: boolean;
  layout: DashboardLayout | null;
  availableCharts: ChartDefinition[];
}>();

defineEmits<{
  (e: 'layout-change', layout: DashboardLayout): void;
  (e: 'save', layout: DashboardLayout): void;
}>();
</script>
