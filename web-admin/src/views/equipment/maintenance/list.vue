<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Refresh, Tools, Check } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('equipment'));

const loading = ref(false);
const tableData = ref<any[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const searchKeyword = ref('');

// 维护对话框
const dialogVisible = ref(false);
const dialogLoading = ref(false);
const maintenanceForm = ref({
  equipmentId: '',
  equipmentName: '',
  maintenanceType: '',
  description: '',
  cost: 0
});

// 统计数据
const statistics = ref({
  needingMaintenance: 0,
  overdue: 0,
  completedThisMonth: 0
});

onMounted(() => {
  loadData();
  loadStatistics();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/equipment/needing-maintenance`, {
      params: {
        page: pagination.value.page,
        size: pagination.value.size,
        keyword: searchKeyword.value || undefined
      }
    });
    if (response.success && response.data) {
      tableData.value = response.data.content || response.data || [];
      pagination.value.total = response.data.totalElements || tableData.value.length;
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
    const response = await get(`/${factoryId.value}/equipment/maintenance-stats`);
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

function handleMaintenance(row: any) {
  maintenanceForm.value = {
    equipmentId: row.id,
    equipmentName: row.name,
    maintenanceType: '',
    description: '',
    cost: 0
  };
  dialogVisible.value = true;
}

async function submitMaintenance() {
  if (!maintenanceForm.value.maintenanceType || !maintenanceForm.value.description) {
    ElMessage.warning('请填写完整信息');
    return;
  }

  dialogLoading.value = true;
  try {
    const response = await post(`/${factoryId.value}/equipment/${maintenanceForm.value.equipmentId}/maintenance`, {
      maintenanceType: maintenanceForm.value.maintenanceType,
      description: maintenanceForm.value.description,
      cost: maintenanceForm.value.cost
    });
    if (response.success) {
      ElMessage.success('维护记录已提交');
      dialogVisible.value = false;
      loadData();
      loadStatistics();
    } else {
      ElMessage.error(response.message || '提交失败');
    }
  } catch (error) {
    ElMessage.error('提交失败');
  } finally {
    dialogLoading.value = false;
  }
}

function getUrgencyType(days: number) {
  if (days < 0) return 'danger';
  if (days <= 7) return 'warning';
  return 'info';
}

function getUrgencyText(days: number) {
  if (days < 0) return `已逾期 ${Math.abs(days)} 天`;
  if (days === 0) return '今日需维护';
  return `${days} 天后`;
}
</script>

<template>
  <div class="page-wrapper">
    <!-- 统计卡片 -->
    <div class="statistics-row">
      <el-card class="stat-card warning" shadow="hover">
        <div class="stat-content">
          <div class="stat-value">{{ statistics.needingMaintenance }}</div>
          <div class="stat-label">待维护设备</div>
        </div>
      </el-card>
      <el-card class="stat-card danger" shadow="hover">
        <div class="stat-content">
          <div class="stat-value">{{ statistics.overdue }}</div>
          <div class="stat-label">逾期未维护</div>
        </div>
      </el-card>
      <el-card class="stat-card success" shadow="hover">
        <div class="stat-content">
          <div class="stat-value">{{ statistics.completedThisMonth }}</div>
          <div class="stat-label">本月已完成</div>
        </div>
      </el-card>
    </div>

    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">设备维护</span>
            <span class="data-count">共 {{ pagination.total }} 台需维护</span>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索设备名称/编号"
          :prefix-icon="Search"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%">
        <el-table-column prop="code" label="设备编号" width="140" />
        <el-table-column prop="name" label="设备名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="type" label="设备类型" width="120" />
        <el-table-column prop="location" label="位置" width="150" />
        <el-table-column prop="lastMaintenanceDate" label="上次维护" width="120" />
        <el-table-column prop="nextMaintenanceDate" label="下次维护" width="120" />
        <el-table-column label="紧急程度" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getUrgencyType(row.daysUntilMaintenance)" size="small">
              {{ getUrgencyText(row.daysUntilMaintenance) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="设备状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'RUNNING' ? 'success' : 'warning'" size="small">
              {{ row.status === 'RUNNING' ? '运行中' : '停机' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small">查看</el-button>
            <el-button
              v-if="canWrite"
              type="success"
              link
              size="small"
              :icon="Tools"
              @click="handleMaintenance(row)"
            >记录维护</el-button>
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

    <!-- 维护记录对话框 -->
    <el-dialog v-model="dialogVisible" title="记录维护" width="500px">
      <el-form :model="maintenanceForm" label-width="100px">
        <el-form-item label="设备名称">
          <el-input v-model="maintenanceForm.equipmentName" disabled />
        </el-form-item>
        <el-form-item label="维护类型" required>
          <el-select v-model="maintenanceForm.maintenanceType" placeholder="选择维护类型" style="width: 100%">
            <el-option label="日常保养" value="ROUTINE" />
            <el-option label="预防性维护" value="PREVENTIVE" />
            <el-option label="故障维修" value="CORRECTIVE" />
            <el-option label="紧急维修" value="EMERGENCY" />
          </el-select>
        </el-form-item>
        <el-form-item label="维护描述" required>
          <el-input v-model="maintenanceForm.description" type="textarea" :rows="3" placeholder="请描述维护内容" />
        </el-form-item>
        <el-form-item label="维护费用">
          <el-input-number v-model="maintenanceForm.cost" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogLoading" @click="submitMaintenance">提交</el-button>
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
  grid-template-columns: repeat(3, 1fr);
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

  &.success .stat-value {
    color: #67c23a;
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
</style>
