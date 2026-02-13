<script setup lang="ts">
/**
 * YoYComparisonPanel — Year-over-Year comparison dialog content.
 * Extracted from SmartBIAnalysis.vue (AUDIT-026) to reduce god-component size.
 *
 * Props: receives YoY result, loading state, sheet list for selection.
 * Emits: sheet selection for running analysis, visibility changes.
 */
import { ref, watch } from 'vue';
import { Loading } from '@element-plus/icons-vue';
import YoYMoMComparisonChart from '@/components/smartbi/YoYMoMComparisonChart.vue';
import type { ComparisonData } from '@/components/smartbi/YoYMoMComparisonChart.vue';
import type { YoYResult, YoYComparisonItem } from '@/api/smartbi';

interface SheetOption {
  uploadId?: number;
  displayName: string;
}

const props = defineProps<{
  visible: boolean;
  loading: boolean;
  result: YoYResult | null;
  sheetName: string;
  dataSheets: SheetOption[];
}>();

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  (e: 'selectSheet', index: number): void;
}>();

const dialogVisible = ref(props.visible);
watch(() => props.visible, (v) => { dialogVisible.value = v; });
watch(dialogVisible, (v) => { emit('update:visible', v); });

function transformYoYData(comparison: YoYComparisonItem[]): ComparisonData[] {
  return comparison.map(item => ({
    period: item.label,
    current: item.currentValue,
    lastYearSame: item.previousValue,
    yoyGrowth: item.yoyGrowth ?? 0
  }));
}

function handleSelectSheet(index: number) {
  emit('selectSheet', index);
}
</script>

<template>
  <el-dialog v-model="dialogVisible" title="年度同比分析" width="90%" top="3vh">
    <!-- Sheet 选择器 -->
    <div v-if="!loading && !result" class="yoy-sheet-selector">
      <p style="margin-bottom: 12px; color: #606266;">选择要进行同比分析的报表：</p>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        <el-button
          v-for="(sheet, idx) in dataSheets"
          :key="sheet.uploadId ?? idx"
          @click="handleSelectSheet(idx)"
          size="default"
        >
          {{ sheet.displayName }}
        </el-button>
      </div>
    </div>

    <div v-if="loading" class="cross-sheet-loading">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <p>正在查询历史数据并生成同比分析...</p>
    </div>

    <div v-else-if="result && result.success && result.comparison.length > 0">
      <div style="margin-bottom: 16px; color: #86909c; font-size: 13px;">
        <span v-if="result.currentPeriod">当期: {{ result.currentPeriod }}</span>
        <span v-if="result.comparePeriod"> vs 对比期: {{ result.comparePeriod }}</span>
      </div>
      <YoYMoMComparisonChart
        :title="sheetName"
        :data="transformYoYData(result.comparison)"
        metric="金额"
        unit="元"
        :showViewToggle="true"
        defaultViewMode="yoy"
        :height="450"
      />
    </div>

    <div v-else-if="result && !result.success">
      <el-empty :description="result.error || '同比分析失败'" />
    </div>

    <div v-else-if="result && result.comparison.length === 0">
      <el-empty description="未找到可对比的历史数据。请确保已上传不同期间的同类报表。" />
    </div>
  </el-dialog>
</template>

<style lang="scss" scoped>
.yoy-sheet-selector {
  padding: 20px 0;
}

.cross-sheet-loading {
  text-align: center;
  padding: 80px 0;

  p {
    margin-top: 16px;
    color: #86909c;
  }
}
</style>
