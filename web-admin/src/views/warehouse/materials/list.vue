<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, put } from '@/api/request';
import { ElMessage } from 'element-plus';
import { Plus, Search, Refresh } from '@element-plus/icons-vue';
import { formatDateTimeCell } from '@/utils/tableFormatters';
import type { FormInstance } from 'element-plus';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('warehouse'));

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
    } else if (response.success === false) {
      ElMessage.error(response.message || '加载原材料批次失败');
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
    AVAILABLE: 'success',
    RESERVED: 'warning',
    DEPLETED: 'info',
    EXPIRED: 'danger'
  };
  return map[status?.toUpperCase()] || 'info';
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    AVAILABLE: '可用',
    RESERVED: '已预留',
    DEPLETED: '已耗尽',
    EXPIRED: '已过期'
  };
  return map[status?.toUpperCase()] || status;
}

// ==================== View Dialog ====================
const viewDialogVisible = ref(false);
const viewRecord = ref<Record<string, unknown> | null>(null);

function handleView(row: Record<string, unknown>) {
  viewRecord.value = row;
  viewDialogVisible.value = true;
}

// ==================== Create / Edit Dialog ====================
const formDialogVisible = ref(false);
const formDialogTitle = ref('入库登记');
const formRef = ref<FormInstance>();
const formSaving = ref(false);
const editingId = ref<string | null>(null);

const formData = reactive({
  batchNumber: '',
  materialName: '',
  supplierName: '',
  quantity: null as number | null,
  unit: 'kg',
  expiryDate: '',
  notes: '',
});

const formRules = {
  batchNumber: [{ required: true, message: '请输入批次号', trigger: 'blur' }],
  materialName: [{ required: true, message: '请输入原料名称', trigger: 'blur' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
};

function handleCreate() {
  editingId.value = null;
  formDialogTitle.value = '入库登记';
  Object.assign(formData, { batchNumber: '', materialName: '', supplierName: '', quantity: null, unit: 'kg', expiryDate: '', notes: '' });
  formDialogVisible.value = true;
}

function handleEdit(row: Record<string, unknown>) {
  editingId.value = String(row.id || '');
  formDialogTitle.value = '编辑批次';
  Object.assign(formData, {
    batchNumber: row.batchNumber || '',
    materialName: row.materialTypeName || row.materialName || '',
    supplierName: row.supplierName || '',
    quantity: row.quantity ?? row.currentQuantity ?? null,
    unit: row.unit || 'kg',
    expiryDate: row.expiryDate || '',
    notes: row.notes || '',
  });
  formDialogVisible.value = true;
}

async function handleFormSubmit() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  formSaving.value = true;
  try {
    const payload = { ...formData, factoryId: factoryId.value };
    let response;
    if (editingId.value) {
      response = await put(`/${factoryId.value}/material-batches/${editingId.value}`, payload);
    } else {
      response = await post(`/${factoryId.value}/material-batches`, payload);
    }
    if (response.success) {
      ElMessage.success(editingId.value ? '更新成功' : '入库登记成功');
      formDialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(response.message || '操作失败');
    }
  } catch (error) {
    console.error('保存失败:', error);
    ElMessage.error('保存失败，请重试');
  } finally {
    formSaving.value = false;
  }
}
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">原材料批次管理</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleCreate">入库登记</el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索批次号/原料名称"
          :prefix-icon="Search"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" empty-text="暂无数据" stripe border style="width: 100%">
        <el-table-column prop="batchNumber" label="批次号" width="160" />
        <el-table-column label="原料类型" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.materialTypeName || row.materialName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="supplierName" label="供应商" min-width="150" show-overflow-tooltip />
        <el-table-column label="数量" width="100" align="right">
          <template #default="{ row }">{{ row.quantity ?? row.currentQuantity ?? row.receiptQuantity ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="unit" label="单位" width="80" align="center" />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="expiryDate" label="过期日期" width="120" />
        <el-table-column prop="createdAt" label="入库时间" width="180" :formatter="formatDateTimeCell" />
        <el-table-column label="操作" width="120" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">查看</el-button>
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

    <!-- View Dialog -->
    <el-dialog v-model="viewDialogVisible" title="批次详情" width="500px" destroy-on-close>
      <el-descriptions v-if="viewRecord" :column="1" border>
        <el-descriptions-item label="批次号">{{ viewRecord.batchNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="原料类型">{{ viewRecord.materialTypeName || viewRecord.materialName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="供应商">{{ viewRecord.supplierName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="数量">{{ viewRecord.quantity ?? viewRecord.currentQuantity ?? '-' }} {{ viewRecord.unit || '' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(String(viewRecord.status || ''))">{{ getStatusText(String(viewRecord.status || '')) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="过期日期">{{ viewRecord.expiryDate || '-' }}</el-descriptions-item>
        <el-descriptions-item label="入库时间">{{ viewRecord.createdAt || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ viewRecord.notes || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <!-- Create / Edit Dialog -->
    <el-dialog v-model="formDialogVisible" :title="formDialogTitle" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="80px">
        <el-form-item label="批次号" prop="batchNumber">
          <el-input v-model="formData.batchNumber" placeholder="如 MB-2026-001" :disabled="!!editingId" />
        </el-form-item>
        <el-form-item label="原料名称" prop="materialName">
          <el-input v-model="formData.materialName" placeholder="如 带鱼、虾仁" />
        </el-form-item>
        <el-form-item label="供应商">
          <el-input v-model="formData.supplierName" placeholder="供应商名称" />
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
          <el-input-number v-model="formData.quantity" :min="0" :precision="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="单位">
          <el-select v-model="formData.unit" style="width: 100%">
            <el-option label="kg" value="kg" />
            <el-option label="g" value="g" />
            <el-option label="L" value="L" />
            <el-option label="个" value="个" />
            <el-option label="箱" value="箱" />
          </el-select>
        </el-form-item>
        <el-form-item label="过期日期">
          <el-date-picker v-model="formData.expiryDate" type="date" value-format="YYYY-MM-DD" placeholder="选择过期日期" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="formData.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="formSaving" @click="handleFormSubmit">确定</el-button>
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
