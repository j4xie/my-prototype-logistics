<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, put, del } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Refresh } from '@element-plus/icons-vue';
import type { FormInstance } from 'element-plus';
import DynamicEntityForm from '@/components/DynamicEntityForm.vue';
import type { FieldConfig } from '@/config/entityFieldConfigs';

// 客户扩展字段 — 添加新字段只需在此数组加一行
const customerExtendedFields: FieldConfig[] = [
  { key: 'taxNumber', label: '纳税人识别号', type: 'text', group: '开票信息', order: 1 },
  { key: 'billingAddress', label: '开票地址', type: 'text', group: '开票信息', order: 2 },
  { key: 'bankName', label: '开户行', type: 'text', group: '开票信息', order: 3 },
  { key: 'bankAccount', label: '银行账号', type: 'text', group: '开票信息', order: 4 },
  { key: 'creditLimit', label: '信用额度', type: 'decimal', group: '信用管理', precision: 2, suffix: '元', order: 5 },
  { key: 'paymentTerms', label: '结算模式', type: 'text', group: '信用管理', order: 6, placeholder: '如 月结30天' },
];

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('sales'));

const loading = ref(false);
const tableData = ref<Record<string, unknown>[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const searchKeyword = ref('');

onMounted(() => {
  loadData();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/customers`, {
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

// Dialog state
const dialogVisible = ref(false);
const dialogMode = ref<'add' | 'edit' | 'view'>('add');
const formRef = ref<FormInstance>();
const submitting = ref(false);

const defaultForm = {
  id: '',
  name: '',
  contactPerson: '',
  phone: '',
  shippingAddress: '',
  email: '',
  type: '',
  industry: '',
  notes: '',
  status: 'ACTIVE',  // T10: status field default
  version: null as number | null,  // optimistic lock — echoed on PUT, server returns 409 on mismatch
};
const formData = reactive({ ...defaultForm });

const formRules = {
  // T10 / spec P2.1: only customer name remains required; contact info optional per docx feedback
  name: [{ required: true, message: '请输入客户名称', trigger: 'blur' }],
  phone: [
    // Format check kept; required removed per docx P2.1
    { pattern: /^1[3-9]\d{9}$|^0\d{2,3}-?\d{7,8}$/, message: '请输入正确的手机号或座机号', trigger: 'blur' },
  ],
};

const dialogTitle = computed(() => {
  if (dialogMode.value === 'add') return '新增客户';
  if (dialogMode.value === 'edit') return '编辑客户';
  return '查看客户';
});

const isViewMode = computed(() => dialogMode.value === 'view');

function handleAdd() {
  dialogMode.value = 'add';
  Object.assign(formData, defaultForm);
  dialogVisible.value = true;
}

function handleView(row: Record<string, unknown>) {
  dialogMode.value = 'view';
  Object.assign(formData, {
    id: row.id,
    name: row.name || '',
    contactPerson: row.contactPerson || '',
    phone: row.phone || '',
    shippingAddress: row.shippingAddress || row.address || '',
    email: row.email || '',
    type: row.type || '',
    industry: row.industry || '',
    notes: row.notes || '',
    status: (row.status as string) || 'ACTIVE',  // T10
  });
  dialogVisible.value = true;
}

function handleEdit(row: Record<string, unknown>) {
  dialogMode.value = 'edit';
  Object.assign(formData, {
    id: row.id,
    name: row.name || '',
    contactPerson: row.contactPerson || '',
    phone: row.phone || '',
    version: typeof row.version === 'number' ? row.version : null,
    shippingAddress: row.shippingAddress || row.address || '',
    email: row.email || '',
    type: row.type || '',
    industry: row.industry || '',
    notes: row.notes || '',
    status: (row.status as string) || 'ACTIVE',  // T10
  });
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate();
  submitting.value = true;
  try {
    const payload: Record<string, unknown> = {
      name: formData.name,
      contactPerson: formData.contactPerson,
      phone: formData.phone,
      shippingAddress: formData.shippingAddress,
      email: formData.email || undefined,
      type: formData.type || undefined,
      industry: formData.industry || undefined,
      notes: formData.notes || undefined,
      status: formData.status,  // T10: P2.2 状态可编辑
      // 扩展字段自动收集
      ...Object.fromEntries(
        customerExtendedFields.map(f => [f.key, (formData as Record<string, unknown>)[f.key] ?? null])
      ),
    };
    let res;
    if (dialogMode.value === 'add') {
      res = await post(`/${factoryId.value}/customers`, payload);
    } else {
      // Optimistic lock: include version snapshot so BE can detect concurrent edit.
      if (formData.version !== null && formData.version !== undefined) {
        payload.version = formData.version;
      }
      res = await put(`/${factoryId.value}/customers/${formData.id}`, payload);
    }
    if (res.success) {
      ElMessage.success(dialogMode.value === 'add' ? '新增成功' : '编辑成功');
      dialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(res.message || '操作失败');
    }
  } catch (error) {
    // 409 = optimistic lock conflict; interceptor already toasts. Offer explicit refresh flow.
    const status = (error as { status?: number })?.status;
    if (status === 409) {
      try {
        await ElMessageBox.confirm(
          '此客户数据已被其他用户修改。点击"确定"将刷新列表并放弃当前编辑。',
          '并发编辑冲突',
          { type: 'warning', confirmButtonText: '刷新列表', cancelButtonText: '取消' }
        );
        dialogVisible.value = false;
        loadData();
      } catch {
        // user cancelled — keep dialog open so they can copy their changes elsewhere
      }
    }
    // Interceptor (request.ts) already shows specific sticky toast for ApiError.
    // Firing a fallback here creates double-toast ("操作失败" BEFORE "客户名称已存在").
    console.error('提交失败:', error);
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(row: Record<string, unknown>) {
  try {
    await ElMessageBox.confirm(`确定删除客户「${row.name}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    });
    const res = await del(`/${factoryId.value}/customers/${row.id}`);
    if (res.success) {
      ElMessage.success('删除成功');
      loadData();
    } else {
      ElMessage.error(res.message || '删除失败');
    }
  } catch (e) {
    // Interceptor already shows specific sticky toast for ApiError.
    if (e !== 'cancel') console.error('Delete customer failed:', e);
  }
}
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">客户管理</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleAdd">新增客户</el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索客户名称/编号"
          :prefix-icon="Search"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" empty-text="暂无数据" stripe border style="width: 100%">
        <el-table-column prop="customerCode" label="客户编号" width="140" />
        <el-table-column prop="name" label="客户名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="contactPerson" label="联系人" width="120" />
        <el-table-column prop="phone" label="联系电话" width="140" />
        <el-table-column label="收货地址" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.shippingAddress || '-' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="(row.status === 'ACTIVE' || row.isActive === true) ? 'success' : 'info'" size="small">
              {{ (row.status === 'ACTIVE' || row.isActive === true) ? '合作中' : '已停用' }}
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="80px" :disabled="isViewMode">
        <el-form-item label="客户名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入客户名称" />
        </el-form-item>
        <el-form-item label="联系人" prop="contactPerson">
          <el-input v-model="formData.contactPerson" placeholder="请输入联系人" />
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="formData.phone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="formData.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="收货地址" prop="shippingAddress">
          <el-input v-model="formData.shippingAddress" placeholder="请输入收货地址" type="textarea" :rows="2" />
        </el-form-item>
        <!-- T10 P2.2: status field editable in form (was view-only via list column badge) -->
        <el-form-item label="状态" prop="status">
          <el-select v-model="formData.status" :disabled="isViewMode" style="width: 100%">
            <el-option label="合作中" value="ACTIVE" />
            <el-option label="已停用" value="INACTIVE" />
          </el-select>
        </el-form-item>
        <el-form-item label="客户类型" prop="type">
          <el-select v-model="formData.type" placeholder="请选择客户类型" clearable style="width: 100%">
            <el-option label="经销商" value="DEALER" />
            <el-option label="零售商" value="RETAILER" />
            <el-option label="餐饮企业" value="RESTAURANT" />
            <el-option label="企业客户" value="ENTERPRISE" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属行业" prop="industry">
          <el-input v-model="formData.industry" placeholder="请输入所属行业" />
        </el-form-item>
        <el-form-item label="备注" prop="notes">
          <el-input v-model="formData.notes" placeholder="请输入备注" type="textarea" :rows="2" />
        </el-form-item>

        <!-- 扩展字段 (动态渲染) -->
        <el-divider content-position="left">扩展信息</el-divider>
        <DynamicEntityForm
          :fields="customerExtendedFields"
          :model-value="formData as Record<string, unknown>"
          @update:model-value="Object.assign(formData, $event)"
          :readonly="isViewMode"
          :columns="2"
          label-width="110px"
        />
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ isViewMode ? '关闭' : '取消' }}</el-button>
        <el-button v-if="!isViewMode" type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
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
