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
  showLabel: true
});

const emit = defineEmits<{
  (e: 'cellClick', data: HeatmapDataPoint): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);
let resizeObserver: ResizeObserver | null = null;
let rafId = 0;

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

const chartOptions = computed<EChartsOption>(() => {
  const options: EChartsOption = {
    tooltip: {
      trigger: 'item',
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
        return `
          <div style="font-weight: 600;">${props.valueLabel}</div>
          <div style="margin-top: 4px;">
            <div>${props.xAxisLabel || 'X'}: ${xName}</div>
            <div>${props.yAxisLabel || 'Y'}: ${yName}</div>
            <div style="margin-top: 4px; font-weight: 600; color: ${data.color};">
              ${value}${props.valueUnit}
            </div>
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
        color: [props.minColor, props.maxColor]
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
          color: '#303133',
          fontSize: 11,
          formatter: (params) => {
            const value = (params.value as [number, number, number])[2];
            return `${value}`;
          }
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
        }
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
