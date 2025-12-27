<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import { Plus, Search, Refresh } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('system'));

const loading = ref(false);
const tableData = ref<any[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const searchForm = ref({ username: '', role: '' });

onMounted(() => {
  loadData();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/users`, {
      params: {
        page: pagination.value.page,
        size: pagination.value.size,
        ...searchForm.value
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

function handleSearch() {
  pagination.value.page = 1;
  loadData();
}

function handleReset() {
  searchForm.value = { username: '', role: '' };
  handleSearch();
}

function handlePageChange(page: number) {
  pagination.value.page = page;
  loadData();
}

const roleOptions = [
  { value: 'factory_super_admin', label: '工厂超管' },
  { value: 'production_manager', label: '生产经理' },
  { value: 'workshop_supervisor', label: '车间主任' },
  { value: 'quality_manager', label: '质检主管' },
  { value: 'quality_inspector', label: '质检员' },
  { value: 'warehouse_manager', label: '仓库主管' },
  { value: 'warehouse_operator', label: '仓库操作员' },
  { value: 'procurement_manager', label: '采购主管' },
  { value: 'procurement_staff', label: '采购员' },
  { value: 'sales_manager', label: '销售主管' },
  { value: 'sales_staff', label: '销售员' },
  { value: 'hr_manager', label: '人事主管' },
  { value: 'equipment_manager', label: '设备主管' },
  { value: 'finance_manager', label: '财务主管' }
];

function getRoleText(role: string) {
  const option = roleOptions.find(o => o.value === role);
  return option?.label || role;
}
</script>

<template>
  <div class="page-container">
    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="用户名">
          <el-input v-model="searchForm.username" placeholder="请输入用户名" clearable />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="searchForm.role" placeholder="全部角色" clearable>
            <el-option
              v-for="option in roleOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <el-button v-if="canWrite" type="primary" :icon="Plus">添加用户</el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="fullName" label="姓名" />
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column prop="role" label="角色">
          <template #default="{ row }">
            <el-tag>{{ getRoleText(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="departmentName" label="部门" />
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              active-value="ACTIVE"
              inactive-value="INACTIVE"
              :disabled="!canWrite"
            />
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default>
            <el-button type="primary" link>查看</el-button>
            <el-button v-if="canWrite" type="primary" link>编辑</el-button>
            <el-button v-if="canWrite" type="danger" link>重置密码</el-button>
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
  </div>
</template>

<style lang="scss" scoped>
.page-container {
  padding: 20px;
}
.search-card {
  margin-bottom: 20px;
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
