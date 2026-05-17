<script setup lang="ts">
/**
 * SchedulingAlertsWidget — wraps GET /api/mobile/{factoryId}/scheduling/alerts/unresolved
 * Shows top N unresolved scheduling alerts with severity color.
 *
 * 防呆 R2: alert message + suggested action 上下文.
 * 防呆 R5: empty state → 跳调度页 (无告警即良性, 但保留 link).
 */
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { getUnresolvedAlerts, type SchedulingAlert } from '@/api/scheduling';
import Widget from '../Widget.vue';
import { useWidgetData } from '../useWidgetData';

const props = withDefaults(
  defineProps<{
    title?: string;
    maxItems?: number;
    autoRefreshMs?: number;
  }>(),
  {
    title: '排程告警',
    maxItems: 5,
    autoRefreshMs: 60_000,
  }
);

const router = useRouter();
const authStore = useAuthStore();

const { data, loading, error, lastUpdated, empty, refresh } = useWidgetData<SchedulingAlert[]>({
  fetcher: () => {
    const fid = authStore.factoryId;
    if (!fid) throw new Error('未绑定工厂');
    return getUnresolvedAlerts(fid);
  },
  autoRefreshMs: props.autoRefreshMs,
});

const visibleItems = computed(() => (data.value ?? []).slice(0, props.maxItems));
const moreCount = computed(() => Math.max(0, (data.value?.length ?? 0) - visibleItems.value.length));

function severityType(sev: string): 'danger' | 'warning' | 'info' {
  if (sev === 'critical') return 'danger';
  if (sev === 'warning') return 'warning';
  return 'info';
}

function alertTypeLabel(type: string): string {
  const map: Record<string, string> = {
    low_probability: '完成概率低',
    resource_conflict: '资源冲突',
    deadline_risk: '交付风险',
    efficiency_drop: '效率下滑',
  };
  return map[type] || type;
}

function goToScheduling(): void {
  void router.push('/scheduling');
}
</script>

<template>
  <Widget
    :title="props.title"
    :loading="loading"
    :error="error"
    :empty="empty"
    :last-updated="lastUpdated"
    empty-message="暂无未解决告警"
    empty-action-label="查看调度计划"
    @refresh="refresh"
    @empty-action="goToScheduling"
  >
    <ul class="sa-list">
      <li v-for="alert in visibleItems" :key="alert.id" class="sa-item">
        <div class="sa-item-head">
          <el-tag size="small" :type="severityType(alert.severity)">
            {{ alertTypeLabel(alert.alertType) }}
          </el-tag>
        </div>
        <div class="sa-item-msg">{{ alert.message }}</div>
        <div v-if="alert.suggestedAction" class="sa-item-action">
          建议: {{ alert.suggestedAction }}
        </div>
      </li>
    </ul>
    <div v-if="moreCount > 0" class="sa-more" @click="goToScheduling">
      还有 {{ moreCount }} 条 →
    </div>
  </Widget>
</template>

<style scoped>
.sa-list { list-style: none; margin: 0; padding: 0; }
.sa-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.sa-item:last-child { border-bottom: none; }
.sa-item-head { margin-bottom: 4px; }
.sa-item-msg { font-size: 13px; color: var(--el-text-color-primary); line-height: 1.4; }
.sa-item-action { font-size: 11px; color: var(--el-text-color-secondary); margin-top: 2px; }
.sa-more { font-size: 12px; color: var(--el-color-primary); cursor: pointer; padding: 8px 0; text-align: center; }
.sa-more:hover { text-decoration: underline; }
</style>
