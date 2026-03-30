<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { formatDateTimeCell } from '@/utils/tableFormatters';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('sales'));

const loading = ref(false);
const tableData = ref<Record<string, unknown>[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const customerMap = ref<Record<string, string>>({});

onMounted(() => {
  loadData();
  loadCustomers();
});

async function loadCustomers() {
  if (!factoryId.value) return;
  try {
    const res = await get(`/${factoryId.value}/customers`, { params: { page: 1, size: 100 } });
    if (res.success && res.data) {
      const list = res.data.content || [];
      const map: Record<string, string> = {};
      list.forEach((c: Record<string, unknown>) => { if (c.id && c.name) map[String(c.id)] = String(c.name); });
      customerMap.value = map;
    } else if (res.success === false) {
      ElMessage.error(res.message || '加载客户数据失败');
    }
  } catch { ElMessage.error('加载客户数据失败'); }
}

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/shipments`, {
      params: { page: pagination.value.page - 1, size: pagination.value.size }
    });
    if (response.success && response.data) {
      tableData.value = response.data.content || [];
      pagination.value.total = response.data.totalElements || 0;
    } else if (response.success === false) {
      ElMessage.error(response.message || '加载出货记录失败');
    }
  } catch (error) {
    console.error('加载失败:', error);
    ElMessage.error('加载数据失败');
  } finally {
    loading.value = false;
  }
}

function handlePageChange(page: number) {
  pagination.value.page = page;
  loadData();
}

// ==================== View ====================
const viewDialogVisible = ref(false);
const viewRecord = ref<Record<string, unknown> | null>(null);

function handleView(row: Record<string, unknown>) {
  viewRecord.value = row;
  viewDialogVisible.value = true;
}

function getStatusType(status: string) {
  const map: Record<string, string> = {
    PENDING: 'info',
    SHIPPED: 'warning',
    DELIVERED: 'success',
    CANCELLED: 'danger'
  };
  return map[status?.toUpperCase()] || 'info';
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING: '待出货',
    SHIPPED: '已发货',
    DELIVERED: '已送达',
    CANCELLED: '已取消'
  };
  return map[status?.toUpperCase()] || status;
}
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>出货记录管理</span>
          <el-button v-if="canWrite" type="primary" :icon="Plus">新建出货</el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" empty-text="暂无数据" stripe border>
        <el-table-column prop="shipmentNumber" label="出货单号" width="160" />
        <el-table-column label="客户名称">
          <template #default="{ row }">{{ customerMap[row.customerId] || row.customerId || '-' }}</template>
        </el-table-column>
        <el-table-column prop="productName" label="产品" />
        <el-table-column prop="quantity" label="数量" />
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="出货时间" width="180" :formatter="formatDateTimeCell" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleView(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 查看详情 -->
      <el-dialog v-model="viewDialogVisible" title="出货详情" width="500px" destroy-on-close>
        <el-descriptions v-if="viewRecord" :column="1" border>
          <el-descriptions-item label="出货单号">{{ viewRecord.shipmentNumber || '-' }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ customerMap[viewRecord.customerId] || viewRecord.customerId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="产品">{{ viewRecord.productName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="数量">{{ viewRecord.quantity || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(viewRecord.status)">{{ getStatusText(viewRecord.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="出货时间">{{ viewRecord.createdAt || '-' }}</el-descriptions-item>
        </el-descriptions>
      </el-dialog>

      <el-pagination
        v-model:current-page="pagination.page"
        :page-size="pagination.size"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="handlePageChange"
        class="pagination"
      />
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.page-container {
  padding: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.pagination {
  margin-top: 20px;
  justify-content: flex-end;
}
</style>
