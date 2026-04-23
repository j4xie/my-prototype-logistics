<template>
  <el-card class="tpl-card" shadow="hover">
    <template #header>
      <div class="tpl-header">
        <span class="tpl-title">{{ title }}</span>
        <span v-if="uploadLabel" class="tpl-badge">
          数据截至: {{ formattedDate }}
        </span>
      </div>
    </template>

    <!-- Loading -->
    <div v-if="status === 'loading'" class="tpl-loading">
      <el-skeleton :rows="4" animated />
    </div>

    <!-- Loaded: real chart + KPI + insight -->
    <template v-else-if="status === 'loaded' && item">
      <div v-if="kpis.length > 0" class="tpl-kpis">
        <div v-for="kpi in kpis" :key="kpi.label" class="tpl-kpi" :title="kpi.value">
          <div class="tpl-kpi-label">{{ kpi.label }}</div>
          <div
            class="tpl-kpi-value"
            :class="{ 'tpl-kpi-value--long': kpi.isLongText }"
          >{{ kpi.value }}</div>
        </div>
      </div>
      <div ref="chartRef" class="tpl-chart" v-if="chartOption"></div>
      <div v-if="insightText" class="tpl-insight">
        {{ insightText }}
      </div>
    </template>

    <!-- Empty: code was in some upload but not this one -->
    <div v-else-if="status === 'missing'" class="tpl-empty">
      <div class="tpl-empty-icon">📭</div>
      <div class="tpl-empty-title">该数据集不包含 [{{ title }}] 所需字段</div>
      <div class="tpl-empty-hint">上传含 {{ requiredFields }} 的文件后将自动生成</div>
    </div>

    <!-- Empty: code never materialized for this factory -->
    <div v-else-if="status === 'never'" class="tpl-empty">
      <div class="tpl-empty-icon">📄</div>
      <div class="tpl-empty-title">尚未为该工厂生成过 [{{ title }}]</div>
      <div class="tpl-empty-hint">上传含 {{ requiredFields }} 的数据文件</div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
import type { ECharts } from 'echarts';
import type { AnalysisResultItem } from '@/api/smartbi/analysisResults';
import {
  getTemplateTitle,
  getRequiredFields,
} from '../composables/useTemplateMap';

type CardStatus = 'loading' | 'loaded' | 'missing' | 'never';

const props = defineProps<{
  code: string;
  item?: AnalysisResultItem;
  status: CardStatus;
}>();

const chartRef = ref<HTMLElement>();
let chartInstance: ECharts | null = null;

const title = computed(() => getTemplateTitle(props.code));
const requiredFields = computed(() => getRequiredFields(props.code));

const uploadLabel = computed(() => props.item?.uploadLabel);
const formattedDate = computed(() => {
  const d = props.item?.uploadCreatedAt;
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('zh-CN');
  } catch {
    return d.slice(0, 10);
  }
});

// English KPI key → 中文. Templates emit mixed camelCase keys; map the
// common ones here so users see localized labels. Unknown keys fall
// through to the raw key (better than blocking render).
const KPI_LABEL_MAP: Record<string, string> = {
  // generic totals
  total: '合计',
  totalRevenue: '营业额',
  totalTracked: '统计总数',
  totalOrders: '订单总数',
  totalItemCount: '明细总数',
  grandTotal: '总计',
  grandRevenue: '营业额',
  grandOrders: '订单总数',
  grandAmount: '合计金额',
  revenue: '营业额',
  orders: '订单数',
  orderCount: '订单数',
  billCount: '单数',
  avgBillValue: '客单价',
  avgOrder: '平均客单',
  storeCount: '门店数',
  dayCount: '天数',
  periodCount: '期数',
  monthCount: '月份数',
  latestMonth: '最近月份',
  latestRevenue: '最近月营业额',
  // peaks / extremes
  peakValue: '峰值',
  peakPeriod: '峰值日期',
  peakMonth: '峰值月份',
  peakArea: '峰值区域',
  peakSlot: '峰值时段',
  peakRevenue: '峰值营业额',
  worstMonth: '谷底月份',
  troughMonth: '低谷月份',
  // stats
  max: '最大值',
  min: '最小值',
  mean: '均值',
  std: '标准差',
  median: '中位数',
  avg: '平均值',
  // deltas / ratios
  deltaPct: '波动率(%)',
  dodDeltaPct: '环比(%)',
  yoyDeltaPct: '同比(%)',
  sharePct: '占比(%)',
  netSharePct: '到账率(%)',
  anomalyCount: '异常月数',
  weekdayAvgOrder: '工作日均客单',
  weekendAvgOrder: '周末均客单',
  weekendOrderShare: '周末订单占比(%)',
  // dimensions (generic top_n / category_distribution / anomaly)
  dimCount: '维度数',
  topLabel: 'Top 项',
  topValue: 'Top 值',
  topSharePct: 'Top 占比(%)',
  topCategory: 'Top 分类',
  categoryCount: '分类数',
  topCategoryShare: 'Top 分类占比(%)',
  // finance
  netRevenue: '实收',
  grossRevenue: '应收',
  hasCostData: '是否含成本',
  topSlot: '主要时段',
  topChannel: '主要渠道',
  topPlatform: '最大平台',
  topPlatformAmount: '最大平台金额',
  platformCount: '平台数',
  // stored value card
  cardTotal: '储值卡消费',
  cardOrders: '储值卡笔数',
  // dish / product
  topDishName: '热销菜品',
  topDishQty: '热销销量',
  topDishRevenue: '热销营收',
  distinctDishes: '菜品总数',
  bottomDish: '最滞销菜品',
  bottomQty: '最滞销销量',
  nearZeroCount: '近零销量数',
  // combo
  comboOrders: '套餐订单数',
  topComboName: '热销套餐',
  usageRatePct: '使用率(%)',
  // product
  topProduct: '热销商品',
  topProductRevenue: '热销商品营收',
};

