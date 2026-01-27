<script setup lang="ts">
/**
 * SmartBI RadarChart - Radar/Spider Chart Component
 * Features: Multi-dimensional metric comparison, area fill, multiple series support
 *
 * Common Use Cases:
 * - Financial health: 盈利能力、偿债能力、运营能力、成长能力
 * - Product comparison: 质量、价格、服务、品牌
 * - Department performance: 效率、成本、质量、交付
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import * as echarts from 'echarts';
import type { EChartsOption, ECharts } from 'echarts';

// Types
export interface RadarIndicator {
  name: string;
  max: number;
  min?: number;
  color?: string;
}

export interface RadarSeries {
  name: string;
  data: number[];
  color?: string;
  areaColor?: string;
}

interface Props {
  title?: string;
  indicators: RadarIndicator[];
  series: RadarSeries[];
  height?: string;
  loading?: boolean;
  showLegend?: boolean;
  shape?: 'polygon' | 'circle';
  areaStyle?: boolean;
  splitNumber?: number;
  colors?: string[];
  areaOpacity?: number;
  nameGap?: number;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: '350px',
  loading: false,
  showLegend: true,
  shape: 'polygon',
  areaStyle: true,
  splitNumber: 5,
  colors: () => [
    '#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399',
    '#00d4ff', '#ff6b9d', '#c084fc', '#fbbf24', '#34d399'
  ],
  areaOpacity: 0.25,
  nameGap: 15
});

const emit = defineEmits<{
  (e: 'indicatorClick', data: { indicator: RadarIndicator; index: number }): void;
  (e: 'seriesClick', data: { series: RadarSeries; indicator: RadarIndicator; value: number; index: number }): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);

const chartOptions = computed<EChartsOption>(() => {
  const radarIndicators = props.indicators.map(ind => ({
    name: ind.name,
    max: ind.max,
    min: ind.min ?? 0,
    color: ind.color
  }));

  const seriesData = props.series.map((s, index) => {
    const seriesColor = s.color || props.colors[index % props.colors.length];

    return {
      name: s.name,
      value: s.data,
      itemStyle: {
        color: seriesColor
      },
      lineStyle: {
        color: seriesColor,
        width: 2
      },
      areaStyle: props.areaStyle ? {
        color: s.areaColor || seriesColor,
        opacity: props.areaOpacity
      } : undefined,
      symbol: 'circle',
      symbolSize: 6
    };
  });

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
        const values = data.value as number[];
        const seriesName = data.name;

        let html = `<div style="font-weight: 600; margin-bottom: 8px;">${seriesName}</div>`;

        props.indicators.forEach((ind, i) => {
          const value = values[i];
          const percentage = ((value / ind.max) * 100).toFixed(1);
          html += `
            <div style="display: flex; justify-content: space-between; gap: 16px; margin: 4px 0;">
              <span style="color: #606266;">${ind.name}:</span>
              <span style="font-weight: 600;">${value} <span style="color: #909399; font-weight: normal;">(${percentage}%)</span></span>
            </div>
          `;
        });

        return html;
      }
    },
    legend: props.showLegend ? {
      bottom: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: {
        color: '#606266',
        fontSize: 12
      },
      data: props.series.map(s => s.name)
    } : undefined,
    radar: {
      center: ['50%', props.showLegend ? '45%' : '50%'],
      radius: props.showLegend ? '60%' : '70%',
      shape: props.shape,
      splitNumber: props.splitNumber,
      axisName: {
        color: '#606266',
        fontSize: 12,
        padding: [0, 0]
      },
      nameGap: props.nameGap,
      indicator: radarIndicators,
      splitLine: {
        lineStyle: {
          color: '#ebeef5',
          width: 1
        }
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: ['rgba(250, 250, 250, 0.5)', 'rgba(255, 255, 255, 0.5)']
        }
      },
      axisLine: {
        lineStyle: {
          color: '#dcdfe6'
        }
      }
    },
    series: [
      {
        type: 'radar',
        emphasis: {
          lineStyle: {
            width: 3
          },
          itemStyle: {
            borderWidth: 2
          }
        },
        data: seriesData
      }
    ]
  };

  return options;
});

function initChart() {
  if (!chartRef.value) return;

  chartInstance.value = echarts.init(chartRef.value);
  chartInstance.value.setOption(chartOptions.value);

  // Click event for series data points
  chartInstance.value.on('click', (params) => {
    if (params.componentType === 'series') {
      const seriesIndex = props.series.findIndex(s => s.name === params.name);
      if (seriesIndex !== -1) {
        const series = props.series[seriesIndex];
        // For radar chart, params.dataIndex is the indicator index when clicking on a point
        const indicatorIndex = params.dataIndex as number;
        if (indicatorIndex !== undefined && indicatorIndex < props.indicators.length) {
          emit('seriesClick', {
            series,
            indicator: props.indicators[indicatorIndex],
            value: series.data[indicatorIndex],
            index: indicatorIndex
          });
        }
      }
    }
  });

  // Click event for axis labels (indicators)
  chartInstance.value.getZr().on('click', (params) => {
    const pointInPixel = [params.offsetX, params.offsetY];
    if (chartInstance.value) {
      // Check if clicked on radar axis name
      const option = chartInstance.value.getOption() as EChartsOption;
      const radar = option.radar as echarts.RadarComponentOption;

      if (radar && Array.isArray(radar.indicator)) {
        const indicatorCount = radar.indicator.length;
        const center = chartInstance.value.convertToPixel('radar', [0, 0]);

        if (center) {
          // Calculate angle for each indicator
          const angleStep = (2 * Math.PI) / indicatorCount;
          const startAngle = Math.PI / 2; // Start from top

          for (let i = 0; i < indicatorCount; i++) {
            const angle = startAngle - i * angleStep;
            const distance = Math.sqrt(
              Math.pow(pointInPixel[0] - center[0], 2) +
              Math.pow(pointInPixel[1] - center[1], 2)
            );

            // Check if click is near the axis label area (outer region)
            const chartWidth = chartRef.value?.clientWidth || 400;
            const radius = chartWidth * 0.35; // Approximate radar radius

            if (distance > radius * 0.9 && distance < radius * 1.3) {
              const clickAngle = Math.atan2(
                center[1] - pointInPixel[1],
                pointInPixel[0] - center[0]
              );

              // Normalize angles
              const normalizedClickAngle = (clickAngle + 2 * Math.PI) % (2 * Math.PI);
              const normalizedIndicatorAngle = (angle + 2 * Math.PI) % (2 * Math.PI);

              const angleDiff = Math.abs(normalizedClickAngle - normalizedIndicatorAngle);
              const threshold = angleStep / 2;

              if (angleDiff < threshold || angleDiff > (2 * Math.PI - threshold)) {
                emit('indicatorClick', {
                  indicator: props.indicators[i],
                  index: i
                });
                break;
              }
            }
          }
        }
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
watch(() => props.indicators, updateChart, { deep: true });
watch(() => props.series, updateChart, { deep: true });
watch(chartOptions, updateChart, { deep: true });

// Expose methods
defineExpose({
  resize: handleResize,
  getInstance: () => chartInstance.value
});
</script>

<template>
  <div class="radar-chart">
    <div v-if="title" class="chart-header">
      <h3>{{ title }}</h3>
    </div>
    <div
      v-loading="loading"
      class="chart-container"
      :style="{ height }"
    >
      <div ref="chartRef" class="chart-inner"></div>
      <div v-if="!loading && series.length === 0" class="chart-empty">
        <el-empty description="暂无数据" :image-size="80" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.radar-chart {
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

  .chart-container {
    position: relative;
    width: 100%;
    min-height: 200px;

    .chart-inner {
      width: 100%;
      height: 100%;
    }

    .chart-empty {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
  }
}
</style>
