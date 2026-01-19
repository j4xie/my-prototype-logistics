<script setup lang="ts">
/**
 * SmartBI 经营驾驶舱
 * 展示企业经营核心 KPI、排行榜、趋势图表和 AI 洞察
 */
import { ref, computed, onMounted } from 'vue';
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

// 加载状态
const loading = ref(false);
const kpiLoading = ref(false);
const rankingLoading = ref(false);
const chartLoading = ref(false);
const insightLoading = ref(false);

// KPI 数据
interface KPIData {
  totalRevenue: number;
  revenueGrowth: number;
  totalProfit: number;
  profitGrowth: number;
  orderCount: number;
  orderGrowth: number;
  customerCount: number;
  customerGrowth: number;
}

const kpiData = ref<KPIData>({
  totalRevenue: 0,
  revenueGrowth: 0,
  totalProfit: 0,
  profitGrowth: 0,
  orderCount: 0,
  orderGrowth: 0,
  customerCount: 0,
  customerGrowth: 0
});

// 部门排行数据
interface DepartmentRank {
  name: string;
  sales: number;
  growth: number;
}
const departmentRanking = ref<DepartmentRank[]>([]);

// 区域排行数据
interface RegionRank {
  name: string;
  sales: number;
  percentage: number;
}
const regionRanking = ref<RegionRank[]>([]);

// AI 洞察
interface AIInsight {
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  content: string;
}
const aiInsights = ref<AIInsight[]>([]);

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

onMounted(() => {
  loadDashboardData();
  initCharts();
});

async function loadDashboardData() {
  loading.value = true;
  try {
    await Promise.all([
      loadKPIData(),
      loadRankingData(),
      loadAIInsights()
    ]);
  } finally {
    loading.value = false;
  }
}

async function loadKPIData() {
  if (!factoryId.value) return;
  kpiLoading.value = true;
  try {
    const response = await get(`/${factoryId.value}/smart-bi/dashboard/kpi`);
    if (response.success && response.data) {
      kpiData.value = response.data as KPIData;
    }
  } catch (error) {
    console.error('加载 KPI 数据失败:', error);
    // 使用示例数据
    kpiData.value = {
      totalRevenue: 2856000,
      revenueGrowth: 12.5,
      totalProfit: 428400,
      profitGrowth: 8.3,
      orderCount: 1256,
      orderGrowth: 15.2,
      customerCount: 328,
      customerGrowth: 6.8
    };
  } finally {
    kpiLoading.value = false;
  }
}

async function loadRankingData() {
  if (!factoryId.value) return;
  rankingLoading.value = true;
  try {
    const response = await get(`/${factoryId.value}/smart-bi/dashboard/ranking`);
    if (response.success && response.data) {
      departmentRanking.value = response.data.departments || [];
      regionRanking.value = response.data.regions || [];
    }
  } catch (error) {
    console.error('加载排行数据失败:', error);
    // 使用示例数据
    departmentRanking.value = [
      { name: '销售一部', sales: 856000, growth: 18.5 },
      { name: '销售二部', sales: 725000, growth: 12.3 },
      { name: '销售三部', sales: 680000, growth: 8.7 },
      { name: '销售四部', sales: 595000, growth: 5.2 }
    ];
    regionRanking.value = [
      { name: '华东区', sales: 1285000, percentage: 45 },
      { name: '华南区', sales: 856000, percentage: 30 },
      { name: '华北区', sales: 428500, percentage: 15 },
      { name: '其他', sales: 286500, percentage: 10 }
    ];
  } finally {
    rankingLoading.value = false;
  }
}

async function loadAIInsights() {
  if (!factoryId.value) return;
  insightLoading.value = true;
  try {
    const response = await get(`/${factoryId.value}/smart-bi/dashboard/insights`);
    if (response.success && response.data) {
      aiInsights.value = response.data as AIInsight[];
    }
  } catch (error) {
    console.error('加载 AI 洞察失败:', error);
    // 使用示例数据
    aiInsights.value = [
      { type: 'success', title: '销售增长强劲', content: '本月销售额同比增长12.5%，主要得益于华东区的快速扩张。' },
      { type: 'warning', title: '库存周转偏低', content: '部分产品库存周转天数超过30天，建议优化采购计划。' },
      { type: 'info', title: '客户结构优化', content: '高价值客户占比提升至28%，客单价持续增长。' }
    ];
  } finally {
    insightLoading.value = false;
  }
}

