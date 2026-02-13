<script setup lang="ts">
/**
 * SmartBI MapChart - China Map Visualization Component
 * Features: Province data visualization, tooltip, click events
 * Note: Requires china.json geo data to be registered
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import echarts from '@/utils/echarts';
import type { EChartsOption, ECharts } from 'echarts';

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
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  height: 500,
  valueLabel: 'Value',
  valueUnit: '',
  minColor: '#e0f3ff',
  maxColor: '#409eff',
  showLabel: true,
  zoom: 1.2,
  roam: true,
  geoJson: undefined
});

const emit = defineEmits<{
  (e: 'regionClick', data: MapDataItem): void;
}>();

const chartRef = ref<HTMLDivElement | null>(null);
const chartInstance = ref<ECharts | null>(null);
const isMapRegistered = ref(false);
const mapLoading = ref(true);
const mapError = ref<string | null>(null);

// Calculate value range
const valueRange = computed(() => {
  const values = props.data.map(d => d.value);
  return {
    min: Math.min(...values, 0),
    max: Math.max(...values, 1)
  };
});

const chartOptions = computed<EChartsOption>(() => {
  if (!isMapRegistered.value) {
    return {};
  }

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
        const value = data.value ?? 0;
        return `
          <div style="font-weight: 600;">${data.name}</div>
          <div style="margin-top: 4px;">
            ${props.valueLabel}: <span style="font-weight: 600;">${value}${props.valueUnit}</span>
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
          fontSize: 10
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
            areaColor: '#409eff'
          }
        },
        data: props.data.map(d => ({
          name: d.name,
          value: d.value
        }))
      }
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
  chartInstance.value?.resize();
}

// Lifecycle
onMounted(async () => {
  await loadChinaMap();
  if (isMapRegistered.value) {
    initChart();
  }
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
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
    <div
      v-else
      ref="chartRef"
      :style="{ width: '100%', height: height + 'px' }"
    ></div>
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
}
</style>
