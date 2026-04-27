<script setup lang="ts">
/**
 * 调整审批 — PENDING ar_ap_transactions adjustment 队列
 *
 * R28 P2 (R23 P5 deferred): admin UI for the PENDING_APPROVAL workflow added
 * in R23 (commits ee78b0495 + V20260426_01 migration). Backend already supports:
 *   - GET  /api/mobile/{factoryId}/finance/adjustments/pending  (list)
 *   - POST /api/mobile/{factoryId}/finance/adjustment/{txnId}/approve
 *   - POST /api/mobile/{factoryId}/finance/adjustment/{txnId}/reject
 *
 * 4 眼原则: backend rejects approve when approver === submitter (R23 ArApServiceImpl
 * line 364-366). FE additionally hides the approve button on rows where
 * operatedBy === current userId so submitter doesn't see a button that 403s.
 */
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Check, Close, Refresh } from '@element-plus/icons-vue';

interface AdjustmentRow {
  id: string;
  factoryId: string;
  transactionType: 'AR_ADJUSTMENT' | 'AP_ADJUSTMENT';
  counterpartyType: 'CUSTOMER' | 'SUPPLIER';
  counterpartyId: string;
  counterpartyName?: string;
  amount: number;
  balanceAfter: number;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  operatedBy: number;
  remark?: string;
  createdAt: string;
}

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const currentUserId = computed(() => authStore.user?.id);
const canApprove = computed(() => permissionStore.canWrite('finance'));

const loading = ref(false);
const tableData = ref<AdjustmentRow[]>([]);
const pagination = ref({ page: 1, size: 20, total: 0 });

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await get<{ content: AdjustmentRow[]; totalElements: number }>(
      `/${factoryId.value}/finance/adjustments/pending`,
      { params: { page: pagination.value.page, size: pagination.value.size } }
    );
    if (res.success && res.data) {
      tableData.value = res.data.content || [];
      pagination.value.total = res.data.totalElements || 0;
    }
  } catch {
    // Interceptor toasts; this catch silences the unhandled-promise log.
  } finally {
    loading.value = false;
  }
}

async function handleApprove(row: AdjustmentRow) {
  if (!factoryId.value) return;
  try {
    await ElMessageBox.confirm(
      `确认审批通过该调整？\n金额: ${formatAmount(row.amount, row.counterpartyType)}\n对手方: ${row.counterpartyName || row.counterpartyId}\n余额变动后: ${row.balanceAfter}`,
      '审批通过',
      { type: 'warning', confirmButtonText: '确认审批', cancelButtonText: '取消' }
    );
    await post(`/${factoryId.value}/finance/adjustment/${row.id}/approve`);
    ElMessage.success('已审批通过, 余额已应用');
    loadData();
  } catch (e) {
    if (e === 'cancel') return;
    // R26 follow-up pattern: skip fallback when interceptor handled rich error.
    const err = e as { status?: number; actionHint?: string | null } | undefined;
    if (!err || (err.status !== 409 && err.status !== 403 && !err.actionHint)) {
      ElMessage.error('审批失败');
    }
    if (err?.status === 409) loadData();
  }
}

async function handleReject(row: AdjustmentRow) {
  if (!factoryId.value) return;
  try {
    const { value: reason } = await ElMessageBox.prompt('请输入驳回原因', '驳回调整', {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      inputPattern: /.+/,
      inputErrorMessage: '请输入驳回原因'
    });
    await post(`/${factoryId.value}/finance/adjustment/${row.id}/reject?reason=${encodeURIComponent(reason)}`);
    ElMessage.success('已驳回');
    loadData();
  } catch (e) {
    if (e === 'cancel') return;
    const err = e as { status?: number; actionHint?: string | null } | undefined;
    if (!err || (err.status !== 409 && err.status !== 403 && !err.actionHint)) {
      ElMessage.error('驳回失败');
    }
    if (err?.status === 409) loadData();
  }
}

// 4-eye gate: hide approve button if current user is the submitter.
function canShowApproveBtn(row: AdjustmentRow): boolean {
  return canApprove.value && row.operatedBy !== currentUserId.value;
}

function formatAmount(amount: number, type: 'CUSTOMER' | 'SUPPLIER'): string {
  const sign = amount >= 0 ? '+' : '';
  const label = type === 'CUSTOMER' ? '应收' : '应付';
  return `${label} ${sign}${amount.toFixed(2)} 元`;
}

function formatType(t: string): string {
  return t === 'AR_ADJUSTMENT' ? 'AR调整' : 'AP调整';
}

function formatDate(s: string): string {
  if (!s) return '';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

function handleSizeChange(val: number) { pagination.value.size = val; pagination.value.page = 1; loadData(); }
function handlePageChange(val: number) { pagination.value.page = val; loadData(); }

onMounted(loadData);
</script>

<template>
  <div class="page-wrapper" v-loading="loading">
    <el-card shadow="never">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:16px;font-weight:600">调整审批</span>
          <div style="display:flex;gap:8px;align-items:center">
            <span style="color:#999;font-size:13px">待审批: {{ pagination.total }} 条</span>
            <el-button :icon="Refresh" @click="loadData">刷新</el-button>
          </div>
        </div>
      </template>

      <el-alert
        type="warning"
        show-icon
        :closable="false"
        style="margin-bottom:16px"
        title="4 眼原则"
        description="审批人必须与提交人不同。系统会自动隐藏您自己提交的调整记录的「审批」按钮 (但驳回仍可操作)。"
      />

      <el-table :data="tableData" empty-text="暂无待审批调整" stripe border style="width:100%">
        <el-table-column prop="id" label="ID" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <span style="font-family:monospace;font-size:12px">{{ row.id.slice(0, 8) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.transactionType === 'AR_ADJUSTMENT' ? 'success' : 'warning'" size="small">
              {{ formatType(row.transactionType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="对手方" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.counterpartyName || row.counterpartyId }}</template>
        </el-table-column>
        <el-table-column label="金额" width="140" align="right">
          <template #default="{ row }">
            <span :style="{ color: row.amount > 0 ? '#67C23A' : '#F56C6C', fontWeight: 600 }">
              {{ formatAmount(row.amount, row.counterpartyType) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="balanceAfter" label="变动后余额" width="120" align="right">
          <template #default="{ row }">{{ row.balanceAfter?.toFixed(2) || '-' }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
        <el-table-column prop="operatedBy" label="提交人 ID" width="100" align="center">
          <template #default="{ row }">
            <span :style="{ color: row.operatedBy === currentUserId ? '#E6A23C' : '#606266' }">
              {{ row.operatedBy }}
              <small v-if="row.operatedBy === currentUserId" style="display:block;color:#E6A23C">(您本人)</small>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="canShowApproveBtn(row)"
              type="success"
              size="small"
              :icon="Check"
              @click="handleApprove(row)"
            >审批</el-button>
            <el-button
              v-if="canApprove"
              type="danger"
              size="small"
              :icon="Close"
              @click="handleReject(row)"
            >驳回</el-button>
            <span v-if="!canApprove" style="color:#999;font-size:12px">无权限</span>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="pagination.total > 0"
        :current-page="pagination.page"
        :page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top:16px;justify-content:flex-end"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </el-card>
  </div>
</template>

<style scoped>
.page-wrapper {
  padding: 16px;
}
</style>
