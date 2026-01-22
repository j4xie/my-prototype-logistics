<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus,
  Search,
  Refresh,
  Edit,
  Delete,
  Connection,
  Back
} from '@element-plus/icons-vue';
import {
  getDataSources,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testDataSourceConnection,
  type DataSource
} from '@/api/smartbi-config';

const router = useRouter();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('system'));

// 数据状态
const loading = ref(false);
const tableData = ref<DataSource[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });

// 搜索表单
const searchForm = ref({
  keyword: '',
  type: '',
  isActive: '' as '' | 'true' | 'false'
});

// 编辑对话框
const dialogVisible = ref(false);
const dialogTitle = ref('');
const dialogLoading = ref(false);
const formRef = ref();
const editForm = ref<Partial<DataSource>>({
  name: '',
  code: '',
  type: 'DATABASE',
  description: '',
  connectionConfig: '',
  refreshInterval: 60,
  isActive: true
});

// 数据源类型选项
const typeOptions = [
  { value: 'DATABASE', label: '数据库', icon: 'Coin' },
  { value: 'API', label: 'API接口', icon: 'Link' },
  { value: 'EXCEL', label: 'Excel文件', icon: 'Document' },
  { value: 'CUSTOM', label: '自定义', icon: 'Setting' }
];

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入数据源名称', trigger: 'blur' },
    { max: 50, message: '名称不能超过50个字符', trigger: 'blur' }
  ],
  code: [
    { required: true, message: '请输入数据源代码', trigger: 'blur' },
    { pattern: /^[A-Z][A-Z0-9_]*$/, message: '代码必须以大写字母开头，只能包含大写字母、数字和下划线', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择数据源类型', trigger: 'change' }
  ]
};

// ============ 初始化 ============
onMounted(() => {
  loadData();
});

// ============ 数据加载 ============
async function loadData() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = {
      page: pagination.value.page - 1,
      size: pagination.value.size
    };
    if (searchForm.value.keyword) params.keyword = searchForm.value.keyword;
    if (searchForm.value.type) params.type = searchForm.value.type;
    if (searchForm.value.isActive !== '') params.isActive = searchForm.value.isActive === 'true';

    const response = await getDataSources(params);
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

// ============ 搜索操作 ============
function handleSearch() {
  pagination.value.page = 1;
  loadData();
}

function handleReset() {
  searchForm.value = { keyword: '', type: '', isActive: '' };
  handleSearch();
}

function handlePageChange(page: number) {
  pagination.value.page = page;
  loadData();
}

// ============ 新增/编辑 ============
function handleAdd() {
  dialogTitle.value = '新建数据源';
  editForm.value = {
    name: '',
    code: '',
    type: 'DATABASE',
    description: '',
    connectionConfig: '',
    refreshInterval: 60,
    isActive: true
  };
  dialogVisible.value = true;
}

function handleEdit(row: DataSource) {
  dialogTitle.value = '编辑数据源';
  editForm.value = { ...row };
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!formRef.value) return;

  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  dialogLoading.value = true;
  try {
    let response;
    if (editForm.value.id) {
      response = await updateDataSource(editForm.value.id, editForm.value);
    } else {
      response = await createDataSource(editForm.value);
    }

    if (response.success) {
      ElMessage.success(editForm.value.id ? '更新成功' : '创建成功');
      dialogVisible.value = false;
      loadData();
    }
  } catch (error) {
    console.error('保存失败:', error);
    ElMessage.error('保存失败');
  } finally {
    dialogLoading.value = false;
  }
}

