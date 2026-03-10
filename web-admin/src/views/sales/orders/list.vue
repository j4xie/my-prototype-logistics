<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { useBusinessMode } from '@/composables/useBusinessMode';
import { get, post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, ChatDotRound } from '@element-plus/icons-vue';
import AiEntryDrawer from '@/components/ai-entry/AiEntryDrawer.vue';
import { SALES_ORDER_CONFIG } from '@/components/ai-entry/types';
import { formatAmount } from '@/utils/tableFormatters';

// Quick action dialogs
const deliveryDialogVisible = ref(false);
const deliveryForm = ref<Record<string, any>>({ orderId: '', customerId: '', deliveryDate: '', items: [], notes: '' });

const invoiceDialogVisible = ref(false);
const invoiceForm = ref({ orderId: '', counterpartyId: '', amount: 0, notes: '' });

const paymentDialogVisible = ref(false);
const paymentForm = ref({ counterpartyId: '', amount: 0, paymentMethod: 'BANK_TRANSFER', notes: '' });

const router = useRouter();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const { label } = useBusinessMode();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('sales'));

const loading = ref(false);
const tableData = ref<any[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const statusFilter = ref('');
const dialogVisible = ref(false);

const form = ref({
  customerId: '',
  requiredDeliveryDate: '',
  deliveryAddress: '',
  remark: '',
  items: [{ productTypeId: '', quantity: 0, unit: 'kg', unitPrice: 0 }],
});
const customers = ref<any[]>([]);
const products = ref<any[]>([]);

const statusMap: Record<string, { text: string; type: string }> = {
  DRAFT: { text: '草稿', type: 'info' },
  CONFIRMED: { text: '已确认', type: '' },
  PROCESSING: { text: '处理中', type: 'warning' },
  PARTIAL_DELIVERED: { text: '部分发货', type: 'warning' },
  COMPLETED: { text: '已完成', type: 'success' },
  CANCELLED: { text: '已取消', type: 'danger' },
};

onMounted(() => { loadData(); loadCustomers(); loadProducts(); });

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const url = statusFilter.value
      ? `/${factoryId.value}/sales/orders/by-status`
      : `/${factoryId.value}/sales/orders`;
    const params: any = { page: pagination.value.page, size: pagination.value.size };
    if (statusFilter.value) params.status = statusFilter.value;
    const res = await get(url, { params });
    if (res.success && res.data) {
      tableData.value = res.data.content || [];
      pagination.value.total = res.data.totalElements || 0;
    }
  } catch { ElMessage.error('加载失败'); }
  finally { loading.value = false; }
}

async function loadCustomers() {
  if (!factoryId.value) return;
  try {
    const res = await get(`/${factoryId.value}/customers`, { params: { page: 1, size: 100 } });
    if (res.success && res.data) customers.value = res.data.content || [];
  } catch { /* ignore */ }
}

async function loadProducts() {
  if (!factoryId.value) return;
  try {
    const res = await get(`/${factoryId.value}/products/types`);
    if (res.success && res.data) products.value = Array.isArray(res.data) ? res.data : res.data.content || [];
  } catch { /* ignore */ }
}

function addItem() { form.value.items.push({ productTypeId: '', quantity: 0, unit: 'kg', unitPrice: 0 }); }
function removeItem(idx: number) { if (form.value.items.length > 1) form.value.items.splice(idx, 1); }

async function handleCreate() {
  if (!form.value.customerId) return ElMessage.warning('请选择客户');
  try {
    const res = await post(`/${factoryId.value}/sales/orders`, form.value);
    if (res.success) { ElMessage.success('创建成功'); dialogVisible.value = false; loadData(); }
  } catch { ElMessage.error('创建失败'); }
}

async function handleAction(orderId: string, action: string) {
  const map: Record<string, { label: string; url: string }> = {
    confirm: { label: '确认', url: `/${factoryId.value}/sales/orders/${orderId}/confirm` },
    cancel: { label: '取消', url: `/${factoryId.value}/sales/orders/${orderId}/cancel` },
  };
  const a = map[action];
  if (!a) return;
  try {
    await ElMessageBox.confirm(`确认${a.label}此${label('salesOrder')}？`, '操作确认');
    const res = await post(a.url);
    if (res.success) { ElMessage.success(`${a.label}成功`); loadData(); }
  } catch { /* cancelled */ }
}

function goDetail(id: string) { router.push(`/sales/orders/${id}`); }
function handlePageChange(page: number) { pagination.value.page = page; loadData(); }
function handleSizeChange(size: number) { pagination.value.size = size; pagination.value.page = 1; loadData(); }
function handleStatusChange() { pagination.value.page = 1; loadData(); }
function handleRefresh() { statusFilter.value = ''; pagination.value.page = 1; loadData(); }

// ==================== AI Entry ====================
const aiEntryVisible = ref(false);

