<script setup lang="ts">
/**
 * FinancialDashboardPBI - 财务分析看板 (Power BI Style)
 * Orchestrates all 7 financial chart types with AI analysis and PPT export
 */
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { ElMessage } from 'element-plus';
import { DataAnalysis, VideoPlay, Download, Collection, SetUp } from '@element-plus/icons-vue';
import echarts from '@/utils/echarts';
import { processEChartsOptions } from '@/utils/echarts-fmt';

// Components
import PeriodSelector from '@/components/smartbi/PeriodSelector.vue';
import ChartSkeleton from '@/components/smartbi/ChartSkeleton.vue';
import ExpenseYoYBudgetChart from '@/components/smartbi/ExpenseYoYBudgetChart.vue';
import GrossMarginTrendChart from '@/components/smartbi/GrossMarginTrendChart.vue';
import PresentationMode from '@/components/smartbi/PresentationMode.vue';
import type { Slide } from '@/components/smartbi/PresentationMode.vue';
import VarianceAnalysisChart from '@/components/smartbi/VarianceAnalysisChart.vue';
import SankeyChart from '@/components/smartbi/SankeyChart.vue';
import SmallMultiplesChart from '@/components/smartbi/SmallMultiplesChart.vue';
import BookmarkPanel from '@/components/smartbi/BookmarkPanel.vue';
import ConditionalFormatPanel from '@/components/smartbi/ConditionalFormatPanel.vue';
import type { BookmarkState } from '@/views/smart-bi/composables/useBookmarks';
import type { SmallMultiplesConfig } from '@/components/smartbi/SmallMultiplesChart.vue';

// API
import {
  batchGenerate,
  analyzeChart,
  exportPPT,
  type ChartResult,
  type DashboardResponse,
  type FinancialDashboardRequest,
} from '@/api/smartbi/financial-dashboard';

// Types from PeriodSelector
import type { PeriodSelection } from '@/components/smartbi/PeriodSelector.vue';

// ---- State ----
const uploadId = ref<number | null>(null);
const uploadIdInput = ref<string>('');
const periodSelection = ref<PeriodSelection>({
  type: 'year',
  year: new Date().getFullYear(),
  value: String(new Date().getFullYear()),
  compareEnabled: false,
});

const isGenerating = ref(false);
const dashboardResponse = ref<DashboardResponse | null>(null);

// Per-chart AI analysis state
const analysisByType = ref<Record<string, string>>({});
const analysisLoadingByType = ref<Record<string, boolean>>({});
const analysisExpandedByType = ref<Record<string, boolean>>({});

// PPT export
const isExportingPPT = ref(false);

// Presentation mode
const isPresentationVisible = ref(false);

// Bookmarks
const showBookmarkPanel = ref(false);

// Small Multiples
const smallMultiplesVisible = ref(false);
const smallMultiplesDimension = ref('category');

// Conditional Formatting (panel is self-contained via service singleton)

// Chart instance refs for getDataURL
const chartRefExpenseYoY = ref<InstanceType<typeof ExpenseYoYBudgetChart> | null>(null);
const chartRefGrossMargin = ref<InstanceType<typeof GrossMarginTrendChart> | null>(null);
const chartRefVariance = ref<InstanceType<typeof VarianceAnalysisChart> | null>(null);
const chartRefSankey = ref<InstanceType<typeof SankeyChart> | null>(null);
// Generic chart DOM refs for existing chart components
const chartDomRefs = ref<Map<string, HTMLElement>>(new Map());

// ---- Computed ----
const currentYear = computed(() => periodSelection.value.year);
const periodType = computed(() => periodSelection.value.type === 'year' ? 'year' : 'month_range');
const startMonth = computed(() => {
  if (periodSelection.value.type === 'year') return 1;
  if (Array.isArray(periodSelection.value.value)) {
    return parseInt(String(periodSelection.value.value[0]).split('-')[1] || '1', 10);
  }
  return 1;
});
const endMonth = computed(() => {
  if (periodSelection.value.type === 'year') return 12;
  if (Array.isArray(periodSelection.value.value)) {
    return parseInt(String(periodSelection.value.value[1]).split('-')[1] || '12', 10);
  }
  return 12;
});

const charts = computed(() => dashboardResponse.value?.charts ?? []);

function getChart(chartType: string): ChartResult | null {
  return charts.value.find(c => c.chartType === chartType) ?? null;
}

