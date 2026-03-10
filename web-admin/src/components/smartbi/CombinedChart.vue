<script setup lang="ts">
/**
 * SmartBI CombinedChart - Bar + Line Combination Chart
 * Features: Dual Y-axis, multiple series types, mixed visualization
 * Enhanced: markArea (background regions), markPoint (data annotations), grouped bar mode
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import echarts from '@/utils/echarts';
import type { EChartsOption, ECharts } from 'echarts';

// Types
export interface CombinedDataPoint {
  category: string;
  [key: string]: string | number;
}

export interface CombinedSeries {
  name: string;
  field: string;
  type: 'bar' | 'line' | 'scatter' | 'area';
  yAxisIndex?: 0 | 1 | 2;
  color?: string;
  stack?: string;
  /** Apply markArea to this series (default: first bar series) */
  hasMarkArea?: boolean;
  /** Apply markPoints to this series (default: first series) */
  hasMarkPoint?: boolean;
}

/** Background region for markArea */
export interface MarkAreaItem {
  /** Start x-axis value */
  startX: string;
  /** End x-axis value */
  endX: string;
  /** Background color (default: rgba(144,238,144,0.1)) */
  color?: string;
  /** Optional label for the area */
  label?: string;
}

/** Data annotation point for markPoint */
export interface MarkPointItem {
  /** Display value (e.g., '+12%', 'Max') */
  value: string;
  /** Coordinate [xAxisValue, yAxisValue] */
  coord: [string, number];
  /** Symbol type (default: 'pin') */
  symbol?: 'circle' | 'rect' | 'roundRect' | 'triangle' | 'diamond' | 'pin' | 'arrow' | 'none';
  /** Symbol size (default: 50) */
  symbolSize?: number;
  /** Custom color */
  color?: string;
  /** Label position (default: 'top') */
  labelPosition?: 'top' | 'bottom' | 'left' | 'right' | 'inside';
}

interface Props {
  title?: string;
  data: CombinedDataPoint[];
  series: CombinedSeries[];
  height?: number;
  xAxisLabel?: string;
  yAxisLeftLabel?: string;
  yAxisRightLabel?: string;
  /** Label for far-right (third) Y-axis */
  yAxisFarRightLabel?: string;
  yAxisLeftUnit?: string;
  yAxisRightUnit?: string;
  /** Unit for far-right (third) Y-axis */
  yAxisFarRightUnit?: string;
  showDataZoom?: boolean;
  barWidth?: string;
  /** Background regions for highlighting (e.g., quarters) */
  markAreas?: MarkAreaItem[];
  /** Data annotation points (e.g., YoY changes) */
  markPoints?: MarkPointItem[];
  /** Use grouped bar mode (barGap: 0) for target vs actual comparison */
  grouped?: boolean;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: 400,
  xAxisLabel: '',
  yAxisLeftLabel: '',
  yAxisRightLabel: '',
  yAxisFarRightLabel: '',
  yAxisLeftUnit: '',
  yAxisRightUnit: '',
  yAxisFarRightUnit: '',
  showDataZoom: false,
  barWidth: '40%',
  markAreas: () => [],
  markPoints: () => [],
  grouped: false
});

const emit = defineEmits<{
  (e: 'dataClick', data: { seriesName: string; dataPoint: CombinedDataPoint }): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);
let resizeObserver: ResizeObserver | null = null;
let rafId = 0;

// Default colors
const colorPalette = [
  '#1B65A8', '#67c23a', '#e6a23c', '#f56c6c', '#909399',
  '#00d4ff', '#ff6b9d', '#c084fc', '#fbbf24', '#34d399'
];

// Check if we need dual Y-axis
const hasDualYAxis = computed(() => {
  return props.series.some(s => s.yAxisIndex === 1);
});

// Check if we need triple Y-axis
const hasTripleYAxis = computed(() => {
  return props.series.some(s => s.yAxisIndex === 2);
});

