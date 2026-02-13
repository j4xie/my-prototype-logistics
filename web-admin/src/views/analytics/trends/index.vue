<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import echarts from '@/utils/echarts';

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

const loading = ref(false);
const selectedPeriod = ref('week');
const selectedModule = ref('all');

// 趋势数据
const trendData = ref({
  productionTrend: [] as any[],
  qualityTrend: [] as any[],
  costTrend: [] as any[],
  materialTrend: [] as any[],
  equipmentTrend: [] as any[]
});

// 图表实例
let productionChart: echarts.ECharts | null = null;
let qualityChart: echarts.ECharts | null = null;
let costChart: echarts.ECharts | null = null;

const periodOptions = [
  { label: '近7天', value: 'week' },
  { label: '近30天', value: 'month' },
  { label: '近90天', value: 'quarter' }
];

const moduleOptions = [
  { label: '全部模块', value: 'all' },
  { label: '生产', value: 'production' },
  { label: '质量', value: 'quality' },
  { label: '成本', value: 'cost' }
];

onMounted(() => {
  loadTrendData();
  initCharts();
  window.addEventListener('resize', handleResize);
});

watch([selectedPeriod, selectedModule], () => {
  loadTrendData();
});

async function loadTrendData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/reports/dashboard/trends`, {
      params: { period: selectedPeriod.value }
    });
    if (response.success && response.data) {
      trendData.value = response.data;
      updateCharts();
    }
  } catch (error) {
    console.error('加载趋势数据失败:', error);
  } finally {
    loading.value = false;
  }
}

function initCharts() {
  const productionEl = document.getElementById('production-chart');
  const qualityEl = document.getElementById('quality-chart');
  const costEl = document.getElementById('cost-chart');

  if (productionEl) {
    productionChart = echarts.init(productionEl, 'cretas');
  }
  if (qualityEl) {
    qualityChart = echarts.init(qualityEl, 'cretas');
  }
  if (costEl) {
    costChart = echarts.init(costEl, 'cretas');
  }
}

function updateCharts() {
  // 生产趋势图
  if (productionChart) {
    const data = trendData.value.productionTrend || [];
    productionChart.setOption({
      title: { text: '生产趋势', left: 'center' },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.map((d: any) => d.date || d.label)
      },
      yAxis: { type: 'value', name: '产量' },
      series: [{
        name: '产量',
        type: 'line',
        smooth: true,
        data: data.map((d: any) => d.output || d.value || 0),
        areaStyle: { opacity: 0.3 },
        itemStyle: { color: '#409EFF' }
      }]
    });
  }

  // 质量趋势图
  if (qualityChart) {
    const data = trendData.value.qualityTrend || [];
    qualityChart.setOption({
      title: { text: '质量趋势', left: 'center' },
      tooltip: { trigger: 'axis', formatter: '{b}: {c}%' },
      xAxis: {
        type: 'category',
        data: data.map((d: any) => d.date || d.label)
      },
      yAxis: { type: 'value', name: '合格率 (%)', max: 100 },
      series: [{
        name: '合格率',
        type: 'line',
        smooth: true,
        data: data.map((d: any) => ((d.passRate || d.value || 0) * 100).toFixed(1)),
        areaStyle: { opacity: 0.3 },
        itemStyle: { color: '#67C23A' }
      }]
    });
  }

  // 成本趋势图
  if (costChart) {
    const data = trendData.value.costTrend || [];
    costChart.setOption({
      title: { text: '成本趋势', left: 'center' },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.map((d: any) => d.date || d.label)
      },
      yAxis: { type: 'value', name: '成本 (元)' },
      series: [{
        name: '总成本',
        type: 'bar',
        data: data.map((d: any) => d.totalCost || d.value || 0),
        itemStyle: { color: '#E6A23C' }
      }]
    });
  }
}

function handleResize() {
  productionChart?.resize();
  qualityChart?.resize();
  costChart?.resize();
}

function handleRefresh() {
  loadTrendData();
}
</script>

<template>
  <div class="trends-page">
    <div class="page-header">
      <div class="header-left">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/analytics' }">数据分析</el-breadcrumb-item>
          <el-breadcrumb-item>趋势分析</el-breadcrumb-item>
        </el-breadcrumb>
        <h1>趋势分析</h1>
      </div>
      <div class="header-right">
        <el-select v-model="selectedPeriod" style="width: 120px; margin-right: 12px;">
          <el-option v-for="opt in periodOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-button type="primary" @click="handleRefresh">刷新</el-button>
      </div>
    </div>

    <div class="charts-container" v-loading="loading">
      <el-row :gutter="16">
        <el-col :span="24">
          <el-card class="chart-card">
            <div id="production-chart" class="chart"></div>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-card class="chart-card">
            <div id="quality-chart" class="chart"></div>
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card class="chart-card">
            <div id="cost-chart" class="chart"></div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.trends-page {
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
    align-items: center;
  }
}

.charts-container {
  .el-row {
    margin-bottom: 16px;
  }
}

.chart-card {
  border-radius: 8px;

  .chart {
    height: 350px;
    width: 100%;
  }
}
</style>
