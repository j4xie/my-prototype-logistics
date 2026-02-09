<script setup lang="ts">
/**
 * SmartBI 财务分析页面
 * 提供财务数据分析，包含利润、成本、应收、应付、预算等模块
 */
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import {
  getUploadHistory,
  getDynamicAnalysis,
  getUploadTableData,
  type UploadHistoryItem,
  type DynamicAnalysisResponse,
  type TableDataResponse
} from '@/api/smartbi';
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
import * as echarts from 'echarts';

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

// 分析类型
type AnalysisType = 'profit' | 'cost' | 'receivable' | 'payable' | 'budget';
const analysisType = ref<AnalysisType>('profit');

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

// 数据源选择
const dataSources = ref<UploadHistoryItem[]>([]);
const selectedDataSource = ref<string>('system');

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
  grossProfitMargin: number;
  netProfit: number;
  netProfitMargin: number;
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
  grossProfitMargin: 0,
  netProfit: 0,
  netProfitMargin: 0,
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

// 图表配置 (从 API 获取)
interface ChartConfig {
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

const chartConfig = ref<ChartConfig | DynamicChartConfig | null>(null);
const secondaryChartConfig = ref<ChartConfig | DynamicChartConfig | null>(null);

// 图表实例
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
  // 默认选择最近30天
  const end = new Date();
  const start = new Date();
  start.setTime(start.getTime() - 3600 * 1000 * 24 * 30);
  dateRange.value = [start, end];

  // 加载数据源列表
  await loadDataSources();

  loadFinanceData();
  initChart();
});

// 加载数据源列表
async function loadDataSources() {
  try {
    const res = await getUploadHistory();
    if (res.success && res.data) {
      // 只显示处理成功的上传记录
      dataSources.value = res.data.filter(
        (item: UploadHistoryItem) => item.status === 'COMPLETED' || item.status === 'SUCCESS'
      );
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
    loadFinanceData();
  } else {
    // 加载上传的动态数据
    await loadDynamicData(Number(sourceId));
  }
}

// 加载动态数据
async function loadDynamicData(uploadId: number) {
  loading.value = true;
  aiInsights.value = [];

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

      // 清空预警 (动态数据暂不支持预警)
      warnings.value = [];
    } else {
      ElMessage.error(res.message || '加载分析数据失败');
    }
  } catch (error) {
    console.error('加载动态数据失败:', error);
    ElMessage.error('加载分析数据失败');
  } finally {
    loading.value = false;
  }
}

// 从动态数据更新 KPI
function updateKpiFromDynamicData(kpiCards: DynamicAnalysisResponse['kpiCards']) {
  // 重置 KPI 数据
  resetData();

  for (const kpi of kpiCards) {
    const title = kpi.title?.toLowerCase() || '';
    const value = kpi.rawValue || 0;

    if (title.includes('毛利') && !title.includes('率')) {
      kpiData.value.grossProfit = value;
    } else if (title.includes('毛利') && title.includes('率')) {
      kpiData.value.grossProfitMargin = value;
    } else if (title.includes('净利') && !title.includes('率')) {
      kpiData.value.netProfit = value;
    } else if (title.includes('净利') && title.includes('率')) {
      kpiData.value.netProfitMargin = value;
    } else if (title.includes('成本') || title.includes('cost')) {
      kpiData.value.totalCost = value;
    } else if (title.includes('收入') || title.includes('revenue') || title.includes('销售额')) {
      // 如果没有毛利数据，用收入作为近似
      if (kpiData.value.grossProfit === 0) {
        kpiData.value.grossProfit = value;
      }
    } else if (title.includes('利润') || title.includes('profit')) {
      // 通用利润字段
      if (kpiData.value.netProfit === 0) {
        kpiData.value.netProfit = value;
      }
    }
  }
}

