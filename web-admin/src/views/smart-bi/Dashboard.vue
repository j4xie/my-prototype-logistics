<script setup lang="ts">
/**
 * SmartBI 经营驾驶舱
 * 展示企业经营核心 KPI、排行榜、趋势图表和 AI 洞察
 */
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useChartResize } from '@/composables/useChartResize';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get } from '@/api/request';
import {
  getUploadHistory,
  getDynamicAnalysis,
  type UploadHistoryItem,
  type DynamicAnalysisResponse,
} from '@/api/smartbi';
import { ElMessage } from 'element-plus';
import {
  TrendCharts,
  DataLine,
  Histogram,
  ChatDotRound,
  Refresh,
  ArrowUp,
  ArrowDown,
  Medal,
  Location,
  Goods,
  Upload,
  Document,
  InfoFilled,
  User,
  Clock
} from '@element-plus/icons-vue';
import echarts from '@/utils/echarts';
import { formatNumber, formatCount, formatAxisValue } from '@/utils/format-number';
import { CHART_COLORS } from '@/constants/chart-colors';
import { sparklinePath } from '@/utils/sparkline';
import SmartBIEmptyState from '@/components/smartbi/SmartBIEmptyState.vue';
import ChartSkeleton from '@/components/smartbi/ChartSkeleton.vue';
import { enhanceChartDefaults } from '@/composables/useChartEnhancer';

const router = useRouter();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canUpload = computed(() => permissionStore.canWrite('analytics'));

// ==================== 类型定义 ====================

import type {
  KPICard,
  RankingItem,
  AIInsightResponse,
  DashboardChartConfig as ChartConfig,
  DashboardResponse
} from '@/types/smartbi';

// 前端使用的部门排行数据
interface DepartmentRank {
  name: string;
  sales: number;
  growth: number;
  alertLevel: string;
}

// 前端使用的区域排行数据
interface RegionRank {
  name: string;
  sales: number;
  percentage: number;
}

// 前端使用的 AI 洞察
interface AIInsight {
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  content: string;
  suggestion?: string;
}

// ==================== 状态 ====================

// 暗色模式
const isDarkMode = ref(false);

function toggleDarkMode() {
  isDarkMode.value = !isDarkMode.value;
  // Re-init charts with correct theme
  if (dashboardData.value?.charts) {
    nextTick(() => {
      if (trendChart) { trendChart.dispose(); trendChart = null; }
      if (pieChart) { pieChart.dispose(); pieChart = null; }
      initCharts(dashboardData.value!.charts as Record<string, ChartConfig>);
    });
  }
}

// 加载状态
const loading = ref(false);
const hasError = ref(false);
const errorMessage = ref('');

// 数据源选择 — default empty, will be set after loading sources
const dataSources = ref<UploadHistoryItem[]>([]);
const selectedDataSource = ref<string>('');

// Dynamic data AI insights (from uploaded Excel)
const dynamicInsights = ref<string[]>([]);

// Dashboard 数据
const dashboardData = ref<DashboardResponse | null>(null);

// P1 PERF fix: AbortController to cancel pending requests on data source switch / unmount
let abortController: AbortController | null = null;
function getSignal(): AbortSignal {
  if (abortController) abortController.abort();
  abortController = new AbortController();
  return abortController.signal;
}

// KPI 数据 (从 kpiCards 提取)
const kpiData = computed(() => {
  const defaultKpi = {
    totalRevenue: null as number | null,
    revenueGrowth: null as number | null,
    totalProfit: null as number | null,
    profitGrowth: null as number | null,
    orderCount: null as number | null,
    orderGrowth: null as number | null,
    customerCount: null as number | null,
    customerGrowth: null as number | null,
  };

  if (!dashboardData.value?.kpiCards || dashboardData.value.kpiCards.length === 0) {
    return defaultKpi;
  }

  const cards = dashboardData.value.kpiCards;
  const findCard = (key: string) => cards.find(c => c.key === key);
  // Also match by title text for dynamic data where key might be the title itself
  const findByTitle = (keyword: string) => cards.find(c =>
    (c.title || '').toLowerCase().includes(keyword)
  );

  const salesCard = findCard('SALES_AMOUNT') || findCard('REVENUE') || findCard('销售额')
    || findByTitle('销售') || findByTitle('收入') || findByTitle('revenue');
  const profitCard = findCard('PROFIT') || findCard('PROFIT_AMOUNT') || findCard('利润')
    || findByTitle('利润') || findByTitle('profit');
  const orderCard = findCard('ORDER_COUNT') || findCard('ORDERS') || findCard('订单数')
    || findByTitle('订单') || findByTitle('order');
  const customerCard = findCard('CUSTOMER_COUNT') || findCard('ACTIVE_CUSTOMERS') || findCard('客户数')
    || findByTitle('客户') || findByTitle('customer');

  // If no recognized KPI cards matched but we have kpiCards, use them in order as fallback
  const hasMatch = salesCard || profitCard || orderCard || customerCard;
  if (!hasMatch && cards.length > 0) {
    // Map first N cards to KPI slots by position
    return {
      totalRevenue: cards[0]?.rawValue ?? null,
      revenueGrowth: cards[0]?.changeRate ?? null,
      totalProfit: cards[1]?.rawValue ?? null,
      profitGrowth: cards[1]?.changeRate ?? null,
      orderCount: cards[2]?.rawValue ?? null,
      orderGrowth: cards[2]?.changeRate ?? null,
      customerCount: cards[3]?.rawValue ?? null,
      customerGrowth: cards[3]?.changeRate ?? null,
    };
  }

  // Fallback: if profit/customer KPIs not available, use TARGET_COMPLETION/MOM_GROWTH
  const targetCard = findCard('TARGET_COMPLETION') || findByTitle('目标') || findByTitle('完成率');
  const growthCard = findCard('MOM_GROWTH') || findByTitle('环比') || findByTitle('增长');

  return {
    totalRevenue: salesCard?.rawValue ?? null,
    revenueGrowth: salesCard?.changeRate ?? null,
    totalProfit: profitCard?.rawValue ?? (targetCard?.rawValue ?? null),
    profitGrowth: profitCard?.changeRate ?? null,
    profitLabel: profitCard ? '本月利润' : (targetCard ? '目标完成率' : '本月利润'),
    profitUnit: profitCard ? '' : (targetCard ? '%' : ''),
    orderCount: orderCard?.rawValue ?? null,
    orderGrowth: orderCard?.changeRate ?? null,
    customerCount: customerCard?.rawValue ?? (growthCard?.rawValue ?? null),
    customerGrowth: customerCard?.changeRate ?? null,
    customerLabel: customerCard ? '活跃客户' : (growthCard ? '环比增长' : '活跃客户'),
    customerUnit: customerCard ? '' : (growthCard ? '%' : ''),
  };
});

// 部门排行数据 (从 rankings 提取)
const departmentRanking = computed<DepartmentRank[]>(() => {
  if (!dashboardData.value?.rankings) return [];

  const deptRankings = dashboardData.value.rankings['department']
    || dashboardData.value.rankings['sales_person']
    || dashboardData.value.rankings['部门']
    || [];

  return deptRankings.map(item => ({
    name: item.name,
    sales: item.value,
    growth: item.completionRate != null ? item.completionRate - 100 : 0,
    alertLevel: item.alertLevel
  }));
});

// 区域排行数据 (从 rankings 提取)
const regionRanking = computed<RegionRank[]>(() => {
  if (!dashboardData.value?.rankings) return [];

  const regionRankings = dashboardData.value.rankings['region']
    || dashboardData.value.rankings['区域']
    || [];

  // 计算总值用于百分比
  const total = regionRankings.reduce((sum, item) => sum + item.value, 0);

  return regionRankings.map(item => ({
    name: item.name,
    sales: item.value,
    percentage: total > 0 ? Math.round((item.value / total) * 100) : 0
  }));
});

// AI 洞察 (从 aiInsights 提取, 去重 — 精确去重 + 相似内容去重)
const aiInsights = computed<AIInsight[]>(() => {
  if (!dashboardData.value?.aiInsights) return [];

  const seen = new Set<string>();
  const seenKeywords: string[][] = []; // track key metrics to avoid similar insights

  // Extract key numbers from a message (e.g. "-34.7%" → "34.7")
  const extractNumbers = (text: string) => {
    const matches = text.match(/[\d.]+%/g) || [];
    return matches.map(m => m.replace('%', ''));
  };

  return dashboardData.value.aiInsights
    .filter(insight => {
      const key = insight.message;
      if (seen.has(key)) return false;
      seen.add(key);

      // Similarity check: skip if another insight mentions the same key percentages
      const nums = extractNumbers(key);
      if (nums.length > 0) {
        for (const prev of seenKeywords) {
          const overlap = nums.filter(n => prev.includes(n));
          if (overlap.length >= 1 && overlap.length >= nums.length * 0.5) return false;
        }
        seenKeywords.push(nums);
      }
      return true;
    })
    .map(insight => ({
      type: mapInsightLevel(insight.level),
      title: insight.category || getCategoryTitle(insight.level),
      content: insight.message,
      suggestion: insight.actionSuggestion
    }));
});

