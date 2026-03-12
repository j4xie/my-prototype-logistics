<script setup lang="ts">
/**
 * DynamicChartRenderer - 通用图表渲染器
 * 自动检测图表配置格式 (legacy/dynamic/dashboard) 并转换为 ECharts option
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import echarts from '@/utils/echarts';
import { useAppStore } from '@/store/modules/app';
import type { ChartConfig, LegacyChartConfig, DynamicChartConfig, DashboardChartConfig } from '@/types/smartbi';
import { chartHasData } from '@/types/smartbi';
import { registerChinaMap, normalizeProvinceName } from '@/utils/chinaMap';
import { CHART_COLORS } from '@/constants/chart-colors';
import { defaultTooltip } from './chart-helpers';
import { enhanceChartDefaults } from '@/composables/useChartEnhancer';

interface Props {
  config: ChartConfig;
  height?: number;
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  height: 320,
  title: undefined,
});

const emit = defineEmits<{
  (e: 'chart-click', params: Record<string, unknown>): void;
  (e: 'chart-hover', params: Record<string, unknown>): void;
  (e: 'chart-ready', instance: echarts.ECharts): void;
}>();

const appStore = useAppStore();
const echartsThemeName = computed(() => appStore.theme === 'dark' ? 'cretas-dark' : 'cretas');

const chartRef = ref<HTMLDivElement | null>(null);
let chartInstance: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;
let rafId = 0;
let prevChartType: string | null = null; // Fix 63: track chart type for transition

const PIE_COLORS = CHART_COLORS;

/** Extract axis field from config, handling camelCase/lowercase variants from API */
function extractField(config: Record<string, unknown>, primary: string, fallback: string, defaultVal: string): string {
  return (config[primary] as string | undefined) || (config[fallback] as string | undefined) || defaultVal;
}

onMounted(() => {
  initChart();
  // G-19: Use ResizeObserver for container-aware resize (sidebar toggle, panel adjust)
  if (chartRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartRef.value);
  }
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (rafId) cancelAnimationFrame(rafId);
  window.removeEventListener('resize', handleResize);
  chartInstance?.dispose();
  chartInstance = null;
});

watch(() => props.config, () => {
  nextTick(() => updateChart());
}, { deep: true });

// H1: Re-init chart when theme changes (ECharts doesn't support runtime theme swap)
watch(echartsThemeName, () => {
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }
  nextTick(() => initChart());
});

function initChart() {
  if (!chartRef.value) return;
  try {
    chartInstance = echarts.init(chartRef.value, echartsThemeName.value);
    // Expose click/hover events for cross-filtering
    chartInstance.on('click', (params: unknown) => {
      emit('chart-click', params as Record<string, unknown>);
    });
    chartInstance.on('mouseover', (params: unknown) => {
      emit('chart-hover', params as Record<string, unknown>);
    });
    updateChart();
    emit('chart-ready', chartInstance);
  } catch (err) {
    console.error('[DynamicChartRenderer] initChart failed:', err);
  }
}

/** Expose chart instance for parent to call echarts.connect() or dispatchAction() */
function getChartInstance(): echarts.ECharts | null {
  return chartInstance;
}

defineExpose({ getChartInstance });

function updateChart() {
  if (!chartInstance) return;

  if (!chartHasData(props.config)) {
    chartInstance.setOption({
      title: {
        text: '暂无数据',
        left: 'center',
        top: 'center',
        textStyle: { color: '#909399', fontSize: 14, fontWeight: 'normal' },
      },
    }, true);
    return;
  }

  try {
    const option = buildOption(props.config);
    if (option) {
      const opt = option as Record<string, unknown>;
      // Strip ECharts-internal title — Vue card header already displays it
      delete opt.title;
      // G-11: ARIA accessibility for screen readers
      opt.aria = { enabled: true, decal: { show: true } };
      // G-20: Unified animation config
      opt.animation = true;
      opt.animationDuration = 600;
      opt.animationEasing = 'cubicOut';
      opt.animationThreshold = 2000;
      // G-22: emphasis/blur — hover one series dims others
      if (Array.isArray(opt.series)) {
        (opt.series as Record<string, unknown>[]).forEach(s => {
          if (!s.emphasis) s.emphasis = {};
          (s.emphasis as Record<string, unknown>).focus = 'series';
          if (!s.blur) s.blur = {};
          const blur = s.blur as Record<string, unknown>;
          if (!blur.itemStyle) blur.itemStyle = {};
          (blur.itemStyle as Record<string, unknown>).opacity = 0.15;
        });
      }
      // G-23: universalTransition — smooth morph between config changes
      if (Array.isArray(opt.series)) {
        (opt.series as Record<string, unknown>[]).forEach(s => {
          s.universalTransition = { enabled: true, divideShape: 'clone' };
        });
      }
      // Shared enhancements: semantic coloring, compact formatters, gradients, outlier detection
      enhanceChartDefaults(opt);
      // G-21: Toolbox — save/zoom/restore + magicType switching
      const chartType = (props.config as Record<string, unknown>).chartType as string | undefined;
      const lcType = (chartType || '').toLowerCase();
      const supportsMagicType = ['line', 'bar', 'area', 'stacked_bar', 'combination', 'line_bar'].includes(lcType) || (!chartType && opt.series);
      opt.toolbox = {
        feature: {
          saveAsImage: { pixelRatio: 2, title: '保存' },
          dataZoom: { title: { zoom: '缩放', back: '还原' } },
          restore: { title: '重置' },
          ...(supportsMagicType ? {
            magicType: {
              type: ['line', 'bar', 'stack'],
              title: { line: '折线', bar: '柱状', stack: '堆叠' },
            },
          } : {}),
        },
        right: 16, top: 4,
        iconStyle: { borderColor: '#9ca3af' },
        emphasis: { iconStyle: { borderColor: '#1B65A8' } },
      };
      // Fix 63: Use notMerge=false when same chart type for smooth data transitions
      const curChartType = (props.config as Record<string, unknown>).chartType as string | undefined;
      const sameType = prevChartType != null && curChartType === prevChartType;
      prevChartType = curChartType || null;
      chartInstance.setOption(option, { notMerge: !sameType, lazyUpdate: true });
    }
  } catch (err) {
    console.error('[DynamicChartRenderer] setOption failed:', err);
    // Show error fallback in chart area
    try {
      chartInstance.setOption({
        graphic: [{
          type: 'text',
          left: 'center',
          top: 'center',
          style: { text: '图表渲染异常', fontSize: 14, fill: '#F56C6C' },
        }],
      }, true);
    } catch { /* prevent infinite error loop */ }
  }
}