function localizeKpiKey(key: string): string {
  return KPI_LABEL_MAP[key] || key;
}

function formatKpiValue(value: unknown): { text: string; isLong: boolean } {
  if (value === null || value === undefined) return { text: '—', isLong: false };
  if (typeof value === 'boolean') {
    // Localize booleans so "hasCostData = false" renders as 否 not false.
    return { text: value ? '是' : '否', isLong: false };
  }
  if (typeof value === 'number') {
    // 2-decimal retention to avoid float tails like 10691165.00000037.
    const text = value.toLocaleString('zh-CN', {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    });
    return { text, isLong: false };
  }
  const text = String(value);
  return { text, isLong: text.length > 10 };
}

const kpis = computed(() => {
  const kv = props.item?.kpiValues;
  if (!kv || typeof kv !== 'object') return [];
  return Object.entries(kv)
    .slice(0, 4)
    .map(([key, value]) => {
      const formatted = formatKpiValue(value);
      return {
        label: localizeKpiKey(key),
        value: formatted.text,
        isLongText: formatted.isLong,
      };
    });
});

/** Format number with thousands separator + 2-decimal retention.
 * Used by ECharts yAxis.axisLabel + tooltip formatters. */
function fmtNum(v: unknown): string {
  if (typeof v !== 'number' || !isFinite(v)) return String(v ?? '');
  return v.toLocaleString('zh-CN', {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** Truncate long labels for axis / legend / pie slices.
 * ECharts doesn't natively handle long Chinese product names — we cut
 * to N chars + … so charts remain readable. */
function truncateLabel(s: unknown, max = 10): string {
  const str = String(s ?? '');
  return str.length > max ? str.slice(0, max) + '…' : str;
}

/** Post-process any chart option to apply number formatters + label
 * truncation. Backend templates don't know client display conventions,
 * so FE enhances here. Non-destructive — only sets what's missing. */
function enhanceChartOption(option: unknown): unknown {
  if (!option || typeof option !== 'object') return option;
  const opt = JSON.parse(JSON.stringify(option)) as Record<string, any>; // deep clone

  // yAxis formatter (handle single object or array)
  const yAxes = Array.isArray(opt.yAxis) ? opt.yAxis : opt.yAxis ? [opt.yAxis] : [];
  for (const y of yAxes) {
    if (y && typeof y === 'object') {
      y.axisLabel = y.axisLabel || {};
      if (!y.axisLabel.formatter) y.axisLabel.formatter = (v: unknown) => fmtNum(v);
    }
  }

  // xAxis: truncate category labels
  const xAxes = Array.isArray(opt.xAxis) ? opt.xAxis : opt.xAxis ? [opt.xAxis] : [];
  for (const x of xAxes) {
    if (x && typeof x === 'object') {
      x.axisLabel = x.axisLabel || {};
      if (x.axisLabel.formatter === undefined) {
        x.axisLabel.formatter = (v: unknown) => truncateLabel(v, 8);
      }
    }
  }

  // tooltip: global value formatter
  if (!opt.tooltip) opt.tooltip = {};
  if (!opt.tooltip.valueFormatter) {
    opt.tooltip.valueFormatter = (v: unknown) => fmtNum(v);
  }

  // Series-level bar/line label + pie label — truncate + format numbers
  const series = Array.isArray(opt.series) ? opt.series : opt.series ? [opt.series] : [];
  for (const s of series) {
    if (!s || typeof s !== 'object') continue;
    if (s.type === 'pie') {
      s.label = s.label || {};
      if (!s.label.formatter) {
        // {b}: name, {d}: percent — always 2 decimals
        s.label.formatter = '{b}: {d}%';
      }
      if (s.label.overflow === undefined) s.label.overflow = 'truncate';
      if (s.label.width === undefined) s.label.width = 100;
    } else if (s.type === 'bar' || s.type === 'line') {
      s.label = s.label || {};
      if (s.label.show && !s.label.formatter) {
        s.label.formatter = (p: any) => fmtNum(p?.value);
      }
    }
  }

  // legend: truncate long entries
  if (opt.legend) {
    const legends = Array.isArray(opt.legend) ? opt.legend : [opt.legend];
    for (const lg of legends) {
      if (lg && typeof lg === 'object') {
        if (!lg.formatter) lg.formatter = (name: string) => truncateLabel(name, 10);
        if (lg.textStyle === undefined) lg.textStyle = { overflow: 'truncate', width: 120 };
      }
    }
  }

  return opt;
}

const chartOption = computed(() => {
  const configs = props.item?.chartConfigs;
  if (!Array.isArray(configs) || configs.length === 0) return null;
  return enhanceChartOption(configs[0]);
});

// Backend insight templates use 书面 phrases that confuse operators.
// Replace the common ones with 白话 equivalents. Applied last so any
// future frontend-only rewording doesn't require a backend deploy.
const INSIGHT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/余下梯队收敛明显/g, '其余门店之间差距不大'],
  [/可复盘成功因素用于复制/g, '可以总结做对了什么再用一次'],
  [/堂食客单价/g, '堂食人均消费'],
  [/人均订单量/g, '人均下单次数'],
  [/到账率/g, '实收比例'],
  [/DoD ↑/g, '日环比 ↑'],
  [/DoD ↓/g, '日环比 ↓'],
  [/YoY \+/g, '同比 +'],
  [/YoY -/g, '同比 -'],
  [/MoM \+/g, '环比 +'],
  [/MoM -/g, '环比 -'],
  [/\bstd\b/g, '标准差'],
  [/\bmean\b/g, '均值'],
  [/\bσ\b/g, '标准差'],
];

function humanizeInsight(raw: string): string {
  let out = raw;
  for (const [re, repl] of INSIGHT_REPLACEMENTS) {
    out = out.replace(re, repl);
  }
  return out;
}

const insightText = computed(() => {
  const insights = props.item?.insights;
  if (!Array.isArray(insights) || insights.length === 0) return '';
  return insights
    .map((i) => (typeof i === 'string' ? i : (i as { text?: string }).text || ''))
    .filter(Boolean)
    .map(humanizeInsight)
    .join('\n');
});

function renderChart() {
  if (!chartRef.value || !chartOption.value) {
    chartInstance?.dispose();
    chartInstance = null;
    return;
  }
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value);
  }
  chartInstance.setOption(chartOption.value as echarts.EChartsOption, true);
}