// ==================== KPI Sparkline 数据 ====================

/**
 * Extract sparkline data arrays from the sales_trend chart series.
 * Returns up to 4 sparkline arrays for each KPI card position.
 * If no trend chart data, falls back to empty arrays.
 */
const kpiSparklines = computed(() => {
  const empty = { revenue: [] as number[], profit: [] as number[], orders: [] as number[], customers: [] as number[], labels: [] as string[] };
  if (!dashboardData.value?.charts) return empty;

  const charts = dashboardData.value.charts;
  const trendChartCfg = charts['sales_trend'] || charts['销售趋势'];
  if (!trendChartCfg) return empty;

  // Normalize legacy format
  const normalized = normalizeLegacyChart(trendChartCfg as ChartConfig);
  const series = ('series' in normalized && Array.isArray(normalized.series)) ? normalized.series : [];

  if (series.length === 0) return empty;

  // Extract xAxis labels (dates) for sparkline tooltips
  const xAxisData = (normalized as Record<string, unknown>).xAxis;
  const labels: string[] = Array.isArray(xAxisData)
    ? ((xAxisData[0] as Record<string, unknown>)?.data as string[] || [])
    : ((xAxisData as Record<string, unknown>)?.data as string[] || []);

  // Try to match series by name to KPI slots
  const findSeries = (keywords: string[]) => {
    for (const kw of keywords) {
      const s = series.find((ser: Record<string, unknown>) =>
        typeof ser.name === 'string' && ser.name.toLowerCase().includes(kw)
      );
      if (s && Array.isArray(s.data)) return s.data.map(Number).filter(Number.isFinite);
    }
    return [];
  };

  const revenue = findSeries(['销售', '收入', '营收', 'revenue', 'sales']);
  const profit = findSeries(['利润', '净利', 'profit']);
  const orders = findSeries(['订单', 'order']);
  const customers = findSeries(['客户', 'customer']);

  // Fallback: if only 1 series, use it for revenue sparkline; if 2+ assign by position
  if (!revenue.length && series.length >= 1 && Array.isArray(series[0].data)) {
    return {
      revenue: series[0].data.map(Number).filter(Number.isFinite),
      profit: series.length >= 2 && Array.isArray(series[1].data) ? series[1].data.map(Number).filter(Number.isFinite) : [],
      orders: [],
      customers: [],
      labels,
    };
  }

  return { revenue, profit, orders, customers, labels };
});

/** Cached sparkline SVG paths and colors — avoid re-computation on each render */
const kpiSparklinePaths = computed(() => {
  const s = kpiSparklines.value;
  return {
    revenue: { path: sparklinePath(s.revenue), color: s.revenue.length >= 2 ? (s.revenue[s.revenue.length - 1] >= s.revenue[0] ? '#36B37E' : '#FF5630') : '#909399' },
    profit: { path: sparklinePath(s.profit), color: s.profit.length >= 2 ? (s.profit[s.profit.length - 1] >= s.profit[0] ? '#36B37E' : '#FF5630') : '#909399' },
    orders: { path: sparklinePath(s.orders), color: s.orders.length >= 2 ? (s.orders[s.orders.length - 1] >= s.orders[0] ? '#36B37E' : '#FF5630') : '#909399' },
    customers: { path: sparklinePath(s.customers), color: s.customers.length >= 2 ? (s.customers[s.customers.length - 1] >= s.customers[0] ? '#36B37E' : '#FF5630') : '#909399' },
  };
});

// Detect if dashboard has any meaningful data (from system or dynamic source)
const hasData = computed(() => {
  const kd = kpiData.value;
  // Check if any KPI has a non-null value (including zero, which is valid data)
  return kd.totalRevenue !== null || kd.totalProfit !== null || kd.orderCount !== null || kd.customerCount !== null
    || dynamicInsights.value.length > 0
    || (dashboardData.value?.kpiCards && dashboardData.value.kpiCards.length > 0);
});

// Detect "partial" system data: some KPIs present but charts/ranking mostly empty
const hasPartialSystemData = computed(() => {
  if (selectedDataSource.value !== 'system') return false;
  if (!dashboardData.value) return false;
  const kd = kpiData.value;
  const hasAnyKpi = kd.totalRevenue !== null || kd.orderCount !== null;
  const missingKpi = kd.totalProfit === null || kd.customerCount === null;
  const charts = dashboardData.value.charts || {};
  const hasCharts = Object.keys(charts).length > 0 &&
    Object.values(charts).some(c =>
      (c && 'series' in c && Array.isArray(c.series) && c.series.length > 0) ||
      (c && 'data' in c && Array.isArray(c.data) && c.data.length > 0)
    );
  return hasAnyKpi && (missingKpi || !hasCharts) && dataSources.value.length > 0;
});

function switchToBestUpload() {
  const best = dataSources.value.find(d => d.id != null);
  if (best) {
    selectedDataSource.value = String(best.id);
    loadDynamicDashboardData(best.id);
  }
}

function goToUpload() {
  router.push({ name: 'SmartBIAnalysis' });
}

// 快捷问答
const quickQuestions = [
  { text: '本月销售额如何?', icon: TrendCharts },
  { text: '哪个部门业绩最好?', icon: Histogram },
  { text: '利润率变化趋势如何?', icon: DataLine },
  { text: '客户增长情况怎样?', icon: User }
];

// 图表 DOM refs
const dashboardRef = ref<HTMLElement>();
const trendChartRef = ref<HTMLDivElement | null>(null);
const pieChartRef = ref<HTMLDivElement | null>(null);

// 图表实例
let trendChart: echarts.ECharts | null = null;
let pieChart: echarts.ECharts | null = null;
const hasTrendData = ref(false);
const hasPieData = ref(false);

// Cross-filter state
const crossFilterValue = ref<string | null>(null);

// AI insight generation timestamp
const insightTimestamp = ref<Date | null>(null);
const insightsExpanded = ref(false);
const INSIGHT_COLLAPSE_LIMIT = 3;

// Chart titles for citation references
const chartTitles = ['销售趋势', '产品类别占比'];

