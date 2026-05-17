<script setup lang="ts">
/**
 * QualityRateWidget — wraps GET /api/mobile/{factoryId}/reports/dashboard/quality
 * Shows quality pass-rate as KPI with breakdown by inspection type.
 *
 * 防呆 R2: pass-rate 数字 + 检测总数 上下文.
 * 防呆 R5: empty state → 跳质检页 录第一条.
 */
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import type { QualityStats } from '@/types/api';
import Widget from '../Widget.vue';
import { useWidgetData } from '../useWidgetData';

const props = withDefaults(
  defineProps<{
    title?: string;
    autoRefreshMs?: number;
  }>(),
  {
    title: '质量合格率',
    autoRefreshMs: 120_000,
  }
);

const router = useRouter();
const authStore = useAuthStore();

const { data, loading, error, lastUpdated, empty, refresh } = useWidgetData<QualityStats>({
  fetcher: () => {
    const fid = authStore.factoryId;
    if (!fid) throw new Error('未绑定工厂');
    return get<QualityStats>(`/${fid}/reports/dashboard/quality`);
  },
  isEmpty: (d) => !d || (d.totalInspections ?? 0) === 0,
  autoRefreshMs: props.autoRefreshMs,
});

const passRate = computed(() => data.value?.passRate ?? 0);
const failRate = computed(() => data.value?.failRate ?? 0);
const totalInspections = computed(() => data.value?.totalInspections ?? 0);
const todayInspections = computed(() => data.value?.todayInspections ?? 0);
const failedBatches = computed(() => data.value?.failedBatches ?? 0);

const rateColor = computed(() => {
  if (passRate.value >= 95) return 'var(--el-color-success)';
  if (passRate.value >= 80) return 'var(--el-color-warning)';
  return 'var(--el-color-danger)';
});

function goToInspections(): void {
  void router.push('/quality/inspections');
}
</script>

<template>
  <Widget
    :title="props.title"
    :subtitle="`本周期检测 ${totalInspections} 次`"
    :loading="loading"
    :error="error"
    :empty="empty"
    :last-updated="lastUpdated"
    empty-message="暂无质检数据"
    empty-action-label="录入质检结果"
    @refresh="refresh"
    @empty-action="goToInspections"
  >
    <div class="qr-body">
      <div class="qr-value" :style="{ color: rateColor }">
        {{ passRate.toFixed(1) }}<span class="qr-unit">%</span>
      </div>
      <div class="qr-context">
        合格 vs 不合格 {{ failRate.toFixed(1) }}%
      </div>
      <div v-if="todayInspections > 0" class="qr-today">
        今日新增 {{ todayInspections }} 次检测
      </div>
      <div v-if="failedBatches > 0" class="qr-fail">
        {{ failedBatches }} 个批次质量不合格
      </div>
    </div>
  </Widget>
</template>

<style scoped>
.qr-body { display: flex; flex-direction: column; gap: 4px; }
.qr-value { font-size: 28px; font-weight: 600; line-height: 1.2; }
.qr-unit { font-size: 14px; font-weight: 400; margin-left: 2px; }
.qr-context { font-size: 12px; color: var(--el-text-color-secondary); }
.qr-today { font-size: 12px; color: var(--el-text-color-regular); }
.qr-fail { font-size: 12px; color: var(--el-color-danger); }
</style>
