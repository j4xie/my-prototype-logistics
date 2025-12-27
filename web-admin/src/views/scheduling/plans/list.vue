<script setup lang="ts">
/**
 * 调度计划列表
 * 支持搜索、筛选、创建、查看详情
 */
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import {
  getSchedulingPlans,
  confirmSchedulingPlan,
  cancelSchedulingPlan,
  SchedulingPlan
} from '@/api/scheduling';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Refresh, Calendar, View, Check, Close } from '@element-plus/icons-vue';

const router = useRouter();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('production'));

const loading = ref(false);
const tableData = ref<SchedulingPlan[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const searchForm = ref({
  status: '',
  startDate: '',
  endDate: ''
});

onMounted(() => {
  loadData();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await getSchedulingPlans(factoryId.value, {
      page: pagination.value.page - 1,
      size: pagination.value.size,
      status: searchForm.value.status || undefined,
      startDate: searchForm.value.startDate || undefined,
      endDate: searchForm.value.endDate || undefined
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

function handleSearch() {
  pagination.value.page = 1;
  loadData();
}

function handleReset() {
  searchForm.value = { status: '', startDate: '', endDate: '' };
  handleSearch();
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
  router.push('/scheduling/plans/create');
}

function handleView(row: SchedulingPlan) {
  router.push(`/scheduling/plans/${row.id}`);
}

async function handleConfirm(row: SchedulingPlan) {
  try {
    await ElMessageBox.confirm(
      `确认要确认调度计划 "${row.planDate}" 吗？确认后计划将进入执行阶段。`,
      '确认计划',
      { type: 'warning' }
    );

    loading.value = true;
    const response = await confirmSchedulingPlan(factoryId.value!, row.id);
    if (response.success) {
      ElMessage.success('计划已确认');
      loadData();
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('确认失败:', error);
      ElMessage.error('确认失败');
    }
  } finally {
    loading.value = false;
  }
}

async function handleCancel(row: SchedulingPlan) {
  try {
    const { value: reason } = await ElMessageBox.prompt(
      '请输入取消原因',
      '取消计划',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /.+/,
        inputErrorMessage: '请输入取消原因'
      }
    );

    loading.value = true;
    const response = await cancelSchedulingPlan(factoryId.value!, row.id, reason);
    if (response.success) {
      ElMessage.success('计划已取消');
      loadData();
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('取消失败:', error);
      ElMessage.error('取消失败');
    }
  } finally {
    loading.value = false;
  }
}

function getStatusType(status: string) {
  const map: Record<string, string> = {
    draft: 'info',
    confirmed: 'primary',
    in_progress: 'warning',
    completed: 'success',
    cancelled: 'danger'
  };
  return map[status] || 'info';
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    draft: '草稿',
    confirmed: '已确认',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消'
  };
  return map[status] || status;
}

function formatProbability(prob: number) {
  if (prob === null || prob === undefined) return '-';
  return (prob * 100).toFixed(0) + '%';
}

function getProbabilityClass(prob: number) {
  if (prob >= 0.9) return 'prob-high';
  if (prob >= 0.7) return 'prob-medium';
  if (prob >= 0.5) return 'prob-low';
  return 'prob-critical';
}
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">调度计划列表</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleCreate">
              创建计划
            </el-button>
          </div>
        </div>
      </template>

      <!-- 搜索区域 -->
      <div class="search-bar">
        <el-date-picker
          v-model="searchForm.startDate"
          type="date"
          placeholder="开始日期"
          value-format="YYYY-MM-DD"
          style="width: 150px"
        />
        <el-date-picker
          v-model="searchForm.endDate"
          type="date"
          placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 150px"
        />
        <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 120px">
          <el-option label="草稿" value="draft" />
          <el-option label="已确认" value="confirmed" />
          <el-option label="进行中" value="in_progress" />
          <el-option label="已完成" value="completed" />
          <el-option label="已取消" value="cancelled" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <!-- 数据表格 -->
      <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%">
        <el-table-column prop="planDate" label="计划日期" width="120" align="center">
          <template #default="{ row }">
            <div class="date-cell">
              <el-icon><Calendar /></el-icon>
              <span>{{ row.planDate }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalBatches" label="批次数" width="80" align="center" />
        <el-table-column prop="totalWorkers" label="工人数" width="80" align="center" />
        <el-table-column prop="averageCompletionProbability" label="平均完成概率" width="130" align="center">
          <template #default="{ row }">
            <span :class="getProbabilityClass(row.averageCompletionProbability)">
              {{ formatProbability(row.averageCompletionProbability) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="lineSchedules" label="排程数" width="80" align="center">
          <template #default="{ row }">
            {{ row.lineSchedules?.length || 0 }}
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="160" />
        <el-table-column prop="confirmedAt" label="确认时间" width="160">
          <template #default="{ row }">
            {{ row.confirmedAt || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" :icon="View" @click="handleView(row)">
              查看
            </el-button>
            <template v-if="canWrite">
              <el-button
                v-if="row.status === 'draft'"
                type="success"
                link
                size="small"
                :icon="Check"
                @click="handleConfirm(row)"
              >
                确认
              </el-button>
              <el-button
                v-if="row.status === 'draft' || row.status === 'confirmed'"
                type="danger"
                link
                size="small"
                :icon="Close"
                @click="handleCancel(row)"
              >
                取消
              </el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
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

.date-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.prob-high {
  color: #67C23A;
  font-weight: 600;
}

.prob-medium {
  color: #E6A23C;
  font-weight: 600;
}

.prob-low {
  color: #F56C6C;
  font-weight: 600;
}

.prob-critical {
  color: #909399;
  font-weight: 600;
}
</style>