function formatInsightTime(date: Date | string) {
  const d = new Date(date);
  return `分析生成于 ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Parse insight content and return segments with citation references.
 * Matches keywords related to chart titles (e.g., "销售", "趋势" → chart 0, "占比", "类别" → chart 1).
 */
function parseInsightCitations(content: string): Array<{ text: string; chartIndex?: number; chartTitle?: string }> {
  // Keyword → chart index mapping
  const keywordMap: Array<{ keywords: RegExp; chartIndex: number }> = [
    { keywords: /销售趋势|营收趋势|收入趋势|同比|环比|增长趋势|月度.*趋势|趋势.*变化/, chartIndex: 0 },
    { keywords: /类别占比|产品.*占比|品类.*分布|分类.*比例|占比.*分布|产品结构/, chartIndex: 1 },
  ];

  // Split by sentences (Chinese period, semicolon, or newline)
  const sentences = content.split(/(?<=[。；;！!？?\n])/);
  const result: Array<{ text: string; chartIndex?: number; chartTitle?: string }> = [];
  const usedCharts = new Set<number>();

  for (const sentence of sentences) {
    if (!sentence.trim()) continue;
    let matched = false;
    for (const mapping of keywordMap) {
      if (mapping.keywords.test(sentence) && !usedCharts.has(mapping.chartIndex)) {
        usedCharts.add(mapping.chartIndex);
        result.push({
          text: sentence,
          chartIndex: mapping.chartIndex,
          chartTitle: chartTitles[mapping.chartIndex]
        });
        matched = true;
        break;
      }
    }
    if (!matched) {
      result.push({ text: sentence });
    }
  }
  return result;
}

function scrollToChart(chartIndex: number) {
  const ref = chartIndex === 0 ? trendChartRef.value : pieChartRef.value;
  if (ref) {
    ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// Stagger reveal for KPI cards

// ==================== 生命周期 ====================

onMounted(async () => {
  // Load upload list first (needed for auto-switch fallback)
  await loadDataSources();

  // Default to system data, auto-switch to uploads if system is empty
  selectedDataSource.value = 'system';
  await loadDashboardData();
});

// P1 PERF fix: Watch only the charts sub-object, not the entire dashboardData deeply.
// deep:true on dashboardData caused full chart re-init when aiInsights arrived from LLM.
watch(() => dashboardData.value?.charts, (newCharts) => {
  if (newCharts) {
    nextTick(() => {
      initCharts(newCharts);
    });
  }
});

// ==================== API 调用 ====================

async function loadDashboardData() {
  if (!factoryId.value) {
    ElMessage.warning('未获取到工厂ID，请重新登录');
    return;
  }

  // Ensure AbortController exists so loadLLMInsights() can read the signal
  getSignal();
  loading.value = true;
  hasError.value = false;
  errorMessage.value = '';

  try {
    const response = await get(`/${factoryId.value}/smart-bi/dashboard/executive?period=month`);

    if (response.success && response.data) {
      // Handle double-wrapped response: interceptor wraps {code,data:{...}} into {success,data:{code,data:{...}}}
      const raw = response.data as Record<string, unknown>;
      const actualData = (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data) && raw.code)
        ? raw.data
        : raw;
      dashboardData.value = actualData as DashboardResponse;
      // data loaded

      // Auto-switch: if system data is effectively empty (no KPIs with real values),
      // fall back to the best available uploaded data source
      const kpiCards = (actualData as DashboardResponse).kpiCards || [];
      const hasRealKpi = kpiCards.some(c => c.rawValue != null && c.rawValue !== 0);
      const charts = (actualData as DashboardResponse).charts || {};
      const hasCharts = Object.keys(charts).length > 0 &&
        Object.values(charts).some(c =>
          (c && 'series' in c && Array.isArray(c.series) && c.series.length > 0) ||
          (c && 'data' in c && Array.isArray(c.data) && c.data.length > 0)
        );

      if (!hasRealKpi && !hasCharts && dataSources.value.length > 0) {
        // system data empty, auto-switch to uploaded data
        const best = dataSources.value.find(d => d.id != null);
        if (!best) return;
        selectedDataSource.value = String(best.id);
        await loadDynamicDashboardData(best.id);
        return;
      }

      // Async load LLM insights (non-blocking, renders after KPIs+charts)
      loadLLMInsights();
    } else {
      throw new Error(response.message || '获取驾驶舱数据失败');
    }
  } catch (error) {
    console.error('加载驾驶舱数据失败:', error);
    hasError.value = true;
    errorMessage.value = error instanceof Error ? error.message : '加载数据失败，请稍后重试';
    ElMessage.error(errorMessage.value);
    dashboardData.value = null;

    // On error, also try uploaded data as fallback
    const fallback = dataSources.value.find(d => d.id != null);
    if (fallback) {
      // system API failed, falling back to uploaded data
      hasError.value = false;
      errorMessage.value = '';
      selectedDataSource.value = String(fallback.id);
      await loadDynamicDashboardData(fallback.id);
      return;
    }
  } finally {
    loading.value = false;
  }
}

async function loadLLMInsights() {
  if (!factoryId.value || !dashboardData.value) return;
  const sourceAtStart = selectedDataSource.value;
  const signal = abortController?.signal;
  try {
    const res = await get(`/${factoryId.value}/smart-bi/dashboard/executive/insights?period=month`, { timeout: 120000, signal });
    // Guard: if user switched data source during await, discard stale result
    if (selectedDataSource.value !== sourceAtStart) return;
    if (res.success && res.data) {
      const raw = res.data as Record<string, unknown>;
      const insights = (raw.data && Array.isArray(raw.data)) ? raw.data : (Array.isArray(raw) ? raw : []);
      if (insights.length > 0 && dashboardData.value) {
        const existing = dashboardData.value.aiInsights || [];
        dashboardData.value = {
          ...dashboardData.value,
          aiInsights: [...existing, ...insights]
        };
        insightTimestamp.value = new Date();
      }
    }
  } catch (e) {
    // Silently ignore aborted requests (user switched data source or navigated away)
    if (e instanceof DOMException && e.name === 'AbortError') return;
    console.warn('LLM insights load failed (non-critical):', e);
  }
}

// ==================== 数据源管理 ====================

async function loadDataSources() {
  try {
    const res = await getUploadHistory();
    if (res.success && res.data) {
      const completed = res.data.filter(
        (item: UploadHistoryItem) => item.status === 'COMPLETED' || item.status === 'SUCCESS'
      );
      // Deduplicate by fileName + sheetName, keep the latest (first) entry
      const seen = new Set<string>();
      dataSources.value = completed.filter((item: UploadHistoryItem) => {
        const key = `${item.fileName}||${item.sheetName || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
  } catch (error) {
    console.warn('加载数据源列表失败:', error);
  }
}

async function onDataSourceChange(sourceId: string) {
  // Cancel any pending requests from previous data source
  getSignal();
  if (sourceId === 'system') {
    dynamicInsights.value = [];
    await loadDashboardData();
  } else {
    await loadDynamicDashboardData(Number(sourceId));
  }
}

/**
 * Load dashboard data from an uploaded Excel source via dynamic analysis API.
 * Maps the dynamic analysis response (kpiCards, charts, insights) into the
 * same DashboardResponse shape so existing KPI/chart rendering works unchanged.
 */
async function loadDynamicDashboardData(uploadId: number) {
  loading.value = true;
  hasError.value = false;
  errorMessage.value = '';
  dynamicInsights.value = [];

  try {
    const res = await getDynamicAnalysis(uploadId, 'auto');

    if (res.success && res.data) {
      const data = res.data as DynamicAnalysisResponse;

      // Map dynamic kpiCards → DashboardResponse.kpiCards format
      const kpiCards: KPICard[] = (data.kpiCards || []).map(kpi => ({
        key: detectKpiKey(kpi.title || ''),
        title: kpi.title || '',
        displayValue: kpi.value != null ? String(kpi.value) : String(kpi.rawValue ?? 0),
        rawValue: kpi.rawValue ?? 0,
        changeRate: kpi.changeRate ?? null,
        unit: '',
        trend: 'stable' as const,
        sparklineData: [],
      }));

      // Map dynamic charts → DashboardResponse.charts
      const charts: Record<string, ChartConfig> = {};
      if (data.charts && data.charts.length > 0) {
        // Assign first pie chart to category_distribution, first non-pie to sales_trend
        let hasTrend = false;
        let hasPie = false;
        data.charts.forEach((chart) => {
          const labels = chart.data?.labels || [];
          const datasets = chart.data?.datasets || [];

          if (chart.type === 'pie' && datasets.length > 0 && !hasPie) {
            hasPie = true;
            charts['category_distribution'] = {
              chartType: 'pie',
              title: chart.title || '',
              xAxis: { data: labels },
              series: [{
                name: chart.title || 'Distribution',
                type: 'pie',
                data: labels.map((label, i) => ({
                  name: label,
                  value: datasets[0]?.data?.[i] || 0,
                })),
              }],
            } as unknown as ChartConfig;
          } else if (datasets.length > 0 && !hasTrend) {
            hasTrend = true;
            charts['sales_trend'] = {
              chartType: chart.type || 'bar',
              title: chart.title || '',
              xAxis: { type: 'category', data: labels },
              series: datasets.map(ds => ({
                name: ds.label || '',
                type: chart.type || 'bar',
                data: ds.data || [],
              })),
            } as unknown as ChartConfig;
          }
        });
      }

      // Fallback: generate summary charts from KPIs when no charts available
      if (Object.keys(charts).length === 0 && kpiCards.length > 0) {
        const validKpis = kpiCards.filter(k => k.rawValue != null && k.rawValue !== 0);
        if (validKpis.length >= 2) {
          // Bar chart of KPI values
          charts['sales_trend'] = {
            chartType: 'bar',
            title: '核心指标概览',
            xAxis: { type: 'category', data: validKpis.map(k => k.title) },
            series: [{
              name: '数值',
              type: 'bar',
              data: validKpis.map(k => k.rawValue),
            }],
          } as unknown as ChartConfig;
          // Pie chart of absolute values for composition
          charts['category_distribution'] = {
            chartType: 'pie',
            title: '指标构成',
            xAxis: { data: validKpis.map(k => k.title) },
            series: [{
              name: '构成',
              type: 'pie',
              data: validKpis.map(k => ({
                name: k.title,
                value: Math.abs(k.rawValue),
              })),
            }],
          } as unknown as ChartConfig;
        }
      }

      // Store AI insights from dynamic source
      if (data.insights && data.insights.length > 0) {
        dynamicInsights.value = data.insights;
      }

      // Build DashboardResponse from dynamic data
      dashboardData.value = {
        kpiCards,
        charts,
        rankings: {},
        aiInsights: data.insights?.map(msg => ({
          level: 'INFO',
          category: '数据洞察',
          message: msg,
          actionSuggestion: '',
        })) || [],
        suggestions: [],
        lastUpdated: new Date().toISOString(),
      } as unknown as DashboardResponse;

      // dynamic data loaded from upload
    } else {
      throw new Error(res.message || '加载上传数据分析失败');
    }
  } catch (error) {
    console.error('加载动态驾驶舱数据失败:', error);
    hasError.value = true;
    errorMessage.value = error instanceof Error ? error.message : '加载数据失败';
    ElMessage.error(errorMessage.value);
    dashboardData.value = null;
  } finally {
    loading.value = false;
  }
}

