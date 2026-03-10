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
  loading?: boolean;
  /** Chart mode: 'pie' | 'rose' | 'donut'. rose uses roseType:'area'. donut uses innerRadius>0 */
  mode?: 'pie' | 'rose' | 'donut';
  /** Auto-group items beyond this count into '其他' */
  maxItems?: number;
  /** Show center total value and title for donut mode */
  showCenterStats?: boolean;
  /** Title shown below total in donut center */
  centerTitle?: string;
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
  colors: () => [...CHART_COLORS],
  mode: 'donut',
  maxItems: 8,
  showCenterStats: false,
  centerTitle: '合计'
});

const emit = defineEmits<{
  (e: 'itemClick', item: PieDataItem): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);
let resizeObserver: ResizeObserver | null = null;
let rafId = 0;

// Calculate total
const total = computed(() => props.data.reduce((sum, d) => sum + d.value, 0));

// Processed data with Top N + 其他 grouping
const processedData = computed<PieDataItem[]>(() => {
  if (props.data.length <= props.maxItems) return props.data;
  const sorted = [...props.data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, props.maxItems);
  const others = sorted.slice(props.maxItems);
  const othersValue = others.reduce((sum, d) => sum + d.value, 0);
  return [
    ...top,
    { name: '其他', value: othersValue, color: '#c0c4cc' }
  ];
});

// Format large numbers
function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  return n.toLocaleString();
}

const chartOptions = computed<EChartsOption>(() => {
  const isDonut = props.mode === 'donut' || (props.mode !== 'pie' && props.mode !== 'rose' && props.innerRadius > 0);
  const isRose = props.mode === 'rose';

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
        const percent = ((data.value as number) / total.value * 100).toFixed(1);
        return `
          <div style="font-weight: 600;">${data.name}</div>
          <div style="margin-top: 4px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${data.color}; margin-right: 8px;"></span>
            ${(data.value as number).toLocaleString()}${props.valueUnit} (${percent}%)
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
        roseType: isRose ? 'area' : undefined,
        radius: isDonut ? [`${props.innerRadius}%`, `${props.outerRadius}%`] : (isRose ? ['10%', `${props.outerRadius}%`] : ['0%', `${props.outerRadius}%`]),
        center: props.legendPosition === 'right' ? ['40%', '50%'] : ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: isRose ? 6 : 4,
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
            return `{name|${params.name}}\n{value|${(params.value as number).toLocaleString()}${props.valueUnit}}`;
          },
          rich: {
            name: {
              fontSize: 12,
              color: '#606266',
              lineHeight: 16
            },
            value: {
              fontSize: 11,
              color: '#909399',
              lineHeight: 14
            }
          },
          color: props.labelPosition === 'inside' ? '#fff' : '#606266',
          fontSize: 12
        } : {
          show: false
        },
        labelLine: props.showLabel && props.labelPosition === 'outside' ? {
          show: true,
          smooth: true,
          length: 18,
          length2: 12,
          lineStyle: {
            color: '#c0c4cc',
            width: 1.5
          }
        } : {
          show: false
        },
        emphasis: {
          scale: true,
          scaleSize: 8,
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          },
          itemStyle: {
            shadowBlur: 20,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.25)'
          }
        },
        data: processedData.value.map((d, i) => ({
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
  const showCenter = isDonut && (props.centerText || props.centerSubText || props.showCenterStats);
  if (showCenter) {
    const displayText = props.showCenterStats
      ? formatNumber(total.value) + props.valueUnit
      : (props.centerText || '');
    const displaySub = props.showCenterStats
      ? props.centerTitle
      : (props.centerSubText || '');

    options.graphic = [
      {
        type: 'group',
        left: props.legendPosition === 'right' ? '40%' : 'center',
        top: props.legendPosition === 'right' ? 'middle' : '45%',
        children: [
          displayText ? {
            type: 'text',
            z: 100,
            left: 'center',
            top: displaySub ? -15 : 'middle',
            style: {
              fill: '#303133',
              text: displayText,
              font: 'bold 24px sans-serif',
              textAlign: 'center'
            }
          } : null,
          displaySub ? {
            type: 'text',
            z: 100,
            left: 'center',
            top: displayText ? 10 : 'middle',
            style: {
              fill: '#909399',
              text: displaySub,
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
      const item = processedData.value[params.dataIndex as number];
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
  getInstance: () => chartInstance.value,
  getTotal: () => total.value
});
</script>

<template>
  <div v-loading="loading" class="pie-chart">
    <div v-if="title" class="chart-header">
      <h3>{{ title }}</h3>
    </div>
    <div class="chart-wrapper" :style="{ position: 'relative', width: '100%', height: height + 'px' }">
      <div ref="chartRef" role="img" :aria-label="title || '饼图'" style="width: 100%; height: 100%"></div>
      <div v-if="!loading && data.length === 0" class="chart-empty">
        <el-empty description="暂无数据" :image-size="80" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.pie-chart {
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
