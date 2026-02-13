<script setup lang="ts">
/**
 * SmartBI 查询模板管理
 * 支持查询模板的增删改查，帮助用户快速复用常用的分析查询
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { get, post, put, del } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus,
  Edit,
  Delete,
  Search,
  Tickets,
  TrendCharts,
  Money,
  Histogram,
  DataAnalysis
} from '@element-plus/icons-vue';

const router = useRouter();
const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

// ==================== 类型定义 ====================

interface TemplateParam {
  name: string;
  type: 'text' | 'number' | 'date' | 'daterange' | 'select';
  label: string;
  options?: string[];
}

interface QueryTemplate {
  id?: number;
  name: string;
  category: '财务分析' | '销售分析' | '生产分析' | '自定义';
  description: string;
  queryTemplate: string;
  parameters: TemplateParam[];
  createdAt?: string;
  updatedAt?: string;
}

// ==================== 状态管理 ====================

const loading = ref(false);
const templates = ref<QueryTemplate[]>([]);
const selectedCategory = ref<string>('');
const searchKeyword = ref('');

// 对话框状态
const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const currentTemplate = ref<QueryTemplate>({
  name: '',
  category: '财务分析',
  description: '',
  queryTemplate: '',
  parameters: []
});

// 分类配置
const categoryOptions = [
  { value: '财务分析', icon: Money, color: '#67C23A' },
  { value: '销售分析', icon: TrendCharts, color: '#409EFF' },
  { value: '生产分析', icon: Histogram, color: '#E6A23C' },
  { value: '自定义', icon: DataAnalysis, color: '#909399' }
];

const paramTypeOptions = [
  { label: '文本', value: 'text' },
  { label: '数字', value: 'number' },
  { label: '日期', value: 'date' },
  { label: '日期范围', value: 'daterange' },
  { label: '下拉选择', value: 'select' }
];

// ==================== 计算属性 ====================

const filteredTemplates = computed(() => {
  let result = templates.value;

  // 分类过滤
  if (selectedCategory.value) {
    result = result.filter(t => t.category === selectedCategory.value);
  }

  // 关键词搜索
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.toLowerCase();
    result = result.filter(t =>
      t.name.toLowerCase().includes(keyword) ||
      t.description.toLowerCase().includes(keyword)
    );
  }

  return result;
});

const templatesByCategory = computed(() => {
  const grouped: Record<string, QueryTemplate[]> = {
    '财务分析': [],
    '销售分析': [],
    '生产分析': [],
    '自定义': []
  };

  filteredTemplates.value.forEach(tpl => {
    if (grouped[tpl.category]) {
      grouped[tpl.category].push(tpl);
    }
  });

  return grouped;
});

const dialogTitle = computed(() => {
  return dialogMode.value === 'create' ? '新增查询模板' : '编辑查询模板';
});

// ==================== 生命周期 ====================

onMounted(() => {
  loadTemplates();
});

// ==================== API 调用 ====================

async function loadTemplates() {
  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/smart-bi/query-templates`);
    if (response.success) {
      templates.value = (response.data || []).map((t: any) => ({
        ...t,
        parameters: typeof t.parameters === 'string' ? JSON.parse(t.parameters || '[]') : (t.parameters || [])
      }));
    } else {
      ElMessage.error(response.message || '加载模板失败');
    }
  } catch (error) {
    console.error('加载模板失败:', error);
    ElMessage.error('加载模板失败，请稍后重试');
  } finally {
    loading.value = false;
  }
}

async function createTemplate(template: QueryTemplate) {
  try {
    const response = await post(`/${factoryId.value}/smart-bi/query-templates`, template);
    if (response.success) {
      ElMessage.success('创建成功');
      await loadTemplates();
      return true;
    } else {
      ElMessage.error(response.message || '创建失败');
      return false;
    }
  } catch (error) {
    console.error('创建模板失败:', error);
    ElMessage.error('创建失败，请稍后重试');
    return false;
  }
}

async function updateTemplate(id: number, template: QueryTemplate) {
  try {
    const response = await put(`/${factoryId.value}/smart-bi/query-templates/${id}`, template);
    if (response.success) {
      ElMessage.success('更新成功');
      await loadTemplates();
      return true;
    } else {
      ElMessage.error(response.message || '更新失败');
      return false;
    }
  } catch (error) {
    console.error('更新模板失败:', error);
    ElMessage.error('更新失败，请稍后重试');
    return false;
  }
}

async function deleteTemplate(id: number) {
  try {
    const response = await del(`/${factoryId.value}/smart-bi/query-templates/${id}`);
    if (response.success) {
      ElMessage.success('删除成功');
      await loadTemplates();
    } else {
      ElMessage.error(response.message || '删除失败');
    }
  } catch (error) {
    console.error('删除模板失败:', error);
    ElMessage.error('删除失败，请稍后重试');
  }
}

// ==================== 事件处理 ====================

function handleCreate() {
  dialogMode.value = 'create';
  currentTemplate.value = {
    name: '',
    category: '财务分析',
    description: '',
    queryTemplate: '',
    parameters: []
  };
  dialogVisible.value = true;
}

function handleEdit(template: QueryTemplate) {
  dialogMode.value = 'edit';
  currentTemplate.value = { ...template };
  dialogVisible.value = true;
}

function handleDelete(template: QueryTemplate) {
  ElMessageBox.confirm(
    `确定要删除模板"${template.name}"吗？此操作不可恢复。`,
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    if (template.id) {
      await deleteTemplate(template.id);
    }
  }).catch(() => {
    // 用户取消
  });
}

function handleUseTemplate(template: QueryTemplate) {
  // 跳转到 AI 问答页面，带上模板查询
  router.push({
    path: '/smart-bi/query',
    query: {
      q: template.queryTemplate,
      templateId: template.id?.toString()
    }
  });
}

async function handleSubmit() {
  if (!currentTemplate.value.name.trim()) {
    ElMessage.warning('请输入模板名称');
    return;
  }
  if (!currentTemplate.value.queryTemplate.trim()) {
    ElMessage.warning('请输入查询模板');
    return;
  }

  const success = dialogMode.value === 'create'
    ? await createTemplate(currentTemplate.value)
    : await updateTemplate(currentTemplate.value.id!, currentTemplate.value);

  if (success) {
    dialogVisible.value = false;
  }
}

// 参数配置管理
function handleAddParam() {
  currentTemplate.value.parameters.push({
    name: '',
    type: 'text',
    label: '',
    options: []
  });
}

function handleRemoveParam(index: number) {
  currentTemplate.value.parameters.splice(index, 1);
}

// 分类图标和颜色
function getCategoryIcon(category: string) {
  const config = categoryOptions.find(c => c.value === category);
  return config ? config.icon : DataAnalysis;
}

function getCategoryColor(category: string) {
  const config = categoryOptions.find(c => c.value === category);
  return config ? config.color : '#909399';
}

// 格式化时间
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('zh-CN');
}
</script>

<template>
  <div class="query-template-page">
    <div class="page-header">
      <div class="header-left">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/smart-bi' }">Smart BI</el-breadcrumb-item>
          <el-breadcrumb-item>查询模板管理</el-breadcrumb-item>
        </el-breadcrumb>
        <h1>
          <el-icon><Tickets /></el-icon>
          查询模板管理
        </h1>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Plus" @click="handleCreate">新增模板</el-button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <div class="filter-bar">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索模板名称或描述"
        :prefix-icon="Search"
        clearable
        style="width: 300px"
      />
      <div class="category-filters">
        <el-button
          v-for="cat in categoryOptions"
          :key="cat.value"
          :type="selectedCategory === cat.value ? 'primary' : 'default'"
          size="small"
          round
          @click="selectedCategory = selectedCategory === cat.value ? '' : cat.value"
        >
          {{ cat.value }}
        </el-button>
        <el-button
          v-if="selectedCategory"
          size="small"
          text
          @click="selectedCategory = ''"
        >
          全部
        </el-button>
      </div>
    </div>

    <!-- 模板列表 -->
    <div v-loading="loading" class="template-content">
      <div v-for="(categoryName, key) in ['财务分析', '销售分析', '生产分析', '自定义']" :key="key">
        <div v-if="templatesByCategory[categoryName].length > 0" class="category-section">
          <div class="category-header">
            <el-icon :size="18" :color="getCategoryColor(categoryName)">
              <component :is="getCategoryIcon(categoryName)" />
            </el-icon>
            <span>{{ categoryName }}</span>
            <span class="count">({{ templatesByCategory[categoryName].length }})</span>
          </div>

          <div class="template-grid">
            <el-card
              v-for="tpl in templatesByCategory[categoryName]"
              :key="tpl.id"
              class="template-card"
              shadow="hover"
            >
              <div class="card-header">
                <div class="card-title">
                  <el-tag :color="getCategoryColor(tpl.category)" effect="light" size="small">
                    {{ tpl.category }}
                  </el-tag>
                  <span class="template-name">{{ tpl.name }}</span>
                </div>
                <div class="card-actions">
                  <el-button
                    v-if="tpl.category === '自定义'"
                    type="primary"
                    text
                    :icon="Edit"
                    @click="handleEdit(tpl)"
                  >
                    编辑
                  </el-button>
                  <el-button
                    v-if="tpl.category === '自定义'"
                    type="danger"
                    text
                    :icon="Delete"
                    @click="handleDelete(tpl)"
                  >
                    删除
                  </el-button>
                </div>
              </div>

              <div class="card-body">
                <p class="description">{{ tpl.description }}</p>
                <div class="query-preview">
                  <span class="label">查询模板:</span>
                  <div class="query-text">{{ tpl.queryTemplate }}</div>
                </div>
                <div v-if="tpl.parameters && tpl.parameters.length > 0" class="params-info">
                  <span class="label">参数: </span>
                  <el-tag
                    v-for="(param, idx) in tpl.parameters"
                    :key="idx"
                    size="small"
                    type="info"
                    effect="plain"
                  >
                    {{ param.label }}
                  </el-tag>
                </div>
              </div>

              <div class="card-footer">
                <span v-if="tpl.createdAt" class="meta">创建于 {{ formatDate(tpl.createdAt) }}</span>
                <el-button type="primary" size="small" @click="handleUseTemplate(tpl)">
                  使用模板
                </el-button>
              </div>
            </el-card>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <el-empty
        v-if="filteredTemplates.length === 0 && !loading"
        description="暂无模板"
      >
        <el-button type="primary" @click="handleCreate">创建第一个模板</el-button>
      </el-empty>
    </div>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="700px"
      :close-on-click-modal="false"
    >
      <el-form
        :model="currentTemplate"
        label-width="100px"
        label-position="left"
      >
        <el-form-item label="模板名称" required>
          <el-input
            v-model="currentTemplate.name"
            placeholder="例如：销售趋势分析"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="分类" required>
          <el-select v-model="currentTemplate.category" placeholder="请选择分类" style="width: 100%">
            <el-option
              v-for="cat in categoryOptions"
              :key="cat.value"
              :label="cat.value"
              :value="cat.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="currentTemplate.description"
            type="textarea"
            :rows="2"
            placeholder="简要描述这个模板的用途"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="查询模板" required>
          <el-input
            v-model="currentTemplate.queryTemplate"
            type="textarea"
            :rows="4"
            placeholder="例如：分析{startDate}到{endDate}期间，{product}产品的销售额变化趋势"
          />
          <div class="form-tip">
            提示：使用 {参数名} 表示可替换的参数，例如 {startDate}、{endDate}、{product}
          </div>
        </el-form-item>

        <el-form-item label="参数配置">
          <div class="param-list">
            <div v-for="(param, index) in currentTemplate.parameters" :key="index" class="param-item">
              <el-input
                v-model="param.name"
                placeholder="参数名"
                style="width: 120px"
              />
              <el-select v-model="param.type" placeholder="类型" style="width: 120px">
                <el-option
                  v-for="type in paramTypeOptions"
                  :key="type.value"
                  :label="type.label"
                  :value="type.value"
                />
              </el-select>
              <el-input
                v-model="param.label"
                placeholder="显示标签"
                style="width: 150px"
              />
              <el-input
                v-if="param.type === 'select'"
                v-model="param.options"
                placeholder="选项(逗号分隔)"
                style="flex: 1"
              />
              <el-button
                type="danger"
                text
                :icon="Delete"
                @click="handleRemoveParam(index)"
              />
            </div>
            <el-button
              type="primary"
              text
              :icon="Plus"
              @click="handleAddParam"
            >
              添加参数
            </el-button>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.query-template-page {
  padding: 20px;
  min-height: calc(100vh - 144px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;

  .header-left {
    h1 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 12px 0 0;
      font-size: 20px;
      font-weight: 600;

      .el-icon {
        color: #409EFF;
      }
    }
  }
}

.filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  align-items: center;

  .category-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
}

.template-content {
  min-height: 400px;
}

.category-section {
  margin-bottom: 32px;

  .category-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    font-size: 16px;
    font-weight: 600;
    color: #303133;

    .count {
      font-size: 14px;
      color: #909399;
      font-weight: 400;
    }
  }
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.template-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;

    .card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;

      .template-name {
        font-size: 16px;
        font-weight: 600;
        color: #303133;
      }
    }

    .card-actions {
      display: flex;
      gap: 4px;
    }
  }

  .card-body {
    .description {
      margin: 0 0 12px;
      font-size: 13px;
      color: #606266;
      line-height: 1.6;
    }

    .query-preview {
      margin-bottom: 12px;
      padding: 8px 12px;
      background: #f5f7fa;
      border-radius: 6px;

      .label {
        font-size: 12px;
        color: #909399;
        display: block;
        margin-bottom: 4px;
      }

      .query-text {
        font-size: 13px;
        color: #303133;
        line-height: 1.5;
        font-family: 'Consolas', 'Monaco', monospace;
      }
    }

    .params-info {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;

      .label {
        font-size: 12px;
        color: #909399;
      }
    }
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid #ebeef5;

    .meta {
      font-size: 12px;
      color: #909399;
    }
  }
}

// 对话框样式
.form-tip {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.param-list {
  width: 100%;

  .param-item {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;

    .el-input,
    .el-select {
      flex-shrink: 0;
    }
  }
}

// 响应式
@media (max-width: 768px) {
  .template-grid {
    grid-template-columns: 1fr;
  }

  .filter-bar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
