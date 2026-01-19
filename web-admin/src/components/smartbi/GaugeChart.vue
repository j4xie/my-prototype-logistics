<script setup lang="ts">
/**
 * SmartBI GaugeChart - Gauge/Dashboard Component
 * Features: Completion rate display, target line, color zones
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import * as echarts from 'echarts';
import type { EChartsOption, ECharts } from 'echarts';

interface Props {
  title?: string;
  value: number;
  max?: number;
  height?: number;
  targetValue?: number;
  showTarget?: boolean;
  unit?: string;
  label?: string;
  thresholds?: { value: number; color: string }[];
  startAngle?: number;
  endAngle?: number;
  radius?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  max: 100,
  height: 300,
  targetValue: 0,
  showTarget: false,
  unit: '%',
  label: '',
  thresholds: () => [
    { value: 30, color: '#f56c6c' },
    { value: 70, color: '#e6a23c' },
    { value: 100, color: '#67c23a' }
  ],
  startAngle: 225,
  endAngle: -45,
  radius: '85%'
});

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);

// Calculate percentage
const percentage = computed(() => {
  return Math.min((props.value / props.max) * 100, 100);
});

// Get current color based on value
const currentColor = computed(() => {
  const percent = percentage.value;
  const sortedThresholds = [...props.thresholds].sort((a, b) => a.value - b.value);
  for (const threshold of sortedThresholds) {
    if (percent <= threshold.value) {
      return threshold.color;
    }
  }
  return sortedThresholds[sortedThresholds.length - 1]?.color || '#67c23a';
});

// Build color stops for gauge
const colorStops = computed(() => {
  const sortedThresholds = [...props.thresholds].sort((a, b) => a.value - b.value);
  return sortedThresholds.map((t, i) => {
    const prevValue = i === 0 ? 0 : sortedThresholds[i - 1].value;
    return [(t.value - prevValue) / 100, t.color];
  });
});

const chartOptions = computed<EChartsOption>(() => {
  const options: EChartsOption = {
    series: [
      // Background arc
      {
        type: 'gauge',
        startAngle: props.startAngle,
        endAngle: props.endAngle,
        radius: props.radius,
        center: ['50%', '60%'],
        min: 0,
        max: props.max,
        splitNumber: 10,
        axisLine: {
          lineStyle: {
            width: 20,
            color: [[1, '#ebeef5']]
          }
        },
        pointer: {
          show: false
        },
        axisTick: {
          show: false
        },
        splitLine: {
          show: false
        },
        axisLabel: {
          show: false
        },
        detail: {
          show: false
        }
      },
      // Value arc
      {
        type: 'gauge',
        startAngle: props.startAngle,
        endAngle: props.endAngle,
        radius: props.radius,
        center: ['50%', '60%'],
        min: 0,
        max: props.max,
        splitNumber: 10,
        axisLine: {
          lineStyle: {
            width: 20,
            color: colorStops.value as [number, string][]
          }
        },
        progress: {
          show: true,
          width: 20,
          itemStyle: {
            color: currentColor.value
          }
        },
        pointer: {
          show: true,
          length: '60%',
          width: 6,
          itemStyle: {
            color: currentColor.value
          }
        },
        axisTick: {
          distance: -30,
          length: 8,
          lineStyle: {
            color: '#dcdfe6',
            width: 1
          }
        },
        splitLine: {
          distance: -35,
          length: 15,
          lineStyle: {
            color: '#dcdfe6',
            width: 2
          }
        },
        axisLabel: {
          distance: -20,
          color: '#909399',
          fontSize: 11,
          formatter: (value: number) => {
            if (value === 0 || value === props.max) {
              return String(value);
            }
            return '';
          }
        },
        anchor: {
          show: true,
          showAbove: true,
          size: 16,
          itemStyle: {
            borderWidth: 4,
            borderColor: currentColor.value,
            color: '#fff'
          }
        },
        detail: {
          valueAnimation: true,
          fontSize: 32,
          fontWeight: 'bold',
          offsetCenter: [0, '20%'],
          formatter: () => {
            return `${props.value}${props.unit}`;
          },
          color: currentColor.value
        },
        data: [
          {
            value: props.value,
            name: props.label,
            title: {
              offsetCenter: [0, '45%'],
              color: '#909399',
              fontSize: 14
            }
          }
        ]
      }
    ]
  };

  // Add target marker if enabled
  if (props.showTarget && props.targetValue) {
    const targetAngle = props.startAngle - ((props.startAngle - props.endAngle) * (props.targetValue / props.max));
    options.series = [
      ...(options.series as echarts.GaugeSeriesOption[]),
      {
        type: 'gauge',
        startAngle: props.startAngle,
        endAngle: props.endAngle,
        radius: props.radius,
        center: ['50%', '60%'],
        min: 0,
        max: props.max,
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        splitLine: {
          show: false
        },
        axisLabel: {
          show: false
        },
        pointer: {
          show: false
        },
        markPoint: {
          symbol: 'triangle',
          symbolSize: 12,
          symbolRotate: targetAngle - 90,
          data: [
            {
              name: 'Target',
              value: props.targetValue,
              x: '50%',
              y: '60%',
              itemStyle: {
                color: '#f56c6c'
              }
            }
          ]
        },
        detail: {
          show: false
        }
      } as echarts.GaugeSeriesOption
    ];
  }

  return options;
});

function initChart() {
  if (!chartRef.value) return;

  chartInstance.value = echarts.init(chartRef.value);
  chartInstance.value.setOption(chartOptions.value);
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
watch(() => props.value, updateChart);
watch(chartOptions, updateChart, { deep: true });

// Expose methods
defineExpose({
  resize: handleResize,
  getInstance: () => chartInstance.value
});
</script>

<template>
  <div class="gauge-chart">
    <div v-if="title" class="chart-header">
      <h3>{{ title }}</h3>
      <div v-if="showTarget && targetValue" class="target-info">
        <span class="target-label">Target:</span>
        <span class="target-value">{{ targetValue }}{{ unit }}</span>
      </div>
    </div>
    <div ref="chartRef" :style="{ width: '100%', height: height + 'px' }"></div>
  </div>
</template>

<style lang="scss" scoped>
.gauge-chart {
  width: 100%;

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    padding: 0 4px;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }

    .target-info {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;

      .target-label {
        color: #909399;
      }

      .target-value {
        color: #f56c6c;
        font-weight: 600;
      }
    }
  }
}
</style>
