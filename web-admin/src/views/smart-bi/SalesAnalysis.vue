<script setup lang="ts">
/**
 * SmartBI 销售分析页面
 * 提供销售数据的多维度分析，包含筛选、KPI、排行榜和图表
 */
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import {
  Refresh,
  TrendCharts,
  User,
  Calendar,
  Filter,
  Download
} from '@element-plus/icons-vue';
import * as echarts from 'echarts';

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

// 筛选条件
const dateRange = ref<[Date, Date] | null>(null);
const dimensionType = ref<'daily' | 'weekly' | 'monthly'>('daily');
const categoryFilter = ref<string>('all');

// 加载状态
const loading = ref(false);
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
  rawValue: number;
  unit: string;
  change: number;
  changeRate: number;
  trend: 'up' | 'down' | 'flat';
  status: string;
  compareText: string;
}

const kpiCards = ref<KPICard[]>([]);

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

// 图表实例
let trendChart: echarts.ECharts | null = null;
let pieChart: echarts.ECharts | null = null;

onMounted(() => {
  // 默认选择最近30天
  const end = new Date();
  const start = new Date();
  start.setTime(start.getTime() - 3600 * 1000 * 24 * 30);
  dateRange.value = [start, end];

  loadSalesData();
  initCharts();
});

// 监听筛选条件变化
watch([dateRange, dimensionType, categoryFilter], () => {
  loadSalesData();
});

async function loadSalesData() {
  loading.value = true;
  try {
    await Promise.all([
      loadOverviewData(),
      loadRankingData(),
      loadTrendData(),
      loadProductData()
    ]);
  } finally {
    loading.value = false;
  }
}

/**
 * 加载概览数据 (包含 KPI 卡片)
 * API: GET /{factoryId}/smart-bi/analysis/sales
 */
async function loadOverviewData() {
  if (!factoryId.value || !dateRange.value) return;
  kpiLoading.value = true;
  try {
    const params = {
      startDate: formatDate(dateRange.value[0]),
      endDate: formatDate(dateRange.value[1])
    };
    const response = await get(`/${factoryId.value}/smart-bi/analysis/sales`, { params });
    if (response.success && response.data) {
      const data = response.data as { overview?: { kpiCards?: KPICard[] } };
      if (data.overview?.kpiCards) {
        kpiCards.value = data.overview.kpiCards;
      }
    } else {
      ElMessage.error(response.message || '加载销售概览失败');
    }
  } catch (error) {
    console.error('加载销售 KPI 失败:', error);
    ElMessage.error('加载销售 KPI 数据失败，请稍后重试');
  } finally {
    kpiLoading.value = false;
  }
}

/**
 * 加载销售员排行数据
 * API: GET /{factoryId}/smart-bi/analysis/sales?dimension=salesperson
 */
async function loadRankingData() {
  if (!factoryId.value || !dateRange.value) return;
  rankingLoading.value = true;
  try {
    const params = {
      startDate: formatDate(dateRange.value[0]),
      endDate: formatDate(dateRange.value[1]),
      dimension: 'salesperson'
    };
    const response = await get(`/${factoryId.value}/smart-bi/analysis/sales`, { params });
    if (response.success && response.data) {
      const data = response.data as { ranking?: SalesPersonRank[] };
      if (data.ranking) {
        salesPersonRanking.value = data.ranking;
      }
    } else {
      ElMessage.error(response.message || '加载销售员排行失败');
    }
  } catch (error) {
    console.error('加载销售员排行失败:', error);
    ElMessage.error('加载销售员排行数据失败，请稍后重试');
  } finally {
    rankingLoading.value = false;
  }
}

/**
 * 加载趋势图数据
 * API: GET /{factoryId}/smart-bi/analysis/sales?dimension=trend
 */
async function loadTrendData() {
  if (!factoryId.value || !dateRange.value) return;
  trendLoading.value = true;
  try {
    const params = {
      startDate: formatDate(dateRange.value[0]),
      endDate: formatDate(dateRange.value[1]),
      dimension: 'trend'
    };
    const response = await get(`/${factoryId.value}/smart-bi/analysis/sales`, { params });
    if (response.success && response.data) {
      const data = response.data as { chart?: ChartConfig };
      if (data.chart) {
        trendChartConfig.value = data.chart;
        updateTrendChart();
      }
    } else {
      ElMessage.error(response.message || '加载趋势图失败');
    }
  } catch (error) {
    console.error('加载趋势图失败:', error);
    ElMessage.error('加载销售趋势数据失败，请稍后重试');
  } finally {
    trendLoading.value = false;
  }
}

/**
 * 加载产品分布图数据
 * API: GET /{factoryId}/smart-bi/analysis/sales?dimension=product
 */