function handleResize() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    chartInstance?.resize();
  });
}

// ==================== Option 构建逻辑 ====================

function buildOption(config: ChartConfig): echarts.EChartsOption | null {
  // DynamicChartConfig: has series[] and xAxis object
  if ('series' in config && Array.isArray(config.series) && 'xAxis' in config && config.xAxis && typeof config.xAxis === 'object' && 'type' in config.xAxis) {
    return buildFromDynamicConfig(config as DynamicChartConfig);
  }
  // DashboardChartConfig: has series[] and xAxis.data[]
  if ('series' in config && Array.isArray(config.series) && 'xAxis' in config && config.xAxis && typeof config.xAxis === 'object' && 'data' in config.xAxis) {
    return buildFromDashboardConfig(config as DashboardChartConfig);
  }
  // DynamicChartConfig: has series[] but no xAxis (pie chart)
  if ('series' in config && Array.isArray(config.series)) {
    return buildFromDynamicConfig(config as DynamicChartConfig);
  }
  // LegacyChartConfig: has data[] + xAxisField
  if ('data' in config && Array.isArray(config.data)) {
    return buildFromLegacyConfig(config as LegacyChartConfig);
  }
  return null;
}

/** Build from DashboardChartConfig (Dashboard endpoint format) */
function buildFromDashboardConfig(config: DashboardChartConfig): echarts.EChartsOption {
  const chartType = config.chartType?.toLowerCase() || 'line';

  if (chartType === 'pie') {
    return buildDashboardPie(config);
  }

  const option: echarts.EChartsOption = {
    tooltip: { ...defaultTooltip('axis'), axisPointer: { type: 'cross' } },
    legend: {
      data: config.legend?.data || config.series.map(s => s.name),
      bottom: 0,
      type: (config.legend?.data || config.series)?.length > 5 ? 'scroll' : 'plain',
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: config.xAxis?.data || [],
      axisLabel: { rotate: 30, hideOverlap: true },
    },
    yAxis: config.series.length > 1
      ? config.series.map((s, i) => ({
          type: 'value' as const,
          name: s.name,
          position: i === 0 ? 'left' as const : 'right' as const,
          axisLabel: { formatter: (v: number) => formatAxisValue(v) },
        }))
      : { type: 'value' as const, axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
    series: config.series.map((s, index) => ({
      name: s.name,
      type: (s.type || 'line') as 'line' | 'bar',
      smooth: true,
      yAxisIndex: s.yAxisIndex ?? (config.series.length > 1 ? index : 0),
      data: s.data,
      areaStyle: index === 0
        ? { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(27, 101, 168, 0.3)' },
            { offset: 1, color: 'rgba(27, 101, 168, 0.05)' },
          ]) }
        : undefined,
      lineStyle: { width: 3, color: PIE_COLORS[index % PIE_COLORS.length] },
      itemStyle: { color: PIE_COLORS[index % PIE_COLORS.length] },
    })),
  };
  const xLen = config.xAxis?.data?.length || 0;
  if (xLen > 15) {
    option.dataZoom = [
      { type: 'slider', start: 0, end: Math.round(15 / xLen * 100) },
      { type: 'inside' },
    ];
  }
  return option;
}

function buildDashboardPie(config: DashboardChartConfig): echarts.EChartsOption {
  const seriesData = config.series[0];
  if (!seriesData?.data) return { title: { text: '暂无数据', left: 'center', top: 'center' } };

  const pieData = seriesData.data.map((value, index) => ({
    value: typeof value === 'number' ? value : (value as { value: number }).value,
    name: config.xAxis?.data?.[index] || `类别${index + 1}`,
    itemStyle: { color: PIE_COLORS[index % PIE_COLORS.length] },
  }));

  return {
    tooltip: defaultTooltip('item', '{b}: {c}万 ({d}%)'),
    legend: { orient: 'vertical', right: '5%', top: 'center' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: false,
      label: { show: false, position: 'center' },
      emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
      labelLine: { show: false },
      data: pieData,
    }],
  };
}

