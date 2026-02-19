<script setup lang="ts">
/**
 * SmartBI 销售分析页面
 * 提供销售数据的多维度分析，包含筛选、KPI、排行榜和图表
 * Phase 6: Enhanced with DynamicChartRenderer + ChartTypeSelector
 */
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import { formatNumber, formatCount } from '@/utils/format-number';
import { ElMessage } from 'element-plus';
import {
  Refresh,
  TrendCharts,
  User,
  Calendar,
  Filter,
  Download,
  Document,
  View
} from '@element-plus/icons-vue';
import echarts from '@/utils/echarts';
import DynamicChartRenderer from '@/components/smartbi/DynamicChartRenderer.vue';
import ChartTypeSelector from '@/components/smartbi/ChartTypeSelector.vue';
import SmartBIEmptyState from '@/components/smartbi/SmartBIEmptyState.vue';
import type { ChartConfig as SmartBIChartConfig } from '@/types/smartbi';
import {
  getUploadHistory,
  getUploadTableData,
  getDynamicAnalysis,
  type UploadHistoryItem,
  type DynamicAnalysisResponse,
  type TableDataResponse
} from '@/api/smartbi';
import {
  recommendChart,
  batchBuildCharts,
  buildChart,
} from '@/api/smartbi/python-service';

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

// 筛选条件
const dateRange = ref<[Date, Date] | null>(null);
const dimensionType = ref<'daily' | 'weekly' | 'monthly'>('daily');
const categoryFilter = ref<string>('all');

// 加载状态
const loading = ref(false);
const loadError = ref('');
const kpiLoading = ref(false);
const rankingLoading = ref(false);
const trendLoading = ref(false);
const pieLoading = ref(false);

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
  }
];

// KPI 卡片数据 (来自 API 的 KPICard 结构)
interface KPICard {
  key: string;
  title: string;
  value: string;
  rawValue: number | null;
  unit: string;
  change: number | null;
  changeRate: number | null;
  trend: 'up' | 'down' | 'flat';
  status: string;
  compareText: string;
}

const kpiCards = ref<KPICard[]>([]);

// 是否有真实销售数据 (区分"加载失败"和"无数据")
const hasSystemData = ref(false);

// No real system sales data — all KPIs zero or no KPI cards
const noSystemSalesData = computed(() => {
  if (loading.value || kpiLoading.value) return false;
  if (selectedDataSource.value !== 'system') return false;
  if (kpiCards.value.length === 0) return true;
  return kpiCards.value.every(c => c.rawValue == null || c.rawValue === 0);
});

// 销售员排行 (来自 API)
interface SalesPersonRank {
  name: string;
  avatar?: string;
  sales: number;
  orderCount: number;
  growth: number;
}
const salesPersonRanking = ref<SalesPersonRank[]>([]);

// 图表数据 (来自 API 的 ChartConfig 结构)
interface ChartConfig {
  chartType: string;
  title: string;
  xAxisField: string;
  yAxisField: string;
  seriesField?: string;
  data: Array<Record<string, unknown>>;
  options?: Record<string, unknown>;
}
const trendChartConfig = ref<ChartConfig | null>(null);
const pieChartConfig = ref<ChartConfig | null>(null);

// 产品类别
const categories = ref([
  { value: 'all', label: '全部类别' },
  { value: 'frozen_meat', label: '冷冻肉类' },
  { value: 'seafood', label: '海鲜产品' },
  { value: 'frozen_food', label: '速冻食品' },
  { value: 'dairy', label: '乳制品' }
]);

// 图表实例 (legacy fallback)
let trendChart: echarts.ECharts | null = null;
let pieChart: echarts.ECharts | null = null;

// ==================== Phase 6: Dynamic Chart Exploration ====================

// DynamicChartRenderer configs for main charts
const trendDynamicConfig = ref<SmartBIChartConfig | null>(null);
const pieDynamicConfig = ref<SmartBIChartConfig | null>(null);
const useDynamicTrend = ref(false);
const useDynamicPie = ref(false);

// Data source selection (uploaded data)
const dataSources = ref<UploadHistoryItem[]>([]);
const selectedDataSource = ref<string>('system');
const isDynamicMode = computed(() => selectedDataSource.value !== 'system');

// AI insights from dynamic data
const aiInsights = ref<string[]>([]);

// Data preview dialog
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