function handleAiFill(params: Record<string, unknown>) {
  // Match customerName to customerId
  const customerName = String(params.customerName || '');
  const matched = customers.value.find(
    (c: Record<string, unknown>) => String(c.name || '').includes(customerName) || customerName.includes(String(c.name || ''))
  );

  form.value.customerId = matched ? String(matched.id) : '';
  form.value.requiredDeliveryDate = String(params.requiredDeliveryDate || '');
  form.value.deliveryAddress = String(params.deliveryAddress || '');
  form.value.remark = String(params.remark || '');

  if (Array.isArray(params.items) && params.items.length > 0) {
    form.value.items = (params.items as Record<string, unknown>[]).map((item) => {
      const prodName = String(item.productName || '');
      const prodMatch = products.value.find(
        (p: Record<string, unknown>) => String(p.name || '').includes(prodName) || prodName.includes(String(p.name || ''))
      );
      return {
        productTypeId: prodMatch ? String(prodMatch.id) : '',
        quantity: Number(item.quantity || 0),
        unit: String(item.unit || 'kg'),
        unitPrice: Number(item.unitPrice || 0),
      };
    });
  }

  dialogVisible.value = true;
}

async function handleQuickDelivery(row: any) {
  const today = new Date().toISOString().slice(0, 10);
  // Build items from order items (each with productTypeId, deliveredQuantity, unit)
  let items: any[] = [];
  if (row.items && row.items.length > 0) {
    items = row.items.map((item: any) => ({
      productTypeId: item.productTypeId || item.productType?.id || '',
      deliveredQuantity: item.quantity || 0,
      unit: item.unit || 'kg',
    }));
  } else {
    // Fallback: single item placeholder
    items = [{ productTypeId: '', deliveredQuantity: row.totalQuantity || 1, unit: 'kg' }];
  }
  deliveryForm.value = {
    salesOrderId: row.id,
    customerId: row.customerId || row.customer?.id || '',
    deliveryDate: today,
    deliveryAddress: row.deliveryAddress || row.customer?.shippingAddress || '',
    items,
    remark: `销售订单 ${row.orderNumber || ''} 快速出库`,
  };
  deliveryDialogVisible.value = true;
}

async function submitQuickDelivery() {
  if (!deliveryForm.value.customerId) return ElMessage.warning('缺少客户信息');
  if (!deliveryForm.value.deliveryDate) return ElMessage.warning('请选择发货日期');
  try {
    const res = await post(`/${factoryId.value}/sales/deliveries`, deliveryForm.value);
    if (res.success) {
      ElMessage.success('出库成功');
      deliveryDialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(res.message || '出库失败');
    }
  } catch {
    ElMessage.error('出库失败');
  }
}

async function handleQuickInvoice(row: any) {
  invoiceForm.value = {
    orderId: row.id,
    counterpartyId: row.customerId || row.customer?.id || '',
    amount: row.totalAmount || 0,
    notes: `销售订单 ${row.orderNumber || ''} 开票`,
  };
  invoiceDialogVisible.value = true;
}

async function submitQuickInvoice() {
  if (!invoiceForm.value.counterpartyId) return ElMessage.warning('缺少客户信息');
  try {
    const res = await post(`/${factoryId.value}/finance/receivable`, invoiceForm.value);
    if (res.success) {
      ElMessage.success('开票成功');
      invoiceDialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(res.message || '开票失败');
    }
  } catch {
    ElMessage.error('开票失败');
  }
}

async function handleQuickPayment(row: any) {
  paymentForm.value = {
    counterpartyId: row.customerId || row.customer?.id || '',
    amount: row.totalAmount || 0,
    paymentMethod: 'BANK_TRANSFER',
    notes: `销售订单 ${row.orderNumber || ''} 收款`,
  };
  paymentDialogVisible.value = true;
}

