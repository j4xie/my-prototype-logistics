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

// KPI 数据
interface SalesKPI {
  totalSales: number;
  salesGrowth: number;
  orderCount: number;
  orderGrowth: number;
  avgOrderValue: number;
  avgValueGrowth: number;
  conversionRate: number;
  conversionGrowth: number;
}

const kpiData = ref<SalesKPI>({
  totalSales: 0,
  salesGrowth: 0,
  orderCount: 0,
  orderGrowth: 0,
  avgOrderValue: 0,
  avgValueGrowth: 0,
  conversionRate: 0,
  conversionGrowth: 0
});

// 销售员排行
interface SalesPersonRank {
  name: string;
  avatar?: string;
  sales: number;
  orderCount: number;
  growth: number;
}
const salesPersonRanking = ref<SalesPersonRank[]>([]);

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
  updateCharts();
});

async function loadSalesData() {
  loading.value = true;
  try {
    await Promise.all([
      loadKPIData(),
      loadRankingData()
    ]);
  } finally {
    loading.value = false;
  }
}

async function loadKPIData() {
  if (!factoryId.value) return;
  kpiLoading.value = true;
  try {
    const params = buildQueryParams();
    const response = await get(`/${factoryId.value}/smart-bi/sales/kpi`, { params });
    if (response.success && response.data) {
      kpiData.value = response.data as SalesKPI;
    }
  } catch (error) {
    console.error('加载销售 KPI 失败:', error);
    // 使用示例数据
    kpiData.value = {
      totalSales: 2856000,
      salesGrowth: 12.5,
      orderCount: 1256,
      orderGrowth: 15.2,
      avgOrderValue: 2273,
      avgValueGrowth: -2.3,
      conversionRate: 23.5,
      conversionGrowth: 3.8
    };
  } finally {
    kpiLoading.value = false;
  }
}

async function loadRankingData() {
  if (!factoryId.value) return;
  rankingLoading.value = true;
  try {
    const params = buildQueryParams();
    const response = await get(`/${factoryId.value}/smart-bi/sales/ranking`, { params });
    if (response.success && response.data) {
      salesPersonRanking.value = response.data as SalesPersonRank[];
    }
  } catch (error) {
    console.error('加载销售员排行失败:', error);
    // 使用示例数据
    salesPersonRanking.value = [
      { name: '张三', sales: 456000, orderCount: 128, growth: 22.5 },
      { name: '李四', sales: 398000, orderCount: 105, growth: 18.3 },
      { name: '王五', sales: 356000, orderCount: 96, growth: 12.8 },
      { name: '赵六', sales: 312000, orderCount: 88, growth: 8.5 },
      { name: '钱七', sales: 285000, orderCount: 76, growth: 5.2 },
      { name: '孙八', sales: 268000, orderCount: 72, growth: -2.3 },
      { name: '周九', sales: 245000, orderCount: 68, growth: -5.8 },
      { name: '吴十', sales: 218000, orderCount: 62, growth: -8.2 }
    ];
  } finally {
    rankingLoading.value = false;
  }
}

function buildQueryParams() {
  const params: Record<string, string> = {};
  if (dateRange.value) {
    params.startDate = formatDate(dateRange.value[0]);
    params.endDate = formatDate(dateRange.value[1]);
  }
  params.dimension = dimensionType.value;
  if (categoryFilter.value !== 'all') {
    params.category = categoryFilter.value;
  }
  return params;
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
  updateTrendChart();
}

function initPieChart() {
  const chartDom = document.getElementById('sales-pie-chart');
  if (!chartDom) return;

  pieChart = echarts.init(chartDom);
  updatePieChart();
}

function updateCharts() {
  updateTrendChart();
  updatePieChart();
}

function updateTrendChart() {
  if (!trendChart) return;

  // 根据维度生成不同的数据
  let xAxisData: string[];
  let salesData: number[];
  let orderData: number[];

  if (dimensionType.value === 'daily') {
    xAxisData = Array.from({ length: 30 }, (_, i) => `${i + 1}日`);
    salesData = Array.from({ length: 30 }, () => Math.floor(Math.random() * 50000 + 80000));
    orderData = Array.from({ length: 30 }, () => Math.floor(Math.random() * 30 + 35));
  } else if (dimensionType.value === 'weekly') {
    xAxisData = ['第1周', '第2周', '第3周', '第4周'];
    salesData = [685000, 720000, 756000, 695000];
    orderData = [285, 312, 328, 331];
  } else {
    xAxisData = ['1月', '2月', '3月', '4月', '5月', '6月'];
    salesData = [2100000, 2350000, 2580000, 2450000, 2680000, 2856000];
    orderData = [985, 1050, 1128, 1085, 1198, 1256];
  }

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['销售额', '订单数'],
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
    yAxis: [
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
    ],
    series: [
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
    ]
  };

  trendChart.setOption(option);
}

function updatePieChart() {
  if (!pieChart) return;

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
        data: [
          { value: 128, name: '冷冻肉类', itemStyle: { color: '#409EFF' } },
          { value: 86, name: '海鲜产品', itemStyle: { color: '#67C23A' } },
          { value: 52, name: '速冻食品', itemStyle: { color: '#E6A23C' } },
          { value: 34, name: '乳制品', itemStyle: { color: '#F56C6C' } },
          { value: 28, name: '其他', itemStyle: { color: '#909399' } }
        ]
      }
    ]
  };

  pieChart.setOption(option);
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
  updateCharts();
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
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="kpi-card">
          <div class="kpi-label">销售总额</div>
          <div class="kpi-value">{{ formatMoney(kpiData.totalSales) }}</div>
          <div class="kpi-trend" :class="getGrowthClass(kpiData.salesGrowth)">
            {{ formatPercent(kpiData.salesGrowth) }}
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="kpi-card">
          <div class="kpi-label">订单数量</div>
          <div class="kpi-value">{{ kpiData.orderCount.toLocaleString() }}</div>
          <div class="kpi-trend" :class="getGrowthClass(kpiData.orderGrowth)">
            {{ formatPercent(kpiData.orderGrowth) }}
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="kpi-card">
          <div class="kpi-label">客单价</div>
          <div class="kpi-value">{{ kpiData.avgOrderValue.toLocaleString() }}</div>
          <div class="kpi-trend" :class="getGrowthClass(kpiData.avgValueGrowth)">
            {{ formatPercent(kpiData.avgValueGrowth) }}
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="kpi-card">
          <div class="kpi-label">转化率</div>
          <div class="kpi-value">{{ kpiData.conversionRate.toFixed(1) }}%</div>
          <div class="kpi-trend" :class="getGrowthClass(kpiData.conversionGrowth)">
            {{ formatPercent(kpiData.conversionGrowth) }}
          </div>
        </el-card>
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
        <el-card class="chart-card">
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
        <el-card class="chart-card">
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
