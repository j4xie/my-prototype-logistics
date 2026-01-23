<script setup lang="ts">
/**
 * SmartBI Phase 4 - Advanced Finance Analysis Dashboard
 * Comprehensive finance analysis integrating all SmartBI chart components
 * Features: Period selection, KPI cards, budget analysis, YoY/MoM comparison,
 *           category structure, waterfall chart, and AI insights
 */
import { ref, computed, onMounted, watch, provide, reactive } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import { Refresh, TrendCharts } from '@element-plus/icons-vue';

// Import SmartBI components
import {
  PeriodSelector,
  KPICard,
  BudgetAchievementChart,
  YoYMoMComparisonChart,
  NestedDonutChart,
  CategoryStructureComparisonChart,
  WaterfallChart,
  AIInsightPanel
} from '@/components/smartbi';

// Import types
import type { PeriodSelection } from '@/components/smartbi';
import type { BudgetData } from '@/components/smartbi/BudgetAchievementChart.vue';
import type { ComparisonData } from '@/components/smartbi/YoYMoMComparisonChart.vue';
import type { NestedDonutDataItem } from '@/components/smartbi/NestedDonutChart.vue';
import type { CategoryComparisonData, CategorySummary } from '@/components/smartbi/CategoryStructureComparisonChart.vue';
import type { WaterfallDataPoint } from '@/components/smartbi/WaterfallChart.vue';
import type { AIInsight } from '@/components/smartbi/AIInsightPanel.vue';

// Auth store
const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

// Period selection state
const periodSelection = ref<PeriodSelection>({
  type: 'month',
  year: new Date().getFullYear(),
  value: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  compareEnabled: true
});

// Loading states
const loading = reactive({
  kpi: false,
  budget: false,
  yoyMom: false,
  donut: false,
  category: false,
  waterfall: false,
  insight: false
});

// Error states
const errors = reactive({
  kpi: '',
  budget: '',
  yoyMom: '',
  donut: '',
  category: '',
  waterfall: '',
  insight: ''
});

// KPI Data
interface KPIData {
  revenue: { value: number; trend: 'up' | 'down' | 'flat'; trendValue: number };
  cost: { value: number; trend: 'up' | 'down' | 'flat'; trendValue: number };
  profit: { value: number; trend: 'up' | 'down' | 'flat'; trendValue: number };
  margin: { value: number; trend: 'up' | 'down' | 'flat'; trendValue: number };
}

const kpiData = ref<KPIData>({
  revenue: { value: 0, trend: 'flat', trendValue: 0 },
  cost: { value: 0, trend: 'flat', trendValue: 0 },
  profit: { value: 0, trend: 'flat', trendValue: 0 },
  margin: { value: 0, trend: 'flat', trendValue: 0 }
});

// Budget Achievement Data
const budgetData = ref<BudgetData[]>([]);
const yearTarget = ref(0);
const yearActual = ref(0);

// YoY/MoM Comparison Data
const yoyMomData = ref<ComparisonData[]>([]);

// Nested Donut Data
const donutData = ref<NestedDonutDataItem[]>([]);

// Category Comparison Data
const categoryData = ref<CategoryComparisonData[]>([]);
const categorySummary = ref<CategorySummary>({
  currentTotal: 0,
  compareTotal: 0,
  totalYoyGrowthRate: 0
});

// Waterfall Data
const waterfallData = ref<WaterfallDataPoint[]>([]);

// AI Insight Data
const aiInsight = ref<AIInsight | null>(null);

// Provide shared period state for child components
provide('periodSelection', periodSelection);

// Period change handler
function handlePeriodChange(selection: PeriodSelection) {
  periodSelection.value = selection;
  refreshAllData();
}

// Refresh all data
async function refreshAllData() {
  await Promise.all([
    loadKPIData(),
    loadBudgetData(),
    loadYoYMoMData(),
    loadDonutData(),
    loadCategoryData(),
    loadWaterfallData(),
    loadAIInsight()
  ]);
}

// Load KPI Data
async function loadKPIData() {
  if (!factoryId.value) return;
  loading.kpi = true;
  errors.kpi = '';

  try {
    const response = await get(`/${factoryId.value}/smart-bi/analysis/finance`, {
      period: JSON.stringify(periodSelection.value)
    });

    if (response.success && response.data) {
      const data = response.data as any;
      kpiData.value = {
        revenue: { value: data.revenue || 0, trend: data.revenueTrend || 'flat', trendValue: data.revenueGrowth || 0 },
        cost: { value: data.cost || 0, trend: data.costTrend || 'flat', trendValue: data.costGrowth || 0 },
        profit: { value: data.profit || 0, trend: data.profitTrend || 'flat', trendValue: data.profitGrowth || 0 },
        margin: { value: data.margin || 0, trend: data.marginTrend || 'flat', trendValue: data.marginChange || 0 }
      };
    }
  } catch (error: any) {
    console.error('Failed to load KPI data:', error);
    errors.kpi = error?.message || '加载 KPI 数据失败';
  } finally {
    loading.kpi = false;
  }
}

