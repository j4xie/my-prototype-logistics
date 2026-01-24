<script setup lang="ts">
/**
 * SmartBI 经营驾驶舱
 * 展示企业经营核心 KPI、排行榜、趋势图表和 AI 洞察
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
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
  Goods
} from '@element-plus/icons-vue';
import * as echarts from 'echarts';

const router = useRouter();
const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

// ==================== 类型定义 ====================

// 后端返回的 KPI 卡片
interface KPICard {
  key: string;
  title: string;
  value: string;
  rawValue: number;
  unit: string;
  change: number;
  changeRate: number;
  trend: 'up' | 'down' | 'flat';
  status: 'green' | 'yellow' | 'red';
  compareText: string;
}

// 后端返回的排行项
interface RankingItem {
  rank: number;
  name: string;
  value: number;
  target: number;
  completionRate: number;
  alertLevel: 'RED' | 'YELLOW' | 'GREEN';
}

// 后端返回的 AI 洞察
interface AIInsightResponse {
  level: 'RED' | 'YELLOW' | 'GREEN' | 'INFO';
  category: string;
  message: string;
  relatedEntity: string;
  actionSuggestion: string;
}

// 后端返回的图表配置
interface ChartConfig {
  chartType: string;
  title: string;
  xAxis?: { data: string[] };
  yAxis?: { name: string };
  series: Array<{
    name: string;
    type: string;
    data: number[];
    yAxisIndex?: number;
  }>;
  legend?: { data: string[] };
}

// 后端返回的 Dashboard 响应
interface DashboardResponse {
  period: string;
  startDate: string;
  endDate: string;
  kpiCards: KPICard[];
  rankings: Record<string, RankingItem[]>;
  charts: Record<string, ChartConfig>;
  aiInsights: AIInsightResponse[];
  alerts: Array<{ level: string; message: string }>;
  generatedAt: string;
}

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

// Dashboard 数据
const dashboardData = ref<DashboardResponse | null>(null);

// KPI 数据 (从 kpiCards 提取)
const kpiData = computed(() => {
  if (!dashboardData.value?.kpiCards) {
    return {
      totalRevenue: 0,
      revenueGrowth: 0,
      totalProfit: 0,
      profitGrowth: 0,
      orderCount: 0,
      orderGrowth: 0,
      customerCount: 0,
      customerGrowth: 0
    };
  }

  const cards = dashboardData.value.kpiCards;
  const findCard = (key: string) => cards.find(c => c.key === key);

  const salesCard = findCard('SALES_AMOUNT') || findCard('REVENUE') || findCard('销售额');
  const profitCard = findCard('PROFIT') || findCard('PROFIT_AMOUNT') || findCard('利润');
  const orderCard = findCard('ORDER_COUNT') || findCard('ORDERS') || findCard('订单数');
  const customerCard = findCard('CUSTOMER_COUNT') || findCard('ACTIVE_CUSTOMERS') || findCard('客户数');

  return {
    totalRevenue: salesCard?.rawValue || 0,
    revenueGrowth: salesCard?.changeRate || 0,
    totalProfit: profitCard?.rawValue || 0,
    profitGrowth: profitCard?.changeRate || 0,
    orderCount: orderCard?.rawValue || 0,
    orderGrowth: orderCard?.changeRate || 0,
    customerCount: customerCard?.rawValue || 0,
    customerGrowth: customerCard?.changeRate || 0
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

// AI 洞察 (从 aiInsights 提取)
const aiInsights = computed<AIInsight[]>(() => {
  if (!dashboardData.value?.aiInsights) return [];

  return dashboardData.value.aiInsights.map(insight => ({
    type: mapInsightLevel(insight.level),
    title: insight.category || getCategoryTitle(insight.level),
    content: insight.message,
    suggestion: insight.actionSuggestion
  }));
});

// 快捷问答
const quickQuestions = [
  '本月销售额如何?',
  '哪个部门业绩最好?',
  '利润率变化趋势如何?',
  '客户增长情况怎样?'
];

// 图表实例
let trendChart: echarts.ECharts | null = null;
let pieChart: echarts.ECharts | null = null;

// ==================== 生命周期 ====================

onMounted(() => {
  loadDashboardData();
});

// 监听 dashboardData 变化，更新图表
watch(dashboardData, (newData) => {
  if (newData) {
    initCharts(newData.charts);
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
      dashboardData.value = response.data as DashboardResponse;
    } else {
      throw new Error(response.message || '获取驾驶舱数据失败');
    }
  } catch (error) {
    console.error('加载驾驶舱数据失败:', error);
    hasError.value = true;
    errorMessage.value = error instanceof Error ? error.message : '加载数据失败，请稍后重试';
    ElMessage.error(errorMessage.value);
    dashboardData.value = null;
  } finally {
    loading.value = false;
  }
}

// ==================== 图表初始化 ====================

function initCharts(charts?: Record<string, ChartConfig>) {
  initTrendChart(charts?.['sales_trend'] || charts?.['销售趋势']);
  initPieChart(charts?.['category_distribution'] || charts?.['产品占比'] || charts?.['类别分布']);
}

function initTrendChart(chartConfig?: ChartConfig) {
  const trendChartDom = document.getElementById('trend-chart');
  if (!trendChartDom) return;

  if (trendChart) {
    trendChart.dispose();
  }
  trendChart = echarts.init(trendChartDom);

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
            { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
            { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
          ])
        } : undefined,
        lineStyle: { width: 3, color: index === 0 ? '#409EFF' : '#67C23A' },
        itemStyle: { color: index === 0 ? '#409EFF' : '#67C23A' }
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
          color: '#909399',
          fontSize: 14,
          fontWeight: 'normal'
        }
      }
    };
    trendChart.setOption(emptyOption);
  }
}

function initPieChart(chartConfig?: ChartConfig) {
  const pieChartDom = document.getElementById('pie-chart');
  if (!pieChartDom) return;

  if (pieChart) {
    pieChart.dispose();
  }
  pieChart = echarts.init(pieChartDom);

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
          color: '#909399',
          fontSize: 14,
          fontWeight: 'normal'
        }
      }
    };
    pieChart.setOption(emptyOption);
  }
}

function getPieColor(index: number): string {
  const colors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#00d4ff', '#ff6b6b', '#ffd93d'];
  return colors[index % colors.length];
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

function formatMoney(value: number): string {
  if (value >= 10000) {
    return (value / 10000).toFixed(1) + '万';
  }
  return value.toLocaleString();
}

function formatPercent(value: number): string {
  return (value >= 0 ? '+' : '') + value.toFixed(1) + '%';
}

function getGrowthClass(value: number): string {
  return value >= 0 ? 'growth-up' : 'growth-down';
}

function goToAIQuery(question?: string) {
  if (question) {
    router.push({ name: 'SmartBIAIQuery', query: { q: question } });
  } else {
    router.push({ name: 'SmartBIAIQuery' });
  }
}

function getInsightTagType(type: string): 'success' | 'warning' | 'danger' | 'info' {
  return type as 'success' | 'warning' | 'danger' | 'info';
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
  <div class="smart-bi-dashboard">
    <div class="page-header">
      <div class="header-left">
        <h1>经营驾驶舱</h1>
        <span class="subtitle">Smart BI - Business Intelligence Dashboard</span>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Refresh" @click="loadDashboardData" :loading="loading">刷新数据</el-button>
        <el-button type="success" :icon="ChatDotRound" @click="goToAIQuery()">AI 问答</el-button>
      </div>
    </div>

    <!-- 错误状态 -->
    <el-alert
      v-if="hasError"
      :title="errorMessage"
      type="error"
      show-icon
      closable
      class="error-alert"
      @close="hasError = false"
    />

    <!-- KPI 卡片区 -->
    <el-row :gutter="16" class="kpi-section" v-loading="loading">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="kpi-card revenue">
          <div class="kpi-icon">
            <el-icon><DataLine /></el-icon>
          </div>
          <div class="kpi-content">
            <div class="kpi-label">本月销售额</div>
            <div class="kpi-value">{{ kpiData.totalRevenue > 0 ? formatMoney(kpiData.totalRevenue) : '--' }}</div>
            <div class="kpi-trend" :class="getGrowthClass(kpiData.revenueGrowth)" v-if="kpiData.totalRevenue > 0">
              <el-icon v-if="kpiData.revenueGrowth >= 0"><ArrowUp /></el-icon>
              <el-icon v-else><ArrowDown /></el-icon>
              <span>{{ formatPercent(kpiData.revenueGrowth) }}</span>
              <span class="vs-label">vs 上月</span>
            </div>
            <div class="kpi-trend" v-else>
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
            <div class="kpi-value">{{ kpiData.totalProfit > 0 ? formatMoney(kpiData.totalProfit) : '--' }}</div>
            <div class="kpi-trend" :class="getGrowthClass(kpiData.profitGrowth)" v-if="kpiData.totalProfit > 0">
              <el-icon v-if="kpiData.profitGrowth >= 0"><ArrowUp /></el-icon>
              <el-icon v-else><ArrowDown /></el-icon>
              <span>{{ formatPercent(kpiData.profitGrowth) }}</span>
              <span class="vs-label">vs 上月</span>
            </div>
            <div class="kpi-trend" v-else>
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
            <div class="kpi-value">{{ kpiData.orderCount > 0 ? kpiData.orderCount.toLocaleString() : '--' }}</div>
            <div class="kpi-trend" :class="getGrowthClass(kpiData.orderGrowth)" v-if="kpiData.orderCount > 0">
              <el-icon v-if="kpiData.orderGrowth >= 0"><ArrowUp /></el-icon>
              <el-icon v-else><ArrowDown /></el-icon>
              <span>{{ formatPercent(kpiData.orderGrowth) }}</span>
              <span class="vs-label">vs 上月</span>
            </div>
            <div class="kpi-trend" v-else>
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
            <div class="kpi-value">{{ kpiData.customerCount > 0 ? kpiData.customerCount.toLocaleString() : '--' }}</div>
            <div class="kpi-trend" :class="getGrowthClass(kpiData.customerGrowth)" v-if="kpiData.customerCount > 0">
              <el-icon v-if="kpiData.customerGrowth >= 0"><ArrowUp /></el-icon>
              <el-icon v-else><ArrowDown /></el-icon>
              <span>{{ formatPercent(kpiData.customerGrowth) }}</span>
              <span class="vs-label">vs 上月</span>
            </div>
            <div class="kpi-trend" v-else>
              <span class="vs-label">暂无数据</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 排行榜区 -->
    <el-row :gutter="16" class="ranking-section" v-loading="loading">
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
          <el-empty v-else description="暂无部门排行数据" :image-size="80" />
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
          <el-empty v-else description="暂无区域排行数据" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区 -->
    <el-row :gutter="16" class="chart-section">
      <el-col :xs="24" :lg="14">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <el-icon><TrendCharts /></el-icon>
              <span>销售趋势</span>
            </div>
          </template>
          <div id="trend-chart" class="chart-container"></div>
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
          <div id="pie-chart" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- AI 洞察区 -->
    <el-row :gutter="16" class="insight-section">
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
          <el-empty v-else description="暂无 AI 洞察数据" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 快捷问答入口 -->
    <el-row :gutter="16" class="quick-qa-section">
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
      color: #303133;
    }

    .subtitle {
      font-size: 13px;
      color: #909399;
    }
  }

  .header-right {
    display: flex;
    gap: 12px;
  }
}

.error-alert {
  margin-bottom: 16px;
}

// KPI 卡片区
.kpi-section {
  margin-bottom: 16px;

  .el-col {
    margin-bottom: 16px;
  }
}

.kpi-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
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
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;

    .el-icon {
      font-size: 28px;
      color: #fff;
    }
  }

  &.revenue .kpi-icon {
    background: linear-gradient(135deg, #409EFF, #79bbff);
  }

  &.profit .kpi-icon {
    background: linear-gradient(135deg, #67C23A, #95d475);
  }

  &.orders .kpi-icon {
    background: linear-gradient(135deg, #E6A23C, #eebe77);
  }

  &.customers .kpi-icon {
    background: linear-gradient(135deg, #F56C6C, #fab6b6);
  }

  .kpi-content {
    flex: 1;

    .kpi-label {
      font-size: 13px;
      color: #909399;
      margin-bottom: 4px;
    }

    .kpi-value {
      font-size: 26px;
      font-weight: 600;
      color: #303133;
      margin-bottom: 4px;
    }

    .kpi-trend {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;

      &.growth-up {
        color: #67C23A;
      }

      &.growth-down {
        color: #F56C6C;
      }

      .vs-label {
        color: #C0C4CC;
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
  border-radius: 12px;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    .el-icon {
      color: #409EFF;
    }
  }

  .ranking-list {
    .ranking-item {
      display: flex;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #f0f2f5;

      &:last-child {
        border-bottom: none;
      }
    }

    .rank-badge {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      background: #f0f2f5;
      color: #909399;

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
        color: #303133;
        font-weight: 500;
      }

      .rank-value {
        font-size: 12px;
        color: #909399;
      }
    }

    .rank-growth {
      font-size: 14px;
      font-weight: 500;

      &.growth-up {
        color: #67C23A;
      }

      &.growth-down {
        color: #F56C6C;
      }
    }

    .region-item {
      .region-name {
        width: 80px;
        font-size: 14px;
        color: #303133;
      }

      .region-bar-wrapper {
        flex: 1;
        height: 8px;
        background: #f0f2f5;
        border-radius: 4px;
        margin: 0 12px;
        overflow: hidden;

        .region-bar {
          height: 100%;
          background: linear-gradient(90deg, #409EFF, #79bbff);
          border-radius: 4px;
          transition: width 0.3s ease;
        }
      }

      .region-value {
        width: 100px;
        text-align: right;

        .value {
          font-size: 14px;
          color: #303133;
          font-weight: 500;
        }

        .percent {
          font-size: 12px;
          color: #909399;
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
  border-radius: 12px;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    .el-icon {
      color: #409EFF;
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
  border-radius: 12px;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    .el-icon {
      color: #409EFF;
    }
  }

  .insight-list {
    .insight-item {
      display: flex;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #f0f2f5;

      &:last-child {
        border-bottom: none;
      }

      .el-tag {
        flex-shrink: 0;
      }

      .insight-content {
        font-size: 14px;
        color: #606266;
        line-height: 1.6;
        flex: 1;
        min-width: 200px;
      }

      .insight-suggestion {
        font-size: 13px;
        color: #909399;
        font-style: italic;
        width: 100%;
        padding-left: 60px;
      }
    }
  }
}

// 快捷问答区
.quick-qa-card {
  border-radius: 12px;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    .el-icon {
      color: #409EFF;
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
      font-size: 22px;
    }
  }
}
</style>
