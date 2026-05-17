<script setup lang="ts">
/**
 * EquipmentStatusWidget — wraps GET /api/mobile/{factoryId}/reports/dashboard/equipment
 * Shows running / idle / maintenance / fault counts + active alerts.
 *
 * 防呆 R2: 4 status 数字 + alert 上下文.
 * 防呆 R5: empty state → 跳设备列表.
 */
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import type { EquipmentStats } from '@/types/api';
import Widget from '../Widget.vue';
import { useWidgetData } from '../useWidgetData';

const props = withDefaults(
  defineProps<{
    title?: string;
    autoRefreshMs?: number;
  }>(),
  {
    title: '设备状态',
    autoRefreshMs: 60_000,
  }
);

const router = useRouter();
const authStore = useAuthStore();

const { data, loading, error, lastUpdated, empty, refresh } = useWidgetData<EquipmentStats>({
  fetcher: () => {
    const fid = authStore.factoryId;
    if (!fid) throw new Error('未绑定工厂');
    return get<EquipmentStats>(`/${fid}/reports/dashboard/equipment`);
  },
  isEmpty: (d) => !d || (d.totalEquipment ?? 0) === 0,
  autoRefreshMs: props.autoRefreshMs,
});

const totalEquip = computed(() => data.value?.totalEquipment ?? 0);
const running = computed(() => data.value?.running ?? 0);
const idle = computed(() => data.value?.idle ?? 0);
const maintenance = computed(() => data.value?.maintenance ?? 0);
const fault = computed(() => data.value?.fault ?? 0);
const activeAlerts = computed(() => data.value?.activeAlerts ?? 0);
const utilization = computed(() => data.value?.avgUtilization ?? 0);

function goToEquipment(): void {
  void router.push('/equipment/list');
}
</script>

<template>
  <Widget
    :title="props.title"
    :subtitle="`平均利用率 ${utilization.toFixed(1)}%`"
    :loading="loading"
    :error="error"
    :empty="empty"
    :last-updated="lastUpdated"
    empty-message="暂无设备数据"
    empty-action-label="去添加设备"
    @refresh="refresh"
    @empty-action="goToEquipment"
  >
    <div class="eq-body" @click="goToEquipment">
      <div class="eq-summary">
        <span class="eq-summary-val">{{ totalEquip }}</span>
        <span class="eq-summary-label">台设备</span>
      </div>
      <div class="eq-grid">
        <div class="eq-cell ok">
          <span class="eq-cell-val">{{ running }}</span>
          <span class="eq-cell-label">运行中</span>
        </div>
        <div class="eq-cell info">
          <span class="eq-cell-val">{{ idle }}</span>
          <span class="eq-cell-label">空闲</span>
        </div>
        <div class="eq-cell warn">
          <span class="eq-cell-val">{{ maintenance }}</span>
          <span class="eq-cell-label">维护</span>
        </div>
        <div class="eq-cell danger">
          <span class="eq-cell-val">{{ fault }}</span>
          <span class="eq-cell-label">故障</span>
        </div>
      </div>
      <div v-if="activeAlerts > 0" class="eq-alert">
        当前 {{ activeAlerts }} 条活跃告警
      </div>
    </div>
  </Widget>
</template>

<style scoped>
.eq-body { display: flex; flex-direction: column; gap: 8px; cursor: pointer; }
.eq-summary { display: flex; align-items: baseline; gap: 6px; }
.eq-summary-val { font-size: 24px; font-weight: 600; color: var(--el-text-color-primary); }
.eq-summary-label { font-size: 12px; color: var(--el-text-color-secondary); }
.eq-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.eq-cell {
  display: flex; flex-direction: column; align-items: center;
  padding: 6px 4px; border-radius: 4px;
  font-size: 11px;
}
.eq-cell-val { font-size: 18px; font-weight: 600; }
.eq-cell-label { color: var(--el-text-color-secondary); }
.eq-cell.ok { background: var(--el-color-success-light-9); color: var(--el-color-success); }
.eq-cell.info { background: var(--el-fill-color-light); color: var(--el-text-color-regular); }
.eq-cell.warn { background: var(--el-color-warning-light-9); color: var(--el-color-warning); }
.eq-cell.danger { background: var(--el-color-danger-light-9); color: var(--el-color-danger); }
.eq-alert {
  font-size: 12px;
  color: var(--el-color-danger);
  padding: 4px 8px;
  background: var(--el-color-danger-light-9);
  border-radius: 4px;
}
</style>