// 从动态数据更新图表
function updateChartFromDynamicData(charts: DynamicAnalysisResponse['charts']) {
  if (!mainChart || charts.length === 0) return;

  // 使用第一个图表
  const chart = charts[0];
  const labels = chart.data?.labels || [];
  const datasets = chart.data?.datasets || [];

  let option: echarts.EChartsOption;

  if (chart.type === 'pie') {
    // 饼图
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
    // 柱状图或折线图
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
            if (value >= 10000) return (value / 10000).toFixed(0) + '万';
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

watch([analysisType, dateRange], () => {
  loadFinanceData();
});

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function loadFinanceData() {
  if (!factoryId.value || !dateRange.value) return;

  loading.value = true;
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
      const data = response.data as Record<string, unknown>;

      // 提取 metrics 数据到 kpiData
      if (data.metrics) {
        const metrics = data.metrics as Record<string, unknown>;
        updateKpiDataFromMetrics(metrics);
      }

      // 提取 overview 数据 (当没有 analysisType 时)
      if (data.overview) {
        const overview = data.overview as Record<string, unknown>;
        if (overview.kpiCards) {
          updateKpiDataFromKpiCards(overview.kpiCards as Array<Record<string, unknown>>);
        }
      }

      // 提取图表配置
      if (data.trendChart) {
        chartConfig.value = data.trendChart as ChartConfig | DynamicChartConfig;
        updateChart();
      } else if (data.structureChart) {
        chartConfig.value = data.structureChart as ChartConfig | DynamicChartConfig;
        updateChart();
      } else if (data.agingChart) {
        chartConfig.value = data.agingChart as ChartConfig | DynamicChartConfig;
        updateChart();
      } else if (data.waterfall) {
        chartConfig.value = data.waterfall as ChartConfig | DynamicChartConfig;
        updateChart();
      } else if (data.comparison) {
        chartConfig.value = data.comparison as ChartConfig | DynamicChartConfig;
        updateChart();
      }

      // 提取预警列表
      if (data.warnings) {
        warnings.value = data.warnings as WarningItem[];
      } else if (data.overdueRanking) {
        // 将逾期客户转换为预警
        const ranking = data.overdueRanking as Array<Record<string, unknown>>;
        warnings.value = ranking.slice(0, 5).map((item, index) => ({
          level: index < 2 ? 'danger' : 'warning',
          title: String(item.customerName || '未知客户'),
          description: `逾期 ${item.overdueDays || 0} 天`,
          amount: Number(item.overdueAmount || 0)
        })) as WarningItem[];
      } else {
        warnings.value = [];
      }
    } else {
      ElMessage.error(response.message || '加载财务数据失败');
      resetData();
    }
  } catch (error) {
    console.error('加载财务数据失败:', error);
    ElMessage.error('加载财务数据失败，请检查网络连接');
    resetData();
  } finally {
    loading.value = false;
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
    const label = String(card.label || '');
    const value = Number(card.value || 0);

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

function resetData() {
  kpiData.value = {
    grossProfit: 0,
    grossProfitMargin: 0,
    netProfit: 0,
    netProfitMargin: 0,
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

  mainChart = echarts.init(chartDom);
  window.addEventListener('resize', handleResize);
}

function updateChart() {
  if (!mainChart || !chartConfig.value) return;

  const config = chartConfig.value;
  const option = buildEChartsOption(config);

  if (option) {
    mainChart.setOption(option, true);
  }
}

function buildEChartsOption(config: ChartConfig | DynamicChartConfig): echarts.EChartsOption | null {
  // 检查是否是 DynamicChartConfig
  if ('series' in config && Array.isArray(config.series)) {
    return buildFromDynamicConfig(config as DynamicChartConfig);
  }

  // ChartConfig 格式
  const chartConfig = config as ChartConfig;
  if (!chartConfig.data || chartConfig.data.length === 0) {
    return getEmptyChartOption();
  }

  const chartType = chartConfig.chartType?.toLowerCase() || 'bar';

  if (chartType === 'pie') {
    return buildPieChart(chartConfig);
  } else {
    return buildAxisChart(chartConfig);
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

function buildPieChart(config: ChartConfig): echarts.EChartsOption {
  const xField = config.xAxisField || 'name';
  const yField = config.yAxisField || 'value';

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

function buildAxisChart(config: ChartConfig): echarts.EChartsOption {
  const xField = config.xAxisField || 'name';
  const yField = config.yAxisField || 'value';
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

function formatMoney(value: number): string {
  if (value >= 10000) {
    return (value / 10000).toFixed(1) + '万';
  }
  return value.toLocaleString();
}

function formatPercent(value: number): string {
  return value.toFixed(1) + '%';
}

function getWarningTagType(level: string): 'danger' | 'warning' | 'info' {
  return level as 'danger' | 'warning' | 'info';
}

function handleRefresh() {
  loadFinanceData();
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
        <el-button type="primary" :icon="Refresh" @click="handleRefresh">刷新</el-button>
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

    <!-- 财务 KPI -->
    <el-row :gutter="16" class="kpi-section" v-loading="loading">
      <!-- 利润分析 KPI -->
      <template v-if="analysisType === 'profit'">
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card">
            <div class="kpi-label">毛利润</div>
            <div class="kpi-value">{{ formatMoney(kpiData.grossProfit) }}</div>
            <div class="kpi-sub">毛利率 {{ formatPercent(kpiData.grossProfitMargin) }}</div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card">
            <div class="kpi-label">净利润</div>
            <div class="kpi-value">{{ formatMoney(kpiData.netProfit) }}</div>
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
          <div id="finance-main-chart" class="chart-container"></div>
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
            <el-empty v-if="warnings.length === 0" description="暂无预警" :image-size="80" />
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
}
</style>
