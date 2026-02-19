<script setup lang="ts">
/**
 * SmartBI 财务分析页面
 * 提供财务数据分析，包含利润、成本、应收、应付、预算等模块
 * Phase 6: Enhanced with DynamicChartRenderer + ChartTypeSelector for dynamic chart views
 */
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import {
  getUploadHistory,
  deduplicateUploads,
  getDynamicAnalysis,
  getUploadTableData,
  type UploadHistoryItem,
  type DynamicAnalysisResponse,
  type TableDataResponse
} from '@/api/smartbi';
import {
  recommendChart,
  batchBuildCharts,
  buildChart,
} from '@/api/smartbi/python-service';
import { ElMessage } from 'element-plus';
import {
  Refresh,
  TrendCharts,
  Wallet,
  Money,
  CreditCard,
  Document,
  Warning,
  Calendar,
  View,
  Close
} from '@element-plus/icons-vue';
import echarts from '@/utils/echarts';
import { formatNumber } from '@/utils/format-number';
import DynamicChartRenderer from '@/components/smartbi/DynamicChartRenderer.vue';
import ChartTypeSelector from '@/components/smartbi/ChartTypeSelector.vue';
import SmartBIEmptyState from '@/components/smartbi/SmartBIEmptyState.vue';
import type { ChartConfig } from '@/types/smartbi';

const route = useRoute();
const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

// 分析类型
type AnalysisType = 'profit' | 'cost' | 'receivable' | 'payable' | 'budget';
const validTabs: AnalysisType[] = ['profit', 'cost', 'receivable', 'payable', 'budget'];
const initTab = validTabs.includes(route.query.tab as AnalysisType) ? (route.query.tab as AnalysisType) : 'profit';
const analysisType = ref<AnalysisType>(initTab);

// 日期范围
const dateRange = ref<[Date, Date] | null>(null);

// 日期快捷选项
const shortcuts = [
  {
    text: '最近7天',
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 7);
      return [start, end];
    }
  },
  {
    text: '最近30天',
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 30);
      return [start, end];
    }
  },
  {
    text: '本月',
    value: () => {
      const end = new Date();
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      return [start, end];
    }
  },
  {
    text: '本季度',
    value: () => {
      const end = new Date();
      const quarter = Math.floor(end.getMonth() / 3);
      const start = new Date(end.getFullYear(), quarter * 3, 1);
      return [start, end];
    }
  },
  {
    text: '本年',
    value: () => {
      const end = new Date();
      const start = new Date(end.getFullYear(), 0, 1);
      return [start, end];
    }
  }
];

// 加载状态
const loading = ref(false);
const loadError = ref('');
const noSystemData = ref(false);

// Data quality check: flag extreme values or all-zero tabs
const dataQualityWarning = computed(() => {
  if (selectedDataSource.value !== 'system') return '';
  if (loading.value) return '';
  const kpi = kpiData.value;
  // Extremely negative profit values indicate incorrect data
  if ((kpi.grossProfit && kpi.grossProfit < -100000000) || (kpi.netProfit && kpi.netProfit < -100000000)) {
    return '系统财务数据可能不完整，显示的利润值异常偏大。建议切换到"上传数据"模式获取准确分析。';
  }
  // Per-tab zero checks
  const tab = analysisType.value;
  if (tab === 'cost' && kpi.totalCost === 0 && kpi.materialCost === 0 && kpi.laborCost === 0) {
    return '当前无成本数据，请确认系统数据已导入或切换到上传数据模式。';
  }
  if (tab === 'receivable' && kpi.totalReceivable === 0 && kpi.receivableAge30 === 0 && kpi.receivableAge90Plus === 0) {
    return '当前无应收账款数据，请确认系统数据已导入或切换到上传数据模式。';
  }
  if (tab === 'payable' && kpi.totalPayable === 0 && kpi.payableAge30 === 0 && kpi.payableAge90Plus === 0) {
    return '当前无应付账款数据，请确认系统数据已导入或切换到上传数据模式。';
  }
  if (tab === 'budget' && kpi.budgetTotal === 0 && kpi.budgetUsed === 0 && kpi.budgetRemaining === 0) {
    return '当前无预算数据，请确认系统数据已导入或切换到上传数据模式。';
  }
  return '';
});

// Whether the current tab has no chart to display (after loading completes)
const noChartForTab = computed(() => {
  if (loading.value) return false;
  if (selectedDataSource.value !== 'system') return false;
  return !chartConfig.value && !mainDynamicConfig.value;
});

// 数据源选择 — default empty, will be set after loading sources
const dataSources = ref<UploadHistoryItem[]>([]);
const selectedDataSource = ref<string>('');

// AI 洞察
const aiInsights = ref<string[]>([]);

// 数据预览对话框
const showDataPreview = ref(false);
const previewLoading = ref(false);
const previewPage = ref(1);
const previewData = ref<TableDataResponse>({
  headers: [],
  data: [],
  total: 0,
  page: 0,
  size: 50,
  totalPages: 0
});

// 财务 KPI 数据
interface FinanceKPI {
  // 利润相关
  grossProfit: number;
  grossProfitMargin: number | null;
  netProfit: number;
  netProfitMargin: number | null;
  // 成本相关
  totalCost: number;
  costGrowth: number;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  // 应收相关
  totalReceivable: number;
  receivableAge30: number;
  receivableAge60: number;
  receivableAge90Plus: number;
  // 应付相关
  totalPayable: number;
  payableAge30: number;
  payableAge60: number;
  payableAge90Plus: number;
  // 预算相关
  budgetTotal: number;
  budgetUsed: number;
  budgetRemaining: number;
  budgetUsageRate: number;
}

const kpiData = ref<FinanceKPI>({
  grossProfit: 0,
  grossProfitMargin: null,
  netProfit: 0,
  netProfitMargin: null,
  totalCost: 0,
  costGrowth: 0,
  materialCost: 0,
  laborCost: 0,
  overheadCost: 0,
  totalReceivable: 0,
  receivableAge30: 0,
  receivableAge60: 0,
  receivableAge90Plus: 0,
  totalPayable: 0,
  payableAge30: 0,
  payableAge60: 0,
  payableAge90Plus: 0,
  budgetTotal: 0,
  budgetUsed: 0,
  budgetRemaining: 0,
  budgetUsageRate: 0
});

// 预警列表
interface WarningItem {
  level: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  amount?: number;
}
const warnings = ref<WarningItem[]>([]);

// 图表配置 (从 API 获取) - local type, distinct from @/types/smartbi ChartConfig
interface ChartConfig_Local {
  chartType: string;
  title?: string;
  xAxisField?: string;
  yAxisField?: string;
  seriesField?: string;
  data?: Array<Record<string, unknown>>;
  options?: Record<string, unknown>;
}

interface DynamicChartConfig {
  chartType: string;
  title?: string;
  subTitle?: string;
  xAxis?: {
    type: string;
    name?: string;
    data?: string[];
  };
  yAxis?: Array<{
    type: string;
    name?: string;
    position?: string;
    min?: number;
    max?: number;
    axisLabel?: Record<string, unknown>;
  }>;
  legend?: {
    show?: boolean;
    data?: string[];
    position?: string;
    orient?: string;
  };
  series?: Array<{
    name?: string;
    type: string;
    data?: unknown[];
    yAxisIndex?: number;
    stack?: string;
    smooth?: boolean;
    areaStyle?: boolean;
    itemStyle?: Record<string, unknown>;
    label?: Record<string, unknown>;
  }>;
  tooltip?: {
    trigger?: string;
    axisPointer?: Record<string, unknown>;
    formatter?: string;
  };
  options?: Record<string, unknown>;
}

const chartConfig = ref<ChartConfig_Local | DynamicChartConfig | null>(null);
const secondaryChartConfig = ref<ChartConfig_Local | DynamicChartConfig | null>(null);

// ==================== Phase 6: Dynamic Chart Exploration ====================

// Main chart rendered via DynamicChartRenderer (when we have a typed config)
const mainDynamicConfig = ref<ChartConfig | null>(null);
const useDynamicRenderer = ref(false);

// Multi-chart exploration from dynamic data sources
interface ExplorationChart {
  id: string;
  chartType: string;
  title: string;
  config: ChartConfig;
  xField?: string;
  yFields?: string[];
}
const explorationCharts = ref<ExplorationChart[]>([]);
const explorationLoading = ref(false);

// Data info for ChartTypeSelector
const dataInfo = ref<{
  numericColumns: string[];
  categoricalColumns: string[];
  dateColumns: string[];
  rowCount: number;
}>({
  numericColumns: [],
  categoricalColumns: [],
  dateColumns: [],
  rowCount: 0,
});

