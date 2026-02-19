<script setup lang="ts">
/**
 * SmartBI AIInsightPanel - AI Analysis Insights Display Component
 * Features: Positive insights, negative/concerns, suggestions with collapsible sections
 * Style reference: Guanyuan BI Rule Insights
 */
import { ref, computed } from 'vue';
import { ElCollapse, ElCollapseItem, ElSkeleton, ElSkeletonItem, ElIcon, ElTooltip } from 'element-plus';
import {
  CircleCheckFilled,
  WarningFilled,
  InfoFilled,
  ArrowDown,
  ArrowUp,
  Clock
} from '@element-plus/icons-vue';

// Types
export interface InsightSection {
  title: string;
  items: string[];
}

export interface AIInsight {
  positive: InsightSection;   // Good aspects
  negative: InsightSection;   // Concerns
  suggestions: InsightSection; // Recommendations
  confidence?: number;        // Insight confidence (0-100)
  generatedAt?: string;       // Generation timestamp
}

interface Props {
  title?: string;
  insight: AIInsight | null;
  loading?: boolean;
  error?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'AI 分析结论',
  loading: false,
  error: '',
  collapsible: true,
  defaultExpanded: true
});

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'collapse', collapsed: boolean): void;
}>();

// State
const isExpanded = ref(props.defaultExpanded);
const activeNames = ref(['positive', 'negative', 'suggestions']);

// Computed
const hasContent = computed(() => {
  if (!props.insight) return false;
  return (
    (props.insight.positive?.items?.length ?? 0) > 0 ||
    (props.insight.negative?.items?.length ?? 0) > 0 ||
    (props.insight.suggestions?.items?.length ?? 0) > 0
  );
});

const formattedTime = computed(() => {
  if (!props.insight?.generatedAt) return '';
  const date = new Date(props.insight.generatedAt);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
});

const confidenceClass = computed(() => {
  const confidence = props.insight?.confidence ?? 0;
  if (confidence >= 80) return 'high';
  if (confidence >= 60) return 'medium';
  return 'low';
});

// Methods
function toggleExpand() {
  if (!props.collapsible) return;
  isExpanded.value = !isExpanded.value;
  emit('collapse', !isExpanded.value);
}

function handleRefresh() {
  emit('refresh');
}
</script>

<template>
  <div class="ai-insight-panel" :class="{ 'is-collapsed': !isExpanded }">
    <!-- Header -->
    <div class="panel-header" @click="toggleExpand">
      <div class="header-left">
        <span class="header-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        </span>
        <span class="header-title">{{ title }}</span>

        <!-- Confidence badge -->
        <el-tooltip
          v-if="insight?.confidence !== undefined"
          :content="`AI 置信度: ${insight.confidence}%`"
          placement="top"
        >
          <span class="confidence-badge" :class="confidenceClass">
            {{ insight.confidence }}%
          </span>
        </el-tooltip>
      </div>

      <div class="header-right">
        <!-- Generation time -->
        <span v-if="formattedTime" class="generated-time">
          <el-icon :size="14"><Clock /></el-icon>
          {{ formattedTime }}
        </span>

        <!-- Collapse toggle -->
        <span v-if="collapsible" class="collapse-toggle">
          <el-icon :size="16">
            <ArrowUp v-if="isExpanded" />
            <ArrowDown v-else />
          </el-icon>
        </span>
      </div>
    </div>

    <!-- Content -->
    <div v-show="isExpanded" class="panel-content">
      <!-- Loading state -->
      <div v-if="loading" class="loading-state">
        <el-skeleton :rows="3" animated>
          <template #template>
            <div class="skeleton-section">
              <el-skeleton-item variant="text" style="width: 30%; height: 16px; margin-bottom: 12px;" />
              <el-skeleton-item variant="text" style="width: 90%; margin-bottom: 8px;" />
              <el-skeleton-item variant="text" style="width: 85%; margin-bottom: 8px;" />
              <el-skeleton-item variant="text" style="width: 70%;" />
            </div>
            <div class="skeleton-section">
              <el-skeleton-item variant="text" style="width: 25%; height: 16px; margin-bottom: 12px;" />
              <el-skeleton-item variant="text" style="width: 88%; margin-bottom: 8px;" />
              <el-skeleton-item variant="text" style="width: 75%;" />
            </div>
            <div class="skeleton-section">
              <el-skeleton-item variant="text" style="width: 20%; height: 16px; margin-bottom: 12px;" />
              <el-skeleton-item variant="text" style="width: 92%; margin-bottom: 8px;" />
              <el-skeleton-item variant="text" style="width: 80%;" />
            </div>
          </template>
        </el-skeleton>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="error-state">
        <el-icon :size="40" color="#f56c6c"><WarningFilled /></el-icon>
        <p class="error-message">{{ error }}</p>
        <button class="retry-button" @click.stop="handleRefresh">
          重新生成
        </button>
      </div>

      <!-- Empty state -->
      <div v-else-if="!hasContent" class="empty-state">
        <el-icon :size="40" color="#909399"><InfoFilled /></el-icon>
        <p class="empty-message">暂无分析结论</p>
      </div>

      <!-- Insight content -->
      <template v-else>
        <!-- Positive Section -->
        <div v-if="insight?.positive?.items?.length" class="insight-section positive">
          <div class="section-header">
            <el-icon :size="16" color="#67c23a"><CircleCheckFilled /></el-icon>
            <span class="section-title">{{ insight!.positive.title || '好的方面' }}</span>
            <span class="item-count">{{ insight!.positive.items.length }}</span>
          </div>
          <ul class="insight-list">
            <li v-for="(item, index) in insight!.positive.items" :key="`positive-${index}`">
              <span class="bullet positive-bullet"></span>
              <span class="item-text">{{ item }}</span>
            </li>
          </ul>
        </div>

        <!-- Negative Section -->
        <div v-if="insight?.negative?.items?.length" class="insight-section negative">
          <div class="section-header">
            <el-icon :size="16" color="#e6a23c"><WarningFilled /></el-icon>
            <span class="section-title">{{ insight!.negative.title || '需关注' }}</span>
            <span class="item-count">{{ insight!.negative.items.length }}</span>
          </div>
          <ul class="insight-list">
            <li v-for="(item, index) in insight!.negative.items" :key="`negative-${index}`">
              <span class="bullet negative-bullet"></span>
              <span class="item-text">{{ item }}</span>
            </li>
          </ul>
        </div>

        <!-- Suggestions Section -->
        <div v-if="insight?.suggestions?.items?.length" class="insight-section suggestions">
          <div class="section-header">
            <el-icon :size="16" color="#409eff"><InfoFilled /></el-icon>
            <span class="section-title">{{ insight!.suggestions.title || '建议' }}</span>
            <span class="item-count">{{ insight!.suggestions.items.length }}</span>
          </div>
          <ul class="insight-list">
            <li v-for="(item, index) in insight!.suggestions.items" :key="`suggestion-${index}`">
              <span class="bullet suggestion-bullet"></span>
              <span class="item-text">{{ item }}</span>
            </li>
          </ul>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ai-insight-panel {
  background: linear-gradient(135deg, #fafbfc 0%, #f5f7fa 100%);
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  }

  &.is-collapsed {
    .panel-content {
      display: none;
    }
  }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  cursor: pointer;
  user-select: none;
  transition: background 0.3s ease;

  &:hover {
    background: linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%);
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 6px;

    svg {
      opacity: 0.95;
    }
  }

  .header-title {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.3px;
  }
}

