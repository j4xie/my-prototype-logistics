<script setup lang="ts">
/**
 * SmartBI WaterfallChart - Waterfall/Bridge Chart
 * Features: Income/expense visualization, cumulative totals, cash flow analysis
 * Backend template: cashflow_waterfall
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import echarts from '@/utils/echarts';
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
  loading?: boolean;
}

// P&L semantic color palette
const plColors = {
  revenue: '#FF5630',           // Revenue items - red (income)
  revenueSub: '#FF8F73',        // Sub revenue - lighter red
  cost: '#36B37E',              // Cost/expense items - green (outflow)
  costSub: '#79F2C0',           // Sub cost - lighter green
  profit: '#1B65A8',            // Profit/total items - blue
  profitSub: '#4C9AFF'          // Sub profit - lighter blue
};

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: 400,
  colors: () => ({
    increase: '#FF5630',  // Red for revenue/increase (P&L semantic)
    decrease: '#36B37E',  // Green for cost/decrease (P&L semantic)
    total: '#1B65A8'      // Blue for totals/profit
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
let resizeObserver: ResizeObserver | null = null;
let rafId = 0;

/**
 * Calculate waterfall chart data
 * Returns helper series (transparent base), data series (actual bars), running totals, and connection lines
 */
const waterfallData = computed(() => {
  const helperData: (number | string)[] = [];
  const valueData: number[] = [];
  const colorData: string[] = [];
  const runningTotals: number[] = [];     // cumulative running total after each bar
  const barTops: number[] = [];           // top of each visible bar (for connection lines)

  let cumulative = 0;
  const lastIdx = props.data.length - 1;

  props.data.forEach((item, index) => {
    const isFirst = index === 0;
    const isLast = index === lastIdx;

    if (item.type === 'total') {
      helperData.push(0);
      valueData.push(item.value);
      // First/last total use a slightly different shade for prominence
      colorData.push(isFirst || isLast ? plColors.profit : props.colors.total);
      cumulative = item.value;
      barTops.push(item.value);
    } else if (item.type === 'increase') {
      helperData.push(cumulative);
      valueData.push(item.value);
      colorData.push(isFirst ? plColors.revenue : props.colors.increase);
      cumulative += item.value;
      barTops.push(cumulative);
    } else {
      const absValue = Math.abs(item.value);
      cumulative -= absValue;
      helperData.push(cumulative);
      valueData.push(absValue);
      colorData.push(isLast ? plColors.profit : props.colors.decrease);
      barTops.push(cumulative);
    }

    runningTotals.push(cumulative);
  });

  return { helperData, valueData, colorData, runningTotals, barTops };
});

const chartOptions = computed<EChartsOption>(() => {
  const categories = props.data.map(d => d.category);
  const { helperData, valueData, colorData, runningTotals, barTops } = waterfallData.value;

  // Build connection markLine data connecting tops of adjacent bars
  const connectionLineData: Array<[{ coord: [string, number] }, { coord: [string, number] }]> = [];
  for (let i = 0; i < categories.length - 1; i++) {
    connectionLineData.push([
      { coord: [categories[i], barTops[i]] },
      { coord: [categories[i + 1], barTops[i]] }
    ]);
  }

  const options: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      confine: true,
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

            // Show value label on bar top
            const displayVal = dataPoint.type === 'decrease'
              ? `-${Math.abs(dataPoint.value)}`
              : String(dataPoint.value);

            // Show running total below for non-total items
            const runningVal = runningTotals[dataIndex];
            if (dataPoint.type !== 'total') {
              return `{val|${displayVal}${props.valueUnit}}\n{run|累计: ${runningVal}}`;
            }
            return `{val|${displayVal}${props.valueUnit}}`;
          },
          rich: {
            val: {
              color: '#303133',
              fontSize: 11,
              fontWeight: 600,
              lineHeight: 18
            },
            run: {
              color: '#909399',
              fontSize: 10,
              lineHeight: 16
            }
          }
        } : { show: false },
        itemStyle: {
          color: (params) => {
            // First/last bars rendered with darker shade via colorData
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
        // Connection lines between bar tops (waterfall bridge)
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: {
            type: 'dashed',
            color: '#c0c4cc',
            width: 1.5
          },
          label: { show: false },
          data: connectionLineData as echarts.MarkLineComponentOption['data']
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

  chartInstance.value = echarts.init(chartRef.value, 'cretas');
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
watch(() => props.colors, updateChart, { deep: true });
watch(chartOptions, updateChart, { deep: true });

// Expose methods
defineExpose({
  resize: handleResize,
  getInstance: () => chartInstance.value
});
</script>

<template>
  <div v-loading="loading" class="waterfall-chart">
    <div v-if="title" class="chart-header">
      <h3>{{ title }}</h3>
    </div>
    <div class="chart-wrapper" :style="{ position: 'relative', width: '100%', height: height + 'px' }">
      <div ref="chartRef" role="img" :aria-label="title || '瀑布图'" style="width: 100%; height: 100%"></div>
      <div v-if="!loading && data.length === 0" class="chart-empty">
        <el-empty description="暂无数据" :image-size="80" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.waterfall-chart {
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