// Unit auto-detection helper
function formatAxisValue(value: number, unit: string): string {
  if (unit === '万' && value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return `${value}${unit}`;
}

// Build markArea data from props
const buildMarkAreaData = () => {
  if (!props.markAreas || props.markAreas.length === 0) return undefined;

  return {
    silent: true,
    data: props.markAreas.map(area => [
      {
        xAxis: area.startX,
        itemStyle: { color: area.color || 'rgba(144,238,144,0.1)' },
        ...(area.label ? { label: { show: true, position: 'insideTop', formatter: area.label } } : {})
      },
      { xAxis: area.endX }
    ])
  };
};

// Build markPoint data from props
const buildMarkPointData = () => {
  if (!props.markPoints || props.markPoints.length === 0) return undefined;

  return {
    symbol: 'pin',
    symbolSize: 50,
    label: {
      show: true,
      position: 'top',
      formatter: (params: { data: { value: string } }) => params.data.value,
      fontSize: 12,
      fontWeight: 'bold',
      color: '#fff'
    },
    data: props.markPoints.map(point => ({
      value: point.value,
      coord: point.coord,
      symbol: point.symbol || 'pin',
      symbolSize: point.symbolSize || 50,
      itemStyle: point.color ? { color: point.color } : undefined,
      label: {
        position: point.labelPosition || 'top'
      }
    }))
  };
};

const chartOptions = computed<EChartsOption>(() => {
  const categories = props.data.map(d => d.category);
  const markAreaConfig = buildMarkAreaData();
  const markPointConfig = buildMarkPointData();

  // Find first bar series index for default markArea assignment
  const firstBarSeriesIndex = props.series.findIndex(s => s.type === 'bar');
  // Find series with explicit markArea/markPoint flags
  const markAreaSeriesIndex = props.series.findIndex(s => s.hasMarkArea);
  const markPointSeriesIndex = props.series.findIndex(s => s.hasMarkPoint);

  // Build series
  const seriesData = props.series.map((s, index) => {
    const values = props.data.map(d => d[s.field] as number);
    const color = s.color || colorPalette[index % colorPalette.length];

    // Determine if this series should have markArea
    const shouldHaveMarkArea = markAreaConfig && (
      s.hasMarkArea ||
      (markAreaSeriesIndex === -1 && index === (firstBarSeriesIndex >= 0 ? firstBarSeriesIndex : 0))
    );

    // Determine if this series should have markPoint
    const shouldHaveMarkPoint = markPointConfig && (
      s.hasMarkPoint ||
      (markPointSeriesIndex === -1 && index === 0)
    );

    if (s.type === 'bar') {
      return {
        name: s.name,
        type: 'bar',
        yAxisIndex: s.yAxisIndex || 0,
        data: values,
        barWidth: props.grouped ? undefined : props.barWidth,
        barGap: props.grouped ? '0%' : undefined,
        stack: s.stack,
        itemStyle: {
          color: color,
          borderRadius: s.stack ? 0 : [4, 4, 0, 0]
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          }
        },
        ...(shouldHaveMarkArea ? { markArea: markAreaConfig } : {}),
        ...(shouldHaveMarkPoint ? { markPoint: markPointConfig } : {})
      } as echarts.BarSeriesOption;
    }

    if (s.type === 'scatter') {
      return {
        name: s.name,
        type: 'scatter',
        yAxisIndex: s.yAxisIndex || 0,
        data: values,
        itemStyle: { color },
        symbolSize: 10,
        emphasis: { focus: 'series', scale: true }
      } as echarts.ScatterSeriesOption;
    }

    // line or area
    const isArea = s.type === 'area';
    return {
      name: s.name,
      type: 'line',
      yAxisIndex: s.yAxisIndex || 0,
      data: values,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2, color },
      itemStyle: { color },
      areaStyle: isArea ? { color, opacity: 0.15 } : undefined,
      emphasis: { focus: 'series' },
      ...(shouldHaveMarkArea ? { markArea: markAreaConfig } : {}),
      ...(shouldHaveMarkPoint ? { markPoint: markPointConfig } : {})
    } as echarts.LineSeriesOption;
  });

  const options: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: {
        type: 'cross',
        crossStyle: {
          color: '#999'
        }
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#ebeef5',
      borderWidth: 1,
      textStyle: {
        color: '#303133'
      },
      formatter: (params) => {
        if (!Array.isArray(params)) return '';
        const category = params[0]?.axisValue || '';
        let html = `<div style="font-weight: 600; margin-bottom: 8px;">${category}</div>`;

        params.forEach((param) => {
          const series = props.series.find(s => s.name === param.seriesName);
          const unit = series?.yAxisIndex === 2
            ? props.yAxisFarRightUnit
            : series?.yAxisIndex === 1
              ? props.yAxisRightUnit
              : props.yAxisLeftUnit;
          const isLine = series?.type === 'line' || series?.type === 'area';
          html += `
            <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: ${isLine ? '50%' : '2px'}; background: ${param.color};"></span>
              <span>${param.seriesName}: </span>
              <span style="font-weight: 600;">${typeof param.value === 'number' ? (param.value as number).toLocaleString() : param.value}${unit}</span>
            </div>
          `;
        });

        return html;
      }
    },
    legend: {
      bottom: 0,
      icon: 'rect',
      itemWidth: 14,
      itemHeight: 8,
      textStyle: {
        color: '#606266',
        fontSize: 12
      },
      selectedMode: true
    },
    grid: {
      top: 30,
      right: hasTripleYAxis.value ? 110 : (hasDualYAxis.value ? 60 : 20),
      bottom: props.showDataZoom ? 80 : 50,
      left: 60,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: categories,
      name: props.xAxisLabel,
      nameLocation: 'middle',
      nameGap: 35,
      axisPointer: {
        type: 'shadow'
      },
      axisLine: {
        lineStyle: {
          color: '#dcdfe6'
        }
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#909399',
        fontSize: 11,
        interval: 0,
        rotate: categories.length > 8 ? 45 : 0
      }
    },
    yAxis: [
      {
        type: 'value',
        name: props.yAxisLeftLabel
          ? `${props.yAxisLeftLabel}${props.yAxisLeftUnit ? ` (${props.yAxisLeftUnit})` : ''}`
          : '',
        nameLocation: 'middle',
        nameGap: 45,
        nameTextStyle: {
          color: '#909399'
        },
        splitLine: {
          lineStyle: {
            color: '#ebeef5',
            type: 'dashed'
          }
        },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#909399',
          fontSize: 11,
          formatter: (value: number) => formatAxisValue(value, props.yAxisLeftUnit)
        }
      },
      ...(hasDualYAxis.value
        ? [
            {
              type: 'value' as const,
              name: props.yAxisRightLabel
                ? `${props.yAxisRightLabel}${props.yAxisRightUnit ? ` (${props.yAxisRightUnit})` : ''}`
                : '',
              nameLocation: 'middle' as const,
              nameGap: 45,
              nameTextStyle: { color: '#909399' },
              splitLine: { show: false },
              axisLine: { show: false },
              axisTick: { show: false },
              axisLabel: {
                color: '#909399',
                fontSize: 11,
                formatter: (value: number) => formatAxisValue(value, props.yAxisRightUnit)
              }
            }
          ]
        : []),
      ...(hasTripleYAxis.value
        ? [
            {
              type: 'value' as const,
              name: props.yAxisFarRightLabel
                ? `${props.yAxisFarRightLabel}${props.yAxisFarRightUnit ? ` (${props.yAxisFarRightUnit})` : ''}`
                : '',
              nameLocation: 'middle' as const,
              nameGap: 45,
              nameTextStyle: { color: '#909399' },
              position: 'right' as const,
              offset: 60,
              splitLine: { show: false },
              axisLine: { show: false },
              axisTick: { show: false },
              axisLabel: {
                color: '#909399',
                fontSize: 11,
                formatter: (value: number) => formatAxisValue(value, props.yAxisFarRightUnit)
              }
            }
          ]
        : [])
    ],
    series: seriesData
  };

  // Add data zoom if enabled
  if (props.showDataZoom) {
    options.dataZoom = [
      {
        type: 'slider',
        show: true,
        xAxisIndex: 0,
        start: 0,
        end: 100,
        bottom: 30,
        height: 20,
        borderColor: '#dcdfe6',
        fillerColor: 'rgba(64, 158, 255, 0.2)',
        handleStyle: {
          color: '#1B65A8'
        }
      },
      {
        type: 'inside',
        xAxisIndex: 0
      }
    ];
  }

  return options;
});

