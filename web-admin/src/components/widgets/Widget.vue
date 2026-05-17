<script setup lang="ts">
/**
 * Widget.vue — P1 #65 C-WIDGET-1 — base wrapper for endpoint-bound widgets.
 *
 * Provides uniform loading / error / empty / refresh chrome around any
 * widget body (passed via default slot). Pairs with `useWidgetData`
 * composable for endpoint binding.
 *
 * 防呆 R5: empty-state shows action hint (default: "暂无数据") rather than
 * blank space. If `emptyHint` + `emptyAction` props supplied, renders CTA
 * button so user is not dead-ended.
 *
 * Concrete widgets (KpiTodayProductionWidget / RecentRemindersWidget / etc)
 * compose this wrapper + their own body markup. The 3 raw widget components
 * (KPICardWidget / ChartWidget / ListWidget) remain for backward compat
 * with the Sprint 4 Chat L registry; new endpoint-bound widgets use this
 * wrapper directly.
 */
import { computed } from 'vue';
import { Refresh } from '@element-plus/icons-vue';

const props = withDefaults(
  defineProps<{
    /** Title shown in header. */
    title: string;
    /** Optional subtitle / hint, shown under title in smaller text. */
    subtitle?: string;
    /** Loading spinner over body. */
    loading?: boolean;
    /** Error message — if set, body is replaced with error state. */
    error?: string | null;
    /** Whether body data is empty (e.g. list.length === 0). */
    empty?: boolean;
    /** Custom message in empty state (default: 暂无数据). */
    emptyMessage?: string;
    /** Optional action label in empty state — renders a button (防呆 R5). */
    emptyActionLabel?: string;
    /** Show the refresh button in header. */
    showRefresh?: boolean;
    /** Optional last-updated timestamp to display in subtitle. */
    lastUpdated?: Date | null;
  }>(),
  {
    loading: false,
    error: null,
    empty: false,
    emptyMessage: '暂无数据',
    showRefresh: true,
    lastUpdated: null,
  }
);

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'empty-action'): void;
}>();

const lastUpdatedText = computed(() => {
  if (!props.lastUpdated) return null;
  const d = props.lastUpdated;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `更新于 ${hh}:${mm}:${ss}`;
});

function onRefresh(): void {
  emit('refresh');
}

function onEmptyAction(): void {
  emit('empty-action');
}
</script>

<template>
  <el-card shadow="never" class="widget-base">
    <template #header>
      <div class="widget-base-header">
        <div class="widget-base-title-block">
          <div class="widget-base-title">{{ title }}</div>
          <div v-if="subtitle || lastUpdatedText" class="widget-base-subtitle">
            {{ subtitle || lastUpdatedText }}
          </div>
        </div>
        <el-button
          v-if="showRefresh"
          text
          size="small"
          :icon="Refresh"
          :loading="loading"
          title="刷新"
          @click="onRefresh"
        />
      </div>
    </template>

    <div v-loading="loading" class="widget-base-body">
      <!-- Error state -->
      <div v-if="error" class="widget-base-error">
        <el-empty :image-size="60" :description="error">
          <el-button size="small" type="primary" @click="onRefresh">
            重试
          </el-button>
        </el-empty>
      </div>

      <!-- Empty state (防呆 R5) -->
      <div v-else-if="empty && !loading" class="widget-base-empty">
        <el-empty :image-size="60" :description="emptyMessage">
          <el-button
            v-if="emptyActionLabel"
            size="small"
            type="primary"
            @click="onEmptyAction"
          >
            {{ emptyActionLabel }}
          </el-button>
        </el-empty>
      </div>

      <!-- Body content -->
      <div v-else class="widget-base-content">
        <slot />
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.widget-base { height: 100%; display: flex; flex-direction: column; }
.widget-base :deep(.el-card__header) { padding: 12px 16px; }
.widget-base :deep(.el-card__body) { padding: 12px 16px; flex: 1; overflow: hidden; }
.widget-base-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.widget-base-title-block { display: flex; flex-direction: column; min-width: 0; }
.widget-base-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.widget-base-subtitle {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.widget-base-body { min-height: 80px; height: 100%; }
.widget-base-error,
.widget-base-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 80px;
}
.widget-base-content { height: 100%; }
</style>