function initCharts() {
  // 初始化销售趋势图
  const trendChartDom = document.getElementById('trend-chart');
  if (trendChartDom) {
    trendChart = echarts.init(trendChartDom);
    const trendOption: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['销售额', '利润'],
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
        data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
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
          name: '利润',
          axisLabel: {
            formatter: (value: number) => (value / 10000).toFixed(0) + '万'
          }
        }
      ],
      series: [
        {
          name: '销售额',
          type: 'line',
          smooth: true,
          data: [180, 200, 220, 250, 280, 320, 350, 380, 400, 420, 450, 480].map(v => v * 10000),
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
          name: '利润',
          type: 'line',
          smooth: true,
          yAxisIndex: 1,
          data: [27, 30, 33, 38, 42, 48, 52, 57, 60, 63, 68, 72].map(v => v * 10000),
          lineStyle: { width: 3, color: '#67C23A' },
          itemStyle: { color: '#67C23A' }
        }
      ]
    };
    trendChart.setOption(trendOption);
  }

  // 初始化产品占比饼图
  const pieChartDom = document.getElementById('pie-chart');
  if (pieChartDom) {
    pieChart = echarts.init(pieChartDom);
    const pieOption: echarts.EChartsOption = {
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
    pieChart.setOption(pieOption);
  }

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize);
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

// 组件销毁时清理图表
import { onUnmounted } from 'vue';
onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  trendChart?.dispose();
  pieChart?.dispose();
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
        <el-button type="primary" :icon="Refresh" @click="loadDashboardData">刷新数据</el-button>
        <el-button type="success" :icon="ChatDotRound" @click="goToAIQuery()">AI 问答</el-button>
      </div>
    </div>

    <!-- KPI 卡片区 -->
    <el-row :gutter="16" class="kpi-section" v-loading="kpiLoading">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="kpi-card revenue">
          <div class="kpi-icon">
            <el-icon><DataLine /></el-icon>
          </div>
          <div class="kpi-content">
            <div class="kpi-label">本月销售额</div>
            <div class="kpi-value">{{ formatMoney(kpiData.totalRevenue) }}</div>
            <div class="kpi-trend" :class="getGrowthClass(kpiData.revenueGrowth)">
              <el-icon v-if="kpiData.revenueGrowth >= 0"><ArrowUp /></el-icon>
              <el-icon v-else><ArrowDown /></el-icon>
              <span>{{ formatPercent(kpiData.revenueGrowth) }}</span>
              <span class="vs-label">vs 上月</span>
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
            <div class="kpi-value">{{ formatMoney(kpiData.totalProfit) }}</div>
            <div class="kpi-trend" :class="getGrowthClass(kpiData.profitGrowth)">
              <el-icon v-if="kpiData.profitGrowth >= 0"><ArrowUp /></el-icon>
              <el-icon v-else><ArrowDown /></el-icon>
              <span>{{ formatPercent(kpiData.profitGrowth) }}</span>
              <span class="vs-label">vs 上月</span>
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
            <div class="kpi-value">{{ kpiData.orderCount.toLocaleString() }}</div>
            <div class="kpi-trend" :class="getGrowthClass(kpiData.orderGrowth)">
              <el-icon v-if="kpiData.orderGrowth >= 0"><ArrowUp /></el-icon>
              <el-icon v-else><ArrowDown /></el-icon>
              <span>{{ formatPercent(kpiData.orderGrowth) }}</span>
              <span class="vs-label">vs 上月</span>
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
            <div class="kpi-value">{{ kpiData.customerCount.toLocaleString() }}</div>
            <div class="kpi-trend" :class="getGrowthClass(kpiData.customerGrowth)">
              <el-icon v-if="kpiData.customerGrowth >= 0"><ArrowUp /></el-icon>
              <el-icon v-else><ArrowDown /></el-icon>
              <span>{{ formatPercent(kpiData.customerGrowth) }}</span>
              <span class="vs-label">vs 上月</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 排行榜区 -->
    <el-row :gutter="16" class="ranking-section" v-loading="rankingLoading">
      <el-col :xs="24" :md="12">
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
      <el-col :xs="24" :md="12">
        <el-card class="ranking-card">
          <template #header>
            <div class="card-header">
              <el-icon><Location /></el-icon>
              <span>区域销售分布</span>
            </div>
          </template>
          <div class="ranking-list">
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
        <el-card class="insight-card" v-loading="insightLoading">
          <template #header>
            <div class="card-header">
              <el-icon><ChatDotRound /></el-icon>
              <span>AI 智能洞察</span>
            </div>
          </template>
          <div class="insight-list">
            <div
              v-for="(insight, index) in aiInsights"
              :key="index"
              class="insight-item"
            >
              <el-tag :type="getInsightTagType(insight.type)" size="small">
                {{ insight.title }}
              </el-tag>
              <span class="insight-content">{{ insight.content }}</span>
            </div>
          </div>
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
