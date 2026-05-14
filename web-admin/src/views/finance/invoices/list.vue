<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { formatAmount } from '@/utils/tableFormatters';
import { handleCatchError } from '@/utils/errorToast';
import type { TableRow } from '@/types/api';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const route = useRoute();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('finance'));
const canViewPrice = computed(() => permissionStore.canViewPrice);

const loading = ref(false);
const tableData = ref<TableRow[]>([]);
const pagination = ref({ page: 1, size: 20, total: 0 });
const statusFilter = ref('');

const statusMap: Record<string, { text: string; type: string }> = {
  REQUESTED: { text: '待审核', type: 'warning' },
  APPROVED: { text: '已审核', type: '' },
  ISSUED: { text: '已开具', type: 'success' },
  REJECTED: { text: '已驳回', type: 'danger' },
  CANCELLED: { text: '已取消', type: 'info' },
};

onMounted(() => {
  // Bug #40: finance 点"开票审核"菜单时 URL 带 ?status=REQUESTED 自动过滤
  const qs = route.query.status;
  if (typeof qs === 'string' && statusMap[qs]) statusFilter.value = qs;
  loadData();
  loadSalesOrderOptions();
});

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const params: TableRow = { page: pagination.value.page, size: pagination.value.size };
    if (statusFilter.value) params.status = statusFilter.value;
    const res = await get(`/${factoryId.value}/finance/invoices`, { params });
    if (res.success) {
      let rows = res.data.content || [];
      // Apr 20 Bug BR-11 fix: 前端补 keyword 搜索 (客户 / 发票号), 后端无 keyword 参数
      const kw = searchKeyword.value.trim();
      if (kw) {
        const lower = kw.toLowerCase();
        rows = rows.filter((r: TableRow) =>
          String(r.customerName || '').toLowerCase().includes(lower) ||
          String(r.invoiceNumber || '').toLowerCase().includes(lower) ||
          String(r.orderNumber || '').toLowerCase().includes(lower)
        );
      }
      tableData.value = rows;
      pagination.value.total = res.data.totalElements || 0;
    }
  } catch { /* axios interceptor already displayed error toast */ }
  finally { loading.value = false; }
}

// Apr 20 Bug BR-11 fix: keyword state
const searchKeyword = ref('');
function handleSearch() { pagination.value.page = 1; loadData(); }
function handleReset() { searchKeyword.value = ''; statusFilter.value = ''; handleSearch(); }

// Apr 21 2026: load invoiceable sales orders so FE can offer a dropdown
// instead of asking users to hand-copy 订单号 like SO-20260420-0001.
interface SalesOrderOption { id: string; orderNumber: string; customerName: string; totalAmount?: number }
const salesOrderOptions = ref<SalesOrderOption[]>([]);
async function loadSalesOrderOptions() {
  if (!factoryId.value) return;
  try {
    // Note: endpoint is /sales/orders (SalesController), not /sales-orders.
    // List all then filter to invoicable statuses client-side (CONFIRMED
    // through COMPLETED; exclude DRAFT / CANCELLED).
    const res = await get<{ content: (SalesOrderOption & { status?: string })[] }>(
      `/${factoryId.value}/sales/orders`,
      { params: { page: 1, size: 200 } }
    );
    if (res.success && res.data) {
      const invoicableStatuses = new Set([
        'CONFIRMED', 'PENDING_FINANCE_REVIEW', 'FINANCE_APPROVED',
        'PROCESSING', 'PARTIAL_DELIVERED', 'COMPLETED',
      ]);
      salesOrderOptions.value = (res.data.content || []).filter(
        o => !o.status || invoicableStatuses.has(o.status)
      );
    }
  } catch { /* silent */ }
}

