<script setup lang="ts">
/**
 * SmartBI KPICard - Key Performance Indicator Card Component
 * Features: Title, value, unit, trend arrow, status color
 * Display Modes: default, sparkline, progressBar, waterWave
 */
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';

// Types
export type TrendDirection = 'up' | 'down' | 'flat';
export type StatusType = 'success' | 'warning' | 'danger' | 'info' | 'default';
export type DisplayMode = 'default' | 'sparkline' | 'progressBar' | 'waterWave';

export interface SubMetric {
  label: string;
  value: string | number;
}

interface Props {
  title: string;
  value: number | string;
  unit?: string;
  subtitle?: string;
  trend?: TrendDirection;
  trendValue?: number | string;
  trendLabel?: string;
  change?: number;       // Absolute change value (e.g., +1234)
  changeRate?: number;   // Period-over-period change rate in % (e.g., +12.3)
  status?: StatusType;
  icon?: string;
  loading?: boolean;
  clickable?: boolean;
  format?: 'number' | 'currency' | 'percent' | 'custom';
  precision?: number;
  prefix?: string;
  suffix?: string;
  targetValue?: number;
  showProgress?: boolean;
  // New props for enhanced display modes
  displayMode?: DisplayMode;
  sparklineData?: number[];
  progressValue?: number;
  progressColor?: string;
  subMetrics?: SubMetric[];
  // P1: Industry benchmark comparison
  benchmarkLabel?: string;
  benchmarkGap?: number;
}

const props = withDefaults(defineProps<Props>(), {
  unit: '',
  subtitle: '',
  trend: undefined,
  trendValue: undefined,
  trendLabel: '',
  change: undefined,
  changeRate: undefined,
  status: 'default',
  icon: '',
  loading: false,
  clickable: false,
  format: 'number',
  precision: 0,
  prefix: '',
  suffix: '',
  targetValue: undefined,
  showProgress: false,
  // New defaults
  displayMode: 'default',
  sparklineData: () => [],
  progressValue: 0,
  progressColor: '',
  subMetrics: () => [],
  benchmarkLabel: '',
  benchmarkGap: undefined,
});

const emit = defineEmits<{
  (e: 'click'): void;
}>();

// Status colors
const statusColors: Record<StatusType, { bg: string; text: string; border: string }> = {
  success: { bg: '#f0f9eb', text: '#67c23a', border: '#e1f3d8' },
  warning: { bg: '#fdf6ec', text: '#e6a23c', border: '#faecd8' },
  danger: { bg: '#fef0f0', text: '#f56c6c', border: '#fde2e2' },
  info: { bg: '#f4f4f5', text: '#909399', border: '#e9e9eb' },
  default: { bg: '#ffffff', text: '#303133', border: '#ebeef5' }
};

// Trend colors
const trendColors: Record<TrendDirection, string> = {
  up: '#67c23a',
  down: '#f56c6c',
  flat: '#909399'
};

// Format value based on format type
const formattedValue = computed(() => {
  const val = typeof props.value === 'number' ? props.value : parseFloat(props.value);

  if (isNaN(val)) return props.value;

  let formatted: string;

  switch (props.format) {
    case 'currency':
      formatted = new Intl.NumberFormat('zh-CN', {
        minimumFractionDigits: props.precision,
        maximumFractionDigits: props.precision
      }).format(val);
      break;
    case 'percent':
      formatted = (val * 100).toFixed(props.precision) + '%';
      break;
    case 'number':
    default:
      if (val >= 1000000) {
        formatted = (val / 1000000).toFixed(1) + 'M';
      } else if (val >= 1000) {
        formatted = (val / 1000).toFixed(1) + 'K';
      } else {
        formatted = val.toFixed(props.precision);
      }
  }

  return `${props.prefix}${formatted}${props.suffix}`;
});

// Calculate progress if target is set
const progressPercent = computed(() => {
  if (props.targetValue === undefined) return 0;
  const val = typeof props.value === 'number' ? props.value : parseFloat(props.value);
  if (isNaN(val)) return 0;
  return Math.min((val / props.targetValue) * 100, 100);
});

// Get progress color based on percentage
const progressColor = computed(() => {
  if (progressPercent.value >= 100) return '#67c23a';
  if (progressPercent.value >= 70) return '#409eff';
  if (progressPercent.value >= 50) return '#e6a23c';
  return '#f56c6c';
});

const currentStatusColor = computed(() => statusColors[props.status]);

// Sparkline SVG path computation
const sparklinePath = computed(() => {
  const rawData = props.sparklineData;
  if (!rawData || rawData.length < 2) return '';

  const data = rawData.filter(v => Number.isFinite(v));
  if (data.length < 2) return '';

  const width = 50;
  const height = 20;
  const padding = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  return `M ${points.join(' L ')}`;
});

// Sparkline color based on trend
const sparklineColor = computed(() => {
  const data = props.sparklineData;
  if (!data || data.length < 2) return '#909399';
  const filtered = data.filter(v => Number.isFinite(v));
  if (filtered.length < 2) return '#909399';
  return filtered[filtered.length - 1] >= filtered[0] ? '#67c23a' : '#f56c6c';
});

