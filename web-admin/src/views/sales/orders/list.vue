<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { useBusinessMode } from '@/composables/useBusinessMode';
import { get, post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh } from '@element-plus/icons-vue';

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

function formatAmount(val: number) {
  if (val == null) return '-';
  return `¥${Number(val).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
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

      <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%">
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
            <el-tag :type="(statusMap[row.status]?.type as any) || 'info'" size="small">
              {{ statusMap[row.status]?.text || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="goDetail(row.id)">详情</el-button>
            <el-button v-if="row.status === 'DRAFT' && canWrite" type="success" link size="small" @click="handleAction(row.id, 'confirm')">确认</el-button>
            <el-button v-if="['DRAFT','CONFIRMED'].includes(row.status) && canWrite" type="danger" link size="small" @click="handleAction(row.id, 'cancel')">取消</el-button>
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
