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
  View,
  Back
} from '@element-plus/icons-vue';
import {
  getChartTemplates,
  createChartTemplate,
  updateChartTemplate,
  deleteChartTemplate,
  previewChart,
  getDataSources,
  type ChartTemplate,
  type DataSource
} from '@/api/smartbi-config';

const router = useRouter();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('system'));

// 数据状态
const loading = ref(false);
const tableData = ref<ChartTemplate[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const dataSources = ref<DataSource[]>([]);

// 搜索表单
const searchForm = ref({
  keyword: '',
  type: '',
  category: '',
  isActive: '' as '' | 'true' | 'false'
});

// 编辑对话框
const dialogVisible = ref(false);
const dialogTitle = ref('');
const dialogLoading = ref(false);
const formRef = ref();
const editForm = ref<Partial<ChartTemplate>>({
  name: '',
  code: '',
  type: 'LINE',
  category: '',
  description: '',
  configJson: '',
  dataSourceId: undefined,
  isActive: true
});

// 预览对话框
const previewVisible = ref(false);
const previewLoading = ref(false);
const previewData = ref<unknown>(null);

// 图表类型选项
const chartTypeOptions = [
  { value: 'LINE', label: '折线图', icon: 'TrendCharts' },
  { value: 'BAR', label: '柱状图', icon: 'Histogram' },
  { value: 'PIE', label: '饼图', icon: 'PieChart' },
  { value: 'GAUGE', label: '仪表盘', icon: 'Odometer' },
  { value: 'HEATMAP', label: '热力图', icon: 'Grid' },
  { value: 'MAP', label: '地图', icon: 'MapLocation' },
  { value: 'RANKING', label: '排行榜', icon: 'Sort' },
  { value: 'KPI', label: 'KPI卡片', icon: 'DataBoard' },
  { value: 'COMBINED', label: '组合图', icon: 'Files' }
];

// 分类选项
const categoryOptions = [
  { value: 'SALES', label: '销售分析' },
  { value: 'FINANCE', label: '财务分析' },
  { value: 'PRODUCTION', label: '生产分析' },
  { value: 'WAREHOUSE', label: '仓储分析' },
  { value: 'QUALITY', label: '质量分析' },
  { value: 'HR', label: '人力资源' },
  { value: 'DASHBOARD', label: '驾驶舱' },
  { value: 'OTHER', label: '其他' }
];

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入模板名称', trigger: 'blur' },
    { max: 50, message: '名称不能超过50个字符', trigger: 'blur' }
  ],
  code: [
    { required: true, message: '请输入模板代码', trigger: 'blur' },
    { pattern: /^[A-Z][A-Z0-9_]*$/, message: '代码必须以大写字母开头，只能包含大写字母、数字和下划线', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择图表类型', trigger: 'change' }
  ],
  category: [
    { required: true, message: '请选择分类', trigger: 'change' }
  ]
};