function initChart() {
  if (!chartRef.value) return;

  chartInstance.value = echarts.init(chartRef.value, 'cretas');
  chartInstance.value.setOption(chartOptions.value);

  // Click event
  chartInstance.value.on('click', (params) => {
    if (params.componentType === 'series' && params.dataIndex !== undefined) {
      const dataPoint = props.data[params.dataIndex as number];
      if (dataPoint) {
        emit('dataClick', {
          seriesName: params.seriesName as string,
          dataPoint
        });
      }
    }
  });
}

function updateChart() {
  if (chartInstance.value) {
    chartInstance.value.setOption(chartOptions.value, true);
  }
}

function handleResize() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    chartInstance.value?.resize();
  });
}

// Lifecycle
onMounted(() => {
  initChart();
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
  chartInstance.value?.dispose();
});

// Watch for data changes
watch(() => props.data, updateChart, { deep: true });
watch(() => props.series, updateChart, { deep: true });
watch(chartOptions, updateChart, { deep: true });

// Expose methods
defineExpose({
  resize: handleResize,
  getInstance: () => chartInstance.value
});
</script>

<template>
  <div v-loading="loading" class="combined-chart">
    <div v-if="title" class="chart-header">
      <h3>{{ title }}</h3>
    </div>
    <div class="chart-wrapper" :style="{ position: 'relative', width: '100%', height: height + 'px' }">
      <div ref="chartRef" role="img" :aria-label="title || '组合图表'" style="width: 100%; height: 100%"></div>
      <div v-if="!loading && data.length === 0" class="chart-empty">
        <el-empty description="暂无数据" :image-size="80" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.combined-chart {
  width: 100%;

  .chart-empty {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 0 4px;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }
  }
}
</style>