// Raw dynamic data for chart rebuilding
const dynamicRawData = ref<Record<string, unknown>[]>([]);

/**
 * Build exploration charts from uploaded dynamic data
 * Uses Python recommend + batch build for multi-chart views
 */
async function buildExplorationCharts(data: Record<string, unknown>[]) {
  if (!data || data.length === 0) return;

  explorationLoading.value = true;
  dynamicRawData.value = data;

  try {
    // Step 1: Get chart recommendations from Python
    const recResult = await recommendChart(data);

    if (recResult.success && recResult.recommendations && recResult.recommendations.length > 0) {
      // Store data info for ChartTypeSelector
      if (recResult.dataInfo) {
        dataInfo.value = {
          numericColumns: recResult.dataInfo.numericColumns || [],
          categoricalColumns: recResult.dataInfo.categoricalColumns || [],
          dateColumns: recResult.dataInfo.dateColumns || [],
          rowCount: recResult.dataInfo.rowCount || data.length,
        };
      }

      // Step 2: Build charts for top 4 recommendations
      const topRecs = recResult.recommendations.slice(0, 4);
      const plans = topRecs.map(rec => ({
        chartType: rec.chartType,
        data: data,
        xField: rec.xField || dataInfo.value.categoricalColumns[0] || '',
        yFields: rec.yFields || dataInfo.value.numericColumns.slice(0, 2),
        title: rec.reason || `${rec.chartType} 图表`,
      }));

      const batchResult = await batchBuildCharts(plans);

      if (batchResult.success && batchResult.charts.length > 0) {
        explorationCharts.value = batchResult.charts
          .filter(c => c.success && c.config)
          .map((c, idx) => ({
            id: `explore-${idx}`,
            chartType: c.chartType,
            title: plans[idx]?.title || c.chartType,
            config: c.config as ChartConfig,
            xField: plans[idx]?.xField,
            yFields: plans[idx]?.yFields,
          }));
      }
    }
  } catch (error) {
    console.warn('构建探索图表失败:', error);
  } finally {
    explorationLoading.value = false;
  }
}

/**
 * Handle chart type switch from ChartTypeSelector
 */
async function handleChartTypeSwitch(chartId: string, newType: string) {
  const chart = explorationCharts.value.find(c => c.id === chartId);
  if (!chart || dynamicRawData.value.length === 0) return;

  try {
    const result = await buildChart({
      chartType: newType,
      data: dynamicRawData.value,
      xField: chart.xField,
      yFields: chart.yFields,
      title: chart.title,
    });

    if (result.success && result.option) {
      const idx = explorationCharts.value.findIndex(c => c.id === chartId);
      if (idx >= 0) {
        explorationCharts.value[idx] = {
          ...chart,
          chartType: newType,
          config: result.option as ChartConfig,
        };
      }
    } else {
      ElMessage.warning('图表类型切换失败: ' + (result.error || '未知错误'));
    }
  } catch (error) {
    console.warn('图表类型切换失败:', error);
  }
}

/**
 * Refresh a single exploration chart (re-recommend)
 */
async function handleChartRefresh(chartId: string) {
  if (dynamicRawData.value.length === 0) return;

  const chart = explorationCharts.value.find(c => c.id === chartId);
  if (!chart) return;

  // Randomly pick a different chart type
  const types = ['bar', 'line', 'pie', 'area', 'scatter', 'waterfall', 'radar'];
  const currentType = chart.chartType;
  const alternatives = types.filter(t => t !== currentType);
  const randomType = alternatives[Math.floor(Math.random() * alternatives.length)];

  await handleChartTypeSwitch(chartId, randomType);
}

/**
 * Convert main chart config to DynamicChartRenderer-compatible format
 */
function convertToDynamicConfig(config: ChartConfig_Local | DynamicChartConfig | null): ChartConfig | null {
  if (!config) return null;

  // If it already has series[], it's a DynamicChartConfig - use directly
  if ('series' in config && Array.isArray(config.series)) {
    return config as unknown as ChartConfig;
  }

  // If it's a ChartConfig_Local with data[], convert to LegacyChartConfig format
  if ('data' in config && Array.isArray(config.data)) {
    return config as unknown as ChartConfig;
  }

  return null;
}

// 图表实例 (kept for legacy fallback)
let mainChart: echarts.ECharts | null = null;

// 分析类型配置
const analysisTypes = [
  { type: 'profit' as AnalysisType, label: '利润分析', icon: TrendCharts },
  { type: 'cost' as AnalysisType, label: '成本分析', icon: Wallet },
  { type: 'receivable' as AnalysisType, label: '应收分析', icon: Money },
  { type: 'payable' as AnalysisType, label: '应付分析', icon: CreditCard },
  { type: 'budget' as AnalysisType, label: '预算分析', icon: Document }
];

onMounted(async () => {
  // 默认选择最近365天（覆盖更多财务数据）
  const end = new Date();
  const start = new Date();
  start.setTime(start.getTime() - 3600 * 1000 * 24 * 365);
  dateRange.value = [start, end];

  // Load data source list in background (for dropdown)
  loadDataSources();

  // Always default to system data for reliable KPI display
  selectedDataSource.value = 'system';
  await loadFinanceData();

  // Initialize legacy chart container (only needed for system data fallback)
  await nextTick();
  initChart();
});

// 加载数据源列表
async function loadDataSources() {
  try {
    const res = await getUploadHistory();
    if (res.success && res.data) {
      // 只显示处理成功的上传记录，按 fileName+sheetName 去重
      dataSources.value = deduplicateUploads(res.data.filter(
        (item: UploadHistoryItem) => item.status === 'COMPLETED' || item.status === 'SUCCESS'
      ));
    }
  } catch (error) {
    console.warn('加载数据源列表失败:', error);
    // 不显示错误提示，因为可能是 PostgreSQL 功能未启用
  }
}

// 数据源切换处理
async function onDataSourceChange(sourceId: string) {
  if (sourceId === 'system') {
    // 切换回系统数据
    aiInsights.value = [];
    explorationCharts.value = [];
    dynamicRawData.value = [];
    useDynamicRenderer.value = false;
    mainDynamicConfig.value = null;
    await loadFinanceData();
    // Re-init legacy chart after switching back to system data
    await nextTick();
    initChart();
  } else {
    // 加载上传的动态数据
    await loadDynamicData(Number(sourceId));
  }
}

// 加载动态数据
async function loadDynamicData(uploadId: number) {
  loading.value = true;
  loadError.value = '';
  aiInsights.value = [];
  // Reset previous data to avoid showing stale values
  resetData();

  try {
    const res = await getDynamicAnalysis(uploadId, 'finance');

    if (res.success && res.data) {
      const data = res.data as DynamicAnalysisResponse;

      // 更新 AI 洞察
      if (data.insights) {
        aiInsights.value = data.insights;
      }

      // 更新 KPI 数据 (从 kpiCards 提取)
      if (data.kpiCards && data.kpiCards.length > 0) {
        updateKpiFromDynamicData(data.kpiCards);
      }

      // 更新图表
      if (data.charts && data.charts.length > 0) {
        updateChartFromDynamicData(data.charts);
      }

      // Phase 6: Fetch raw data for exploration charts + KPI fallback
      try {
        const tableRes = await getUploadTableData(uploadId, 0, 2000);
        if (tableRes.success && tableRes.data && tableRes.data.data.length > 0) {
          const rawRows = tableRes.data.data as Record<string, unknown>[];
          buildExplorationCharts(rawRows);

          // P1-1 fallback: if backend returned no/empty KPIs, compute from raw data
          const kpi = kpiData.value;
          const allZero = kpi.grossProfit === 0 && kpi.netProfit === 0 &&
            kpi.totalCost === 0 && kpi.totalReceivable === 0 &&
            kpi.totalPayable === 0 && kpi.budgetTotal === 0;
          if (allZero) {
            computeKpiFromRawData(rawRows);
          }
        }
      } catch (e) {
        console.warn('加载探索图表数据失败:', e);
      }

      // 清空预警 (动态数据暂不支持预警)
      warnings.value = [];
    } else {
      loadError.value = res.message || '加载分析数据失败';
    }
  } catch (error) {
    console.error('加载动态数据失败:', error);
    loadError.value = '加载分析数据失败，请检查网络连接后重试';
  } finally {
    loading.value = false;
    generateSmartWarnings();
  }
}

