/**
 * useSmartBICrossSheet - Cross-sheet analysis composable
 * Extracted from SmartBIAnalysis.vue (cross-sheet aggregation)
 */
import { ref, computed, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import echarts from '@/utils/echarts';
import { crossSheetAnalysis } from '@/api/smartbi';
import type { CrossSheetResult } from '@/api/smartbi';

interface SheetRef {
  uploadId?: number;
  sheetName: string;
  success?: boolean;
}

export function useSmartBICrossSheet(deps: {
  processEChartsOptions: (opts: Record<string, unknown>) => Record<string, unknown>;
  resolveEChartsOptions: (config: Record<string, unknown>) => Record<string, unknown> | null;
  enhanceChartOption: (opts: Record<string, unknown>) => void;
  waitForElement: (id: string) => Promise<HTMLElement | null>;
  isIndexSheet: (s: SheetRef) => boolean;
  getSheetDisplayName: (s: SheetRef) => string;
}) {
  const crossSheetVisible = ref(false);
  const crossSheetLoading = ref(false);
  const crossSheetResult = ref<CrossSheetResult | null>(null);
  let crossSheetAbortController: AbortController | null = null;

  const crossSheetKpiKeys = computed(() => {
    if (!crossSheetResult.value?.kpiComparison?.length) return [];
    const keys = new Set<string>();
    for (const item of crossSheetResult.value.kpiComparison) {
      if (item.kpis) Object.keys(item.kpis).forEach(k => keys.add(k));
    }
    return [...keys];
  });

  const openCrossSheetAnalysis = async (uploadedSheets: SheetRef[]) => {
    if (crossSheetAbortController) crossSheetAbortController.abort();
    crossSheetAbortController = new AbortController();
    const dataSheets = uploadedSheets.filter(s => !deps.isIndexSheet(s) && s.uploadId);
    if (dataSheets.length < 2) {
      ElMessage.warning('至少需要 2 个数据 Sheet 才能进行综合分析');
      return;
    }

    crossSheetVisible.value = true;
    crossSheetLoading.value = true;
    crossSheetResult.value = null;

    try {
      const result = await crossSheetAnalysis({
        uploadIds: dataSheets.map(s => s.uploadId!),
        sheetNames: dataSheets.map(s => deps.getSheetDisplayName(s))
      });

      crossSheetResult.value = result;

      if (result.success && result.charts?.length) {
        await nextTick();
        renderCrossSheetCharts(result.charts!);
      }
    } catch (error) {
      console.error('Cross-sheet analysis failed:', error);
      crossSheetResult.value = { success: false, error: '综合分析失败' };
    } finally {
      crossSheetLoading.value = false;
    }
  };

  const renderCrossSheetCharts = async (charts: Array<{ chartType: string; title: string; config: Record<string, unknown> }>) => {
    for (let idx = 0; idx < charts.length; idx++) {
      const chart = charts[idx];
      const dom = await deps.waitForElement(`cross-chart-${idx}`);
      if (!dom) continue;

      try {
        const config = chart.config;
        if (!config) continue;

        const options = deps.resolveEChartsOptions(config);
        if (options) {
          let instance = echarts.getInstanceByDom(dom);
          if (!instance) instance = echarts.init(dom, 'cretas');
          const processed = deps.processEChartsOptions(options);
          deps.enhanceChartOption(processed);
          instance.setOption(processed, { notMerge: true });
        }
      } catch (error) {
        console.error(`Failed to render cross-chart ${idx}:`, error);
      }
    }
  };

  return {
    crossSheetVisible,
    crossSheetLoading,
    crossSheetResult,
    crossSheetKpiKeys,
    openCrossSheetAnalysis,
    renderCrossSheetCharts,
  };
}