/**
 * Detect KPI key from title text for mapping to existing dashboard KPI slots.
 */
function detectKpiKey(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('收入') || t.includes('销售') || t.includes('revenue') || t.includes('sales')) return 'SALES_AMOUNT';
  if (t.includes('净利') || t.includes('profit')) return 'PROFIT';
  if (t.includes('毛利') && !t.includes('率')) return 'PROFIT';
  if (t.includes('订单') || t.includes('order')) return 'ORDER_COUNT';
  if (t.includes('客户') || t.includes('customer')) return 'CUSTOMER_COUNT';
  if (t.includes('成本') || t.includes('cost')) return 'TOTAL_COST';
  if (t.includes('利润')) return 'PROFIT';
  return title;
}

// ==================== 图表初始化 ====================

/**
 * Convert backend LegacyChartConfig (data[] + xAxisField/yAxisField) to
 * DashboardChartConfig format (series[] + xAxis.data) that the render
 * functions expect.
 */
function normalizeLegacyChart(config: ChartConfig): ChartConfig {
  if ('series' in config && Array.isArray(config.series)) return config; // already in new format
  if (!('data' in config) || !Array.isArray(config.data) || config.data.length === 0) return config;

  const legacy = config as { chartType: string; title?: string; xAxisField?: string; xaxisField?: string; yAxisField?: string; yaxisField?: string; data: Array<Record<string, unknown>> };
  const xField = legacy.xAxisField || legacy.xaxisField || 'date';
  const yField = legacy.yAxisField || legacy.yaxisField || 'amount';

  const xData = legacy.data.map(d => String(d[xField] || ''));
  const yData = legacy.data.map(d => Number(d[yField]) || 0);

  return {
    chartType: legacy.chartType,
    title: legacy.title,
    xAxis: { data: xData },
    series: [{
      name: legacy.title || '数据',
      type: (legacy.chartType || 'line').toLowerCase(),
      data: yData,
    }],
  } as ChartConfig;
}

function initCharts(charts?: Record<string, ChartConfig>) {
  const trend = charts?.['sales_trend'] || charts?.['销售趋势'];
  let pie = charts?.['category_distribution'] || charts?.['产品占比']
    || charts?.['类别分布'] || charts?.['产品销售占比'] || charts?.['产品分布'];
  // Fallback: find first pie-type chart by scanning all entries
  if (!pie && charts) {
    for (const [, cfg] of Object.entries(charts)) {
      const c = cfg as Record<string, unknown>;
      if (String(c.chartType).toLowerCase() === 'pie' || (Array.isArray(c.series) && String((c.series as Record<string, unknown>[])[0]?.type).toLowerCase() === 'pie')) {
        pie = cfg;
        break;
      }
    }
  }
  initTrendChart(trend ? normalizeLegacyChart(trend) : undefined);
  initPieChart(pie ? normalizeLegacyChart(pie) : undefined);
  connectCharts();
}

function initTrendChart(chartConfig?: ChartConfig) {
  if (!trendChartRef.value) return;

  if (trendChart) {
    trendChart.dispose();
  }
  trendChart = echarts.init(trendChartRef.value, isDarkMode.value ? 'cretas-dark' : 'cretas');

  // 如果有后端数据，使用后端数据
  hasTrendData.value = !!(chartConfig && chartConfig.series && chartConfig.series.length > 0);
  if (hasTrendData.value) {
    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: chartConfig.legend?.data || chartConfig.series.map(s => s.name),
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
        data: chartConfig.xAxis?.data || []
      },
      yAxis: (chartConfig.series.length > 1 && chartConfig.series.some(s => s.yAxisIndex != null)) ? [
        {
          type: 'value',
          name: chartConfig.series[0]?.name || '销售额',
          axisLabel: {
            formatter: formatAxisValue
          }
        },
        {
          type: 'value',
          name: chartConfig.series[1]?.name || '利润',
          axisLabel: {
            formatter: formatAxisValue
          }
        }
      ] : {
        type: 'value',
        axisLabel: {
          formatter: formatAxisValue
        }
      },
      series: chartConfig.series.map((s, index) => ({
        name: s.name,
        type: 'line',
        smooth: true,
        yAxisIndex: s.yAxisIndex ?? 0,
        data: s.data,
        areaStyle: index === 0 ? {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(27, 101, 168, 0.3)' },
            { offset: 1, color: 'rgba(27, 101, 168, 0.05)' }
          ])
        } : undefined,
        lineStyle: { width: 3, color: index === 0 ? '#1B65A8' : '#36B37E' },
        itemStyle: { color: index === 0 ? '#1B65A8' : '#36B37E' }
      }))
    };
    enhanceChartDefaults(option as Record<string, unknown>);
    trendChart.setOption(option);
  }
}

function initPieChart(chartConfig?: ChartConfig) {
  if (!pieChartRef.value) return;

  if (pieChart) {
    pieChart.dispose();
  }
  pieChart = echarts.init(pieChartRef.value, isDarkMode.value ? 'cretas-dark' : 'cretas');

  // 如果有后端数据，使用后端数据
  hasPieData.value = !!(chartConfig && chartConfig.series && chartConfig.series.length > 0);
  if (hasPieData.value) {
    const seriesData = chartConfig!.series[0];
    // 假设后端返回的数据格式是 { name, data } 或 { data: [{name, value}] }
    const pieData = Array.isArray(seriesData.data)
      ? seriesData.data.map((value, index) => {
          // Support multiple data formats: number, {value}, {name, value}
          const isObj = typeof value === 'object' && value !== null;
          const numValue = typeof value === 'number' ? value : (isObj ? Number((value as Record<string, unknown>).value || 0) : 0);
          const nameFromData = isObj ? String((value as Record<string, unknown>).name || '') : '';
          return {
            value: numValue,
            name: nameFromData || chartConfig.xAxis?.data?.[index] || seriesData.name || `产品${index + 1}`,
            itemStyle: { color: getPieColor(index) }
          };
        })
      : [];

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        confine: true,
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
              fontSize: 16,
              fontWeight: 'bold'
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.2)'
            },
            scaleSize: 8,
          },
          labelLine: { show: false },
          data: pieData
        }
      ]
    };
    enhanceChartDefaults(option as Record<string, unknown>);
    pieChart.setOption(option);

    // Cross-filter: click pie slice → highlight in trend chart
    pieChart.on('click', handlePieClick);
  }
}

function getPieColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

// Cross-filter: click pie slice → highlight matching xAxis index in trend chart
function handlePieClick(params: { name?: string }) {
  if (!params.name) return;
  // Toggle: click same → clear
  if (crossFilterValue.value === params.name) {
    crossFilterValue.value = null;
    clearCrossFilter();
  } else {
    crossFilterValue.value = params.name;
    applyCrossFilter(params.name);
  }
}