async function submitQuickPayment() {
  if (!paymentForm.value.counterpartyId) return ElMessage.warning('缺少客户信息');
  try {
    const res = await post(`/${factoryId.value}/finance/receivable/payment`, paymentForm.value);
    if (res.success) {
      ElMessage.success('收款成功');
      paymentDialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(res.message || '收款失败');
    }
  } catch {
    ElMessage.error('收款失败');
  }
}
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">{{ label('salesOrder') }}管理</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button type="success" :icon="ChatDotRound" @click="aiEntryVisible = true">
              AI录入
            </el-button>
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="dialogVisible = true">新建{{ label('salesOrder') }}</el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-select v-model="statusFilter" placeholder="按状态筛选" clearable style="width: 160px" @change="handleStatusChange">
          <el-option v-for="(v, k) in statusMap" :key="k" :label="v.text" :value="k" />
        </el-select>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" empty-text="暂无数据" stripe border style="width: 100%">
        <el-table-column prop="orderNumber" label="订单编号" width="170" />
        <el-table-column label="客户" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.customer?.name || row.customerId || '-' }}</template>
        </el-table-column>
        <el-table-column prop="orderDate" label="下单日期" width="120" />
        <el-table-column prop="totalAmount" label="总金额" width="130" align="right">
          <template #default="{ row }">{{ formatAmount(row.totalAmount) }}</template>
        </el-table-column>
        <el-table-column prop="discountAmount" label="折扣" width="100" align="right">
          <template #default="{ row }">{{ row.discountAmount ? formatAmount(row.discountAmount) : '-' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="(statusMap[row.status]?.type) || 'info'" size="small">
              {{ statusMap[row.status]?.text || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="goDetail(row.id)">详情</el-button>
            <el-button v-if="row.status === 'DRAFT' && canWrite" type="success" link size="small" @click="handleAction(row.id, 'confirm')">确认</el-button>
            <el-button v-if="['DRAFT','CONFIRMED'].includes(row.status) && canWrite" type="danger" link size="small" @click="handleAction(row.id, 'cancel')">取消</el-button>
            <el-button
              v-if="row.status === 'CONFIRMED' || row.status === 'PROCESSING'"
              type="warning"
              link
              size="small"
              @click="handleQuickDelivery(row)"
            >出库</el-button>
            <el-button
              v-if="row.status === 'CONFIRMED' || row.status === 'PROCESSING' || row.status === 'SHIPPED'"
              type="success"
              link
              size="small"
              @click="handleQuickInvoice(row)"
            >开票</el-button>
            <el-button
              v-if="row.status === 'CONFIRMED' || row.status === 'PROCESSING' || row.status === 'SHIPPED'"
              type="primary"
              link
              size="small"
              @click="handleQuickPayment(row)"
            >收款</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.size"
          :page-sizes="[10, 20, 50]" :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange" @size-change="handleSizeChange" />
      </div>
    </el-card>

    <!-- 出库对话框 -->
    <el-dialog v-model="deliveryDialogVisible" title="快速出库" width="500px">
      <el-form :model="deliveryForm" label-width="80px">
        <el-form-item label="发货日期">
          <el-date-picker v-model="deliveryForm.deliveryDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="发货明细">
          <div v-for="(item, idx) in deliveryForm.items" :key="idx" style="margin-bottom: 4px">
            {{ idx + 1 }}. 数量: <el-input-number v-model="item.deliveredQuantity" :min="1" size="small" style="width: 120px" /> {{ item.unit }}
          </div>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="deliveryForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deliveryDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitQuickDelivery">确认出库</el-button>
      </template>
    </el-dialog>

    <!-- 开票对话框 -->
    <el-dialog v-model="invoiceDialogVisible" title="快速开票" width="400px">
      <el-form :model="invoiceForm" label-width="80px">
        <el-form-item label="开票金额">
          <el-input-number v-model="invoiceForm.amount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="invoiceForm.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="invoiceDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitQuickInvoice">确认开票</el-button>
      </template>
    </el-dialog>

    <!-- 收款对话框 -->
    <el-dialog v-model="paymentDialogVisible" title="快速收款" width="400px">
      <el-form :model="paymentForm" label-width="80px">
        <el-form-item label="收款金额">
          <el-input-number v-model="paymentForm.amount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="收款方式">
          <el-select v-model="paymentForm.paymentMethod" style="width: 100%">
            <el-option label="银行转账" value="BANK_TRANSFER" />
            <el-option label="现金" value="CASH" />
            <el-option label="支票" value="CHECK" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="paymentForm.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="paymentDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitQuickPayment">确认收款</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dialogVisible" :title="`新建${label('salesOrder')}`" width="720px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item :label="label('customer')">
          <el-select v-model="form.customerId" placeholder="请选择" filterable style="width: 100%">
            <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="交货日期"><el-date-picker v-model="form.requiredDeliveryDate" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="交货地址"><el-input v-model="form.deliveryAddress" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
        <el-divider>{{ label('product') }}明细</el-divider>
        <div v-for="(item, idx) in form.items" :key="idx" class="item-row">
          <el-select v-model="item.productTypeId" placeholder="选择产品" filterable style="width: 200px">
            <el-option v-for="p in products" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
          <el-input-number v-model="item.quantity" :min="1" style="width: 120px" />
          <el-input v-model="item.unit" style="width: 80px" />
          <el-input-number v-model="item.unitPrice" :min="0" :precision="2" style="width: 120px" />
          <el-button type="danger" link @click="removeItem(idx)" :disabled="form.items.length <= 1">删除</el-button>
        </div>
        <el-button style="width: 100%; margin-top: 8px" @click="addItem">+ 添加行</el-button>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- AI 对话录入 -->
    <AiEntryDrawer
      v-model="aiEntryVisible"
      :config="SALES_ORDER_CONFIG"
      @fill-form="handleAiFill"
    />
  </div>
</template>

<style lang="scss" scoped>
.page-wrapper { height: 100%; width: 100%; display: flex; flex-direction: column; }
.page-card { flex: 1; display: flex; flex-direction: column;
  :deep(.el-card__header) { padding: 16px 20px; border-bottom: 1px solid #ebeef5; }
  :deep(.el-card__body) { flex: 1; display: flex; flex-direction: column; padding: 20px; }
}
.card-header { display: flex; justify-content: space-between; align-items: center;
  .header-left { display: flex; align-items: baseline; gap: 12px;
    .page-title { font-size: 16px; font-weight: 600; color: #303133; }
    .data-count { font-size: 13px; color: #909399; }
  }
}
.search-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.pagination-wrapper { display: flex; justify-content: flex-end; padding-top: 16px; border-top: 1px solid #ebeef5; margin-top: 16px; }
.item-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
</style>
