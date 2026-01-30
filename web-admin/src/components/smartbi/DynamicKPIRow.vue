<script setup lang="ts">
/**
 * DynamicKPIRow - 动态 KPI 卡片行
 * 根据 API 返回的 KPICard[] 动态渲染，自动计算列宽
 */
import type { KPICard } from '@/types/smartbi';

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
  if (card.value) return card.value;
  if (card.rawValue == null) return '--';
  if (card.rawValue >= 10000) return (card.rawValue / 10000).toFixed(1) + '万';
  return card.rawValue.toLocaleString();
}

function formatChangeRate(rate: number): string {
  return (rate >= 0 ? '+' : '') + rate.toFixed(1) + '%';
}

function getTrendClass(card: KPICard): string {
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
          v-if="card.changeRate != null"
        >
          <span>{{ formatChangeRate(card.changeRate) }}</span>
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
  border-radius: 8px;
  text-align: center;
  padding: 8px 0;

  .kpi-label {
    font-size: 13px;
    color: #909399;
    margin-bottom: 8px;
  }

  .kpi-value {
    font-size: 26px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 6px;

    .kpi-unit {
      font-size: 14px;
      font-weight: 400;
      color: #909399;
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

    .compare-text {
      margin-left: 6px;
      font-size: 12px;
      color: #909399;
      font-weight: normal;
    }
  }
}
</style>