// 从动态数据更新 KPI
function updateKpiFromDynamicData(kpiCards: DynamicAnalysisResponse['kpiCards']) {
  // 重置 KPI 数据
  resetData();

  // Track whether we matched any KPI cards by title
  let matchedCount = 0;

  for (const kpi of kpiCards) {
    const title = kpi.title?.toLowerCase() || '';
    const value = kpi.rawValue ?? 0;

    if (title.includes('毛利') && !title.includes('率')) {
      kpiData.value.grossProfit = value;
      matchedCount++;
    } else if (title.includes('毛利') && title.includes('率')) {
      kpiData.value.grossProfitMargin = value;
      matchedCount++;
    } else if (title.includes('净利') && !title.includes('率')) {
      kpiData.value.netProfit = value;
      matchedCount++;
    } else if (title.includes('净利') && title.includes('率')) {
      kpiData.value.netProfitMargin = value;
      matchedCount++;
    } else if (title.includes('成本') || title.includes('cost')) {
      kpiData.value.totalCost = value;
      matchedCount++;
    } else if (title.includes('收入') || title.includes('revenue') || title.includes('销售额')) {
      // 如果没有毛利数据，用收入作为近似
      if (kpiData.value.grossProfit === 0) {
        kpiData.value.grossProfit = value;
      }
      matchedCount++;
    } else if (title.includes('利润') || title.includes('profit')) {
      // 通用利润字段
      if (kpiData.value.netProfit === 0) {
        kpiData.value.netProfit = value;
      }
      matchedCount++;
    } else if (title.includes('预算') || title.includes('budget')) {
      kpiData.value.budgetTotal = value;
      matchedCount++;
    } else if (title.includes('应收') || title.includes('receivable')) {
      kpiData.value.totalReceivable = value;
      matchedCount++;
    } else if (title.includes('应付') || title.includes('payable')) {
      kpiData.value.totalPayable = value;
      matchedCount++;
    }
  }

  // If no KPI titles matched, assign first available cards to primary financial KPIs
  if (matchedCount === 0 && kpiCards.length > 0) {
    console.log('[FinanceAnalysis] No KPI title matches; using positional fallback for', kpiCards.length, 'cards');
    if (kpiCards[0]) kpiData.value.grossProfit = kpiCards[0].rawValue ?? 0;
    if (kpiCards[1]) kpiData.value.netProfit = kpiCards[1].rawValue ?? 0;
    if (kpiCards[2]) kpiData.value.totalCost = kpiCards[2].rawValue ?? 0;
  }
}

// P1-1: Compute KPIs from raw uploaded data when backend returns empty kpiCards
// Handles two layouts:
//   A) Column-oriented: column names contain financial keywords (e.g. "营业收入" column)
//   B) Row-oriented (profit tables): a text column contains row labels like "营业收入"
//      These labels may have encoding issues but partial Chinese text survives
function computeKpiFromRawData(rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);

  const keywordMap: Array<{ keywords: string[]; field: keyof typeof kpiData.value; isRate?: boolean }> = [
    { keywords: ['毛利率', '毛利润率'], field: 'grossProfitMargin', isRate: true },
    { keywords: ['毛利'], field: 'grossProfit' },
    { keywords: ['净利率', '净利润率'], field: 'netProfitMargin', isRate: true },
    { keywords: ['净利'], field: 'netProfit' },
    { keywords: ['营业收入', '营业收', '销售收入', '主营收入'], field: 'grossProfit' },
    { keywords: ['营业成本', '营业成', '主营成本', '成本合计'], field: 'totalCost' },
    { keywords: ['应收'], field: 'totalReceivable' },
    { keywords: ['应付'], field: 'totalPayable' },
    { keywords: ['预算'], field: 'budgetTotal' },
  ];

  // Strategy A: Column-oriented — scan column names for keywords
  let matched = false;
  for (const col of columns) {
    for (const mapping of keywordMap) {
      if (mapping.keywords.some(kw => col.includes(kw))) {
        if ((kpiData.value[mapping.field] as number) !== 0) continue;
        if (mapping.isRate) {
          const lastRow = rows[rows.length - 1];
          const val = Number(lastRow[col]);
          if (!isNaN(val)) (kpiData.value[mapping.field] as number) = val > 1 ? val : val * 100;
        } else {
          let sum = 0;
          for (const row of rows) { const val = Number(row[col]); if (!isNaN(val)) sum += val; }
          (kpiData.value[mapping.field] as number) = sum;
        }
        matched = true;
        break;
      }
    }
  }
  // Only skip Strategy B if primary KPIs (grossProfit or netProfit) were populated
  const primaryPopulated = kpiData.value.grossProfit !== 0 || kpiData.value.netProfit !== 0;
  if (matched && primaryPopulated) {
    console.log('[FinanceAnalysis] KPI fallback Strategy A (column names):', { ...kpiData.value });
    return;
  }

  // Strategy B: Row-oriented (profit tables) — scan ALL text column values for keywords
  // Find text columns: have diverse string values (not just numbers-as-strings)
  const textCols: string[] = [];
  const numericCols: string[] = [];
  for (const col of columns) {
    const sampleVals = rows.slice(0, Math.min(20, rows.length)).map(r => r[col]);
    const nonNull = sampleVals.filter(v => v !== null && v !== undefined && String(v) !== '');
    if (nonNull.length === 0) continue;

    const numericCount = nonNull.filter(v => !isNaN(Number(v))).length;
    if (numericCount >= nonNull.length * 0.7) {
      numericCols.push(col);
    } else {
      // Check it has Chinese-like text (non-ASCII chars, length > 1)
      const hasText = nonNull.some(v => String(v).length > 1 && /[^\x00-\x7F]/.test(String(v)));
      if (hasText) textCols.push(col);
    }
  }

  // Prefer an "annual total actual" column for the value
  // Collect candidates containing '合' + ('实际'|'年'), then rank:
  //   1. Contains '本年实际' (best: annual actual total)
  //   2. Contains '实际' but not '预算' (actual, not budget)
  //   3. Any other match (fallback)
  let totalCol = '';
  const totalCandidates: string[] = [];
  for (const col of numericCols) {
    if (col.includes('合') && (col.includes('实') || col.includes('年'))) {
      totalCandidates.push(col);
    }
  }
  if (totalCandidates.length > 0) {
    // Rank by preference: 本年实际 > 实际 (non-预算) > anything
    totalCol = totalCandidates.find(c => c.includes('本年实际'))
      || totalCandidates.find(c => c.includes('实际') && !c.includes('预算'))
      || totalCandidates.find(c => c.includes('实际'))
      || totalCandidates[0];
  }

  if (textCols.length > 0 && numericCols.length > 0) {
    for (const row of rows) {
      // Check all text columns for keyword matches
      let rowLabel = '';
      for (const tc of textCols) {
        const val = String(row[tc] || '').trim();
        if (val && val.length > 1) { rowLabel = val; break; }
      }
      if (!rowLabel) continue;

      for (const mapping of keywordMap) {
        if (mapping.keywords.some(kw => rowLabel.includes(kw))) {
          if ((kpiData.value[mapping.field] as number) !== 0) continue;

          if (mapping.isRate) {
            // For rates, prefer the total column or last numeric column
            const src = totalCol || numericCols[numericCols.length - 1];
            const val = Number(row[src]);
            if (!isNaN(val) && val !== 0) {
              (kpiData.value[mapping.field] as number) = Math.abs(val) <= 1 ? val * 100 : val;
            }
          } else {
            // For amounts, prefer annual total column; fallback to sum of numeric cols
            if (totalCol) {
              const val = Number(row[totalCol]);
              if (!isNaN(val)) (kpiData.value[mapping.field] as number) = val;
            } else {
              let rowSum = 0;
              for (const nc of numericCols) {
                const val = Number(row[nc]);
                if (!isNaN(val)) rowSum += val;
              }
              (kpiData.value[mapping.field] as number) = rowSum;
            }
          }
          break;
        }
      }
    }
    console.log('[FinanceAnalysis] KPI fallback Strategy B (row labels):', { ...kpiData.value });
  }
}

