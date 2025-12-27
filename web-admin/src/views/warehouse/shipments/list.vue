<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, put } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Refresh, Ship, Check, Close } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('warehouse'));

const loading = ref(false);
const tableData = ref<any[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const searchForm = ref({
  keyword: '',
  status: ''
});

// 新建出货对话框
const dialogVisible = ref(false);
const dialogLoading = ref(false);
const shipmentForm = ref({
  customerId: '',
  productBatchId: '',
  quantity: 0,
  vehicleNumber: '',
  driverName: '',
  driverPhone: '',
  notes: ''
});
const customers = ref<any[]>([]);
const productBatches = ref<any[]>([]);

onMounted(() => {
  loadData();
  loadCustomers();
  loadProductBatches();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/shipments`, {
      params: {
        page: pagination.value.page,
        size: pagination.value.size,
        keyword: searchForm.value.keyword || undefined,
        status: searchForm.value.status || undefined
      }
    });
    if (response.success && response.data) {
      tableData.value = response.data.content || [];
      pagination.value.total = response.data.totalElements || 0;
    }
  } catch (error) {
    console.error('加载失败:', error);
    ElMessage.error('加载数据失败');
  } finally {
    loading.value = false;
  }
}

async function loadCustomers() {
  if (!factoryId.value) return;
  try {
    const response = await get(`/${factoryId.value}/customers`);
    if (response.success && response.data) {
      customers.value = response.data.content || response.data || [];
    }
  } catch (error) {
    console.error('加载客户列表失败:', error);
  }
}

async function loadProductBatches() {
  if (!factoryId.value) return;
  try {
    const response = await get(`/${factoryId.value}/processing/batches`, {
      params: { status: 'COMPLETED', size: 100 }
    });
    if (response.success && response.data) {
      productBatches.value = response.data.content || response.data || [];
    }
  } catch (error) {
    console.error('加载产品批次失败:', error);
  }
}

function handleSearch() {
  pagination.value.page = 1;
  loadData();
}

function handleRefresh() {
  searchForm.value = { keyword: '', status: '' };
  pagination.value.page = 1;
  loadData();
}

function handlePageChange(page: number) {
  pagination.value.page = page;
  loadData();
}

function handleSizeChange(size: number) {
  pagination.value.size = size;
  pagination.value.page = 1;
  loadData();
}

function handleCreate() {
  shipmentForm.value = {
    customerId: '',
    productBatchId: '',
    quantity: 0,
    vehicleNumber: '',
    driverName: '',
    driverPhone: '',
    notes: ''
  };
  dialogVisible.value = true;
}

async function submitShipment() {
  if (!shipmentForm.value.customerId || !shipmentForm.value.productBatchId || !shipmentForm.value.quantity) {
    ElMessage.warning('请填写完整信息');
    return;
  }

  dialogLoading.value = true;
  try {
    const response = await post(`/${factoryId.value}/shipments`, shipmentForm.value);
    if (response.success) {
      ElMessage.success('创建成功');
      dialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(response.message || '创建失败');
    }
  } catch (error) {
    ElMessage.error('创建失败');
  } finally {
    dialogLoading.value = false;
  }
}

async function handleShip(row: any) {
  try {
    await ElMessageBox.confirm('确定发货?', '提示', { type: 'warning' });
    const response = await put(`/${factoryId.value}/shipments/${row.id}/status`, {
      status: 'SHIPPED'
    });
    if (response.success) {
      ElMessage.success('已发货');
      loadData();
    } else {
      ElMessage.error(response.message || '操作失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败');
    }
  }
}

async function handleDelivered(row: any) {
  try {
    await ElMessageBox.confirm('确认已送达?', '提示', { type: 'warning' });
    const response = await put(`/${factoryId.value}/shipments/${row.id}/status`, {
      status: 'DELIVERED'
    });
    if (response.success) {
      ElMessage.success('已确认送达');
      loadData();
    } else {
      ElMessage.error(response.message || '操作失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败');
    }
  }
}

async function handleCancel(row: any) {
  try {
    const { value } = await ElMessageBox.prompt('请输入取消原因', '取消出货', {
      inputPattern: /.+/,
      inputErrorMessage: '请输入取消原因'
    });
    const response = await put(`/${factoryId.value}/shipments/${row.id}/status`, {
      status: 'CANCELLED',
      reason: value
    });
    if (response.success) {
      ElMessage.success('已取消');
      loadData();
    } else {
      ElMessage.error(response.message || '操作失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败');
    }
  }
}

function getStatusType(status: string) {
  const map: Record<string, string> = {
    PENDING: 'info',
    SHIPPED: 'warning',
    DELIVERED: 'success',
    CANCELLED: 'danger'
  };
  return map[status] || 'info';
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING: '待发货',
    SHIPPED: '运输中',
    DELIVERED: '已送达',
    CANCELLED: '已取消'
  };
  return map[status] || status;
}
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">出货管理</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleCreate">
              新建出货
            </el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索出货单号/客户名称"
          :prefix-icon="Search"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 150px">
          <el-option label="待发货" value="PENDING" />
          <el-option label="运输中" value="SHIPPED" />
          <el-option label="已送达" value="DELIVERED" />
          <el-option label="已取消" value="CANCELLED" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%">
        <el-table-column prop="shipmentNumber" label="出货单号" width="160" />
        <el-table-column prop="customerName" label="客户名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="productBatchNumber" label="产品批次" width="160" />
        <el-table-column prop="quantity" label="数量" width="100" align="right" />
        <el-table-column prop="vehicleNumber" label="车牌号" width="120" />
        <el-table-column prop="driverName" label="司机" width="100" />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small">查看</el-button>
            <el-button
              v-if="canWrite && row.status === 'PENDING'"
              type="success"
              link
              size="small"
              :icon="Ship"
              @click="handleShip(row)"
            >发货</el-button>
            <el-button
              v-if="canWrite && row.status === 'SHIPPED'"
              type="primary"
              link
              size="small"
              :icon="Check"
              @click="handleDelivered(row)"
            >送达</el-button>
            <el-button
              v-if="canWrite && (row.status === 'PENDING' || row.status === 'SHIPPED')"
              type="danger"
              link
              size="small"
              :icon="Close"
              @click="handleCancel(row)"
            >取消</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- 新建出货对话框 -->
    <el-dialog v-model="dialogVisible" title="新建出货" width="550px">
      <el-form :model="shipmentForm" label-width="100px">
        <el-form-item label="客户" required>
          <el-select v-model="shipmentForm.customerId" placeholder="选择客户" style="width: 100%">
            <el-option
              v-for="item in customers"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="产品批次" required>
          <el-select v-model="shipmentForm.productBatchId" placeholder="选择产品批次" style="width: 100%">
            <el-option
              v-for="item in productBatches"
              :key="item.id"
              :label="`${item.batchNumber} - ${item.productTypeName}`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="数量" required>
          <el-input-number v-model="shipmentForm.quantity" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="车牌号">
          <el-input v-model="shipmentForm.vehicleNumber" placeholder="请输入车牌号" />
        </el-form-item>
        <el-form-item label="司机姓名">
          <el-input v-model="shipmentForm.driverName" placeholder="请输入司机姓名" />
        </el-form-item>
        <el-form-item label="司机电话">
          <el-input v-model="shipmentForm.driverPhone" placeholder="请输入司机电话" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="shipmentForm.notes" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogLoading" @click="submitShipment">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.page-wrapper {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.page-card {
  flex: 1;
  display: flex;
  flex-direction: column;

  :deep(.el-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color-lighter, #ebeef5);
  }

  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .header-left {
    display: flex;
    align-items: baseline;
    gap: 12px;

    .page-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-primary, #303133);
    }

    .data-count {
      font-size: 13px;
      color: var(--text-color-secondary, #909399);
    }
  }
}

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.el-table {
  flex: 1;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--border-color-lighter, #ebeef5);
  margin-top: 16px;
}
</style>
