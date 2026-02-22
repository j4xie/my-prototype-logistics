/**
 * useSmartBIStatistical - Statistical/Causal analysis composable
 * Extracted from SmartBIAnalysis.vue (P5 statistical analysis)
 */
import { ref, computed, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import echarts from '@/utils/echarts';
import { statisticalAnalysis, getUploadTableData, renameMeaninglessColumns } from '@/api/smartbi';
import type { StatisticalResult } from '@/api/smartbi';

interface SheetRef {
  uploadId?: number;
  sheetName: string;
}

export function useSmartBIStatistical(deps: {
  sheetRawDataCache: Map<number, Record<string, unknown>[]>;
}) {
  const statisticalVisible = ref(false);
  const statisticalLoading = ref(false);
  const statisticalResult = ref<StatisticalResult | null>(null);

  const distributionTableData = computed(() => {
    if (!statisticalResult.value?.distributions) return [];
    return Object.entries(statisticalResult.value.distributions).map(([col, d]) => ({
      column: col,
      mean: (d.mean ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      median: (d.median ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      std: (d.std ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      min: (d.min ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      max: (d.max ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      distributionType: d.distributionType ?? 'unknown',
      isNormal: d.isNormal ?? false,
      cv: (d.coefficientOfVariation ?? 0).toFixed(1) + '%',
    }));
  });

  const distributionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'normal': '正态分布',
      'skewed_right': '右偏分布',
      'skewed_left': '左偏分布',
      'bimodal': '双峰分布',
      'uniform': '均匀分布',
      'heavy_tailed': '重尾分布',
      'unknown': '未知',
    };
    return labels[type] || type;
  };

  const openStatisticalAnalysis = () => {
    statisticalResult.value = null;
    statisticalLoading.value = false;
    statisticalVisible.value = true;
  };

  const runStatisticalAnalysis = async (sheet: SheetRef) => {
    if (!sheet.uploadId) {
      ElMessage.warning('该 Sheet 没有持久化数据');
      return;
    }

    statisticalLoading.value = true;
    statisticalResult.value = null;

    try {
      let rawData = deps.sheetRawDataCache.get(sheet.uploadId);
      if (!rawData) {
        const tableRes = await getUploadTableData(sheet.uploadId, 0, 2000);
        const rawTableData = (tableRes.success && tableRes.data?.data) ? tableRes.data.data as Record<string, unknown>[] : [];
        rawData = renameMeaninglessColumns(rawTableData);
        deps.sheetRawDataCache.set(sheet.uploadId, rawData);
      }

      const result = await statisticalAnalysis({ data: rawData });
      statisticalResult.value = result;

      if (result.success && result.correlations?.matrix && Object.keys(result.correlations.matrix).length >= 2) {
        renderStatHeatmap(result.correlations.matrix);
      }
    } catch (error) {
      console.error('Statistical analysis failed:', error);
      statisticalResult.value = {
        success: false,
        distributions: {},
        correlations: { matrix: {}, strongPositive: [], strongNegative: [] },
        comparisons: {},
        outlierSummary: {},
        processingTimeMs: 0,
        error: '统计分析失败'
      };
    } finally {
      statisticalLoading.value = false;
    }
  };

  const renderStatHeatmap = async (matrix: Record<string, Record<string, number>>) => {
    await nextTick();
    setTimeout(() => {
      const dom = document.getElementById('stat-heatmap-chart');
      if (!dom) return;
      let instance = echarts.getInstanceByDom(dom);
      if (!instance) instance = echarts.init(dom, 'cretas');

      const measures = Object.keys(matrix);
      const data: [number, number, number][] = [];
      for (let i = 0; i < measures.length; i++) {
        for (let j = 0; j < measures.length; j++) {
          data.push([i, j, Math.round((matrix[measures[i]]?.[measures[j]] ?? 0) * 100) / 100]);
        }
      }

      instance.setOption({
        tooltip: {
          position: 'top',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter: (p: any) => `${measures[p.data[0]]} vs ${measures[p.data[1]]}<br/>相关系数: ${p.data[2]}`
        },
        grid: { left: '18%', right: '10%', bottom: '18%', top: '5%', containLabel: true },
        xAxis: { type: 'category', data: measures, splitArea: { show: true }, axisLabel: { rotate: 45, fontSize: 10 } },
        yAxis: { type: 'category', data: measures, splitArea: { show: true }, axisLabel: { fontSize: 10 } },
        visualMap: {
          min: -1, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: '0%',
          inRange: { color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'] }
        },
        series: [{ name: '相关系数', type: 'heatmap', data, label: { show: true, fontSize: 10 }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }]
      }, { notMerge: true });
    }, 300);
  };

  const disposeStatHeatmap = () => {
    // Reset state to prevent stale data from crashing the template on next open
    statisticalLoading.value = false;
    statisticalResult.value = null;
    const dom = document.getElementById('stat-heatmap-chart');
    if (dom) {
      const instance = echarts.getInstanceByDom(dom);
      if (instance) instance.dispose();
    }
  };

  return {
    statisticalVisible,
    statisticalLoading,
    statisticalResult,
    distributionTableData,
    distributionTypeLabel,
    openStatisticalAnalysis,
    runStatisticalAnalysis,
    disposeStatHeatmap,
  };
}