// 从动态数据更新图表
function updateChartFromDynamicData(charts: DynamicAnalysisResponse['charts']) {
  if (charts.length === 0) return;

  // 使用第一个图表 - convert to DynamicChartRenderer format
  const chart = charts[0];
  const labels = chart.data?.labels || [];
  const datasets = chart.data?.datasets || [];

  if (chart.type === 'pie') {
    // 转换饼图为 LegacyChartConfig 格式给 DynamicChartRenderer
    const pieData = labels.map((label, idx) => ({
      name: label,
      value: datasets[0]?.data?.[idx] || 0
    }));
    mainDynamicConfig.value = {
      chartType: 'pie',
      title: chart.title,
      xAxisField: 'name',
      yAxisField: 'value',
      data: pieData,
    } as ChartConfig;
    useDynamicRenderer.value = true;
  } else {
    // 转换柱状/折线为 DashboardChartConfig 格式
    mainDynamicConfig.value = {
      chartType: chart.type,
      title: chart.title || '',
      xAxis: { data: labels },
      series: datasets.map(ds => ({
        name: ds.label,
        type: chart.type || 'bar',
        data: ds.data,
      })),
    } as ChartConfig;
    useDynamicRenderer.value = true;
  }

  // Legacy fallback: still update raw echarts if it's initialized
  if (mainChart) {
    let option: echarts.EChartsOption;

    if (chart.type === 'pie') {
      const pieData = labels.map((label, idx) => ({
        name: label,
        value: datasets[0]?.data?.[idx] || 0
      }));
      option = {
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { orient: 'vertical', right: '10%', top: 'center' },
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['40%', '50%'],
          data: pieData,
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
          }
        }]
      };
    } else {
      option = {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: chart.type === 'line' ? 'cross' : 'shadow' }
        },
        grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
        xAxis: { type: 'category', data: labels },
        yAxis: {
          type: 'value',
          axisLabel: {
            formatter: (value: number) => {
              const abs = Math.abs(value);
              if (abs >= 100000000) return (value / 100000000).toFixed(1) + '亿';
              if (abs >= 10000) return (value / 10000).toFixed(0) + '万';
              return String(value);
            }
          }
        },
        series: datasets.map(ds => ({
          name: ds.label,
          type: chart.type as 'bar' | 'line',
          data: ds.data,
          smooth: chart.type === 'line',
          itemStyle: { color: '#409EFF' }
        }))
      };
    }

    mainChart.setOption(option, true);
  }
}

// Only reload system finance data when analysis type or date range changes
// Skip if using dynamic (uploaded) data source — those are not filtered by date/type
watch([analysisType, dateRange], () => {
  if (selectedDataSource.value === 'system') {
    loadFinanceData();
  }
});

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function loadFinanceData() {
  if (!factoryId.value || !dateRange.value) return;

  loading.value = true;
  loadError.value = '';
  // Reset previous chart/warnings to avoid stale data when switching analysis types
  chartConfig.value = null;
  warnings.value = [];
  mainDynamicConfig.value = null;
  useDynamicRenderer.value = false;
  try {
    const startDate = formatDate(dateRange.value[0]);
    const endDate = formatDate(dateRange.value[1]);

    const response = await get(
      `/${factoryId.value}/smart-bi/analysis/finance`,
      {
        params: {
          startDate,
          endDate,
          analysisType: analysisType.value
        }
      }
    );

    if (response.success && response.data) {
      // Handle double-wrapped response: interceptor wraps {code,data:{...}} into {success,data:{code,data:{...}}}
      const raw = response.data as Record<string, unknown>;
      const data = (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data) && raw.code)
        ? raw.data as Record<string, unknown>
        : raw;

      // 提取 metrics 数据到 kpiData
      if (data.metrics) {
        if (Array.isArray(data.metrics)) {
          // Backend returns List<MetricResult> — convert metricCode→value map
          const metricCodeMap: Record<string, string> = {
            'AR_BALANCE': 'totalReceivable',
            'COLLECTION_RATE': 'collectionRate',
            'AGING_30_RATIO': 'receivableAge30Ratio',
            'AGING_60_RATIO': 'receivableAge60Ratio',
            'AGING_90_RATIO': 'receivableAge90Ratio',
            'AP_BALANCE': 'totalPayable',
            'BUDGET_TOTAL': 'budgetTotal',
            'BUDGET_USED': 'budgetUsed',
            'BUDGET_REMAINING': 'budgetRemaining',
            'BUDGET_USAGE_RATE': 'budgetUsageRate',
            'GROSS_PROFIT': 'grossProfit',
            'GROSS_MARGIN': 'grossProfitMargin',
            'NET_PROFIT': 'netProfit',
            'NET_MARGIN': 'netProfitMargin',
            'TOTAL_COST': 'totalCost',
          };
          const flat: Record<string, unknown> = {};
          for (const m of data.metrics as Array<Record<string, unknown>>) {
            const code = String(m.metricCode || '');
            const mappedKey = metricCodeMap[code];
            if (mappedKey) flat[mappedKey] = m.value;
          }
          updateKpiDataFromMetrics(flat);
        } else {
          updateKpiDataFromMetrics(data.metrics as Record<string, unknown>);
        }
      }

      // Extract aging bucket AMOUNTS from agingChart.data into KPI cards
      if (data.agingChart && typeof data.agingChart === 'object') {
        const agingData = (data.agingChart as Record<string, unknown>).data;
        if (Array.isArray(agingData)) {
          for (const bucket of agingData as Array<Record<string, unknown>>) {
            const label = String(bucket.agingBucket || '');
            const amount = Number(bucket.amount || 0);
            if (label.includes('0-30')) kpiData.value.receivableAge30 = amount;
            else if (label.includes('31-60') || label.includes('30-60')) kpiData.value.receivableAge60 = amount;
            else if (label.includes('90')) kpiData.value.receivableAge90Plus = amount;
          }
        }
      }

      // 提取 overview 数据 (当没有 analysisType 时)
      if (data.overview) {
        const overview = data.overview as Record<string, unknown>;
        if (overview.kpiCards) {
          updateKpiDataFromKpiCards(overview.kpiCards as Array<Record<string, unknown>>);
        }
        // Extract chart from overview.charts map — pick chart matching current analysisType
        if (overview.charts && typeof overview.charts === 'object') {
          const charts = overview.charts as Record<string, unknown>;
          const chartKeys = Object.keys(charts);
          // Map analysis type to chart keyword priorities
          const keywordMap: Record<string, string[]> = {
            profit: ['利润', '趋势'],
            cost: ['成本', '结构'],
            receivable: ['应收', '账龄'],
            payable: ['应付', '账龄'],
            budget: ['预算', '执行', '达成'],
          };
          const keywords = keywordMap[analysisType.value] || ['趋势', '利润'];
          const matchKey = chartKeys.find(k => keywords.some(kw => k.includes(kw)));
          // No fallback to chartKeys[0] — prevents budget tab showing profit chart
          if (matchKey && charts[matchKey]) {
            chartConfig.value = charts[matchKey] as ChartConfig | DynamicChartConfig;
            updateChart();
          }
        }
        // Extract AI insights as warnings — filtered by current analysisType
        if (overview.aiInsights && Array.isArray(overview.aiInsights)) {
          const typeKeywords: Record<string, string[]> = {
            profit: ['利润', '毛利', '净利', '营收', '收入', '盈利', 'profit', 'revenue', 'margin'],
            cost: ['成本', '费用', '支出', '开销', 'cost', 'expense'],
            receivable: ['应收', '回款', '账龄', '逾期', 'receivable', 'overdue'],
            payable: ['应付', '付款', '账期', 'payable', 'payment'],
            budget: ['预算', '达成', '偏差', 'budget', 'variance'],
          };
          const keywords = typeKeywords[analysisType.value] || [];
          const allInsights = (overview.aiInsights as Array<Record<string, unknown>>).map(insight => ({
            level: String(insight.level || 'info').toLowerCase() === 'red' ? 'danger' as const : 'warning' as const,
            title: String(insight.category || ''),
            description: String(insight.message || ''),
            amount: 0
          }));
          // Filter: only show warnings relevant to current tab (by keyword match in title or description)
          const filtered = keywords.length > 0
            ? allInsights.filter(w => keywords.some(kw => w.title.includes(kw) || w.description.includes(kw)))
            : allInsights;
          // Only show warnings relevant to current tab — no fallback to unrelated warnings
          warnings.value = filtered;
        }
      }

      // Also try profitMetrics for KPI data
      if (data.profitMetrics && Array.isArray(data.profitMetrics)) {
        updateKpiDataFromKpiCards(data.profitMetrics as Array<Record<string, unknown>>);
      }

      // 提取图表配置 (按analysisType优先匹配, 避免budget显示profit趋势)
      if (!chartConfig.value) {
        // Type-specific chart priority map
        const chartPriorityMap: Record<string, string[]> = {
          profit: ['trendChart', 'waterfall', 'comparison'],
          cost: ['costStructure', 'structureChart', 'trendChart'],
          receivable: ['receivableAging', 'agingChart', 'trendChart'],
          payable: ['agingChart', 'structureChart', 'trendChart'],
          budget: ['waterfall', 'comparison', 'structureChart', 'trendChart'],
        };
        const priorities = chartPriorityMap[analysisType.value] || Object.keys(chartPriorityMap.profit);
        // Only try type-specific keys — no generic fallback to avoid cross-type chart leaking
        for (const key of priorities) {
          if (data[key]) {
            chartConfig.value = data[key] as ChartConfig | DynamicChartConfig;
            updateChart();
            break;
          }
        }
      }

      // 提取预警列表 (if not already set from overview.aiInsights)
      if (warnings.value.length === 0) {
        if (data.warnings) {
          warnings.value = data.warnings as WarningItem[];
        } else if (data.overdueRanking) {
          const ranking = data.overdueRanking as Array<Record<string, unknown>>;
          warnings.value = ranking.slice(0, 5).map((item, index) => ({
            level: index < 2 ? 'danger' : 'warning',
            title: String(item.customerName || '未知客户'),
            description: `逾期 ${item.overdueDays || 0} 天`,
            amount: Number(item.overdueAmount || 0)
          })) as WarningItem[];
        }
      }

      // Check if system data is effectively empty (no charts, all KPIs zero)
      const hasChart = !!chartConfig.value;
      const hasNonZeroKpi = Object.values(kpiData.value).some(v => typeof v === 'number' && v !== 0);
      noSystemData.value = !hasChart && !hasNonZeroKpi;

      // Auto-switch to uploaded data if system data is empty and uploads exist
      if (noSystemData.value && dataSources.value.length > 0) {
        const firstUpload = dataSources.value[0];
        selectedDataSource.value = String(firstUpload.id);
        await loadDynamicData(firstUpload.id);
        return;
      }
    } else {
      loadError.value = response.message || '加载财务数据失败';
      resetData();
    }
  } catch (error) {
    console.error('加载财务数据失败:', error);
    loadError.value = '加载财务数据失败，请检查网络连接后重试';
    resetData();
  } finally {
    loading.value = false;
    generateSmartWarnings();
  }
}

