<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, put, del } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Refresh, Check, Close } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('quality'));

const loading = ref(false);
const tableData = ref<any[]>([]);
const pagination = ref({ page: 1, size: 20, total: 0 });
const searchForm = ref({
  category: '',
  keyword: ''
});

// 统计数据
const statistics = ref({
  totalItems: 0,
  enabledItems: 0,
  requiredItems: 0,
  criticalItems: 0
});
const categoryStats = ref<Record<string, number>>({});

// 新建/编辑对话框
const dialogVisible = ref(false);
const dialogTitle = ref('新建质检标准');
const dialogLoading = ref(false);
const editingId = ref<string | null>(null);
const itemForm = ref({
  itemName: '',
  category: '',
  description: '',
  checkMethod: '',
  standardReference: '',
  valueType: 'RANGE',
  standardValue: '',
  minValue: null as number | null,
  maxValue: null as number | null,
  unit: '',
  severity: 'MINOR',
  isRequired: false,
  enabled: true
});

const categories = [
  { value: 'SENSORY', label: '感官检测' },
  { value: 'PHYSICAL', label: '物理检测' },
  { value: 'CHEMICAL', label: '化学检测' },
  { value: 'MICROBIOLOGICAL', label: '微生物检测' },
  { value: 'PACKAGING', label: '包装检测' }
];

const severities = [
  { value: 'CRITICAL', label: '严重' },
  { value: 'MAJOR', label: '主要' },
  { value: 'MINOR', label: '次要' }
];

onMounted(() => {
  loadData();
  loadStatistics();
});

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const params: Record<string, string | number> = {
      page: pagination.value.page,
      size: pagination.value.size
    };
    if (searchForm.value.keyword) params.keyword = searchForm.value.keyword;
    if (searchForm.value.category) params.category = searchForm.value.category;
    const response = await get(`/${factoryId.value}/quality-check-items`, { params });
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

async function loadStatistics() {
  if (!factoryId.value) return;
  try {
    const [statsRes, catRes] = await Promise.allSettled([
      get(`/${factoryId.value}/quality-check-items/statistics`),
      get(`/${factoryId.value}/quality-check-items/statistics/by-category`)
    ]);

    if (statsRes.status === 'fulfilled' && statsRes.value.success) {
      statistics.value = statsRes.value.data || statistics.value;
    }
    if (catRes.status === 'fulfilled' && catRes.value.success) {
      categoryStats.value = catRes.value.data || {};
    }
  } catch (error) {
    console.error('加载统计失败:', error);
    ElMessage.error('加载统计数据失败');
  }
}

function handleSearch() {
  pagination.value.page = 1;
  loadData();
}

function handleRefresh() {
  searchForm.value = { category: '', keyword: '' };
  pagination.value.page = 1;
  loadData();
  loadStatistics();
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
  editingId.value = null;
  dialogTitle.value = '新建质检标准';
  itemForm.value = {
    itemName: '',
    category: '',
    description: '',
    checkMethod: '',
    standardReference: '',
    valueType: 'RANGE',
    standardValue: '',
    minValue: null,
    maxValue: null,
    unit: '',
    severity: 'MINOR',
    isRequired: false,
    enabled: true
  };
  dialogVisible.value = true;
}

function handleEdit(row: any) {
  editingId.value = row.id;
  dialogTitle.value = '编辑质检标准';
  itemForm.value = {
    itemName: row.itemName || '',
    category: row.category || '',
    description: row.description || '',
    checkMethod: row.checkMethod || '',
    standardReference: row.standardReference || '',
    valueType: row.valueType || 'RANGE',
    standardValue: row.standardValue || '',
    minValue: row.minValue,
    maxValue: row.maxValue,
    unit: row.unit || '',
    severity: row.severity || 'MINOR',
    isRequired: row.isRequired || false,
    enabled: row.enabled !== false
  };
  dialogVisible.value = true;
}

