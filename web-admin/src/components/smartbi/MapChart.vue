<script setup lang="ts">
/**
 * SmartBI MapChart - China Map Visualization Component
 * Features: Province data visualization, tooltip, click events
 * Note: Requires china.json geo data to be registered
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import echarts from '@/utils/echarts';
import type { EChartsOption, ECharts } from 'echarts';
import { defaultTooltip } from './chart-helpers';

// Types
export interface MapDataItem {
  name: string;
  value: number;
  extra?: Record<string, unknown>;
}

interface Props {
  title?: string;
  data: MapDataItem[];
  height?: number;
  valueLabel?: string;
  valueUnit?: string;
  minColor?: string;
  maxColor?: string;
  showLabel?: boolean;
  zoom?: number;
  roam?: boolean | 'scale' | 'move';
  geoJson?: object;
  /** Scatter bubble data to overlay on map */
  scatterData?: MapScatterItem[];
  /** Show zoom in/out control buttons */
  showZoomControls?: boolean;
  /** Show province name + value labels when zoomed in */
  showDetailLabel?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: 500,
  valueLabel: 'Value',
  valueUnit: '',
  minColor: '#e0f3ff',
  maxColor: '#1B65A8',
  showLabel: true,
  zoom: 1.2,
  roam: true,
  geoJson: undefined,
  scatterData: () => [],
  showZoomControls: true,
  showDetailLabel: false
});

export interface MapScatterItem {
  name: string;
  value: [number, number, number]; // [longitude, latitude, size/value]
  label?: string;
  color?: string;
}

const emit = defineEmits<{
  (e: 'regionClick', data: MapDataItem): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);
let resizeObserver: ResizeObserver | null = null;
let rafId = 0;
const isMapRegistered = ref(false);
const mapLoading = ref(true);
const mapError = ref<string | null>(null);
const currentZoom = ref(props.zoom);

function zoomIn() {
  currentZoom.value = Math.min(currentZoom.value * 1.3, 10);
  if (chartInstance.value) {
    chartInstance.value.dispatchAction({
      type: 'geoRoam',
      zoom: 1.3
    });
  }
}

function zoomOut() {
  currentZoom.value = Math.max(currentZoom.value / 1.3, 0.5);
  if (chartInstance.value) {
    chartInstance.value.dispatchAction({
      type: 'geoRoam',
      zoom: 1 / 1.3
    });
  }
}

// Calculate value range
const valueRange = computed(() => {
  const values = props.data.map(d => d.value);
  return {
    min: Math.min(...values, 0),
    max: Math.max(...values, 1)
  };
});

// Calculate sorted data for rank display
const sortedData = computed(() => {
  return [...props.data].sort((a, b) => b.value - a.value);
});

const totalValue = computed(() => props.data.reduce((sum, d) => sum + d.value, 0));