// Load Budget Achievement Data
async function loadBudgetData() {
  if (!factoryId.value) return;
  loading.budget = true;
  errors.budget = '';

  try {
    const year = periodSelection.value.year || new Date().getFullYear();
    const response = await get(`/${factoryId.value}/smart-bi/analysis/finance/budget-achievement`, {
      year,
      metric: 'revenue'
    });

    if (response.success && response.data) {
      const data = response.data as {
        monthly: BudgetData[];
        yearTarget: number;
        yearActual: number;
      };
      budgetData.value = data.monthly || [];
      yearTarget.value = data.yearTarget || 0;
      yearActual.value = data.yearActual || 0;
    }
  } catch (error: any) {
    console.error('Failed to load budget data:', error);
    errors.budget = error?.message || '加载预算数据失败';
  } finally {
    loading.budget = false;
  }
}

// Load YoY/MoM Comparison Data
async function loadYoYMoMData() {
  if (!factoryId.value) return;
  loading.yoyMom = true;
  errors.yoyMom = '';

  try {
    const year = periodSelection.value.year || new Date().getFullYear();
    const response = await get(`/${factoryId.value}/smart-bi/analysis/finance/yoy-mom`, {
      periodType: 'MONTH',
      startPeriod: `${year}-01`,
      endPeriod: `${year}-12`,
      metric: 'revenue'
    });

    if (response.success && response.data) {
      yoyMomData.value = response.data as ComparisonData[];
    }
  } catch (error: any) {
    console.error('Failed to load YoY/MoM data:', error);
    errors.yoyMom = error?.message || '加载同比环比数据失败';
  } finally {
    loading.yoyMom = false;
  }
}

// Load Nested Donut Data (uses category-comparison endpoint)
async function loadDonutData() {
  if (!factoryId.value) return;
  loading.donut = true;
  errors.donut = '';

  try {
    const year = periodSelection.value.year || new Date().getFullYear();
    const response = await get(`/${factoryId.value}/smart-bi/analysis/finance/category-comparison`, {
      year,
      compareYear: year - 1
    });

    if (response.success && response.data) {
      const data = response.data as { categories: any[] };
      // Transform category data to donut format
      donutData.value = (data.categories || []).map((c: any) => ({
        category: c.category,
        currentValue: c.currentAmount || 0,
        previousValue: c.compareAmount || 0,
        currentRatio: c.currentRatio || 0,
        previousRatio: c.compareRatio || 0
      }));
    }
  } catch (error: any) {
    console.error('Failed to load donut data:', error);
    errors.donut = error?.message || '加载品类环形图数据失败';
  } finally {
    loading.donut = false;
  }
}

// Load Category Comparison Data
async function loadCategoryData() {
  if (!factoryId.value) return;
  loading.category = true;
  errors.category = '';

  try {
    const year = periodSelection.value.year || new Date().getFullYear();
    const response = await get(`/${factoryId.value}/smart-bi/analysis/finance/category-comparison`, {
      year,
      compareYear: year - 1
    });

    if (response.success && response.data) {
      const data = response.data as {
        categories: CategoryComparisonData[];
        summary: CategorySummary;
      };
      categoryData.value = data.categories || [];
      categorySummary.value = data.summary || {
        currentTotal: 0,
        compareTotal: 0,
        totalYoyGrowthRate: 0
      };
    }
  } catch (error: any) {
    console.error('Failed to load category data:', error);
    errors.category = error?.message || '加载品类对比数据失败';
  } finally {
    loading.category = false;
  }
}

// Load Waterfall Data (uses analysis/finance endpoint for now)
async function loadWaterfallData() {
  if (!factoryId.value) return;
  loading.waterfall = true;
  errors.waterfall = '';

  try {
    const year = periodSelection.value.year || new Date().getFullYear();
    const response = await get(`/${factoryId.value}/smart-bi/analysis/finance`, {
      year,
      type: 'waterfall'
    });

    if (response.success && response.data?.waterfall) {
      waterfallData.value = response.data.waterfall as WaterfallDataPoint[];
    } else {
      // Waterfall endpoint not yet implemented, show empty state
      waterfallData.value = [];
      errors.waterfall = '瀑布图数据接口待实现';
    }
  } catch (error: any) {
    console.error('Failed to load waterfall data:', error);
    errors.waterfall = error?.message || '加载瀑布图数据失败';
  } finally {
    loading.waterfall = false;
  }
}

