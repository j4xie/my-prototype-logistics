<script setup lang="ts">
/**
 * SmartBI 财务分析页面
 * 提供财务数据分析，包含利润、成本、应收、应付、预算等模块
 * 使用动态渲染组件替代硬编码图表
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import {
  getUploadHistory,
  getDynamicAnalysis,
  getUploadTableData,
  type UploadHistoryItem,
  type DynamicAnalysisResponse,
  type TableDataResponse,
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
} from '@element-plus/icons-vue';
import DynamicKPIRow from '@/components/smartbi/DynamicKPIRow.vue';
import DynamicChartsSection from '@/components/smartbi/DynamicChartsSection.vue';
import type { KPICard, ChartConfig, DynamicChartConfig, LegacyChartConfig } from '@/types/smartbi';

const authStore = useAuthStore();
// 使用 authStore 的 factoryId，如果为空则使用默认值 (用于测试/演示)
const factoryId = computed(() => authStore.factoryId || 'F001');

// 分析类型
type AnalysisType = 'profit' | 'cost' | 'receivable' | 'payable' | 'budget';
const analysisType = ref<AnalysisType>('profit');

// 日期范围 (使用 value-format="YYYY-MM-DD" 后，值为字符串数组)
const dateRange = ref<[string, string] | [Date, Date] | null>(null);

// 日期快捷选项
const shortcuts = [
  {
    text: '最近7天',
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 7);
      return [start, end];
    },
  },
  {
    text: '最近30天',
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 30);
      return [start, end];
    },
  },
  {
    text: '本月',
    value: () => {
      const end = new Date();
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      return [start, end];
    },
  },
  {
    text: '本季度',
    value: () => {
      const end = new Date();
      const quarter = Math.floor(end.getMonth() / 3);
      const start = new Date(end.getFullYear(), quarter * 3, 1);
      return [start, end];
    },
  },
  {
    text: '本年',
    value: () => {
      const end = new Date();
      const start = new Date(end.getFullYear(), 0, 1);
      return [start, end];
    },
  },
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
  totalPages: 0,
});

// 动态 KPI 和图表
const kpiCards = ref<KPICard[]>([]);
const allCharts = ref<Record<string, ChartConfig>>({});

const hasCharts = computed(() => Object.keys(allCharts.value).length > 0);

// 预警列表
interface WarningItem {
  level: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  amount?: number;
}
const warnings = ref<WarningItem[]>([]);

// 分析类型配置
const analysisTypes = [
  { type: 'profit' as AnalysisType, label: '利润分析', icon: TrendCharts },
  { type: 'cost' as AnalysisType, label: '成本分析', icon: Wallet },
  { type: 'receivable' as AnalysisType, label: '应收分析', icon: Money },
  { type: 'payable' as AnalysisType, label: '应付分析', icon: CreditCard },
  { type: 'budget' as AnalysisType, label: '预算分析', icon: Document },
];

onMounted(async () => {
  // 默认选择本年度数据 (2025年全年，用于预算分析)
  // 使用 2025 年作为默认年份 (与上传的测试数据匹配)
  const startDate = '2025-01-01';
  const endDate = '2025-12-31';
  dateRange.value = [startDate, endDate];

  console.log('[FinanceAnalysis] 初始化 - factoryId:', factoryId.value, 'dateRange:', dateRange.value);

  // 加载数据源列表
  await loadDataSources();

  loadFinanceData();
});

// 加载数据源列表
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

// 数据源切换处理
async function onDataSourceChange(sourceId: string) {
  if (sourceId === 'system') {
    aiInsights.value = [];
    loadFinanceData();
  } else {
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

      // 更新 KPI (转换动态格式 → KPICard)
      if (data.kpiCards && data.kpiCards.length > 0) {
        kpiCards.value = data.kpiCards.map((kpi, index) => ({
          key: `dynamic_${index}`,
          title: kpi.title,
          value: kpi.value,
          rawValue: kpi.rawValue,
          unit: '',
          change: 0,
          changeRate: 0,
          trend: 'flat' as const,
          status: 'green' as const,
          compareText: '',
        }));
      }

      // 更新图表 (转换动态分析格式)
      if (data.charts && data.charts.length > 0) {
        const charts: Record<string, ChartConfig> = {};
        data.charts.forEach((chart, index) => {
          const labels = chart.data?.labels || [];
          const datasets = chart.data?.datasets || [];

          if (chart.type === 'pie') {
            const pieData = labels.map((label, idx) => ({
              name: label,
              value: datasets[0]?.data?.[idx] || 0,
            }));
            charts[`dynamic_chart_${index}`] = {
              chartType: 'pie',
              title: chart.title,
              xAxisField: 'name',
              yAxisField: 'value',
              data: pieData as Array<Record<string, unknown>>,
            } as LegacyChartConfig;
          } else {
            charts[`dynamic_chart_${index}`] = {
              chartType: chart.type,
              title: chart.title,
              xAxis: { type: 'category', data: labels },
              series: datasets.map(ds => ({
                name: ds.label,
                type: chart.type,
                data: ds.data,
                smooth: chart.type === 'line',
              })),
            } as DynamicChartConfig;
          }
        });
        allCharts.value = charts;
      }

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

watch([analysisType, dateRange], () => {
  if (selectedDataSource.value === 'system') {
    loadFinanceData();
  }
});

function formatDate(date: Date | string): string {
  // Element Plus date picker with value-format returns string
  if (typeof date === 'string') {
    return date; // Already in YYYY-MM-DD format
  }
  return date.toISOString().split('T')[0];
}

async function loadFinanceData() {
  console.log('[FinanceAnalysis] loadFinanceData - factoryId:', factoryId.value, 'dateRange:', dateRange.value);

  if (!factoryId.value || !dateRange.value) {
    console.warn('[FinanceAnalysis] 跳过加载 - factoryId 或 dateRange 为空');
    return;
  }

  loading.value = true;
  try {
    const startDate = formatDate(dateRange.value[0]);
    const endDate = formatDate(dateRange.value[1]);

    console.log('[FinanceAnalysis] API 请求 - startDate:', startDate, 'endDate:', endDate, 'type:', analysisType.value);

    const response = await get(
      `/${factoryId.value}/smart-bi/analysis/finance`,
      {
        params: {
          startDate,
          endDate,
          analysisType: analysisType.value,
        },
      }
    );

    console.log('[FinanceAnalysis] API 响应:', response);

    if (response.success && response.data) {
      const data = response.data as Record<string, unknown>;

      // 提取 KPI 卡片
      extractKpiCards(data);

      // 提取所有图表
      extractAllCharts(data);

      // 提取预警列表
      extractWarnings(data);

      console.log('[FinanceAnalysis] 数据已加载 - KPIs:', kpiCards.value.length, 'Charts:', Object.keys(allCharts.value).length);
    } else {
      console.error('[FinanceAnalysis] API 返回失败:', response.message);
      ElMessage.error(response.message || '加载财务数据失败');
      resetData();
    }
  } catch (error) {
    console.error('[FinanceAnalysis] API 调用异常:', error);
    ElMessage.error('加载财务数据失败，请检查网络连接');
    resetData();
  } finally {
    loading.value = false;
  }
}

/** 从响应中提取 KPI 卡片 */
function extractKpiCards(data: Record<string, unknown>) {
  const cards: KPICard[] = [];

  // 从 overview.kpiCards 提取
  if (data.overview) {
    const overview = data.overview as Record<string, unknown>;
    if (overview.kpiCards && Array.isArray(overview.kpiCards)) {
      cards.push(...(overview.kpiCards as KPICard[]));
    }
  }

  // 从 metrics 提取 (转换为 KPICard 格式)
  if (data.metrics) {
    // Handle metrics as array (new budget API format)
    if (Array.isArray(data.metrics)) {
      interface MetricItem {
        metricCode: string;
        metricName: string;
        value: number;
        formattedValue: string;
        unit?: string;
        alertLevel?: string;
      }
      const metricsArray = data.metrics as MetricItem[];
      if (cards.length === 0) {
        metricsArray.forEach((metric) => {
          cards.push({
            key: metric.metricCode,
            title: metric.metricName,
            value: metric.formattedValue,
            rawValue: metric.value,
            unit: metric.unit || '',
            change: 0,
            changeRate: 0,
            trend: 'flat',
            status: metric.alertLevel === 'RED' ? 'red' : metric.alertLevel === 'YELLOW' ? 'yellow' : 'green',
            compareText: '',
          });
        });
      }
    } else {
      // Handle metrics as object (legacy format)
      const metrics = data.metrics as Record<string, unknown>;
      const metricLabels: Record<string, string> = {
        grossProfit: '毛利润',
        grossProfitMargin: '毛利率',
        netProfit: '净利润',
        netProfitMargin: '净利率',
        totalCost: '总成本',
        materialCost: '原材料成本',
        laborCost: '人工成本',
        overheadCost: '间接成本',
        totalReceivable: '应收总额',
        receivableAge30: '30天内应收',
        receivableAge60: '逾期30-60天',
        receivableAge90Plus: '逾期90天+',
        totalPayable: '应付总额',
        payableAge30: '30天内应付',
        payableAge60: '30-60天应付',
        payableAge90Plus: '逾期90天+应付',
        budgetTotal: '年度预算',
        budgetUsed: '已使用预算',
        budgetRemaining: '剩余预算',
        budgetUsageRate: '预算使用率',
      };

      // Only add from metrics if we didn't get kpiCards from overview
      if (cards.length === 0) {
        Object.entries(metrics).forEach(([key, value]) => {
          if (value != null && typeof value === 'number' && metricLabels[key]) {
            cards.push({
              key,
              title: metricLabels[key],
              value: formatMetricValue(key, value),
              rawValue: value,
              unit: key.includes('Margin') || key.includes('Rate') || key.includes('rate') ? '%' : '',
              change: 0,
              changeRate: Number(metrics[`${key}Growth`] || metrics.costGrowth || 0),
              trend: 'flat',
              status: 'green',
              compareText: '',
            });
          }
        });
      }
    }
  }

  // Filter based on analysis type
  kpiCards.value = filterKpiByAnalysisType(cards, analysisType.value);
}

