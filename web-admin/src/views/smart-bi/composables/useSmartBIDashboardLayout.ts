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
    // ---- 基础图表 (Basic) ----
    { type: 'bar', name: '柱状图', category: '基础图表', description: '对比不同类别的数值', defaultWidth: 6, defaultHeight: 3, minWidth: 3, minHeight: 2 },
    { type: 'line', name: '折线图', category: '基础图表', description: '展示数据随时间的变化趋势', defaultWidth: 6, defaultHeight: 3, minWidth: 3, minHeight: 2 },
    { type: 'pie', name: '饼图', category: '基础图表', description: '展示各部分占整体的比例', defaultWidth: 4, defaultHeight: 3, minWidth: 3, minHeight: 2 },
    { type: 'area', name: '面积图', category: '基础图表', description: '强调数量随时间变化的趋势', defaultWidth: 6, defaultHeight: 3, minWidth: 3, minHeight: 2 },
    { type: 'scatter', name: '散点图', category: '基础图表', description: '展示两个变量之间的关系', defaultWidth: 6, defaultHeight: 3, minWidth: 4, minHeight: 2 },
    { type: 'doughnut', name: '环形图', category: '基础图表', description: '饼图变体，中心可显示汇总数据', defaultWidth: 4, defaultHeight: 3, minWidth: 3, minHeight: 2 },
    { type: 'stacked_bar', name: '堆叠柱状图', category: '基础图表', description: '展示各部分构成和总量对比', defaultWidth: 6, defaultHeight: 3, minWidth: 3, minHeight: 2 },

    // ---- 高级图表 (Advanced) ----
    { type: 'waterfall', name: '瀑布图', category: '高级图表', description: '展示数值的累积增减过程', defaultWidth: 8, defaultHeight: 3, minWidth: 4, minHeight: 3 },
    { type: 'radar', name: '雷达图', category: '高级图表', description: '多维度指标综合对比', defaultWidth: 5, defaultHeight: 3, minWidth: 4, minHeight: 3 },
    { type: 'funnel', name: '漏斗图', category: '高级图表', description: '展示业务流程各阶段的转化', defaultWidth: 5, defaultHeight: 3, minWidth: 3, minHeight: 3 },
    { type: 'gauge', name: '仪表盘', category: '高级图表', description: '展示单一KPI完成进度', defaultWidth: 4, defaultHeight: 3, minWidth: 3, minHeight: 2 },
    { type: 'line_bar', name: '柱线混合图', category: '高级图表', description: '同时展示数值和趋势/比率', defaultWidth: 8, defaultHeight: 3, minWidth: 4, minHeight: 2 },
    { type: 'treemap', name: '矩形树图', category: '高级图表', description: '展示层级数据的占比关系', defaultWidth: 6, defaultHeight: 3, minWidth: 4, minHeight: 3 },

    // ---- 统计分析 (Statistical) ----
    { type: 'heatmap', name: '热力图', category: '统计分析', description: '用颜色深浅展示数据密度', defaultWidth: 8, defaultHeight: 4, minWidth: 6, minHeight: 3 },
    { type: 'boxplot', name: '箱线图', category: '统计分析', description: '展示数据分布的统计特征', defaultWidth: 6, defaultHeight: 3, minWidth: 4, minHeight: 3 },
    { type: 'candlestick', name: 'K线图', category: '统计分析', description: '展示价格/成本的波动范围', defaultWidth: 8, defaultHeight: 4, minWidth: 6, minHeight: 3 },

    // ---- 关系与层级 (Relational) ----
    { type: 'sankey', name: '桑基图', category: '关系与层级', description: '展示流量和能量的流向转化', defaultWidth: 8, defaultHeight: 4, minWidth: 6, minHeight: 3 },
    { type: 'sunburst', name: '旭日图', category: '关系与层级', description: '展示多层级占比关系', defaultWidth: 5, defaultHeight: 4, minWidth: 4, minHeight: 3 },

    // ---- 其他 (Other) ----
    { type: 'wordCloud', name: '词云', category: '其他', description: '展示关键词频率和重要性', defaultWidth: 6, defaultHeight: 3, minWidth: 4, minHeight: 2 },
    { type: 'table', name: '数据表格', category: '其他', description: '以表格形式展示明细数据', defaultWidth: 12, defaultHeight: 3, minWidth: 6, minHeight: 2 },
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
