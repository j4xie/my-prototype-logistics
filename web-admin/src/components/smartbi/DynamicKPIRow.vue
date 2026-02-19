<script setup lang="ts">
/**
 * DynamicKPIRow - 动态 KPI 卡片行
 * 根据 API 返回的 KPICard[] 动态渲染，自动计算列宽
 */
import type { KPICard } from '@/types/smartbi';
import { Warning } from '@element-plus/icons-vue';
import { formatPlainNumber } from '@/utils/format-number';

interface Props {
  cards: KPICard[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

/** 根据卡片数量计算列宽 (24格系统), 最小6 */
function getColSpan(count: number): number {
  if (count <= 0) return 24;
  const span = Math.floor(24 / count);
  return Math.max(6, Math.min(24, span));
}

function formatValue(card: KPICard): string {
  // Always use rawValue (avoid backend pre-formatted strings like "9.9K")
  // Use formatPlainNumber (no 万/亿) since the template appends unit separately
  if (card.rawValue != null) {
    if (card.rawValue === 0) return '0';
    return formatPlainNumber(card.rawValue, 1);
  }
  // Fallback to backend string only if rawValue missing
  if (card.value) return card.value;
  return '--';
}

function formatChangeRate(rate: number | undefined | null): string {
  if (rate == null) return '';
  // Show actual value — never silently hide real data
  if (rate > 999) return '>+999%';
  if (rate < -999) return '<-999%';
  return (rate >= 0 ? '+' : '') + rate.toFixed(1) + '%';
}

/** True if the change rate is valid and should be displayed */
function isChangeRateValid(rate: number | undefined | null): boolean {
  if (rate == null) return false;
  return true;  // Always show non-null changeRate — never filter by magnitude
}

function getTrendClass(card: KPICard): string {
  if (!isChangeRateValid(card.changeRate)) return '';
  if (card.trend === 'up' || card.changeRate > 0) return 'growth-up';
  if (card.trend === 'down' || card.changeRate < 0) return 'growth-down';
  return '';
}
</script>

<template>
  <el-row :gutter="16" class="dynamic-kpi-row" v-loading="loading">
    <el-col
      v-for="card in cards"
      :key="card.key"
      :xs="24"
      :sm="12"
      :md="getColSpan(cards.length)"
      class="kpi-col"
    >
      <el-card class="kpi-card" shadow="hover">
        <div class="kpi-label">{{ card.title }}</div>
        <div class="kpi-value">{{ formatValue(card) }}
          <span v-if="card.unit" class="kpi-unit">{{ card.unit }}</span>
        </div>
        <div
          class="kpi-trend"
          :class="getTrendClass(card)"
          v-if="card.changeRate != null && isChangeRateValid(card.changeRate)"
        >
          <span>{{ formatChangeRate(card.changeRate) }}</span>
          <el-tooltip v-if="Math.abs(card.changeRate) >= 500" content="异常波动，可能源于季节性或数据变化" placement="top">
            <el-icon class="anomaly-icon"><Warning /></el-icon>
          </el-tooltip>
          <span v-if="card.compareText" class="compare-text">{{ card.compareText }}</span>
        </div>
      </el-card>
    </el-col>
    <el-col v-if="cards.length === 0 && !loading" :span="24">
      <el-empty description="暂无 KPI 数据" :image-size="80" />
    </el-col>
  </el-row>
</template>

<style lang="scss" scoped>
.dynamic-kpi-row {
  margin-bottom: 16px;

  .kpi-col {
    margin-bottom: 16px;
  }
}

.kpi-card {
  border-radius: var(--radius-md);
  text-align: center;
  padding: 8px 0;

  .kpi-label {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin-bottom: 8px;
  }

  .kpi-value {
    font-size: var(--font-size-2xl);
    font-weight: 600;
    color: #303133;
    margin-bottom: 6px;
    font-variant-numeric: tabular-nums;

    .kpi-unit {
      font-size: 14px;
      font-weight: 400;
      color: var(--color-text-secondary);
      margin-left: 2px;
    }
  }

  .kpi-trend {
    font-size: 14px;
    font-weight: 500;

    &.growth-up {
      color: #67C23A;
    }

    &.growth-down {
      color: #F56C6C;
    }

    .anomaly-icon {
      margin-left: 4px;
      color: #E6A23C;
      vertical-align: middle;
      font-size: 14px;
    }

    .compare-text {
      margin-left: 6px;
      font-size: 12px;
      color: var(--color-text-secondary);
      font-weight: normal;
    }
  }
}
</style>