const chartOptions = computed<EChartsOption>(() => {
  if (!isMapRegistered.value) {
    return {};
  }

  const options: EChartsOption = {
    tooltip: {
      ...defaultTooltip('item'),
      formatter: (params) => {
        const data = params as echarts.DefaultLabelFormatterCallbackParams;
        if (data.componentSubType === 'effectScatter' || data.componentSubType === 'scatter') {
          return `<div style="font-weight:600;">${data.name}</div>`;
        }
        const value = (data.value as number) ?? 0;
        const rank = sortedData.value.findIndex(d => d.name === data.name) + 1;
        const pct = totalValue.value > 0 ? ((value / totalValue.value) * 100).toFixed(1) : '0.0';
        return `
          <div style="font-weight: 600; margin-bottom: 4px;">${data.name}</div>
          <div style="margin-top: 4px; display:flex; flex-direction:column; gap:2px;">
            <div>${props.valueLabel}: <span style="font-weight: 600;">${value.toLocaleString()}${props.valueUnit}</span></div>
            ${rank > 0 ? `<div style="color:#909399;">全国排名: <span style="font-weight:600; color:#1B65A8;">#${rank}</span></div>` : ''}
            <div style="color:#909399;">占比: <span style="font-weight:600; color:#e6a23c;">${pct}%</span></div>
          </div>
        `;
      }
    },
    visualMap: {
      min: valueRange.value.min,
      max: valueRange.value.max,
      left: 20,
      bottom: 20,
      calculable: true,
      itemWidth: 15,
      itemHeight: 100,
      inRange: {
        color: [props.minColor, props.maxColor]
      },
      textStyle: {
        color: '#606266',
        fontSize: 11
      },
      formatter: (value: number) => {
        return `${value.toFixed(0)}${props.valueUnit}`;
      }
    },
    series: [
      {
        type: 'map',
        map: 'china',
        roam: props.roam,
        zoom: props.zoom,
        label: {
          show: props.showLabel,
          color: '#606266',
          fontSize: 10,
          formatter: props.showDetailLabel
            ? (params) => {
                const item = props.data.find(d => d.name === (params as { name: string }).name);
                if (item) return `${item.name}\n${item.value.toLocaleString()}`;
                return (params as { name: string }).name;
              }
            : undefined
        },
        emphasis: {
          label: {
            show: true,
            color: '#303133',
            fontSize: 12,
            fontWeight: 'bold'
          },
          itemStyle: {
            areaColor: '#ffd666',
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.3)'
          }
        },
        itemStyle: {
          areaColor: '#f5f7fa',
          borderColor: '#dcdfe6',
          borderWidth: 1
        },
        select: {
          label: {
            show: true,
            color: '#303133'
          },
          itemStyle: {
            areaColor: '#1B65A8'
          }
        },
        data: props.data.map(d => ({
          name: d.name,
          value: d.value
        }))
      },
      // Scatter overlay if scatterData provided
      ...(props.scatterData && props.scatterData.length > 0
        ? [{
            type: 'effectScatter' as const,
            coordinateSystem: 'geo' as const,
            data: props.scatterData.map(s => ({
              name: s.name,
              value: s.value,
              itemStyle: { color: s.color || '#f56c6c' }
            })),
            symbolSize: (val: number[]) => Math.max(8, Math.min(val[2] / 2, 30)),
            showEffectOn: 'render' as const,
            rippleEffect: {
              brushType: 'stroke' as const,
              scale: 3,
              period: 4
            },
            label: {
              show: false
            },
            emphasis: {
              label: {
                show: true,
                position: 'right' as const,
                formatter: '{b}'
              }
            }
          }]
        : [])
    ]
  };

  return options;
});

// Load and register China map
async function loadChinaMap() {
  mapLoading.value = true;
  mapError.value = null;

  try {
    if (props.geoJson) {
      // Use provided geoJson
      echarts.registerMap('china', props.geoJson as object);
      isMapRegistered.value = true;
    } else {
      // Try to load from CDN or local file
      // Note: In production, you should host this file locally
      const response = await fetch(
        'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json'
      );
      if (!response.ok) {
        throw new Error('Failed to load map data');
      }
      const geoJson = await response.json();
      echarts.registerMap('china', geoJson);
      isMapRegistered.value = true;
    }
  } catch (error) {
    console.error('Failed to load China map:', error);
    mapError.value = 'Failed to load map. Please check network connection.';
    isMapRegistered.value = false;
  } finally {
    mapLoading.value = false;
  }
}

function initChart() {
  if (!chartRef.value || !isMapRegistered.value) return;

  chartInstance.value = echarts.init(chartRef.value, 'cretas');
  chartInstance.value.setOption(chartOptions.value);

  // Click event
  chartInstance.value.on('click', (params) => {
    if (params.componentType === 'series' && params.name) {
      const item = props.data.find(d => d.name === params.name);
      if (item) {
        emit('regionClick', item);
      } else {
        // Emit even if no data, with value 0
        emit('regionClick', {
          name: params.name as string,
          value: 0
        });
      }
    }
  });
}

function updateChart() {
  if (chartInstance.value && isMapRegistered.value) {
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
onMounted(async () => {
  await loadChinaMap();
  if (isMapRegistered.value) {
    initChart();
  }
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

// Watch for map registration
watch(isMapRegistered, (registered) => {
  if (registered && !chartInstance.value) {
    initChart();
  }
});

// Watch for data changes
watch(() => props.data, updateChart, { deep: true });
watch(chartOptions, updateChart, { deep: true });

// Expose methods
defineExpose({
  resize: handleResize,
  getInstance: () => chartInstance.value,
  reloadMap: loadChinaMap
});
</script>

<template>
  <div class="map-chart">
    <div v-if="title" class="chart-header">
      <h3>{{ title }}</h3>
    </div>

    <!-- Loading state -->
    <div v-if="mapLoading" class="map-loading" :style="{ height: height + 'px' }">
      <el-icon class="is-loading" :size="32">
        <svg viewBox="0 0 1024 1024">
          <path
            fill="currentColor"
            d="M512 64a32 32 0 0 1 32 32v192a32 32 0 0 1-64 0V96a32 32 0 0 1 32-32zm0 640a32 32 0 0 1 32 32v192a32 32 0 1 1-64 0V736a32 32 0 0 1 32-32zm448-192a32 32 0 0 1-32 32H736a32 32 0 1 1 0-64h192a32 32 0 0 1 32 32zm-640 0a32 32 0 0 1-32 32H96a32 32 0 0 1 0-64h192a32 32 0 0 1 32 32zM195.2 195.2a32 32 0 0 1 45.248 0L376.32 331.008a32 32 0 0 1-45.248 45.248L195.2 240.448a32 32 0 0 1 0-45.248zm452.544 452.544a32 32 0 0 1 45.248 0L828.8 783.552a32 32 0 0 1-45.248 45.248L647.744 692.992a32 32 0 0 1 0-45.248zM828.8 195.264a32 32 0 0 1 0 45.184L692.992 376.32a32 32 0 0 1-45.248-45.248l135.808-135.808a32 32 0 0 1 45.248 0zm-452.544 452.48a32 32 0 0 1 0 45.248L240.448 828.8a32 32 0 0 1-45.248-45.248l135.808-135.808a32 32 0 0 1 45.248 0z"
          />
        </svg>
      </el-icon>
      <span>Loading map...</span>
    </div>

    <!-- Error state -->
    <div v-else-if="mapError" class="map-error" :style="{ height: height + 'px' }">
      <el-icon :size="48" color="#f56c6c">
        <svg viewBox="0 0 1024 1024">
          <path
            fill="currentColor"
            d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm0 393.664L407.936 353.6a38.4 38.4 0 1 0-54.336 54.336L457.664 512 353.6 616.064a38.4 38.4 0 1 0 54.336 54.336L512 566.336 616.064 670.4a38.4 38.4 0 1 0 54.336-54.336L566.336 512 670.4 407.936a38.4 38.4 0 1 0-54.336-54.336L512 457.664z"
          />
        </svg>
      </el-icon>
      <span>{{ mapError }}</span>
      <el-button type="primary" size="small" @click="loadChinaMap">
        Retry
      </el-button>
    </div>

    <!-- Chart -->
    <div v-else class="chart-container" :style="{ position: 'relative', width: '100%', height: height + 'px' }">
      <div
        ref="chartRef"
        role="img"
        :aria-label="title || '地图图表'"
        style="width: 100%; height: 100%"
      ></div>
      <!-- Zoom controls -->
      <div v-if="showZoomControls" class="zoom-controls">
        <button class="zoom-btn" title="放大" @click="zoomIn">+</button>
        <button class="zoom-btn" title="缩小" @click="zoomOut">−</button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.map-chart {
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

  .map-loading,
  .map-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: #f5f7fa;
    border-radius: 8px;
    color: #909399;

    span {
      font-size: 14px;
    }
  }

  .is-loading {
    animation: rotating 1.5s linear infinite;
  }

  @keyframes rotating {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .chart-container {
    position: relative;
  }

  .zoom-controls {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 10;

    .zoom-btn {
      width: 28px;
      height: 28px;
      border: 1px solid #dcdfe6;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.92);
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
      color: #606266;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      line-height: 1;

      &:hover {
        background: #1B65A8;
        color: #fff;
        border-color: #1B65A8;
      }
    }
  }
}
</style>
