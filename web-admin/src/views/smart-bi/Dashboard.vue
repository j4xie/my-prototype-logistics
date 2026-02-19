<script setup lang="ts">
/**
 * SmartBI 经营驾驶舱
 * 展示企业经营核心 KPI、排行榜、趋势图表和 AI 洞察
 */
import { ref, computed, onMounted, watch, nextTick } from 'vue';
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
  Document
} from '@element-plus/icons-vue';
import echarts from '@/utils/echarts';
import { formatNumber } from '@/utils/format-number';
import { CHART_COLORS } from '@/constants/chart-colors';
import SmartBIEmptyState from '@/components/smartbi/SmartBIEmptyState.vue';

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

  return {
    totalRevenue: salesCard?.rawValue ?? null,
    revenueGrowth: salesCard?.changeRate ?? null,
    totalProfit: profitCard?.rawValue ?? null,
    profitGrowth: profitCard?.changeRate ?? null,
    orderCount: orderCard?.rawValue ?? null,
    orderGrowth: orderCard?.changeRate ?? null,
    customerCount: customerCard?.rawValue ?? null,
    customerGrowth: customerCard?.changeRate ?? null,
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
    growth: item.completionRate > 100 ? item.completionRate - 100 : item.completionRate - 100,
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

// AI 洞察 (从 aiInsights 提取, 去重)
const aiInsights = computed<AIInsight[]>(() => {
  if (!dashboardData.value?.aiInsights) return [];

  const seen = new Set<string>();
  return dashboardData.value.aiInsights
    .filter(insight => {
      const key = insight.message;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(insight => ({
      type: mapInsightLevel(insight.level),
      title: insight.category || getCategoryTitle(insight.level),
      content: insight.message,
      suggestion: insight.actionSuggestion
    }));
});

// Detect if dashboard has any meaningful data (from system or dynamic source)
const hasData = computed(() => {
  const kd = kpiData.value;
  // Check if any KPI has a non-null value (including zero, which is valid data)
  return kd.totalRevenue !== null || kd.totalProfit !== null || kd.orderCount !== null || kd.customerCount !== null
    || dynamicInsights.value.length > 0
    || (dashboardData.value?.kpiCards && dashboardData.value.kpiCards.length > 0);
});

function goToUpload() {
  router.push({ name: 'SmartBIAnalysis' });
}

// 快捷问答
const quickQuestions = [
  '本月销售额如何?',
  '哪个部门业绩最好?',
  '利润率变化趋势如何?',
  '客户增长情况怎样?'
];

// 图表 DOM refs
const trendChartRef = ref<HTMLDivElement | null>(null);
const pieChartRef = ref<HTMLDivElement | null>(null);

// 图表实例
let trendChart: echarts.ECharts | null = null;
let pieChart: echarts.ECharts | null = null;

// ==================== 生命周期 ====================

onMounted(async () => {
  // Load upload list first (needed for auto-switch fallback)
  await loadDataSources();

  // Default to system data, auto-switch to uploads if system is empty
  selectedDataSource.value = 'system';
  await loadDashboardData();
});

// 监听 dashboardData 变化，更新图表 (use nextTick to ensure DOM refs are ready)
watch(dashboardData, (newData) => {
  if (newData) {
    nextTick(() => {
      initCharts(newData.charts);
    });
  }
}, { deep: true });

// ==================== API 调用 ====================

async function loadDashboardData() {
  if (!factoryId.value) {
    ElMessage.warning('未获取到工厂ID，请重新登录');
    return;
  }

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
      console.log('[Dashboard] Loaded data:', Object.keys(actualData));

      // Auto-switch: if system data is effectively empty (no KPIs with real values),
      // fall back to the best available uploaded data source
      const kpiCards = (actualData as DashboardResponse).kpiCards || [];
      const hasRealKpi = kpiCards.some(c => c.rawValue != null && c.rawValue !== 0);
      const charts = (actualData as DashboardResponse).charts || {};
      const hasCharts = Object.keys(charts).length > 0 &&
        Object.values(charts).some(c => c?.series && c.series.length > 0);

      if (!hasRealKpi && !hasCharts && dataSources.value.length > 0) {
        console.log('[Dashboard] System data empty, auto-switching to uploaded data');
        const best = dataSources.value[0];
        selectedDataSource.value = String(best.id);
        await loadDynamicDashboardData(best.id);
        return;
      }
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
    if (dataSources.value.length > 0) {
      console.log('[Dashboard] System API failed, falling back to uploaded data');
      hasError.value = false;
      errorMessage.value = '';
      const best = dataSources.value[0];
      selectedDataSource.value = String(best.id);
      await loadDynamicDashboardData(best.id);
      return;
    }
  } finally {
    loading.value = false;
  }
}

// ==================== 数据源管理 ====================

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
    const res = await getDynamicAnalysis(uploadId, 'finance');

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
        data.charts.forEach((chart, idx) => {
          const labels = chart.data?.labels || [];
          const datasets = chart.data?.datasets || [];
          const key = idx === 0 ? 'sales_trend' : 'category_distribution';

          if (chart.type === 'pie' && datasets.length > 0) {
            charts[key] = {
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
          } else {
            charts[key] = {
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

      console.log('[Dashboard] Loaded dynamic data from upload:', uploadId, 'KPIs:', kpiCards.length, 'Charts:', Object.keys(charts).length);
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

function initCharts(charts?: Record<string, ChartConfig>) {
  initTrendChart(charts?.['sales_trend'] || charts?.['销售趋势']);
  initPieChart(charts?.['category_distribution'] || charts?.['产品占比'] || charts?.['类别分布']);
}

function initTrendChart(chartConfig?: ChartConfig) {
  if (!trendChartRef.value) return;

  if (trendChart) {
    trendChart.dispose();
  }
  trendChart = echarts.init(trendChartRef.value, 'cretas');

  // 如果有后端数据，使用后端数据
  if (chartConfig && chartConfig.series && chartConfig.series.length > 0) {
    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
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
      yAxis: chartConfig.series.length > 1 ? [
        {
          type: 'value',
          name: chartConfig.series[0]?.name || '销售额',
          axisLabel: {
            formatter: (value: number) => (value / 10000).toFixed(0) + '万'
          }
        },
        {
          type: 'value',
          name: chartConfig.series[1]?.name || '利润',
          axisLabel: {
            formatter: (value: number) => (value / 10000).toFixed(0) + '万'
          }
        }
      ] : {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => (value / 10000).toFixed(0) + '万'
        }
      },
      series: chartConfig.series.map((s, index) => ({
        name: s.name,
        type: 'line',
        smooth: true,
        yAxisIndex: s.yAxisIndex || (index > 0 ? 1 : 0),
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
    trendChart.setOption(option);
  } else {
    // 没有数据时显示空状态
    const emptyOption: echarts.EChartsOption = {
      title: {
        text: '暂无趋势数据',
        left: 'center',
        top: 'center',
        textStyle: {
          color: '#7A8599',
          fontSize: 14,
          fontWeight: 'normal'
        }
      }
    };
    trendChart.setOption(emptyOption);
  }
}

function initPieChart(chartConfig?: ChartConfig) {
  if (!pieChartRef.value) return;

  if (pieChart) {
    pieChart.dispose();
  }
  pieChart = echarts.init(pieChartRef.value, 'cretas');

  // 如果有后端数据，使用后端数据
  if (chartConfig && chartConfig.series && chartConfig.series.length > 0) {
    const seriesData = chartConfig.series[0];
    // 假设后端返回的数据格式是 { name, data } 或 { data: [{name, value}] }
    const pieData = Array.isArray(seriesData.data)
      ? seriesData.data.map((value, index) => ({
          value: typeof value === 'number' ? value : (value as { value: number }).value,
          name: chartConfig.xAxis?.data?.[index] || `类别${index + 1}`,
          itemStyle: { color: getPieColor(index) }
        }))
      : [];

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
              fontSize: 16,
              fontWeight: 'bold'
            }
          },
          labelLine: { show: false },
          data: pieData
        }
      ]
    };
    pieChart.setOption(option);
  } else {
    // 没有数据时显示空状态
    const emptyOption: echarts.EChartsOption = {
      title: {
        text: '暂无类别数据',
        left: 'center',
        top: 'center',
        textStyle: {
          color: '#7A8599',
          fontSize: 14,
          fontWeight: 'normal'
        }
      }
    };
    pieChart.setOption(emptyOption);
  }
}

function getPieColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

function handleResize() {
  trendChart?.resize();
  pieChart?.resize();
}

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
  window.removeEventListener('resize', handleResize);
  trendChart?.dispose();
  pieChart?.dispose();
});

// 监听窗口大小变化
onMounted(() => {
  window.addEventListener('resize', handleResize);
});
</script>

<template>
  <div class="smart-bi-dashboard" role="main" aria-label="经营驾驶舱">
    <div class="page-header">
      <div class="header-left">
        <h1>经营驾驶舱</h1>
        <span class="subtitle">Smart BI - Business Intelligence Dashboard</span>
      </div>
      <div class="header-right">
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

    <!-- Empty state guidance when no data -->
    <SmartBIEmptyState
      v-if="!loading && !hasError && !hasData"
      :type="canUpload ? 'no-data' : 'read-only'"
      :showAction="canUpload"
      @action="goToUpload"
    />

    <!-- KPI 卡片区 -->
    <el-row :gutter="16" class="kpi-section" v-loading="loading" aria-label="KPI指标" aria-live="polite" :aria-busy="loading">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="kpi-card revenue">
          <div class="kpi-icon">
            <el-icon><DataLine /></el-icon>
          </div>
          <div class="kpi-content">
            <div class="kpi-label">本月销售额</div>
            <div class="kpi-value">{{ formatKpiValue(kpiData.totalRevenue) }}</div>
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
            <div class="kpi-label">本月利润</div>
            <div class="kpi-value">{{ formatKpiValue(kpiData.totalProfit) }}</div>
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
            <div class="kpi-value">{{ formatKpiValue(kpiData.orderCount) }}</div>
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
            <div class="kpi-label">活跃客户</div>
            <div class="kpi-value">{{ formatKpiValue(kpiData.customerCount) }}</div>
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
      <el-col :xs="24" :md="12">
        <el-card class="ranking-card">
          <template #header>
            <div class="card-header">
              <el-icon><Medal /></el-icon>
              <span>部门业绩排行</span>
            </div>
          </template>
          <div class="ranking-list" v-if="departmentRanking.length > 0">
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
          <SmartBIEmptyState v-else type="no-data" :show-action="false" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
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
                <div class="region-bar" :style="{ width: item.percentage + '%' }"></div>
              </div>
              <div class="region-value">
                <span class="value">{{ formatMoney(item.sales) }}</span>
                <span class="percent">{{ item.percentage }}%</span>
              </div>
            </div>
          </div>
          <SmartBIEmptyState v-else type="no-data" :show-action="false" />
        </el-card>
      </el-col>
    </el-row>

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
          <div ref="trendChartRef" class="chart-container"></div>
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
          <div ref="pieChartRef" class="chart-container"></div>
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
            </div>
          </template>
          <div class="insight-list" v-if="aiInsights.length > 0">
            <div
              v-for="(insight, index) in aiInsights"
              :key="index"
              class="insight-item"
            >
              <el-tag :type="getInsightTagType(insight.type)" size="small">
                {{ insight.title }}
              </el-tag>
              <span class="insight-content">{{ insight.content }}</span>
              <span v-if="insight.suggestion" class="insight-suggestion">
                建议: {{ insight.suggestion }}
              </span>
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
              @click="goToAIQuery(q)"
            >
              {{ q }}
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
      color: #1A2332;
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
      color: #4A5568;
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

    .kpi-value {
      font-size: var(--font-size-2xl);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: #1A2332;
      margin-bottom: 4px;
    }

    .kpi-trend {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;

      &.growth-up {
        color: #36B37E;
      }

      &.growth-down {
        color: #FF5630;
      }

      .vs-label {
        color: #A0AEC0;
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
        color: #1A2332;
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
        color: #36B37E;
      }

      &.growth-down {
        color: #FF5630;
      }
    }

    .region-item {
      .region-name {
        width: 80px;
        font-size: 14px;
        color: #1A2332;
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
          transition: width 0.3s ease;
        }
      }

      .region-value {
        width: 100px;
        text-align: right;

        .value {
          font-size: 14px;
          color: #1A2332;
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
      padding: 12px 0;
      border-bottom: 1px solid #F4F6F9;

      &:last-child {
        border-bottom: none;
      }

      .el-tag {
        flex-shrink: 0;
      }

      .insight-content {
        font-size: 14px;
        color: #4A5568;
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
  }
}

// 响应式适配
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
}
</style>
