<script setup lang="ts">
/**
 * SmartBI PieChart - Pie/Donut Chart Component
 * Features: Custom legend, percentage display, inner label
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import echarts from '@/utils/echarts';
import type { EChartsOption, ECharts } from 'echarts';
import { CHART_COLORS } from '@/constants/chart-colors';

// Types
export interface PieDataItem {
  id?: string | number;
  name: string;
  value: number;
  color?: string;
  extra?: Record<string, unknown>;
}

interface Props {
  title?: string;
  data: PieDataItem[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLabel?: boolean;
  labelPosition?: 'outside' | 'inside';
  showLegend?: boolean;
  legendPosition?: 'bottom' | 'right';
  centerText?: string;
  centerSubText?: string;
  valueUnit?: string;
  colors?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: 400,
  innerRadius: 50,
  outerRadius: 80,
  showLabel: true,
  labelPosition: 'outside',
  showLegend: true,
  legendPosition: 'bottom',
  centerText: '',
  centerSubText: '',
  valueUnit: '',
  colors: () => [...CHART_COLORS]
});

const emit = defineEmits<{
  (e: 'itemClick', item: PieDataItem): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);

// Calculate total
const total = computed(() => props.data.reduce((sum, d) => sum + d.value, 0));

const chartOptions = computed<EChartsOption>(() => {
  const isDonut = props.innerRadius > 0;

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
        const percent = ((data.value as number) / total.value * 100).toFixed(1);
        return `
          <div style="font-weight: 600;">${data.name}</div>
          <div style="margin-top: 4px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${data.color}; margin-right: 8px;"></span>
            ${data.value}${props.valueUnit} (${percent}%)
          </div>
        `;
      }
    },
    legend: props.showLegend ? {
      orient: props.legendPosition === 'right' ? 'vertical' : 'horizontal',
      ...(props.legendPosition === 'right'
        ? { right: 10, top: 'center' }
        : { bottom: 0 }
      ),
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: {
        color: '#606266',
        fontSize: 12
      },
      formatter: (name: string) => {
        const item = props.data.find(d => d.name === name);
        if (item) {
          const percent = ((item.value / total.value) * 100).toFixed(1);
          return `${name}  ${percent}%`;
        }
        return name;
      }
    } : undefined,
    series: [
      {
        type: 'pie',
        radius: [`${props.innerRadius}%`, `${props.outerRadius}%`],
        center: props.legendPosition === 'right' ? ['40%', '50%'] : ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: props.showLabel ? {
          show: true,
          position: props.labelPosition,
          formatter: (params) => {
            const percent = ((params.value as number) / total.value * 100).toFixed(1);
            if (props.labelPosition === 'inside') {
              return `${percent}%`;
            }
            return `${params.name}\n${params.value}${props.valueUnit}`;
          },
          color: props.labelPosition === 'inside' ? '#fff' : '#606266',
          fontSize: 12
        } : {
          show: false
        },
        labelLine: props.showLabel && props.labelPosition === 'outside' ? {
          show: true,
          length: 15,
          length2: 10,
          lineStyle: {
            color: '#dcdfe6'
          }
        } : {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)'
          }
        },
        data: props.data.map((d, i) => ({
          value: d.value,
          name: d.name,
          itemStyle: {
            color: d.color || props.colors[i % props.colors.length]
          }
        }))
      }
    ]
  };

  // Add center text for donut chart
  if (isDonut && (props.centerText || props.centerSubText)) {
    options.graphic = [
      {
        type: 'group',
        left: props.legendPosition === 'right' ? '40%' : 'center',
        top: props.legendPosition === 'right' ? 'middle' : '45%',
        children: [
          props.centerText ? {
            type: 'text',
            z: 100,
            left: 'center',
            top: props.centerSubText ? -15 : 'middle',
            style: {
              fill: '#303133',
              text: props.centerText,
              font: 'bold 24px sans-serif',
              textAlign: 'center'
            }
          } : null,
          props.centerSubText ? {
            type: 'text',
            z: 100,
            left: 'center',
            top: props.centerText ? 10 : 'middle',
            style: {
              fill: '#909399',
              text: props.centerSubText,
              font: '14px sans-serif',
              textAlign: 'center'
            }
          } : null
        ].filter(Boolean)
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
      const item = props.data[params.dataIndex as number];
      if (item) {
        emit('itemClick', item);
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
watch(chartOptions, updateChart, { deep: true });

// Expose methods
defineExpose({
  resize: handleResize,
  getInstance: () => chartInstance.value,
  getTotal: () => total.value
});
</script>

<template>
  <div class="pie-chart">
    <div v-if="title" class="chart-header">
      <h3>{{ title }}</h3>
    </div>
    <div ref="chartRef" :style="{ width: '100%', height: height + 'px' }"></div>
  </div>
</template>

<style lang="scss" scoped>
.pie-chart {
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
