<script setup lang="ts">
/**
 * TopOvertimeEmployeesWidget — wraps GET /api/mobile/{factoryId}/hr/attendance-hours/list
 * Shows top 5 OT employees this month (descending by overtimeHours).
 *
 * #835 follow-up — Hours Aggregator widget plugging into #823 framework.
 *
 * 防呆 R2: row items show 姓名 + 部门 + 加班 h (context).
 * 防呆 R5: empty state → 跳工时统计 page (Hours Report) 排查.
 */
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import Widget from '../Widget.vue';
import { useWidgetData } from '../useWidgetData';

interface HoursRow {
  userId: number;
  userName: string;
  department: string | null;
  yearMonth: string;
  overtimeHours: number;
  workedHours: number;
  lateMinutes: number;
  absentDays: number;
}

const props = withDefaults(
  defineProps<{
    title?: string;
    autoRefreshMs?: number;
    /** Top-N to show — default 5. */
    maxItems?: number;
  }>(),
  {
    title: '本月加班 Top 5',
    autoRefreshMs: 120_000,
    maxItems: 5,
  }
);

const router = useRouter();
const authStore = useAuthStore();

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const { data, loading, error, lastUpdated, empty, refresh } = useWidgetData<HoursRow[]>({
  fetcher: () => {
    const fid = authStore.factoryId;
    if (!fid) throw new Error('未绑定工厂');
    return get<HoursRow[]>(
      `/${fid}/hr/attendance-hours/list`,
      { params: { yearMonth: currentYearMonth() } }
    );
  },
  isEmpty: (d) => !Array.isArray(d) || d.length === 0 || d.every((r) => r.overtimeHours === 0),
  autoRefreshMs: props.autoRefreshMs,
});

const topItems = computed<HoursRow[]>(() => {
  if (!Array.isArray(data.value)) return [];
  // Backend already sorts DESC by OT; just take maxItems with OT > 0.
  return data.value
    .filter((r) => (r.overtimeHours ?? 0) > 0)
    .slice(0, props.maxItems);
});

function goReport(): void {
  void router.push({ name: 'HRHoursReport' });
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <Widget
    :title="props.title"
    :subtitle="`${currentYearMonth()} 工厂全员`"
    :loading="loading"
    :error="error"
    :empty="empty"
    :last-updated="lastUpdated"
    empty-message="本月暂无加班记录"
    empty-action-label="查看工时统计"
    @refresh="refresh"
    @empty-action="goReport"
  >
    <ul class="top-ot-list">
      <li
        v-for="(row, idx) in topItems"
        :key="row.userId"
        class="top-ot-item"
        @click="goReport"
      >
        <span class="top-ot-rank">{{ idx + 1 }}</span>
        <div class="top-ot-name-block">
          <span class="top-ot-name">{{ row.userName }}</span>
          <span class="top-ot-dept">{{ row.department || '-' }}</span>
        </div>
        <span class="top-ot-hours">+{{ row.overtimeHours }} h</span>
      </li>
    </ul>
  </Widget>
</template>

<style scoped>
.top-ot-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.top-ot-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  cursor: pointer;
  font-size: 13px;
}
.top-ot-item:hover {
  background: var(--el-fill-color-light);
}
.top-ot-item:last-child {
  border-bottom: none;
}
.top-ot-rank {
  display: inline-block;
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  background: var(--el-color-warning-light-8);
  color: var(--el-color-warning-dark-2);
  font-weight: 600;
  border-radius: 50%;
  font-size: 12px;
}
.top-ot-name-block {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.top-ot-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.top-ot-dept {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.top-ot-hours {
  color: var(--el-color-warning);
  font-weight: 600;
  font-size: 14px;
}
</style>
