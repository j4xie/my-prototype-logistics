<script setup lang="ts">
/**
 * DeliveryWarnWidget — wraps GET /api/mobile/{factoryId}/production-plans/delivery-warnings
 * Shows count of OVERDUE / URGENT delivery warnings.
 *
 * 防呆 R2: 多级数字 + 文字提示 (OVERDUE 已超期 / URGENT <3d / WARN 3-7d).
 * 防呆 R5: empty state → 跳生产计划页 录第一条.
 */
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import Widget from '../Widget.vue';
import { useWidgetData } from '../useWidgetData';

interface DeliveryWarning {
  id: string;
  productName?: string;
  expectedCompletionDate?: string;
  warnLevel?: 'OVERDUE' | 'URGENT' | 'WARN' | 'NORMAL';
}

const props = withDefaults(
  defineProps<{
    title?: string;
    windowDays?: number;
    autoRefreshMs?: number;
  }>(),
  {
    title: '交货预警',
    windowDays: 7,
    autoRefreshMs: 120_000,
  }
);

const router = useRouter();
const authStore = useAuthStore();

const { data, loading, error, lastUpdated, empty, refresh } = useWidgetData<DeliveryWarning[]>({
  fetcher: () => {
    const fid = authStore.factoryId;
    if (!fid) throw new Error('未绑定工厂');
    return get<DeliveryWarning[]>(`/${fid}/production-plans/delivery-warnings`, {
      params: { windowDays: props.windowDays },
    });
  },
  isEmpty: (d) => {
    if (!d || d.length === 0) return true;
    // Only show "empty" when ALL are NORMAL — anything urgent should display.
    return d.every((r) => r.warnLevel === 'NORMAL');
  },
  autoRefreshMs: props.autoRefreshMs,
});

const overdueCount = computed(
  () => data.value?.filter((r) => r.warnLevel === 'OVERDUE').length ?? 0
);
const urgentCount = computed(
  () => data.value?.filter((r) => r.warnLevel === 'URGENT').length ?? 0
);
const warnCount = computed(
  () => data.value?.filter((r) => r.warnLevel === 'WARN').length ?? 0
);
const totalProblems = computed(
  () => overdueCount.value + urgentCount.value + warnCount.value
);

function goToWarnings(): void {
  void router.push('/production/delivery-warnings');
}

function goToPlans(): void {
  void router.push('/production/plans');
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <Widget
    :title="props.title"
    :subtitle="`窗口 ${props.windowDays} 天`"
    :loading="loading"
    :error="error"
    :empty="empty"
    :last-updated="lastUpdated"
    empty-message="当前没有交货预警 — 全部正常"
    empty-action-label="查看生产计划"
    @refresh="refresh"
    @empty-action="goToPlans"
  >
    <div class="dw-body">
      <div class="dw-rows" @click="goToWarnings">
        <div class="dw-row danger">
          <span class="dw-label">已超期</span>
          <span class="dw-count">{{ overdueCount }}</span>
        </div>
        <div class="dw-row warn">
          <span class="dw-label">紧急 (&lt;3d)</span>
          <span class="dw-count">{{ urgentCount }}</span>
        </div>
        <div class="dw-row info">
          <span class="dw-label">预警 (3-7d)</span>
          <span class="dw-count">{{ warnCount }}</span>
        </div>
      </div>
      <div class="dw-context">共 {{ totalProblems }} 条待处理 — 点击查看详情</div>
    </div>
  </Widget>
</template>

<style scoped>
.dw-body { display: flex; flex-direction: column; gap: 8px; height: 100%; }
.dw-rows { display: flex; flex-direction: column; gap: 4px; cursor: pointer; }
.dw-row {
  display: flex; justify-content: space-between;
  padding: 6px 10px; border-radius: 4px;
  font-size: 13px;
}
.dw-row.danger { background: var(--el-color-danger-light-9); color: var(--el-color-danger); }
.dw-row.warn { background: var(--el-color-warning-light-9); color: var(--el-color-warning); }
.dw-row.info { background: var(--el-fill-color-light); color: var(--el-text-color-regular); }
.dw-label { font-weight: 500; }
.dw-count { font-weight: 600; }
.dw-context { font-size: 11px; color: var(--el-text-color-secondary); margin-top: auto; }
</style>