// Multi-chart exploration
interface ExplorationChart {
  id: string;
  chartType: string;
  title: string;
  config: SmartBIChartConfig;
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

// ==================== Data Source Functions ====================

async function loadDataSources() {
  try {
    const res = await getUploadHistory();
    if (res.success && res.data) {
      dataSources.value = res.data.filter(
        (item: UploadHistoryItem) => item.status === 'COMPLETED' || item.status === 'SUCCESS'
      );
    }
  } catch (error) {
    console.warn('加载数据源列表失败:', error);
  }
}

async function onDataSourceChange(sourceId: string) {
  if (sourceId === 'system') {
    aiInsights.value = [];
    explorationCharts.value = [];
    dynamicRawData.value = [];
    useDynamicTrend.value = false;
    useDynamicPie.value = false;
    trendDynamicConfig.value = null;
    pieDynamicConfig.value = null;
    loadSalesData();
  } else {
    await loadDynamicSalesData(Number(sourceId));
  }
}

async function loadDynamicSalesData(uploadId: number) {
  loading.value = true;
  loadError.value = '';
  aiInsights.value = [];

  // Reset chart state from any prior system data to avoid stale zero-value charts
  useDynamicTrend.value = false;
  useDynamicPie.value = false;
  trendDynamicConfig.value = null;
  pieDynamicConfig.value = null;
  trendChartConfig.value = null;
  pieChartConfig.value = null;
  if (trendChart) trendChart.clear();
  if (pieChart) pieChart.clear();

  try {
    const res = await getDynamicAnalysis(uploadId, 'sales');
    if (res.success && res.data) {
      const data = res.data as DynamicAnalysisResponse;

      // Update AI insights
      if (data.insights) {
        aiInsights.value = data.insights;
      }

      // Update KPI cards from dynamic data
      if (data.kpiCards && data.kpiCards.length > 0) {
        kpiCards.value = data.kpiCards.map((kpi, idx) => ({
          key: `dynamic-${idx}`,
          title: kpi.title || '',
          value: kpi.value || '0',
          rawValue: kpi.rawValue || 0,
          unit: '',
          change: 0,
          changeRate: 0,
          trend: 'flat' as const,
          status: 'green',
          compareText: '',
        }));
      }

      // Update charts from dynamic data
      if (data.charts && data.charts.length > 0) {
        updateChartsFromDynamicData(data.charts);
      }

      // Note: legacy ECharts already cleared at function start

      // Fetch raw data for exploration charts
      try {
        const tableRes = await getUploadTableData(uploadId, 0, 200);
        if (tableRes.success && tableRes.data && tableRes.data.data.length > 0) {
          buildExplorationCharts(tableRes.data.data as Record<string, unknown>[]);
        }
      } catch (e) {
        console.warn('加载探索图表数据失败:', e);
      }
    } else {
      loadError.value = res.message || '加载分析数据失败';
    }
  } catch (error) {
    console.error('加载动态数据失败:', error);
    loadError.value = '加载分析数据失败，请检查网络连接后重试';
  } finally {
    loading.value = false;
  }
}

function updateChartsFromDynamicData(charts: DynamicAnalysisResponse['charts']) {
  if (charts.length === 0) return;

  // First chart as trend
  const firstChart = charts[0];
  const labels1 = firstChart.data?.labels || [];
  const datasets1 = firstChart.data?.datasets || [];

  if (firstChart.type === 'pie') {
    const pieData = labels1.map((label, idx) => ({
      name: label,
      value: datasets1[0]?.data?.[idx] || 0
    }));
    trendDynamicConfig.value = {
      chartType: 'pie',
      title: firstChart.title,
      xAxisField: 'name',
      yAxisField: 'value',
      data: pieData,
    } as SmartBIChartConfig;
  } else {
    trendDynamicConfig.value = {
      chartType: firstChart.type || 'bar',
      title: firstChart.title || '',
      xAxis: { data: labels1 },
      series: datasets1.map(ds => ({
        name: ds.label,
        type: firstChart.type || 'bar',
        data: ds.data,
      })),
    } as SmartBIChartConfig;
  }
  useDynamicTrend.value = true;

  // Second chart as pie (if available)
  if (charts.length > 1) {
    const secondChart = charts[1];
    const labels2 = secondChart.data?.labels || [];
    const datasets2 = secondChart.data?.datasets || [];

    const pieData2 = labels2.map((label, idx) => ({
      name: label,
      value: datasets2[0]?.data?.[idx] || 0
    }));
    pieDynamicConfig.value = {
      chartType: secondChart.type || 'pie',
      title: secondChart.title,
      xAxisField: 'name',
      yAxisField: 'value',
      data: pieData2,
    } as SmartBIChartConfig;
    useDynamicPie.value = true;
  }
}

// ==================== Exploration Charts ====================

async function buildExplorationCharts(data: Record<string, unknown>[]) {
  if (!data || data.length === 0) return;

  explorationLoading.value = true;
  dynamicRawData.value = data;

  try {
    const recResult = await recommendChart(data);

    if (recResult.success && recResult.recommendations && recResult.recommendations.length > 0) {
      if (recResult.dataInfo) {
        dataInfo.value = {
          numericColumns: recResult.dataInfo.numericColumns || [],
          categoricalColumns: recResult.dataInfo.categoricalColumns || [],
          dateColumns: recResult.dataInfo.dateColumns || [],
          rowCount: recResult.dataInfo.rowCount || data.length,
        };
      }

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
            config: c.config as SmartBIChartConfig,
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
          config: result.option as SmartBIChartConfig,
        };
      }
    } else {
      ElMessage.warning('图表类型切换失败: ' + (result.error || '未知错误'));
    }
  } catch (error) {
    console.warn('图表类型切换失败:', error);
  }
}

async function handleChartRefresh(chartId: string) {
  if (dynamicRawData.value.length === 0) return;
  const chart = explorationCharts.value.find(c => c.id === chartId);
  if (!chart) return;

  const types = ['bar', 'line', 'pie', 'area', 'scatter', 'waterfall', 'radar'];
  const alternatives = types.filter(t => t !== chart.chartType);
  const randomType = alternatives[Math.floor(Math.random() * alternatives.length)];
  await handleChartTypeSwitch(chartId, randomType);
}