// ============ 初始化 ============
onMounted(() => {
  loadData();
  loadDataSources();
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
    if (searchForm.value.category) params.category = searchForm.value.category;
    if (searchForm.value.isActive !== '') params.isActive = searchForm.value.isActive === 'true';

    const response = await getChartTemplates(params);
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

async function loadDataSources() {
  try {
    const response = await getDataSources({ size: 100, isActive: true });
    if (response.success && response.data) {
      dataSources.value = response.data.content || [];
    }
  } catch (error) {
    console.error('加载数据源失败:', error);
  }
}

// ============ 搜索操作 ============
function handleSearch() {
  pagination.value.page = 1;
  loadData();
}

function handleReset() {
  searchForm.value = { keyword: '', type: '', category: '', isActive: '' };
  handleSearch();
}

function handlePageChange(page: number) {
  pagination.value.page = page;
  loadData();
}

// ============ 新增/编辑 ============
function handleAdd() {
  dialogTitle.value = '新建图表模板';
  editForm.value = {
    name: '',
    code: '',
    type: 'LINE',
    category: '',
    description: '',
    configJson: getDefaultConfig('LINE'),
    dataSourceId: undefined,
    isActive: true
  };
  dialogVisible.value = true;
}

function handleEdit(row: ChartTemplate) {
  dialogTitle.value = '编辑图表模板';
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
      response = await updateChartTemplate(editForm.value.id, editForm.value);
    } else {
      response = await createChartTemplate(editForm.value);
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
async function handleDelete(row: ChartTemplate) {
  try {
    await ElMessageBox.confirm(
      `确定要删除图表模板 "${row.name}" 吗？删除后无法恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const response = await deleteChartTemplate(row.id);
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

// ============ 预览 ============
async function handlePreview(row: ChartTemplate) {
  previewLoading.value = true;
  previewVisible.value = true;
  try {
    const response = await previewChart(row.id);
    if (response.success) {
      previewData.value = response.data;
    }
  } catch (error) {
    console.error('预览失败:', error);
    ElMessage.error('获取预览数据失败');
  } finally {
    previewLoading.value = false;
  }
}

// ============ 辅助方法 ============
function getTypeLabel(type: string) {
  const option = chartTypeOptions.find(o => o.value === type);
  return option?.label || type;
}

function getTypeTagType(type: string) {
  const map: Record<string, string> = {
    'LINE': 'primary',
    'BAR': 'success',
    'PIE': 'warning',
    'GAUGE': 'danger',
    'HEATMAP': '',
    'MAP': 'info',
    'RANKING': '',
    'KPI': 'primary',
    'COMBINED': 'info'
  };
  return map[type] || 'info';
}

function getCategoryLabel(category: string) {
  const option = categoryOptions.find(o => o.value === category);
  return option?.label || category;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN');
}

function getDefaultConfig(type: string): string {
  const configs: Record<string, object> = {
    LINE: {
      xAxis: { type: 'category' },
      yAxis: { type: 'value' },
      series: [{ type: 'line', smooth: true }]
    },
    BAR: {
      xAxis: { type: 'category' },
      yAxis: { type: 'value' },
      series: [{ type: 'bar' }]
    },
    PIE: {
      series: [{ type: 'pie', radius: '50%' }]
    },
    GAUGE: {
      series: [{ type: 'gauge', min: 0, max: 100 }]
    },
    KPI: {
      title: '',
      value: 0,
      unit: '',
      trend: 'up'
    }
  };
  return JSON.stringify(configs[type] || {}, null, 2);
}

function handleTypeChange(type: string) {
  if (!editForm.value.id) {
    editForm.value.configJson = getDefaultConfig(type);
  }
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
      <span class="breadcrumb-current">图表模板配置</span>
    </div>

    <!-- 搜索栏 -->
    <el-card class="search-card">
      <el-form :model="searchForm" inline>
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="名称/代码"
            clearable
            style="width: 180px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="图表类型">
          <el-select v-model="searchForm.type" placeholder="全部类型" clearable style="width: 130px">
            <el-option
              v-for="option in chartTypeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="searchForm.category" placeholder="全部分类" clearable style="width: 130px">
            <el-option
              v-for="option in categoryOptions"
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
          <span>图表模板列表</span>
          <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleAdd">
            新建模板
          </el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe border>
        <el-table-column prop="code" label="模板代码" width="180">
          <template #default="{ row }">
            <code class="template-code">{{ row.code }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="模板名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="type" label="图表类型" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.type)" size="small">
              {{ getTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="110" align="center">
          <template #default="{ row }">
            <el-tag type="info" size="small">
              {{ getCategoryLabel(row.category) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="dataSourceName" label="数据源" width="140">
          <template #default="{ row }">
            {{ row.dataSourceName || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip>
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
            <el-button type="primary" link :icon="View" @click="handlePreview(row)">
              预览
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
        <el-empty description="暂无图表模板">
          <el-button v-if="canWrite" type="primary" @click="handleAdd">创建模板</el-button>
        </el-empty>
      </div>
    </el-card>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="700px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="editForm"
        :rules="formRules"
        label-width="100px"
        style="padding-right: 20px"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="模板名称" prop="name">
              <el-input v-model="editForm.name" placeholder="请输入模板名称" maxlength="50" show-word-limit />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="模板代码" prop="code">
              <el-input
                v-model="editForm.code"
                placeholder="如: SALES_TREND_LINE"
                :disabled="!!editForm.id"
                maxlength="50"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="图表类型" prop="type">
              <el-select
                v-model="editForm.type"
                placeholder="请选择图表类型"
                style="width: 100%"
                @change="handleTypeChange"
              >
                <el-option
                  v-for="option in chartTypeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分类" prop="category">
              <el-select v-model="editForm.category" placeholder="请选择分类" style="width: 100%">
                <el-option
                  v-for="option in categoryOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="数据源">
          <el-select
            v-model="editForm.dataSourceId"
            placeholder="请选择数据源 (可选)"
            style="width: 100%"
            clearable
          >
            <el-option
              v-for="ds in dataSources"
              :key="ds.id"
              :label="`${ds.name} (${ds.code})`"
              :value="ds.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="图表配置">
          <el-input
            v-model="editForm.configJson"
            type="textarea"
            :rows="8"
            placeholder="JSON 格式的 ECharts 配置"
            class="config-textarea"
          />
          <div class="form-tip">请输入有效的 JSON 格式配置，将作为 ECharts option 使用</div>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="editForm.description"
            type="textarea"
            :rows="2"
            placeholder="模板用途说明"
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

    <!-- 预览对话框 -->
    <el-dialog
      v-model="previewVisible"
      title="图表预览"
      width="800px"
      destroy-on-close
    >
      <div v-loading="previewLoading" class="preview-container">
        <div v-if="previewData" class="preview-content">
          <el-alert type="info" :closable="false">
            预览功能需要后端返回实际数据和图表配置，当前显示配置信息。
          </el-alert>
          <pre class="preview-json">{{ JSON.stringify(previewData, null, 2) }}</pre>
        </div>
        <el-empty v-else-if="!previewLoading" description="无法获取预览数据" />
      </div>
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

.template-code {
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

.config-textarea {
  :deep(textarea) {
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    line-height: 1.5;
  }
}

.preview-container {
  min-height: 300px;

  .preview-content {
    .preview-json {
      margin-top: 16px;
      padding: 16px;
      background-color: #f5f5f5;
      border-radius: 4px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      overflow: auto;
      max-height: 400px;
    }
  }
}
</style>