/** Build from DynamicChartConfig (finance analysis format) */
function buildFromDynamicConfig(config: DynamicChartConfig): echarts.EChartsOption {
  // Passthrough: if series contains specialized chart types that manage their own layout,
  // return the config as-is (Python builder sends complete ECharts options for these)
  const NON_AXIS_TYPES = ['sankey', 'sunburst', 'wordCloud', 'wordcloud', 'themeRiver', 'parallel', 'heatmap'];
  if (config.series?.length > 0 && NON_AXIS_TYPES.includes(config.series[0].type as string)) {
    return config as unknown as echarts.EChartsOption;
  }

  const option: echarts.EChartsOption = {
    tooltip: {
      ...defaultTooltip((config.tooltip?.trigger as 'axis' | 'item') || 'axis'),
      axisPointer: config.tooltip?.axisPointer || { type: 'shadow' },
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
  };

  if (config.title) {
    option.title = { text: config.title, subtext: config.subTitle };
  }

  if (config.legend) {
    option.legend = {
      show: config.legend.show !== false,
      data: config.legend.data,
      bottom: config.legend.position === 'bottom' ? 0 : undefined,
      top: config.legend.position === 'top' ? 0 : undefined,
      orient: (config.legend.orient as 'horizontal' | 'vertical') || 'horizontal',
      type: (config.legend.data?.length ?? 0) > 5 ? 'scroll' : 'plain',
    };
  }

  if (config.xAxis) {
    option.xAxis = {
      type: (config.xAxis.type as 'category' | 'value') || 'category',
      name: config.xAxis.name,
      data: config.xAxis.data,
    };
  }

  if (config.yAxis && config.yAxis.length > 0) {
    option.yAxis = config.yAxis.map(axis => ({
      type: (axis.type as 'value' | 'category') || 'value',
      name: axis.name,
      position: (axis.position as 'left' | 'right') || undefined,
      min: axis.min,
      max: axis.max,
      axisLabel: {
        ...(axis.axisLabel || {}),
        formatter: (v: number) => formatAxisValue(v),
      },
    }));
  }

  if (config.series && config.series.length > 0) {
    option.series = config.series.map(s => {
      const item: echarts.SeriesOption = {
        name: s.name,
        type: (s.type as 'line' | 'bar' | 'pie') || 'bar',
        data: s.data,
        yAxisIndex: s.yAxisIndex || 0,
        stack: s.stack,
        smooth: s.smooth,
        itemStyle: s.itemStyle,
        label: s.label ? {
          ...s.label,
          formatter: (params: { value: number | string }) => {
            const v = Number(params.value);
            if (isNaN(v)) return String(params.value);
            const abs = Math.abs(v);
            if (abs >= 100000000) return (v / 100000000).toFixed(1) + '亿';
            if (abs >= 10000) return (v / 10000).toFixed(0) + '万';
            return String(v);
          },
          fontSize: 10,
        } : undefined,
      };
      if (s.areaStyle && s.type === 'line') {
        (item as echarts.LineSeriesOption).areaStyle = {};
      }
      return item;
    }) as echarts.SeriesOption[];
  }

  const xLen = config.xAxis?.data?.length || 0;
  if (xLen > 15) {
    option.dataZoom = [
      { type: 'slider', start: 0, end: Math.round(15 / xLen * 100) },
      { type: 'inside' },
    ];
  }
  return option;
}

/** Build from LegacyChartConfig (data[] + xAxisField format) */
function buildFromLegacyConfig(config: LegacyChartConfig): echarts.EChartsOption {
  if (!config.data || config.data.length === 0) {
    return { title: { text: '暂无数据', left: 'center', top: 'center', textStyle: { color: '#909399', fontSize: 14 } } };
  }

  const chartType = config.chartType?.toLowerCase() || 'bar';

  if (chartType === 'pie') {
    return buildLegacyPie(config);
  }

  // Special handling for WATERFALL chart
  if (chartType === 'waterfall') {
    return buildWaterfallChart(config);
  }

  // Special handling for LINE_BAR (budget achievement) chart
  if (chartType === 'line_bar') {
    return buildLineBudgetChart(config);
  }

  // Special handling for RADAR chart
  if (chartType === 'radar') {
    return buildRadarChart(config);
  }

  // Special handling for SCATTER chart
  if (chartType === 'scatter') {
    return buildScatterChart(config);
  }

  // Special handling for AREA chart (line with filled area)
  if (chartType === 'area') {
    return buildAreaChart(config);
  }

  // Special handling for GAUGE chart
  if (chartType === 'gauge') {
    return buildGaugeChart(config);
  }

  // Special handling for FUNNEL chart
  if (chartType === 'funnel') {
    return buildFunnelChart(config);
  }

  // Special handling for STACKED_BAR chart
  if (chartType === 'stacked_bar') {
    return buildStackedBarChart(config);
  }

  // Special handling for DOUGHNUT chart (pie with inner radius)
  if (chartType === 'doughnut') {
    return buildDoughnutChart(config);
  }

  // Special handling for TREEMAP chart
  if (chartType === 'treemap') {
    return buildTreemapChart(config);
  }

  // Special handling for MAP chart (China map)
  if (chartType === 'map') {
    return buildMapChart(config);
  }

  // Special handling for HEATMAP chart
  if (chartType === 'heatmap' || chartType === 'matrix_heatmap') {
    return buildHeatmapChart(config);
  }

  // Special handling for BOXPLOT chart
  if (chartType === 'boxplot') {
    return buildBoxplotChart(config);
  }

  // Special handling for CANDLESTICK chart
  if (chartType === 'candlestick') {
    return buildCandlestickChart(config);
  }

  // Special handling for SANKEY chart
  if (chartType === 'sankey') {
    return buildSankeyChart(config);
  }

  // Special handling for SUNBURST chart
  if (chartType === 'sunburst') {
    return buildSunburstChart(config);
  }

  // Special handling for WORDCLOUD chart
  if (chartType === 'wordcloud') {
    return buildWordCloudChart(config);
  }

  // Special handling for SLOPE chart
  if (chartType === 'slope') {
    return buildSlopeChart(config);
  }

  // Special handling for PARALLEL chart
  if (chartType === 'parallel') {
    return buildParallelChart(config);
  }

  // Special handling for THEME_RIVER chart
  if (chartType === 'themeriver') {
    return buildThemeRiverChart(config);
  }

  // Special handling for PICTORIAL_BAR chart
  if (chartType === 'pictorialbar') {
    return buildPictorialBarChart(config);
  }

  // Support both camelCase (xAxisField) and lowercase (xaxisField) from API
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  const yField = extractField(config as Record<string, unknown>, 'yAxisField', 'yaxisField', 'value');

  const xData = config.data.map(item => String(item[xField] || ''));
  const yData = config.data.map(item => Number(item[yField] || 0));

  const hasNegative = yData.some(v => v < 0);
  const needsDataZoom = xData.length > 15;
  const result: echarts.EChartsOption = {
    tooltip: { ...defaultTooltip('axis'), axisPointer: { type: chartType === 'line' ? 'cross' : 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: needsDataZoom ? '20%' : '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: xData, axisLabel: { rotate: 30, hideOverlap: true } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
    series: [{
      name: config.title || yField,
      type: chartType as 'bar' | 'line',
      data: yData,
      smooth: chartType === 'line',
      itemStyle: { color: CHART_COLORS[0] },
      ...(chartType === 'line' && hasNegative ? {
        markPoint: {
          data: [{ type: 'min', name: '最低值', symbol: 'pin', symbolSize: 40, label: { formatter: '{c}', fontSize: 10 } }],
          itemStyle: { color: '#F56C6C' },
        },
        markLine: {
          silent: true,
          data: [{ yAxis: 0, lineStyle: { color: '#E6A23C', type: 'dashed', width: 1 } }],
          label: { show: false },
        },
      } : {}),
    }],
  };
  // G-17: Auto DataZoom for long x-axis
  if (needsDataZoom) {
    result.dataZoom = [
      { type: 'slider', start: 0, end: Math.round(15 / xData.length * 100) },
      { type: 'inside' },
    ];
  }
  return result;
}

/** Build waterfall chart for budget execution */
function buildWaterfallChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  const yField = extractField(config as Record<string, unknown>, 'yAxisField', 'yaxisField', 'value');

  const xData = config.data.map(item => String(item[xField] || ''));
  const yData = config.data.map(item => Number(item[yField] || 0));

  return {
    tooltip: { ...defaultTooltip('axis'), axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: xData, axisLabel: { rotate: 30, hideOverlap: true } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
    series: [{
      type: 'bar',
      data: yData.map((val, idx) => ({
        value: val,
        itemStyle: { color: idx === 0 ? CHART_COLORS[0] : CHART_COLORS[1] },
      })),
      label: { show: true, position: 'top', formatter: (p: { value: number }) => formatAxisValue(p.value) },
    }],
  };
}

/** Build LINE_BAR chart — reads series metadata from options.series when available */
function buildLineBudgetChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'month');
  const xData = config.data.map(item => String(item[xField] || ''));

  // Read series definitions from options.series (backend provides field→name mapping)
  const optSeries = (config.options as Record<string, unknown>)?.series as Array<Record<string, unknown>> | undefined;
  const optYAxis = (config.options as Record<string, unknown>)?.yAxis as Array<Record<string, unknown>> | undefined;

  if (optSeries && optSeries.length > 0) {
    // Generic path: build series from options.series metadata
    const dataKeys = Object.keys(config.data[0] || {}).filter(k => k !== xField);
    const seriesColors = [CHART_COLORS[0], CHART_COLORS[1], CHART_COLORS[3], CHART_COLORS[2], CHART_COLORS[4]];
    const legendData: string[] = [];

    const series = optSeries.map((sDef, idx) => {
      const name = String(sDef.name || `系列${idx + 1}`);
      const type = String(sDef.type || 'bar');
      const yAxisIndex = Number(sDef.yAxisIndex || 0);
      legendData.push(name);

      // Match series to data field by index position in dataKeys
      const fieldKey = dataKeys[idx] || '';
      const seriesData = config.data.map(item => Number(item[fieldKey] || 0));

      return {
        name,
        type: type as 'bar' | 'line',
        data: seriesData,
        yAxisIndex,
        smooth: type === 'line',
        itemStyle: { color: seriesColors[idx % seriesColors.length] },
      };
    });

    // Build yAxis from options.yAxis or default
    const yAxis = optYAxis && optYAxis.length > 0
      ? optYAxis.map(ax => ({
          type: 'value' as const,
          name: String(ax.name || ''),
          position: ax.position as 'left' | 'right' || undefined,
          axisLabel: { formatter: (v: number) => String(ax.name || '').includes('%')
            ? `${v}%`
            : formatAxisValue(v) },
        }))
      : [{ type: 'value' as const, name: '金额', axisLabel: { formatter: (v: number) => formatAxisValue(v) } }];

    return {
      tooltip: { ...defaultTooltip('axis'), axisPointer: { type: 'cross' } },
      legend: { data: legendData, bottom: 0 },
      grid: { left: '3%', right: '8%', bottom: '15%', top: '10%', containLabel: true },
      xAxis: { type: 'category', data: xData, axisLabel: { rotate: 30, hideOverlap: true } },
      yAxis,
      series,
    };
  }

  // Fallback: hardcoded budget achievement fields
  const budgetData = config.data.map(item => Number(item.budget || 0));
  const actualData = config.data.map(item => Number(item.actual || 0));
  const rateData = config.data.map(item => Number(item.achievementRate || 0));

  return {
    tooltip: { ...defaultTooltip('axis'), axisPointer: { type: 'cross' } },
    legend: { data: ['预算', '实际', '达成率'], bottom: 0 },
    grid: { left: '3%', right: '8%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: xData, axisLabel: { rotate: 30, hideOverlap: true } },
    yAxis: [
      { type: 'value', name: '金额', axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
      { type: 'value', name: '达成率(%)', min: 0, max: 200, position: 'right', axisLabel: { formatter: '{value}%' } },
    ],
    series: [
      { name: '预算', type: 'bar', data: budgetData, itemStyle: { color: CHART_COLORS[0] } },
      { name: '实际', type: 'bar', data: actualData, itemStyle: { color: CHART_COLORS[1] } },
      { name: '达成率', type: 'line', yAxisIndex: 1, data: rateData, smooth: true, itemStyle: { color: CHART_COLORS[3] } },
    ],
  };
}

/** Build radar/spider chart */
function buildRadarChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  const yField = extractField(config as Record<string, unknown>, 'yAxisField', 'yaxisField', 'value');

  // Build radar indicator from data
  const indicator = config.data.map(item => ({
    name: String(item[xField] || ''),
    max: Math.max(...config.data.map(d => Number(d[yField] || 0))) * 1.2,
  }));

  const values = config.data.map(item => Number(item[yField] || 0));

  return {
    tooltip: defaultTooltip('item'),
    radar: {
      indicator,
      shape: 'polygon',
      splitNumber: 5,
      axisName: { color: '#666' },
    },
    series: [{
      type: 'radar',
      data: [{
        value: values,
        name: '指标值',
        areaStyle: { color: 'rgba(27, 101, 168, 0.3)' },
        lineStyle: { color: CHART_COLORS[0], width: 2 },
        itemStyle: { color: CHART_COLORS[0] },
      }],
    }],
  };
}

/** Build scatter plot chart */
function buildScatterChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'x');
  const yField = extractField(config as Record<string, unknown>, 'yAxisField', 'yaxisField', 'y');

  const scatterData = config.data.map(item => [
    Number(item[xField] || 0),
    Number(item[yField] || 0),
  ]);

  return {
    tooltip: {
      ...defaultTooltip('item'),
      formatter: (params: { value: number[] }) => `(${params.value[0]}, ${params.value[1]})`,
    },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
    xAxis: { type: 'value', name: xField, axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
    yAxis: { type: 'value', name: yField, axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
    series: [{
      type: 'scatter',
      data: scatterData,
      symbolSize: 12,
      itemStyle: { color: CHART_COLORS[0] },
    }],
  };
}

/** Build area chart (line with filled area) */
function buildAreaChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  const yField = extractField(config as Record<string, unknown>, 'yAxisField', 'yaxisField', 'value');

  const xData = config.data.map(item => String(item[xField] || ''));
  const yData = config.data.map(item => Number(item[yField] || 0));

  return {
    tooltip: { ...defaultTooltip('axis'), axisPointer: { type: 'cross' } },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: xData, axisLabel: { rotate: 30, hideOverlap: true } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
    series: [{
      type: 'line',
      data: yData,
      smooth: true,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(27, 101, 168, 0.5)' },
          { offset: 1, color: 'rgba(27, 101, 168, 0.05)' },
        ]),
      },
      lineStyle: { color: CHART_COLORS[0], width: 2 },
      itemStyle: { color: CHART_COLORS[0] },
    }],
  };
}