async function loadProductData() {
  if (!factoryId.value || !dateRange.value) return;
  pieLoading.value = true;
  try {
    const params = {
      startDate: formatDate(dateRange.value[0]),
      endDate: formatDate(dateRange.value[1]),
      dimension: 'product'
    };
    const response = await get(`/${factoryId.value}/smart-bi/analysis/sales`, { params });
    if (response.success && response.data) {
      const data = response.data as { chart?: ChartConfig };
      if (data.chart) {
        pieChartConfig.value = data.chart;
        updatePieChart();
      }
    } else {
      ElMessage.error(response.message || '加载产品分布图失败');
    }
  } catch (error) {
    console.error('加载产品分布图失败:', error);
    ElMessage.error('加载产品分布数据失败，请稍后重试');
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

  trendChart = echarts.init(chartDom);
}

function initPieChart() {
  const chartDom = document.getElementById('sales-pie-chart');
  if (!chartDom) return;

  pieChart = echarts.init(chartDom);
}

/**
 * 根据 API 返回的 ChartConfig 更新趋势图
 */
function updateTrendChart() {
  if (!trendChart) return;

  const config = trendChartConfig.value;
  if (!config || !config.data || config.data.length === 0) {
    // 无数据时显示空状态
    trendChart.setOption({
      title: {
        text: '暂无趋势数据',
        left: 'center',
        top: 'center',
        textStyle: { color: '#909399', fontSize: 14 }
      }
    });
    return;
  }

  // 从 API 数据中提取 X 轴和 Y 轴数据
  const xAxisField = config.xAxisField || 'date';
  const yAxisField = config.yAxisField || 'value';

  const xAxisData = config.data.map(item => String(item[xAxisField] || ''));
  const salesData = config.data.map(item => Number(item[yAxisField]) || 0);

  // 尝试获取订单数据（如果存在 seriesField 或 orderCount 字段）
  const orderData = config.data.map(item => Number(item['orderCount'] || item['count']) || 0);
  const hasOrderData = orderData.some(v => v > 0);

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
        itemStyle: { color: '#409EFF' }
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
        itemStyle: { color: '#409EFF' }
      }
    ]
  };

  trendChart.setOption(option, true);
}

/**
 * 根据 API 返回的 ChartConfig 更新饼图
 */
function updatePieChart() {
  if (!pieChart) return;

  const config = pieChartConfig.value;
  if (!config || !config.data || config.data.length === 0) {
    // 无数据时显示空状态
    pieChart.setOption({
      title: {
        text: '暂无产品分布数据',
        left: 'center',
        top: 'center',
        textStyle: { color: '#909399', fontSize: 14 }
      }
    });
    return;
  }

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

function handleExport() {
  ElMessage.info('导出功能开发中...');
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
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/smart-bi' }">Smart BI</el-breadcrumb-item>
          <el-breadcrumb-item>销售分析</el-breadcrumb-item>
        </el-breadcrumb>
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
          />
        </div>
        <div class="filter-item">
          <span class="filter-label">
            <el-icon><TrendCharts /></el-icon>
            统计维度
          </span>
          <el-radio-group v-model="dimensionType">
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
          <el-select v-model="categoryFilter" placeholder="选择类别">
            <el-option
              v-for="cat in categories"
              :key="cat.value"
              :label="cat.label"
              :value="cat.value"
            />
          </el-select>
        </div>
      </div>
    </el-card>

    <!-- KPI 卡片 -->
    <el-row :gutter="16" class="kpi-section" v-loading="kpiLoading">
      <el-col
        v-for="card in kpiCards"
        :key="card.key"
        :xs="24"
        :sm="12"
        :md="6"
      >
        <el-card class="kpi-card">
          <div class="kpi-label">{{ card.title }}</div>
          <div class="kpi-value">{{ card.value }}</div>
          <div
            class="kpi-trend"
            :class="card.trend === 'up' ? 'growth-up' : card.trend === 'down' ? 'growth-down' : ''"
          >
            <span v-if="card.changeRate !== null && card.changeRate !== undefined">
              {{ card.changeRate >= 0 ? '+' : '' }}{{ card.changeRate.toFixed(1) }}%
            </span>
            <span v-if="card.compareText" class="compare-text">{{ card.compareText }}</span>
          </div>
        </el-card>
      </el-col>
      <!-- 无数据时的占位 -->
      <el-col v-if="kpiCards.length === 0 && !kpiLoading" :span="24">
        <el-empty description="暂无 KPI 数据" :image-size="80" />
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
            <el-table-column label="订单数" prop="orderCount" width="80" align="center" />
            <el-table-column label="增长" width="80" align="right">
              <template #default="{ row }">
                <span :class="getGrowthClass(row.growth)">
                  {{ formatPercent(row.growth) }}
                </span>
              </template>
            </el-table-column>
          </el-table>
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
          <div id="sales-trend-chart" class="chart-container"></div>
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
          <div id="sales-pie-chart" class="pie-chart-container"></div>
        </el-card>
      </el-col>
    </el-row>
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
}

.kpi-card {
  border-radius: 8px;
  text-align: center;
  padding: 8px 0;

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
  }
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

// 响应式
@media (max-width: 768px) {
  .filter-bar {
    flex-direction: column;
    align-items: flex-start !important;
  }

  .filter-item {
    width: 100%;
  }
}
</style>
