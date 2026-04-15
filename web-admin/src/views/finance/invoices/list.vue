<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { formatAmount } from '@/utils/tableFormatters';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('finance'));

const loading = ref(false);
const tableData = ref<Record<string, unknown>[]>([]);
const pagination = ref({ page: 0, size: 20, total: 0 });
const statusFilter = ref('');

const statusMap: Record<string, { text: string; type: string }> = {
  REQUESTED: { text: '待审核', type: 'warning' },
  APPROVED: { text: '已审核', type: '' },
  ISSUED: { text: '已开具', type: 'success' },
  REJECTED: { text: '已驳回', type: 'danger' },
  CANCELLED: { text: '已取消', type: 'info' },
};

onMounted(() => loadData());

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: pagination.value.page - 1, size: pagination.value.size };
    if (statusFilter.value) params.status = statusFilter.value;
    const res = await get(`/${factoryId.value}/finance/invoices`, { params });
    if (res.success) {
      tableData.value = res.data.content || [];
      pagination.value.total = res.data.totalElements || 0;
    }
  } catch { ElMessage.error('加载开票列表失败'); }
  finally { loading.value = false; }
}

async function handleAction(id: string, action: 'approve' | 'reject' | 'issue') {
  const labels = { approve: '审核通过', reject: '驳回', issue: '开具发票' };
  try {
    if (action === 'reject') {
      const { value: notes } = await ElMessageBox.prompt('请输入驳回原因', '驳回', { confirmButtonText: '确定', cancelButtonText: '取消' });
      await post(`/${factoryId.value}/finance/invoices/${id}/reject`, { notes });
    } else if (action === 'issue') {
      await ElMessageBox.confirm('确认开具发票？', '确认');
      await post(`/${factoryId.value}/finance/invoices/${id}/issue`);
    } else {
      await ElMessageBox.confirm(`确认${labels[action]}？`, '确认');
      await post(`/${factoryId.value}/finance/invoices/${id}/${action}`);
    }
    ElMessage.success(`${labels[action]}成功`);
    loadData();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(`操作失败`);
  }
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
  } catch { ElMessage.error('提交失败'); }
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
            <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width:140px" @change="loadData">
              <el-option v-for="(v,k) in statusMap" :key="k" :label="v.text" :value="k" />
            </el-select>
            <el-button v-if="canWrite" type="primary" @click="requestDialogVisible = true">申请开票</el-button>
          </div>
        </div>
      </template>

      <el-table :data="tableData" border stripe>
        <el-table-column prop="invoiceNumber" label="发票编号" width="180" />
        <el-table-column prop="customerName" label="客户" min-width="130" />
        <el-table-column prop="totalAmount" label="价税合计" width="130" align="right">
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
        <el-form-item label="销售订单ID" required>
          <el-input v-model="requestForm.salesOrderId" placeholder="输入销售订单ID" />
        </el-form-item>
        <el-form-item label="不含税金额" required>
          <el-input-number v-model="requestForm.amount" :min="0" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="税额">
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
  </div>
</template>