async function handleAction(id: string, action: 'approve' | 'reject' | 'issue') {
  const labels = { approve: '审核通过', reject: '驳回', issue: '开具发票' };
  try {
    if (action === 'reject') {
      const { value: notes } = await ElMessageBox.prompt('请输入驳回原因', '驳回', { confirmButtonText: '确定', cancelButtonText: '取消' });
      await post(`/${factoryId.value}/finance/invoices/${id}/reject`, { notes });
    } else if (action === 'issue') {
      // Bug #4 (R7 fix 2026-04-16): 后端硬规则要求 PDF 附件, 开对话框让用户选文件
      issueTargetId.value = id;
      issuePdfFile.value = null;
      issueDialogVisible.value = true;
      return;
    } else {
      await ElMessageBox.confirm(`确认${labels[action]}？`, '确认');
      await post(`/${factoryId.value}/finance/invoices/${id}/${action}`);
    }
    ElMessage.success(`${labels[action]}成功`);
    loadData();
  } catch (e) {
    if (e === 'cancel') return;
    // R26 follow-up (reviewer #16 concern #1): pre-fix this fired ElMessage.error('操作失败')
    // on top of axios interceptor's rich actionHint toast for any backend 4xx/5xx
    // (e.g. R18+R21+R23 invariant 409 with hint, or DataIntegrity unique 409 post-R25).
    // handleCatchError gates on !err.status — only fires fallback for true network errors.
    handleCatchError(e, '操作失败,请检查网络');
  }
}

// Bug #4 fix: 开具发票弹窗 + PDF 上传
const issueDialogVisible = ref(false);
const issueTargetId = ref('');
const issuePdfFile = ref<File | null>(null);
const issuing = ref(false);

