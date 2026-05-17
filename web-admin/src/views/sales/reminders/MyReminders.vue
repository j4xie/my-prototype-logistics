<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  listReminders,
  snoozeReminder,
  dismissReminder,
  type Reminder,
  type ReminderStatus,
} from '@/api/reminder';

const router = useRouter();
const reminders = ref<Reminder[]>([]);
const total = ref(0);
const page = ref(0);
const size = ref(20);
const loading = ref(false);
const statusFilter = ref<string>('PENDING,SNOOZED');

async function load(): Promise<void> {
  loading.value = true;
  try {
    const res = await listReminders({
      status: statusFilter.value,
      page: page.value,
      size: size.value,
    });
    reminders.value = res?.data?.content ?? [];
    total.value = res?.data?.totalElements ?? 0;
  } catch (e) {
    ElMessage.error('加载失败');
  } finally {
    loading.value = false;
  }
}

function statusTag(status: ReminderStatus): { type: 'warning' | 'info' | 'success'; label: string } {
  if (status === 'PENDING') return { type: 'warning', label: '待处理' };
  if (status === 'SNOOZED') return { type: 'info', label: '已延后' };
  return { type: 'success', label: '已处理' };
}

function typeLabel(type: string): string {
  if (type === 'PAYMENT_DUE') return '收款提醒';
  return type;
}

const isOverdue = computed(() => (dueDate: string) => {
  return new Date(dueDate) < new Date(new Date().toDateString());
});

async function handleSnooze(r: Reminder): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt('延后到 (YYYY-MM-DD)', '延后提醒', {
      inputPattern: /^\d{4}-\d{2}-\d{2}$/,
      inputErrorMessage: '请输入 YYYY-MM-DD 格式',
      inputValue: defaultSnoozeDate(),
    });
    await snoozeReminder(r.id, value);
    ElMessage.success('已延后');
    load();
  } catch {
    // 取消
  }
}

function defaultSnoozeDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

async function handleDismiss(r: Reminder): Promise<void> {
  try {
    await ElMessageBox.confirm('标记此提醒为已处理?', '确认', { type: 'warning' });
    await dismissReminder(r.id);
    ElMessage.success('已处理');
    load();
  } catch {
    // 取消
  }
}

function goSource(r: Reminder): void {
  if (r.sourceType === 'SALES_ORDER') {
    router.push(`/sales/orders/${r.sourceId}`);
  }
}

function onStatusChange(): void {
  page.value = 0;
  load();
}

function onPageChange(p: number): void {
  page.value = p - 1;
  load();
}

onMounted(load);
</script>

<template>
  <div class="my-reminders">
    <div class="header">
      <h2>我的提醒</h2>
      <el-radio-group v-model="statusFilter" @change="onStatusChange">
        <el-radio-button label="PENDING,SNOOZED">活跃</el-radio-button>
        <el-radio-button label="PENDING">仅待处理</el-radio-button>
        <el-radio-button label="SNOOZED">仅已延后</el-radio-button>
        <el-radio-button label="DISMISSED">已处理</el-radio-button>
      </el-radio-group>
    </div>

    <el-table v-loading="loading" :data="reminders" stripe>
      <el-table-column prop="type" label="类型" width="120">
        <template #default="{ row }">{{ typeLabel(row.type) }}</template>
      </el-table-column>
      <el-table-column prop="dueDate" label="到期日" width="140">
        <template #default="{ row }">
          <span :class="{ 'overdue': isOverdue(row.dueDate) && row.status === 'PENDING' }">
            {{ row.dueDate }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="message" label="内容" min-width="300" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTag(row.status).type" size="small">
            {{ statusTag(row.status).label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="snoozedUntil" label="延后至" width="120" />
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link @click="goSource(row)">查看来源</el-button>
          <el-button
            v-if="row.status !== 'DISMISSED'"
            size="small"
            link
            @click="handleSnooze(row)"
          >延后</el-button>
          <el-button
            v-if="row.status !== 'DISMISSED'"
            size="small"
            type="success"
            link
            @click="handleDismiss(row)"
          >处理</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-if="total > 0"
      :current-page="page + 1"
      :page-size="size"
      :total="total"
      layout="prev, pager, next, total"
      @current-change="onPageChange"
      class="pagination"
    />
  </div>
</template>

<style lang="scss" scoped>
.my-reminders {
  padding: 16px;
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    h2 { margin: 0; }
  }
  .overdue {
    color: #f56c6c;
    font-weight: 600;
  }
  .pagination {
    margin-top: 16px;
    justify-content: flex-end;
  }
}
</style>