// Period-over-period change display (FineBI + Power BI + Grafana)
const formattedChange = computed(() => {
  if (props.changeRate == null) return null;
  const sign = props.changeRate > 0 ? '+' : '';
  return `${sign}${props.changeRate.toFixed(1)}%`;
});

const changeColor = computed(() => {
  if (props.changeRate == null) return '#909399';
  if (props.changeRate > 0) return '#059669';
  if (props.changeRate < 0) return '#dc2626';
  return '#909399';
});

// Progress bar display mode color
const displayProgressColor = computed(() => {
  if (props.progressColor) return props.progressColor;
  const val = props.progressValue;
  if (val >= 80) return '#67c23a';
  if (val >= 50) return '#e6a23c';
  return '#f56c6c';
});

// Water wave animation offset
let animationId: number | null = null;
const waveOffset = ref(0);
onMounted(() => {
  if (props.displayMode === 'waterWave') {
    const animate = () => {
      waveOffset.value = (waveOffset.value + 1) % 100;
      animationId = requestAnimationFrame(animate);
    };
    animate();
  }
});
onBeforeUnmount(() => {
  if (animationId != null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
});

// Water level based on progress value
const waterLevel = computed(() => {
  return Math.max(0, Math.min(100, props.progressValue));
});

function handleClick() {
  if (props.clickable) {
    emit('click');
  }
}
</script>

<template>
  <div
    class="kpi-card"
    :class="{
      'is-clickable': clickable,
      'is-loading': loading
    }"
    :style="{
      backgroundColor: currentStatusColor.bg,
      borderColor: currentStatusColor.border
    }"
    @click="handleClick"
  >
    <!-- Loading overlay -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
    </div>

    <!-- Header -->
    <div class="kpi-header">
      <div class="kpi-title">
        <span v-if="icon" class="kpi-icon">
          <el-icon :size="16">
            <component :is="icon" />
          </el-icon>
        </span>
        <span>{{ title }}</span>
      </div>
      <div v-if="trend || formattedChange" class="kpi-trend" :style="{ color: formattedChange ? changeColor : trendColors[trend!] }">
        <span class="trend-arrow">
          <template v-if="(changeRate != null ? changeRate > 0 : trend === 'up')">&#9650;</template>
          <template v-else-if="(changeRate != null ? changeRate < 0 : trend === 'down')">&#9660;</template>
          <template v-else>&#9654;</template>
        </span>
        <span v-if="formattedChange" class="trend-value">{{ formattedChange }}</span>
        <span v-else-if="trendValue !== undefined" class="trend-value">{{ trendValue }}{{ trendLabel }}</span>
      </div>
    </div>

    <!-- Value Section with Display Modes -->
    <div class="kpi-value-section" :class="`mode-${displayMode}`">
      <!-- Water Wave Mode -->
      <div v-if="displayMode === 'waterWave'" class="water-wave-container">
        <div class="water-wave-circle">
          <div
            class="water-fill"
            :style="{
              height: waterLevel + '%',
              backgroundColor: displayProgressColor
            }"
          >
            <div class="wave wave-1" :style="{ animationDelay: '0s' }"></div>
            <div class="wave wave-2" :style="{ animationDelay: '-0.5s' }"></div>
          </div>
          <div class="water-value">
            <span class="water-number">{{ formattedValue }}</span>
            <span v-if="unit" class="water-unit">{{ unit }}</span>
          </div>
        </div>
      </div>

      <!-- Default/Sparkline/ProgressBar Value Display -->
      <template v-else>
        <div class="kpi-value-row">
          <div class="kpi-value" :style="{ color: currentStatusColor.text }">
            {{ formattedValue }}
            <span v-if="unit" class="kpi-unit">{{ unit }}</span>
          </div>

          <!-- Sparkline Mode: Mini Chart -->
          <svg
            v-if="displayMode === 'sparkline' && sparklineData && sparklineData.length >= 2"
            class="sparkline-chart"
            width="50"
            height="20"
            viewBox="0 0 50 20"
          >
            <path
              :d="sparklinePath"
              fill="none"
              :stroke="sparklineColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>

        <!-- ProgressBar Mode: Progress indicator -->
        <div v-if="displayMode === 'progressBar'" class="display-progress">
          <div class="display-progress-bar">
            <div
              class="display-progress-fill"
              :style="{
                width: Math.min(progressValue, 100) + '%',
                backgroundColor: displayProgressColor
              }"
            ></div>
          </div>
          <span class="display-progress-value">{{ progressValue }}%</span>
        </div>
      </template>
    </div>

    <!-- Subtitle -->
    <div v-if="subtitle" class="kpi-subtitle">
      {{ subtitle }}
    </div>

    <!-- Benchmark comparison (P1) -->
    <div v-if="benchmarkLabel" class="kpi-benchmark">
      <span class="benchmark-label">{{ benchmarkLabel }}</span>
      <span
        v-if="benchmarkGap != null"
        class="benchmark-gap"
        :class="{ positive: benchmarkGap >= 0, negative: benchmarkGap < 0 }"
      >
        {{ benchmarkGap >= 0 ? '+' : '' }}{{ benchmarkGap.toFixed(1) }}pp
      </span>
    </div>

    <!-- Sub-metrics Section -->
    <div v-if="subMetrics && subMetrics.length > 0" class="kpi-sub-metrics">
      <div
        v-for="(metric, index) in subMetrics.slice(0, 3)"
        :key="index"
        class="sub-metric-item"
      >
        <span class="sub-metric-label">{{ metric.label }}:</span>
        <span class="sub-metric-value">{{ metric.value }}</span>
      </div>
    </div>

    <!-- Legacy Progress bar (backward compatibility) -->
    <div v-if="showProgress && targetValue !== undefined" class="kpi-progress">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{
            width: progressPercent + '%',
            backgroundColor: progressColor
          }"
        ></div>
      </div>
      <div class="progress-label">
        <span>{{ progressPercent.toFixed(0) }}% of target</span>
        <span>{{ targetValue }}{{ unit }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.kpi-card {
  position: relative;
  padding: 20px;
  border-radius: 12px;
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;

  &.is-clickable {
    cursor: pointer;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
  }

  &.is-loading {
    .kpi-header,
    .kpi-value,
    .kpi-subtitle,
    .kpi-progress {
      opacity: 0.3;
    }
  }
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.5);
  z-index: 10;

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid #dcdfe6;
    border-top-color: #409eff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
}