// ============ 删除 ============
async function handleDelete(row: DataSource) {
  try {
    await ElMessageBox.confirm(
      `确定要删除数据源 "${row.name}" 吗？删除后无法恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const response = await deleteDataSource(row.id);
    if (response.success) {
      ElMessage.success('删除成功');
      loadData();
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error);
      ElMessage.error('删除失败');
    }
  }
}

// ============ 测试连接 ============
async function handleTestConnection(row: DataSource) {
  try {
    ElMessage.info('正在测试连接...');
    const response = await testDataSourceConnection(row.id);
    if (response.success && response.data?.success) {
      ElMessage.success('连接测试成功');
    } else {
      ElMessage.warning(response.data?.message || '连接测试失败');
    }
  } catch (error) {
    console.error('测试连接失败:', error);
    ElMessage.error('测试连接失败');
  }
}

// ============ 辅助方法 ============
function getTypeLabel(type: string) {
  const option = typeOptions.find(o => o.value === type);
  return option?.label || type;
}

function getTypeTagType(type: string) {
  const map: Record<string, string> = {
    'DATABASE': 'primary',
    'API': 'success',
    'EXCEL': 'warning',
    'CUSTOM': 'info'
  };
  return map[type] || 'info';
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN');
}

function goBack() {
  router.push('/smartbi-config');
}
</script>

<template>
  <div class="page-container">
    <!-- 面包屑导航 -->
    <div class="page-breadcrumb">
      <el-button :icon="Back" link @click="goBack">返回配置中心</el-button>
      <el-divider direction="vertical" />
      <span class="breadcrumb-current">数据源配置</span>
    </div>

    <!-- 搜索栏 -->
    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="名称/代码"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="searchForm.type" placeholder="全部类型" clearable style="width: 140px">
            <el-option
              v-for="option in typeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.isActive" placeholder="全部" clearable style="width: 100px">
            <el-option label="启用" value="true" />
            <el-option label="禁用" value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 数据表格 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>数据源列表</span>
          <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleAdd">
            新建数据源
          </el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe border>
        <el-table-column prop="code" label="代码" width="150">
          <template #default="{ row }">
            <code class="source-code">{{ row.code }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.type)" size="small">
              {{ getTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="refreshInterval" label="刷新间隔" width="120" align="center">
          <template #default="{ row }">
            {{ row.refreshInterval ? `${row.refreshInterval}秒` : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.description || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="isActive" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
              {{ row.isActive ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link :icon="Connection" @click="handleTestConnection(row)">
              测试
            </el-button>
            <el-button v-if="canWrite" type="primary" link :icon="Edit" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button v-if="canWrite" type="danger" link :icon="Delete" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="pagination.total > 0"
        v-model:current-page="pagination.page"
        :page-size="pagination.size"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="handlePageChange"
        class="pagination"
      />

      <div v-if="tableData.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无数据源配置">
          <el-button v-if="canWrite" type="primary" @click="handleAdd">创建数据源</el-button>
        </el-empty>
      </div>
    </el-card>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="editForm"
        :rules="formRules"
        label-width="100px"
        style="padding-right: 20px"
      >
        <el-form-item label="数据源名称" prop="name">
          <el-input v-model="editForm.name" placeholder="请输入数据源名称" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="数据源代码" prop="code">
          <el-input
            v-model="editForm.code"
            placeholder="如: SALES_DB, API_INVENTORY"
            :disabled="!!editForm.id"
            maxlength="50"
          />
          <div class="form-tip">代码创建后不可修改，用于系统内部引用</div>
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="editForm.type" placeholder="请选择类型" style="width: 100%">
            <el-option
              v-for="option in typeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="刷新间隔">
          <el-input-number
            v-model="editForm.refreshInterval"
            :min="0"
            :max="86400"
            placeholder="秒"
            style="width: 200px"
          />
          <span class="form-suffix">秒 (0 表示不自动刷新)</span>
        </el-form-item>
        <el-form-item label="连接配置">
          <el-input
            v-model="editForm.connectionConfig"
            type="textarea"
            :rows="4"
            placeholder="JSON 格式的连接配置，如数据库连接字符串、API 密钥等"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="editForm.description"
            type="textarea"
            :rows="2"
            placeholder="数据源用途说明"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="editForm.isActive" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogLoading" @click="handleSubmit">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.page-container {
  padding: 20px;
}

.page-breadcrumb {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  padding: 8px 0;

  .breadcrumb-current {
    font-size: 14px;
    color: var(--text-color-primary);
    font-weight: 500;
  }
}

.search-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.source-code {
  background-color: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
}

.pagination {
  margin-top: 20px;
  justify-content: flex-end;
}

.empty-state {
  padding: 40px 0;
}

.form-tip {
  font-size: 12px;
  color: var(--text-color-secondary);
  margin-top: 4px;
}

.form-suffix {
  margin-left: 8px;
  font-size: 13px;
  color: var(--text-color-secondary);
}
</style>
