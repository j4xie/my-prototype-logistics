<script setup lang="ts">
/**
 * SmartBI RankingChart - Horizontal Bar Chart for Rankings
 * Features: Rank display, value formatting, click-to-drill-down
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import echarts from '@/utils/echarts';
import type { EChartsOption, ECharts } from 'echarts';

// Types
export interface RankingItem {
  id: string | number;
  name: string;
  value: number;
  extra?: Record<string, unknown>;
}

interface Props {
  title?: string;
  data: RankingItem[];
  height?: number;
  maxItems?: number;
  showRank?: boolean;
  valueUnit?: string;
  barColor?: string | string[];
  showPercentage?: boolean;
  clickable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: 400,
  maxItems: 10,
  showRank: true,
  valueUnit: '',
  barColor: '#409eff',
  showPercentage: false,
  clickable: true
});

const emit = defineEmits<{
  (e: 'itemClick', item: RankingItem): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);

// Process data for display
const processedData = computed(() => {
  const sorted = [...props.data]
    .sort((a, b) => b.value - a.value)
    .slice(0, props.maxItems);
  return sorted;
});

const maxValue = computed(() => {
  return Math.max(...processedData.value.map(d => d.value), 1);
});

// Gradient colors
const getBarColor = (index: number): string => {
  if (Array.isArray(props.barColor)) {
    return props.barColor[index % props.barColor.length];
  }
  // Default gradient based on rank
  const colors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399'];
  if (index < 3) return colors[index];
  return props.barColor;
};

const chartOptions = computed<EChartsOption>(() => {
  const data = processedData.value;
  const names = data.map((d, i) => props.showRank ? `${i + 1}. ${d.name}` : d.name);
  const values = data.map(d => d.value);

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
        if (!Array.isArray(params) || params.length === 0) return '';
        const param = params[0];
        const item = data[param.dataIndex as number];
        const percentage = props.showPercentage
          ? ` (${((item.value / maxValue.value) * 100).toFixed(1)}%)`
          : '';
        return `
          <div style="font-weight: 600;">${item.name}</div>
          <div style="margin-top: 4px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${param.color}; margin-right: 8px;"></span>
            ${item.value}${props.valueUnit}${percentage}
          </div>
        `;
      }
    },
    grid: {
      top: 10,
      right: 80,
      bottom: 10,
      left: 10,
      containLabel: true
    },
    xAxis: {
      type: 'value',
      max: maxValue.value,
      show: false
    },
    yAxis: {
      type: 'category',
      data: names.reverse(),
      inverse: false,
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#606266',
        fontSize: 13,
        formatter: (value: string) => {
          // Truncate long names
          return value.length > 15 ? value.slice(0, 15) + '...' : value;
        }
      }
    },
    series: [
      {
        type: 'bar',
        data: values.reverse().map((v, i) => ({
          value: v,
          itemStyle: {
            color: getBarColor(data.length - 1 - i),
            borderRadius: [0, 4, 4, 0]
          }
        })),
        barWidth: '60%',
        label: {
          show: true,
          position: 'right',
          color: '#606266',
          fontSize: 12,
          formatter: (params) => {
            const value = params.value as number;
            const percentage = props.showPercentage
              ? ` (${((value / maxValue.value) * 100).toFixed(1)}%)`
              : '';
            return `${value}${props.valueUnit}${percentage}`;
          }
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          }
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
  if (props.clickable) {
    chartInstance.value.on('click', (params) => {
      if (params.componentType === 'series' && params.dataIndex !== undefined) {
        const reversedIndex = processedData.value.length - 1 - (params.dataIndex as number);
        const item = processedData.value[reversedIndex];
        if (item) {
          emit('itemClick', item);
        }
      }
    });
  }
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
watch(chartOptions, updateChart, { deep: true });

// Expose methods
defineExpose({
  resize: handleResize,
  getInstance: () => chartInstance.value
});
</script>

<template>
  <div class="ranking-chart">
    <div v-if="title" class="chart-header">
      <h3>{{ title }}</h3>
      <el-tag v-if="maxItems < data.length" type="info" size="small">
        Top {{ maxItems }}
      </el-tag>
    </div>
    <div ref="chartRef" :style="{ width: '100%', height: height + 'px' }"></div>
  </div>
</template>

<style lang="scss" scoped>
.ranking-chart {
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
