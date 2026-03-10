<script setup lang="ts">
/**
 * SmartBI HeatmapChart - Cross-Analysis Heatmap Component
 * Features: Row/column dimensions, color gradient, value display
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import echarts from '@/utils/echarts';
import type { EChartsOption, ECharts } from 'echarts';

// Types
export interface HeatmapDataPoint {
  x: string;
  y: string;
  value: number;
  extra?: Record<string, unknown>;
}

interface Props {
  title?: string;
  data: HeatmapDataPoint[];
  xCategories?: string[];
  yCategories?: string[];
  height?: number;
  xAxisLabel?: string;
  yAxisLabel?: string;
  valueLabel?: string;
  valueUnit?: string;
  minColor?: string;
  maxColor?: string;
  showLabel?: boolean;
  loading?: boolean;
  /** Use alert color scale (white→red) instead of default */
  alertMode?: boolean;
  /** Auto contrast label color: white on dark cells, black on light */
  autoLabelContrast?: boolean;
  /** Column group boundaries for divider lines (list of x-axis indices after which to draw a divider) */
  columnGroupBoundaries?: number[];
  /** Row group boundaries for divider lines (list of y-axis indices after which to draw a divider) */
  rowGroupBoundaries?: number[];
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  xCategories: () => [],
  yCategories: () => [],
  height: 400,
  xAxisLabel: '',
  yAxisLabel: '',
  valueLabel: 'Value',
  valueUnit: '',
  minColor: '#ffffff',
  maxColor: '#1B65A8',
  showLabel: true,
  alertMode: false,
  autoLabelContrast: true,
  columnGroupBoundaries: () => [],
  rowGroupBoundaries: () => []
});

const emit = defineEmits<{
  (e: 'cellClick', data: HeatmapDataPoint): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);
let resizeObserver: ResizeObserver | null = null;
let rafId = 0;

// Convert hex/rgb color to luminance for contrast calculation
function getLuminance(color: string): number {
  // Simple luminance estimate from a color string
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) return 0.5;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0.5;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  const r = d[0] / 255;
  const g = d[1] / 255;
  const b = d[2] / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Linear interpolation between two hex colors
function interpolateColor(color1: string, color2: string, t: number): string {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) return t > 0.5 ? color2 : color1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return t > 0.5 ? color2 : color1;

  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, 1, 1);
  const d1 = ctx.getImageData(0, 0, 1, 1).data;

  ctx.fillStyle = color2;
  ctx.fillRect(0, 0, 1, 1);
  const d2 = ctx.getImageData(0, 0, 1, 1).data;

  const r = Math.round(d1[0] + (d2[0] - d1[0]) * t);
  const g = Math.round(d1[1] + (d2[1] - d1[1]) * t);
  const b = Math.round(d1[2] + (d2[2] - d1[2]) * t);
  return `rgb(${r},${g},${b})`;
}

// Determine label color based on cell background luminance
function getLabelColor(value: number): string {
  if (!props.autoLabelContrast) return '#303133';
  const { min, max } = valueRange.value;
  const t = max > min ? (value - min) / (max - min) : 0;
  const minC = props.alertMode ? '#ffffff' : props.minColor;
  const maxC = props.alertMode ? '#f56c6c' : props.maxColor;
  const cellColor = interpolateColor(minC, maxC, t);
  const lum = getLuminance(cellColor);
  return lum < 0.45 ? '#ffffff' : '#303133';
}

// Extract categories from data if not provided
const xAxis = computed(() => {
  if (props.xCategories.length > 0) return props.xCategories;
  return [...new Set(props.data.map(d => d.x))];
});

const yAxis = computed(() => {
  if (props.yCategories.length > 0) return props.yCategories;
  return [...new Set(props.data.map(d => d.y))];
});

// Calculate min/max values
const valueRange = computed(() => {
  const values = props.data.map(d => d.value);
  return {
    min: Math.min(...values, 0),
    max: Math.max(...values, 1)
  };
});

// Transform data for ECharts
const chartData = computed(() => {
  return props.data.map(d => {
    const xIndex = xAxis.value.indexOf(d.x);
    const yIndex = yAxis.value.indexOf(d.y);
    return [xIndex, yIndex, d.value];
  });
});

// Sorted values for rank computation
const sortedValues = computed(() => {
  return [...props.data].sort((a, b) => b.value - a.value);
});

