<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, put } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Refresh, Check, Bell } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('equipment'));

const loading = ref(false);
const tableData = ref<any[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const searchForm = ref({
  keyword: '',
  severity: '',
  status: ''
});

// 统计数据
const statistics = ref({
  total: 0,
  critical: 0,
  warning: 0,
  resolved: 0
});

onMounted(() => {
  loadData();
  loadStatistics();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/equipment-alerts`, {
      params: {
        page: pagination.value.page,
        size: pagination.value.size,
        keyword: searchForm.value.keyword || undefined,
        severity: searchForm.value.severity || undefined,
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

async function loadStatistics() {
  if (!factoryId.value) return;
  try {
    const response = await get(`/${factoryId.value}/equipment-alerts/stats`);
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
  searchForm.value = { keyword: '', severity: '', status: '' };
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

async function handleResolve(row: any) {
  try {
    const { value } = await ElMessageBox.prompt('请输入处理说明', '处理告警', {
      inputPattern: /.+/,
      inputErrorMessage: '请输入处理说明'
    });
    const response = await put(`/${factoryId.value}/equipment-alerts/${row.id}/resolve`, {
      resolution: value
    });
    if (response.success) {
      ElMessage.success('已处理');
      loadData();
      loadStatistics();
    } else {
      ElMessage.error(response.message || '处理失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('处理失败');
    }
  }
}

async function handleAcknowledge(row: any) {
  try {
    await ElMessageBox.confirm('确定确认此告警?', '提示', { type: 'warning' });
    const response = await put(`/${factoryId.value}/equipment-alerts/${row.id}/acknowledge`);
    if (response.success) {
      ElMessage.success('已确认');
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

function getSeverityType(severity: string) {
  const map: Record<string, string> = {
    CRITICAL: 'danger',
    HIGH: 'danger',
    MEDIUM: 'warning',
    LOW: 'info'
  };
  return map[severity] || 'info';
}

function getSeverityText(severity: string) {
  const map: Record<string, string> = {
    CRITICAL: '严重',
    HIGH: '高',
    MEDIUM: '中',
    LOW: '低'
  };
  return map[severity] || severity;
}

function getStatusType(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'danger',
    ACKNOWLEDGED: 'warning',
    RESOLVED: 'success'
  };
  return map[status] || 'info';
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    ACTIVE: '活跃',
    ACKNOWLEDGED: '已确认',
    RESOLVED: '已处理'
  };
  return map[status] || status;
}

function getAlertTypeText(type: string) {
  const map: Record<string, string> = {
    TEMPERATURE: '温度异常',
    VIBRATION: '振动异常',
    POWER: '电力异常',
    MALFUNCTION: '设备故障',
    MAINTENANCE_DUE: '维护到期',
    OTHER: '其他'
  };
  return map[type] || type;
}
</script>

<template>
  <div class="page-wrapper">
    <!-- 统计卡片 -->
    <div class="statistics-row">
      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-value">{{ statistics.total }}</div>
          <div class="stat-label">总告警数</div>
        </div>
      </el-card>
      <el-card class="stat-card danger" shadow="hover">
        <div class="stat-content">
          <div class="stat-value">{{ statistics.critical }}</div>
          <div class="stat-label">严重告警</div>
        </div>
      </el-card>
      <el-card class="stat-card warning" shadow="hover">
        <div class="stat-content">
          <div class="stat-value">{{ statistics.warning }}</div>
          <div class="stat-label">警告</div>
        </div>
      </el-card>
      <el-card class="stat-card success" shadow="hover">
        <div class="stat-content">
          <div class="stat-value">{{ statistics.resolved }}</div>
          <div class="stat-label">已处理</div>
        </div>
      </el-card>
    </div>

    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">告警管理</span>
            <span class="data-count">共 {{ pagination.total }} 条告警</span>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索设备名称/告警信息"
          :prefix-icon="Search"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-select v-model="searchForm.severity" placeholder="严重程度" clearable style="width: 130px">
          <el-option label="严重" value="CRITICAL" />
          <el-option label="高" value="HIGH" />
          <el-option label="中" value="MEDIUM" />
          <el-option label="低" value="LOW" />
        </el-select>
        <el-select v-model="searchForm.status" placeholder="状态" clearable style="width: 130px">
          <el-option label="活跃" value="ACTIVE" />
          <el-option label="已确认" value="ACKNOWLEDGED" />
          <el-option label="已处理" value="RESOLVED" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%">
        <el-table-column prop="equipmentName" label="设备名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="alertType" label="告警类型" width="120" align="center">
          <template #default="{ row }">
            {{ getAlertTypeText(row.alertType) }}
          </template>
        </el-table-column>
        <el-table-column prop="severity" label="严重程度" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getSeverityType(row.severity)" size="small">
              {{ getSeverityText(row.severity) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="告警信息" min-width="200" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="发生时间" width="180" />
        <el-table-column prop="resolvedAt" label="处理时间" width="180">
          <template #default="{ row }">
            {{ row.resolvedAt || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small">详情</el-button>
            <el-button
              v-if="canWrite && row.status === 'ACTIVE'"
              type="warning"
              link
              size="small"
              :icon="Bell"
              @click="handleAcknowledge(row)"
            >确认</el-button>
            <el-button
              v-if="canWrite && row.status !== 'RESOLVED'"
              type="success"
              link
              size="small"
              :icon="Check"
              @click="handleResolve(row)"
            >处理</el-button>
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
