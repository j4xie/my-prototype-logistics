<script setup lang="ts">
/**
 * SmartBI GaugeChart - Gauge/Dashboard Component
 * Features: Completion rate display, target line, color zones,
 *           gradient color band, countUp animation, multiple pointers,
 *           rich center text, milestone tick marks
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import echarts from '@/utils/echarts';
import type { EChartsOption, ECharts } from 'echarts';

export interface GaugePointer {
  value: number;
  name?: string;
  color?: string;
}

interface Props {
  title?: string;
  value: number;
  max?: number;
  height?: number;
  targetValue?: number;
  showTarget?: boolean;
  unit?: string;
  label?: string;
  subtitle?: string;
  thresholds?: { value: number; color: string }[];
  startAngle?: number;
  endAngle?: number;
  radius?: string;
  loading?: boolean;
  /** Use gradient color band: green→yellow→red */
  useGradient?: boolean;
  /** Additional pointers for multi-pointer gauge */
  pointers?: GaugePointer[];
  /** Show milestone tick marks at 25%, 50%, 75%, 100% */
  showMilestones?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  max: 100,
  height: 300,
  targetValue: 0,
  showTarget: false,
  unit: '%',
  label: '',
  subtitle: '',
  thresholds: () => [
    { value: 30, color: '#f56c6c' },
    { value: 70, color: '#e6a23c' },
    { value: 100, color: '#67c23a' }
  ],
  startAngle: 225,
  endAngle: -45,
  radius: '85%',
  useGradient: false,
  pointers: () => [],
  showMilestones: false
});

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);
let resizeObserver: ResizeObserver | null = null;
let rafId = 0;

// CountUp animation state
const displayValue = ref(0);
let countUpRaf = 0;

function animateCountUp(target: number) {
  if (countUpRaf) cancelAnimationFrame(countUpRaf);
  const start = displayValue.value;
  const duration = 1200;
  const startTime = performance.now();

  function step(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    displayValue.value = Math.round(start + (target - start) * eased);
    if (progress < 1) {
      countUpRaf = requestAnimationFrame(step);
    } else {
      displayValue.value = target;
    }
  }
  countUpRaf = requestAnimationFrame(step);
}

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

// Gradient color stops: green(0%) → yellow(50%) → red(100%)
const gradientColorStops = computed<[number, string][]>(() => [
  [0, '#67c23a'],
  [0.5, '#e6a23c'],
  [1, '#f56c6c']
]);

// Build color stops for gauge (legacy threshold mode)
const colorStops = computed(() => {
  const sortedThresholds = [...props.thresholds].sort((a, b) => a.value - b.value);
  return sortedThresholds.map((t, i) => {
    const prevValue = i === 0 ? 0 : sortedThresholds[i - 1].value;
    return [(t.value - prevValue) / 100, t.color];
  });
});

// Milestone positions (25%, 50%, 75%, 100%)
const milestoneValues = computed(() => {
  if (!props.showMilestones) return [];
  return [0.25, 0.5, 0.75, 1.0].map(p => p * props.max);
});

