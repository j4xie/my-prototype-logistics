<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Check, Close, Refresh } from '@element-plus/icons-vue';
import {
  getPendingApprovals, approveReport, rejectReport, batchApproveReports,
  type ApprovalItem
} from '@/api/processProduction';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('production'));

const loading = ref(false);
const tableData = ref<ApprovalItem[]>([]);
const pagination = ref({ page: 1, size: 20, total: 0 });
const selectedIds = ref<number[]>([]);

// P2-6: Auto-refresh every 30 seconds
let refreshTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  loadData();
  refreshTimer = setInterval(loadData, 30000);
});
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const response = await getPendingApprovals(factoryId.value, {
      page: pagination.value.page,
      size: pagination.value.size
    });
    if (response.success && response.data) {
      tableData.value = (response.data.content || []) as ApprovalItem[];
      pagination.value.total = response.data.totalElements || 0;
    }
  } catch {
    ElMessage.error('加载待审批列表失败');
  } finally {
    loading.value = false;
  }
}

async function handleApprove(row: ApprovalItem) {
  if (!factoryId.value) return;
  try {
    await approveReport(factoryId.value, row.id);
    ElMessage.success('已通过');
    loadData();
  } catch {
    ElMessage.error('审批失败');
  }
}

async function handleReject(row: ApprovalItem) {
  if (!factoryId.value) return;
  try {
    const { value: reason } = await ElMessageBox.prompt('请输入驳回原因', '驳回报工', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /.+/,
      inputErrorMessage: '请输入驳回原因'
    });
    await rejectReport(factoryId.value, row.id, reason);
    ElMessage.success('已驳回');
    loadData();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('操作失败');
  }
}

async function handleBatchApprove() {
  if (!factoryId.value || selectedIds.value.length === 0) return;
  try {
    await ElMessageBox.confirm(
      `确定批量通过 ${selectedIds.value.length} 条报工记录？`,
      '批量审批',
      { type: 'warning' }
    );
    await batchApproveReports(factoryId.value, selectedIds.value);
    ElMessage.success(`已批量通过 ${selectedIds.value.length} 条`);
    selectedIds.value = [];
    loadData();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('批量审批失败');
  }
}

function handleSelectionChange(rows: ApprovalItem[]) {
  selectedIds.value = rows.map(r => r.id);
}

function handlePageChange(page: number) {
  pagination.value.page = page;
  loadData();
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return dateStr.substring(0, 10);
}
</script>

<template>
  <div class="page-container">
    <el-card>
      <div class="toolbar">
        <div class="toolbar-left">
          <h2 style="margin: 0">报工审批</h2>
          <el-tag type="warning">待审批 {{ pagination.total }}</el-tag>
        </div>
        <div class="toolbar-right">
          <el-button :icon="Refresh" @click="loadData" />
          <el-button
            v-if="canWrite && selectedIds.length > 0"
            type="success"
            :icon="Check"
            @click="handleBatchApprove"
          >
            批量通过 ({{ selectedIds.length }})
          </el-button>
        </div>
      </div>
    </el-card>

    <el-card style="margin-top: 16px">
      <el-table
        :data="tableData"
        v-loading="loading"
        stripe
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="reporterName" label="报工人" width="100" />
        <el-table-column prop="reportDate" label="报工日期" width="110">
          <template #default="{ row }">{{ formatDate(row.reportDate) }}</template>
        </el-table-column>
        <el-table-column prop="processCategory" label="工序" min-width="100" />
        <el-table-column prop="outputQuantity" label="数量" width="100">
          <template #default="{ row }">
            <span :class="{ 'text-warning': row.isSupplemental }">
              {{ row.outputQuantity }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="isSupplemental" label="类型" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.isSupplemental" type="warning" size="small">补报</el-tag>
            <el-tag v-else type="info" size="small">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="processTaskId" label="任务ID" width="120" show-overflow-tooltip />
        <el-table-column label="操作" width="160" fixed="right" v-if="canWrite">
          <template #default="{ row }">
            <el-button type="success" text size="small" :icon="Check" @click="handleApprove(row)">
              通过
            </el-button>
            <el-button type="danger" text size="small" :icon="Close" @click="handleReject(row)">
              驳回
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="pagination.total > 0"
        style="margin-top: 16px; justify-content: flex-end"
        :current-page="pagination.page"
        :page-size="pagination.size"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="handlePageChange"
      />
    </el-card>
  </div>
</template>

<style scoped>
.page-container { padding: 20px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; }
.toolbar-left { display: flex; align-items: center; gap: 12px; }
.toolbar-right { display: flex; gap: 8px; }
.text-warning { color: #e6a23c; font-weight: 600; }
</style>