// Load AI Insight
async function loadAIInsight() {
  if (!factoryId.value) return;
  loading.insight = true;
  errors.insight = '';

  try {
    const year = periodSelection.value.year || new Date().getFullYear();
    const response = await get(`/${factoryId.value}/smart-bi/analysis/finance`, {
      year,
      includeInsight: true
    });

    if (response.success && response.data?.insight) {
      aiInsight.value = response.data.insight as AIInsight;
    } else {
      // AI insight not available, show empty state
      aiInsight.value = null;
      errors.insight = 'AI 分析功能待实现';
    }
  } catch (error: any) {
    console.error('Failed to load AI insight:', error);
    errors.insight = error?.message || '加载 AI 分析失败';
  } finally {
    loading.insight = false;
  }
}

// Event handlers
function handleKPIClick(kpi: string) {
  console.log('KPI clicked:', kpi);
  // Can navigate to detailed analysis
}

function handleBudgetPeriodClick(data: BudgetData) {
  console.log('Budget period clicked:', data);
}

function handleYoYDataClick(data: { period: string; dataPoint: ComparisonData }) {
  console.log('YoY data clicked:', data);
}

function handleDonutCategoryClick(data: { item: NestedDonutDataItem; year: 'current' | 'previous' }) {
  console.log('Donut category clicked:', data);
}

function handleCategoryClick(data: CategoryComparisonData) {
  console.log('Category clicked:', data);
}

function handleWaterfallClick(data: { dataPoint: WaterfallDataPoint; index: number }) {
  console.log('Waterfall clicked:', data);
}

function handleInsightRefresh() {
  loadAIInsight();
}

// Global refresh handler
function handleGlobalRefresh() {
  refreshAllData();
}

// Lifecycle
onMounted(() => {
  refreshAllData();
});

// Watch period changes
watch(periodSelection, () => {
  refreshAllData();
}, { deep: true });
</script>

<template>
  <div class="advanced-finance-analysis">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-left">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/analytics' }">数据分析</el-breadcrumb-item>
          <el-breadcrumb-item :to="{ path: '/smart-bi/dashboard' }">Smart BI</el-breadcrumb-item>
          <el-breadcrumb-item>高级财务分析</el-breadcrumb-item>
        </el-breadcrumb>
        <h1>
          <el-icon><TrendCharts /></el-icon>
          高级财务分析
        </h1>
        <p class="page-subtitle">全面的财务数据分析仪表板,整合预算、同环比、品类结构等多维度分析</p>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Refresh" @click="handleGlobalRefresh">
          刷新数据
        </el-button>
      </div>
    </div>

    <!-- Period Selector -->
    <el-card class="period-card">
      <PeriodSelector
        v-model="periodSelection"
        :show-quick-select="true"
        :show-custom-tab="true"
        @change="handlePeriodChange"
      />
    </el-card>

    <!-- Row 1: KPI Cards -->
    <div class="kpi-row">
      <KPICard
        title="营业收入"
        :value="kpiData.revenue.value"
        unit="万元"
        format="currency"
        :trend="kpiData.revenue.trend"
        :trend-value="kpiData.revenue.trendValue"
        trend-label="%"
        status="info"
        icon="Money"
        :loading="loading.kpi"
        clickable
        @click="handleKPIClick('revenue')"
      />
      <KPICard
        title="总成本"
        :value="kpiData.cost.value"
        unit="万元"
        format="currency"
        :trend="kpiData.cost.trend"
        :trend-value="kpiData.cost.trendValue"
        trend-label="%"
        :status="kpiData.cost.trend === 'up' ? 'warning' : 'success'"
        icon="Wallet"
        :loading="loading.kpi"
        clickable
        @click="handleKPIClick('cost')"
      />
      <KPICard
        title="净利润"
        :value="kpiData.profit.value"
        unit="万元"
        format="currency"
        :trend="kpiData.profit.trend"
        :trend-value="kpiData.profit.trendValue"
        trend-label="%"
        :status="kpiData.profit.trend === 'up' ? 'success' : 'danger'"
        icon="TrendCharts"
        :loading="loading.kpi"
        clickable
        @click="handleKPIClick('profit')"
      />
      <KPICard
        title="利润率"
        :value="kpiData.margin.value"
        unit="%"
        format="percent"
        :precision="1"
        :trend="kpiData.margin.trend"
        :trend-value="kpiData.margin.trendValue"
        trend-label="pp"
        :status="kpiData.margin.trend === 'up' ? 'success' : 'warning'"
        icon="DataAnalysis"
        :loading="loading.kpi"
        clickable
        @click="handleKPIClick('margin')"
      />
    </div>

    <!-- Row 2: Budget Achievement Chart -->
    <el-card class="chart-card budget-card" v-loading="loading.budget">
      <BudgetAchievementChart
        title="预算达成分析"
        :data="budgetData"
        :year-target="yearTarget"
        :year-actual="yearActual"
        :height="400"
        :show-k-p-i-cards="true"
        :show-timeline="true"
        :show-status-indicators="true"
        currency="万元"
        @period-click="handleBudgetPeriodClick"
        @kpi-click="handleKPIClick"
      />
    </el-card>

    <!-- Row 3: YoY/MoM Chart (60%) + Nested Donut (40%) -->
    <div class="chart-row row-3">
      <el-card class="chart-card yoy-card" v-loading="loading.yoyMom">
        <YoYMoMComparisonChart
          title="同比环比分析"
          :data="yoyMomData"
          metric="收入"
          unit="万元"
          :height="380"
          :show-data-zoom="false"
          default-view-mode="yoy"
          :show-view-toggle="true"
          :positive-is-good="true"
          @data-click="handleYoYDataClick"
        />
      </el-card>
      <el-card class="chart-card donut-card" v-loading="loading.donut">
        <NestedDonutChart
          title="成本结构对比"
          :data="donutData"
          :current-year="new Date().getFullYear()"
          :previous-year="new Date().getFullYear() - 1"
          height="380px"
          :show-label="true"
          unit="万元"
          :show-legend="true"
          :show-center-total="true"
          @category-click="handleDonutCategoryClick"
        />
      </el-card>
    </div>

    <!-- Row 4: Category Structure Chart (60%) + Waterfall Chart (40%) -->
    <div class="chart-row row-4">
      <el-card class="chart-card category-card" v-loading="loading.category">
        <CategoryStructureComparisonChart
          title="品类结构对比"
          :data="categoryData"
          :summary="categorySummary"
          height="380px"
          unit="万元"
          :show-table="true"
          default-view-mode="bar"
          @category-click="handleCategoryClick"
        />
      </el-card>
      <el-card class="chart-card waterfall-card" v-loading="loading.waterfall">
        <WaterfallChart
          title="资金流向瀑布图"
          :data="waterfallData"
          :height="380"
          :show-data-labels="true"
          value-unit="万元"
          :show-legend="true"
          @data-click="handleWaterfallClick"
        />
      </el-card>
    </div>

    <!-- Bottom: AI Insight Panel -->
    <el-card class="insight-card">
      <AIInsightPanel
        title="AI 财务分析结论"
        :insight="aiInsight"
        :loading="loading.insight"
        :error="errors.insight"
        :collapsible="true"
        :default-expanded="true"
        @refresh="handleInsightRefresh"
      />
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.advanced-finance-analysis {
  padding: 20px;
  background: #f5f7fa;
  min-height: 100vh;
}

