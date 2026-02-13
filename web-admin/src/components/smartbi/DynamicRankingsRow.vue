<script setup lang="ts">
/**
 * DynamicRankingsRow - 动态排行榜组件
 * 遍历 rankings 对象中所有非空排行，自动渲染
 */
import type { RankingItem } from '@/types/smartbi';
import { getRankingDisplayName } from '@/types/smartbi';

interface Props {
  rankings: Record<string, RankingItem[]>;
  loading?: boolean;
}

withDefaults(defineProps<Props>(), {
  loading: false,
});

function getNonEmptyEntries(rankings: Record<string, RankingItem[]>): [string, RankingItem[]][] {
  return Object.entries(rankings).filter(([, items]) => items && items.length > 0);
}

function formatValue(value: number): string {
  if (value >= 10000) return (value / 10000).toFixed(1) + '万';
  return value.toLocaleString();
}

function formatCompletionRate(rate: number): string {
  const diff = rate - 100;
  return (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
}

function getGrowthClass(rate: number): string {
  return rate >= 100 ? 'growth-up' : 'growth-down';
}

function getAlertClass(level: string): string {
  switch (level) {
    case 'RED': return 'alert-red';
    case 'YELLOW': return 'alert-yellow';
    case 'GREEN': return 'alert-green';
    default: return '';
  }
}
</script>

<template>
  <el-row :gutter="16" class="dynamic-rankings-row" v-loading="loading">
    <el-col
      v-for="[key, items] in getNonEmptyEntries(rankings)"
      :key="key"
      :xs="24"
      :md="12"
      class="ranking-col"
    >
      <el-card class="ranking-card">
        <template #header>
          <div class="card-header">
            <span>{{ getRankingDisplayName(key) }}</span>
          </div>
        </template>
        <div class="ranking-list">
          <div
            v-for="(item, index) in items"
            :key="item.name"
            class="ranking-item"
          >
            <div class="rank-badge" :class="'rank-' + (index + 1)">
              {{ index + 1 }}
            </div>
            <div class="rank-info">
              <div class="rank-name" :class="getAlertClass(item.alertLevel)">{{ item.name }}</div>
              <div class="rank-value">{{ formatValue(item.value) }}</div>
            </div>
            <div
              v-if="item.completionRate != null"
              class="rank-rate"
              :class="getGrowthClass(item.completionRate)"
            >
              {{ formatCompletionRate(item.completionRate) }}
            </div>
          </div>
        </div>
      </el-card>
    </el-col>
    <el-col v-if="getNonEmptyEntries(rankings).length === 0 && !loading" :span="24">
      <el-empty description="暂无排行数据" :image-size="80" />
    </el-col>
  </el-row>
</template>

<style lang="scss" scoped>
.dynamic-rankings-row {
  margin-bottom: 16px;

  .ranking-col {
    margin-bottom: 16px;
  }
}

.ranking-card {
  border-radius: var(--radius-lg);

  .card-header {
    font-weight: 600;
    font-size: 15px;
    color: #303133;
  }
}

.ranking-list {
  .ranking-item {
    display: flex;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #f0f2f5;

    &:last-child {
      border-bottom: none;
    }
  }

  .rank-badge {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    background: #f0f2f5;
    color: var(--color-text-secondary);
    flex-shrink: 0;

    &.rank-1 {
      background: linear-gradient(135deg, #FFD700, #FFA500);
      color: #fff;
    }

    &.rank-2 {
      background: linear-gradient(135deg, #C0C0C0, #A8A8A8);
      color: #fff;
    }

    &.rank-3 {
      background: linear-gradient(135deg, #CD7F32, #B8860B);
      color: #fff;
    }
  }

  .rank-info {
    flex: 1;
    margin-left: 12px;

    .rank-name {
      font-size: 14px;
      color: #303133;
      font-weight: 500;

      &.alert-red {
        color: #F56C6C;
      }

      &.alert-yellow {
        color: #E6A23C;
      }
    }

    .rank-value {
      font-size: 12px;
      color: var(--color-text-secondary);
    }
  }

  .rank-rate {
    font-size: 14px;
    font-weight: 500;

    &.growth-up {
      color: #67C23A;
    }

    &.growth-down {
      color: #F56C6C;
    }
  }
}
</style>