async function submitForm() {
  if (!itemForm.value.itemName || !itemForm.value.category) {
    ElMessage.warning('请填写名称和类别');
    return;
  }

  dialogLoading.value = true;
  try {
    let response;
    if (editingId.value) {
      response = await put(`/${factoryId.value}/quality-check-items/${editingId.value}`, itemForm.value);
    } else {
      response = await post(`/${factoryId.value}/quality-check-items`, itemForm.value);
    }
    if (response.success) {
      ElMessage.success(editingId.value ? '更新成功' : '创建成功');
      dialogVisible.value = false;
      loadData();
      loadStatistics();
    } else {
      ElMessage.error(response.message || '操作失败');
    }
  } catch (error) {
    ElMessage.error('操作失败');
  } finally {
    dialogLoading.value = false;
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定要删除质检项「${row.itemName}」吗？`, '删除确认', { type: 'warning' });
  } catch { return; }

  try {
    const response = await del(`/${factoryId.value}/quality-check-items/${row.id}`);
    if (response.success) {
      ElMessage.success('删除成功');
      loadData();
      loadStatistics();
    } else {
      ElMessage.error(response.message || '删除失败');
    }
  } catch {
    ElMessage.error('删除失败');
  }
}

async function handleToggleEnabled(row: any) {
  const newEnabled = !row.enabled;
  const action = newEnabled ? 'enable' : 'disable';
  try {
    const response = await post(`/${factoryId.value}/quality-check-items/batch/${action}`, [row.id]);
    if (response.success) {
      row.enabled = newEnabled;
      ElMessage.success(newEnabled ? '已启用' : '已禁用');
      loadStatistics();
    } else {
      ElMessage.error(response.message || '操作失败');
    }
  } catch {
    ElMessage.error('操作失败');
  }
}

function getCategoryText(category: string) {
  const map: Record<string, string> = {
    SENSORY: '感官检测',
    PHYSICAL: '物理检测',
    CHEMICAL: '化学检测',
    MICROBIOLOGICAL: '微生物检测',
    PACKAGING: '包装检测'
  };
  return map[category] || category;
}

function getCategoryType(category: string) {
  const map: Record<string, string> = {
    SENSORY: '',
    PHYSICAL: 'success',
    CHEMICAL: 'warning',
    MICROBIOLOGICAL: 'danger',
    PACKAGING: 'info'
  };
  return map[category] || 'info';
}

function getSeverityType(severity: string) {
  const map: Record<string, string> = {
    CRITICAL: 'danger',
    MAJOR: 'warning',
    MINOR: 'info'
  };
  return map[severity] || 'info';
}

function getSeverityText(severity: string) {
  const map: Record<string, string> = {
    CRITICAL: '严重',
    MAJOR: '主要',
    MINOR: '次要'
  };
  return map[severity] || severity || '-';
}

function formatStandard(row: any) {
  if (row.minValue !== null && row.maxValue !== null) {
    return `${row.minValue} - ${row.maxValue} ${row.unit || ''}`;
  }
  if (row.standardValue) {
    return `${row.standardValue} ${row.unit || ''}`;
  }
  return '-';
}

// 过滤显示的数据 (前端过滤 keyword 和 category)
const filteredData = computed(() => {
  let data = tableData.value;
  if (searchForm.value.category) {
    data = data.filter(item => item.category === searchForm.value.category);
  }
  if (searchForm.value.keyword) {
    const kw = searchForm.value.keyword.toLowerCase();
    data = data.filter(item =>
      (item.itemName || '').toLowerCase().includes(kw) ||
      (item.itemCode || '').toLowerCase().includes(kw) ||
      (item.description || '').toLowerCase().includes(kw)
    );
  }
  return data;
});
</script>

<template>
  <div class="page-wrapper">
    <!-- 统计卡片 -->
    <div class="statistics-row">
      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-value">{{ statistics.totalItems || tableData.length }}</div>
          <div class="stat-label">质检项总数</div>
        </div>
      </el-card>
      <el-card class="stat-card success" shadow="hover">
        <div class="stat-content">
          <div class="stat-value">{{ statistics.enabledItems || 0 }}</div>
          <div class="stat-label">已启用</div>
        </div>
      </el-card>
      <el-card class="stat-card warning" shadow="hover">
        <div class="stat-content">
          <div class="stat-value">{{ statistics.requiredItems || 0 }}</div>
          <div class="stat-label">必检项</div>
        </div>
      </el-card>
      <el-card class="stat-card danger" shadow="hover">
        <div class="stat-content">
          <div class="stat-value">{{ statistics.criticalItems || 0 }}</div>
          <div class="stat-label">严重级别</div>
        </div>
      </el-card>
    </div>

    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">质检标准管理</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleCreate">
              新建标准
            </el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索名称/编号"
          :prefix-icon="Search"
          clearable
          style="width: 220px"
          @keyup.enter="handleSearch"
        />
        <el-select v-model="searchForm.category" placeholder="全部类别" clearable style="width: 150px">
          <el-option
            v-for="cat in categories"
            :key="cat.value"
            :label="cat.label"
            :value="cat.value"
          />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="filteredData" v-loading="loading" empty-text="暂无数据" stripe border style="width: 100%">
        <el-table-column prop="itemCode" label="编号" width="120" />
        <el-table-column prop="itemName" label="检测项目" min-width="150" show-overflow-tooltip />
        <el-table-column prop="category" label="类别" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getCategoryType(row.category)" size="small">
              {{ getCategoryText(row.category) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="标准值" width="160">
          <template #default="{ row }">
            {{ formatStandard(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="checkMethod" label="检测方法" min-width="120" show-overflow-tooltip />
        <el-table-column prop="severity" label="严重程度" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getSeverityType(row.severity)" size="small">
              {{ getSeverityText(row.severity) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="isRequired" label="必检" width="70" align="center">
          <template #default="{ row }">
            <el-icon v-if="row.isRequired" color="#67C23A"><Check /></el-icon>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="enabled" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
              {{ row.enabled ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="bindingCount" label="绑定" width="70" align="center">
          <template #default="{ row }">
            {{ row.bindingCount || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button
              v-if="canWrite"
              :type="row.enabled ? 'warning' : 'success'"
              link
              size="small"
              @click="handleToggleEnabled(row)"
            >{{ row.enabled ? '禁用' : '启用' }}</el-button>
            <el-button
              v-if="canWrite"
              type="danger"
              link
              size="small"
              @click="handleDelete(row)"
            >删除</el-button>
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

    <!-- 新建/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px">
      <el-form :model="itemForm" label-width="100px">
        <el-form-item label="检测名称" required>
          <el-input v-model="itemForm.itemName" placeholder="如：菌落总数" />
        </el-form-item>
        <el-form-item label="检测类别" required>
          <el-select v-model="itemForm.category" placeholder="选择类别" style="width: 100%">
            <el-option
              v-for="cat in categories"
              :key="cat.value"
              :label="cat.label"
              :value="cat.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="检测方法">
          <el-input v-model="itemForm.checkMethod" placeholder="如：平板计数法" />
        </el-form-item>
        <el-form-item label="标准依据">
          <el-input v-model="itemForm.standardReference" placeholder="如：GB 4789.2-2022" />
        </el-form-item>
        <el-form-item label="标准值">
          <el-input v-model="itemForm.standardValue" placeholder="如：≤10000 CFU/g" />
        </el-form-item>
        <el-form-item label="范围值">
          <div style="display: flex; gap: 8px; align-items: center;">
            <el-input-number v-model="itemForm.minValue" :precision="2" placeholder="最小值" style="flex: 1" />
            <span>~</span>
            <el-input-number v-model="itemForm.maxValue" :precision="2" placeholder="最大值" style="flex: 1" />
            <el-input v-model="itemForm.unit" placeholder="单位" style="width: 80px" />
          </div>
        </el-form-item>
        <el-form-item label="严重程度">
          <el-select v-model="itemForm.severity" style="width: 100%">
            <el-option
              v-for="s in severities"
              :key="s.value"
              :label="s.label"
              :value="s.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="itemForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="选项">
          <el-checkbox v-model="itemForm.isRequired">必检项</el-checkbox>
          <el-checkbox v-model="itemForm.enabled">启用</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogLoading" @click="submitForm">
          {{ editingId ? '更新' : '创建' }}
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
  gap: 16px;
}

.statistics-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  .stat-content {
    text-align: center;
    padding: 8px 0;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 600;
    color: #409eff;
  }

  .stat-label {
    font-size: 14px;
    color: #909399;
    margin-top: 8px;
  }

  &.success .stat-value { color: #67c23a; }
  &.warning .stat-value { color: #e6a23c; }
  &.danger .stat-value { color: #f56c6c; }
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

@media (max-width: 768px) {
  .statistics-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
