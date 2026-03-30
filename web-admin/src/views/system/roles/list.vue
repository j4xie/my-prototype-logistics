<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { usePermissionStore } from '@/store/modules/permission';
import { useAuthStore } from '@/store/modules/auth';
import { get, put } from '@/api/request';
import { ElMessage } from 'element-plus';

const permissionStore = usePermissionStore();
const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('system'));

// Permission modules
const allPermissionModules = [
  { key: 'production', label: '生产管理' },
  { key: 'quality', label: '质检管理' },
  { key: 'warehouse', label: '仓库管理' },
  { key: 'procurement', label: '采购管理' },
  { key: 'sales', label: '销售管理' },
  { key: 'hr', label: '人事管理' },
  { key: 'equipment', label: '设备管理' },
  { key: 'finance', label: '财务管理' },
  { key: 'system', label: '系统设置' },
  { key: 'ai', label: 'AI 分析' },
  { key: 'report', label: '报表中心' },
  { key: 'dashboard', label: '数据看板' },
];

// View permissions dialog
const viewDialogVisible = ref(false);
const viewingRole = ref<Record<string, unknown> | null>(null);
const rolePermissions = ref<Record<string, unknown>[]>([]);
const permissionsLoading = ref(false);

// Edit dialog
const editDialogVisible = ref(false);
const editingRole = ref<Record<string, unknown> | null>(null);
const editForm = reactive({
  displayName: '',
  description: '',
  permissions: {} as Record<string, string>, // module -> 'rw' | 'r' | 'w' | '-'
});
const editSubmitting = ref(false);

async function handleViewPermissions(row: Record<string, unknown>) {
  viewingRole.value = row;
  viewDialogVisible.value = true;
  permissionsLoading.value = true;
  try {
    const res = await get(`/${factoryId.value}/roles/${row.name}/permissions`);
    if (res.success && res.data) {
      rolePermissions.value = res.data;
    } else {
      // Fallback: derive from role level
      rolePermissions.value = derivePermissions(row);
    }
  } catch {
    // Fallback for missing API
    rolePermissions.value = derivePermissions(row);
  } finally {
    permissionsLoading.value = false;
  }
}

function derivePermissions(role: Record<string, unknown>) {
  // Sensible defaults based on level
  return allPermissionModules.map(m => {
    let access = '-';
    if (role.level === 1) access = 'rw'; // super admin
    else if (role.name.includes(m.key.replace('ment', '').replace('管理', ''))) access = 'rw';
    else if (role.level <= 2) access = 'r';
    return { module: m.key, label: m.label, access };
  });
}

function getAccessTag(access: string) {
  const map: Record<string, { type: string; label: string }> = {
    rw: { type: 'success', label: '读写' },
    r: { type: 'warning', label: '只读' },
    w: { type: 'info', label: '只写' },
    '-': { type: 'danger', label: '无权限' },
  };
  return map[access] || map['-'];
}

function handleEdit(row: Record<string, unknown>) {
  editingRole.value = row;
  editForm.displayName = row.displayName;
  editForm.description = row.description;
  // Init permissions from current view or defaults
  const perms = derivePermissions(row);
  editForm.permissions = {};
  perms.forEach(p => {
    editForm.permissions[p.module] = p.access;
  });
  editDialogVisible.value = true;
}

async function handleEditSubmit() {
  editSubmitting.value = true;
  try {
    const payload = {
      displayName: editForm.displayName,
      description: editForm.description,
      permissions: editForm.permissions,
    };
    const res = await put(`/${factoryId.value}/roles/${editingRole.value.name}`, payload);
    if (res && res.success === false) {
      ElMessage.error(res.message || '保存失败');
      return;
    }
    ElMessage.success('保存成功');
    // Update local data
    const role = roles.value.find(r => r.name === editingRole.value.name);
    if (role) {
      role.displayName = editForm.displayName;
      role.description = editForm.description;
    }
    editDialogVisible.value = false;
  } catch (error) {
    console.error('Edit role failed:', error);
    ElMessage.error('保存失败');
  } finally {
    editSubmitting.value = false;
  }
}

