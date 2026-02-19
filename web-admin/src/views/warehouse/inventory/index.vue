<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post } from '@/api/request';
import { ElMessage } from 'element-plus';
import { Search, Refresh, DataAnalysis, Edit, View, Download, Warning } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('warehouse'));

const loading = ref(false);
const tableData = ref<any[]>([]);
const pagination = ref({ page: 1, size: 20, total: 0 });
const searchKeyword = ref('');
const statusFilter = ref('');

// 库存统计
const statistics = ref({
  totalBatches: 0,
  totalQuantity: 0,
  lowStockCount: 0,
  expiringCount: 0
});

// 调整库存对话框
const adjustDialogVisible = ref(false);
const adjustLoading = ref(false);
const adjustForm = ref({
  batchId: '',
  batchNumber: '',
  currentQuantity: 0,
  adjustQuantity: 0,
  reason: ''
});

// 批次详情对话框
const detailDialogVisible = ref(false);
const detailData = ref<any>(null);
const detailLoading = ref(false);
const adjustHistory = ref<any[]>([]);

// 状态选项
const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'AVAILABLE', label: '可用' },
  { value: 'FRESH', label: '鲜品' },
  { value: 'FROZEN', label: '冻品' },
  { value: 'RESERVED', label: '已预留' },
  { value: 'INSPECTING', label: '质检中' },
  { value: 'DEPLETED', label: '已耗尽' },
  { value: 'EXPIRED', label: '已过期' },
  { value: 'SCRAPPED', label: '已报废' },
];