/** Build gauge/meter chart */
function buildGaugeChart(config: LegacyChartConfig): echarts.EChartsOption {
  const yField = extractField(config as Record<string, unknown>, 'yAxisField', 'yaxisField', 'value');
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');

  // Use first data item for gauge value
  const firstItem = config.data[0] || {};
  const value = Number(firstItem[yField] || 0);
  const name = String(firstItem[xField] || '指标');

  return {
    tooltip: defaultTooltip('item', '{b}: {c}%'),
    series: [{
      type: 'gauge',
      startAngle: 180,
      endAngle: 0,
      min: 0,
      max: 100,
      splitNumber: 10,
      radius: '90%',
      center: ['50%', '65%'],
      axisLine: {
        lineStyle: {
          width: 20,
          color: [
            [0.3, '#F56C6C'],
            [0.7, '#E6A23C'],
            [1, '#67C23A'],
          ],
        },
      },
      pointer: { itemStyle: { color: 'auto' }, width: 5 },
      axisTick: { distance: -20, length: 8, lineStyle: { color: '#fff', width: 2 } },
      splitLine: { distance: -20, length: 20, lineStyle: { color: '#fff', width: 3 } },
      axisLabel: { color: 'auto', distance: 25, fontSize: 12 },
      detail: {
        valueAnimation: true,
        formatter: '{value}%',
        color: 'auto',
        fontSize: 24,
        offsetCenter: [0, '20%'],
      },
      data: [{ value, name }],
    }],
  };
}