/** 根据分析类型过滤 KPI */
function filterKpiByAnalysisType(cards: KPICard[], type: AnalysisType): KPICard[] {
  if (cards.length === 0) return cards;

  const typeKeywords: Record<AnalysisType, string[]> = {
    profit: ['profit', '利润', '毛利', '净利', 'margin', '利率'],
    cost: ['cost', '成本', '原材料', '人工', '间接', 'material', 'labor', 'overhead'],
    receivable: ['receivable', '应收', '逾期', 'age', 'within', 'days'],
    payable: ['payable', '应付'],
    budget: ['budget', '预算', '使用率'],
  };

  const keywords = typeKeywords[type];
  const filtered = cards.filter(card => {
    const titleLower = (card.title || '').toLowerCase();
    const keyLower = (card.key || '').toLowerCase();
    return keywords.some(kw => titleLower.includes(kw) || keyLower.includes(kw));
  });

  // If filtering produced no results, return all cards
  return filtered.length > 0 ? filtered : cards;
}

/** 格式化 metric 值 */
function formatMetricValue(key: string, value: number): string {
  if (key.includes('Margin') || key.includes('Rate') || key.includes('rate')) {
    return value.toFixed(1) + '%';
  }
  if (value >= 10000) {
    return (value / 10000).toFixed(1) + '万';
  }
  return value.toLocaleString();
}

