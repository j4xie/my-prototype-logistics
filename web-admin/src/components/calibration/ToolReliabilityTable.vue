<script setup lang="ts">
/**
 * ToolReliabilityTable - 工具可靠性排名表组件
 * 显示工具的成功率、调用次数等统计
 */
import { computed } from 'vue';
import { ArrowUp, ArrowDown, Minus } from '@element-plus/icons-vue';
import type { ToolReliabilityItem } from '@/types/calibration';

interface Props {
  data: ToolReliabilityItem[];
  loading?: boolean;
  showRank?: boolean;
  maxItems?: number;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  showRank: true,
  maxItems: 10
});

const emit = defineEmits<{
  (e: 'toolClick', tool: ToolReliabilityItem): void;
}>();

// 显示的数据（限制数量）
const displayData = computed(() => {
  return props.data.slice(0, props.maxItems);
});

// 获取排名样式类
function getRankClass(rank: number): string {
  if (rank === 1) return 'rank-gold';
  if (rank === 2) return 'rank-silver';
  if (rank === 3) return 'rank-bronze';
  return '';
}

// 获取成功率状态
function getSuccessRateStatus(rate: number): 'success' | 'warning' | 'danger' {
  if (rate >= 95) return 'success';
  if (rate >= 80) return 'warning';
  return 'danger';
}

// 格式化持续时间
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// 格式化最后使用时间
function formatLastUsed(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}小时前`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}天前`;

  return date.toLocaleDateString('zh-CN');
}

function handleToolClick(tool: ToolReliabilityItem) {
  emit('toolClick', tool);
}
</script>

<template>
  <div class="tool-reliability-table" v-loading="loading">
    <div v-if="displayData.length === 0" class="no-data">
      <el-empty description="暂无数据" :image-size="60" />
    </div>
    <div v-else class="ranking-list">
      <div
        v-for="item in displayData"
        :key="item.toolCode"
        class="ranking-item"
        @click="handleToolClick(item)"
      >
        <!-- 排名 -->
        <div v-if="showRank" class="rank-badge" :class="getRankClass(item.rank)">
          {{ item.rank }}
        </div>

        <!-- 工具信息 -->
        <div class="tool-info">
          <div class="tool-name">{{ item.toolName }}</div>
          <div class="tool-code">{{ item.toolCode }}</div>
        </div>

        <!-- 统计数据 -->
        <div class="tool-stats">
          <div class="stat-item">
            <span class="stat-label">成功率</span>
            <el-tag
              :type="getSuccessRateStatus(item.successRate)"
              size="small"
              effect="plain"
            >
              {{ item.successRate.toFixed(1) }}%
            </el-tag>
          </div>
          <div class="stat-item">
            <span class="stat-label">调用次数</span>
            <span class="stat-value">{{ item.totalCalls }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">平均耗时</span>
            <span class="stat-value">{{ formatDuration(item.avgDuration) }}</span>
          </div>
        </div>

        <!-- 趋势 -->
        <div class="tool-trend" :class="'trend-' + item.trend">
          <el-icon>
            <ArrowUp v-if="item.trend === 'up'" />
            <ArrowDown v-else-if="item.trend === 'down'" />
            <Minus v-else />
          </el-icon>
        </div>

        <!-- 最后使用时间 -->
        <div class="last-used">
          {{ formatLastUsed(item.lastUsed) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.tool-reliability-table {
  width: 100%;

  .no-data {
    padding: 40px 0;
    text-align: center;
  }

  .ranking-list {
    .ranking-item {
      display: flex;
      align-items: center;
      padding: 14px 0;
      border-bottom: 1px solid #f0f2f5;
      cursor: pointer;
      transition: background 0.2s;

      &:hover {
        background: #fafafa;
        margin: 0 -12px;
        padding-left: 12px;
        padding-right: 12px;
      }

      &:last-child {
        border-bottom: none;
      }
    }

    .rank-badge {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      background: #f0f2f5;
      color: #909399;
      flex-shrink: 0;

      &.rank-gold {
        background: linear-gradient(135deg, #ffd700, #ffb800);
        color: #fff;
      }

      &.rank-silver {
        background: linear-gradient(135deg, #c0c0c0, #a8a8a8);
        color: #fff;
      }

      &.rank-bronze {
        background: linear-gradient(135deg, #cd7f32, #b8860b);
        color: #fff;
      }
    }

    .tool-info {
      flex: 1;
      min-width: 0;
      margin-left: 12px;

      .tool-name {
        font-size: 14px;
        font-weight: 500;
        color: #303133;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .tool-code {
        font-size: 12px;
        color: #909399;
        margin-top: 2px;
      }
    }

    .tool-stats {
      display: flex;
      gap: 20px;
      margin-left: 16px;

      .stat-item {
        text-align: center;

        .stat-label {
          display: block;
          font-size: 11px;
          color: #909399;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 13px;
          font-weight: 500;
          color: #303133;
        }
      }
    }

    .tool-trend {
      margin-left: 16px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;

      &.trend-up {
        color: #67c23a;
      }

      &.trend-down {
        color: #f56c6c;
      }

      &.trend-flat {
        color: #909399;
      }
    }

    .last-used {
      margin-left: 16px;
      font-size: 12px;
      color: #909399;
      min-width: 70px;
      text-align: right;
    }
  }
}

// 响应式
@media (max-width: 768px) {
  .tool-reliability-table {
    .ranking-list {
      .ranking-item {
        flex-wrap: wrap;
      }

      .tool-stats {
        width: 100%;
        margin-left: 40px;
        margin-top: 8px;
        justify-content: flex-start;
      }

      .tool-trend,
      .last-used {
        display: none;
      }
    }
  }
}
</style>
