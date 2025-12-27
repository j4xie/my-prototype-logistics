<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Refresh, DataAnalysis, Edit } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('warehouse'));

const loading = ref(false);
const tableData = ref<any[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const searchKeyword = ref('');

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

onMounted(() => {
  loadData();
  loadStatistics();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/material-batches`, {
      params: {
        page: pagination.value.page,
        size: pagination.value.size,
        keyword: searchKeyword.value || undefined
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
    currentQuantity: row.quantity,
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
      adjustQuantity: adjustForm.value.adjustQuantity,
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

function getStatusType(status: string) {
  const map: Record<string, string> = {
    AVAILABLE: 'success',
    RESERVED: 'warning',
    DEPLETED: 'info',
    EXPIRED: 'danger'
  };
  return map[status] || 'info';
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    AVAILABLE: '可用',
    RESERVED: '已预留',
    DEPLETED: '已耗尽',
    EXPIRED: '已过期'
  };
  return map[status] || status;
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
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%">
        <el-table-column prop="batchNumber" label="批次号" width="160" />
        <el-table-column prop="materialTypeName" label="材料类型" min-width="150" show-overflow-tooltip />
        <el-table-column prop="quantity" label="当前数量" width="120" align="right" />
        <el-table-column prop="unit" label="单位" width="80" align="center" />
        <el-table-column prop="storageLocation" label="存储位置" width="150" />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="expirationDate" label="过期日期" width="120" />
        <el-table-column prop="updatedAt" label="更新时间" width="180" />
        <el-table-column label="操作" width="150" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small">查看</el-button>
            <el-button
              v-if="canWrite && row.status === 'AVAILABLE'"
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
</style>
