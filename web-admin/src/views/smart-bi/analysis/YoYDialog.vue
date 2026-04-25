<template>
  <el-dialog v-model="visible" title="年度同比分析" width="90%" top="3vh">
    <!-- Sheet 选择器 -->
    <div v-if="!loading && !result" class="yoy-sheet-selector">
      <p style="margin-bottom: 12px; color: var(--color-text-regular, #606266);">选择要进行同比分析的报表：</p>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        <el-button
          v-for="sheet in availableSheets"
          :key="sheet.uploadId"
          @click="runForSheet(sheet)"
          size="default"
        >
          {{ getSheetDisplayName(sheet) }}
        </el-button>
      </div>
    </div>

    <div v-if="loading" class="cross-sheet-loading">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <p>正在查询历史数据并生成同比分析...</p>
    </div>

    <div v-else-if="result && result.success && result.comparison.length > 0">
      <div style="margin-bottom: 16px; color: var(--color-text-secondary, #909399); font-size: 13px;">
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

<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue';
import { ElMessage } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';
import { yoyComparison } from '@/api/smartbi';
import type { YoYResult, YoYComparisonItem, SheetResult } from '@/api/smartbi';
import type { ComparisonData } from '@/components/smartbi/YoYMoMComparisonChart.vue';

const YoYMoMComparisonChart = defineAsyncComponent(() => import('@/components/smartbi/YoYMoMComparisonChart.vue'));

const props = defineProps<{
  availableSheets: SheetResult[];
  getSheetDisplayName: (sheet: SheetResult) => string;
}>();

const visible = ref(false);
const loading = ref(false);
const result = ref<YoYResult | null>(null);
const sheetName = ref('');

const open = () => {
  result.value = null;
  loading.value = false;
  sheetName.value = '';
  visible.value = true;
};

const runForSheet = async (sheet: SheetResult) => {
  if (!sheet.uploadId) {
    ElMessage.warning('该 Sheet 没有持久化数据');
    return;
  }

  sheetName.value = props.getSheetDisplayName(sheet);
  loading.value = true;
  result.value = null;

  try {
    const r = await yoyComparison({ uploadId: sheet.uploadId });
    result.value = r;
  } catch (error) {
    console.error('YoY comparison failed:', error);
    result.value = {
      success: false,
      currentUploadId: sheet.uploadId,
      comparison: [],
      error: '同比分析失败',
    };
  } finally {
    loading.value = false;
  }
};

const transformYoYData = (comparison: YoYComparisonItem[]): ComparisonData[] => {
  return comparison.map(item => ({
    period: item.label,
    current: item.currentValue,
    lastYearSame: item.previousValue,
    yoyGrowth: item.yoyGrowth ?? 0,
  }));
};

defineExpose({ open });
</script>