/** Build funnel chart */
function buildFunnelChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  const yField = extractField(config as Record<string, unknown>, 'yAxisField', 'yaxisField', 'value');

  const funnelData = config.data.map((item, index) => ({
    name: String(item[xField] || ''),
    value: Number(item[yField] || 0),
    itemStyle: { color: PIE_COLORS[index % PIE_COLORS.length] },
  }));

  return {
    tooltip: defaultTooltip('item', '{b}: {c} ({d}%)'),
    legend: { orient: 'vertical', right: '5%', top: 'center' },
    series: [{
      type: 'funnel',
      left: '10%',
      top: 60,
      bottom: 60,
      width: '70%',
      minSize: '0%',
      maxSize: '100%',
      sort: 'descending',
      gap: 2,
      label: { show: true, position: 'inside', formatter: '{b}' },
      emphasis: { label: { fontSize: 14 } },
      data: funnelData,
    }],
  };
}

/** Build stacked bar chart */
function buildStackedBarChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');

  // Get all keys except xField for stacking
  const allKeys = config.data.length > 0 ? Object.keys(config.data[0]) : [];
  const valueKeys = allKeys.filter(k => k !== xField);

  const xData = config.data.map(item => String(item[xField] || ''));

  const series = valueKeys.map((key, index) => ({
    name: key,
    type: 'bar' as const,
    stack: 'total',
    emphasis: { focus: 'series' as const },
    data: config.data.map(item => Number(item[key] || 0)),
    itemStyle: { color: PIE_COLORS[index % PIE_COLORS.length] },
  }));

  // DataZoom + label rotation for crowded x-axes
  const dataLen = xData.length;
  const maxLabelLen = Math.max(...xData.map(d => d.length), 0);
  const dataZoom: unknown[] = [];
  let gridBottom = '15%';
  let axisRotate = 0;

  if (dataLen > 15) {
    const endPercent = Math.min(100, Math.round((15 / dataLen) * 100));
    dataZoom.push(
      { type: 'slider', show: true, xAxisIndex: 0, start: 0, end: endPercent, height: 20, bottom: 8 },
      { type: 'inside', xAxisIndex: 0, start: 0, end: endPercent },
    );
    gridBottom = '60px';
  }
  if (dataLen > 50) axisRotate = 60;
  else if (dataLen > 30) axisRotate = 50;
  else if (dataLen > 15) axisRotate = 45;
  else if (maxLabelLen > 4 && dataLen > 4) axisRotate = 40;
  if (axisRotate >= 30) gridBottom = axisRotate >= 45 ? '85px' : '70px';

  return {
    tooltip: { ...defaultTooltip('axis'), axisPointer: { type: 'shadow' } },
    legend: { data: valueKeys, bottom: 0, type: valueKeys.length > 5 ? 'scroll' as const : 'plain' as const },
    grid: { left: '3%', right: '4%', bottom: gridBottom, top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: {
        rotate: axisRotate,
        hideOverlap: true,
        formatter: maxLabelLen > 10 ? (v: string) => v.length > 10 ? v.substring(0, 9) + '…' : v : undefined,
      },
    },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
    series,
    ...(dataZoom.length > 0 ? { dataZoom } : {}),
  };
}