// ==================== Data Preview ====================

async function openDataPreview() {
  if (selectedDataSource.value === 'system') {
    ElMessage.warning('请先选择一个上传的数据源');
    return;
  }
  showDataPreview.value = true;
  previewPage.value = 1;
  await loadPreviewData();
}

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

function handlePreviewPageChange(page: number) {
  previewPage.value = page;
  loadPreviewData();
}

function closeDataPreview() {
  showDataPreview.value = false;
}

onMounted(async () => {
  // 默认选择最近30天
  const end = new Date();
  const start = new Date();
  start.setTime(start.getTime() - 3600 * 1000 * 24 * 30);
  dateRange.value = [start, end];

  // 加载数据源列表
  await loadDataSources();

  loadSalesData();
  initCharts();
});

// 监听筛选条件变化
watch([dateRange, dimensionType, categoryFilter], () => {
  loadSalesData();
});

async function loadSalesData() {
  loading.value = true;
  loadError.value = '';
  kpiLoading.value = true;
  rankingLoading.value = true;
  trendLoading.value = true;
  pieLoading.value = true;

  try {
    // Load overview data first (contains KPIs, charts, rankings in unified response)
    await loadOverviewData();

    // Load dimension-specific data in parallel (only if overview didn't populate them)
    const tasks: Promise<void>[] = [];
    if (salesPersonRanking.value.length === 0) {
      tasks.push(loadRankingData());
    } else {
      rankingLoading.value = false;
    }
    if (!trendChartConfig.value) {
      tasks.push(loadTrendData());
    } else {
      trendLoading.value = false;
    }
    if (!pieChartConfig.value) {
      tasks.push(loadProductData());
    } else {
      pieLoading.value = false;
    }
    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
    // Auto-switch to uploaded data if system data is empty and uploads exist
    const allZero = kpiCards.value.length === 0 || kpiCards.value.every(c => c.rawValue == null || c.rawValue === 0);
    if (allZero && dataSources.value.length > 0) {
      const firstUpload = dataSources.value[0];
      selectedDataSource.value = String(firstUpload.id);
      await loadDynamicSalesData(firstUpload.id);
      return;
    }
  } catch (error) {
    loadError.value = '加载销售数据失败，请检查网络连接后重试';
  } finally {
    loading.value = false;
    kpiLoading.value = false;
    rankingLoading.value = false;
    trendLoading.value = false;
    pieLoading.value = false;
  }
}

/**
 * Parse unified backend response and extract KPIs, rankings, charts.
 * The backend may return data in either:
 *   1. Unified format: { overview: { kpiCards, rankings, charts } }
 *   2. Direct format: { kpiCards, rankings, charts }  (from getComprehensiveAnalysis)
 */
function parseUnifiedResponse(data: Record<string, unknown>) {
  // Extract KPI cards from various response shapes
  const overview = data.overview as Record<string, unknown> | undefined;
  const kpiSource = overview?.kpiCards || data.kpiCards;
  if (Array.isArray(kpiSource) && kpiSource.length > 0) {
    kpiCards.value = (kpiSource as KPICard[]).map(card => ({
      ...card,
      // Ensure null safety for numeric fields
      rawValue: card.rawValue ?? null,
      change: card.change ?? null,
      changeRate: card.changeRate ?? null,
      trend: card.trend || 'flat',
      status: card.status || 'green',
      compareText: card.compareText || '',
      // Format value: show "--" if value is empty/null
      value: card.value || (card.rawValue != null ? String(card.rawValue) : '--'),
    }));
    hasSystemData.value = true;
  }

  // Extract rankings (may be in overview.rankings or data.rankings)
  const rankingsSource = (overview?.rankings || data.rankings) as Record<string, unknown[]> | undefined;
  if (rankingsSource) {
    const spRanking = rankingsSource.salesperson || rankingsSource.sales_person;
    if (Array.isArray(spRanking) && spRanking.length > 0) {
      salesPersonRanking.value = spRanking.map((item: Record<string, unknown>) => ({
        name: String(item.name || ''),
        sales: Number(item.value || item.sales || 0),
        orderCount: Number(item.orderCount || item.count || 0),
        growth: Number(item.growthRate || item.growth || 0),
      }));
    }
  }

  // Extract charts (may be in overview.charts or data.charts)
  const chartsSource = (overview?.charts || data.charts) as Record<string, ChartConfig> | undefined;
  if (chartsSource && typeof chartsSource === 'object') {
    // Try to find trend chart
    for (const [key, chart] of Object.entries(chartsSource)) {
      if (!chart) continue;
      const chartObj = chart as ChartConfig;
      if (key.includes('trend') || key.includes('趋势') || chartObj.chartType?.toLowerCase() === 'line') {
        trendChartConfig.value = chartObj;
        updateTrendChart();
      } else if (key.includes('pie') || key.includes('分布') || key.includes('占比') || chartObj.chartType?.toLowerCase() === 'pie') {
        pieChartConfig.value = chartObj;
        updatePieChart();
      }
    }
  }

  // Also check for chartList (legacy format)
  const chartList = (overview?.chartList || data.chartList) as ChartConfig[] | undefined;
  if (Array.isArray(chartList)) {
    for (const chart of chartList) {
      if (!chart) continue;
      if (!trendChartConfig.value && (chart.chartType === 'line' || chart.title?.includes('趋势'))) {
        trendChartConfig.value = chart;
        updateTrendChart();
      } else if (!pieChartConfig.value && (chart.chartType === 'pie' || chart.title?.includes('分布') || chart.title?.includes('占比'))) {
        pieChartConfig.value = chart;
        updatePieChart();
      }
    }
  }
}