function updateKpiDataFromMetrics(metrics: Record<string, unknown>) {
  // 利润相关
  if (metrics.grossProfit !== undefined) kpiData.value.grossProfit = Number(metrics.grossProfit);
  if (metrics.grossProfitMargin !== undefined) kpiData.value.grossProfitMargin = Number(metrics.grossProfitMargin);
  if (metrics.netProfit !== undefined) kpiData.value.netProfit = Number(metrics.netProfit);
  if (metrics.netProfitMargin !== undefined) kpiData.value.netProfitMargin = Number(metrics.netProfitMargin);

  // 成本相关
  if (metrics.totalCost !== undefined) kpiData.value.totalCost = Number(metrics.totalCost);
  if (metrics.costGrowth !== undefined) kpiData.value.costGrowth = Number(metrics.costGrowth);
  if (metrics.materialCost !== undefined) kpiData.value.materialCost = Number(metrics.materialCost);
  if (metrics.laborCost !== undefined) kpiData.value.laborCost = Number(metrics.laborCost);
  if (metrics.overheadCost !== undefined) kpiData.value.overheadCost = Number(metrics.overheadCost);

  // 应收相关
  if (metrics.totalReceivable !== undefined) kpiData.value.totalReceivable = Number(metrics.totalReceivable);
  if (metrics.receivableAge30 !== undefined) kpiData.value.receivableAge30 = Number(metrics.receivableAge30);
  if (metrics.receivableAge60 !== undefined) kpiData.value.receivableAge60 = Number(metrics.receivableAge60);
  if (metrics.receivableAge90Plus !== undefined) kpiData.value.receivableAge90Plus = Number(metrics.receivableAge90Plus);
  // 支持不同的字段命名
  if (metrics.within30Days !== undefined) kpiData.value.receivableAge30 = Number(metrics.within30Days);
  if (metrics.days30To60 !== undefined) kpiData.value.receivableAge60 = Number(metrics.days30To60);
  if (metrics.over90Days !== undefined) kpiData.value.receivableAge90Plus = Number(metrics.over90Days);

  // 应付相关
  if (metrics.totalPayable !== undefined) kpiData.value.totalPayable = Number(metrics.totalPayable);
  if (metrics.payableAge30 !== undefined) kpiData.value.payableAge30 = Number(metrics.payableAge30);
  if (metrics.payableAge60 !== undefined) kpiData.value.payableAge60 = Number(metrics.payableAge60);
  if (metrics.payableAge90Plus !== undefined) kpiData.value.payableAge90Plus = Number(metrics.payableAge90Plus);

  // 预算相关
  if (metrics.budgetTotal !== undefined) kpiData.value.budgetTotal = Number(metrics.budgetTotal);
  if (metrics.budgetUsed !== undefined) kpiData.value.budgetUsed = Number(metrics.budgetUsed);
  if (metrics.budgetRemaining !== undefined) kpiData.value.budgetRemaining = Number(metrics.budgetRemaining);
  if (metrics.budgetUsageRate !== undefined) kpiData.value.budgetUsageRate = Number(metrics.budgetUsageRate);
  // 支持不同的字段命名
  if (metrics.totalBudget !== undefined) kpiData.value.budgetTotal = Number(metrics.totalBudget);
  if (metrics.usedBudget !== undefined) kpiData.value.budgetUsed = Number(metrics.usedBudget);
  if (metrics.remainingBudget !== undefined) kpiData.value.budgetRemaining = Number(metrics.remainingBudget);
  if (metrics.usageRate !== undefined) kpiData.value.budgetUsageRate = Number(metrics.usageRate);
}

function updateKpiDataFromKpiCards(kpiCards: Array<Record<string, unknown>>) {
  for (const card of kpiCards) {
    const label = String(card.title || card.metricName || card.label || '');
    const rawVal = card.rawValue ?? card.value ?? 0;
    const value = typeof rawVal === 'string' ? Number(String(rawVal).replace(/[,%]/g, '')) : Number(rawVal);

    if (label.includes('毛利') && label.includes('率')) {
      kpiData.value.grossProfitMargin = value;
    } else if (label.includes('毛利')) {
      kpiData.value.grossProfit = value;
    } else if (label.includes('净利') && label.includes('率')) {
      kpiData.value.netProfitMargin = value;
    } else if (label.includes('净利')) {
      kpiData.value.netProfit = value;
    } else if (label.includes('总成本')) {
      kpiData.value.totalCost = value;
    } else if (label.includes('应收')) {
      kpiData.value.totalReceivable = value;
    } else if (label.includes('应付')) {
      kpiData.value.totalPayable = value;
    } else if (label.includes('预算') && label.includes('使用')) {
      kpiData.value.budgetUsageRate = value;
    } else if (label.includes('预算')) {
      kpiData.value.budgetTotal = value;
    }
  }
}

// 基于 KPI 数据自动生成预警（补充后端 AI 未覆盖的场景）
function generateSmartWarnings() {
  const autoWarnings: WarningItem[] = [];
  const kpi = kpiData.value;

  if (analysisType.value === 'profit') {
    if (kpi.grossProfit < 0) {
      autoWarnings.push({
        level: 'danger',
        title: '毛利润为负',
        description: `毛利润 ${formatMoney(kpi.grossProfit)}，建议检查营业收入和成本结构`,
      });
    }
    if (kpi.netProfit < 0) {
      autoWarnings.push({
        level: 'danger',
        title: '净利润为负',
        description: `净利润 ${formatMoney(kpi.netProfit)}，企业处于亏损状态，需关注费用控制`,
      });
    }
    if (kpi.grossProfitMargin != null && kpi.grossProfitMargin < 25) {
      autoWarnings.push({
        level: 'warning',
        title: '毛利率低于行业基准',
        description: `毛利率 ${kpi.grossProfitMargin.toFixed(1)}%，食品加工行业基准为 25-35%`,
      });
    }
  }

  if (analysisType.value === 'receivable' && kpi.receivableAge90Plus > 0) {
    autoWarnings.push({
      level: 'danger',
      title: '存在高风险逾期应收',
      description: `90天以上应收账款 ${formatMoney(kpi.receivableAge90Plus)}，建议加强催收`,
      amount: kpi.receivableAge90Plus,
    });
  }

  // Append auto-warnings to existing warnings (don't overwrite backend AI warnings)
  if (autoWarnings.length > 0) {
    warnings.value = [...warnings.value, ...autoWarnings];
  }
}

function resetData() {
  kpiData.value = {
    grossProfit: 0,
    grossProfitMargin: null,
    netProfit: 0,
    netProfitMargin: null,
    totalCost: 0,
    costGrowth: 0,
    materialCost: 0,
    laborCost: 0,
    overheadCost: 0,
    totalReceivable: 0,
    receivableAge30: 0,
    receivableAge60: 0,
    receivableAge90Plus: 0,
    totalPayable: 0,
    payableAge30: 0,
    payableAge60: 0,
    payableAge90Plus: 0,
    budgetTotal: 0,
    budgetUsed: 0,
    budgetRemaining: 0,
    budgetUsageRate: 0
  };
  warnings.value = [];
  chartConfig.value = null;
}