/** Build doughnut chart (pie with inner radius) */
function buildDoughnutChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  const yField = extractField(config as Record<string, unknown>, 'yAxisField', 'yaxisField', 'value');

  const pieData = config.data.map((item, index) => ({
    name: String(item[xField] || ''),
    value: Number(item[yField] || 0),
    itemStyle: { color: PIE_COLORS[index % PIE_COLORS.length] },
  }));

  // Calculate total for center label
  const total = pieData.reduce((sum, item) => sum + item.value, 0);

  return {
    tooltip: defaultTooltip('item', '{b}: {c} ({d}%)'),
    legend: { orient: 'vertical', right: '5%', top: 'center', type: pieData.length > 8 ? 'scroll' as const : 'plain' as const },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['40%', '50%'],
      avoidLabelOverlap: true,
      labelLayout: { hideOverlap: true },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold' },
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' },
      },
      labelLine: { show: false },
      data: pieData,
    }, {
      // Center text showing total
      type: 'pie',
      radius: ['0%', '0%'],
      center: ['40%', '50%'],
      label: {
        show: true,
        position: 'center',
        formatter: `{a|${formatAxisValue(total)}}\n{b|合计}`,
        rich: {
          a: { fontSize: 20, fontWeight: 'bold', color: '#303133' },
          b: { fontSize: 12, color: '#909399', padding: [5, 0, 0, 0] },
        },
      },
      data: [{ value: 0, name: '' }],
    }],
  };
}

/** Build treemap chart for hierarchical data */
function buildTreemapChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  const yField = extractField(config as Record<string, unknown>, 'yAxisField', 'yaxisField', 'value');

  const treemapData = config.data.map((item, index) => ({
    name: String(item[xField] || ''),
    value: Number(item[yField] || 0),
    itemStyle: { color: PIE_COLORS[index % PIE_COLORS.length] },
  }));

  return {
    tooltip: {
      ...defaultTooltip('item'),
      formatter: (params: { name: string; value: number }) => `${params.name}: ${formatAxisValue(params.value)}`,
    },
    series: [{
      type: 'treemap',
      width: '90%',
      height: '85%',
      top: '5%',
      left: '5%',
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      label: {
        show: true,
        formatter: '{b}',
        fontSize: 12,
      },
      itemStyle: { borderColor: '#fff', borderWidth: 2, gapWidth: 2 },
      data: treemapData,
    }],
  };
}

/** Build map chart for regional data visualization */
function buildMapChart(config: LegacyChartConfig): echarts.EChartsOption {
  // Register China map if not already registered
  registerChinaMap();

  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  const yField = extractField(config as Record<string, unknown>, 'yAxisField', 'yaxisField', 'value');

  // Normalize province names and build map data
  const mapData = config.data.map(item => ({
    name: normalizeProvinceName(String(item[xField] || '')),
    value: Number(item[yField] || 0),
  }));

  // Calculate value range for visual map
  const values = mapData.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  return {
    tooltip: {
      ...defaultTooltip('item'),
      formatter: (params: { name: string; value: number }) => {
        if (params.value === undefined) return `${params.name}: 暂无数据`;
        return `${params.name}: ${formatAxisValue(params.value)}`;
      },
    },
    visualMap: {
      type: 'continuous',
      min: minValue,
      max: maxValue,
      left: 'left',
      top: 'bottom',
      text: ['高', '低'],
      calculable: true,
      inRange: {
        color: ['#e0f3f8', '#abd9e9', '#74add1', '#4575b4', '#313695'],
      },
    },
    series: [{
      type: 'map',
      map: 'china',
      roam: true,
      zoom: 1.2,
      center: [105, 36],
      label: {
        show: true,
        fontSize: 8,
        color: '#333',
      },
      emphasis: {
        label: { show: true, fontSize: 12, fontWeight: 'bold' },
        itemStyle: { areaColor: '#ffd93d' },
      },
      itemStyle: {
        borderColor: '#fff',
        borderWidth: 1,
      },
      data: mapData,
    }],
  };
}

function buildLegacyPie(config: LegacyChartConfig): echarts.EChartsOption {
  // Support both camelCase (xAxisField) and lowercase (xaxisField) from API
  let xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  let yField = extractField(config as Record<string, unknown>, 'yAxisField', 'yaxisField', 'value');

  // Auto-detect fields if declared fields don't exist in data
  const sample = config.data?.[0] as Record<string, unknown> | undefined;
  if (sample) {
    if (!(xField in sample)) {
      const stringFields = Object.keys(sample).filter(k => typeof sample[k] === 'string');
      if (stringFields.length > 0) xField = stringFields[0];
    }
    if (!(yField in sample)) {
      const numFields = Object.keys(sample).filter(k => typeof sample[k] === 'number' && k !== xField);
      if (numFields.length > 0) yField = numFields[0];
    }
  }

  const pieData = config.data?.map((item, index) => ({
    name: String(item[xField] || ''),
    value: Number(item[yField] || 0),
    itemStyle: { color: PIE_COLORS[index % PIE_COLORS.length] },
  })) || [];

  return {
    tooltip: defaultTooltip('item', '{b}: {c} ({d}%)'),
    legend: { orient: 'vertical', right: '10%', top: 'center', type: pieData.length > 8 ? 'scroll' as const : 'plain' as const },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['40%', '50%'],
      avoidLabelOverlap: true,
      label: { show: true, formatter: '{b}: {d}%', fontSize: 11 },
      labelLine: { show: true, length: 10, length2: 8 },
      labelLayout: { hideOverlap: true },
      data: pieData,
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' },
      },
    }],
  };
}