/**
 * Load overview data (unified endpoint, no dimension).
 * API: GET /{factoryId}/smart-bi/analysis/sales
 *
 * The backend may return a comprehensive response that includes KPIs, rankings,
 * and charts all at once.
 */
async function loadOverviewData() {
  if (!factoryId.value || !dateRange.value) return;
  try {
    const params = {
      startDate: formatDate(dateRange.value[0]),
      endDate: formatDate(dateRange.value[1])
    };
    const response = await get(`/${factoryId.value}/smart-bi/analysis/sales`, { params });
    if (response.success && response.data) {
      // Handle double-wrapped response: interceptor wraps {code,data:{...}} into {success,data:{code,data:{...}}}
      const raw = response.data as Record<string, unknown>;
      const actualData = (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data) && raw.code)
        ? raw.data as Record<string, unknown>
        : raw;
      parseUnifiedResponse(actualData);
    } else {
      // Don't show error toast here, just log - we'll try dimension-specific calls
      console.warn('Sales overview returned non-success:', response.message);
    }
  } catch (error) {
    console.error('加载销售概览失败:', error);
    // Don't show ElMessage error here - will show loadError if all calls fail
  } finally {
    kpiLoading.value = false;
  }
}

/**
 * Load salesperson ranking (dimension-specific fallback).
 * API: GET /{factoryId}/smart-bi/analysis/sales?dimension=salesperson
 */
async function loadRankingData() {
  if (!factoryId.value || !dateRange.value) return;
  try {
    const params = {
      startDate: formatDate(dateRange.value[0]),
      endDate: formatDate(dateRange.value[1]),
      dimension: 'salesperson'
    };
    const response = await get(`/${factoryId.value}/smart-bi/analysis/sales`, { params });
    if (response.success && response.data) {
      const data = response.data as Record<string, unknown>;
      // May return { ranking: [...] } or unified response with overview.rankings
      if (Array.isArray(data.ranking)) {
        salesPersonRanking.value = (data.ranking as Record<string, unknown>[]).map(item => ({
          name: String(item.name || ''),
          sales: Number(item.value || item.sales || 0),
          orderCount: Number(item.orderCount || item.count || 0),
          growth: Number(item.growthRate || item.growth || 0),
        }));
      } else {
        // Try parsing as unified response
        parseUnifiedResponse(data);
      }
    }
  } catch (error) {
    console.warn('加载销售员排行失败:', error);
  } finally {
    rankingLoading.value = false;
  }
}

/**
 * Load trend chart data (dimension-specific fallback).
 * API: GET /{factoryId}/smart-bi/analysis/sales?dimension=trend
 */
async function loadTrendData() {
  if (!factoryId.value || !dateRange.value) return;
  try {
    const params = {
      startDate: formatDate(dateRange.value[0]),
      endDate: formatDate(dateRange.value[1]),
      dimension: 'trend'
    };
    const response = await get(`/${factoryId.value}/smart-bi/analysis/sales`, { params });
    if (response.success && response.data) {
      const data = response.data as Record<string, unknown>;
      if (data.chart) {
        trendChartConfig.value = data.chart as ChartConfig;
        updateTrendChart();
      } else {
        // Try parsing as unified response
        parseUnifiedResponse(data);
      }
    }
  } catch (error) {
    console.warn('加载趋势图失败:', error);
  } finally {
    trendLoading.value = false;
  }
}

/**
 * Load product distribution chart (dimension-specific fallback).
 * API: GET /{factoryId}/smart-bi/analysis/sales?dimension=product
 */