/** 从响应中提取所有图表 */
function extractAllCharts(data: Record<string, unknown>) {
  const charts: Record<string, ChartConfig> = {};

  // 已知的图表字段
  const chartKeys = [
    'trendChart', 'structureChart', 'agingChart', 'waterfall',
    'comparison', 'costStructure', 'receivableAging', 'budgetAchievement',
  ];

  for (const key of chartKeys) {
    if (data[key]) {
      charts[key] = data[key] as ChartConfig;
    }
  }

  // 从 overview.charts 提取
  if (data.overview) {
    const overview = data.overview as Record<string, unknown>;
    if (overview.charts) {
      const overviewCharts = overview.charts as Record<string, ChartConfig>;
      Object.entries(overviewCharts).forEach(([key, config]) => {
        charts[key] = config;
      });
    }
  }

  allCharts.value = charts;
}

/** 提取预警列表 */
function extractWarnings(data: Record<string, unknown>) {
  if (data.warnings) {
    warnings.value = data.warnings as WarningItem[];
  } else if (data.overdueRanking) {
    const ranking = data.overdueRanking as Array<Record<string, unknown>>;
    warnings.value = ranking.slice(0, 5).map((item, index) => ({
      level: index < 2 ? 'danger' as const : 'warning' as const,
      title: String(item.customerName || '未知客户'),
      description: `逾期 ${item.overdueDays || 0} 天`,
      amount: Number(item.overdueAmount || 0),
    }));
  } else {
    warnings.value = [];
  }
}

function resetData() {
  kpiCards.value = [];
  allCharts.value = {};
  warnings.value = [];
}

function formatMoney(value: number): string {
  if (value >= 10000) {
    return (value / 10000).toFixed(1) + '万';
  }
  return value.toLocaleString();
}

function getWarningTagType(level: string): 'danger' | 'warning' | 'info' {
  return level as 'danger' | 'warning' | 'info';
}

function handleRefresh() {
  if (selectedDataSource.value === 'system') {
    loadFinanceData();
  } else {
    loadDynamicData(Number(selectedDataSource.value));
  }
}

// ==================== 数据预览功能 ====================

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

    <!-- 动态 KPI 卡片 -->
    <DynamicKPIRow :cards="kpiCards" :loading="loading" />

    <!-- 图表和预警 -->
    <el-row :gutter="16" class="content-section">
      <el-col :xs="24" :lg="hasCharts ? 16 : 24">
        <!-- 动态图表 -->
        <DynamicChartsSection v-if="hasCharts" :charts="allCharts" :loading="loading" />
        <el-card v-else class="empty-chart-card">
          <el-empty description="暂无图表数据" :image-size="120" />
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

// 内容区
.content-section {
  .el-col {
    margin-bottom: 16px;
  }
}

.empty-chart-card {
  border-radius: 8px;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.warning-card {
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
