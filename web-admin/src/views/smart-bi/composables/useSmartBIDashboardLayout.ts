/**
 * useSmartBIDashboardLayout - Dashboard layout persistence composable
 * Extracted from SmartBIAnalysis.vue (P6 dashboard builder)
 */
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { DashboardLayout, ChartDefinition } from '@/components/smartbi/DashboardBuilder.vue';

export function useSmartBIDashboardLayout() {
  const layoutEditMode = ref(false);
  const dashboardLayouts = ref<Map<number, DashboardLayout>>(new Map());

  const availableChartDefinitions: ChartDefinition[] = [
    { type: 'bar', name: '柱状图', defaultWidth: 6, defaultHeight: 3, minWidth: 3, minHeight: 2 },
    { type: 'line', name: '折线图', defaultWidth: 6, defaultHeight: 3, minWidth: 3, minHeight: 2 },
    { type: 'pie', name: '饼图', defaultWidth: 4, defaultHeight: 3, minWidth: 3, minHeight: 2 },
    { type: 'area', name: '面积图', defaultWidth: 6, defaultHeight: 3, minWidth: 3, minHeight: 2 },
    { type: 'scatter', name: '散点图', defaultWidth: 6, defaultHeight: 3, minWidth: 4, minHeight: 2 },
    { type: 'waterfall', name: '瀑布图', defaultWidth: 8, defaultHeight: 3, minWidth: 4, minHeight: 3 },
  ];

  const saveLayout = (uploadId: number, layout: DashboardLayout) => {
    const key = `smartbi-layout-${uploadId}`;
    localStorage.setItem(key, JSON.stringify(layout));
  };

  const loadSavedLayout = (uploadId: number): DashboardLayout | null => {
    const key = `smartbi-layout-${uploadId}`;
    const saved = localStorage.getItem(key);
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const chartsToLayout = (
    charts: Array<{ chartType: string; title: string; config: Record<string, unknown> }>,
    sheetName: string,
    uploadId?: number
  ): DashboardLayout => {
    if (uploadId) {
      const saved = loadSavedLayout(uploadId);
      if (saved && saved.cards.length === charts.length && saved.cards.every((card, i) => card.chartType === (charts[i].chartType || 'bar'))) return saved;
    }

    return {
      id: `layout-${sheetName}`,
      name: sheetName,
      cards: charts.map((chart, i) => ({
        id: `card-${i}`,
        chartType: chart.chartType || 'bar',
        title: chart.title || `图表${i + 1}`,
        x: (i % 2) * 6,
        y: Math.floor(i / 2) * 3,
        w: i === 0 ? 12 : 6,
        h: i === 0 ? 4 : 3,
        config: chart.config
      }))
    };
  };

  const layoutCacheMap = new Map<string, DashboardLayout>();
  const getCachedLayout = (
    sheet: { uploadId?: number; sheetIndex: number; sheetName: string },
    getSheetCharts: (s: unknown) => Array<{ chartType: string; title: string; config: Record<string, unknown> }>
  ): DashboardLayout => {
    const charts = getSheetCharts(sheet);
    const cacheKey = `${sheet.uploadId}-${sheet.sheetIndex}-${charts.length}`;
    const cached = layoutCacheMap.get(cacheKey);
    if (cached) return cached;
    const layout = chartsToLayout(charts, sheet.sheetName, sheet.uploadId);
    layoutCacheMap.set(cacheKey, layout);
    return layout;
  };

  const handleLayoutChange = (_layout: DashboardLayout) => {
    // Update internal reference (no-op placeholder)
  };

  const handleLayoutSave = (layout: DashboardLayout, uploadId?: number) => {
    if (uploadId) {
      saveLayout(uploadId, layout);
      ElMessage.success('布局已保存');
    }
  };

  return {
    layoutEditMode,
    dashboardLayouts,
    availableChartDefinitions,
    chartsToLayout,
    getCachedLayout,
    handleLayoutChange,
    handleLayoutSave,
    saveLayout,
    loadSavedLayout,
  };
}