function applyCrossFilter(categoryName: string) {
  if (!trendChart) return;
  // Try to match category name in trend xAxis data
  const option = trendChart.getOption() as Record<string, unknown>;
  const xAxis = option.xAxis;
  const xData = Array.isArray(xAxis) ? (xAxis[0] as Record<string, unknown>)?.data : (xAxis as Record<string, unknown>)?.data;
  if (!Array.isArray(xData)) return;

  // For pie → trend, we highlight the series whose name matches the category
  // Since trend uses time-series xAxis, highlight all data points of matching series
  trendChart.dispatchAction({ type: 'downplay' });
  const seriesOpt = option.series;
  if (Array.isArray(seriesOpt)) {
    const matchIdx = seriesOpt.findIndex((s: Record<string, unknown>) =>
      typeof s.name === 'string' && s.name.includes(categoryName)
    );
    if (matchIdx >= 0) {
      trendChart.dispatchAction({ type: 'highlight', seriesIndex: matchIdx });
    }
  }

  // Also highlight the clicked pie slice
  if (pieChart) {
    pieChart.dispatchAction({ type: 'downplay' });
    const pieSeries = (pieChart.getOption() as Record<string, unknown>).series;
    if (Array.isArray(pieSeries) && pieSeries[0]) {
      const pieData = (pieSeries[0] as Record<string, unknown>).data as Array<Record<string, unknown>>;
      if (Array.isArray(pieData)) {
        const pieIdx = pieData.findIndex(d => d.name === categoryName);
        if (pieIdx >= 0) {
          pieChart.dispatchAction({ type: 'highlight', dataIndex: pieIdx });
        }
      }
    }
  }
}

function clearCrossFilter() {
  trendChart?.dispatchAction({ type: 'downplay' });
  pieChart?.dispatchAction({ type: 'downplay' });
}

// ECharts connect — tooltip linkage between trend and pie charts
function connectCharts() {
  if (trendChart && pieChart) {
    echarts.connect([trendChart, pieChart]);
  }
}

// ResizeObserver-based chart resize (also handles sidebar toggle)
useChartResize(dashboardRef, () => {
  trendChart?.resize();
  pieChart?.resize();
});

// ==================== 工具函数 ====================

function mapInsightLevel(level: string): 'success' | 'warning' | 'danger' | 'info' {
  switch (level) {
    case 'GREEN': return 'success';
    case 'YELLOW': return 'warning';
    case 'RED': return 'danger';
    case 'INFO':
    default: return 'info';
  }
}

function getCategoryTitle(level: string): string {
  switch (level) {
    case 'GREEN': return '正向趋势';
    case 'YELLOW': return '需要关注';
    case 'RED': return '风险预警';
    case 'INFO':
    default: return '数据洞察';
  }
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return '--';
  return formatNumber(value, 1);
}

/**
 * Format KPI display value - shows actual number including 0, or '--' if null/no-data
 */
function formatKpiValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return '--';
  return formatMoney(value);
}

/** Sparkline tooltip: shows per-point values with date labels, plus summary */
function sparklineTooltip(data: number[], labels?: string[]): string {
  if (!data || data.length < 2) return '';
  const latest = data[data.length - 1];
  const min = Math.min(...data);
  const max = Math.max(...data);

  // Build per-point detail rows (show last N points to keep tooltip compact)
  const maxPoints = 8;
  const startIdx = Math.max(0, data.length - maxPoints);
  const pointRows: string[] = [];
  for (let i = startIdx; i < data.length; i++) {
    const label = labels && labels[i] ? labels[i] : `#${i + 1}`;
    const marker = i === data.length - 1 ? ' <b>(最新)</b>' : '';
    pointRows.push(`${label}: ${formatMoney(data[i])}${marker}`);
  }
  if (startIdx > 0) {
    pointRows.unshift(`<span style="color:#999">...前${startIdx}项已省略</span>`);
  }

  return pointRows.join('<br>')
    + `<br><hr style="margin:4px 0;border:none;border-top:1px solid rgba(255,255,255,0.15)">`
    + `最高: ${formatMoney(max)} / 最低: ${formatMoney(min)}`;
}

function formatPercent(value: number): string {
  return (value >= 0 ? '+' : '') + value.toFixed(1) + '%';
}

function getGrowthClass(value: number): string {
  return value >= 0 ? 'growth-up' : 'growth-down';
}

function goToAIQuery(question?: string) {
  if (question) {
    router.push({ name: 'SmartBIQuery', query: { q: question } });
  } else {
    router.push({ name: 'SmartBIQuery' });
  }
}

function getInsightTagType(type: string): 'success' | 'warning' | 'danger' | 'info' {
  return type as 'success' | 'warning' | 'danger' | 'info';
}

function handleRefresh() {
  if (selectedDataSource.value && selectedDataSource.value !== 'system') {
    loadDynamicDashboardData(Number(selectedDataSource.value));
  } else {
    loadDashboardData();
  }
}

// ==================== 生命周期清理 ====================

import { onUnmounted } from 'vue';
onUnmounted(() => {
  // Cancel any pending API requests (prevents console errors after navigation)
  if (abortController) abortController.abort();
  trendChart?.dispose();
  pieChart?.dispose();
});
</script>