// 14种工厂角色数据
const roles = ref([
  {
    id: 1,
    name: 'factory_super_admin',
    displayName: '工厂超管',
    description: '工厂最高权限，管理所有模块',
    userCount: 2,
    level: 1
  },
  {
    id: 2,
    name: 'production_manager',
    displayName: '生产经理',
    description: '管理生产计划和批次，质检统计查看',
    userCount: 3,
    level: 2
  },
  {
    id: 3,
    name: 'workshop_supervisor',
    displayName: '车间主任',
    description: '执行生产任务，管理车间设备',
    userCount: 5,
    level: 3
  },
  {
    id: 4,
    name: 'quality_manager',
    displayName: '质检主管',
    description: '管理质检标准和流程',
    userCount: 2,
    level: 2
  },
  {
    id: 5,
    name: 'quality_inspector',
    displayName: '质检员',
    description: '执行质检任务',
    userCount: 8,
    level: 4
  },
  {
    id: 6,
    name: 'warehouse_manager',
    displayName: '仓库主管',
    description: '管理仓库和库存',
    userCount: 2,
    level: 2
  },
  {
    id: 7,
    name: 'warehouse_operator',
    displayName: '仓库操作员',
    description: '执行出入库操作',
    userCount: 6,
    level: 4
  },
  {
    id: 8,
    name: 'procurement_manager',
    displayName: '采购主管',
    description: '管理供应商和采购订单',
    userCount: 2,
    level: 2
  },
  {
    id: 9,
    name: 'procurement_staff',
    displayName: '采购员',
    description: '执行采购任务',
    userCount: 4,
    level: 4
  },
  {
    id: 10,
    name: 'sales_manager',
    displayName: '销售主管',
    description: '管理客户和销售订单',
    userCount: 2,
    level: 2
  },
  {
    id: 11,
    name: 'sales_staff',
    displayName: '销售员',
    description: '执行销售任务',
    userCount: 5,
    level: 4
  },
  {
    id: 12,
    name: 'hr_manager',
    displayName: '人事主管',
    description: '管理员工和考勤',
    userCount: 2,
    level: 2
  },
  {
    id: 13,
    name: 'equipment_manager',
    displayName: '设备主管',
    description: '管理设备和维护',
    userCount: 2,
    level: 2
  },
  {
    id: 14,
    name: 'finance_manager',
    displayName: '财务主管',
    description: '管理成本和财务报表',
    userCount: 2,
    level: 2
  }
]);

function getLevelTag(level: number) {
  const types: Record<number, string> = {
    1: 'danger',
    2: 'warning',
    3: 'success',
    4: 'info'
  };
  const labels: Record<number, string> = {
    1: '超级管理',
    2: '主管级',
    3: '主任级',
    4: '员工级'
  };
  return { type: types[level], label: labels[level] };
}
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>角色管理</span>
          <el-tag type="info">共 14 种工厂角色</el-tag>
        </div>
      </template>

      <el-table :data="roles" stripe>
        <el-table-column prop="displayName" label="角色名称" width="120" />
        <el-table-column prop="name" label="角色标识" width="180">
          <template #default="{ row }">
            <code>{{ row.name }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="level" label="级别" width="120">
          <template #default="{ row }">
            <el-tag :type="getLevelTag(row.level).type">
              {{ getLevelTag(row.level).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="userCount" label="用户数" width="100">
          <template #default="{ row }">
            <el-tag>{{ row.userCount }} 人</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleViewPermissions(row)">查看权限</el-button>
            <el-tooltip content="角色编辑功能开发中" placement="top"><el-button type="info" link disabled>编辑</el-button></el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 查看权限 Dialog -->
    <el-dialog v-model="viewDialogVisible" :title="`${viewingRole?.displayName} — 权限详情`" width="500px" destroy-on-close>
      <el-table :data="rolePermissions" v-loading="permissionsLoading" stripe border>
        <el-table-column prop="label" label="功能模块" width="140" />
        <el-table-column prop="access" label="权限" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getAccessTag(row.access).type" size="small">
              {{ getAccessTag(row.access).label }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 编辑角色 Dialog -->
    <el-dialog v-model="editDialogVisible" :title="`编辑角色 — ${editingRole?.displayName}`" width="600px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="角色名称">
          <el-input v-model="editForm.displayName" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editForm.description" type="textarea" :rows="2" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item label="权限配置">
          <el-table :data="allPermissionModules" stripe border size="small" style="width: 100%">
            <el-table-column prop="label" label="功能模块" width="120" />
            <el-table-column label="权限" align="center">
              <template #default="{ row }">
                <el-radio-group v-model="editForm.permissions[row.key]" size="small">
                  <el-radio-button value="rw">读写</el-radio-button>
                  <el-radio-button value="r">只读</el-radio-button>
                  <el-radio-button value="w">只写</el-radio-button>
                  <el-radio-button value="-">无</el-radio-button>
                </el-radio-group>
              </template>
            </el-table-column>
          </el-table>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="handleEditSubmit">保存</el-button>
      </template>
    </el-dialog>

    <el-card style="margin-top: 20px;">
      <template #header>
        <span>权限说明</span>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="rw">读写权限 - 可查看和修改</el-descriptions-item>
        <el-descriptions-item label="r">只读权限 - 仅可查看</el-descriptions-item>
        <el-descriptions-item label="w">只写权限 - 仅可创建</el-descriptions-item>
        <el-descriptions-item label="-">无权限 - 不可访问</el-descriptions-item>
      </el-descriptions>
    </el-card>
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
code {
  background-color: #f5f7fa;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
}
</style>
