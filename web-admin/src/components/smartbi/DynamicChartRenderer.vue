<script setup lang="ts">
/**
 * DynamicChartRenderer - 通用图表渲染器
 * 自动检测图表配置格式 (legacy/dynamic/dashboard) 并转换为 ECharts option
 */
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import * as echarts from 'echarts';
import type { ChartConfig, LegacyChartConfig, DynamicChartConfig, DashboardChartConfig } from '@/types/smartbi';
import { chartHasData } from '@/types/smartbi';
import { registerChinaMap, normalizeProvinceName } from '@/utils/chinaMap';

interface Props {
  config: ChartConfig;
  height?: number;
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  height: 320,
  title: undefined,
});

const chartRef = ref<HTMLDivElement | null>(null);
let chartInstance: echarts.ECharts | null = null;

const PIE_COLORS = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#00d4ff', '#ff6b6b', '#ffd93d', '#8A2BE2', '#00CED1'];

onMounted(() => {
  initChart();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  chartInstance?.dispose();
  chartInstance = null;
});

watch(() => props.config, () => {
  nextTick(() => updateChart());
}, { deep: true });

function initChart() {
  if (!chartRef.value) return;
  chartInstance = echarts.init(chartRef.value);
  updateChart();
}

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

  const option = buildOption(props.config);
  if (option) {
    chartInstance.setOption(option, true);
  }
}

function handleResize() {
  chartInstance?.resize();
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
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: {
      data: config.legend?.data || config.series.map(s => s.name),
      bottom: 0,
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: config.xAxis?.data || [],
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
            { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
            { offset: 1, color: 'rgba(64, 158, 255, 0.05)' },
          ]) }
        : undefined,
      lineStyle: { width: 3, color: PIE_COLORS[index % PIE_COLORS.length] },
      itemStyle: { color: PIE_COLORS[index % PIE_COLORS.length] },
    })),
  };
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
    tooltip: { trigger: 'item', formatter: '{b}: {c}万 ({d}%)' },
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
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: config.tooltip?.trigger || 'axis',
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
      axisLabel: axis.axisLabel || { formatter: (v: number) => formatAxisValue(v) },
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
        label: s.label,
      };
      if (s.areaStyle && s.type === 'line') {
        (item as echarts.LineSeriesOption).areaStyle = {};
      }
      return item;
    }) as echarts.SeriesOption[];
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

  // Support both camelCase (xAxisField) and lowercase (xaxisField) from API
  const xField = config.xAxisField || (config as Record<string, unknown>).xaxisField as string || 'name';
  const yField = config.yAxisField || (config as Record<string, unknown>).yaxisField as string || 'value';

  const xData = config.data.map(item => String(item[xField] || ''));
  const yData = config.data.map(item => Number(item[yField] || 0));

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: chartType === 'line' ? 'cross' : 'shadow' },
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: xData },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
    series: [{
      type: chartType as 'bar' | 'line',
      data: yData,
      smooth: chartType === 'line',
      itemStyle: { color: '#409EFF' },
    }],
  };
}

/** Build waterfall chart for budget execution */
function buildWaterfallChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = config.xAxisField || (config as Record<string, unknown>).xaxisField as string || 'name';
  const yField = config.yAxisField || (config as Record<string, unknown>).yaxisField as string || 'value';

  const xData = config.data.map(item => String(item[xField] || ''));
  const yData = config.data.map(item => Number(item[yField] || 0));

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: xData },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
    series: [{
      type: 'bar',
      data: yData.map((val, idx) => ({
        value: val,
        itemStyle: { color: idx === 0 ? '#5470c6' : '#91cc75' },
      })),
      label: { show: true, position: 'top', formatter: (p: { value: number }) => formatAxisValue(p.value) },
    }],
  };
}

/** Build budget achievement chart with bars and line */
function buildLineBudgetChart(config: LegacyChartConfig): echarts.EChartsOption {
  // For budget achievement: month, budget, actual, achievementRate
  const xData = config.data.map(item => String(item.month || ''));
  const budgetData = config.data.map(item => Number(item.budget || 0));
  const actualData = config.data.map(item => Number(item.actual || 0));
  const rateData = config.data.map(item => Number(item.achievementRate || 0));

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['预算', '实际', '达成率'], bottom: 0 },
    grid: { left: '3%', right: '8%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: xData },
    yAxis: [
      { type: 'value', name: '金额', axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
      { type: 'value', name: '达成率(%)', min: 0, max: 200, position: 'right', axisLabel: { formatter: '{value}%' } },
    ],
    series: [
      { name: '预算', type: 'bar', data: budgetData, itemStyle: { color: '#5470c6' } },
      { name: '实际', type: 'bar', data: actualData, itemStyle: { color: '#91cc75' } },
      { name: '达成率', type: 'line', yAxisIndex: 1, data: rateData, smooth: true, itemStyle: { color: '#ee6666' } },
    ],
  };
}

/** Build radar/spider chart */
function buildRadarChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = config.xAxisField || (config as Record<string, unknown>).xaxisField as string || 'name';
  const yField = config.yAxisField || (config as Record<string, unknown>).yaxisField as string || 'value';

  // Build radar indicator from data
  const indicator = config.data.map(item => ({
    name: String(item[xField] || ''),
    max: Math.max(...config.data.map(d => Number(d[yField] || 0))) * 1.2,
  }));

  const values = config.data.map(item => Number(item[yField] || 0));

  return {
    tooltip: { trigger: 'item' },
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
        areaStyle: { color: 'rgba(64, 158, 255, 0.3)' },
        lineStyle: { color: '#409EFF', width: 2 },
        itemStyle: { color: '#409EFF' },
      }],
    }],
  };
}