async function loadProductData() {
  if (!factoryId.value || !dateRange.value) return;
  try {
    const params = {
      startDate: formatDate(dateRange.value[0]),
      endDate: formatDate(dateRange.value[1]),
      dimension: 'product'
    };
    const response = await get(`/${factoryId.value}/smart-bi/analysis/sales`, { params });
    if (response.success && response.data) {
      const data = response.data as Record<string, unknown>;
      if (data.chart) {
        pieChartConfig.value = data.chart as ChartConfig;
        updatePieChart();
      } else if (data.ranking) {
        // Product dimension may return ranking data; build pie from it
        const ranking = data.ranking as Array<{ name: string; value: number }>;
        if (ranking.length > 0) {
          pieChartConfig.value = {
            chartType: 'pie',
            title: '产品类别销售占比',
            xAxisField: 'name',
            yAxisField: 'value',
            data: ranking.map(r => ({ name: r.name, value: Number(r.value || 0) })),
          };
          updatePieChart();
        }
      } else {
        parseUnifiedResponse(data);
      }
    }
  } catch (error) {
    console.warn('加载产品分布图失败:', error);
  } finally {
    pieLoading.value = false;
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function initCharts() {
  initTrendChart();
  initPieChart();
  window.addEventListener('resize', handleResize);
}

function initTrendChart() {
  const chartDom = document.getElementById('sales-trend-chart');
  if (!chartDom) return;

  trendChart = echarts.init(chartDom, 'cretas');
}

function initPieChart() {
  const chartDom = document.getElementById('sales-pie-chart');
  if (!chartDom) return;

  pieChart = echarts.init(chartDom, 'cretas');
}

/**
 * 根据 API 返回的 ChartConfig 更新趋势图
 * Phase 6: Also sets trendDynamicConfig for DynamicChartRenderer
 */
function updateTrendChart() {
  const config = trendChartConfig.value;
  if (!config || !config.data || config.data.length === 0) {
    useDynamicTrend.value = false;
    trendDynamicConfig.value = null;
    if (trendChart) {
      trendChart.setOption({
        title: {
          text: '暂无趋势数据',
          left: 'center',
          top: 'center',
          textStyle: { color: '#909399', fontSize: 14 }
        }
      });
    }
    return;
  }

  // 从 API 数据中提取 X 轴和 Y 轴数据
  // Note: Jackson serializes xAxisField as xaxisField (lowercase), handle both
  const xAxisField = config.xAxisField || (config as Record<string, unknown>).xaxisField as string || 'date';
  const yAxisField = config.yAxisField || (config as Record<string, unknown>).yaxisField as string || 'value';

  const xAxisData = config.data.map(item => String(item[xAxisField] || ''));
  const salesData = config.data.map(item => Number(item[yAxisField]) || 0);

  // 尝试获取订单数据
  const orderData = config.data.map(item => Number(item['orderCount'] || item['count']) || 0);
  const hasOrderData = orderData.some(v => v > 0);

  // Phase 6: Set DynamicChartRenderer config (LegacyChartConfig format)
  // Pass resolved field names so DynamicChartRenderer gets correct xAxisField/yAxisField
  trendDynamicConfig.value = {
    chartType: 'line',
    title: '销售趋势',
    xAxisField,
    yAxisField,
    data: config.data,
  } as SmartBIChartConfig;
  useDynamicTrend.value = true;

  // Legacy fallback: still update raw echarts
  if (!trendChart) return;

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: hasOrderData ? ['销售额', '订单数'] : ['销售额'],
      bottom: 0
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
      boundaryGap: false,
      data: xAxisData
    },
    yAxis: hasOrderData ? [
      {
        type: 'value',
        name: '销售额',
        axisLabel: {
          formatter: (value: number) => (value / 10000).toFixed(0) + '万'
        }
      },
      {
        type: 'value',
        name: '订单数',
        axisLabel: {
          formatter: '{value}'
        }
      }
    ] : [
      {
        type: 'value',
        name: '销售额',
        axisLabel: {
          formatter: (value: number) => (value / 10000).toFixed(0) + '万'
        }
      }
    ],
    series: hasOrderData ? [
      {
        name: '销售额',
        type: 'line',
        smooth: true,
        data: salesData,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
            { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
          ])
        },
        lineStyle: { width: 3, color: '#409EFF' },
        itemStyle: { color: '#409EFF' },
        markPoint: salesData.some(v => v < 0) ? {
          data: [
            { type: 'min', name: '最低值', symbol: 'pin', symbolSize: 40, label: { formatter: '{c}', fontSize: 10 } }
          ],
          itemStyle: { color: '#F56C6C' }
        } : undefined,
        markLine: salesData.some(v => v < 0) ? {
          silent: true,
          data: [{ yAxis: 0, lineStyle: { color: '#E6A23C', type: 'dashed', width: 1 } }],
          label: { show: false }
        } : undefined
      },
      {
        name: '订单数',
        type: 'bar',
        yAxisIndex: 1,
        data: orderData,
        barWidth: '40%',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#67C23A' },
            { offset: 1, color: '#95d475' }
          ]),
          borderRadius: [4, 4, 0, 0]
        }
      }
    ] : [
      {
        name: '销售额',
        type: 'line',
        smooth: true,
        data: salesData,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
            { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
          ])
        },
        lineStyle: { width: 3, color: '#409EFF' },
        itemStyle: { color: '#409EFF' },
        markPoint: salesData.some(v => v < 0) ? {
          data: [
            { type: 'min', name: '最低值', symbol: 'pin', symbolSize: 40, label: { formatter: '{c}', fontSize: 10 } }
          ],
          itemStyle: { color: '#F56C6C' }
        } : undefined,
        markLine: salesData.some(v => v < 0) ? {
          silent: true,
          data: [{ yAxis: 0, lineStyle: { color: '#E6A23C', type: 'dashed', width: 1 } }],
          label: { show: false }
        } : undefined
      }
    ]
  };

  trendChart.setOption(option, true);
}

/**
 * 根据 API 返回的 ChartConfig 更新饼图
 * Phase 6: Also sets pieDynamicConfig for DynamicChartRenderer
 */