async function submitIssue() {
  if (!issuePdfFile.value) { ElMessage.warning('请选择发票 PDF 文件'); return; }
  issuing.value = true;
  try {
    const formData = new FormData();
    formData.append('file', issuePdfFile.value);
    await post(`/${factoryId.value}/finance/invoices/${issueTargetId.value}/issue`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    ElMessage.success('开具发票成功');
    issueDialogVisible.value = false;
    loadData();
  } catch (e) {
    ElMessage.error('开具失败');
  } finally {
    issuing.value = false;
  }
}

function handlePdfChange(file: { raw: File } | File) {
  const raw = (file as { raw: File }).raw || (file as File);
  if (!raw.name?.toLowerCase().endsWith('.pdf')) {
    ElMessage.warning('仅支持 PDF 文件');
    issuePdfFile.value = null;
    return false;
  }
  issuePdfFile.value = raw;
  return false;
}

// 开票申请弹窗
const requestDialogVisible = ref(false);
const requestForm = ref({ salesOrderId: '', amount: 0, taxAmount: 0, invoiceType: 'NORMAL', remark: '' });
const submitting = ref(false);

async function handleRequestSubmit() {
  if (!requestForm.value.salesOrderId || !requestForm.value.amount) {
    ElMessage.warning('请填写订单ID和金额'); return;
  }
  submitting.value = true;
  try {
    const res = await post(`/${factoryId.value}/finance/invoices/request`, requestForm.value);
    if (res.success) {
      ElMessage.success('开票申请已提交');
      requestDialogVisible.value = false;
      loadData();
    } else { ElMessage.error(res.message || '提交失败'); }
  } catch { /* axios interceptor already displayed error toast */ }
  finally { submitting.value = false; }
}
</script>

<template>
  <div class="page-wrapper" v-loading="loading">
    <el-card shadow="never">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:16px;font-weight:600">开票管理</span>
          <div style="display:flex;gap:8px">
            <!-- Apr 20 Bug BR-11 fix: 加 keyword 搜索 (客户 / 发票号 / 订单号) -->
            <el-input v-model="searchKeyword" placeholder="搜索 客户/发票号/订单号" clearable style="width:220px" @keyup.enter="handleSearch" />
            <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width:140px" @change="loadData">
              <el-option v-for="(v,k) in statusMap" :key="k" :label="v.text" :value="k" />
            </el-select>
            <el-button type="primary" @click="handleSearch">搜索</el-button>
            <el-button @click="handleReset">重置</el-button>
            <el-button v-if="canWrite && canViewPrice" type="primary" @click="requestDialogVisible = true">申请开票</el-button>
          </div>
        </div>
      </template>

      <el-table :data="tableData" border stripe>
        <el-table-column prop="invoiceNumber" label="发票编号" width="180" />
        <el-table-column prop="customerName" label="客户" min-width="130" />
        <el-table-column v-if="canViewPrice" prop="totalAmount" label="价税合计" width="130" align="right">
          <template #default="{ row }">{{ formatAmount(row.totalAmount) }}</template>
        </el-table-column>
        <el-table-column prop="invoiceType" label="类型" width="90" align="center">
          <template #default="{ row }">{{ row.invoiceType === 'SPECIAL' ? '专票' : '普票' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusMap[row.status]?.type || 'info'" size="small">{{ statusMap[row.status]?.text || row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="requestedAt" label="申请时间" width="170" />
        <el-table-column prop="invoicePdfUrl" label="发票PDF" width="90" align="center">
          <template #default="{ row }">
            <a v-if="row.invoicePdfUrl" :href="row.invoicePdfUrl" target="_blank">查看</a>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="center" v-if="canWrite">
          <template #default="{ row }">
            <el-button v-if="row.status === 'REQUESTED'" type="success" link size="small" @click="handleAction(row.id, 'approve')">审核</el-button>
            <el-button v-if="row.status === 'REQUESTED'" type="danger" link size="small" @click="handleAction(row.id, 'reject')">驳回</el-button>
            <el-button v-if="row.status === 'APPROVED'" type="primary" link size="small" @click="handleAction(row.id, 'issue')">开具</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="pagination.total > pagination.size"
        style="margin-top:16px;justify-content:flex-end"
        :current-page="pagination.page + 1"
        :page-size="pagination.size"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="(p: number) => { pagination.page = p - 1; loadData(); }"
      />
    </el-card>

    <!-- 开票申请弹窗 -->
    <el-dialog v-model="requestDialogVisible" title="申请开票" width="480px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="销售订单" required>
          <el-select
            v-model="requestForm.salesOrderId"
            placeholder="选择已确认的销售订单"
            filterable
            style="width:100%"
          >
            <el-option
              v-for="o in salesOrderOptions"
              :key="o.id"
              :value="o.id"
              :label="`${o.orderNumber} · ${o.customerName || '-'} · ¥${(o.totalAmount || 0).toLocaleString()}`"
            />
            <template #empty>
              <div style="padding:8px 12px;color:#909399">暂无已确认的销售订单</div>
            </template>
          </el-select>
        </el-form-item>
        <el-form-item v-if="canViewPrice" label="不含税金额" required>
          <el-input-number v-model="requestForm.amount" :min="0" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item v-if="canViewPrice" label="税额">
          <el-input-number v-model="requestForm.taxAmount" :min="0" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="发票类型">
          <el-select v-model="requestForm.invoiceType" style="width:100%">
            <el-option label="普通发票" value="NORMAL" />
            <el-option label="增值税专用发票" value="SPECIAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="requestForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="requestDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleRequestSubmit">提交申请</el-button>
      </template>
    </el-dialog>

    <!-- Bug #4 R7 fix: 开具发票 + PDF 上传 -->
    <el-dialog v-model="issueDialogVisible" title="开具发票" width="480px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="发票 PDF" required>
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept="application/pdf,.pdf"
            :on-change="handlePdfChange"
            :on-remove="(): void => { issuePdfFile = null }"
          >
            <el-button type="primary">选择 PDF 文件</el-button>
            <template #tip>
              <div style="color:#999;font-size:12px">仅 PDF, 上传后销售可从 SO 详情下载</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="issueDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="issuing" :disabled="!issuePdfFile" @click="submitIssue">确认开具</el-button>
      </template>
    </el-dialog>
  </div>
</template>
