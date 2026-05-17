<script setup lang="ts">
// P1 #21 S-CRM-1 — 客户跟踪记录 list page.
//
// Backend: CustomerTrackingRecordController (Sprint 4 Wave 2 Chat L #727).
//   GET    /api/mobile/{factoryId}/sales/customer-tracking?customerId=&page=&size=
//   GET    /{id}
//   POST   /
//   PUT    /{id}     (partial: content/contactPerson/contactPhone/address/remark)
//   DELETE /{id}     (soft via @SQLDelete)
//
// 防呆 (per .claude/rules/fool-proof-design.md):
// - R2 (context): table renders 客户名 not 客户ID; dialog header carries 客户名
// - R3 (constrained input): customer is dropdown (filterable), not free text
// - R5 (dead-end → next-action): empty state shows "+ 添加首条跟踪记录"
//   and "无匹配客户" guides user to clear filter
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, Edit, Delete } from '@element-plus/icons-vue';
import {
  type CustomerTrackingRecord,
  listTrackingRecords,
  deleteTrackingRecord,
} from '@/api/customerTracking';
import EditDialog from './edit-dialog.vue';

interface CustomerOption {
  id: string;
  name: string;
  customerCode?: string;
}

interface CustomerListResponse {
  content: CustomerOption[];
  totalElements: number;
}

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId || '');
const canEdit = computed(() => permissionStore.canWrite('sales'));

// table state
const records = ref<CustomerTrackingRecord[]>([]);
const totalElements = ref(0);
const loading = ref(false);
const page = ref(1); // 1-based for el-pagination
const size = ref(20);
const customerIdFilter = ref<string>('');

// customer dropdown options (resolved once on mount → name lookup)
const customers = ref<CustomerOption[]>([]);
const customerNameMap = computed((): Map<string, string> => {
  const m = new Map<string, string>();
  for (const c of customers.value) m.set(c.id, c.name);
  return m;
});

function customerLabel(id: string): string {
  return customerNameMap.value.get(id) || id;
}

// dialog state
const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const editingRecord = ref<CustomerTrackingRecord | null>(null);

async function loadCustomers(): Promise<void> {
  if (!factoryId.value) return;
  try {
    const res = await get<CustomerListResponse>(`/${factoryId.value}/customers`, {
      params: { page: 1, size: 500 },
    });
    if (res.success && res.data) {
      customers.value = (res.data.content || []).map((c) => ({
        id: c.id,
        name: c.name,
        customerCode: c.customerCode,
      }));
    }
  } catch (e: unknown) {
    // interceptor surfaces details — don't double-toast
    console.error('客户字典加载失败', e);
  }
}

async function load(): Promise<void> {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await listTrackingRecords(factoryId.value, {
      customerId: customerIdFilter.value || undefined,
      page: page.value - 1, // backend 0-based
      size: size.value,
    });
    records.value = res.content;
    totalElements.value = res.totalElements;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '加载失败';
    ElMessage.error(msg);
  } finally {
    loading.value = false;
  }
}

async function refreshAll(): Promise<void> {
  // refresh both customers dictionary (in case new customer added elsewhere) + records
  await Promise.all([loadCustomers(), load()]);
}

onMounted(async () => {
  await loadCustomers();
  await load();
});

function handlePageChange(p: number): void {
  page.value = p;
  load();
}

function handleSizeChange(s: number): void {
  size.value = s;
  page.value = 1;
  load();
}

function onFilterChange(): void {
  page.value = 1;
  load();
}

function openCreate(): void {
  dialogMode.value = 'create';
  editingRecord.value = null;
  dialogVisible.value = true;
}

function openEdit(row: CustomerTrackingRecord): void {
  dialogMode.value = 'edit';
  editingRecord.value = { ...row };
  dialogVisible.value = true;
}

function onSaved(): void {
  dialogVisible.value = false;
  load();
}

