<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post } from '@/api/request';
import { ElMessage } from 'element-plus';
import { Plus, Search, Refresh } from '@element-plus/icons-vue';
import { formatDateTimeCell } from '@/utils/tableFormatters';
import ConceptDisambiguationAlert from '@/components/common/ConceptDisambiguationAlert.vue';
import type { TableRow } from '@/types/api';
import { RowActionMenu } from '@/components/list';
import { computeRowActions } from '@/composables/useRowActions';
import { safePrint } from '@/api/printApi';

const router = useRouter();

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('production'));
const canViewPrice = computed(() => permissionStore.canViewPrice);

function rowActionsFor(row: TableRow) {
  return computeRowActions(
    'processTask',
    { status: String(row.status || 'IN_PROGRESS'), id: String(row.id || '') },
    { canViewPrice: canViewPrice.value }
  );
}
function handleRowActionClick(actionId: string, row: TableRow) {
  switch (actionId) {
    case 'view-detail': router.push(`/production/batches/${row.id}`); break;
    case 'edit': router.push(`/production/batches/${row.id}`); break;
    case 'print-pdf': void safePrint('production-task', factoryId.value, String(row.id), { fileName: `生产批次_${row.batchNumber || row.id}` }); break;
    default: ElMessage.info(`Action: ${actionId}`);
  }
}
function openAiForRow(row: TableRow) {
  ElMessage.info(`AIChat: processTask/${row.batchNumber || row.id} — 接 AiEntryDrawer 待 Day 9`);
}

