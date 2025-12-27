<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Refresh, VideoPlay, VideoPause, CircleCheck, CircleClose } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('production'));

const loading = ref(false);
const tableData = ref<any[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const searchForm = ref({
  keyword: '',
  status: ''
});

// 新建计划对话框
const dialogVisible = ref(false);
const dialogLoading = ref(false);
const planForm = ref({
  productTypeId: '',
  plannedQuantity: 0,
  plannedDate: '',
  notes: ''
});
const productTypes = ref<any[]>([]);

onMounted(() => {
  loadData();
  loadProductTypes();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/production-plans`, {
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

async function loadProductTypes() {
  if (!factoryId.value) return;
  try {
    const response = await get(`/${factoryId.value}/product-types`);
    if (response.success && response.data) {
      productTypes.value = response.data.content || response.data || [];
    }
  } catch (error) {
    console.error('加载产品类型失败:', error);
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
  planForm.value = {
    productTypeId: '',
    plannedQuantity: 0,
    plannedDate: '',
    notes: ''
  };
  dialogVisible.value = true;
}

async function submitPlan() {
  if (!planForm.value.productTypeId || !planForm.value.plannedQuantity || !planForm.value.plannedDate) {
    ElMessage.warning('请填写完整信息');
    return;
  }

  dialogLoading.value = true;
  try {
    const response = await post(`/${factoryId.value}/production-plans`, planForm.value);
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

async function handleStart(row: any) {
  try {
    await ElMessageBox.confirm('确定开始此生产计划?', '提示', { type: 'warning' });
    const response = await post(`/${factoryId.value}/production-plans/${row.id}/start`);
    if (response.success) {
      ElMessage.success('已开始生产');
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

async function handleComplete(row: any) {
  try {
    const { value } = await ElMessageBox.prompt('请输入实际产量', '完成生产', {
      inputPattern: /^\d+$/,
      inputErrorMessage: '请输入有效数量'
    });
    const response = await post(`/${factoryId.value}/production-plans/${row.id}/complete`, {
      actualQuantity: parseInt(value)
    });
    if (response.success) {
      ElMessage.success('生产已完成');
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
    const { value } = await ElMessageBox.prompt('请输入取消原因', '取消计划', {
      inputPattern: /.+/,
      inputErrorMessage: '请输入取消原因'
    });
    const response = await post(`/${factoryId.value}/production-plans/${row.id}/cancel`, {
      reason: value
    });
    if (response.success) {
      ElMessage.success('计划已取消');
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
    PLANNED: 'info',
    IN_PROGRESS: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'danger'
  };
  return map[status] || 'info';
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PLANNED: '待执行',
    IN_PROGRESS: '进行中',
    COMPLETED: '已完成',
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
            <span class="page-title">生产计划管理</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleCreate">
              新建计划
            </el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索计划编号/产品名称"
          :prefix-icon="Search"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 150px">
          <el-option label="待执行" value="PLANNED" />
          <el-option label="进行中" value="IN_PROGRESS" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="已取消" value="CANCELLED" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%">
        <el-table-column prop="planNumber" label="计划编号" width="160" />
        <el-table-column prop="productTypeName" label="产品类型" min-width="150" show-overflow-tooltip />
        <el-table-column prop="plannedQuantity" label="计划数量" width="100" align="right" />
        <el-table-column prop="actualQuantity" label="实际数量" width="100" align="right" />
        <el-table-column prop="plannedDate" label="计划日期" width="120" />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="240" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small">查看</el-button>
            <el-button
              v-if="canWrite && row.status === 'PLANNED'"
              type="success"
              link
              size="small"
              :icon="VideoPlay"
              @click="handleStart(row)"
            >开始</el-button>
            <el-button
              v-if="canWrite && row.status === 'IN_PROGRESS'"
              type="primary"
              link
              size="small"
              :icon="CircleCheck"
              @click="handleComplete(row)"
            >完成</el-button>
            <el-button
              v-if="canWrite && (row.status === 'PLANNED' || row.status === 'IN_PROGRESS')"
              type="danger"
              link
              size="small"
              :icon="CircleClose"
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

    <!-- 新建计划对话框 -->
    <el-dialog v-model="dialogVisible" title="新建生产计划" width="500px">
      <el-form :model="planForm" label-width="100px">
        <el-form-item label="产品类型" required>
          <el-select v-model="planForm.productTypeId" placeholder="选择产品类型" style="width: 100%">
            <el-option
              v-for="item in productTypes"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="计划数量" required>
          <el-input-number v-model="planForm.plannedQuantity" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="计划日期" required>
          <el-date-picker
            v-model="planForm.plannedDate"
            type="date"
            placeholder="选择日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="planForm.notes" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogLoading" @click="submitPlan">确定</el-button>
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