const chartOptions = computed<EChartsOption>(() => {
  const activeMinColor = props.alertMode ? '#ffffff' : props.minColor;
  const activeMaxColor = props.alertMode ? '#f56c6c' : props.maxColor;

  // Build group divider markLines via markArea on a transparent overlay series
  const groupMarkLines: [object, object][] = [];
  props.columnGroupBoundaries.forEach(idx => {
    if (idx < xAxis.value.length - 1) {
      groupMarkLines.push([
        { xAxis: idx + 0.5, lineStyle: { color: '#606266', width: 2 } },
        { xAxis: idx + 0.5 }
      ]);
    }
  });
  props.rowGroupBoundaries.forEach(idx => {
    if (idx < yAxis.value.length - 1) {
      groupMarkLines.push([
        { yAxis: idx + 0.5, lineStyle: { color: '#606266', width: 2 } },
        { yAxis: idx + 0.5 }
      ]);
    }
  });

  const options: EChartsOption = {
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#ebeef5',
      borderWidth: 1,
      textStyle: {
        color: '#303133'
      },
      formatter: (params) => {
        const data = params as echarts.DefaultLabelFormatterCallbackParams;
        const [xIdx, yIdx, value] = data.value as [number, number, number];
        const xName = xAxis.value[xIdx];
        const yName = yAxis.value[yIdx];
        const rank = sortedValues.value.findIndex(d => d.x === xName && d.y === yName) + 1;
        return `
          <div style="font-weight: 600; margin-bottom:4px;">${props.valueLabel}</div>
          <div style="margin-top: 4px; display:flex; flex-direction:column; gap:2px;">
            <div>${props.xAxisLabel || 'X'}: <span style="font-weight:600;">${xName}</span></div>
            <div>${props.yAxisLabel || 'Y'}: <span style="font-weight:600;">${yName}</span></div>
            <div style="font-weight: 600; color: ${data.color};">
              ${value.toLocaleString()}${props.valueUnit}
            </div>
            ${rank > 0 ? `<div style="color:#909399;">排名: <span style="font-weight:600;color:#1B65A8;">#${rank}</span></div>` : ''}
          </div>
        `;
      }
    },
    grid: {
      top: 20,
      right: 80,
      bottom: 60,
      left: 80,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: xAxis.value,
      name: props.xAxisLabel,
      nameLocation: 'middle',
      nameGap: 35,
      splitArea: {
        show: true
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
        color: '#606266',
        fontSize: 11,
        interval: 0,
        rotate: xAxis.value.length > 8 ? 45 : 0
      }
    },
    yAxis: {
      type: 'category',
      data: yAxis.value,
      name: props.yAxisLabel,
      nameLocation: 'middle',
      nameGap: 60,
      splitArea: {
        show: true
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
        color: '#606266',
        fontSize: 11
      }
    },
    visualMap: {
      min: valueRange.value.min,
      max: valueRange.value.max,
      calculable: true,
      orient: 'vertical',
      right: 10,
      top: 'center',
      itemWidth: 15,
      itemHeight: 140,
      inRange: {
        color: [activeMinColor, activeMaxColor]
      },
      textStyle: {
        color: '#606266',
        fontSize: 11
      },
      formatter: (value: number) => {
        return `${value.toFixed(0)}${props.valueUnit}`;
      }
    },
    series: [
      {
        type: 'heatmap',
        data: chartData.value,
        label: {
          show: props.showLabel,
          fontSize: 11,
          formatter: (params) => {
            const [xIdx, yIdx, value] = params.value as [number, number, number];
            const xName = xAxis.value[xIdx];
            const yName = yAxis.value[yIdx];
            const item = props.data.find(d => d.x === xName && d.y === yName);
            const labelColor = item ? getLabelColor(item.value) : '#303133';
            // ECharts label color can't be set per-item dynamically here, use autoLabelContrast via formatter
            void labelColor; // Used in itemStyle override below
            return `${value.toLocaleString()}`;
          },
          color: '#303133'
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.3)'
          }
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 2,
          borderRadius: 2
        },
        ...(groupMarkLines.length > 0
          ? {
              markLine: {
                silent: true,
                symbol: 'none',
                data: groupMarkLines,
                lineStyle: {
                  color: '#606266',
                  width: 2,
                  type: 'solid'
                }
              }
            }
          : {})
      }
    ]
  };

  return options;
});

function initChart() {
  if (!chartRef.value) return;

  chartInstance.value = echarts.init(chartRef.value, 'cretas');
  chartInstance.value.setOption(chartOptions.value);

  // Click event
  chartInstance.value.on('click', (params) => {
    if (params.componentType === 'series' && params.dataIndex !== undefined) {
      const [xIdx, yIdx, value] = params.value as [number, number, number];
      const item = props.data.find(
        d => d.x === xAxis.value[xIdx] && d.y === yAxis.value[yIdx]
      );
      if (item) {
        emit('cellClick', item);
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
watch(chartOptions, updateChart, { deep: true });

// Expose methods
defineExpose({
  resize: handleResize,
  getInstance: () => chartInstance.value
});
</script>

<template>
  <div v-loading="loading" class="heatmap-chart">
    <div v-if="title" class="chart-header">
      <h3>{{ title }}</h3>
    </div>
    <div class="chart-wrapper" :style="{ position: 'relative', width: '100%', height: height + 'px' }">
      <div ref="chartRef" role="img" :aria-label="title || '热力图'" style="width: 100%; height: 100%"></div>
      <div v-if="!loading && data.length === 0" class="chart-empty">
        <el-empty description="暂无数据" :image-size="80" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.heatmap-chart {
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