/** Build heatmap / matrix_heatmap chart */
function buildHeatmapChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  const yField = extractField(config as Record<string, unknown>, 'yAxisField', 'yaxisField', 'value');
  // Try to find a third field for the value dimension
  const allKeys = config.data.length > 0 ? Object.keys(config.data[0]) : [];
  const valueField = allKeys.find(k => k !== xField && k !== yField && typeof config.data[0][k] === 'number') || yField;

  const xCategories = [...new Set(config.data.map(d => String(d[xField] || '')))];
  const yCategories = [...new Set(config.data.map(d => String(d[yField] || '')))];
  const heatData: [number, number, number][] = [];
  let maxVal = 0;

  config.data.forEach(d => {
    const xi = xCategories.indexOf(String(d[xField] || ''));
    const yi = yCategories.indexOf(String(d[yField] || ''));
    const val = Number(d[valueField] || 0);
    if (xi >= 0 && yi >= 0) {
      heatData.push([xi, yi, val]);
      maxVal = Math.max(maxVal, val);
    }
  });

  return {
    tooltip: { ...defaultTooltip('item'), formatter: (p: { value: [number, number, number] }) => `${xCategories[p.value[0]]} × ${yCategories[p.value[1]]}: ${formatAxisValue(p.value[2])}` },
    grid: { left: '12%', right: '8%', bottom: '15%', top: '5%', containLabel: true },
    xAxis: { type: 'category', data: xCategories, axisLabel: { rotate: 30, hideOverlap: true } },
    yAxis: { type: 'category', data: yCategories },
    visualMap: { min: 0, max: maxVal || 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#e0f3f8', '#abd9e9', '#74add1', '#4575b4', '#313695'] } },
    series: [{ type: 'heatmap', data: heatData, label: { show: heatData.length <= 100, formatter: (p: { value: [number, number, number] }) => String(p.value[2]) }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }],
  };
}

/** Build boxplot chart for statistical distribution */
function buildBoxplotChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  const numericKeys = config.data.length > 0 ? Object.keys(config.data[0]).filter(k => k !== xField && typeof config.data[0][k] === 'number') : [];

  const categories = [...new Set(config.data.map(d => String(d[xField] || '')))];
  const boxData: number[][] = categories.map(cat => {
    const values = config.data.filter(d => String(d[xField]) === cat).flatMap(d => numericKeys.map(k => Number(d[k] || 0))).sort((a, b) => a - b);
    if (values.length < 5) return [0, 0, 0, 0, 0];
    const q1 = values[Math.floor(values.length * 0.25)];
    const q2 = values[Math.floor(values.length * 0.5)];
    const q3 = values[Math.floor(values.length * 0.75)];
    return [values[0], q1, q2, q3, values[values.length - 1]];
  });

  return {
    tooltip: { ...defaultTooltip('item') },
    grid: { left: '10%', right: '5%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: categories, axisLabel: { rotate: 30, hideOverlap: true } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
    series: [{ type: 'boxplot', data: boxData, itemStyle: { color: '#c4e3f3', borderColor: '#4575b4' } }],
  };
}

/** Build candlestick (K-line) chart */
function buildCandlestickChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  const allKeys = config.data.length > 0 ? Object.keys(config.data[0]).filter(k => k !== xField && typeof config.data[0][k] === 'number') : [];
  const xData = config.data.map(d => String(d[xField] || ''));
  // Candlestick: [open, close, low, high]
  const candleData = config.data.map(d => {
    const vals = allKeys.slice(0, 4).map(k => Number(d[k] || 0));
    while (vals.length < 4) vals.push(0);
    return vals;
  });

  return {
    tooltip: { ...defaultTooltip('axis'), axisPointer: { type: 'cross' } },
    grid: { left: '10%', right: '5%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: xData, axisLabel: { rotate: 30, hideOverlap: true } },
    yAxis: { type: 'value', scale: true, axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
    series: [{ type: 'candlestick', data: candleData, itemStyle: { color: '#ec0000', color0: '#00da3c', borderColor: '#ec0000', borderColor0: '#00da3c' } }],
  };
}

/** Build sankey diagram for flow/conversion visualization */
function buildSankeyChart(config: LegacyChartConfig): echarts.EChartsOption {
  const allKeys = config.data.length > 0 ? Object.keys(config.data[0]) : [];
  const sourceField = allKeys[0] || 'source';
  const targetField = allKeys[1] || 'target';
  const valueField = allKeys.find(k => typeof config.data[0]?.[k] === 'number') || allKeys[2] || 'value';

  const nodesSet = new Set<string>();
  const links = config.data.map(d => {
    const src = String(d[sourceField] || '');
    const tgt = String(d[targetField] || '');
    nodesSet.add(src);
    nodesSet.add(tgt);
    return { source: src, target: tgt, value: Number(d[valueField] || 0) };
  });

  return {
    tooltip: { ...defaultTooltip('item') },
    series: [{
      type: 'sankey',
      layout: 'none',
      emphasis: { focus: 'adjacency' },
      data: [...nodesSet].map(name => ({ name })),
      links,
      lineStyle: { color: 'gradient', curveness: 0.5 },
      label: { fontSize: 12 },
    }],
  };
}

/** Build sunburst chart for hierarchical data */
function buildSunburstChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  const yField = extractField(config as Record<string, unknown>, 'yAxisField', 'yaxisField', 'value');

  const sunburstData = config.data.map((item, i) => ({
    name: String(item[xField] || ''),
    value: Number(item[yField] || 0),
    itemStyle: { color: PIE_COLORS[i % PIE_COLORS.length] },
  }));

  return {
    tooltip: { ...defaultTooltip('item') },
    series: [{
      type: 'sunburst',
      data: sunburstData,
      radius: ['15%', '90%'],
      label: { rotate: 'radial', fontSize: 11 },
      emphasis: { focus: 'ancestor' },
      levels: [{}, { r0: '15%', r: '45%', label: { fontSize: 12 } }, { r0: '45%', r: '90%', label: { fontSize: 10 } }],
    }],
  };
}