const chartTypes = [
  { key: 'kpi_scorecard', label: '关键指标记分卡', icon: '🏆' },
  { key: 'budget_achievement', label: '预算达成分析', icon: '📊' },
  { key: 'yoy_mom_comparison', label: '同环比分析', icon: '📈' },
  { key: 'pnl_waterfall', label: '损益表瀑布图', icon: '🌊' },
  { key: 'expense_yoy_budget', label: '费用同比及预算达成', icon: '💰' },
  { key: 'category_yoy_comparison', label: '品类同期对比', icon: '📊' },
  { key: 'gross_margin_trend', label: '毛利率同比趋势', icon: '📉' },
  { key: 'category_structure_donut', label: '品类结构同比饼图', icon: '🎯' },
  { key: 'cost_flow_sankey', label: '成本流向桑基图', icon: '🔀' },
  { key: 'variance_analysis', label: '预算差异分析', icon: '📐' },
  { key: 'cash_flow_waterfall', label: '现金流量瀑布图', icon: '💵' },
];

const presentationSlides = computed<Slide[]>(() => {
  const slides: Slide[] = [{ type: 'cover' }];
  for (const ct of chartTypes) {
    if (getChart(ct.key)) {
      slides.push({ type: 'chart', chartType: ct.key, title: ct.label });
    }
  }
  slides.push({ type: 'conclusion' });
  return slides;
});

// Built-in demo data — comprehensive financial data covering all chart builder requirements:
// - 月份+品类+预算+实际+上年 → budget_achievement, yoy_mom, expense_yoy_budget, category_yoy, category_structure
// - 项目(P&L items) → pnl_waterfall, cost_flow_sankey
// - 毛利率 → gross_margin_trend
const DEMO_RAW_DATA: Record<string, unknown>[] = [
  // ---- 品类月度收入 (6个月 × 3品类 = 18行) ----
  // 统一 schema: 月份, 品类, 项目, 预算, 实际, 上年
  {'月份':'1月','品类':'酱料','项目':'营业收入','预算':2800,'实际':3100,'上年':1800},
  {'月份':'2月','品类':'酱料','项目':'营业收入','预算':2900,'实际':2700,'上年':1900},
  {'月份':'3月','品类':'酱料','项目':'营业收入','预算':3000,'实际':3200,'上年':2000},
  {'月份':'4月','品类':'酱料','项目':'营业收入','预算':3100,'实际':2950,'上年':2100},
  {'月份':'5月','品类':'酱料','项目':'营业收入','预算':3200,'实际':3400,'上年':2200},
  {'月份':'6月','品类':'酱料','项目':'营业收入','预算':3300,'实际':3100,'上年':2300},
  {'月份':'1月','品类':'汤料','项目':'营业收入','预算':2000,'实际':2200,'上年':1500},
  {'月份':'2月','品类':'汤料','项目':'营业收入','预算':2100,'实际':1900,'上年':1600},
  {'月份':'3月','品类':'汤料','项目':'营业收入','预算':2200,'实际':2400,'上年':1700},
  {'月份':'4月','品类':'汤料','项目':'营业收入','预算':2300,'实际':2150,'上年':1800},
  {'月份':'5月','品类':'汤料','项目':'营业收入','预算':2400,'实际':2500,'上年':1900},
  {'月份':'6月','品类':'汤料','项目':'营业收入','预算':2500,'实际':2350,'上年':2000},
  {'月份':'1月','品类':'底料','项目':'营业收入','预算':1500,'实际':1600,'上年':1200},
  {'月份':'2月','品类':'底料','项目':'营业收入','预算':1600,'实际':1400,'上年':1300},
  {'月份':'3月','品类':'底料','项目':'营业收入','预算':1700,'实际':1800,'上年':1400},
  {'月份':'4月','品类':'底料','项目':'营业收入','预算':1800,'实际':1750,'上年':1500},
  {'月份':'5月','品类':'底料','项目':'营业收入','预算':1900,'实际':2000,'上年':1600},
  {'月份':'6月','品类':'底料','项目':'营业收入','预算':2000,'实际':1850,'上年':1700},
  // ---- P&L 费用项目 (月度化，6个月 × 4类费用 = 24行) ----
  {'月份':'1月','项目':'营业成本','预算':2625,'实际':2473,'上年':2065},
  {'月份':'2月','项目':'营业成本','预算':2625,'实际':2520,'上年':2065},
  {'月份':'3月','项目':'营业成本','预算':2625,'实际':2590,'上年':2065},
  {'月份':'4月','项目':'营业成本','预算':2625,'实际':2650,'上年':2065},
  {'月份':'5月','项目':'营业成本','预算':2625,'实际':2780,'上年':2065},
  {'月份':'6月','项目':'营业成本','预算':2625,'实际':2490,'上年':2065},
  {'月份':'1月','项目':'销售费用','预算':600,'实际':565,'上年':472},
  {'月份':'2月','项目':'销售费用','预算':600,'实际':580,'上年':472},
  {'月份':'3月','项目':'销售费用','预算':600,'实际':610,'上年':472},
  {'月份':'4月','项目':'销售费用','预算':600,'实际':550,'上年':472},
  {'月份':'5月','项目':'销售费用','预算':600,'实际':620,'上年':472},
  {'月份':'6月','项目':'销售费用','预算':600,'实际':590,'上年':472},
  {'月份':'1月','项目':'管理费用','预算':450,'实际':424,'上年':354},
  {'月份':'2月','项目':'管理费用','预算':450,'实际':410,'上年':354},
  {'月份':'3月','项目':'管理费用','预算':450,'实际':445,'上年':354},
  {'月份':'4月','项目':'管理费用','预算':450,'实际':430,'上年':354},
  {'月份':'5月','项目':'管理费用','预算':450,'实际':460,'上年':354},
  {'月份':'6月','项目':'管理费用','预算':450,'实际':415,'上年':354},
  {'月份':'1月','项目':'研发费用','预算':300,'实际':283,'上年':236},
  {'月份':'2月','项目':'研发费用','预算':300,'实际':275,'上年':236},
  {'月份':'3月','项目':'研发费用','预算':300,'实际':310,'上年':236},
  {'月份':'4月','项目':'研发费用','预算':300,'实际':290,'上年':236},
  {'月份':'5月','项目':'研发费用','预算':300,'实际':305,'上年':236},
  {'月份':'6月','项目':'研发费用','预算':300,'实际':280,'上年':236},
];