function initChart() {
  const chartDom = document.getElementById('finance-main-chart');
  if (!chartDom) return;

  mainChart = echarts.init(chartDom, 'cretas');
  window.addEventListener('resize', handleResize);
}

function updateChart() {
  // Phase 6: Try DynamicChartRenderer first
  const dynamicCfg = convertToDynamicConfig(chartConfig.value);
  if (dynamicCfg) {
    mainDynamicConfig.value = dynamicCfg;
    useDynamicRenderer.value = true;
    return;
  }

  // Fallback to raw echarts.init
  useDynamicRenderer.value = false;
  if (!mainChart || !chartConfig.value) return;

  const config = chartConfig.value;
  const option = buildEChartsOption(config);

  if (option) {
    mainChart.setOption(option, true);
  }
}

function buildEChartsOption(config: ChartConfig_Local | DynamicChartConfig): echarts.EChartsOption | null {
  // 检查是否是 DynamicChartConfig
  if ('series' in config && Array.isArray(config.series)) {
    return buildFromDynamicConfig(config as DynamicChartConfig);
  }

  // ChartConfig_Local 格式
  const localConfig = config as ChartConfig_Local;
  if (!localConfig.data || localConfig.data.length === 0) {
    return getEmptyChartOption();
  }

  const chartType = localConfig.chartType?.toLowerCase() || 'bar';

  if (chartType === 'pie') {
    return buildPieChart(localConfig);
  } else {
    return buildAxisChart(localConfig);
  }
}

function buildFromDynamicConfig(config: DynamicChartConfig): echarts.EChartsOption {
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: config.tooltip?.trigger || 'axis',
      axisPointer: config.tooltip?.axisPointer || { type: 'shadow' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    }
  };

  // 设置标题
  if (config.title) {
    option.title = { text: config.title, subtext: config.subTitle };
  }

  // 设置图例
  if (config.legend) {
    option.legend = {
      show: config.legend.show !== false,
      data: config.legend.data,
      bottom: config.legend.position === 'bottom' ? 0 : undefined,
      top: config.legend.position === 'top' ? 0 : undefined,
      orient: config.legend.orient as 'horizontal' | 'vertical' || 'horizontal'
    };
  }

  // 设置 X 轴
  if (config.xAxis) {
    option.xAxis = {
      type: config.xAxis.type as 'category' | 'value' || 'category',
      name: config.xAxis.name,
      data: config.xAxis.data
    };
  }

  // 设置 Y 轴
  if (config.yAxis && config.yAxis.length > 0) {
    option.yAxis = config.yAxis.map(axis => ({
      type: axis.type as 'value' | 'category' || 'value',
      name: axis.name,
      position: axis.position as 'left' | 'right' || undefined,
      min: axis.min,
      max: axis.max,
      axisLabel: axis.axisLabel || {
        formatter: (value: number) => {
          if (value >= 10000) return (value / 10000).toFixed(0) + '万';
          return String(value);
        }
      }
    }));
  }

  // 设置系列
  if (config.series && config.series.length > 0) {
    option.series = config.series.map(s => {
      const seriesItem: echarts.SeriesOption = {
        name: s.name,
        type: s.type as 'line' | 'bar' | 'pie' || 'bar',
        data: s.data,
        yAxisIndex: s.yAxisIndex || 0,
        stack: s.stack,
        smooth: s.smooth,
        itemStyle: s.itemStyle,
        label: s.label
      };

      if (s.areaStyle && s.type === 'line') {
        (seriesItem as echarts.LineSeriesOption).areaStyle = {};
      }

      return seriesItem;
    }) as echarts.SeriesOption[];
  }

  return option;
}

function buildPieChart(config: ChartConfig_Local): echarts.EChartsOption {
  const xField = config.xAxisField || (config as Record<string, unknown>).xaxisField as string || 'name';
  const yField = config.yAxisField || (config as Record<string, unknown>).yaxisField as string || 'value';

  const pieData = config.data?.map(item => ({
    name: String(item[xField] || ''),
    value: Number(item[yField] || 0)
  })) || [];

  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: '10%',
      top: 'center'
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        data: pieData,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  };
}

function buildAxisChart(config: ChartConfig_Local): echarts.EChartsOption {
  const xField = config.xAxisField || (config as Record<string, unknown>).xaxisField as string || 'name';
  const yField = config.yAxisField || (config as Record<string, unknown>).yaxisField as string || 'value';
  const chartType = config.chartType?.toLowerCase() || 'bar';

  const xData = config.data?.map(item => String(item[xField] || '')) || [];
  const yData = config.data?.map(item => Number(item[yField] || 0)) || [];

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: chartType === 'line' ? 'cross' : 'shadow' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: xData
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => {
          if (value >= 10000) return (value / 10000).toFixed(0) + '万';
          return String(value);
        }
      }
    },
    series: [
      {
        type: chartType as 'bar' | 'line',
        data: yData,
        smooth: chartType === 'line',
        itemStyle: {
          color: '#409EFF'
        }
      }
    ]
  };
}

function getEmptyChartOption(): echarts.EChartsOption {
  return {
    title: {
      text: '暂无数据',
      left: 'center',
      top: 'center',
      textStyle: {
        color: '#909399',
        fontSize: 14
      }
    }
  };
}

function handleResize() {
  mainChart?.resize();
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return '--';
  return formatNumber(value, 1);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  return value.toFixed(1) + '%';
}

function getWarningTagType(level: string): 'danger' | 'warning' | 'info' {
  return level as 'danger' | 'warning' | 'info';
}

function handleRefresh() {
  if (selectedDataSource.value && selectedDataSource.value !== 'system') {
    loadDynamicData(Number(selectedDataSource.value));
  } else {
    loadFinanceData();
  }
}

// ==================== 数据预览功能 ====================

/**
 * 打开数据预览对话框
 */
async function openDataPreview() {
  if (selectedDataSource.value === 'system') {
    ElMessage.warning('请先选择一个上传的数据源');
    return;
  }

  showDataPreview.value = true;
  previewPage.value = 1;
  await loadPreviewData();
}

/**
 * 加载预览数据（分页）
 */
async function loadPreviewData() {
  const uploadId = Number(selectedDataSource.value);
  if (!uploadId) return;

  previewLoading.value = true;
  try {
    const res = await getUploadTableData(uploadId, previewPage.value - 1, 50);
    if (res.success && res.data) {
      previewData.value = res.data;
    } else {
      ElMessage.error(res.message || '获取数据失败');
    }
  } catch (error) {
    console.error('加载预览数据失败:', error);
    ElMessage.error('加载数据失败');
  } finally {
    previewLoading.value = false;
  }
}

/**
 * 预览分页变化
 */
function handlePreviewPageChange(page: number) {
  previewPage.value = page;
  loadPreviewData();
}

/**
 * 关闭数据预览
 */
function closeDataPreview() {
  showDataPreview.value = false;
}

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  mainChart?.dispose();
});
</script>

