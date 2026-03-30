<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, put } from '@/api/request';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import type { FormInstance } from 'element-plus';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('hr'));

const loading = ref(false);
const tableData = ref<Record<string, unknown>[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });

onMounted(() => {
  loadData();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/users`, {
      params: { page: pagination.value.page, size: pagination.value.size }
    });
    if (response.success && response.data) {
      tableData.value = response.data.content || [];
      pagination.value.total = response.data.totalElements || 0;
    } else if (response.success === false) {
      ElMessage.error(response.message || '加载员工数据失败');
    }
  } catch (error) {
    console.error('加载失败:', error);
    ElMessage.error('加载数据失败');
  } finally {
    loading.value = false;
  }
}

function handlePageChange(page: number) {
  pagination.value.page = page;
  loadData();
}

// Dialog state
const dialogVisible = ref(false);
const dialogMode = ref<'add' | 'edit' | 'view'>('add');
const formRef = ref<FormInstance>();
const submitting = ref(false);

const defaultForm = {
  id: '',
  fullName: '',
  username: '',
  phone: '',
  role: '',
  employeeCode: '',
  department: '',
  isActive: true,
};
const formData = reactive({ ...defaultForm });

const roleOptions = [
  { value: 'factory_super_admin', label: '工厂总监' },
  { value: 'hr_admin', label: 'HR管理员' },
  { value: 'procurement_manager', label: '采购主管' },
  { value: 'sales_manager', label: '销售主管' },
  { value: 'dispatcher', label: '调度' },
  { value: 'warehouse_manager', label: '仓储主管' },
  { value: 'equipment_admin', label: '设备管理员' },
  { value: 'quality_manager', label: '质量经理' },
  { value: 'finance_manager', label: '财务主管' },
  { value: 'workshop_supervisor', label: '车间主任' },
  { value: 'quality_inspector', label: '质检员' },
  { value: 'operator', label: '操作员' },
  { value: 'warehouse_worker', label: '仓库员' },
];

const formRules = {
  fullName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
};

const dialogTitle = computed(() => {
  if (dialogMode.value === 'add') return '添加员工';
  if (dialogMode.value === 'edit') return '编辑员工';
  return '查看员工';
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
    fullName: row.fullName || '',
    username: row.username || '',
    phone: row.phone || '',
    role: row.roleCode || row.role || '',
    employeeCode: row.employeeCode || '',
    department: row.departmentName || row.department || '',
    isActive: row.isActive === true || row.status === 'ACTIVE',
  });
  dialogVisible.value = true;
}

function handleEdit(row: Record<string, unknown>) {
  dialogMode.value = 'edit';
  Object.assign(formData, {
    id: row.id,
    fullName: row.fullName || '',
    username: row.username || '',
    phone: row.phone || '',
    role: row.roleCode || row.role || '',
    employeeCode: row.employeeCode || '',
    department: row.departmentName || row.department || '',
    isActive: row.isActive === true || row.status === 'ACTIVE',
  });
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate();
  submitting.value = true;
  try {
    const payload: Record<string, any> = {
      fullName: formData.fullName,
      username: formData.username,
      phone: formData.phone,
      roleCode: formData.role,
      employeeCode: formData.employeeCode,
      department: formData.department || undefined,
      isActive: formData.isActive,
    };
    if (dialogMode.value === 'add') {
      payload.password = '123456';
      payload.email = (formData.username || 'user') + '@cretas.com';
    }
    let res;
    if (dialogMode.value === 'add') {
      res = await post(`/${factoryId.value}/users`, payload);
    } else {
      res = await put(`/${factoryId.value}/users/${formData.id}`, payload);
    }
    if (res.success) {
      ElMessage.success(dialogMode.value === 'add' ? '添加成功' : '编辑成功');
      dialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(res.message || '操作失败');
    }
  } catch (error) {
    console.error('提交失败:', error);
    ElMessage.error('操作失败');
  } finally {
    submitting.value = false;
  }
}

function getRoleText(role: string) {
  const roleMap: Record<string, string> = {
    factory_super_admin: '工厂总监',
    hr_admin: 'HR管理员',
    procurement_manager: '采购主管',
    sales_manager: '销售主管',
    dispatcher: '调度',
    production_manager: '调度',
    warehouse_manager: '仓储主管',
    equipment_admin: '设备管理员',
    quality_manager: '质量经理',
    finance_manager: '财务主管',
    workshop_supervisor: '车间主任',
    quality_inspector: '质检员',
    operator: '操作员',
    warehouse_worker: '仓库员',
    permission_admin: '权限管理员',
    department_admin: '部门管理员',
    viewer: '查看者',
    unactivated: '未激活'
  };
  return roleMap[role] || role;
}
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>员工管理</span>
          <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleAdd">添加员工</el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" empty-text="暂无数据" stripe border>
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="fullName" label="姓名" />
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column label="角色">
          <template #default="{ row }">
            <el-tag>{{ getRoleText(row.roleCode || row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="部门">
          <template #default="{ row }">{{ row.departmentDisplayName || row.departmentName || row.department || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态">
          <template #default="{ row }">
            <el-tag :type="(row.isActive === true || row.status === 'ACTIVE') ? 'success' : 'danger'">
              {{ (row.isActive === true || row.status === 'ACTIVE') ? '在职' : '离职' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleView(row)">查看</el-button>
            <el-button v-if="canWrite" type="primary" link @click="handleEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        :page-size="pagination.size"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="handlePageChange"
        class="pagination"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="80px" :disabled="isViewMode">
        <el-form-item label="姓名" prop="fullName">
          <el-input v-model="formData.fullName" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="用户名" prop="username">
          <el-input v-model="formData.username" placeholder="请输入用户名" :disabled="dialogMode === 'edit'" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="formData.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="formData.role" placeholder="请选择角色" style="width: 100%">
            <el-option v-for="opt in roleOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="工号" prop="employeeCode">
          <el-input v-model="formData.employeeCode" placeholder="请输入工号" />
        </el-form-item>
        <el-form-item label="部门" prop="department">
          <el-select v-model="formData.department" placeholder="请选择部门" clearable style="width: 100%">
            <el-option label="加工部门" value="PROCESSING" />
            <el-option label="质量部门" value="QUALITY" />
            <el-option label="物流部门" value="LOGISTICS" />
            <el-option label="管理部门" value="MANAGEMENT" />
            <el-option label="养殖部门" value="FARMING" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="isActive">
          <el-switch v-model="formData.isActive" active-text="在职" inactive-text="离职" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ isViewMode ? '关闭' : '取消' }}</el-button>
        <el-button v-if="!isViewMode" type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.page-container {
  padding: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.pagination {
  margin-top: 20px;
  justify-content: flex-end;
}
</style>