// ---- Methods ----
async function generate(useDemo = false) {
  const id = uploadId.value ?? (uploadIdInput.value ? parseInt(uploadIdInput.value, 10) : null);
  if (!useDemo && !id) {
    ElMessage.warning('请先输入数据源ID或选择已上传的数据');
    return;
  }

  if (id && isNaN(id)) {
    ElMessage.warning('数据源ID格式不正确');
    return;
  }

  isGenerating.value = true;
  analysisByType.value = {};
  analysisExpandedByType.value = {};

  const payload: FinancialDashboardRequest = {
    year: currentYear.value,
    period_type: periodType.value,
    start_month: startMonth.value,
    end_month: endMonth.value,
  };
  if (useDemo) {
    payload.raw_data = DEMO_RAW_DATA;
  } else if (id) {
    payload.upload_id = id;
  }

  try {
    const resp = await batchGenerate(payload);
    if (resp.success) {
      dashboardResponse.value = resp;
      ElMessage.success(`成功生成 ${resp.successCount} 个图表`);
    } else {
      ElMessage.error('图表生成失败，请检查数据源');
    }
  } catch (err) {
    console.error('generate failed:', err);
    ElMessage.error('请求失败，请稍后重试');
  } finally {
    isGenerating.value = false;
  }
}

async function requestAnalysis(chartType: string) {
  const chart = getChart(chartType);
  if (!chart) return;

  // Toggle if already loaded
  if (analysisByType.value[chartType]) {
    analysisExpandedByType.value[chartType] = !analysisExpandedByType.value[chartType];
    return;
  }

  // Prevent duplicate requests while loading
  if (analysisLoadingByType.value[chartType]) return;

  analysisLoadingByType.value[chartType] = true;
  analysisExpandedByType.value[chartType] = true;

  try {
    const resp = await analyzeChart({
      chart_type: chartType,
      analysis_context: chart.analysisContext || '',
    });
    if (resp.success) {
      analysisByType.value[chartType] = resp.analysis || '暂无分析结果';
    } else {
      analysisByType.value[chartType] = resp.error || 'AI分析暂时不可用';
    }
  } catch (err) {
    console.error('analyzeChart failed:', err);
    analysisByType.value[chartType] = '分析请求失败，请重试';
  } finally {
    analysisLoadingByType.value[chartType] = false;
  }
}