/** Build word cloud chart */
function buildWordCloudChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  const yField = extractField(config as Record<string, unknown>, 'yAxisField', 'yaxisField', 'value');

  const wordData = config.data.map(item => ({
    name: String(item[xField] || ''),
    value: Number(item[yField] || 0),
  })).sort((a, b) => b.value - a.value).slice(0, 100);

  return {
    tooltip: { ...defaultTooltip('item') },
    series: [{
      type: 'wordCloud',
      shape: 'circle',
      sizeRange: [14, 60],
      rotationRange: [-45, 45],
      rotationStep: 15,
      gridSize: 8,
      textStyle: { fontFamily: 'sans-serif', color: () => PIE_COLORS[Math.floor(Math.random() * PIE_COLORS.length)] },
      emphasis: { textStyle: { fontWeight: 'bold' } },
      data: wordData,
    }],
  } as echarts.EChartsOption;
}

/** Build slope chart for two-period comparison */
function buildSlopeChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  const numericKeys = config.data.length > 0 ? Object.keys(config.data[0]).filter(k => k !== xField && typeof config.data[0][k] === 'number') : [];
  const period1 = numericKeys[0] || 'value1';
  const period2 = numericKeys[1] || 'value2';

  const categories = config.data.map(d => String(d[xField] || ''));
  const series: echarts.SeriesOption[] = config.data.map((d, i) => ({
    type: 'line' as const,
    name: String(d[xField] || ''),
    data: [Number(d[period1] || 0), Number(d[period2] || 0)],
    lineStyle: { width: 2, color: PIE_COLORS[i % PIE_COLORS.length] },
    itemStyle: { color: PIE_COLORS[i % PIE_COLORS.length] },
    symbol: 'circle',
    symbolSize: 8,
    label: { show: true, formatter: '{c}', fontSize: 10 },
  }));

  return {
    tooltip: { ...defaultTooltip('item') },
    legend: { data: categories, bottom: 0, type: categories.length > 5 ? 'scroll' : 'plain' },
    grid: { left: '10%', right: '10%', top: '10%', bottom: '15%', containLabel: true },
    xAxis: { type: 'category', data: [period1, period2], axisTick: { alignWithLabel: true } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
    series,
  };
}

/** Build parallel coordinates chart for multi-dimensional comparison */
function buildParallelChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  const numericKeys = config.data.length > 0 ? Object.keys(config.data[0]).filter(k => k !== xField && typeof config.data[0][k] === 'number') : [];

  const parallelAxis = numericKeys.map((key, i) => ({
    dim: i,
    name: key,
    type: 'value' as const,
  }));

  const seriesData = config.data.map((d, i) => ({
    value: numericKeys.map(k => Number(d[k] || 0)),
    name: String(d[xField] || ''),
    lineStyle: { color: PIE_COLORS[i % PIE_COLORS.length], opacity: 0.6 },
  }));

  return {
    tooltip: { ...defaultTooltip('item') },
    parallelAxis,
    parallel: { left: '5%', right: '13%', bottom: '15%', top: '10%' },
    series: [{ type: 'parallel', lineStyle: { width: 2 }, data: seriesData, smooth: true }],
  } as echarts.EChartsOption;
}

/** Build theme river chart for time-based categorical flow */
function buildThemeRiverChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  const yField = extractField(config as Record<string, unknown>, 'yAxisField', 'yaxisField', 'value');
  const allKeys = config.data.length > 0 ? Object.keys(config.data[0]) : [];
  const categoryField = allKeys.find(k => k !== xField && k !== yField && typeof config.data[0][k] === 'string') || xField;

  const riverData = config.data.map(d => [
    String(d[xField] || ''),
    Number(d[yField] || 0),
    String(d[categoryField] || ''),
  ]);

  return {
    tooltip: { ...defaultTooltip('axis'), axisPointer: { type: 'line' } },
    singleAxis: { type: 'time', bottom: '10%', top: '10%' },
    series: [{ type: 'themeRiver', data: riverData, label: { show: false }, emphasis: { itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,0.3)' } } }],
  } as echarts.EChartsOption;
}

/** Build pictorial bar chart with visual symbols */
function buildPictorialBarChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = extractField(config as Record<string, unknown>, 'xAxisField', 'xaxisField', 'name');
  const yField = extractField(config as Record<string, unknown>, 'yAxisField', 'yaxisField', 'value');
  const xData = config.data.map(d => String(d[xField] || ''));
  const yData = config.data.map(d => Number(d[yField] || 0));

  return {
    tooltip: { ...defaultTooltip('axis') },
    grid: { left: '10%', right: '5%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: xData, axisLabel: { rotate: 30, hideOverlap: true } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
    series: [{
      type: 'pictorialBar',
      symbol: 'roundRect',
      symbolRepeat: true,
      symbolSize: ['80%', 10],
      symbolMargin: 2,
      data: yData.map((v, i) => ({ value: v, itemStyle: { color: PIE_COLORS[i % PIE_COLORS.length] } })),
      label: { show: true, position: 'top', formatter: (p: { value: number }) => formatAxisValue(p.value) },
    }],
  } as echarts.EChartsOption;
}

function formatAxisValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100000000) return (value / 100000000).toFixed(1) + '亿';
  if (abs >= 10000) return (value / 10000).toFixed(0) + '万';
  if (abs >= 1000) return value.toLocaleString('zh-CN');
  return String(value);
}
</script>

<template>
  <div ref="chartRef" role="img" :aria-label="title || '数据图表'" :style="{ height: height + 'px', width: '100%' }"></div>
</template>
