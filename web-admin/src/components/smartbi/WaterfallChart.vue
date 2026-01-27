<script setup lang="ts">
/**
 * SmartBI WaterfallChart - Waterfall/Bridge Chart
 * Features: Income/expense visualization, cumulative totals, cash flow analysis
 * Backend template: cashflow_waterfall
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import * as echarts from 'echarts';
import type { EChartsOption, ECharts } from 'echarts';

// Types
export interface WaterfallDataPoint {
  category: string;
  value: number;
  type: 'increase' | 'decrease' | 'total';
}

export interface WaterfallColors {
  increase: string;
  decrease: string;
  total: string;
}

interface Props {
  title?: string;
  data: WaterfallDataPoint[];
  height?: number;
  colors?: WaterfallColors;
  showDataLabels?: boolean;
  valueUnit?: string;
  showLegend?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: 400,
  colors: () => ({
    increase: '#ee6666',  // Red for income/increase
    decrease: '#91cc75',  // Green for cost/decrease
    total: '#5470c6'      // Blue for totals
  }),
  showDataLabels: true,
  valueUnit: '',
  showLegend: true
});

const emit = defineEmits<{
  (e: 'dataClick', data: { dataPoint: WaterfallDataPoint; index: number }): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);

/**
 * Calculate waterfall chart data
 * Returns helper series (transparent base) and data series (actual bars)
 */
const waterfallData = computed(() => {
  const helperData: (number | string)[] = [];
  const valueData: number[] = [];
  const colorData: string[] = [];

  let cumulative = 0;

  props.data.forEach((item, index) => {
    if (item.type === 'total') {
      // Total bar starts from 0
      helperData.push(0);
      valueData.push(item.value);
      colorData.push(props.colors.total);
      cumulative = item.value;
    } else if (item.type === 'increase') {
      // Increase: bar starts from current cumulative
      helperData.push(cumulative);
      valueData.push(item.value);
      colorData.push(props.colors.increase);
      cumulative += item.value;
    } else {
      // Decrease: bar starts from (cumulative - absolute value)
      const absValue = Math.abs(item.value);
      cumulative -= absValue;
      helperData.push(cumulative);
      valueData.push(absValue);
      colorData.push(props.colors.decrease);
    }
  });

  return { helperData, valueData, colorData };
});

const chartOptions = computed<EChartsOption>(() => {
  const categories = props.data.map(d => d.category);
  const { helperData, valueData, colorData } = waterfallData.value;

  const options: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#ebeef5',
      borderWidth: 1,
      textStyle: {
        color: '#303133'
      },
      formatter: (params) => {
        if (!Array.isArray(params)) return '';
        // Only show actual data series (index 1)
        const param = params.find(p => p.seriesIndex === 1);
        if (!param) return '';

        const dataIndex = param.dataIndex as number;
        const dataPoint = props.data[dataIndex];
        if (!dataPoint) return '';

        const typeLabel = {
          increase: '增加',
          decrease: '减少',
          total: '合计'
        }[dataPoint.type];

        const color = colorData[dataIndex];
        const displayValue = dataPoint.type === 'decrease'
          ? `-${Math.abs(dataPoint.value)}`
          : dataPoint.value;

        return `
          <div style="font-weight: 600; margin-bottom: 8px;">${dataPoint.category}</div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${color};"></span>
            <span>${typeLabel}: </span>
            <span style="font-weight: 600;">${displayValue}${props.valueUnit}</span>
          </div>
        `;
      }
    },
    grid: {
      top: 40,
      right: 20,
      bottom: props.showLegend ? 60 : 30,
      left: 60,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: categories,
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
        rotate: categories.length > 6 ? 30 : 0
      }
    },
    yAxis: {
      type: 'value',
      name: props.valueUnit ? `(${props.valueUnit})` : '',
      nameTextStyle: {
        color: '#909399',
        fontSize: 11
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
    series: [
      // Helper series (transparent base)
      {
        name: 'helper',
        type: 'bar',
        stack: 'waterfall',
        itemStyle: {
          color: 'transparent',
          borderColor: 'transparent'
        },
        emphasis: {
          itemStyle: {
            color: 'transparent',
            borderColor: 'transparent'
          }
        },
        data: helperData
      },
      // Data series (actual visible bars)
      {
        name: 'value',
        type: 'bar',
        stack: 'waterfall',
        barWidth: '50%',
        label: props.showDataLabels ? {
          show: true,
          position: 'top',
          formatter: (params) => {
            const dataIndex = params.dataIndex as number;
            const dataPoint = props.data[dataIndex];
            if (!dataPoint) return '';

            if (dataPoint.type === 'decrease') {
              return `-${Math.abs(dataPoint.value)}`;
            }
            return String(dataPoint.value);
          },
          color: '#606266',
          fontSize: 11,
          fontWeight: 500
        } : { show: false },
        itemStyle: {
          color: (params) => {
            return colorData[params.dataIndex as number];
          },
          borderRadius: [4, 4, 0, 0]
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          }
        },
        data: valueData
      }
    ]
  };

  // Add legend if enabled
  if (props.showLegend) {
    options.legend = {
      bottom: 10,
      data: [
        { name: '增加', icon: 'rect', itemStyle: { color: props.colors.increase } },
        { name: '减少', icon: 'rect', itemStyle: { color: props.colors.decrease } },
        { name: '合计', icon: 'rect', itemStyle: { color: props.colors.total } }
      ],
      textStyle: {
        color: '#606266',
        fontSize: 12
      }
    };
  }

  return options;
});

function initChart() {
  if (!chartRef.value) return;

  chartInstance.value = echarts.init(chartRef.value);
  chartInstance.value.setOption(chartOptions.value);

  // Click event
  chartInstance.value.on('click', (params) => {
    if (params.componentType === 'series' && params.seriesIndex === 1 && params.dataIndex !== undefined) {
      const dataIndex = params.dataIndex as number;
      const dataPoint = props.data[dataIndex];
      if (dataPoint) {
        emit('dataClick', {
          dataPoint,
          index: dataIndex
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
watch(() => props.colors, updateChart, { deep: true });
watch(chartOptions, updateChart, { deep: true });

// Expose methods
defineExpose({
  resize: handleResize,
  getInstance: () => chartInstance.value
});
</script>

<template>
  <div class="waterfall-chart">
    <div v-if="title" class="chart-header">
      <h3>{{ title }}</h3>
    </div>
    <div ref="chartRef" :style="{ width: '100%', height: height + 'px' }"></div>
  </div>
</template>

<style lang="scss" scoped>
.waterfall-chart {
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