.kpi-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.kpi-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #909399;
  font-weight: 500;

  .kpi-icon {
    display: flex;
    align-items: center;
  }
}

.kpi-trend {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  background: currentColor;
  -webkit-background-clip: text;
  background-clip: text;

  .trend-arrow {
    font-size: 10px;
  }

  .trend-value {
    font-size: 12px;
  }
}

.kpi-value {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 4px;

  .kpi-unit {
    font-size: 16px;
    font-weight: 400;
    margin-left: 4px;
    opacity: 0.8;
  }
}

.kpi-subtitle {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.kpi-progress {
  margin-top: 16px;

  .progress-bar {
    height: 6px;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
    overflow: hidden;

    .progress-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
    }
  }

  .progress-label {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 11px;
    color: #909399;
  }
}

// Value section with display modes
.kpi-value-section {
  &.mode-waterWave {
    display: flex;
    justify-content: center;
    margin: 8px 0;
  }
}

.kpi-value-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

// Sparkline chart styles
.sparkline-chart {
  flex-shrink: 0;
}

// ProgressBar display mode styles
.display-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;

  .display-progress-bar {
    flex: 1;
    height: 8px;
    background: rgba(0, 0, 0, 0.08);
    border-radius: 4px;
    overflow: hidden;

    .display-progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease, background-color 0.3s ease;
    }
  }

  .display-progress-value {
    font-size: 12px;
    font-weight: 600;
    color: #606266;
    min-width: 36px;
    text-align: right;
  }
}

// Water wave styles
.water-wave-container {
  display: flex;
  justify-content: center;
}

.water-wave-circle {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: #f5f7fa;
  border: 3px solid #dcdfe6;
  overflow: hidden;

  .water-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    transition: height 0.5s ease;
    opacity: 0.8;

    .wave {
      position: absolute;
      top: -8px;
      left: -50%;
      width: 200%;
      height: 16px;
      background: inherit;
      opacity: 0.6;

      &::before {
        content: '';
        position: absolute;
        width: 100%;
        height: 100%;
        background: radial-gradient(ellipse at center, transparent 50%, currentColor 50%);
        background-size: 20px 16px;
        background-repeat: repeat-x;
      }
    }

    .wave-1 {
      animation: wave-move 3s linear infinite;
    }

    .wave-2 {
      top: -4px;
      opacity: 0.4;
      animation: wave-move 4s linear infinite reverse;
    }
  }

  .water-value {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    z-index: 10;

    .water-number {
      display: block;
      font-size: 20px;
      font-weight: 700;
      color: #303133;
      line-height: 1.2;
    }

    .water-unit {
      display: block;
      font-size: 11px;
      color: #909399;
      margin-top: 2px;
    }
  }
}

@keyframes wave-move {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(50%);
  }
}

// Benchmark comparison
.kpi-benchmark {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 6px;
  font-size: 11px;

  .benchmark-label {
    color: #909399;
  }

  .benchmark-gap {
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;

    &.positive {
      color: #059669;
      background: rgba(5, 150, 105, 0.1);
    }

    &.negative {
      color: #dc2626;
      background: rgba(220, 38, 38, 0.1);
    }
  }
}

// Sub-metrics section
.kpi-sub-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed rgba(0, 0, 0, 0.1);

  .sub-metric-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;

    .sub-metric-label {
      color: #909399;
    }

    .sub-metric-value {
      color: #606266;
      font-weight: 500;
    }
  }
}
</style>