// Page Header
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

  .header-left {
    h1 {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 12px 0 8px;
      font-size: 22px;
      font-weight: 600;
      color: #303133;

      .el-icon {
        color: #409eff;
      }
    }

    .page-subtitle {
      margin: 0;
      font-size: 14px;
      color: #909399;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 20px;
  }
}

// Period Selector Card
.period-card {
  margin-bottom: 20px;
  border-radius: 8px;

  :deep(.el-card__body) {
    padding: 16px;
  }
}

// KPI Row
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;

  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

// Chart Cards
.chart-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

  :deep(.el-card__body) {
    padding: 16px;
  }
}

// Budget Card (Full Width)
.budget-card {
  margin-bottom: 20px;
}

// Chart Rows
.chart-row {
  display: grid;
  gap: 16px;
  margin-bottom: 20px;

  &.row-3 {
    grid-template-columns: 60% 1fr;

    @media (max-width: 1200px) {
      grid-template-columns: 1fr;
    }
  }

  &.row-4 {
    grid-template-columns: 60% 1fr;

    @media (max-width: 1200px) {
      grid-template-columns: 1fr;
    }
  }
}

// Specific Card Adjustments
.yoy-card,
.category-card {
  :deep(.el-card__body) {
    padding: 20px;
  }
}

.donut-card,
.waterfall-card {
  :deep(.el-card__body) {
    padding: 20px;
  }
}

// AI Insight Card
.insight-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

  :deep(.el-card__body) {
    padding: 0;
  }
}

// Responsive Adjustments
@media (max-width: 768px) {
  .advanced-finance-analysis {
    padding: 12px;
  }

  .page-header {
    flex-direction: column;
    gap: 16px;

    .header-right {
      padding-top: 0;
      width: 100%;

      .el-button {
        width: 100%;
      }
    }
  }

  .chart-row {
    &.row-3,
    &.row-4 {
      grid-template-columns: 1fr;
    }
  }
}

// Loading overlay styles
:deep(.el-loading-mask) {
  border-radius: 8px;
}
</style>
