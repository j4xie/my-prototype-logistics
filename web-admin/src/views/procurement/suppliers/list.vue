<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, put, del } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Refresh } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('procurement'));

const loading = ref(false);
const tableData = ref<Record<string, unknown>[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const searchKeyword = ref('');

// Dialog state
const dialogVisible = ref(false);
const dialogMode = ref<'view' | 'create' | 'edit'>('view');
const dialogTitle = computed(() => {
  if (dialogMode.value === 'create') return '新增供应商';
  if (dialogMode.value === 'edit') return '编辑供应商';
  return '查看供应商';
});
const submitting = ref(false);
const formRef = ref();

const defaultForm = {
  id: '',
  name: '',
  contactPerson: '',
  phone: '',
  address: '',
  email: '',
  bankAccount: '',
  taxId: '',
  notes: '',
};
const form = reactive({ ...defaultForm });

const formRules = {
  name: [{ required: true, message: '请输入供应商名称', trigger: 'blur' }],
  contactPerson: [{ required: true, message: '请输入联系人', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入联系电话', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' },
  ],
  address: [{ required: true, message: '请输入地址', trigger: 'blur' }],
};

onMounted(() => {
  loadData();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/suppliers`, {
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

function isActive(row: Record<string, unknown>) {
  return row.status === 'ACTIVE' || row.isActive === true;
}

function getStatusType(row: Record<string, unknown>) {
  return isActive(row) ? 'success' : 'info';
}

function getStatusText(row: Record<string, unknown>) {
  return isActive(row) ? '合作中' : '已停用';
}

function resetForm() {
  Object.assign(form, defaultForm);
}

function handleCreate() {
  resetForm();
  dialogMode.value = 'create';
  dialogVisible.value = true;
}

function handleView(row: Record<string, unknown>) {
  Object.assign(form, {
    id: row.id || '',
    name: row.name || '',
    contactPerson: row.contactPerson || '',
    phone: row.phone || row.contactPhone || '',
    address: row.address || '',
    email: row.email || '',
    bankAccount: row.bankAccount || '',
    taxId: row.taxId || '',
    notes: row.notes || '',
  });
  dialogMode.value = 'view';
  dialogVisible.value = true;
}

function handleEdit(row: Record<string, unknown>) {
  Object.assign(form, {
    id: row.id || '',
    name: row.name || '',
    contactPerson: row.contactPerson || '',
    phone: row.phone || row.contactPhone || '',
    address: row.address || '',
    email: row.email || '',
    bankAccount: row.bankAccount || '',
    taxId: row.taxId || '',
    notes: row.notes || '',
  });
  dialogMode.value = 'edit';
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate();

  submitting.value = true;
  try {
    const payload = {
      name: form.name,
      contactPerson: form.contactPerson,
      phone: form.phone,
      address: form.address,
      email: form.email,
      bankAccount: form.bankAccount,
      taxNumber: form.taxId,
      notes: form.notes,
    };

    let res;
    if (dialogMode.value === 'create') {
      res = await post(`/${factoryId.value}/suppliers`, payload);
    } else {
      res = await put(`/${factoryId.value}/suppliers/${form.id}`, payload);
    }

    if (res && res.success === false) {
      ElMessage.error(res.message || '操作失败');
      return;
    }
    ElMessage.success(dialogMode.value === 'create' ? '新增成功' : '编辑成功');
    dialogVisible.value = false;
    loadData();
  } catch (error) {
    console.error('Submit failed:', error);
    ElMessage.error('操作失败');
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(row: Record<string, unknown>) {
  try {
    await ElMessageBox.confirm(`确定删除供应商「${row.name}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    });
    const delRes = await del(`/${factoryId.value}/suppliers/${row.id}`);
    if (delRes && delRes.success === false) {
      ElMessage.error(delRes.message || '删除失败');
      return;
    }
    ElMessage.success('删除成功');
    loadData();
  } catch (e) {
    if (e !== 'cancel') {
      console.error('Delete supplier failed:', e);
      ElMessage.error('删除失败');
    }
  }
}
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <!-- 页面标题和操作 -->
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">供应商管理</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleCreate">
              新增供应商
            </el-button>
          </div>
        </div>
      </template>

      <!-- 搜索区域 -->
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索供应商名称/编号"
          :prefix-icon="Search"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" :icon="Search" @click="handleSearch">
          搜索
        </el-button>
        <el-button :icon="Refresh" @click="handleRefresh">
          重置
        </el-button>
      </div>

      <!-- 数据表格 -->
      <el-table
        :data="tableData"
        v-loading="loading"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column prop="supplierCode" label="供应商编号" width="140" />
        <el-table-column prop="name" label="供应商名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="contactPerson" label="联系人" width="120" />
        <el-table-column label="联系电话" width="140">
          <template #default="{ row }">{{ row.phone || row.contactPhone || '-' }}</template>
        </el-table-column>
        <el-table-column prop="address" label="地址" min-width="200" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row)" size="small">
              {{ getStatusText(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleView(row)">查看</el-button>
            <el-button v-if="canWrite" type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button v-if="canWrite" type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
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

    <!-- 新增/编辑/查看 Dialog -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" destroy-on-close>
      <el-form
        ref="formRef"
        :model="form"
        :rules="dialogMode !== 'view' ? formRules : undefined"
        :disabled="dialogMode === 'view'"
        label-width="100px"
      >
        <el-form-item label="供应商名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入供应商名称" />
        </el-form-item>
        <el-form-item label="联系人" prop="contactPerson">
          <el-input v-model="form.contactPerson" placeholder="请输入联系人" />
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="地址" prop="address">
          <el-input v-model="form.address" placeholder="请输入地址" />
        </el-form-item>
        <el-form-item label="银行账户">
          <el-input v-model="form.bankAccount" placeholder="请输入银行账户" />
        </el-form-item>
        <el-form-item label="税号">
          <el-input v-model="form.taxId" placeholder="请输入税号" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.notes" type="textarea" :rows="3" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ dialogMode === 'view' ? '关闭' : '取消' }}</el-button>
        <el-button
          v-if="dialogMode !== 'view'"
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          确定
        </el-button>
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
</style>