<template>
  <div class="finance-analysis-page">
    <div class="page-header">
      <div class="header-left">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/smart-bi' }">Smart BI</el-breadcrumb-item>
          <el-breadcrumb-item>财务分析</el-breadcrumb-item>
        </el-breadcrumb>
        <h1>财务分析</h1>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Refresh" @click="handleRefresh" :loading="loading">刷新</el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <el-card class="filter-card">
      <div class="filter-bar">
        <!-- 数据源选择器 -->
        <div class="filter-item">
          <span class="filter-label">
            <el-icon><Document /></el-icon>
            数据源
          </span>
          <el-select
            v-model="selectedDataSource"
            placeholder="选择数据源"
            style="width: 240px"
            @change="onDataSourceChange"
          >
            <el-option label="系统数据" value="system" />
            <el-option
              v-for="ds in dataSources"
              :key="ds.id"
              :label="`${ds.fileName}${ds.sheetName ? ' - ' + ds.sheetName : ''}`"
              :value="String(ds.id)"
            >
              <div class="datasource-option">
                <span>{{ ds.fileName }}</span>
                <span class="datasource-meta">{{ ds.sheetName }} · {{ ds.rowCount }}行</span>
              </div>
            </el-option>
          </el-select>
        </div>

        <div class="filter-item">
          <span class="filter-label">
            <el-icon><Calendar /></el-icon>
            日期范围
          </span>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            :shortcuts="shortcuts"
            value-format="YYYY-MM-DD"
            :disabled="selectedDataSource !== 'system'"
          />
        </div>

        <!-- 查看原始数据按钮 -->
        <div class="filter-item" v-if="selectedDataSource !== 'system'">
          <el-button :icon="View" @click="openDataPreview">
            查看原始数据
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 分析类型切换 -->
    <el-card class="type-switch-card">
      <div class="type-switch">
        <div
          v-for="item in analysisTypes"
          :key="item.type"
          class="type-item"
          :class="{ active: analysisType === item.type }"
          @click="analysisType = item.type"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </div>
      </div>
    </el-card>

    <!-- 加载错误提示 -->
    <el-alert
      v-if="loadError"
      type="error"
      :title="loadError"
      show-icon
      closable
      style="margin-bottom: 16px"
      @close="loadError = ''"
    >
      <el-button size="small" type="primary" @click="handleRefresh" style="margin-top: 8px">重试</el-button>
    </el-alert>

    <!-- 系统数据为空提示 -->
    <el-alert
      v-if="noSystemData && selectedDataSource === 'system' && !loading"
      type="info"
      title="暂无系统财务数据"
      description="系统财务数据表为空，请联系管理员导入数据，或切换到已上传的 Excel 数据源进行分析。"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

    <!-- 数据质量警告 -->
    <el-alert
      v-if="dataQualityWarning && !loading"
      type="warning"
      title="数据质量提示"
      :description="dataQualityWarning"
      show-icon
      :closable="true"
      style="margin-bottom: 16px"
    />

    <!-- 财务 KPI -->
    <el-row :gutter="16" class="kpi-section" v-loading="loading">
      <!-- 利润分析 KPI -->
      <template v-if="analysisType === 'profit'">
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card">
            <div class="kpi-label">毛利润</div>
            <div class="kpi-value" :style="{ color: kpiData.grossProfit < 0 ? '#dc2626' : undefined }">{{ formatMoney(kpiData.grossProfit) }}</div>
            <div class="kpi-sub">毛利率 {{ formatPercent(kpiData.grossProfitMargin) }}</div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card">
            <div class="kpi-label">净利润</div>
            <div class="kpi-value" :style="{ color: kpiData.netProfit < 0 ? '#dc2626' : undefined }">{{ formatMoney(kpiData.netProfit) }}</div>
            <div class="kpi-sub">净利率 {{ formatPercent(kpiData.netProfitMargin) }}</div>
          </el-card>
        </el-col>
      </template>

      <!-- 成本分析 KPI -->
      <template v-if="analysisType === 'cost'">
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card">
            <div class="kpi-label">总成本</div>
            <div class="kpi-value">{{ formatMoney(kpiData.totalCost) }}</div>
            <div class="kpi-sub" :class="kpiData.costGrowth >= 0 ? 'growth-down' : 'growth-up'">
              环比 {{ kpiData.costGrowth >= 0 ? '+' : '' }}{{ kpiData.costGrowth }}%
            </div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card">
            <div class="kpi-label">原材料成本</div>
            <div class="kpi-value">{{ formatMoney(kpiData.materialCost) }}</div>
            <div class="kpi-sub">占比 {{ kpiData.totalCost > 0 ? ((kpiData.materialCost / kpiData.totalCost) * 100).toFixed(0) : 0 }}%</div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card">
            <div class="kpi-label">人工成本</div>
            <div class="kpi-value">{{ formatMoney(kpiData.laborCost) }}</div>
            <div class="kpi-sub">占比 {{ kpiData.totalCost > 0 ? ((kpiData.laborCost / kpiData.totalCost) * 100).toFixed(0) : 0 }}%</div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card">
            <div class="kpi-label">间接成本</div>
            <div class="kpi-value">{{ formatMoney(kpiData.overheadCost) }}</div>
            <div class="kpi-sub">占比 {{ kpiData.totalCost > 0 ? ((kpiData.overheadCost / kpiData.totalCost) * 100).toFixed(0) : 0 }}%</div>
          </el-card>
        </el-col>
      </template>

      <!-- 应收分析 KPI -->
      <template v-if="analysisType === 'receivable'">
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card">
            <div class="kpi-label">应收总额</div>
            <div class="kpi-value">{{ formatMoney(kpiData.totalReceivable) }}</div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card success">
            <div class="kpi-label">30天内</div>
            <div class="kpi-value">{{ formatMoney(kpiData.receivableAge30) }}</div>
            <div class="kpi-sub">正常账期</div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card warning">
            <div class="kpi-label">逾期30-60天</div>
            <div class="kpi-value">{{ formatMoney(kpiData.receivableAge60) }}</div>
            <div class="kpi-sub">需关注</div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card danger">
            <div class="kpi-label">逾期90天+</div>
            <div class="kpi-value">{{ formatMoney(kpiData.receivableAge90Plus) }}</div>
            <div class="kpi-sub">高风险</div>
          </el-card>
        </el-col>
      </template>

      <!-- 应付分析 KPI -->
      <template v-if="analysisType === 'payable'">
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card">
            <div class="kpi-label">应付总额</div>
            <div class="kpi-value">{{ formatMoney(kpiData.totalPayable) }}</div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card success">
            <div class="kpi-label">30天内</div>
            <div class="kpi-value">{{ formatMoney(kpiData.payableAge30) }}</div>
            <div class="kpi-sub">正常账期</div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card warning">
            <div class="kpi-label">30-60天</div>
            <div class="kpi-value">{{ formatMoney(kpiData.payableAge60) }}</div>
            <div class="kpi-sub">即将到期</div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card danger">
            <div class="kpi-label">逾期90天+</div>
            <div class="kpi-value">{{ formatMoney(kpiData.payableAge90Plus) }}</div>
            <div class="kpi-sub">需立即处理</div>
          </el-card>
        </el-col>
      </template>

      <!-- 预算分析 KPI -->
      <template v-if="analysisType === 'budget'">
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card">
            <div class="kpi-label">年度预算</div>
            <div class="kpi-value">{{ formatMoney(kpiData.budgetTotal) }}</div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card">
            <div class="kpi-label">已使用</div>
            <div class="kpi-value">{{ formatMoney(kpiData.budgetUsed) }}</div>
            <div class="kpi-sub">使用率 {{ formatPercent(kpiData.budgetUsageRate) }}</div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card success">
            <div class="kpi-label">剩余预算</div>
            <div class="kpi-value">{{ formatMoney(kpiData.budgetRemaining) }}</div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card">
            <div class="kpi-label">预算进度</div>
            <el-progress
              :percentage="kpiData.budgetUsageRate"
              :status="kpiData.budgetUsageRate > 90 ? 'exception' : kpiData.budgetUsageRate > 75 ? 'warning' : 'success'"
              :stroke-width="12"
            />
          </el-card>
        </el-col>
      </template>
    </el-row>

    <!-- 图表和预警 -->
    <el-row :gutter="16" class="content-section">
      <el-col :xs="24" :lg="16">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <el-icon><TrendCharts /></el-icon>
              <span>{{ analysisTypes.find(t => t.type === analysisType)?.label }}图表</span>
            </div>
          </template>
          <!-- Phase 6: DynamicChartRenderer when config available -->
          <DynamicChartRenderer
            v-if="useDynamicRenderer && mainDynamicConfig"
            :config="mainDynamicConfig"
            :height="360"
          />
          <!-- No chart data for this tab -->
          <div v-else-if="noChartForTab" class="chart-empty-hint">
            <el-icon style="font-size: 40px; color: #C0C4CC;"><TrendCharts /></el-icon>
            <p style="color: #909399; margin-top: 12px;">
              当前{{ analysisTypes.find(t => t.type === analysisType)?.label || '' }}暂无图表数据
            </p>
            <p v-if="dataSources.length > 0" style="color: #409EFF; font-size: 12px; cursor: pointer;" @click="selectedDataSource = String(dataSources[0].id)">
              切换到上传数据查看分析
            </p>
          </div>
          <!-- Legacy fallback: raw echarts container -->
          <div v-else id="finance-main-chart" class="chart-container"></div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="8">
        <el-card class="warning-card">
          <template #header>
            <div class="card-header">
              <el-icon><Warning /></el-icon>
              <span>预警提醒</span>
            </div>
          </template>
          <div class="warning-list">
            <div
              v-for="(item, index) in warnings"
              :key="index"
              class="warning-item"
            >
              <el-tag :type="getWarningTagType(item.level)" size="small">
                {{ item.level === 'danger' ? '严重' : item.level === 'warning' ? '警告' : '提示' }}
              </el-tag>
              <div class="warning-content">
                <div class="warning-title">{{ item.title }}</div>
                <div class="warning-desc">{{ item.description }}</div>
                <div v-if="item.amount" class="warning-amount">
                  涉及金额: {{ formatMoney(item.amount) }}
                </div>
              </div>
            </div>
            <div v-if="warnings.length === 0" class="no-warning-hint">
              <el-icon style="font-size: 20px; color: #67C23A;"><View /></el-icon>
              <span style="color: #909399; font-size: 13px; margin-left: 6px;">当前无风险预警，经营状况良好</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- AI 洞察面板 (仅动态数据源显示) -->
    <el-card v-if="aiInsights.length > 0" class="insight-card">
      <template #header>
        <div class="card-header">
          <el-icon><TrendCharts /></el-icon>
          <span>AI 智能洞察</span>
          <el-tag type="success" size="small" style="margin-left: 8px">来自上传数据</el-tag>
        </div>
      </template>
      <div class="insight-list">
        <div
          v-for="(insight, index) in aiInsights"
          :key="index"
          class="insight-item"
        >
          <el-icon class="insight-icon"><TrendCharts /></el-icon>
          <span>{{ insight }}</span>
        </div>
      </div>
    </el-card>

    <!-- Phase 6: 动态图表探索面板 (仅动态数据源显示) -->
    <el-card v-if="explorationCharts.length > 0 || explorationLoading" class="exploration-card">
      <template #header>
        <div class="card-header">
          <el-icon><TrendCharts /></el-icon>
          <span>数据图表探索</span>
          <el-tag type="info" size="small" style="margin-left: 8px">自动推荐</el-tag>
        </div>
      </template>
      <div v-loading="explorationLoading" class="exploration-grid">
        <div
          v-for="chart in explorationCharts"
          :key="chart.id"
          class="exploration-chart-item"
        >
          <div class="exploration-chart-header">
            <span class="exploration-chart-title">{{ chart.title }}</span>
            <ChartTypeSelector
              :current-type="chart.chartType"
              :numeric-columns="dataInfo.numericColumns"
              :categorical-columns="dataInfo.categoricalColumns"
              :date-columns="dataInfo.dateColumns"
              :row-count="dataInfo.rowCount"
              @switch-type="(newType: string) => handleChartTypeSwitch(chart.id, newType)"
              @refresh="handleChartRefresh(chart.id)"
            />
          </div>
          <DynamicChartRenderer
            :config="chart.config"
            :height="280"
          />
        </div>
        <SmartBIEmptyState v-if="!explorationLoading && explorationCharts.length === 0" type="no-charts" :show-action="false" />
      </div>
    </el-card>

    <!-- 数据预览对话框 -->
    <el-dialog
      v-model="showDataPreview"
      title="数据预览"
      width="85%"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div v-loading="previewLoading" class="preview-container">
        <!-- 数据信息 -->
        <div class="preview-info">
          <span>共 {{ previewData.total }} 条数据</span>
          <span>当前第 {{ previewPage }} / {{ previewData.totalPages || 1 }} 页</span>
        </div>

        <!-- 数据表格 -->
        <el-table
          :data="previewData.data"
          stripe
          border
          height="450"
          style="width: 100%"
        >
          <el-table-column
            v-for="header in previewData.headers"
            :key="header"
            :label="header"
            :prop="header"
            min-width="120"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row[header] ?? '-' }}
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div class="preview-pagination">
          <el-pagination
            v-model:current-page="previewPage"
            :page-size="50"
            :total="previewData.total"
            layout="total, prev, pager, next, jumper"
            @current-change="handlePreviewPageChange"
          />
        </div>
      </div>

      <template #footer>
        <el-button @click="closeDataPreview">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.finance-analysis-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;

  .header-left {
    h1 {
      margin: 12px 0 0;
      font-size: 20px;
      font-weight: 600;
    }
  }
}

