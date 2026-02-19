/**
 * useSmartBIDrillDown - Chart drill-down composable
 * Extracted from SmartBIAnalysis.vue (P4 multi-level drill-down)
 */
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import echarts from '@/utils/echarts';
import { chartDrillDown, getUploadTableData, renameMeaninglessColumns } from '@/api/smartbi';
import type { DrillDownResult } from '@/api/smartbi';

interface SheetRef {
  uploadId?: number;
  sheetName: string;
  sheetIndex: number;
  flowResult?: {
    charts?: Array<{ chartType: string; title: string; config: Record<string, unknown>; xField?: string }>;
  };
}

interface DrillLevel {
  dimension: string;
  filterValue: string;
  result: DrillDownResult;
  hierarchyType?: string;
  currentLevel?: number;
}

const MAX_DRILL_DEPTH = 10;

export function useSmartBIDrillDown(deps: {
  sheetRawDataCache: Map<number, Record<string, unknown>[]>;
  processEChartsOptions: (opts: Record<string, unknown>) => Record<string, unknown>;
  waitForElement: (id: string) => Promise<HTMLElement | null>;
  getSheetCharts: (s: SheetRef) => Array<{ chartType: string; title: string; config: Record<string, unknown>; xField?: string }>;
}) {
  const drillDownVisible = ref(false);
  const drillDownLoading = ref(false);
  const drillDownResult = ref<DrillDownResult | null>(null);
  const drillDownContext = ref<{ dimension: string; filterValue: string; sheetName: string }>({
    dimension: '', filterValue: '', sheetName: ''
  });
  const drillStack = ref<DrillLevel[]>([]);
  const currentDrillSheet = ref<SheetRef | null>(null);

  /** Infer numeric measure columns from raw data */
  const inferMeasures = (rawData: Record<string, unknown>[]): string[] => {
    const measures: string[] = [];
    if (rawData.length > 0) {
      for (const key of Object.keys(rawData[0])) {
        const sample = rawData.slice(0, 10);
        const numCount = sample.filter(r => {
          const v = r[key];
          return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)));
        }).length;
        if (numCount >= 5) measures.push(key);
      }
    }
    return measures;
  };

  /** Render drill-down chart into DOM */
  const renderDrillDownChart = async (config: Record<string, unknown>, registerClick = false) => {
    const dom = await deps.waitForElement('drill-down-chart');
    if (!dom) return;

    try {
      let instance = echarts.getInstanceByDom(dom);
      if (!instance) instance = echarts.init(dom, 'cretas');
      instance.setOption(deps.processEChartsOptions(config), { notMerge: true });

      if (registerClick) {
        instance.off('click');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        instance.on('click', (params: any) => {
          if (drillDownLoading.value) return;
          if (!params.name) return;
          const sheet = currentDrillSheet.value;
          if (!sheet?.uploadId) return;
          if (drillStack.value.length >= MAX_DRILL_DEPTH) {
            ElMessage.warning(`已达到最大下钻深度 (${MAX_DRILL_DEPTH} 层)`);
            return;
          }

          if (drillDownResult.value) {
            drillStack.value.push({
              dimension: drillDownContext.value.dimension,
              filterValue: drillDownContext.value.filterValue,
              result: drillDownResult.value,
              hierarchyType: drillDownResult.value.hierarchy?.type,
              currentLevel: drillDownResult.value.current_level ?? undefined,
            });
          }

          const availDims = drillDownResult.value?.available_dimensions;
          const nextDim = availDims?.length ? availDims[0] : drillDownContext.value.dimension;
          const clickValue = params.name;

          drillDownContext.value = {
            dimension: nextDim,
            filterValue: clickValue,
            sheetName: sheet.sheetName,
          };
          drillDownLoading.value = true;
          drillDownResult.value = null;

          (async () => {
            try {
              const rawData = deps.sheetRawDataCache.get(sheet.uploadId!);
              if (!rawData) return;
              const measures = inferMeasures(rawData);
              const breadcrumb = drillStack.value.map(l => ({ dimension: l.dimension, value: l.filterValue }));
              const hierarchy = drillStack.value[drillStack.value.length - 1]?.hierarchyType;

              const result = await chartDrillDown({
                uploadId: sheet.uploadId!,
                sheetName: sheet.sheetName,
                dimension: nextDim,
                filterValue: clickValue,
                measures: measures.length > 0 ? measures : ['amount', 'revenue', 'profit'],
                data: rawData,
                hierarchyType: hierarchy,
                breadcrumb,
              });

              drillDownResult.value = result;
              if (result.success && result.chartConfig) {
                renderDrillDownChart(result.chartConfig!, true);
              }
            } catch (error) {
              console.error('Continue drill failed:', error);
              drillDownResult.value = { success: false, error: '继续下钻失败' };
            } finally {
              drillDownLoading.value = false;
            }
          })();
        });
      }
    } catch (error) {
      console.error('Failed to render drill-down chart:', error);
    }
  };

  /** Handle chart click → start drill-down */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartDrillDown = async (sheet: SheetRef, chartIndex: number, params: any) => {
    if (drillDownLoading.value) return;
    if (!params.name && !params.seriesName) return;
    if (!sheet.uploadId) return;

    const charts = deps.getSheetCharts(sheet);
    const chartItem = charts[chartIndex];
    if (!chartItem) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dimension = (chartItem as any).xField || '';
    if (!dimension) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = chartItem.config as any;
      if (config?.xAxis?.name) {
        dimension = config.xAxis.name;
      }
    }
    if (!dimension) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = chartItem.config as any;
      if (config?.xAxis?.type === 'category' && Array.isArray(config.xAxis.data) && config.xAxis.data.length > 0) {
        const firstCat = config.xAxis.data[0];
        if (typeof firstCat === 'string' && isNaN(Number(firstCat))) {
          dimension = '分类';
        }
      }
    }
    if (!dimension) {
      const flowCharts = sheet.flowResult?.charts;
      if (flowCharts?.length) {
        for (const fc of flowCharts) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((fc as any).xField) { dimension = (fc as any).xField; break; }
        }
      }
    }

    const filterValue = params.name || params.seriesName || '';
    if (!filterValue) return;

    drillDownContext.value = {
      dimension: dimension || '项目',
      filterValue,
      sheetName: sheet.sheetName
    };
    drillStack.value = [];
    currentDrillSheet.value = sheet;
    drillDownVisible.value = true;
    drillDownLoading.value = true;
    drillDownResult.value = null;

    try {
      let rawData = deps.sheetRawDataCache.get(sheet.uploadId);
      if (!rawData) {
        const tableRes = await getUploadTableData(sheet.uploadId, 0, 2000);
        const rawTableData = (tableRes.success && tableRes.data?.data) ? tableRes.data.data as Record<string, unknown>[] : [];
        rawData = renameMeaninglessColumns(rawTableData);
        deps.sheetRawDataCache.set(sheet.uploadId, rawData);
      }

      const measures = inferMeasures(rawData);

      const result = await chartDrillDown({
        uploadId: sheet.uploadId,
        sheetName: sheet.sheetName,
        dimension: drillDownContext.value.dimension,
        filterValue,
        measures: measures.length > 0 ? measures : ['amount', 'revenue', 'profit'],
        data: rawData
      });

      drillDownResult.value = result;

      if (result.success && result.chartConfig) {
        renderDrillDownChart(result.chartConfig!, true);
      }
    } catch (error) {
      console.error('Drill-down failed:', error);
      drillDownResult.value = { success: false, error: '下钻分析失败' };
    } finally {
      drillDownLoading.value = false;
    }
  };

  /** Drill deeper by specified dimension */
  const drillByDimension = async (targetDimension: string) => {
    const sheet = currentDrillSheet.value;
    if (!sheet?.uploadId || !drillDownResult.value) return;
    if (drillStack.value.length >= MAX_DRILL_DEPTH) {
      ElMessage.warning(`已达到最大下钻深度 (${MAX_DRILL_DEPTH} 层)`);
      return;
    }

    drillStack.value.push({
      dimension: drillDownContext.value.dimension,
      filterValue: drillDownContext.value.filterValue,
      result: drillDownResult.value,
      hierarchyType: drillDownResult.value.hierarchy?.type,
      currentLevel: drillDownResult.value.current_level ?? undefined,
    });

    drillDownContext.value = {
      dimension: targetDimension,
      filterValue: '',
      sheetName: sheet.sheetName
    };
    drillDownLoading.value = true;
    drillDownResult.value = null;

    try {
      const rawData = deps.sheetRawDataCache.get(sheet.uploadId);
      if (!rawData) return;

      const measures = inferMeasures(rawData);
      const breadcrumb = drillStack.value.map(l => ({ dimension: l.dimension, value: l.filterValue }));

      const result = await chartDrillDown({
        uploadId: sheet.uploadId,
        sheetName: sheet.sheetName,
        dimension: targetDimension,
        filterValue: '',
        measures: measures.length > 0 ? measures : ['amount', 'revenue', 'profit'],
        data: rawData,
        breadcrumb,
      });

      drillDownResult.value = result;
      if (result.success && result.chartConfig) {
        renderDrillDownChart(result.chartConfig!, true);
      }
    } catch (error) {
      console.error('Drill deeper failed:', error);
      drillDownResult.value = { success: false, error: '继续下钻失败' };
    } finally {
      drillDownLoading.value = false;
    }
  };

  /** Navigate back to root level */
  const drillBackToRoot = () => {
    if (drillStack.value.length === 0) return;
    const first = drillStack.value[0];
    drillStack.value = [];
    drillDownResult.value = first.result;
    drillDownContext.value.dimension = first.dimension;
    drillDownContext.value.filterValue = first.filterValue;
    if (first.result.chartConfig) {
      renderDrillDownChart(first.result.chartConfig as Record<string, unknown>, false);
    }
  };

  /** Navigate back to specific level */
  const drillBackTo = (index: number) => {
    if (index >= drillStack.value.length) return;
    const target = drillStack.value[index];
    drillStack.value = drillStack.value.slice(0, index);
    drillDownResult.value = target.result;
    drillDownContext.value.dimension = target.dimension;
    drillDownContext.value.filterValue = target.filterValue;
    if (target.result.chartConfig) {
      renderDrillDownChart(target.result.chartConfig as Record<string, unknown>, false);
    }
  };

  return {
    drillDownVisible,
    drillDownLoading,
    drillDownResult,
    drillDownContext,
    drillStack,
    currentDrillSheet,
    handleChartDrillDown,
    drillByDimension,
    drillBackToRoot,
    drillBackTo,
    inferMeasures,
  };
}