onMounted(() => {
  nextTick(renderChart);
});

watch(
  () => [props.status, props.item],
  () => nextTick(renderChart),
  { deep: true },
);
</script>

<style scoped>
.tpl-card {
  margin-bottom: 16px;
}
.tpl-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.tpl-title {
  font-weight: 600;
  font-size: 14px;
}
.tpl-badge {
  font-size: 12px;
  color: #909399;
}
.tpl-kpis {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.tpl-kpi {
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  min-width: 80px;
  max-width: 220px;
  overflow: hidden;
}
.tpl-kpi-label {
  font-size: 12px;
  color: #606266;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tpl-kpi-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Long string values (e.g. 菜品名 "招牌青花椒鱼(微麻微辣)(一吃)") —
 * smaller font + 2-line clamp so whole name is readable. */
.tpl-kpi-value--long {
  font-size: 13px;
  font-weight: 500;
  white-space: normal;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.tpl-chart {
  height: 260px;
  width: 100%;
}
.tpl-insight {
  margin-top: 12px;
  padding: 10px;
  background: #f0f9ff;
  border-left: 3px solid #409eff;
  font-size: 13px;
  white-space: pre-wrap;
}
.tpl-empty {
  text-align: center;
  padding: 32px 16px;
  color: #909399;
}
.tpl-empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}
.tpl-empty-title {
  font-size: 14px;
  color: #606266;
  margin-bottom: 4px;
}
.tpl-empty-hint {
  font-size: 12px;
}
.tpl-loading {
  padding: 16px;
}
</style>