// 筛选栏
.filter-card {
  margin-bottom: 16px;
  border-radius: 8px;

  :deep(.el-card__body) {
    padding: 16px;
  }

  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    align-items: center;
  }

  .filter-item {
    display: flex;
    align-items: center;
    gap: 8px;

    .filter-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: #606266;
      white-space: nowrap;
    }
  }
}

// 分析类型切换
.type-switch-card {
  margin-bottom: 16px;
  border-radius: 8px;

  :deep(.el-card__body) {
    padding: 12px 16px;
  }
}

.type-switch {
  display: flex;
  gap: 12px;
  overflow-x: auto;

  .type-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 8px;
    background: #f5f7fa;
    cursor: pointer;
    transition: all 0.3s;
    white-space: nowrap;

    .el-icon {
      font-size: 18px;
      color: #909399;
    }

    span {
      font-size: 14px;
      color: #606266;
    }

    &:hover {
      background: #ecf5ff;

      .el-icon, span {
        color: #409EFF;
      }
    }

    &.active {
      background: #409EFF;

      .el-icon, span {
        color: #fff;
      }
    }
  }
}

// KPI 卡片
.kpi-section {
  margin-bottom: 16px;

  .el-col {
    margin-bottom: 16px;
  }
}

.kpi-card {
  border-radius: 8px;
  text-align: center;
  padding: 8px 0;
  border-left: 4px solid #409EFF;

  &.success {
    border-left-color: #67C23A;
  }

  &.warning {
    border-left-color: #E6A23C;
  }

  &.danger {
    border-left-color: #F56C6C;
  }

  .kpi-label {
    font-size: 13px;
    color: #909399;
    margin-bottom: 8px;
  }

  .kpi-value {
    font-size: 26px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 4px;
  }

  .kpi-sub {
    font-size: 12px;
    color: #909399;

    &.growth-up {
      color: #67C23A;
    }

    &.growth-down {
      color: #F56C6C;
    }
  }
}

// 内容区
.content-section {
  .el-col {
    margin-bottom: 16px;
  }
}

.chart-card, .warning-card {
  border-radius: 8px;
  height: 100%;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    .el-icon {
      color: #409EFF;
    }
  }
}

.chart-container {
  height: 360px;
  width: 100%;
}

.chart-empty-hint {
  height: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.warning-list {
  .warning-item {
    display: flex;
    gap: 12px;
    padding: 14px 0;
    border-bottom: 1px solid #f0f2f5;

    &:last-child {
      border-bottom: none;
    }

    .el-tag {
      flex-shrink: 0;
    }

    .warning-content {
      flex: 1;

      .warning-title {
        font-weight: 500;
        color: #303133;
        margin-bottom: 4px;
      }

      .warning-desc {
        font-size: 13px;
        color: #909399;
        margin-bottom: 4px;
      }

      .warning-amount {
        font-size: 12px;
        color: #606266;
      }
    }
  }
}

// Phase 6: 动态图表探索面板
.exploration-card {
  margin-top: 16px;
  border-radius: 8px;
  border-left: 4px solid #409EFF;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    .el-icon {
      color: #409EFF;
    }
  }
}

.exploration-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  min-height: 100px;
}

.exploration-chart-item {
  background: #fafbfc;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #ebeef5;
  transition: box-shadow 0.3s;

  &:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  }
}

.exploration-chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.exploration-chart-title {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

// 数据源选择器
.datasource-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  .datasource-meta {
    font-size: 12px;
    color: #909399;
  }
}

// AI 洞察面板
.insight-card {
  margin-top: 16px;
  border-radius: 8px;
  border-left: 4px solid #67C23A;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    .el-icon {
      color: #67C23A;
    }
  }
}

.insight-list {
  .insight-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 0;
    border-bottom: 1px solid #f0f2f5;
    line-height: 1.6;
    color: #303133;

    &:last-child {
      border-bottom: none;
    }

    .insight-icon {
      flex-shrink: 0;
      margin-top: 2px;
      color: #67C23A;
    }
  }
}

// 数据预览对话框
.preview-container {
  .preview-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 8px 12px;
    background: #f5f7fa;
    border-radius: 4px;
    font-size: 13px;
    color: #606266;
  }

  .preview-pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
}

// 响应式
@media (max-width: 1366px) {
  .chart-container {
    height: 300px;
  }

  .chart-empty-state {
    height: 300px;
  }
}

@media (max-width: 1366px) {
  .exploration-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .type-switch {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 8px;

    &::-webkit-scrollbar {
      height: 4px;
    }
  }

  .filter-bar {
    flex-direction: column;
    align-items: flex-start !important;
  }

  .filter-item {
    width: 100%;
  }

  .chart-container {
    height: 260px;
  }

  .chart-empty-state {
    height: 260px;
  }

  .exploration-grid {
    grid-template-columns: 1fr;
  }
}
</style>
