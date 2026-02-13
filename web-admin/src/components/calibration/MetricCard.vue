<script setup lang="ts">
/**
 * MetricCard - AI 行为校准指标卡片组件
 * 显示单个指标的值、趋势和状态
 */
import { computed } from 'vue';
import { ArrowUp, ArrowDown, Minus } from '@element-plus/icons-vue';

export type TrendDirection = 'up' | 'down' | 'flat';
export type StatusType = 'success' | 'warning' | 'danger' | 'info';

interface Props {
  label: string;
  value: number;
  unit?: string;
  change?: number;
  changeLabel?: string;
  trend?: TrendDirection;
  status?: StatusType;
  description?: string;
  loading?: boolean;
  precision?: number;
  format?: 'number' | 'percent' | 'score';
}

const props = withDefaults(defineProps<Props>(), {
  unit: '',
  change: 0,
  changeLabel: '较上周',
  trend: 'flat',
  status: 'info',
  description: '',
  loading: false,
  precision: 1,
  format: 'number'
});

const emit = defineEmits<{
  (e: 'click'): void;
}>();

// 状态颜色配置
const statusConfig: Record<StatusType, { bg: string; text: string; border: string; icon: string }> = {
  success: { bg: '#f0f9eb', text: '#67c23a', border: '#e1f3d8', icon: '#67c23a' },
  warning: { bg: '#fdf6ec', text: '#e6a23c', border: '#faecd8', icon: '#e6a23c' },
  danger: { bg: '#fef0f0', text: '#f56c6c', border: '#fde2e2', icon: '#f56c6c' },
  info: { bg: '#f4f4f5', text: '#409eff', border: '#e9e9eb', icon: '#409eff' }
};

// 趋势颜色
const trendColors: Record<TrendDirection, string> = {
  up: '#67c23a',
  down: '#f56c6c',
  flat: '#909399'
};

// 格式化显示值
const formattedValue = computed(() => {
  const val = props.value;

  switch (props.format) {
    case 'percent':
      return val.toFixed(props.precision) + '%';
    case 'score':
      return val.toFixed(props.precision);
    case 'number':
    default:
      if (val >= 1000000) {
        return (val / 1000000).toFixed(1) + 'M';
      } else if (val >= 1000) {
        return (val / 1000).toFixed(1) + 'K';
      }
      return val.toFixed(props.precision);
  }
});

// 格式化变化值
const formattedChange = computed(() => {
  const val = Math.abs(props.change);
  const sign = props.change >= 0 ? '+' : '-';
  return `${sign}${val.toFixed(props.precision)}${props.format === 'percent' ? '%' : ''}`;
});

const currentStatus = computed(() => statusConfig[props.status]);

function handleClick() {
  emit('click');
}
</script>

<template>
  <div
    class="metric-card"
    :class="{ 'is-loading': loading }"
    :style="{
      backgroundColor: currentStatus.bg,
      borderColor: currentStatus.border
    }"
    @click="handleClick"
  >
    <!-- Loading overlay -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
    </div>

    <!-- Header -->
    <div class="metric-header">
      <span class="metric-label">{{ label }}</span>
      <el-tooltip v-if="description" :content="description" placement="top">
        <el-icon class="info-icon"><InfoFilled /></el-icon>
      </el-tooltip>
    </div>

    <!-- Value -->
    <div class="metric-value" :style="{ color: currentStatus.text }">
      {{ formattedValue }}
      <span v-if="unit" class="metric-unit">{{ unit }}</span>
    </div>

    <!-- Trend -->
    <div class="metric-trend" :style="{ color: trendColors[trend] }">
      <el-icon class="trend-icon">
        <ArrowUp v-if="trend === 'up'" />
        <ArrowDown v-else-if="trend === 'down'" />
        <Minus v-else />
      </el-icon>
      <span class="trend-value">{{ formattedChange }}</span>
      <span class="trend-label">{{ changeLabel }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import { InfoFilled } from '@element-plus/icons-vue';
export default {
  components: { InfoFilled }
};
</script>

<style lang="scss" scoped>
.metric-card {
  position: relative;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid;
  cursor: pointer;
  transition: all var(--transition-fast, 0.2s ease);
  overflow: hidden;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  &.is-loading {
    .metric-header,
    .metric-value,
    .metric-trend {
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

.metric-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  .metric-label {
    font-size: 14px;
    color: #606266;
    font-weight: 500;
  }

  .info-icon {
    color: #909399;
    cursor: help;
    font-size: 14px;
  }
}

.metric-value {
  font-size: 36px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 12px;

  .metric-unit {
    font-size: 16px;
    font-weight: 400;
    margin-left: 4px;
    opacity: 0.7;
  }
}

.metric-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;

  .trend-icon {
    font-size: 14px;
  }

  .trend-value {
    font-weight: 600;
  }

  .trend-label {
    color: #909399;
    margin-left: 4px;
  }
}

// 响应式
@media (max-width: 768px) {
  .metric-card {
    min-height: 120px;
    padding: 16px;
  }

  .metric-value {
    font-size: 28px;
  }
}
</style>