function updatePieChart() {
  const config = pieChartConfig.value;
  if (!config || !config.data || config.data.length === 0) {
    useDynamicPie.value = false;
    pieDynamicConfig.value = null;
    if (pieChart) {
      pieChart.setOption({
        title: {
          text: '暂无产品分布数据',
          left: 'center',
          top: 'center',
          textStyle: { color: '#909399', fontSize: 14 }
        }
      });
    }
    return;
  }

  // Phase 6: Set DynamicChartRenderer config (LegacyChartConfig format)
  pieDynamicConfig.value = {
    chartType: 'pie',
    title: '产品类别销售占比',
    xAxisField: config.xAxisField || 'name',
    yAxisField: config.yAxisField || 'value',
    data: config.data,
  } as SmartBIChartConfig;
  useDynamicPie.value = true;

  // Legacy fallback: still update raw echarts
  if (!pieChart) return;

  // 预定义颜色
  const colors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#00CED1', '#FF69B4', '#8A2BE2'];

  // 从 API 数据中提取饼图数据
  const pieData = config.data.map((item, index) => ({
    value: Number(item[config.yAxisField || 'value']) || 0,
    name: String(item[config.xAxisField || 'name'] || `类别${index + 1}`),
    itemStyle: { color: colors[index % colors.length] }
  }));

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}万 ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center'
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 18,
            fontWeight: 'bold'
          }
        },
        labelLine: { show: false },
        data: pieData
      }
    ]
  };

  pieChart.setOption(option, true);
}

function handleResize() {
  trendChart?.resize();
  pieChart?.resize();
}

/**
 * Format KPI card value for display.
 * Shows "--" for null/undefined values (truly missing data).
 * Shows the backend-formatted value if available.
 */
function formatKpiValue(card: KPICard): string {
  // Prefer rawValue for consistent formatting
  if (card.rawValue != null) {
    if (card.rawValue === 0) {
      if (card.unit === '%') return '0.0%';
      return '0';
    }
    // Count-type KPIs: integer display, no decimals
    const countUnits = ['单', '个', '条', '次', '人', '家'];
    if (card.unit && countUnits.includes(card.unit)) {
      return formatCount(card.rawValue) + card.unit;
    }
    const formatted = formatMoney(card.rawValue);
    if (card.unit === '元') {
      // Only append 元 when value isn't already abbreviated (万/亿)
      return formatted.includes('万') || formatted.includes('亿') ? formatted : formatted + '元';
    }
    return formatted + (card.unit || '');
  }
  // rawValue missing — truly no data
  return '--';
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return '--';
  if (value === 0) return '0';
  return formatNumber(value, 1);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return '--';
  return (value >= 0 ? '+' : '') + value.toFixed(1) + '%';
}

function getGrowthClass(value: number): string {
  return value >= 0 ? 'growth-up' : 'growth-down';
}

