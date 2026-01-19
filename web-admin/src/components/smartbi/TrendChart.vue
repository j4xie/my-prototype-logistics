<script setup lang="ts">
/**
 * SmartBI TrendChart - Trend Line/Area Chart Component
 * Features: Time granularity switch, multi-series comparison, target line
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import * as echarts from 'echarts';
import type { EChartsOption, ECharts } from 'echarts';

// Types
export interface TrendDataPoint {
  date: string;
  value: number;
  [key: string]: string | number;
}

export interface TrendSeries {
  name: string;
  data: TrendDataPoint[];
  color?: string;
  type?: 'line' | 'area';
}

interface Props {
  title?: string;
  series: TrendSeries[];
  height?: number;
  showTarget?: boolean;
  targetValue?: number;
  targetLabel?: string;
  showGranularity?: boolean;
  defaultGranularity?: 'day' | 'week' | 'month';
  xAxisLabel?: string;
  yAxisLabel?: string;
  yAxisUnit?: string;
  smooth?: boolean;
  showDataZoom?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: 400,
  showTarget: false,
  targetValue: 0,
  targetLabel: 'Target',
  showGranularity: true,
  defaultGranularity: 'day',
  xAxisLabel: '',
  yAxisLabel: '',
  yAxisUnit: '',
  smooth: true,
  showDataZoom: false
});

const emit = defineEmits<{
  (e: 'granularityChange', value: 'day' | 'week' | 'month'): void;
  (e: 'pointClick', data: { seriesName: string; dataPoint: TrendDataPoint }): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);
const granularity = ref<'day' | 'week' | 'month'>(props.defaultGranularity);

// Default color palette
const colorPalette = [
  '#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399',
  '#00d4ff', '#ff6b9d', '#c084fc', '#fbbf24', '#34d399'
];

const chartOptions = computed<EChartsOption>(() => {
  // Extract all unique dates
  const allDates = [...new Set(
    props.series.flatMap(s => s.data.map(d => d.date))
  )].sort();

  // Build series data
  const seriesData = props.series.map((s, index) => {
    const seriesType = s.type || 'line';
    const dataMap = new Map(s.data.map(d => [d.date, d.value]));
    const values = allDates.map(date => dataMap.get(date) ?? null);

    const baseConfig: echarts.LineSeriesOption = {
      name: s.name,
      type: 'line',
      data: values,
      smooth: props.smooth,
      itemStyle: {
        color: s.color || colorPalette[index % colorPalette.length]
      },
      lineStyle: {
        width: 2
      },
      symbol: 'circle',
      symbolSize: 6,
      emphasis: {
        focus: 'series',
        itemStyle: {
          borderWidth: 2
        }
      }
    };

    if (seriesType === 'area') {
      return {
        ...baseConfig,
        areaStyle: {
          opacity: 0.3
        }
      };
    }

    return baseConfig;
  });

  // Add target line if enabled
  if (props.showTarget && props.targetValue) {
    seriesData.push({
      name: props.targetLabel,
      type: 'line',
      data: allDates.map(() => props.targetValue),
      lineStyle: {
        type: 'dashed',
        width: 2,
        color: '#f56c6c'
      },
      itemStyle: {
        color: '#f56c6c'
      },
      symbol: 'none',
      emphasis: {
        disabled: true
      }
    } as echarts.LineSeriesOption);
  }

  const options: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#ebeef5',
      borderWidth: 1,
      textStyle: {
        color: '#303133'
      },
      formatter: (params) => {
        if (!Array.isArray(params)) return '';
        const date = params[0]?.axisValue || '';
        let html = `<div style="font-weight: 600; margin-bottom: 8px;">${date}</div>`;
        params.forEach((param) => {
          if (param.value !== null && param.value !== undefined) {
            html += `
              <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${param.color};"></span>
                <span>${param.seriesName}: </span>
                <span style="font-weight: 600;">${param.value}${props.yAxisUnit}</span>
              </div>
            `;
          }
        });
        return html;
      }
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: {
        color: '#606266',
        fontSize: 12
      }
    },
    grid: {
      top: 20,
      right: 20,
      bottom: props.showDataZoom ? 80 : 50,
      left: 60,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: allDates,
      name: props.xAxisLabel,
      nameLocation: 'middle',
      nameGap: 30,
      boundaryGap: false,
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
        fontSize: 11
      }
    },
    yAxis: {
      type: 'value',
      name: props.yAxisLabel ? `${props.yAxisLabel}${props.yAxisUnit ? ` (${props.yAxisUnit})` : ''}` : '',
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
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#909399',
        fontSize: 11
      }
    },
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
          color: '#409eff'
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

  chartInstance.value = echarts.init(chartRef.value);
  chartInstance.value.setOption(chartOptions.value);

  // Click event
  chartInstance.value.on('click', (params) => {
    if (params.componentType === 'series' && params.dataIndex !== undefined) {
      const series = props.series.find(s => s.name === params.seriesName);
      if (series) {
        emit('pointClick', {
          seriesName: params.seriesName as string,
          dataPoint: series.data[params.dataIndex]
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
  chartInstance.value?.resize();
}

function onGranularityChange(value: 'day' | 'week' | 'month') {
  emit('granularityChange', value);
}

// Lifecycle
onMounted(() => {
  initChart();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  chartInstance.value?.dispose();
});

// Watch for data changes
watch(() => props.series, updateChart, { deep: true });
watch(chartOptions, updateChart, { deep: true });

// Expose methods
defineExpose({
  resize: handleResize,
  getInstance: () => chartInstance.value
});
</script>

<template>
  <div class="trend-chart">
    <div v-if="title || showGranularity" class="chart-header">
      <h3 v-if="title">{{ title }}</h3>
      <el-radio-group
        v-if="showGranularity"
        v-model="granularity"
        size="small"
        @change="onGranularityChange"
      >
        <el-radio-button label="day">Day</el-radio-button>
        <el-radio-button label="week">Week</el-radio-button>
        <el-radio-button label="month">Month</el-radio-button>
      </el-radio-group>
    </div>
    <div ref="chartRef" :style="{ width: '100%', height: height + 'px' }"></div>
  </div>
</template>

<style lang="scss" scoped>
.trend-chart {
  width: 100%;

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