function setChartDomRef(chartType: string, el: Element | null) {
  if (el instanceof HTMLElement) {
    chartDomRefs.value.set(chartType, el);
  } else {
    chartDomRefs.value.delete(chartType);
  }
}

function collectChartImages(): Record<string, string> {
  const images: Record<string, string> = {};

  // Collect from ExpenseYoYBudgetChart
  if (chartRefExpenseYoY.value?.chartInstance) {
    try {
      images['expense_yoy_budget'] = chartRefExpenseYoY.value.chartInstance.getDataURL({
        type: 'png', pixelRatio: 2, backgroundColor: '#fff',
      });
    } catch (e) { console.warn('Failed to get ExpenseYoY image:', e); }
  }

  // Collect from GrossMarginTrendChart
  if (chartRefGrossMargin.value?.chartInstance) {
    try {
      images['gross_margin_trend'] = chartRefGrossMargin.value.chartInstance.getDataURL({
        type: 'png', pixelRatio: 2, backgroundColor: '#fff',
      });
    } catch (e) { console.warn('Failed to get GrossMargin image:', e); }
  }

  // Collect from VarianceAnalysisChart
  if (chartRefVariance.value?.chartInstance) {
    try {
      images['variance_analysis'] = chartRefVariance.value.chartInstance.getDataURL({
        type: 'png', pixelRatio: 2, backgroundColor: '#fff',
      });
    } catch (e) { console.warn('Failed to get VarianceAnalysis image:', e); }
  }

  // Collect from SankeyChart
  if (chartRefSankey.value?.chartInstance) {
    try {
      images['cost_flow_sankey'] = chartRefSankey.value.chartInstance.getDataURL({
        type: 'png', pixelRatio: 2, backgroundColor: '#fff',
      });
    } catch (e) { console.warn('Failed to get Sankey image:', e); }
  }

  // Collect from generic DOM refs
  for (const [chartType, domEl] of chartDomRefs.value.entries()) {
    const instance = echarts.getInstanceByDom(domEl);
    if (instance) {
      try {
        images[chartType] = instance.getDataURL({
          type: 'png', pixelRatio: 2, backgroundColor: '#fff',
        });
      } catch (e) { console.warn(`Failed to get image for ${chartType}:`, e); }
    }
  }

  return images;
}

