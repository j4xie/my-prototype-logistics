<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, Delete } from '@element-plus/icons-vue';
import {
  type CustomerTrackingRecord,
  listTrackingRecords,
  deleteTrackingRecord,
} from '@/api/customerTracking';
import CreateDialog from './create-dialog.vue';
import TimelineView from './timeline.vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId || '');
const canEdit = computed(() => permissionStore.canWrite('sales'));

const records = ref<CustomerTrackingRecord[]>([]);
const totalElements = ref(0);
const loading = ref(false);
const page = ref(0);
const size = ref(20);
const customerIdFilter = ref('');
const viewMode = ref<'table' | 'timeline'>('table');
const createDialogVisible = ref(false);

async function load(): Promise<void> {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await listTrackingRecords(factoryId.value, {
      customerId: customerIdFilter.value || undefined,
      page: page.value,
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

onMounted(load);

function handlePageChange(p: number): void {
  page.value = p - 1;
  load();
}

function handleSizeChange(s: number): void {
  size.value = s;
  page.value = 0;
  load();
}

async function handleDelete(record: CustomerTrackingRecord): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确认删除 ${record.recordTime?.slice(0, 10)} 的跟踪记录?`,
      '删除确认',
      { type: 'warning' }
    );
    await deleteTrackingRecord(factoryId.value, record.id);
    ElMessage.success('已删除');
    await load();
  } catch (e: unknown) {
    if (e === 'cancel' || (e as Error)?.message === 'cancel') return;
    const msg = e instanceof Error ? e.message : '删除失败';
    ElMessage.error(msg);
  }
}

function onCreated(): void {
  createDialogVisible.value = false;
  page.value = 0;
  load();
}
</script>

<template>
  <div class="customer-tracking-list">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="page-title">客户跟踪记录</span>
          <span class="data-count">共 {{ totalElements }} 条</span>
          <el-button
            v-if="canEdit"
            type="primary"
            :icon="Plus"
            style="margin-left: auto"
            @click="createDialogVisible = true"
          >
            新建跟踪记录
          </el-button>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="customerIdFilter"
          placeholder="按客户 ID 筛选 (留空看全部)"
          clearable
          style="width: 280px"
          @keyup.enter="page = 0; load()"
        />
        <el-button :icon="Refresh" @click="page = 0; load()">刷新</el-button>
        <el-radio-group v-model="viewMode" size="default" style="margin-left: auto">
          <el-radio-button value="table">表格</el-radio-button>
          <el-radio-button value="timeline">时间线</el-radio-button>
        </el-radio-group>
      </div>

      <TimelineView v-if="viewMode === 'timeline'" :records="records" />
      <el-table
        v-else
        :data="records"
        v-loading="loading"
        empty-text="暂无跟踪记录"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column prop="recordTime" label="跟踪时间" width="170" />
        <el-table-column prop="customerId" label="客户 ID" width="220" show-overflow-tooltip />
        <el-table-column prop="recorderName" label="记录人" width="120" />
        <el-table-column prop="contactPerson" label="联系人" width="120" />
        <el-table-column prop="contactPhone" label="联系电话" width="140" />
        <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="canEdit"
              link
              type="danger"
              :icon="Delete"
              @click="handleDelete(row)"
            />
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :page-sizes="[10, 20, 50]"
          :total="totalElements"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <CreateDialog
      v-model="createDialogVisible"
      :factory-id="factoryId"
      :initial-customer-id="customerIdFilter"
      @created="onCreated"
    />
  </div>
</template>

<style scoped>
.customer-tracking-list { padding: 16px; }
.card-header { display: flex; align-items: center; gap: 12px; }
.page-title { font-size: 16px; font-weight: 600; }
.data-count { font-size: 13px; color: var(--el-text-color-secondary); }
.search-bar { display: flex; gap: 12px; margin-bottom: 16px; align-items: center; }
.pagination-wrapper { display: flex; justify-content: flex-end; padding-top: 16px; }
</style>