/** Build scatter plot chart */
function buildScatterChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = config.xAxisField || (config as Record<string, unknown>).xaxisField as string || 'x';
  const yField = config.yAxisField || (config as Record<string, unknown>).yaxisField as string || 'y';

  const scatterData = config.data.map(item => [
    Number(item[xField] || 0),
    Number(item[yField] || 0),
  ]);

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: { value: number[] }) => `(${params.value[0]}, ${params.value[1]})`,
    },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
    xAxis: { type: 'value', name: xField, axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
    yAxis: { type: 'value', name: yField, axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
    series: [{
      type: 'scatter',
      data: scatterData,
      symbolSize: 12,
      itemStyle: { color: '#409EFF' },
    }],
  };
}

/** Build area chart (line with filled area) */
function buildAreaChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = config.xAxisField || (config as Record<string, unknown>).xaxisField as string || 'name';
  const yField = config.yAxisField || (config as Record<string, unknown>).yaxisField as string || 'value';

  const xData = config.data.map(item => String(item[xField] || ''));
  const yData = config.data.map(item => Number(item[yField] || 0));

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: xData },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
    series: [{
      type: 'line',
      data: yData,
      smooth: true,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(64, 158, 255, 0.5)' },
          { offset: 1, color: 'rgba(64, 158, 255, 0.05)' },
        ]),
      },
      lineStyle: { color: '#409EFF', width: 2 },
      itemStyle: { color: '#409EFF' },
    }],
  };
}

/** Build gauge/meter chart */
function buildGaugeChart(config: LegacyChartConfig): echarts.EChartsOption {
  const yField = config.yAxisField || (config as Record<string, unknown>).yaxisField as string || 'value';
  const xField = config.xAxisField || (config as Record<string, unknown>).xaxisField as string || 'name';

  // Use first data item for gauge value
  const firstItem = config.data[0] || {};
  const value = Number(firstItem[yField] || 0);
  const name = String(firstItem[xField] || '指标');

  return {
    tooltip: { formatter: '{b}: {c}%' },
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
  const xField = config.xAxisField || (config as Record<string, unknown>).xaxisField as string || 'name';
  const yField = config.yAxisField || (config as Record<string, unknown>).yaxisField as string || 'value';

  const funnelData = config.data.map((item, index) => ({
    name: String(item[xField] || ''),
    value: Number(item[yField] || 0),
    itemStyle: { color: PIE_COLORS[index % PIE_COLORS.length] },
  }));

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
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
  const xField = config.xAxisField || (config as Record<string, unknown>).xaxisField as string || 'name';

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

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: valueKeys, bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: xData },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatAxisValue(v) } },
    series,
  };
}

/** Build doughnut chart (pie with inner radius) */
function buildDoughnutChart(config: LegacyChartConfig): echarts.EChartsOption {
  const xField = config.xAxisField || (config as Record<string, unknown>).xaxisField as string || 'name';
  const yField = config.yAxisField || (config as Record<string, unknown>).yaxisField as string || 'value';

  const pieData = config.data.map((item, index) => ({
    name: String(item[xField] || ''),
    value: Number(item[yField] || 0),
    itemStyle: { color: PIE_COLORS[index % PIE_COLORS.length] },
  }));

  // Calculate total for center label
  const total = pieData.reduce((sum, item) => sum + item.value, 0);

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', right: '5%', top: 'center' },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['40%', '50%'],
      avoidLabelOverlap: true,
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
  const xField = config.xAxisField || (config as Record<string, unknown>).xaxisField as string || 'name';
  const yField = config.yAxisField || (config as Record<string, unknown>).yaxisField as string || 'value';

  const treemapData = config.data.map((item, index) => ({
    name: String(item[xField] || ''),
    value: Number(item[yField] || 0),
    itemStyle: { color: PIE_COLORS[index % PIE_COLORS.length] },
  }));

  return {
    tooltip: {
      trigger: 'item',
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

  const xField = config.xAxisField || (config as Record<string, unknown>).xaxisField as string || 'name';
  const yField = config.yAxisField || (config as Record<string, unknown>).yaxisField as string || 'value';

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
      trigger: 'item',
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
  const xField = config.xAxisField || (config as Record<string, unknown>).xaxisField as string || 'name';
  const yField = config.yAxisField || (config as Record<string, unknown>).yaxisField as string || 'value';

  const pieData = config.data?.map((item, index) => ({
    name: String(item[xField] || ''),
    value: Number(item[yField] || 0),
    itemStyle: { color: PIE_COLORS[index % PIE_COLORS.length] },
  })) || [];

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', right: '10%', top: 'center' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['40%', '50%'],
      data: pieData,
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' },
      },
    }],
  };
}

function formatAxisValue(value: number): string {
  if (value >= 10000) return (value / 10000).toFixed(0) + '万';
  return String(value);
}
</script>

<template>
  <div ref="chartRef" :style="{ height: height + 'px', width: '100%' }"></div>
</template>