async function handleExport() {
  try {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // 1. KPI summary sheet
    if (kpiCards.value.length > 0) {
      const kpiRows = kpiCards.value.map(card => ({
        '指标': card.title,
        '数值': card.value,
        '原始值': card.rawValue ?? '',
        '变化率': card.changeRate != null ? `${card.changeRate >= 0 ? '+' : ''}${Number(card.changeRate).toFixed(1)}%` : '',
        '趋势': card.trend === 'up' ? '上升' : card.trend === 'down' ? '下降' : '持平',
      }));
      const kpiWs = XLSX.utils.json_to_sheet(kpiRows);
      XLSX.utils.book_append_sheet(wb, kpiWs, 'KPI汇总');
    }

    // 2. Sales ranking sheet
    if (salesPersonRanking.value.length > 0) {
      const rankRows = salesPersonRanking.value.map((person, idx) => ({
        '排名': idx + 1,
        '销售员': person.name,
        '销售额': person.sales,
        '订单数': person.orderCount,
        '增长率': `${person.growth >= 0 ? '+' : ''}${person.growth.toFixed(1)}%`,
      }));
      const rankWs = XLSX.utils.json_to_sheet(rankRows);
      XLSX.utils.book_append_sheet(wb, rankWs, '销售员排行');
    }

    // 3. Trend data sheet (if available)
    if (trendChartConfig.value?.data?.length) {
      const trendWs = XLSX.utils.json_to_sheet(trendChartConfig.value.data as Record<string, unknown>[]);
      XLSX.utils.book_append_sheet(wb, trendWs, '趋势数据');
    }

    // 4. Product distribution data (if available)
    if (pieChartConfig.value?.data?.length) {
      const pieWs = XLSX.utils.json_to_sheet(pieChartConfig.value.data as Record<string, unknown>[]);
      XLSX.utils.book_append_sheet(wb, pieWs, '产品分布');
    }

    // 5. Dynamic exploration data (if available)
    if (dynamicRawData.value.length > 0) {
      const dynWs = XLSX.utils.json_to_sheet(dynamicRawData.value);
      XLSX.utils.book_append_sheet(wb, dynWs, '原始数据');
    }

    // 6. AI insights sheet (if available)
    if (aiInsights.value.length > 0) {
      const insightRows = aiInsights.value.map((insight, idx) => ({
        '序号': idx + 1,
        '洞察': insight,
      }));
      const insightWs = XLSX.utils.json_to_sheet(insightRows);
      XLSX.utils.book_append_sheet(wb, insightWs, 'AI洞察');
    }

    const fileName = `销售分析报告-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    ElMessage.success(`已导出: ${fileName}`);
  } catch (error) {
    console.error('Export failed:', error);
    ElMessage.error('导出失败，请重试');
  }
}

function handleRefresh() {
  loadSalesData();
}

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  trendChart?.dispose();
  pieChart?.dispose();
});
</script>

<template>
  <div class="sales-analysis-page">
    <div class="page-header">
      <div class="header-left">
        <h1>销售分析</h1>
      </div>
      <div class="header-right">
        <el-button :icon="Download" @click="handleExport">导出报表</el-button>
        <el-button type="primary" :icon="Refresh" @click="handleRefresh">刷新</el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <el-card class="filter-card">
      <div class="filter-bar">
        <!-- Phase 6: 数据源选择器 -->
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
        <div class="filter-item">
          <span class="filter-label">
            <el-icon><TrendCharts /></el-icon>
            统计维度
          </span>
          <el-radio-group v-model="dimensionType" :disabled="selectedDataSource !== 'system'">
            <el-radio-button value="daily">按日</el-radio-button>
            <el-radio-button value="weekly">按周</el-radio-button>
            <el-radio-button value="monthly">按月</el-radio-button>
          </el-radio-group>
        </div>
        <div class="filter-item">
          <span class="filter-label">
            <el-icon><Filter /></el-icon>
            产品类别
          </span>
          <el-select v-model="categoryFilter" placeholder="选择类别" :disabled="selectedDataSource !== 'system'">
            <el-option
              v-for="cat in categories"
              :key="cat.value"
              :label="cat.label"
              :value="cat.value"
            />
          </el-select>
        </div>

        <!-- 查看原始数据按钮 -->
        <div class="filter-item" v-if="selectedDataSource !== 'system'">
          <el-button :icon="View" @click="openDataPreview">
            查看原始数据
          </el-button>
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
      v-if="noSystemSalesData && !loading"
      type="info"
      title="暂无系统销售数据"
      description="系统销售数据为空，请联系管理员导入数据，或切换到已上传的 Excel 数据源进行分析。"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

    <!-- KPI 卡片 -->
    <el-row :gutter="16" class="kpi-section" v-loading="kpiLoading">
      <el-col
        v-for="card in kpiCards"
        :key="card.key"
        :xs="12"
        :sm="8"
        class="kpi-col-5"
      >
        <el-card class="kpi-card" :class="{ 'kpi-no-data': card.rawValue == null }">
          <div class="kpi-label">{{ card.title }}</div>
          <div class="kpi-value">{{ formatKpiValue(card) }}</div>
          <div
            class="kpi-trend"
            :class="card.trend === 'up' ? 'growth-up' : card.trend === 'down' ? 'growth-down' : ''"
          >
            <!-- Skip changeRate display when main value is already a % (avoid duplicate) -->
            <span v-if="card.unit !== '%' && card.changeRate != null && card.changeRate !== 0">
              {{ card.changeRate >= 0 ? '+' : '' }}{{ Number(card.changeRate).toFixed(1) }}%
            </span>
            <span v-else-if="card.rawValue == null" class="no-data-text">暂无数据</span>
            <span v-else-if="card.compareText" class="compare-text">{{ card.compareText }}</span>
          </div>
        </el-card>
      </el-col>
      <!-- 无数据时的占位 -->
      <el-col v-if="kpiCards.length === 0 && !kpiLoading" :span="24">
        <SmartBIEmptyState type="no-data" :show-action="false" />
      </el-col>
    </el-row>

    <!-- 销售员排行榜 -->
    <el-row :gutter="16" class="content-section">
      <el-col :xs="24" :lg="10">
        <el-card class="ranking-card" v-loading="rankingLoading">
          <template #header>
            <div class="card-header">
              <el-icon><User /></el-icon>
              <span>销售员排行榜</span>
            </div>
          </template>
          <template v-if="salesPersonRanking.length > 0">
            <el-table :data="salesPersonRanking" stripe :show-header="true" size="small">
              <el-table-column label="排名" width="60" align="center">
                <template #default="{ $index }">
                  <div
                    class="rank-badge"
                    :class="{ 'top-3': $index < 3 }"
                  >
                    {{ $index + 1 }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="销售员" prop="name" width="100" />
              <el-table-column label="销售额" prop="sales" align="right">
                <template #default="{ row }">
                  {{ formatMoney(row.sales) }}
                </template>
              </el-table-column>
              <el-table-column label="订单数" prop="orderCount" width="80" align="center">
                <template #default="{ row }">
                  {{ row.orderCount ?? '--' }}
                </template>
              </el-table-column>
              <el-table-column label="增长" width="80" align="right">
                <template #default="{ row }">
                  <span :class="getGrowthClass(row.growth)">
                    {{ formatPercent(row.growth) }}
                  </span>
                </template>
              </el-table-column>
            </el-table>
          </template>
          <div v-else-if="!rankingLoading" class="empty-ranking">
            <el-empty description="暂无销售员排行数据" :image-size="80" />
          </div>
        </el-card>
      </el-col>

      <!-- 图表区 -->
      <el-col :xs="24" :lg="14">
        <el-card class="chart-card" v-loading="trendLoading">
          <template #header>
            <div class="card-header">
              <el-icon><TrendCharts /></el-icon>
              <span>销售趋势</span>
            </div>
          </template>
          <!-- Phase 6: DynamicChartRenderer when config available -->
          <DynamicChartRenderer
            v-if="useDynamicTrend && trendDynamicConfig"
            :config="trendDynamicConfig"
            :height="320"
          />
          <!-- Empty state for dynamic mode with no charts -->
          <el-empty
            v-else-if="isDynamicMode && !trendLoading"
            description="当前数据源暂无趋势图表，请查看下方探索图表"
            :image-size="80"
          />
          <!-- Legacy ECharts for system data mode -->
          <div v-else id="sales-trend-chart" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 产品占比图 -->
    <el-row :gutter="16" class="pie-section">
      <el-col :span="24">
        <el-card class="chart-card" v-loading="pieLoading">
          <template #header>
            <div class="card-header">
              <el-icon><TrendCharts /></el-icon>
              <span>产品类别销售占比</span>
            </div>
          </template>
          <!-- Phase 6: DynamicChartRenderer when config available (skip for single category) -->
          <DynamicChartRenderer
            v-if="useDynamicPie && pieDynamicConfig && (pieDynamicConfig.data?.length ?? 0) > 1"
            :config="pieDynamicConfig"
            :height="350"
          />
          <!-- Single category: show stat instead of useless full-circle pie -->
          <div v-else-if="useDynamicPie && pieDynamicConfig && pieDynamicConfig.data?.length === 1" class="single-category-stat">
            <el-icon :size="40" color="#409EFF"><TrendCharts /></el-icon>
            <div class="stat-info">
              <div class="stat-label">{{ pieDynamicConfig.data[0]?.[pieDynamicConfig.xAxisField || 'name'] || '产品类别' }}</div>
              <div class="stat-value">100%</div>
              <div class="stat-hint">仅1个产品类别，无需占比分析</div>
            </div>
          </div>
          <!-- Empty state for dynamic mode with no charts -->
          <el-empty
            v-else-if="isDynamicMode && !pieLoading"
            description="当前数据源暂无产品分布图表"
            :image-size="80"
          />
          <!-- Legacy ECharts for system data mode -->
          <div v-else id="sales-pie-chart" class="pie-chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Phase 6: AI 洞察面板 (仅动态数据源显示) -->
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

    <!-- Phase 6: 数据预览对话框 -->
    <el-dialog
      v-model="showDataPreview"
      title="数据预览"
      width="85%"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div v-loading="previewLoading" class="preview-container">
        <div class="preview-info">
          <span>共 {{ previewData.total }} 条数据</span>
          <span>当前第 {{ previewPage }} / {{ previewData.totalPages || 1 }} 页</span>
        </div>
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
.sales-analysis-page {
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

  .header-right {
    display: flex;
    gap: 12px;
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

// KPI 卡片
.kpi-section {
  margin-bottom: 16px;

  .el-col {
    margin-bottom: 16px;
  }

  // 5-column responsive layout
  .kpi-col-5 {
    @media (min-width: 992px) {
      flex: 0 0 20%;
      max-width: 20%;
    }
  }
}

.kpi-card {
  border-radius: 8px;
  text-align: center;
  padding: 8px 0;

  &.kpi-no-data {
    opacity: 0.7;

    .kpi-value {
      color: #909399;
    }
  }

  .kpi-label {
    font-size: 13px;
    color: #909399;
    margin-bottom: 8px;
  }

  .kpi-value {
    font-size: 28px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 8px;
  }

  .kpi-trend {
    font-size: 14px;
    font-weight: 500;

    &.growth-up {
      color: #67C23A;
    }

    &.growth-down {
      color: #F56C6C;
    }

    .compare-text {
      margin-left: 4px;
      font-size: 12px;
      color: #909399;
      font-weight: normal;
    }

    .no-data-text {
      color: #C0C4CC;
      font-size: 12px;
      font-weight: normal;
    }
  }
}

.empty-ranking {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

// 内容区
.content-section {
  margin-bottom: 16px;

  .el-col {
    margin-bottom: 16px;
  }
}

.ranking-card, .chart-card {
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

.rank-badge {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f0f2f5;
  color: #909399;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;

  &.top-3 {
    background: linear-gradient(135deg, #FFD700, #FFA500);
    color: #fff;
  }
}

.growth-up {
  color: #67C23A;
}

.growth-down {
  color: #F56C6C;
}

.chart-container {
  height: 320px;
  width: 100%;
}

.pie-section {
  margin-bottom: 16px;
}

.pie-chart-container {
  height: 350px;
  width: 100%;
}

.single-category-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  gap: 16px;

  .stat-info {
    text-align: center;
  }

  .stat-label {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 4px;
  }

  .stat-value {
    font-size: 32px;
    font-weight: 700;
    color: #409EFF;
    margin-bottom: 4px;
  }

  .stat-hint {
    font-size: 12px;
    color: #909399;
  }
}

// Phase 6: 数据源选择器
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

// Phase 6: AI 洞察面板
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

// Phase 6: 数据预览对话框
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
    height: 280px;
  }

  .pie-chart-container {
    height: 300px;
  }

  .exploration-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .filter-bar {
    flex-direction: column;
    align-items: flex-start !important;
  }

  .filter-item {
    width: 100%;
  }

  .chart-container {
    height: 240px;
  }

  .pie-chart-container {
    height: 260px;
  }

  .exploration-grid {
    grid-template-columns: 1fr;
  }
}
</style>
