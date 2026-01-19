<script setup lang="ts">
/**
 * SmartBI 财务分析页面
 * 提供财务数据分析，包含利润、成本、应收、应付、预算等模块
 */
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import {
  Refresh,
  TrendCharts,
  Wallet,
  Money,
  CreditCard,
  Document,
  Warning,
  ArrowUp,
  ArrowDown
} from '@element-plus/icons-vue';
import * as echarts from 'echarts';

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

// 分析类型
type AnalysisType = 'profit' | 'cost' | 'receivable' | 'payable' | 'budget';
const analysisType = ref<AnalysisType>('profit');

// 加载状态
const loading = ref(false);

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
interface Warning {
  level: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  amount?: number;
}
const warnings = ref<Warning[]>([]);

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

onMounted(() => {
  loadFinanceData();
  initChart();
});

watch(analysisType, () => {
  loadFinanceData();
  updateChart();
});

async function loadFinanceData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/smart-bi/finance/${analysisType.value}`);
    if (response.success && response.data) {
      kpiData.value = { ...kpiData.value, ...response.data };
      warnings.value = (response.data as any).warnings || [];
    }
  } catch (error) {
    console.error('加载财务数据失败:', error);
    // 使用示例数据
    loadMockData();
  } finally {
    loading.value = false;
  }
}

function loadMockData() {
  kpiData.value = {
    grossProfit: 856000,
    grossProfitMargin: 30,
    netProfit: 428400,
    netProfitMargin: 15,
    totalCost: 1999600,
    costGrowth: 8.5,
    materialCost: 1199760,
    laborCost: 399920,
    overheadCost: 399920,
    totalReceivable: 1285000,
    receivableAge30: 856000,
    receivableAge60: 285600,
    receivableAge90Plus: 143400,
    totalPayable: 985000,
    payableAge30: 656000,
    payableAge60: 214500,
    payableAge90Plus: 114500,
    budgetTotal: 3000000,
    budgetUsed: 2285600,
    budgetRemaining: 714400,
    budgetUsageRate: 76.2
  };

  // 根据分析类型设置不同的预警
  if (analysisType.value === 'receivable') {
    warnings.value = [
      { level: 'danger', title: '逾期90天以上', description: '3笔应收款项逾期超过90天', amount: 143400 },
      { level: 'warning', title: '逾期60天', description: '5笔应收款项逾期60天', amount: 285600 },
      { level: 'info', title: '即将到期', description: '8笔应收款项将于7天内到期', amount: 425000 }
    ];
  } else if (analysisType.value === 'payable') {
    warnings.value = [
      { level: 'danger', title: '即将逾期', description: '2笔应付款项即将逾期', amount: 114500 },
      { level: 'warning', title: '付款提醒', description: '4笔应付款项将于本周到期', amount: 285000 }
    ];
  } else if (analysisType.value === 'budget') {
    warnings.value = [
      { level: 'warning', title: '预算预警', description: '生产部门预算使用率达 92%', amount: 0 },
      { level: 'info', title: '预算提醒', description: '销售费用已使用 85%', amount: 0 }
    ];
  } else if (analysisType.value === 'cost') {
    warnings.value = [
      { level: 'warning', title: '成本上涨', description: '原材料成本环比上涨 12%', amount: 0 },
      { level: 'info', title: '成本优化', description: '人工成本下降 3%', amount: 0 }
    ];
  } else {
    warnings.value = [
      { level: 'info', title: '利润增长', description: '净利润率同比提升 2.3%', amount: 0 }
    ];
  }
}

function initChart() {
  const chartDom = document.getElementById('finance-main-chart');
  if (!chartDom) return;

  mainChart = echarts.init(chartDom);
  updateChart();
  window.addEventListener('resize', handleResize);
}

function updateChart() {
  if (!mainChart) return;

  let option: echarts.EChartsOption;

  switch (analysisType.value) {
    case 'profit':
      option = getProfitChartOption();
      break;
    case 'cost':
      option = getCostChartOption();
      break;
    case 'receivable':
      option = getReceivableChartOption();
      break;
    case 'payable':
      option = getPayableChartOption();
      break;
    case 'budget':
      option = getBudgetChartOption();
      break;
    default:
      option = getProfitChartOption();
  }

  mainChart.setOption(option, true);
}

function getProfitChartOption(): echarts.EChartsOption {
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['收入', '成本', '利润'],
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
      data: ['1月', '2月', '3月', '4月', '5月', '6月']
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => (value / 10000).toFixed(0) + '万'
      }
    },
    series: [
      {
        name: '收入',
        type: 'bar',
        data: [2100000, 2350000, 2580000, 2450000, 2680000, 2856000],
        itemStyle: { color: '#409EFF' }
      },
      {
        name: '成本',
        type: 'bar',
        data: [1470000, 1645000, 1806000, 1715000, 1876000, 1999600],
        itemStyle: { color: '#E6A23C' }
      },
      {
        name: '利润',
        type: 'line',
        data: [630000, 705000, 774000, 735000, 804000, 856400],
        lineStyle: { width: 3, color: '#67C23A' },
        itemStyle: { color: '#67C23A' }
      }
    ]
  };
}

function getCostChartOption(): echarts.EChartsOption {
  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}万 ({d}%)'
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
        data: [
          { value: 119.98, name: '原材料', itemStyle: { color: '#409EFF' } },
          { value: 39.99, name: '人工成本', itemStyle: { color: '#67C23A' } },
          { value: 25.99, name: '制造费用', itemStyle: { color: '#E6A23C' } },
          { value: 8.00, name: '管理费用', itemStyle: { color: '#F56C6C' } },
          { value: 6.00, name: '销售费用', itemStyle: { color: '#909399' } }
        ],
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

function getReceivableChartOption(): echarts.EChartsOption {
  return {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['30天内', '30-60天', '60-90天', '90天以上'],
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
      data: ['1月', '2月', '3月', '4月', '5月', '6月']
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => (value / 10000).toFixed(0) + '万'
      }
    },
    series: [
      {
        name: '30天内',
        type: 'bar',
        stack: 'total',
        data: [650000, 720000, 780000, 820000, 860000, 856000],
        itemStyle: { color: '#67C23A' }
      },
      {
        name: '30-60天',
        type: 'bar',
        stack: 'total',
        data: [180000, 200000, 220000, 240000, 260000, 285600],
        itemStyle: { color: '#E6A23C' }
      },
      {
        name: '60-90天',
        type: 'bar',
        stack: 'total',
        data: [80000, 90000, 100000, 110000, 120000, 100000],
        itemStyle: { color: '#F56C6C' }
      },
      {
        name: '90天以上',
        type: 'bar',
        stack: 'total',
        data: [50000, 60000, 70000, 80000, 100000, 143400],
        itemStyle: { color: '#909399' }
      }
    ]
  };
}

function getPayableChartOption(): echarts.EChartsOption {
  return {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['30天内', '30-60天', '60-90天', '90天以上'],
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
      data: ['1月', '2月', '3月', '4月', '5月', '6月']
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => (value / 10000).toFixed(0) + '万'
      }
    },
    series: [
      {
        name: '30天内',
        type: 'bar',
        stack: 'total',
        data: [450000, 500000, 550000, 580000, 620000, 656000],
        itemStyle: { color: '#67C23A' }
      },
      {
        name: '30-60天',
        type: 'bar',
        stack: 'total',
        data: [150000, 170000, 180000, 195000, 205000, 214500],
        itemStyle: { color: '#E6A23C' }
      },
      {
        name: '60-90天',
        type: 'bar',
        stack: 'total',
        data: [60000, 70000, 75000, 80000, 90000, 0],
        itemStyle: { color: '#F56C6C' }
      },
      {
        name: '90天以上',
        type: 'bar',
        stack: 'total',
        data: [40000, 50000, 60000, 80000, 100000, 114500],
        itemStyle: { color: '#909399' }
      }
    ]
  };
}

function getBudgetChartOption(): echarts.EChartsOption {
  return {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['预算', '实际', '使用率'],
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
      data: ['生产', '销售', '管理', '研发', '财务', '人事']
    },
    yAxis: [
      {
        type: 'value',
        name: '金额',
        axisLabel: {
          formatter: (value: number) => (value / 10000).toFixed(0) + '万'
        }
      },
      {
        type: 'value',
        name: '使用率',
        axisLabel: {
          formatter: '{value}%'
        },
        max: 100
      }
    ],
    series: [
      {
        name: '预算',
        type: 'bar',
        data: [1200000, 800000, 400000, 300000, 200000, 100000],
        itemStyle: { color: '#409EFF' }
      },
      {
        name: '实际',
        type: 'bar',
        data: [1104000, 680000, 340000, 210000, 160000, 91600],
        itemStyle: { color: '#67C23A' }
      },
      {
        name: '使用率',
        type: 'line',
        yAxisIndex: 1,
        data: [92, 85, 85, 70, 80, 92],
        lineStyle: { width: 3, color: '#E6A23C' },
        itemStyle: { color: '#E6A23C' }
      }
    ]
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
  updateChart();
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
            <div class="kpi-sub growth-down">环比 +{{ kpiData.costGrowth }}%</div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card">
            <div class="kpi-label">原材料成本</div>
            <div class="kpi-value">{{ formatMoney(kpiData.materialCost) }}</div>
            <div class="kpi-sub">占比 60%</div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card">
            <div class="kpi-label">人工成本</div>
            <div class="kpi-value">{{ formatMoney(kpiData.laborCost) }}</div>
            <div class="kpi-sub">占比 20%</div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="kpi-card">
            <div class="kpi-label">间接成本</div>
            <div class="kpi-value">{{ formatMoney(kpiData.overheadCost) }}</div>
            <div class="kpi-sub">占比 20%</div>
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
}
</style>
