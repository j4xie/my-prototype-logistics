<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Refresh } from '@element-plus/icons-vue';

const router = useRouter();

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('equipment'));

const loading = ref(false);
const tableData = ref<any[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const searchKeyword = ref('');

onMounted(() => {
  loadData();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/equipment`, {
      params: {
        page: pagination.value.page,
        size: pagination.value.size,
        keyword: searchKeyword.value || undefined
      }
    });
    if (response.success && response.data) {
      tableData.value = response.data.content || [];
      pagination.value.total = response.data.totalElements || 0;
    } else if (response.success === false) {
      ElMessage.error(response.message || '加载数据失败');
    }
  } catch (error) {
    console.error('加载失败:', error);
    ElMessage.error('加载数据失败');
  } finally {
    loading.value = false;
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

function getStatusType(status: string) {
  const map: Record<string, string> = {
    RUNNING: 'success',
    ACTIVE: 'success',
    ONLINE: 'success',
    IDLE: 'info',
    STANDBY: 'info',
    INACTIVE: 'info',
    OFFLINE: 'info',
    DISABLED: 'info',
    MAINTENANCE: 'warning',
    FAULT: 'danger',
    ERROR: 'danger',
    STOPPED: 'warning',
  };
  return map[status?.toUpperCase()] || 'info';
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    RUNNING: '运行中',
    ACTIVE: '运行中',
    ONLINE: '在线',
    IDLE: '空闲',
    STANDBY: '待机',
    INACTIVE: '停用',
    OFFLINE: '离线',
    DISABLED: '已禁用',
    MAINTENANCE: '维护中',
    FAULT: '故障',
    ERROR: '故障',
    STOPPED: '已停止',
  };
  return map[status?.toUpperCase()] || status;
}

const detailVisible = ref(false);
const detailData = ref<Record<string, unknown>>({});

async function handleView(row: Record<string, unknown>) {
  if (!factoryId.value) return;
  try {
    const response = await get(`/${factoryId.value}/equipment/${row.id}`);
    if (response.success && response.data) {
      detailData.value = response.data;
      detailVisible.value = true;
    } else {
      ElMessage.error(response.message || '获取设备详情失败');
    }
  } catch (error) {
    console.error('获取设备详情失败:', error);
    ElMessage.error('获取设备详情失败');
  }
}

function handleMaintenance(row: Record<string, unknown>) {
  router.push({ path: '/equipment/maintenance', query: { equipmentId: row.id as string } });
}

function handleEdit(row: Record<string, unknown>) {
  ElMessage.info('编辑功能开发中');
}

function handleAdd() {
  ElMessage.info('添加设备功能开发中');
}
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">设备管理</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleAdd">添加设备</el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索设备编号/名称"
          :prefix-icon="Search"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" empty-text="暂无数据" stripe border style="width: 100%">
        <el-table-column prop="equipmentCode" label="设备编号" width="140" />
        <el-table-column prop="name" label="设备名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="model" label="型号" width="120" />
        <el-table-column prop="location" label="位置" min-width="150" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastMaintenanceDate" label="上次维护" width="120" />
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">查看</el-button>
            <el-button v-if="canWrite" type="primary" link size="small" @click="handleMaintenance(row)">维护</el-button>
            <el-button v-if="canWrite" type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
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

    <el-dialog v-model="detailVisible" title="设备详情" width="500px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="设备编号">{{ detailData.equipmentCode || '-' }}</el-descriptions-item>
        <el-descriptions-item label="设备名称">{{ detailData.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="型号">{{ detailData.model || '-' }}</el-descriptions-item>
        <el-descriptions-item label="位置">{{ detailData.location || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(detailData.status as string)" size="small">
            {{ getStatusText(detailData.status as string) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="上次维护">{{ detailData.lastMaintenanceDate || '-' }}</el-descriptions-item>
      </el-descriptions>
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