<template>
  <div ref="dashboardRef" class="smart-bi-dashboard" :data-theme="isDarkMode ? 'dark' : 'light'" role="main" aria-label="经营驾驶舱">
    <div class="page-header">
      <div class="header-left">
        <h1>经营驾驶舱</h1>
        <span class="subtitle">智能数据分析 · 业务经营一站式洞察</span>
      </div>
      <div class="header-right">
        <el-button size="small" @click="toggleDarkMode" :title="isDarkMode ? '切换亮色' : '切换暗色'" :aria-label="isDarkMode ? '切换亮色模式' : '切换暗色模式'">{{ isDarkMode ? '☀️' : '🌙' }}</el-button>
        <el-button type="primary" :icon="Refresh" @click="handleRefresh" :loading="loading">刷新数据</el-button>
        <el-button type="success" :icon="ChatDotRound" @click="goToAIQuery()">AI 问答</el-button>
      </div>
    </div>

    <!-- 数据源选择器 -->
    <el-card class="datasource-card">
      <div class="datasource-bar">
        <div class="datasource-item">
          <span class="datasource-label">
            <el-icon><Document /></el-icon>
            数据源
          </span>
          <el-select
            v-model="selectedDataSource"
            placeholder="选择数据源"
            style="width: 280px"
            @change="onDataSourceChange"
          >
            <el-option label="系统数据" value="system" />
            <el-option
              v-for="ds in dataSources.filter(d => d.id != null)"
              :key="ds.id"
              :label="`${ds.fileName || '未命名'}${ds.sheetName ? ' - ' + ds.sheetName : ''}`"
              :value="String(ds.id)"
            >
              <div class="datasource-option">
                <span>{{ ds.fileName }}</span>
                <span class="datasource-meta">{{ ds.sheetName }} · {{ ds.rowCount }}行</span>
              </div>
            </el-option>
          </el-select>
        </div>
        <el-tag v-if="selectedDataSource && selectedDataSource !== 'system'" type="success" size="small">来自上传数据</el-tag>
      </div>
    </el-card>

    <!-- 错误状态 -->
    <el-alert
      v-if="hasError"
      :title="errorMessage"
      type="error"
      show-icon
      closable
      class="error-alert"
      @close="hasError = false"
    >
      <el-button size="small" type="primary" @click="handleRefresh" style="margin-top: 8px;">重试</el-button>
    </el-alert>

    <!-- Partial data guidance: system has some KPIs but charts/other KPIs are missing -->
    <el-alert
      v-if="!loading && hasPartialSystemData"
      title="系统数据不完整"
      description="当前系统数据仅包含部分指标，上传 Excel 报表可获得完整的趋势图表和 AI 分析。"
      type="info"
      show-icon
      :closable="true"
      class="partial-data-alert"
    >
      <template #default>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <el-button size="small" type="primary" @click="switchToBestUpload">
            切换到上传数据
          </el-button>
          <el-button size="small" @click="goToUpload">
            <el-icon><Upload /></el-icon>
            上传新数据
          </el-button>
        </div>
      </template>
    </el-alert>

    <!-- Empty state guidance when no data -->
    <SmartBIEmptyState
      v-if="!loading && !hasError && !hasData"
      :type="canUpload ? 'no-data' : 'read-only'"
      :showAction="canUpload"
      @action="goToUpload"
    />

    <!-- KPI 卡片区 -->
    <el-row v-if="loading && !kpiData.totalRevenue" :gutter="16" class="kpi-section" aria-label="KPI指标加载中">
      <el-col :xs="24" :sm="12" :md="6" v-for="i in 4" :key="i">
        <el-card class="kpi-card"><ChartSkeleton type="kpi" /></el-card>
      </el-col>
    </el-row>
    <el-row v-else :gutter="16" class="kpi-section kpi-fade-in" aria-label="KPI指标" aria-live="polite" :aria-busy="loading">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="kpi-card revenue">
          <div class="kpi-icon">
            <el-icon><DataLine /></el-icon>
          </div>
          <div class="kpi-content">
            <div class="kpi-label">本月销售额</div>
            <div class="kpi-value-row">
              <div class="kpi-value">{{ formatKpiValue(kpiData.totalRevenue) }}</div>
              <el-tooltip v-if="kpiSparklines.revenue.length >= 2" :content="sparklineTooltip(kpiSparklines.revenue, kpiSparklines.labels)" placement="top" :show-after="300" raw-content>
                <svg class="kpi-sparkline" width="60" height="22" viewBox="0 0 60 22">
                  <path :d="kpiSparklinePaths.revenue.path" fill="none" :stroke="kpiSparklinePaths.revenue.color" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </el-tooltip>
            </div>
            <div class="kpi-trend" :class="getGrowthClass(kpiData.revenueGrowth!)" v-if="kpiData.totalRevenue !== null && kpiData.revenueGrowth != null && kpiData.revenueGrowth !== 0">
              <el-icon v-if="kpiData.revenueGrowth >= 0"><ArrowUp /></el-icon>
              <el-icon v-else><ArrowDown /></el-icon>
              <span>{{ formatPercent(kpiData.revenueGrowth) }}</span>
              <span class="vs-label">环比</span>
            </div>
            <div class="kpi-trend" v-else-if="kpiData.totalRevenue === null">
              <span class="vs-label">暂无数据</span>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="kpi-card profit">
          <div class="kpi-icon">
            <el-icon><Histogram /></el-icon>
          </div>
          <div class="kpi-content">
            <div class="kpi-label">{{ kpiData.profitLabel || '本月利润' }}</div>
            <div class="kpi-value-row">
              <div class="kpi-value">{{ kpiData.profitUnit === '%' ? (kpiData.totalProfit != null ? kpiData.totalProfit.toFixed(1) + '%' : '--') : formatKpiValue(kpiData.totalProfit) }}</div>
              <el-tooltip v-if="kpiSparklines.profit.length >= 2" :content="sparklineTooltip(kpiSparklines.profit, kpiSparklines.labels)" placement="top" :show-after="300" raw-content>
                <svg class="kpi-sparkline" width="60" height="22" viewBox="0 0 60 22">
                  <path :d="kpiSparklinePaths.profit.path" fill="none" :stroke="kpiSparklinePaths.profit.color" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </el-tooltip>
            </div>
            <div class="kpi-trend" :class="getGrowthClass(kpiData.profitGrowth!)" v-if="kpiData.totalProfit !== null && kpiData.profitGrowth != null && kpiData.profitGrowth !== 0">
              <el-icon v-if="kpiData.profitGrowth >= 0"><ArrowUp /></el-icon>
              <el-icon v-else><ArrowDown /></el-icon>
              <span>{{ formatPercent(kpiData.profitGrowth) }}</span>
              <span class="vs-label">环比</span>
            </div>
            <div class="kpi-trend" v-else-if="kpiData.totalProfit === null">
              <span class="vs-label">暂无数据</span>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="kpi-card orders">
          <div class="kpi-icon">
            <el-icon><Goods /></el-icon>
          </div>
          <div class="kpi-content">
            <div class="kpi-label">订单数量</div>
            <div class="kpi-value-row">
              <div class="kpi-value">{{ kpiData.orderCount != null ? formatCount(kpiData.orderCount) : '--' }}</div>
              <el-tooltip v-if="kpiSparklines.orders.length >= 2" :content="sparklineTooltip(kpiSparklines.orders, kpiSparklines.labels)" placement="top" :show-after="300" raw-content>
                <svg class="kpi-sparkline" width="60" height="22" viewBox="0 0 60 22">
                  <path :d="kpiSparklinePaths.orders.path" fill="none" :stroke="kpiSparklinePaths.orders.color" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </el-tooltip>
            </div>
            <div class="kpi-trend" :class="getGrowthClass(kpiData.orderGrowth!)" v-if="kpiData.orderCount !== null && kpiData.orderGrowth != null && kpiData.orderGrowth !== 0">
              <el-icon v-if="kpiData.orderGrowth >= 0"><ArrowUp /></el-icon>
              <el-icon v-else><ArrowDown /></el-icon>
              <span>{{ formatPercent(kpiData.orderGrowth) }}</span>
              <span class="vs-label">环比</span>
            </div>
            <div class="kpi-trend" v-else-if="kpiData.orderCount === null">
              <span class="vs-label">暂无数据</span>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="kpi-card customers">
          <div class="kpi-icon">
            <el-icon><Medal /></el-icon>
          </div>
          <div class="kpi-content">
            <div class="kpi-label">{{ kpiData.customerLabel || '活跃客户' }}</div>
            <div class="kpi-value-row">
              <div class="kpi-value" :class="kpiData.customerUnit === '%' && kpiData.customerCount != null ? getGrowthClass(kpiData.customerCount) : ''">{{ kpiData.customerUnit === '%' ? (kpiData.customerCount != null ? (kpiData.customerCount >= 0 ? '+' : '') + kpiData.customerCount.toFixed(1) + '%' : '--') : (kpiData.customerCount != null ? formatCount(kpiData.customerCount) : '--') }}</div>
              <el-tooltip v-if="kpiSparklines.customers.length >= 2" :content="sparklineTooltip(kpiSparklines.customers, kpiSparklines.labels)" placement="top" :show-after="300" raw-content>
                <svg class="kpi-sparkline" width="60" height="22" viewBox="0 0 60 22">
                  <path :d="kpiSparklinePaths.customers.path" fill="none" :stroke="kpiSparklinePaths.customers.color" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </el-tooltip>
            </div>
            <div class="kpi-trend" :class="getGrowthClass(kpiData.customerGrowth!)" v-if="kpiData.customerCount !== null && kpiData.customerGrowth != null && kpiData.customerGrowth !== 0">
              <el-icon v-if="kpiData.customerGrowth >= 0"><ArrowUp /></el-icon>
              <el-icon v-else><ArrowDown /></el-icon>
              <span>{{ formatPercent(kpiData.customerGrowth) }}</span>
              <span class="vs-label">环比</span>
            </div>
            <div class="kpi-trend" v-else-if="kpiData.customerCount === null">
              <span class="vs-label">暂无数据</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 排行榜区 -->
    <el-row :gutter="16" class="ranking-section" v-loading="loading" aria-label="排行榜">
      <el-col v-if="departmentRanking.length > 0" :xs="24" :md="12">
        <el-card class="ranking-card">
          <template #header>
            <div class="card-header">
              <el-icon><Medal /></el-icon>
              <span>部门业绩排行</span>
            </div>
          </template>
          <div class="ranking-list">
            <div
              v-for="(item, index) in departmentRanking"
              :key="item.name"
              class="ranking-item"
            >
              <div class="rank-badge" :class="'rank-' + (index + 1)">
                {{ index + 1 }}
              </div>
              <div class="rank-info">
                <div class="rank-name">{{ item.name }}</div>
                <div class="rank-value">{{ formatMoney(item.sales) }}</div>
              </div>
              <div class="rank-growth" :class="getGrowthClass(item.growth)">
                {{ formatPercent(item.growth) }}
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="departmentRanking.length > 0 ? 12 : 24">
        <el-card class="ranking-card">
          <template #header>
            <div class="card-header">
              <el-icon><Location /></el-icon>
              <span>区域销售分布</span>
            </div>
          </template>
          <div class="ranking-list" v-if="regionRanking.length > 0">
            <div
              v-for="item in regionRanking"
              :key="item.name"
              class="ranking-item region-item"
            >
              <div class="region-name">{{ item.name }}</div>
              <div class="region-bar-wrapper">
                <div class="region-bar" :class="'rank-bar-' + Math.min(regionRanking.indexOf(item), 3)" :style="{ width: item.percentage + '%' }"></div>
              </div>
              <div class="region-value">
                <span class="value">{{ formatMoney(item.sales) }}</span>
                <span class="percent">{{ item.percentage }}%</span>
              </div>
            </div>
          </div>
          <div v-else class="compact-empty">
            <el-icon :size="24" color="#c0c4cc"><Location /></el-icon>
            <span>暂无区域销售数据</span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Cross-filter indicator -->
    <div v-if="crossFilterValue" class="cross-filter-bar">
      <span>已筛选: <strong>{{ crossFilterValue }}</strong></span>
      <el-button size="small" text type="primary" @click="crossFilterValue = null; clearCrossFilter()">清除过滤</el-button>
    </div>

    <!-- 图表区 -->
    <el-row :gutter="16" class="chart-section" aria-label="图表区域">
      <el-col :xs="24" :lg="14">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <el-icon><TrendCharts /></el-icon>
              <span>销售趋势</span>
            </div>
          </template>
          <ChartSkeleton v-if="loading && !hasTrendData" type="chart" />
          <div ref="trendChartRef" class="chart-container" v-show="hasTrendData"></div>
          <SmartBIEmptyState v-if="!loading && !hasTrendData" type="no-charts" :show-action="false" />
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="10">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <el-icon><Histogram /></el-icon>
              <span>产品类别占比</span>
            </div>
          </template>
          <ChartSkeleton v-if="loading && !hasPieData" type="chart" />
          <div ref="pieChartRef" class="chart-container" v-show="hasPieData"></div>
          <SmartBIEmptyState v-if="!loading && !hasPieData" type="no-charts" :show-action="false" />
        </el-card>
      </el-col>
    </el-row>

    <!-- AI 洞察区 -->
    <el-row :gutter="16" class="insight-section" aria-label="AI智能洞察" aria-live="polite" :aria-busy="loading">
      <el-col :span="24">
        <el-card class="insight-card" v-loading="loading">
          <template #header>
            <div class="card-header">
              <el-icon><ChatDotRound /></el-icon>
              <span>AI 智能洞察</span>
              <span v-if="insightTimestamp" class="insight-header-timestamp">
                生成于 {{ insightTimestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}
              </span>
            </div>
          </template>
          <div class="insight-list" role="list" v-if="aiInsights.length > 0">
            <div
              v-for="(insight, index) in (insightsExpanded ? aiInsights : aiInsights.slice(0, INSIGHT_COLLAPSE_LIMIT))"
              :key="index"
              class="insight-item"
              :class="'insight-' + insight.type"
              role="listitem"
            >
              <el-tag :type="getInsightTagType(insight.type)" size="small">
                {{ insight.title }}
              </el-tag>
              <span class="insight-content">
                <template v-for="(seg, si) in parseInsightCitations(insight.content)" :key="si">
                  <span
                    v-if="seg.chartIndex != null"
                    class="insight-citation"
                    :title="'来源: ' + seg.chartTitle"
                    @click="scrollToChart(seg.chartIndex)"
                  >{{ seg.text }}<sup>[{{ seg.chartIndex + 1 }}]</sup></span>
                  <span v-else>{{ seg.text }}</span>
                </template>
              </span>
              <span v-if="insight.suggestion" class="insight-suggestion">
                <el-icon aria-label="建议" role="img"><InfoFilled /></el-icon> {{ insight.suggestion }}
              </span>
            </div>
            <div class="insight-meta" v-if="insightTimestamp">
              <el-icon><Clock /></el-icon>
              <span class="insight-timestamp">{{ formatInsightTime(insightTimestamp) }}</span>
              <span class="insight-citation-legend" v-if="chartTitles.length > 0">
                <span v-for="(title, ci) in chartTitles" :key="ci" class="citation-ref" @click="scrollToChart(ci)">
                  [{{ ci + 1 }}] {{ title }}
                </span>
              </span>
            </div>
            <div v-if="aiInsights.length > INSIGHT_COLLAPSE_LIMIT" class="insight-toggle">
              <el-button text type="primary" size="small" @click="insightsExpanded = !insightsExpanded">
                {{ insightsExpanded ? '收起' : `展开更多 (${aiInsights.length - INSIGHT_COLLAPSE_LIMIT} 条)` }}
                <el-icon class="toggle-icon" :class="{ expanded: insightsExpanded }"><ArrowDown /></el-icon>
              </el-button>
            </div>
          </div>
          <SmartBIEmptyState v-else type="no-analysis" :show-action="false" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 快捷问答入口 -->
    <el-row :gutter="16" class="quick-qa-section" aria-label="快捷问答">
      <el-col :span="24">
        <el-card class="quick-qa-card">
          <template #header>
            <div class="card-header">
              <el-icon><ChatDotRound /></el-icon>
              <span>快捷问答</span>
            </div>
          </template>
          <div class="quick-questions">
            <el-button
              v-for="(q, index) in quickQuestions"
              :key="index"
              round
              @click="goToAIQuery(q.text)"
            >
              <el-icon><component :is="q.icon" /></el-icon>
              {{ q.text }}
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.smart-bi-dashboard {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  .header-left {
    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: var(--el-text-color-primary, #1A2332);
    }

    .subtitle {
      font-size: 13px;
      color: var(--color-text-secondary);
    }
  }

  .header-right {
    display: flex;
    gap: 12px;
  }
}

// 数据源选择器
.datasource-card {
  margin-bottom: 16px;
  border-radius: 8px;

  :deep(.el-card__body) {
    padding: 12px 16px;
  }

  .datasource-bar {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .datasource-item {
    display: flex;
    align-items: center;
    gap: 8px;

    .datasource-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: var(--el-text-color-regular, #4A5568);
      white-space: nowrap;
    }
  }
}

.datasource-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  .datasource-meta {
    font-size: 12px;
    color: #7A8599;
  }
}

.error-alert {
  margin-bottom: 16px;
}

.empty-state-card {
  margin-bottom: 24px;
  border-radius: 12px;
  text-align: center;
  padding: 20px 0;
}

// KPI 卡片区
.kpi-section {
  margin-bottom: 16px;

  .el-col {
    margin-bottom: 16px;
  }
}

.kpi-card {
  border-radius: var(--radius-lg);
  border: none;
  box-shadow: var(--shadow-md);
  display: flex;
  padding: 20px;
  gap: 16px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: default;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  }

  :deep(.el-card__body) {
    padding: 0;
    display: flex;
    gap: 16px;
    width: 100%;
  }

  .kpi-icon {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;

    .el-icon {
      font-size: 28px;
      color: #fff;
    }
  }

  &.revenue .kpi-icon {
    background: linear-gradient(135deg, #1B65A8, #4C9AFF);
  }

  &.profit .kpi-icon {
    background: linear-gradient(135deg, #36B37E, #57D9A3);
  }

  &.orders .kpi-icon {
    background: linear-gradient(135deg, #FFAB00, #FFC400);
  }

  &.customers .kpi-icon {
    background: linear-gradient(135deg, #FF5630, #FF8B6A);
  }

  .kpi-content {
    flex: 1;

    .kpi-label {
      font-size: 13px;
      color: var(--color-text-secondary);
      margin-bottom: 4px;
    }

    .kpi-value-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 4px;
    }

    .kpi-sparkline {
      flex-shrink: 0;
      opacity: 0.85;
    }

    .kpi-value {
      font-size: var(--font-size-2xl);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      color: var(--el-text-color-primary, #1A2332);

      &.growth-up { color: var(--el-color-success, #36B37E); }
      &.growth-down { color: var(--el-color-danger, #FF5630); }
    }

    .kpi-trend {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;

      &.growth-up {
        color: var(--el-color-success, #36B37E);
      }

      &.growth-down {
        color: var(--el-color-danger, #FF5630);
      }

      .vs-label {
        color: var(--el-text-color-placeholder, #A0AEC0);
        margin-left: 4px;
      }
    }
  }
}

// 排行榜区
.ranking-section {
  margin-bottom: 16px;

  .el-col {
    margin-bottom: 16px;
  }
}

.compact-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 16px;
  color: #c0c4cc;
  font-size: 13px;
}

.ranking-card {
  border-radius: var(--radius-lg);

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    .el-icon {
      color: #1B65A8;
    }
  }

  .ranking-list {
    .ranking-item {
      display: flex;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #F4F6F9;

      &:last-child {
        border-bottom: none;
      }
    }

    .rank-badge {
      width: 24px;
      height: 24px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      background: #F4F6F9;
      color: var(--color-text-secondary);

      &.rank-1 {
        background: linear-gradient(135deg, #FFD700, #FFA500);
        color: #fff;
      }

      &.rank-2 {
        background: linear-gradient(135deg, #C0C0C0, #A8A8A8);
        color: #fff;
      }

      &.rank-3 {
        background: linear-gradient(135deg, #CD7F32, #B8860B);
        color: #fff;
      }
    }

    .rank-info {
      flex: 1;
      margin-left: 12px;

      .rank-name {
        font-size: 14px;
        color: var(--el-text-color-primary, #1A2332);
        font-weight: 500;
      }

      .rank-value {
        font-size: 12px;
        color: var(--color-text-secondary);
      }
    }

    .rank-growth {
      font-size: 14px;
      font-weight: 500;

      &.growth-up {
        color: var(--el-color-success, #36B37E);
      }

      &.growth-down {
        color: var(--el-color-danger, #FF5630);
      }
    }

    .region-item {
      border-radius: 6px;
      padding: 12px 8px;
      margin: 0 -8px;
      transition: background 0.2s ease;

      &:hover {
        background: var(--el-fill-color-light, #F4F6F9);

        .region-bar {
          filter: brightness(1.1);
        }
      }

      .region-name {
        width: 80px;
        font-size: 14px;
        color: var(--el-text-color-primary, #1A2332);
      }

      .region-bar-wrapper {
        flex: 1;
        height: 8px;
        background: #F4F6F9;
        border-radius: 4px;
        margin: 0 12px;
        overflow: hidden;

        .region-bar {
          height: 100%;
          background: linear-gradient(90deg, #1B65A8, #4C9AFF);
          border-radius: 4px;
          transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1), filter 0.2s ease;

          &.rank-bar-0 { background: linear-gradient(90deg, #1B65A8, #4C9AFF); }
          &.rank-bar-1 { background: linear-gradient(90deg, #36B37E, #57D9A3); }
          &.rank-bar-2 { background: linear-gradient(90deg, #FFAB00, #FFC400); }
          &.rank-bar-3 { background: linear-gradient(90deg, #A0AEC0, #CBD5E0); }
        }
      }

      .region-value {
        width: 100px;
        text-align: right;

        .value {
          font-size: 14px;
          color: var(--el-text-color-primary, #1A2332);
          font-weight: 500;
        }

        .percent {
          font-size: 12px;
          color: var(--color-text-secondary);
          margin-left: 8px;
        }
      }
    }
  }
}

// Stagger reveal animation
// Simple fade-in for KPI cards (replaces stagger-item which had timing issues with v-if/v-else)
.kpi-fade-in {
  animation: kpiFadeIn 0.5s ease-out both;
}

@keyframes kpiFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

// Cross-filter indicator bar
.cross-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  margin-bottom: 12px;
  background: var(--el-color-primary-light-9, #ecf5ff);
  border-radius: 6px;
  font-size: 13px;
  color: var(--el-text-color-regular, #606266);
}

// AI insight header timestamp
.insight-header-timestamp {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
  font-weight: 400;
}

// AI insight meta (timestamp + citation legend below insights)
.insight-meta {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter, #f0f2f5);
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;

  .insight-timestamp {
    margin-right: 12px;
  }

  .insight-citation-legend {
    display: flex;
    gap: 10px;
    margin-left: auto;

    .citation-ref {
      cursor: pointer;
      color: var(--el-color-primary, #1B65A8);
      transition: opacity 0.2s;

      &:hover {
        opacity: 0.7;
        text-decoration: underline;
      }
    }
  }
}

.insight-citation {
  cursor: pointer;
  color: var(--el-color-primary, #1B65A8);
  transition: color 0.2s;

  &:hover {
    text-decoration: underline;
  }

  sup {
    font-size: 10px;
    margin-left: 1px;
    font-weight: 600;
  }
}

// 图表区
.chart-section {
  margin-bottom: 16px;

  .el-col {
    margin-bottom: 16px;
  }
}

.chart-card {
  border-radius: var(--radius-lg);

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    .el-icon {
      color: #1B65A8;
    }
  }

  .chart-container {
    height: 320px;
    width: 100%;
  }
}

// AI 洞察区
.insight-section {
  margin-bottom: 16px;
}

.insight-card {
  border-radius: var(--radius-lg);

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    .el-icon {
      color: #1B65A8;
    }
  }

  .insight-list {
    .insight-item {
      display: flex;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px 16px;
      margin-bottom: 8px;
      border-radius: 8px;
      border-left: 4px solid #909399;
      background: #fafbfc;
      transition: background 0.2s ease;

      &:hover {
        background: #f0f2f5;
      }

      &:last-child {
        margin-bottom: 0;
      }

      &.insight-success { border-left-color: var(--el-color-success, #36B37E); background: var(--el-color-success-light-9, #f6ffed); }
      &.insight-warning { border-left-color: var(--el-color-warning, #E6A23C); background: var(--el-color-warning-light-9, #fffbe6); }
      &.insight-danger  { border-left-color: var(--el-color-danger, #FF5630); background: var(--el-color-danger-light-9, #fff2f0); }
      &.insight-info    { border-left-color: var(--el-color-primary, #1B65A8); background: var(--el-color-primary-light-9, #e6f7ff); }

      .el-tag {
        flex-shrink: 0;
      }

      .insight-content {
        font-size: 14px;
        color: var(--el-text-color-regular, #4A5568);
        line-height: 1.6;
        flex: 1;
        min-width: 200px;
      }

      .insight-suggestion {
        font-size: 13px;
        color: var(--color-text-secondary);
        font-style: italic;
        width: 100%;
        padding-left: 60px;
      }
    }

    .insight-toggle {
      text-align: center;
      padding-top: 8px;

      .toggle-icon {
        transition: transform 0.3s ease;
        margin-left: 4px;

        &.expanded {
          transform: rotate(180deg);
        }
      }
    }
  }
}

// 快捷问答区
.quick-qa-card {
  border-radius: var(--radius-lg);

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    .el-icon {
      color: #1B65A8;
    }
  }

  .quick-questions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;

    .el-button {
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(27, 101, 168, 0.15);
        color: var(--el-color-primary, #1B65A8);
        border-color: var(--el-color-primary, #1B65A8);
      }
    }
  }
}

// 图表卡片悬浮效果
.ranking-card,
.chart-card,
.insight-card,
.quick-qa-card {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  }
}

// 响应式适配
@media (max-width: 1200px) {
  .charts-section .el-col[class*="md-12"] {
    margin-bottom: 16px;
  }
}

@media (max-width: 1366px) {
  .chart-container {
    height: 280px;
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .kpi-card {
    .kpi-content .kpi-value {
      font-size: var(--font-size-xl);
    }
  }

  .ranking-section {
    .el-col { margin-bottom: 12px; }
  }

  .chart-container {
    height: 240px !important;
  }
}

@media (max-width: 480px) {
  .kpi-card {
    .kpi-icon {
      width: 40px;
      height: 40px;
      .el-icon { font-size: 20px; }
    }
    .kpi-content .kpi-value {
      font-size: var(--font-size-lg);
    }
  }
}

// ==================== 暗色模式 ====================

.smart-bi-dashboard[data-theme="dark"] {
  background: var(--bg-color-page);
  color: var(--text-color-primary);

  .page-header {
    h1 { color: var(--text-color-primary); }
    .subtitle { color: var(--text-color-secondary); }
  }

  :deep(.el-card) {
    background: var(--bg-color-overlay);
    border-color: var(--border-color);
    color: var(--text-color-primary);
  }

  :deep(.el-card__header) {
    border-bottom-color: var(--border-color);
  }

  .kpi-card {
    .kpi-icon {
      opacity: 0.85;
    }
    .kpi-content {
      .kpi-label { color: var(--text-color-secondary); }
      .kpi-value { color: var(--color-primary-light); }
      .kpi-trend {
        &.growth-up { color: var(--color-success); }
        &.growth-down { color: var(--color-danger); }
      }
    }
    &.revenue .kpi-icon { background: rgba(54, 179, 126, 0.2); }
    &.profit .kpi-icon { background: rgba(27, 101, 168, 0.2); }
    &.orders .kpi-icon { background: rgba(255, 171, 0, 0.2); }
    &.customers .kpi-icon { background: rgba(114, 46, 209, 0.2); }
  }

  .ranking-card {
    .card-header span { color: var(--text-color-primary); }
  }

  .ranking-row {
    border-bottom-color: var(--border-color);
    .region-name, .dept-name { color: var(--text-color-regular); }
    .region-bar-bg { background: rgba(255, 255, 255, 0.08); }
  }

  .chart-card {
    .card-header span { color: var(--text-color-primary); }
  }

  .insight-card {
    background: rgba(255, 255, 255, 0.04) !important;
    border-left-color: var(--border-color);
    .insight-title { color: var(--text-color-regular); }
    .insight-content { color: var(--text-color-secondary); }
    &.insight-success { border-left-color: var(--color-success); background: rgba(87, 217, 163, 0.08) !important; }
    &.insight-warning { border-left-color: var(--color-warning); background: rgba(255, 171, 0, 0.08) !important; }
    &.insight-danger { border-left-color: var(--color-danger); background: rgba(255, 139, 106, 0.08) !important; }
    &.insight-info { border-left-color: var(--color-primary-light); background: rgba(76, 154, 255, 0.08) !important; }
  }

  .quick-question-section {
    :deep(.el-card) { background: var(--bg-color-overlay); }
    .quick-btn { background: rgba(255, 255, 255, 0.06); color: var(--text-color-regular); border-color: var(--border-color); }
  }
}
</style>
