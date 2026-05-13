<script setup lang="ts">
/**
 * 调整审批 — PENDING ar_ap_transactions adjustment 队列
 *
 * R28 P2 (R23 P5 deferred): admin UI for the PENDING_APPROVAL workflow added
 * in R23 (commits ee78b0495 + V20260426_01 migration). Backend supports:
 *   - GET  /api/mobile/{factoryId}/finance/adjustments/pending  (list, with R29 P1 filters)
 *   - POST /api/mobile/{factoryId}/finance/adjustment/{txnId}/approve
 *   - POST /api/mobile/{factoryId}/finance/adjustment/{txnId}/reject
 *   - POST /api/mobile/{factoryId}/finance/adjustments/batch-approve  (R29 P2)
 *   - POST /api/mobile/{factoryId}/finance/adjustments/batch-reject   (R29 P2)
 *
 * R29 P1+P2 additions:
 *   - Filter bar: counterpartyType / amount range / date range
 *   - Multi-select + bulk approve / bulk reject (≤100 rows per call)
 *   - Per-id outcome rendering (succeeded count + failures list)
 *
 * 4 眼原则: backend rejects approve when approver === submitter (ArApServiceImpl
 * line 364-366). FE additionally hides single-row 审批 button when row.operatedBy
 * === current userId. Bulk approve relies on backend per-id reject (4-eye
 * violations show up in failures list with reason).
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

interface BatchOutcome {
  requested: number;
  approvedCount?: number;
  rejectedCount?: number;
  failedCount: number;
  failures: Array<{ id: string; reason: string }>;
}

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const currentUserId = computed(() => authStore.user?.id);
const canApprove = computed(() => permissionStore.canWrite('finance'));
const canViewPrice = computed(() => permissionStore.canViewPrice);

const loading = ref(false);
const tableData = ref<AdjustmentRow[]>([]);
const pagination = ref({ page: 1, size: 20, total: 0 });
const selectedRows = ref<AdjustmentRow[]>([]);

// R29 P1 filter state
const filterType = ref<'CUSTOMER' | 'SUPPLIER' | ''>('');
const filterMinAmount = ref<number | null>(null);
const filterMaxAmount = ref<number | null>(null);
const filterDateRange = ref<[string, string] | null>(null);

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: pagination.value.page, size: pagination.value.size };
    if (filterType.value) params.counterpartyType = filterType.value;
    if (filterMinAmount.value != null) params.minAmount = filterMinAmount.value;
    if (filterMaxAmount.value != null) params.maxAmount = filterMaxAmount.value;
    if (filterDateRange.value && filterDateRange.value[0]) params.fromDate = filterDateRange.value[0];
    if (filterDateRange.value && filterDateRange.value[1]) params.toDate = filterDateRange.value[1];
    const res = await get<{ content: AdjustmentRow[]; totalElements: number }>(
      `/${factoryId.value}/finance/adjustments/pending`,
      { params }
    );
    if (res.success && res.data) {
      tableData.value = res.data.content || [];
      pagination.value.total = res.data.totalElements || 0;
    }
  } catch {
    // Interceptor toasts; this catch silences the unhandled-promise log.
  } finally {
    loading.value = false;
    selectedRows.value = [];
  }
}

function handleResetFilters() {
  filterType.value = '';
  filterMinAmount.value = null;
  filterMaxAmount.value = null;
  filterDateRange.value = null;
  pagination.value.page = 1;
  loadData();
}

function handleApplyFilter() {
  pagination.value.page = 1;
  loadData();
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
      confirmButtonText: '确认驳回', cancelButtonText: '取消',
      inputPattern: /.+/, inputErrorMessage: '请输入驳回原因'
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

// R29 P2 bulk operations
async function handleBatchApprove() {
  if (!factoryId.value || selectedRows.value.length === 0) return;
  // Pre-filter own submissions client-side (4-eye) to avoid known-failures cluttering result
  const ownIds = selectedRows.value.filter(r => r.operatedBy === currentUserId.value).map(r => r.id);
  const eligibleIds = selectedRows.value.filter(r => r.operatedBy !== currentUserId.value).map(r => r.id);
  if (eligibleIds.length === 0) {
    ElMessage.warning(`选中的 ${selectedRows.value.length} 条均为您本人提交,无法审批 (4 眼原则)`);
    return;
  }
  let confirmMsg = `确认批量审批通过 ${eligibleIds.length} 条调整？`;
  if (ownIds.length > 0) confirmMsg += `\n(已自动跳过 ${ownIds.length} 条您本人提交)`;
  try {
    await ElMessageBox.confirm(confirmMsg, '批量审批', {
      type: 'warning', confirmButtonText: '确认批量审批', cancelButtonText: '取消'
    });
    const res = await post<BatchOutcome>(
      `/${factoryId.value}/finance/adjustments/batch-approve`,
      { ids: eligibleIds }
    );
    if (res.success && res.data) {
      const { approvedCount, failedCount, failures } = res.data;
      if (failedCount === 0) {
        ElMessage.success(`批量审批成功: ${approvedCount} 条`);
      } else {
        ElMessageBox.alert(
          `成功: ${approvedCount} 条\n失败: ${failedCount} 条\n\n失败明细:\n${failures.map(f => `  - ${f.id.slice(0, 8)}: ${f.reason}`).join('\n')}`,
          '批量审批部分失败',
          { type: 'warning', customClass: 'whitespace-pre' }
        );
      }
      loadData();
    }
  } catch (e) {
    if (e === 'cancel') return;
    const err = e as { status?: number; actionHint?: string | null } | undefined;
    if (!err || (err.status !== 409 && err.status !== 403 && !err.actionHint)) {
      ElMessage.error('批量审批失败');
    }
  }
}

async function handleBatchReject() {
  if (!factoryId.value || selectedRows.value.length === 0) return;
  const ids = selectedRows.value.map(r => r.id);
  try {
    const { value: reason } = await ElMessageBox.prompt(
      `请输入批量驳回原因 (将应用于全部 ${ids.length} 条)`,
      '批量驳回',
      { confirmButtonText: '确认批量驳回', cancelButtonText: '取消',
        inputPattern: /.+/, inputErrorMessage: '请输入驳回原因' }
    );
    const res = await post<BatchOutcome>(
      `/${factoryId.value}/finance/adjustments/batch-reject`,
      { ids, reason }
    );
    if (res.success && res.data) {
      const { rejectedCount, failedCount, failures } = res.data;
      if (failedCount === 0) {
        ElMessage.success(`批量驳回成功: ${rejectedCount} 条`);
      } else {
        ElMessageBox.alert(
          `成功: ${rejectedCount} 条\n失败: ${failedCount} 条\n\n失败明细:\n${failures.map(f => `  - ${f.id.slice(0, 8)}: ${f.reason}`).join('\n')}`,
          '批量驳回部分失败',
          { type: 'warning' }
        );
      }
      loadData();
    }
  } catch (e) {
    if (e === 'cancel') return;
    const err = e as { status?: number; actionHint?: string | null } | undefined;
    if (!err || (err.status !== 409 && err.status !== 403 && !err.actionHint)) {
      ElMessage.error('批量驳回失败');
    }
  }
}

function handleSelectionChange(rows: AdjustmentRow[]) {
  selectedRows.value = rows;
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
        type="warning" show-icon :closable="false"
        style="margin-bottom:12px"
        title="4 眼原则"
        description="审批人必须与提交人不同。系统会自动隐藏您自己提交的调整记录的「审批」按钮 (但驳回仍可操作)。批量审批时,您本人的记录会被自动跳过,不计入失败。"
      />

      <!-- R29 P1 filter bar -->
      <div class="filter-bar">
        <el-select v-model="filterType" placeholder="对手方类型" clearable style="width:140px">
          <el-option label="客户 (AR)" value="CUSTOMER" />
          <el-option label="供应商 (AP)" value="SUPPLIER" />
        </el-select>
        <el-input-number
          v-model="filterMinAmount" placeholder="最小金额"
          :min="0" :precision="2" :controls="false"
          style="width:130px"
        />
        <span style="color:#999">至</span>
        <el-input-number
          v-model="filterMaxAmount" placeholder="最大金额"
          :min="0" :precision="2" :controls="false"
          style="width:130px"
        />
        <el-date-picker
          v-model="filterDateRange"
          type="daterange" range-separator="至"
          start-placeholder="提交开始日"
          end-placeholder="结束日"
          value-format="YYYY-MM-DD"
          style="width:280px"
        />
        <el-button type="primary" @click="handleApplyFilter">筛选</el-button>
        <el-button @click="handleResetFilters">重置</el-button>
      </div>

      <!-- R29 P2 bulk action bar -->
      <div v-if="selectedRows.length > 0" class="bulk-bar">
        已选中 <strong>{{ selectedRows.length }}</strong> 条
        <el-button
          type="success" size="small" :icon="Check"
          :disabled="!canApprove"
          @click="handleBatchApprove"
        >批量审批</el-button>
        <el-button
          type="danger" size="small" :icon="Close"
          :disabled="!canApprove"
          @click="handleBatchReject"
        >批量驳回</el-button>
      </div>

      <el-table
        :data="tableData" empty-text="暂无待审批调整" stripe border style="width:100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="40" />
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
        <el-table-column v-if="canViewPrice" label="金额" width="140" align="right">
          <template #default="{ row }">
            <span :style="{ color: row.amount > 0 ? '#67C23A' : '#F56C6C', fontWeight: 600 }">
              {{ formatAmount(row.amount, row.counterpartyType) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column v-if="canViewPrice" prop="balanceAfter" label="变动后余额" width="120" align="right">
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
              type="success" size="small" :icon="Check"
              @click="handleApprove(row)"
            >审批</el-button>
            <el-button
              v-if="canApprove"
              type="danger" size="small" :icon="Close"
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
.filter-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.bulk-bar {
  background: #f0f9ff;
  border: 1px solid #d9ecff;
  border-radius: 4px;
  padding: 8px 12px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
