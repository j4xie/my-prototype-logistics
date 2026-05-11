<template>
  <div v-if="summary" class="executive-summary-banner">
    <div class="summary-icon">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
    </div>
    <div class="summary-body">
      <div class="summary-text">{{ summary }}</div>
      <!-- Inline KPIs from top 3 -->
      <div v-if="kpis.length" class="summary-inline-kpis">
        <div v-for="kpi in kpis.slice(0, 3)" :key="kpi.title" class="inline-kpi">
          <span class="inline-kpi-label">{{ kpi.title }}</span>
          <span class="inline-kpi-value">{{ kpi.value }}{{ kpi.unit }}</span>
          <span v-if="kpi.trendValue" class="inline-kpi-trend" :class="kpi.trend">{{ kpi.trendValue }}</span>
        </div>
      </div>
      <!-- Risk/Opportunity/Sensitivity tags (mapped from AIInsight: negative=risks, suggestions=opportunities) -->
      <div v-if="structuredInsight" class="summary-tags">
        <el-tag v-if="structuredInsight.negative?.items?.length" type="danger" size="small" effect="plain">
          {{ structuredInsight.negative.items.length }} 个风险
        </el-tag>
        <el-tag v-if="structuredInsight.suggestions?.items?.length" type="success" size="small" effect="plain">
          {{ structuredInsight.suggestions.items.length }} 个机会
        </el-tag>
        <el-tag v-if="sensitivityCount > 0" type="warning" size="small" effect="plain">
          {{ sensitivityCount }} 项敏感性
        </el-tag>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SmartKPI } from '@/api/smartbi';
import type { AIInsight } from '@/components/smartbi/AIInsightPanel.vue';

defineProps<{
  summary: string;
  kpis: SmartKPI[];
  structuredInsight: AIInsight | null;
  sensitivityCount: number;
}>();
</script>