.confidence-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;

  &.high {
    background: rgba(103, 194, 58, 0.2);
    color: #a8e6a1;
  }

  &.medium {
    background: rgba(230, 162, 60, 0.2);
    color: #fad68a;
  }

  &.low {
    background: rgba(245, 108, 108, 0.2);
    color: #f8b4b4;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;

  .generated-time {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    opacity: 0.85;
  }

  .collapse-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.15);
    transition: background 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.25);
    }
  }
}

.panel-content {
  padding: 20px;
}

// Loading state
.loading-state {
  .skeleton-section {
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px dashed #e4e7ed;

    &:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
  }
}

// Error state
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  text-align: center;

  .error-message {
    margin: 16px 0;
    color: #909399;
    font-size: 14px;
  }

  .retry-button {
    padding: 8px 20px;
    border: 1px solid #409eff;
    border-radius: 4px;
    background: transparent;
    color: #409eff;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: #409eff;
      color: #fff;
    }
  }
}

// Empty state
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  text-align: center;

  .empty-message {
    margin-top: 12px;
    color: #909399;
    font-size: 14px;
  }
}

// Insight sections
.insight-section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px dashed #e4e7ed;

  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  &.positive {
    .section-header {
      color: #67c23a;
    }
  }

  &.negative {
    .section-header {
      color: #e6a23c;
    }
  }

  &.suggestions {
    .section-header {
      color: #409eff;
    }
  }
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;

  .section-title {
    font-size: 14px;
    font-weight: 600;
  }

  .item-count {
    padding: 1px 6px;
    border-radius: 8px;
    background: currentColor;
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    opacity: 0.8;
  }
}

.insight-list {
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 0;
    transition: background 0.2s;
    border-radius: 4px;
    margin: 0 -8px;
    padding-left: 8px;
    padding-right: 8px;

    &:hover {
      background: rgba(0, 0, 0, 0.02);
    }
  }

  .bullet {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    margin-top: 7px;
    border-radius: 50%;

    &.positive-bullet {
      background: #67c23a;
    }

    &.negative-bullet {
      background: #e6a23c;
    }

    &.suggestion-bullet {
      background: #409eff;
    }
  }

  .item-text {
    flex: 1;
    font-size: 13px;
    line-height: 1.6;
    color: #606266;
  }
}

// Dark mode support (optional)
@media (prefers-color-scheme: dark) {
  .ai-insight-panel {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-color: #3d3d5c;

    .panel-content {
      background: #1a1a2e;
    }

    .insight-list .item-text {
      color: #c0c4cc;
    }

    .insight-section {
      border-color: #3d3d5c;
    }
  }
}
</style>