async function handleExportPPT() {
  if (!dashboardResponse.value) {
    ElMessage.warning('请先生成图表后再导出PPT');
    return;
  }

  isExportingPPT.value = true;
  try {
    await nextTick();
    const chartImages = collectChartImages();
    const analysisResults: Record<string, string> = { ...analysisByType.value };

    const blob = await exportPPT({
      upload_id: uploadId.value ?? undefined,
      year: currentYear.value,
      period_type: periodType.value,
      start_month: startMonth.value,
      end_month: endMonth.value,
      chart_images: chartImages,
      analysis_results: analysisResults,
      company_name: '白垩纪食品',
    });

    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `财务分析看板_${currentYear.value}.pptx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      ElMessage.success('PPT导出成功');
    } else {
      ElMessage.error('PPT导出失败，请检查服务状态');
    }
  } catch (err) {
    console.error('exportPPT failed:', err);
    ElMessage.error('PPT导出失败');
  } finally {
    isExportingPPT.value = false;
  }
}

// Get echartsOption from API response for direct pass-through rendering
function getChartEchartsOption(chart: ChartResult | null): Record<string, unknown> | null {
  if (!chart?.echartsOption || Object.keys(chart.echartsOption).length === 0) return null;
  return chart.echartsOption;
}

// Render a generic chart with echartsOption from API
function renderGenericChart(chartType: string, domEl: Element | null, retries = 0) {
  if (!domEl || !(domEl instanceof HTMLElement)) return;
  const chart = getChart(chartType);
  if (!chart?.echartsOption) return;

  // Skip if container has zero dimensions (not yet visible), retry up to 3 times
  if (domEl.clientWidth === 0 || domEl.clientHeight === 0) {
    if (retries < 3) {
      requestAnimationFrame(() => renderGenericChart(chartType, domEl, retries + 1));
    }
    return;
  }

  let instance = echarts.getInstanceByDom(domEl);
  if (!instance) {
    instance = echarts.init(domEl);
  }
  const processed = processEChartsOptions(JSON.parse(JSON.stringify(chart.echartsOption)) as Record<string, unknown>);
  instance.setOption(processed, { notMerge: true });
}

watch(() => charts.value.length, async () => {
  await nextTick();
  // Double rAF: first rAF schedules after v-if DOM insertion, second after layout
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (const [chartType, domEl] of chartDomRefs.value.entries()) {
        renderGenericChart(chartType, domEl);
      }
    });
  });
});

// Cleanup ECharts instances on unmount to prevent memory leaks
onBeforeUnmount(() => {
  for (const [, domEl] of chartDomRefs.value.entries()) {
    const instance = echarts.getInstanceByDom(domEl);
    instance?.dispose();
  }
  chartDomRefs.value.clear();
});

const periodLabel = computed(() => dashboardResponse.value?.period?.label || '');

// Bookmark current dashboard state
const currentDashboardState = computed<BookmarkState>(() => ({
  uploadId: uploadId.value ?? undefined,
  periodType: periodType.value,
  year: currentYear.value,
  startMonth: startMonth.value,
  endMonth: endMonth.value,
  chartTypes: charts.value.map((c) => c.chartType),
  filters: {},
}));

// Small multiples config
const smallMultiplesConfig = computed<SmallMultiplesConfig>(() => ({
  splitBy: smallMultiplesDimension.value,
  chartType: 'bar',
  sharedAxes: true,
  maxCells: 12,
}));

// Chart data reshaped for SmallMultiplesChart (flatten all chart KPIs into flat records)
const chartDataForSmallMultiples = computed<Record<string, unknown>[]>(() => {
  const rows: Record<string, unknown>[] = [];
  for (const chart of charts.value) {
    if (chart.kpis?.length) {
      for (const kpi of chart.kpis) {
        rows.push({
          category: chart.chartType,
          month: kpi.label,
          actual: typeof kpi.value === 'number' ? kpi.value : 0,
        });
      }
    }
  }
  return rows;
});

// Bookmark apply handler
function applyBookmark(state: BookmarkState) {
  if (state.uploadId) {
    uploadId.value = state.uploadId;
    uploadIdInput.value = String(state.uploadId);
  }
  showBookmarkPanel.value = false;
  generate();
}

// Conditional formatting change handler
function onFormattingRulesChange(_rules: unknown[]) {
  // Rules are managed by the ConditionalFormattingService singleton; no extra action needed
}
</script>

<template>
  <div class="financial-dashboard-pbi">
    <!-- Top Toolbar -->
    <el-card class="toolbar-card" shadow="never">
      <div class="toolbar-inner">
        <div class="toolbar-left">
          <el-input
            v-model="uploadIdInput"
            placeholder="数据源ID (可选)"
            style="width: 140px"
            size="small"
            clearable
            @change="(v: string) => { uploadId = v ? parseInt(v, 10) : null }"
          />
          <PeriodSelector
            v-model="periodSelection"
            :show-quick-select="true"
            :show-custom-tab="false"
            default-type="year"
            size="small"
            style="margin-left: 8px"
          />
          <el-button
            type="primary"
            size="small"
            :loading="isGenerating"
            style="margin-left: 8px"
            @click="generate"
          >
            <el-icon v-if="!isGenerating"><DataAnalysis /></el-icon>
            {{ isGenerating ? '生成中...' : '生成看板' }}
          </el-button>
          <el-button
            size="small"
            :loading="isGenerating"
            style="margin-left: 4px"
            @click="generate(true)"
          >
            演示数据
          </el-button>
        </div>
        <div class="toolbar-right">
          <el-tag v-if="periodLabel" type="info" size="small" style="margin-right: 8px">
            {{ periodLabel }}
          </el-tag>
          <el-switch
            v-model="smallMultiplesVisible"
            size="small"
            active-text="维度拆分"
            style="margin-right: 4px"
          />
          <el-popover trigger="click" width="520" placement="bottom-end">
            <template #reference>
              <el-button size="small" :disabled="!dashboardResponse">
                <el-icon><SetUp /></el-icon>
                条件格式
              </el-button>
            </template>
            <ConditionalFormatPanel
              table-id="financial-dashboard"
              :available-fields="['value', 'budget', 'actual', 'variance']"
              @change="onFormattingRulesChange"
            />
          </el-popover>
          <el-button
            size="small"
            :disabled="!dashboardResponse"
            @click="showBookmarkPanel = true"
          >
            <el-icon><Collection /></el-icon>
            书签
          </el-button>
          <el-button
            size="small"
            :disabled="!dashboardResponse"
            @click="isPresentationVisible = true"
          >
            <el-icon><VideoPlay /></el-icon>
            演示模式
          </el-button>
          <el-button
            size="small"
            :loading="isExportingPPT"
            :disabled="!dashboardResponse"
            @click="handleExportPPT"
          >
            <el-icon><Download /></el-icon>
            导出PPT
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- Empty state -->
    <div v-if="!dashboardResponse && !isGenerating" class="empty-state">
      <el-empty description="请选择数据源和时间范围，点击「生成看板」开始分析" />
    </div>

    <!-- Loading skeleton -->
    <div v-if="isGenerating" class="charts-grid">
      <el-card v-for="ct in chartTypes" :key="ct.key" class="chart-card" shadow="hover">
        <template #header>
          <div class="chart-card-header">
            <span>{{ ct.icon }} {{ ct.label }}</span>
          </div>
        </template>
        <ChartSkeleton type="kpi" />
        <ChartSkeleton type="chart" />
      </el-card>
    </div>

    <!-- Charts Grid -->
    <div v-if="dashboardResponse && !isGenerating" class="charts-grid">

      <!-- Chart 4: Expense YoY Budget (custom component) -->
      <el-card
        v-if="getChart('expense_yoy_budget')"
        class="chart-card chart-card--wide"
        shadow="hover"
      >
        <template #header>
          <div class="chart-card-header">
            <span>💰 费用同比及预算达成分析</span>
            <el-button
              size="small"
              text
              type="primary"
              :loading="analysisLoadingByType['expense_yoy_budget']"
              @click="requestAnalysis('expense_yoy_budget')"
            >
              {{ analysisExpandedByType['expense_yoy_budget'] && analysisByType['expense_yoy_budget'] ? '收起分析' : 'AI分析' }}
            </el-button>
          </div>
        </template>
        <template v-if="getChartEchartsOption(getChart('expense_yoy_budget'))">
          <!-- KPI row from API -->
          <div v-if="getChart('expense_yoy_budget')!.kpis?.length" class="generic-kpi-row">
            <div
              v-for="kpi in getChart('expense_yoy_budget')!.kpis.slice(0, 4)"
              :key="kpi.label"
              class="generic-kpi-chip"
              :class="{ 'kpi-up': kpi.trend === 'up', 'kpi-down': kpi.trend === 'down' }"
            >
              <span class="kpi-val">{{ typeof kpi.value === 'number' ? kpi.value.toFixed(1) : kpi.value }}{{ kpi.unit }}</span>
              <span class="kpi-lbl">{{ kpi.label }}</span>
            </div>
          </div>
          <!-- ECharts canvas rendered via DOM ref -->
          <div
            :ref="(el) => setChartDomRef('expense_yoy_budget', el as Element | null)"
            style="height: 360px; width: 100%"
          />
        </template>
        <ExpenseYoYBudgetChart
          v-else
          ref="chartRefExpenseYoY"
          :data="[]"
          :loading="false"
          :height="360"
        />
        <div v-if="analysisExpandedByType['expense_yoy_budget']" class="analysis-panel">
          <ChartSkeleton v-if="analysisLoadingByType['expense_yoy_budget']" type="ai" />
          <div v-else-if="analysisByType['expense_yoy_budget']" class="analysis-text">
            {{ analysisByType['expense_yoy_budget'] }}
          </div>
        </div>
      </el-card>

      <!-- Chart 6: Gross Margin Trend (custom component) -->
      <el-card
        v-if="getChart('gross_margin_trend')"
        class="chart-card chart-card--wide"
        shadow="hover"
      >
        <template #header>
          <div class="chart-card-header">
            <span>📉 毛利率同比趋势分析</span>
            <el-button
              size="small"
              text
              type="primary"
              :loading="analysisLoadingByType['gross_margin_trend']"
              @click="requestAnalysis('gross_margin_trend')"
            >
              {{ analysisExpandedByType['gross_margin_trend'] && analysisByType['gross_margin_trend'] ? '收起分析' : 'AI分析' }}
            </el-button>
          </div>
        </template>
        <template v-if="getChartEchartsOption(getChart('gross_margin_trend'))">
          <!-- KPI row from API -->
          <div v-if="getChart('gross_margin_trend')!.kpis?.length" class="generic-kpi-row">
            <div
              v-for="kpi in getChart('gross_margin_trend')!.kpis.slice(0, 4)"
              :key="kpi.label"
              class="generic-kpi-chip"
              :class="{ 'kpi-up': kpi.trend === 'up', 'kpi-down': kpi.trend === 'down' }"
            >
              <span class="kpi-val">{{ typeof kpi.value === 'number' ? kpi.value.toFixed(1) : kpi.value }}{{ kpi.unit }}</span>
              <span class="kpi-lbl">{{ kpi.label }}</span>
            </div>
          </div>
          <!-- ECharts canvas rendered via DOM ref -->
          <div
            :ref="(el) => setChartDomRef('gross_margin_trend', el as Element | null)"
            style="height: 320px; width: 100%"
          />
        </template>
        <GrossMarginTrendChart
          v-else
          ref="chartRefGrossMargin"
          :data="[]"
          :loading="false"
          :height="320"
        />
        <div v-if="analysisExpandedByType['gross_margin_trend']" class="analysis-panel">
          <ChartSkeleton v-if="analysisLoadingByType['gross_margin_trend']" type="ai" />
          <div v-else-if="analysisByType['gross_margin_trend']" class="analysis-text">
            {{ analysisByType['gross_margin_trend'] }}
          </div>
        </div>
      </el-card>

      <!-- Chart: Variance Analysis -->
      <el-card
        v-if="getChart('variance_analysis')"
        class="chart-card chart-card--wide"
        shadow="hover"
      >
        <template #header>
          <div class="chart-card-header">
            <span>📐 预算差异分析</span>
            <el-button
              size="small"
              text
              type="primary"
              :loading="analysisLoadingByType['variance_analysis']"
              @click="requestAnalysis('variance_analysis')"
            >
              {{ analysisExpandedByType['variance_analysis'] && analysisByType['variance_analysis'] ? '收起分析' : 'AI分析' }}
            </el-button>
          </div>
        </template>
        <VarianceAnalysisChart
          ref="chartRefVariance"
          :data="[]"
          :echarts-option="getChart('variance_analysis')!.echartsOption ?? {}"
          height="480px"
        />
        <div v-if="analysisExpandedByType['variance_analysis']" class="analysis-panel">
          <ChartSkeleton v-if="analysisLoadingByType['variance_analysis']" type="ai" />
          <div v-else-if="analysisByType['variance_analysis']" class="analysis-text">
            {{ analysisByType['variance_analysis'] }}
          </div>
        </div>
      </el-card>

      <!-- Chart: Cost Flow Sankey -->
      <el-card
        v-if="getChart('cost_flow_sankey')"
        class="chart-card chart-card--wide"
        shadow="hover"
      >
        <template #header>
          <div class="chart-card-header">
            <span>🌊 成本流向图</span>
            <el-button
              size="small"
              text
              type="primary"
              :loading="analysisLoadingByType['cost_flow_sankey']"
              @click="requestAnalysis('cost_flow_sankey')"
            >
              {{ analysisExpandedByType['cost_flow_sankey'] && analysisByType['cost_flow_sankey'] ? '收起分析' : 'AI分析' }}
            </el-button>
          </div>
        </template>
        <SankeyChart
          ref="chartRefSankey"
          :nodes="[]"
          :links="[]"
          :echarts-option="getChart('cost_flow_sankey')!.echartsOption ?? {}"
          height="460px"
        />
        <div v-if="analysisExpandedByType['cost_flow_sankey']" class="analysis-panel">
          <ChartSkeleton v-if="analysisLoadingByType['cost_flow_sankey']" type="ai" />
          <div v-else-if="analysisByType['cost_flow_sankey']" class="analysis-text">
            {{ analysisByType['cost_flow_sankey'] }}
          </div>
        </div>
      </el-card>

      <!-- Generic Charts (1,2,3,5,7) rendered via echartsOption from API -->
      <template v-for="ct in chartTypes.filter(c => !['expense_yoy_budget', 'gross_margin_trend'].includes(c.key))" :key="ct.key">
      <el-card
        v-if="getChart(ct.key)"
        class="chart-card"
        shadow="hover"
      >
        <template #header>
          <div class="chart-card-header">
            <span>{{ ct.icon }} {{ ct.label }}</span>
            <el-button
              size="small"
              text
              type="primary"
              :loading="analysisLoadingByType[ct.key]"
              :disabled="!getChart(ct.key)"
              @click="requestAnalysis(ct.key)"
            >
              {{ analysisExpandedByType[ct.key] && analysisByType[ct.key] ? '收起分析' : 'AI分析' }}
            </el-button>
          </div>
        </template>

        <!-- KPI row from API response -->
        <div v-if="getChart(ct.key)!.kpis?.length" class="generic-kpi-row">
          <div
            v-for="kpi in getChart(ct.key)!.kpis.slice(0, 4)"
            :key="kpi.label"
            class="generic-kpi-chip"
            :class="{
              'kpi-up': kpi.trend === 'up',
              'kpi-down': kpi.trend === 'down',
            }"
          >
            <span class="kpi-val">{{ typeof kpi.value === 'number' ? kpi.value.toFixed(1) : kpi.value }}{{ kpi.unit }}</span>
            <span class="kpi-lbl">{{ kpi.label }}</span>
          </div>
        </div>

        <!-- ECharts canvas rendered via DOM ref -->
        <div
          :ref="(el) => setChartDomRef(ct.key, el as Element | null)"
          class="generic-chart-canvas"
          style="height: 340px; width: 100%"
        />

        <!-- AI Analysis panel -->
        <div v-if="analysisExpandedByType[ct.key]" class="analysis-panel">
          <ChartSkeleton v-if="analysisLoadingByType[ct.key]" type="ai" />
          <div v-else-if="analysisByType[ct.key]" class="analysis-text">
            {{ analysisByType[ct.key] }}
          </div>
        </div>
      </el-card>
      </template>

    </div>

    <!-- Small Multiples Section -->
    <el-card
      v-if="smallMultiplesVisible && dashboardResponse && !isGenerating"
      class="dashboard-card"
      shadow="hover"
      style="margin-top: 16px"
    >
      <template #header>
        <div class="chart-card-header">
          <span>🔲 维度对比 (Small Multiples)</span>
          <el-select
            v-model="smallMultiplesDimension"
            size="small"
            placeholder="选择拆分维度"
            style="width: 130px"
          >
            <el-option label="品类" value="category" />
            <el-option label="月份" value="month" />
            <el-option label="部门" value="department" />
          </el-select>
        </div>
      </template>
      <SmallMultiplesChart
        :data="chartDataForSmallMultiples"
        :config="smallMultiplesConfig"
        x-field="month"
        y-field="actual"
        height="500px"
      />
    </el-card>

    <!-- Bookmark Drawer -->
    <el-drawer
      v-model="showBookmarkPanel"
      title="视图书签"
      direction="rtl"
      size="350px"
    >
      <BookmarkPanel
        dashboard-id="financial-dashboard"
        :current-state="currentDashboardState"
        @apply="applyBookmark"
        @close="showBookmarkPanel = false"
      />
    </el-drawer>

    <!-- Presentation Mode -->
    <PresentationMode
      :visible="isPresentationVisible"
      :slides="presentationSlides"
      :chart-results="charts"
      company-name="白垩纪食品"
      :period="periodLabel"
      @close="isPresentationVisible = false"
    />
  </div>
</template>

<style scoped>
.financial-dashboard-pbi {
  padding: 16px;
  min-height: 100vh;
  background: #f5f7fa;
}

/* Toolbar */
.toolbar-card {
  margin-bottom: 16px;
}

:deep(.toolbar-card .el-card__body) {
  padding: 12px 16px;
}

.toolbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Empty state */
.empty-state {
  display: flex;
  justify-content: center;
  padding: 80px 0;
}

/* Charts grid */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.chart-card--wide {
  grid-column: 1 / -1;
}

@media (max-width: 1200px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
  .chart-card--wide {
    grid-column: 1;
  }
}

/* Chart card */
.chart-card {
  overflow: hidden;
}

.chart-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

/* Generic KPI row */
.generic-kpi-row {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.generic-kpi-chip {
  flex: 1;
  min-width: 100px;
  background: rgba(27, 101, 168, 0.06);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.generic-kpi-chip.kpi-up {
  background: rgba(54, 179, 126, 0.08);
}

.generic-kpi-chip.kpi-down {
  background: rgba(255, 86, 48, 0.08);
}

.kpi-val {
  font-size: 18px;
  font-weight: 700;
  color: #1B65A8;
}

.kpi-lbl {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
}

/* Analysis panel */
.analysis-panel {
  margin-top: 12px;
  border-top: 1px solid #f0f0f0;
  padding-top: 12px;
}

.analysis-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.7;
  white-space: pre-wrap;
  background: rgba(27, 101, 168, 0.04);
  border-radius: 6px;
  padding: 12px;
}
</style>
