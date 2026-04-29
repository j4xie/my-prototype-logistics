<template>
  <div v-if="enriching && !hasKpis" class="kpi-section">
    <ChartSkeleton type="kpi" />
  </div>
  <div v-else-if="hasKpis" class="kpi-section">
    <div class="kpi-grid">
      <KPICard
        v-for="kpi in kpis"
        :key="kpi.title"
        :title="kpi.title"
        :value="kpi.value"
        :unit="kpi.unit"
        :trend="kpi.trend"
        :trendValue="kpi.trendValue"
        :changeRate="kpi.changeRate"
        :status="kpi.status"
        :displayMode="kpi.displayMode"
        :sparklineData="kpi.sparklineData"
        :benchmarkLabel="kpi.benchmarkLabel"
        :benchmarkGap="kpi.benchmarkGap"
        :precision="kpi.precision"
        format="custom"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import KPICard from '@/components/smartbi/KPICard.vue';
import ChartSkeleton from '@/components/smartbi/ChartSkeleton.vue';
import type { SmartKPI } from '@/api/smartbi';

const props = defineProps<{
  enriching: boolean;
  kpis: SmartKPI[];
}>();

const hasKpis = computed(() => props.kpis && props.kpis.length > 0);
</script>