const loading = ref(false);
const tableData = ref<TableRow[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const searchForm = ref({
  batchNumber: '',
  status: ''
});

// 创建批次
const createDialogVisible = ref(false);
const creating = ref(false);
const productTypes = ref<TableRow[]>([]);
const createForm = ref({
  batchNumber: '',
  productTypeId: '',
  plannedQuantity: null as number | null,
  unit: 'kg',
  notes: ''
});

onMounted(() => {
  loadData();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/processing/batches`, {
      params: {
        page: pagination.value.page,
        size: pagination.value.size,
        ...searchForm.value
      }
    });
    if (response.success && response.data) {
      tableData.value = response.data.content || [];
      pagination.value.total = response.data.totalElements || 0;
    } else if (response.success === false) {
      ElMessage.error(response.message || '加载数据失败');
    }
  } catch (error: any) {
    // Interceptor already shows specific sticky toast for ApiError.
    console.error('加载失败:', error);
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.value.page = 1;
  loadData();
}

function handleReset() {
  searchForm.value = { batchNumber: '', status: '' };
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

function generateBatchNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `PB-${y}${m}${d}-${rand}`;
}

async function handleCreate() {
  createForm.value = { batchNumber: generateBatchNumber(), productTypeId: '', plannedQuantity: null, unit: 'kg', notes: '' };
  createDialogVisible.value = true;
  // Load product types for dropdown
  if (productTypes.value.length === 0 && factoryId.value) {
    try {
      const res = await get(`/${factoryId.value}/product-types/active`);
      if (res.success) {
        productTypes.value = res.data || [];
      }
    } catch (e: unknown) {
      console.error('加载产品类型失败:', e);
      const err = e as { actionHint?: unknown };
      if (!err?.actionHint) ElMessage.error('加载产品类型失败');
    }
  }
}

async function submitCreate() {
  if (!factoryId.value) return;
  if (!createForm.value.batchNumber) {
    ElMessage.warning('请输入批次号');
    return;
  }
  if (!createForm.value.productTypeId) {
    ElMessage.warning('请选择产品类型');
    return;
  }
  if (!createForm.value.plannedQuantity || createForm.value.plannedQuantity <= 0) {
    ElMessage.warning('请输入有效的计划数量');
    return;
  }

  const selectedProduct = productTypes.value.find((p) => p.id === createForm.value.productTypeId);
  creating.value = true;
  try {
    const response = await post(`/${factoryId.value}/processing/batches`, {
      batchNumber: createForm.value.batchNumber,
      productTypeId: createForm.value.productTypeId,
      productName: selectedProduct?.name || selectedProduct?.productName || '',
      plannedQuantity: createForm.value.plannedQuantity,
      quantity: createForm.value.plannedQuantity,
      unit: createForm.value.unit,
      notes: createForm.value.notes
    });
    if (response.success) {
      ElMessage.success('批次创建成功');
      createDialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(response.message || '创建失败');
    }
  } catch (error: unknown) {
    const e = error as { actionHint?: unknown; response?: { data?: { message?: string } } };
    if (!e?.actionHint) ElMessage.error(e?.response?.data?.message || '创建失败');
  } finally {
    creating.value = false;
  }
}

function getStatusType(status: string) {
  const map: Record<string, string> = {
    PLANNED: 'info',
    PENDING: 'info',
    IN_PROGRESS: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'danger'
  };
  return map[status?.toUpperCase()] || 'info';
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    PLANNED: '待生产',
    PENDING: '待生产',
    IN_PROGRESS: '生产中',
    COMPLETED: '已完成',
    CANCELLED: '已取消'
  };
  return map[status?.toUpperCase()] || status;
}
</script>

<template>
  <div class="page-wrapper">
    <ConceptDisambiguationAlert
      here-name="生产批次"
      here="已开工的实际「批次」（IN_PROGRESS / COMPLETED，记录实际产量、消耗、报工）"
      other-name="生产管理 → 生产计划"
      other="未来要做什么的「计划」（PENDING / 待开工状态，可调整数量、日期）"
      other-path="/production/plans"
    />
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">生产批次列表</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleCreate">
              创建批次
            </el-button>
          </div>
        </div>
      </template>

      <!-- 搜索区域 -->
      <div class="search-bar">
        <el-input
          v-model="searchForm.batchNumber"
          placeholder="批次号"
          clearable
          style="width: 200px"
          @keyup.enter="handleSearch"
        />
        <el-select v-model="searchForm.status" placeholder="全部状态" clearable style="width: 150px">
          <el-option label="待生产" value="PENDING" />
          <el-option label="生产中" value="IN_PROGRESS" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="已取消" value="CANCELLED" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <!-- 数据表格 -->
      <el-table :data="tableData" v-loading="loading" empty-text="暂无数据" stripe border style="width: 100%">
        <el-table-column prop="batchNumber" label="批次号" width="160" />
        <el-table-column label="产品类型" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.productTypeName || row.productName || row.productTypeId || '-' }}</template>
        </el-table-column>
        <el-table-column prop="plannedQuantity" label="计划数量" width="100" align="right" />
        <el-table-column prop="actualQuantity" label="实际数量" width="100" align="right" />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="supervisorName" label="负责人" width="100" />
        <el-table-column prop="createdAt" label="创建时间" width="180" :formatter="formatDateTimeCell" />
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="router.push(`/production/batches/${row.id}`)">查看</el-button>
            <el-button v-if="canWrite" type="primary" link size="small" @click="router.push(`/production/batches/${row.id}`)">编辑</el-button>
            <RowActionMenu
              :actions="rowActionsFor(row)"
              button-label="更多"
              @action-click="(id: string) => handleRowActionClick(id, row)"
              @ai-trigger="() => openAiForRow(row)"
            />
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

    <!-- 创建批次对话框 -->
    <el-dialog v-model="createDialogVisible" title="创建生产批次" width="500px" :close-on-click-modal="false" destroy-on-close>
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="批次号" required>
          <el-input v-model="createForm.batchNumber" placeholder="自动生成，可手动修改" />
        </el-form-item>
        <el-form-item label="产品类型" required>
          <el-select v-model="createForm.productTypeId" placeholder="请选择产品类型" filterable style="width: 100%">
            <el-option
              v-for="pt in productTypes"
              :key="pt.id"
              :label="pt.name || pt.productName"
              :value="pt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="计划数量" required>
          <el-input-number v-model="createForm.plannedQuantity" :min="1" :precision="2" style="width: 200px" />
          <el-select v-model="createForm.unit" style="width: 80px; margin-left: 8px">
            <el-option label="kg" value="kg" />
            <el-option label="箱" value="箱" />
            <el-option label="件" value="件" />
            <el-option label="吨" value="吨" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="createForm.notes" type="textarea" :rows="3" placeholder="可选备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">创建</el-button>
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