const chartOptions = computed<EChartsOption>(() => {
  const activeColorStops = props.useGradient
    ? gradientColorStops.value
    : (colorStops.value as [number, string][]);

  // Build detail with rich text: value + unit + subtitle
  const detailConfig: echarts.GaugeSeriesOption['detail'] = {
    valueAnimation: true,
    offsetCenter: [0, props.subtitle ? '15%' : '20%'],
    formatter: () => {
      if (props.subtitle) {
        return `{value|${displayValue.value}}{unit|${props.unit}}\n{subtitle|${props.subtitle}}`;
      }
      return `{value|${displayValue.value}}{unit|${props.unit}}`;
    },
    rich: {
      value: {
        fontSize: 32,
        fontWeight: 'bold',
        color: currentColor.value,
        lineHeight: 40
      },
      unit: {
        fontSize: 16,
        color: currentColor.value,
        fontWeight: 'bold',
        padding: [0, 0, 4, 2]
      },
      subtitle: {
        fontSize: 12,
        color: '#909399',
        lineHeight: 20
      }
    }
  };

  // Main value series data including optional additional pointers
  const mainData: echarts.GaugeSeriesOption['data'] = [
    {
      value: props.value,
      name: props.label,
      title: {
        offsetCenter: [0, props.subtitle ? '50%' : '45%'],
        color: '#909399',
        fontSize: 14
      },
      itemStyle: {
        color: currentColor.value
      }
    },
    ...props.pointers.map((p) => ({
      value: p.value,
      name: p.name || '',
      title: { show: false },
      itemStyle: { color: p.color || '#909399' },
      detail: { show: false }
    }))
  ];

  // Milestone tick marks at 25/50/75/100%
  const splitLineConfig: echarts.GaugeSeriesOption['splitLine'] = props.showMilestones
    ? {
        distance: -38,
        length: 18,
        lineStyle: {
          color: '#606266',
          width: 3
        }
      }
    : {
        distance: -35,
        length: 15,
        lineStyle: {
          color: '#dcdfe6',
          width: 2
        }
      };

  const axisLabelConfig: echarts.GaugeSeriesOption['axisLabel'] = props.showMilestones
    ? {
        distance: -22,
        color: '#606266',
        fontSize: 11,
        formatter: (value: number) => {
          const pct = Math.round((value / props.max) * 100);
          if ([0, 25, 50, 75, 100].includes(pct)) return String(pct) + '%';
          return '';
        }
      }
    : {
        distance: -20,
        color: '#909399',
        fontSize: 11,
        formatter: (value: number) => {
          if (value === 0 || value === props.max) return String(value);
          return '';
        }
      };

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
        splitNumber: props.showMilestones ? 4 : 10,
        axisLine: {
          lineStyle: {
            width: 20,
            color: [[1, '#ebeef5']]
          }
        },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: { show: false }
      },
      // Value arc with gradient or threshold colors
      {
        type: 'gauge',
        startAngle: props.startAngle,
        endAngle: props.endAngle,
        radius: props.radius,
        center: ['50%', '60%'],
        min: 0,
        max: props.max,
        splitNumber: props.showMilestones ? 4 : 10,
        axisLine: {
          lineStyle: {
            width: 20,
            color: activeColorStops
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
        splitLine: splitLineConfig,
        axisLabel: axisLabelConfig,
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
        detail: detailConfig,
        data: mainData
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
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
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
        detail: { show: false }
      } as echarts.GaugeSeriesOption
    ];
  }

  return options;
});

function initChart() {
  if (!chartRef.value) return;

  chartInstance.value = echarts.init(chartRef.value, 'cretas');
  animateCountUp(props.value);
  chartInstance.value.setOption(chartOptions.value);
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
  if (countUpRaf) cancelAnimationFrame(countUpRaf);
  window.removeEventListener('resize', handleResize);
  chartInstance.value?.dispose();
});

// Watch for data changes
watch(() => props.value, (newVal) => {
  animateCountUp(newVal);
  updateChart();
});
watch(chartOptions, updateChart, { deep: true });
// Re-render when displayValue changes (countUp animation frames)
watch(displayValue, () => {
  if (chartInstance.value) {
    chartInstance.value.setOption(chartOptions.value);
  }
});

// Expose methods
defineExpose({
  resize: handleResize,
  getInstance: () => chartInstance.value
});
</script>

<template>
  <div v-loading="loading" class="gauge-chart">
    <div v-if="title" class="chart-header">
      <h3>{{ title }}</h3>
      <div v-if="showTarget && targetValue" class="target-info">
        <span class="target-label">Target:</span>
        <span class="target-value">{{ targetValue }}{{ unit }}</span>
      </div>
    </div>
    <div ref="chartRef" role="img" :aria-label="title || '仪表盘图表'" :style="{ width: '100%', height: height + 'px' }"></div>
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
        color: var(--color-text-secondary);
      }

      .target-value {
        color: #f56c6c;
        font-weight: 600;
      }
    }
  }
}
</style>