onMounted(() => {
  loadData();
  loadStatistics();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const params: Record<string, any> = {
      page: pagination.value.page,
      size: pagination.value.size,
    };
    if (searchKeyword.value) params.keyword = searchKeyword.value;
    if (statusFilter.value) params.status = statusFilter.value;

    const response = await get(`/${factoryId.value}/material-batches`, { params });
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

async function loadStatistics() {
  if (!factoryId.value) return;
  try {
    const response = await get(`/${factoryId.value}/material-batches/inventory/statistics`);
    if (response.success && response.data) {
      statistics.value = response.data;
    }
  } catch (error) {
    console.error('加载统计失败:', error);
  }
}

function handleSearch() {
  pagination.value.page = 1;
  loadData();
}

function handleRefresh() {
  searchKeyword.value = '';
  statusFilter.value = '';
  pagination.value.page = 1;
  loadData();
  loadStatistics();
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

function handleAdjust(row: any) {
  adjustForm.value = {
    batchId: row.id,
    batchNumber: row.batchNumber,
    currentQuantity: row.currentQuantity ?? row.quantity ?? 0,
    adjustQuantity: 0,
    reason: ''
  };
  adjustDialogVisible.value = true;
}

async function submitAdjust() {
  if (!adjustForm.value.adjustQuantity || !adjustForm.value.reason) {
    ElMessage.warning('请填写调整数量和原因');
    return;
  }

  adjustLoading.value = true;
  try {
    const response = await post(`/${factoryId.value}/material-batches/${adjustForm.value.batchId}/adjust`, {
      quantity: adjustForm.value.adjustQuantity,
      reason: adjustForm.value.reason
    });
    if (response.success) {
      ElMessage.success('调整成功');
      adjustDialogVisible.value = false;
      loadData();
      loadStatistics();
    } else {
      ElMessage.error(response.message || '调整失败');
    }
  } catch (error) {
    ElMessage.error('调整失败');
  } finally {
    adjustLoading.value = false;
  }
}

async function handleViewDetail(row: any) {
  detailData.value = row;
  detailDialogVisible.value = true;
  adjustHistory.value = [];
  detailLoading.value = true;
  try {
    const response = await get(`/${factoryId.value}/material-batches/${row.id}/usage-history`);
    if (response.success && response.data) {
      adjustHistory.value = Array.isArray(response.data) ? response.data : (response.data.content || []);
    }
  } catch {
    // Usage history may not exist for all batches
  } finally {
    detailLoading.value = false;
  }
}

async function handleExport() {
  if (!factoryId.value) return;
  try {
    const response = await get(`/${factoryId.value}/material-batches/export`, {
      responseType: 'blob'
    });
    const blob = new Blob([response as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `库存盘点报告_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
  } catch {
    ElMessage.error('导出失败');
  }
}

// 过期日期高亮
function getExpireDateClass(row: any): string {
  if (!row.expirationDate && !row.expireDate) return '';
  const dateStr = row.expirationDate || row.expireDate;
  const expDate = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'expire-expired';
  if (diffDays <= 30) return 'expire-danger';
  if (diffDays <= 60) return 'expire-warning';
  return '';
}

const STATUS_MAP: Record<string, { text: string; type: string }> = {
  IN_STOCK: { text: '库存中', type: 'success' },
  AVAILABLE: { text: '可用', type: 'success' },
  FRESH: { text: '鲜品', type: '' },
  FROZEN: { text: '冻品', type: 'info' },
  DEPLETED: { text: '已耗尽', type: 'info' },
  USED_UP: { text: '已用完', type: 'info' },
  EXPIRED: { text: '已过期', type: 'danger' },
  INSPECTING: { text: '质检中', type: 'warning' },
  SCRAPPED: { text: '已报废', type: 'danger' },
  RESERVED: { text: '已预留', type: 'warning' },
};

function getStatusType(status: string) {
  return STATUS_MAP[status]?.type || 'info';
}

function getStatusText(status: string) {
  return STATUS_MAP[status]?.text || status;
}
</script>

<template>
  <div class="page-wrapper">
    <!-- 统计卡片 -->
    <div class="statistics-row">
      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-value">{{ statistics.totalBatches }}</div>
          <div class="stat-label">批次总数</div>
        </div>
      </el-card>
      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-value">{{ statistics.totalQuantity }}</div>
          <div class="stat-label">库存总量</div>
        </div>
      </el-card>
      <el-card class="stat-card warning" shadow="hover">
        <div class="stat-content">
          <div class="stat-value">{{ statistics.lowStockCount }}</div>
          <div class="stat-label">低库存预警</div>
        </div>
      </el-card>
      <el-card class="stat-card danger" shadow="hover">
        <div class="stat-content">
          <div class="stat-value">{{ statistics.expiringCount }}</div>
          <div class="stat-label">即将过期</div>
        </div>
      </el-card>
    </div>

    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">库存盘点</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button :icon="Download" @click="handleExport">导出报告</el-button>
            <el-button :icon="DataAnalysis" @click="loadStatistics">刷新统计</el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索批次号/材料名称"
          :prefix-icon="Search"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 150px" @change="handleSearch">
          <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%">
        <el-table-column prop="batchNumber" label="批次号" width="160" />
        <el-table-column prop="materialTypeName" label="材料类型" min-width="150" show-overflow-tooltip />
        <el-table-column label="当前数量" width="120" align="right">
          <template #default="{ row }">
            {{ row.currentQuantity ?? row.quantity ?? '-' }}
          </template>
        </el-table-column>
        <el-table-column label="单位" width="80" align="center">
          <template #default="{ row }">
            {{ row.quantityUnit || row.unit || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="storageLocation" label="存储位置" width="130" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="过期日期" width="120">
          <template #default="{ row }">
            <span :class="getExpireDateClass(row)">
              {{ row.expirationDate || row.expireDate || '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="170" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" :icon="View" @click="handleViewDetail(row)">查看</el-button>
            <el-button
              v-if="canWrite && (row.status === 'AVAILABLE' || row.status === 'IN_STOCK' || row.status === 'FRESH' || row.status === 'FROZEN')"
              type="warning"
              link
              size="small"
              :icon="Edit"
              @click="handleAdjust(row)"
            >调整</el-button>
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

    <!-- 调整库存对话框 -->
    <el-dialog v-model="adjustDialogVisible" title="调整库存" width="450px">
      <el-form :model="adjustForm" label-width="100px">
        <el-form-item label="批次号">
          <el-input v-model="adjustForm.batchNumber" disabled />
        </el-form-item>
        <el-form-item label="当前数量">
          <el-input-number v-model="adjustForm.currentQuantity" disabled style="width: 100%" />
        </el-form-item>
        <el-form-item label="调整数量" required>
          <el-input-number v-model="adjustForm.adjustQuantity" :step="1" style="width: 100%" />
          <div class="form-tip">正数增加，负数减少</div>
        </el-form-item>
        <el-form-item label="调整原因" required>
          <el-input v-model="adjustForm.reason" type="textarea" :rows="3" placeholder="请输入调整原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="adjustLoading" @click="submitAdjust">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批次详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="批次详情" width="650px">
      <div v-if="detailData" class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">批次号</span>
          <span class="detail-value">{{ detailData.batchNumber }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">材料类型</span>
          <span class="detail-value">{{ detailData.materialTypeName || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">供应商</span>
          <span class="detail-value">{{ detailData.supplierName || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">状态</span>
          <el-tag :type="getStatusType(detailData.status)" size="small">{{ getStatusText(detailData.status) }}</el-tag>
        </div>
        <div class="detail-item">
          <span class="detail-label">入库数量</span>
          <span class="detail-value">{{ detailData.receiptQuantity ?? detailData.inboundQuantity ?? '-' }} {{ detailData.quantityUnit || detailData.unit || '' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">当前数量</span>
          <span class="detail-value">{{ detailData.currentQuantity ?? detailData.quantity ?? '-' }} {{ detailData.quantityUnit || detailData.unit || '' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">已用数量</span>
          <span class="detail-value">{{ detailData.usedQuantity ?? '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">预留数量</span>
          <span class="detail-value">{{ detailData.reservedQuantity ?? '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">单价</span>
          <span class="detail-value">{{ detailData.unitPrice != null ? `¥${detailData.unitPrice}` : '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">存储位置</span>
          <span class="detail-value">{{ detailData.storageLocation || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">入库日期</span>
          <span class="detail-value">{{ detailData.receiptDate || detailData.inboundDate || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">生产日期</span>
          <span class="detail-value">{{ detailData.productionDate || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">过期日期</span>
          <span class="detail-value" :class="getExpireDateClass(detailData)">{{ detailData.expirationDate || detailData.expireDate || '-' }}</span>
        </div>
        <div class="detail-item" style="grid-column: span 2">
          <span class="detail-label">备注</span>
          <span class="detail-value">{{ detailData.notes || '-' }}</span>
        </div>
      </div>

      <!-- 调整历史 -->
      <div v-if="adjustHistory.length > 0" style="margin-top: 20px">
        <div style="font-weight: 600; margin-bottom: 8px; font-size: 14px">调整/使用记录</div>
        <el-table :data="adjustHistory" size="small" border stripe max-height="250">
          <el-table-column prop="adjustmentType" label="类型" width="80" />
          <el-table-column prop="adjustmentQuantity" label="数量" width="90" align="right" />
          <el-table-column prop="quantityBefore" label="调前" width="90" align="right" />
          <el-table-column prop="quantityAfter" label="调后" width="90" align="right" />
          <el-table-column prop="reason" label="原因" min-width="120" show-overflow-tooltip />
          <el-table-column prop="adjustmentTime" label="时间" width="160" show-overflow-tooltip />
        </el-table>
      </div>
      <div v-else-if="detailLoading" style="text-align: center; padding: 20px">
        <el-icon class="is-loading"><DataAnalysis /></el-icon> 加载中...
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.page-wrapper {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.statistics-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  .stat-content {
    text-align: center;
    padding: 8px 0;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 600;
    color: #409eff;
  }

  .stat-label {
    font-size: 14px;
    color: #909399;
    margin-top: 8px;
  }

  &.warning .stat-value {
    color: #e6a23c;
  }

  &.danger .stat-value {
    color: #f56c6c;
  }
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

  .header-right {
    display: flex;
    gap: 8px;
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

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

// 过期日期高亮
.expire-expired {
  color: #f56c6c;
  font-weight: 600;
}

.expire-danger {
  color: #e6a23c;
  font-weight: 500;
}

.expire-warning {
  color: #909399;
}

// 详情网格
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 24px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  color: #909399;
}

.detail-value {
  font-size: 14px;
  color: #303133;
}
</style>
