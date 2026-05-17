<script setup lang="ts">
/**
 * PendingRemindersWidget — wraps GET /api/mobile/{factoryId}/reminders?status=PENDING
 * Shows top 5 pending reminders with type + due date.
 *
 * 防呆 R2: 每条 reminder 含 source type + due date 上下文.
 * 防呆 R5: empty state → 无操作 (空提醒是好事), 但仍 link 到全部提醒页 if user wants history.
 */
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { listReminders, type Reminder, type ReminderPage } from '@/api/reminder';
import Widget from '../Widget.vue';
import { useWidgetData } from '../useWidgetData';

const props = withDefaults(
  defineProps<{
    title?: string;
    maxItems?: number;
    autoRefreshMs?: number;
  }>(),
  {
    title: '待处理提醒',
    maxItems: 5,
    autoRefreshMs: 60_000,
  }
);

const router = useRouter();

const { data, loading, error, lastUpdated, empty, refresh } = useWidgetData<ReminderPage>({
  fetcher: () => listReminders({ status: 'PENDING', page: 0, size: props.maxItems }),
  isEmpty: (d) => !d || !d.content || d.content.length === 0,
  autoRefreshMs: props.autoRefreshMs,
});

const items = computed<Reminder[]>(() => data.value?.content ?? []);
const totalElements = computed(() => data.value?.totalElements ?? 0);
const moreCount = computed(() => Math.max(0, totalElements.value - items.value.length));

function reminderTypeLabel(type: string): string {
  const map: Record<string, string> = {
    PAYMENT_DUE: '应收/应付',
  };
  return map[type] || type;
}

function formatDate(s?: string | null): string {
  if (!s) return '';
  try {
    const d = new Date(s);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return s;
  }
}

function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false;
  try {
    return new Date(dueDate).getTime() < Date.now();
  } catch {
    return false;
  }
}

function goToReminderHub(): void {
  // No dedicated reminder list view yet — fallback to dashboard. Adjust when shipped.
  void router.push('/dashboard');
}
</script>

<template>
  <Widget
    :title="props.title"
    :subtitle="totalElements > 0 ? `共 ${totalElements} 条` : undefined"
    :loading="loading"
    :error="error"
    :empty="empty"
    :last-updated="lastUpdated"
    empty-message="暂无待处理提醒"
    @refresh="refresh"
  >
    <ul class="reminders-list">
      <li v-for="r in items" :key="r.id" class="reminders-item">
        <div class="reminders-item-line1">
          <el-tag size="small" :type="isOverdue(r.dueDate) ? 'danger' : 'warning'">
            {{ reminderTypeLabel(r.type) }}
          </el-tag>
          <span class="reminders-item-date" :class="{ overdue: isOverdue(r.dueDate) }">
            {{ formatDate(r.dueDate) }}
            <span v-if="isOverdue(r.dueDate)">(已逾期)</span>
          </span>
        </div>
        <div v-if="r.message" class="reminders-item-msg">
          {{ r.message }}
        </div>
      </li>
    </ul>
    <div v-if="moreCount > 0" class="reminders-more" @click="goToReminderHub">
      还有 {{ moreCount }} 条 →
    </div>
  </Widget>
</template>

<style scoped>
.reminders-list { list-style: none; margin: 0; padding: 0; }
.reminders-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.reminders-item:last-child { border-bottom: none; }
.reminders-item-line1 { display: flex; align-items: center; gap: 8px; }
.reminders-item-date { font-size: 12px; color: var(--el-text-color-secondary); }
.reminders-item-date.overdue { color: var(--el-color-danger); font-weight: 600; }
.reminders-item-msg { font-size: 12px; color: var(--el-text-color-regular); padding-left: 4px; }
.reminders-more { font-size: 12px; color: var(--el-color-primary); cursor: pointer; padding: 8px 0; text-align: center; }
.reminders-more:hover { text-decoration: underline; }
</style>
