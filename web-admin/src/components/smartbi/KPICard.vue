<script setup lang="ts">
/**
 * SmartBI KPICard - Key Performance Indicator Card Component
 * Features: Title, value, unit, trend arrow, status color
 */
import { computed } from 'vue';

// Types
export type TrendDirection = 'up' | 'down' | 'flat';
export type StatusType = 'success' | 'warning' | 'danger' | 'info' | 'default';

interface Props {
  title: string;
  value: number | string;
  unit?: string;
  subtitle?: string;
  trend?: TrendDirection;
  trendValue?: number | string;
  trendLabel?: string;
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
}

const props = withDefaults(defineProps<Props>(), {
  unit: '',
  subtitle: '',
  trend: undefined,
  trendValue: undefined,
  trendLabel: '',
  status: 'default',
  icon: '',
  loading: false,
  clickable: false,
  format: 'number',
  precision: 0,
  prefix: '',
  suffix: '',
  targetValue: undefined,
  showProgress: false
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
      formatted = val.toFixed(props.precision);
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
      <div v-if="trend" class="kpi-trend" :style="{ color: trendColors[trend] }">
        <span class="trend-arrow">
          <template v-if="trend === 'up'">&#8593;</template>
          <template v-else-if="trend === 'down'">&#8595;</template>
          <template v-else>&#8594;</template>
        </span>
        <span v-if="trendValue !== undefined" class="trend-value">
          {{ trendValue }}{{ trendLabel }}
        </span>
      </div>
    </div>

    <!-- Value -->
    <div class="kpi-value" :style="{ color: currentStatusColor.text }">
      {{ formattedValue }}
      <span v-if="unit" class="kpi-unit">{{ unit }}</span>
    </div>

    <!-- Subtitle -->
    <div v-if="subtitle" class="kpi-subtitle">
      {{ subtitle }}
    </div>

    <!-- Progress bar -->
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
  border-radius: 8px;
  border: 1px solid;
  transition: all 0.2s ease;
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
  gap: 4px;
  font-size: 12px;
  font-weight: 500;

  .trend-arrow {
    font-size: 14px;
    font-weight: bold;
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
</style>
