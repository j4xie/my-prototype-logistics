<template>
  <el-dialog v-model="modelVisible" title="全 Sheet 综合分析" width="90%" top="3vh" fullscreen>
    <div v-if="loading" class="cross-sheet-loading">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <p>正在汇总所有 Sheet 数据，生成跨表综合分析...</p>
    </div>

    <div v-else-if="result">
      <!-- 高管摘要 -->
      <div v-if="result.aiSummary" class="cross-summary-banner">
        <div class="summary-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
        </div>
        <div class="summary-text" v-html="formatAnalysis(result.aiSummary)"></div>
      </div>

      <!-- KPI 对比卡片 -->
      <div v-if="result.kpiComparison?.length" class="cross-kpi-section">
        <h3>各 Sheet 核心指标对比</h3>
        <el-table :data="result.kpiComparison" border stripe size="small">
          <el-table-column prop="sheetName" label="报表" min-width="180" fixed />
          <template v-for="kpiKey in kpiKeys" :key="kpiKey">
            <el-table-column :label="getColumnLabel(kpiKey)" min-width="120">
              <template #default="{ row }">
                {{ row.kpis?.[kpiKey] != null ? Number(row.kpis[kpiKey]).toLocaleString() : '-' }}
              </template>
            </el-table-column>
          </template>
        </el-table>
      </div>

      <!-- 综合图表 (chart elements rendered by parent's composable callback into ids cross-chart-${idx}) -->
      <div v-if="result.charts?.length" class="cross-charts-section">
        <h3>综合可视化</h3>
        <div class="cross-chart-grid">
          <div v-for="(chart, idx) in result.charts" :key="idx" class="cross-chart-item">
            <div class="chart-title">{{ cleanDisplayLabel(chart.title || '分析图表') }}</div>
            <div :id="`cross-chart-${idx}`" class="cross-chart-container"></div>
          </div>
        </div>
      </div>
    </div>

    <el-empty v-else description="暂无综合分析数据" />
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Loading } from '@element-plus/icons-vue';
import type { CrossSheetResult } from '@/api/smartbi';

const props = defineProps<{
  visible: boolean;
  loading: boolean;
  result: CrossSheetResult | null;
  kpiKeys: string[];
  formatAnalysis: (raw: string) => string;
  getColumnLabel: (col: string) => string;
  cleanDisplayLabel: (label: string) => string;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
}>();

const modelVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
});
</script>