async function handleDelete(row: CustomerTrackingRecord): Promise<void> {
  const time = row.recordTime?.slice(0, 16).replace('T', ' ') || '';
  const name = customerLabel(row.customerId);
  try {
    await ElMessageBox.confirm(
      `确认删除 ${name} 在 ${time} 的跟踪记录?`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    );
    await deleteTrackingRecord(factoryId.value, row.id);
    ElMessage.success('已删除');
    await load();
  } catch (e: unknown) {
    // ElMessageBox cancel resolves with the string 'cancel'
    if (e === 'cancel' || (e as Error)?.message === 'cancel') return;
    const msg = e instanceof Error ? e.message : '删除失败';
    ElMessage.error(msg);
  }
}
</script>

<template>
  <div class="customer-tracking-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="page-title">客户跟踪记录</span>
          <el-tag v-if="totalElements" type="info" size="small">
            共 {{ totalElements }} 条
          </el-tag>
          <el-button
            v-if="canEdit"
            type="primary"
            :icon="Plus"
            class="header-action"
            @click="openCreate"
          >
            新建跟踪记录
          </el-button>
        </div>
      </template>

      <!-- Filter bar -->
      <div class="filter-bar">
        <el-select
          v-model="customerIdFilter"
          placeholder="按客户筛选 (留空查看全部)"
          filterable
          clearable
          style="width: 320px"
          @change="onFilterChange"
          @clear="onFilterChange"
        >
          <el-option
            v-for="c in customers"
            :key="c.id"
            :value="c.id"
            :label="c.name"
          >
            <span>{{ c.name }}</span>
            <span v-if="c.customerCode" class="customer-code">
              {{ c.customerCode }}
            </span>
          </el-option>
        </el-select>
        <el-button :icon="Refresh" @click="refreshAll">刷新</el-button>
      </div>

      <!-- Table or empty-state -->
      <template v-if="!loading && records.length === 0">
        <el-empty
          :description="
            customerIdFilter
              ? '该客户暂无跟踪记录'
              : '暂无跟踪记录 — 点击下方按钮开始记录客户拜访 / 沟通 / 跟进'
          "
        >
          <!-- 防呆 R5: empty state always carries next-action -->
          <el-button v-if="canEdit" type="primary" :icon="Plus" @click="openCreate">
            添加首条跟踪记录
          </el-button>
          <el-button
            v-if="customerIdFilter"
            link
            type="primary"
            @click="customerIdFilter = ''; onFilterChange()"
          >
            清除客户筛选
          </el-button>
        </el-empty>
      </template>

      <el-table
        v-else
        v-loading="loading"
        :data="records"
        empty-text="加载中..."
        stripe
        border
        style="width: 100%"
      >
        <el-table-column
          prop="recordTime"
          label="跟踪时间"
          width="170"
        >
          <template #default="{ row }">
            {{ (row.recordTime as string)?.slice(0, 16).replace('T', ' ') }}
          </template>
        </el-table-column>
        <el-table-column label="客户" width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="customer-name">{{ customerLabel(row.customerId) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="recorderName"
          label="记录人"
          width="120"
          show-overflow-tooltip
        />
        <el-table-column
          prop="contactPerson"
          label="联系人"
          width="120"
          show-overflow-tooltip
        />
        <el-table-column
          prop="contactPhone"
          label="联系电话"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="content"
          label="跟踪内容"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column
          prop="remark"
          label="备注"
          min-width="140"
          show-overflow-tooltip
        />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="canEdit"
              link
              type="primary"
              :icon="Edit"
              @click="openEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              v-if="canEdit"
              link
              type="danger"
              :icon="Delete"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="totalElements > 0" class="pagination-wrapper">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :page-sizes="[10, 20, 50, 100]"
          :total="totalElements"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <EditDialog
      v-model="dialogVisible"
      :factory-id="factoryId"
      :mode="dialogMode"
      :customers="customers"
      :initial-customer-id="customerIdFilter"
      :record="editingRecord"
      @saved="onSaved"
    />
  </div>
</template>

<style scoped>
.customer-tracking-page {
  padding: 16px;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.page-title {
  font-size: 16px;
  font-weight: 600;
}
.header-action {
  margin-left: auto;
}
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}
.customer-name {
  font-weight: 500;
}
.customer-code {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}
</style>
