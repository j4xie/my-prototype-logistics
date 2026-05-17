<script setup lang="ts">
/**
 * WipBatchCountWidget — wraps GET /api/mobile/{factoryId}/material-batches/wip
 * Shows count of WIP (PRODUCING_RESERVED) material batches.
 *
 * 防呆 R2: KPI 含 context — 总剩余数量 / 当前在线批次数.
 * 防呆 R5: empty state → 跳生产批次页 (启动生产即占用 WIP).
 */
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import Widget from '../Widget.vue';
import { useWidgetData } from '../useWidgetData';

interface WipBatch {
  id: string;
  batchNumber: string;
  currentQuantity?: number;
  remainingQuantity?: number;
  quantityUnit?: string;
  materialType?: { name?: string };
  materialTypeId?: string;
}

const props = withDefaults(
  defineProps<{
    title?: string;
    autoRefreshMs?: number;
  }>(),
  {
    title: '在制品批次',
    autoRefreshMs: 60_000,
  }
);

const router = useRouter();
const authStore = useAuthStore();

const { data, loading, error, lastUpdated, empty, refresh } = useWidgetData<WipBatch[]>({
  fetcher: () => {
    const fid = authStore.factoryId;
    if (!fid) throw new Error('未绑定工厂');
    return get<WipBatch[]>(`/${fid}/material-batches/wip`);
  },
  autoRefreshMs: props.autoRefreshMs,
});

const count = computed(() => data.value?.length ?? 0);
const totalQty = computed(() => {
  if (!data.value) return 0;
  return data.value.reduce((sum, b) => {
    return sum + (b.currentQuantity ?? b.remainingQuantity ?? 0);
  }, 0);
});

function goToWipList(): void {
  void router.push('/warehouse/materials/wip-list');
}

function goToBatchStart(): void {
  void router.push('/production/batches');
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <Widget
    :title="props.title"
    :loading="loading"
    :error="error"
    :empty="empty"
    :last-updated="lastUpdated"
    empty-message="当前没有在制品批次"
    empty-action-label="启动生产批次"
    @refresh="refresh"
    @empty-action="goToBatchStart"
  >
    <div class="wip-body">
      <div class="wip-value" @click="goToWipList">
        {{ count }}
        <span class="wip-unit">批</span>
      </div>
      <div class="wip-context">
        共占用物料 {{ totalQty.toLocaleString() }} (含多单位)
      </div>
      <div class="wip-link" @click="goToWipList">查看详情 →</div>
    </div>
  </Widget>
</template>

<style scoped>
.wip-body { display: flex; flex-direction: column; gap: 6px; }
.wip-value { font-size: 28px; font-weight: 600; color: var(--el-color-warning); line-height: 1.2; cursor: pointer; }
.wip-unit { font-size: 14px; font-weight: 400; color: var(--el-text-color-secondary); margin-left: 4px; }
.wip-context { font-size: 12px; color: var(--el-text-color-secondary); }
.wip-link { font-size: 12px; color: var(--el-color-primary); cursor: pointer; align-self: flex-start; margin-top: auto; }
.wip-link:hover { text-decoration: underline; }
</style>
