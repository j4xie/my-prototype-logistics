<script setup lang="ts">
/**
 * SmartBI 销售分析页面
 * 提供销售数据的多维度分析，包含筛选、KPI、排行榜和图表
 * 使用动态渲染组件自动适配后端返回的数据
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import {
  Refresh,
  TrendCharts,
  Calendar,
  Filter,
  Download,
} from '@element-plus/icons-vue';
import DynamicKPIRow from '@/components/smartbi/DynamicKPIRow.vue';
import DynamicRankingsRow from '@/components/smartbi/DynamicRankingsRow.vue';
import DynamicChartsSection from '@/components/smartbi/DynamicChartsSection.vue';
import type { KPICard, RankingItem, ChartConfig, LegacyChartConfig } from '@/types/smartbi';

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId || 'F001');

// 筛选条件
const dateRange = ref<[Date, Date] | null>(null);
const dimensionType = ref<'daily' | 'weekly' | 'monthly'>('daily');
const categoryFilter = ref<string>('all');

// 加载状态
const loading = ref(false);

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
];

// 产品类别
const categories = ref([
  { value: 'all', label: '全部类别' },
  { value: 'frozen_meat', label: '冷冻肉类' },
  { value: 'seafood', label: '海鲜产品' },
  { value: 'frozen_food', label: '速冻食品' },
  { value: 'dairy', label: '乳制品' },
]);

// 动态数据
const kpiCards = ref<KPICard[]>([]);
const allRankings = ref<Record<string, RankingItem[]>>({});
const allCharts = ref<Record<string, ChartConfig>>({});

const hasRankings = computed(() =>
  Object.values(allRankings.value).some(items => items && items.length > 0)
);

const hasCharts = computed(() => Object.keys(allCharts.value).length > 0);

onMounted(() => {
  // 默认选择最近30天
  const end = new Date();
  const start = new Date();
  start.setTime(start.getTime() - 3600 * 1000 * 24 * 30);
  dateRange.value = [start, end];

  loadSalesData();
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
      loadProductData(),
    ]);
  } finally {
    loading.value = false;
  }
}

function getParams() {
  if (!factoryId.value || !dateRange.value) return null;
  return {
    startDate: formatDate(dateRange.value[0]),
    endDate: formatDate(dateRange.value[1]),
  };
}

/**
 * 加载概览数据 (包含 KPI 卡片和可能的 rankings/charts)
 */
async function loadOverviewData() {
  const params = getParams();
  if (!params) return;

  try {
    const response = await get(`/${factoryId.value}/smart-bi/analysis/sales`, { params });
    if (response.success && response.data) {
      const data = response.data as Record<string, unknown>;

      // 提取 KPI
      const overview = data.overview as Record<string, unknown> | undefined;
      if (overview?.kpiCards) {
        kpiCards.value = overview.kpiCards as KPICard[];
      }

      // 提取 overview 级别的 rankings
      if (overview?.rankings) {
        const overviewRankings = overview.rankings as Record<string, RankingItem[]>;
        allRankings.value = { ...allRankings.value, ...overviewRankings };
      }

      // 提取 overview 级别的 charts
      if (overview?.charts) {
        const overviewCharts = overview.charts as Record<string, ChartConfig>;
        allCharts.value = { ...allCharts.value, ...overviewCharts };
      }
    } else {
      ElMessage.error(response.message || '加载销售概览失败');
    }
  } catch (error) {
    console.error('加载销售 KPI 失败:', error);
    ElMessage.error('加载销售 KPI 数据失败，请稍后重试');
  }
}

/**
 * 加载排行数据 (salesperson 维度)
 */
async function loadRankingData() {
  const params = getParams();
  if (!params) return;

  try {
    const response = await get(`/${factoryId.value}/smart-bi/analysis/sales`, {
      params: { ...params, dimension: 'salesperson' },
    });
    if (response.success && response.data) {
      const data = response.data as Record<string, unknown>;

      // 支持多种返回格式
      if (data.ranking) {
        // 旧格式: { ranking: SalesPersonRank[] } → 转换为 RankingItem
        const rawRanking = data.ranking as Array<{
          name: string;
          sales: number;
          orderCount?: number;
          growth?: number;
        }>;
        allRankings.value = {
          ...allRankings.value,
          salesperson: rawRanking.map((item, index) => ({
            rank: index + 1,
            name: item.name,
            value: item.sales,
            target: 0,
            completionRate: item.growth != null ? 100 + item.growth : 100,
            alertLevel: 'GREEN' as const,
          })),
        };
      }

      if (data.rankings) {
        const rankings = data.rankings as Record<string, RankingItem[]>;
        allRankings.value = { ...allRankings.value, ...rankings };
      }
    }
  } catch (error) {
    console.error('加载销售员排行失败:', error);
  }
}

/**
 * 加载趋势图数据
 */
async function loadTrendData() {
  const params = getParams();
  if (!params) return;

  try {
    const response = await get(`/${factoryId.value}/smart-bi/analysis/sales`, {
      params: { ...params, dimension: 'trend' },
    });
    if (response.success && response.data) {
      const data = response.data as Record<string, unknown>;
      if (data.chart) {
        allCharts.value = {
          ...allCharts.value,
          sales_trend: data.chart as ChartConfig,
        };
      }
      if (data.charts) {
        const charts = data.charts as Record<string, ChartConfig>;
        allCharts.value = { ...allCharts.value, ...charts };
      }
    }
  } catch (error) {
    console.error('加载趋势图失败:', error);
  }
}

/**
 * 加载产品分布图数据
 */
async function loadProductData() {
  const params = getParams();
  if (!params) return;

  try {
    const response = await get(`/${factoryId.value}/smart-bi/analysis/sales`, {
      params: { ...params, dimension: 'product' },
    });
    if (response.success && response.data) {
      const data = response.data as Record<string, unknown>;
      if (data.chart) {
        allCharts.value = {
          ...allCharts.value,
          product_distribution: data.chart as ChartConfig,
        };
      }
      if (data.charts) {
        const charts = data.charts as Record<string, ChartConfig>;
        allCharts.value = { ...allCharts.value, ...charts };
      }
    }
  } catch (error) {
    console.error('加载产品分布图失败:', error);
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function handleExport() {
  ElMessage.info('导出功能开发中...');
}

function handleRefresh() {
  // Reset collected data
  allRankings.value = {};
  allCharts.value = {};
  loadSalesData();
}
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

    <!-- 动态 KPI 卡片 -->
    <DynamicKPIRow :cards="kpiCards" :loading="loading" />

    <!-- 动态排行榜 -->
    <DynamicRankingsRow v-if="hasRankings" :rankings="allRankings" :loading="loading" />

    <!-- 动态图表 -->
    <DynamicChartsSection v-if="hasCharts" :charts="allCharts" :loading="loading" />
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
