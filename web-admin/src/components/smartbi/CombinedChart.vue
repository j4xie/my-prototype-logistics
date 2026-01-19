<script setup lang="ts">
/**
 * SmartBI CombinedChart - Bar + Line Combination Chart
 * Features: Dual Y-axis, multiple series types, mixed visualization
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import * as echarts from 'echarts';
import type { EChartsOption, ECharts } from 'echarts';

// Types
export interface CombinedDataPoint {
  category: string;
  [key: string]: string | number;
}

export interface CombinedSeries {
  name: string;
  field: string;
  type: 'bar' | 'line';
  yAxisIndex?: 0 | 1;
  color?: string;
  stack?: string;
}

interface Props {
  title?: string;
  data: CombinedDataPoint[];
  series: CombinedSeries[];
  height?: number;
  xAxisLabel?: string;
  yAxisLeftLabel?: string;
  yAxisRightLabel?: string;
  yAxisLeftUnit?: string;
  yAxisRightUnit?: string;
  showDataZoom?: boolean;
  barWidth?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: 400,
  xAxisLabel: '',
  yAxisLeftLabel: '',
  yAxisRightLabel: '',
  yAxisLeftUnit: '',
  yAxisRightUnit: '',
  showDataZoom: false,
  barWidth: '40%'
});

const emit = defineEmits<{
  (e: 'dataClick', data: { seriesName: string; dataPoint: CombinedDataPoint }): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);

// Default colors
const colorPalette = [
  '#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399',
  '#00d4ff', '#ff6b9d', '#c084fc', '#fbbf24', '#34d399'
];

// Check if we need dual Y-axis
const hasDualYAxis = computed(() => {
  return props.series.some(s => s.yAxisIndex === 1);
});

const chartOptions = computed<EChartsOption>(() => {
  const categories = props.data.map(d => d.category);

  // Build series
  const seriesData = props.series.map((s, index) => {
    const values = props.data.map(d => d[s.field] as number);
    const color = s.color || colorPalette[index % colorPalette.length];

    const baseSeries: echarts.BarSeriesOption | echarts.LineSeriesOption = {
      name: s.name,
      type: s.type,
      yAxisIndex: s.yAxisIndex || 0,
      data: values,
      itemStyle: {
        color: color
      }
    };

    if (s.type === 'bar') {
      return {
        ...baseSeries,
        barWidth: props.barWidth,
        stack: s.stack,
        itemStyle: {
          color: color,
          borderRadius: s.stack ? 0 : [4, 4, 0, 0]
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          }
        }
      } as echarts.BarSeriesOption;
    }

    return {
      ...baseSeries,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: {
        width: 2
      },
      emphasis: {
        focus: 'series'
      }
    } as echarts.LineSeriesOption;
  });

  const options: EChartsOption = {
    tooltip: {
      trigger: 'axis',
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
          const unit = series?.yAxisIndex === 1 ? props.yAxisRightUnit : props.yAxisLeftUnit;
          html += `
            <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: ${series?.type === 'line' ? '50%' : '2px'}; background: ${param.color};"></span>
              <span>${param.seriesName}: </span>
              <span style="font-weight: 600;">${param.value}${unit}</span>
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
      }
    },
    grid: {
      top: 30,
      right: hasDualYAxis.value ? 60 : 20,
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
      ...(hasDualYAxis.value
        ? [
            {
              type: 'value' as const,
              name: props.yAxisRightLabel
                ? `${props.yAxisRightLabel}${props.yAxisRightUnit ? ` (${props.yAxisRightUnit})` : ''}`
                : '',
              nameLocation: 'middle' as const,
              nameGap: 45,
              nameTextStyle: {
                color: '#909399'
              },
              splitLine: {
                show: false
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
  chartInstance.value?.resize();
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
  <div class="combined-chart">
    <div v-if="title" class="chart-header">
      <h3>{{ title }}</h3>
    </div>
    <div ref="chartRef" :style="{ width: '100%', height: height + 'px' }"></div>
  </div>
</template>

<style lang="scss" scoped>
.combined-chart {
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
