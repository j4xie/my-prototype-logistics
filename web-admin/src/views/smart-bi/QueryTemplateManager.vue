<script setup lang="ts">
/**
 * SmartBI 查询模板管理
 * 支持查询模板的增删改查，帮助用户快速复用常用的分析查询
 *
 * Features:
 * - 1A: Hover Preview on Template Cards (el-popover with query details)
 * - 1B: One-Click Execute with Inline Results (chatAnalysis integration)
 * - 1C: Parameterized Variable Form (dynamic el-dialog with type-mapped fields)
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { get, post, put, del } from '@/api/request';
import { chatAnalysis } from '@/api/smartbi';
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
  DataAnalysis,
  VideoPlay,
  Loading,
  ChatDotRound,
  ArrowDown,
  ArrowUp
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

interface ExecutionResult {
  loading: boolean;
  result?: {
    success: boolean;
    answer?: string;
    error?: string;
  };
  error?: string;
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

// Feature 1B: Execution state
const executionResults = reactive(new Map<number, ExecutionResult>());
const expandedTemplateId = ref<number | null>(null);

// Feature 1C: Parameterized Variable Form state
const paramDialogVisible = ref(false);
const paramDialogAction = ref<'use' | 'execute'>('use');
const paramDialogTemplate = ref<QueryTemplate | null>(null);
const paramValues = reactive<Record<string, unknown>>({});

// 分类配置
const categoryOptions = [
  { value: '财务分析', icon: Money, color: '#67C23A', tagType: 'success' as const },
  { value: '销售分析', icon: TrendCharts, color: '#1B65A8', tagType: 'primary' as const },
  { value: '生产分析', icon: Histogram, color: '#E6A23C', tagType: 'warning' as const },
  { value: '自定义', icon: DataAnalysis, color: '#909399', tagType: 'info' as const }
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

// ==================== Feature 1A: Hover Preview Helpers ====================

/** Map category to expected output description for popover preview */
function getExpectedOutput(category: string): string {
  const outputMap: Record<string, string> = {
    '财务分析': '趋势图表 + KPI 卡片 + AI 分析摘要',
    '销售分析': '销售对比图 + 排名表格 + 增长趋势',
    '生产分析': '产能利用率图 + 良品率 KPI + 异常预警',
    '自定义': '根据查询内容自动生成图表与分析'
  };
  return outputMap[category] || '数据分析结果';
}

/** Get human-readable param type label */
function getParamTypeLabel(type: string): string {
  const found = paramTypeOptions.find(t => t.value === type);
  return found ? found.label : type;
}

// ==================== Feature 1C: Parameterized Variable Helpers ====================

/** Check whether a template has parameters that need filling */
function templateHasParams(template: QueryTemplate): boolean {
  return template.parameters && template.parameters.length > 0;
}

/** Initialize default values for template parameters */
function initParamDefaults(params: TemplateParam[]) {
  // Clear previous values
  Object.keys(paramValues).forEach(k => delete paramValues[k]);

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  for (const param of params) {
    switch (param.type) {
      case 'date':
        paramValues[param.name] = today;
        break;
      case 'daterange':
        paramValues[param.name] = [firstOfMonth, today];
        break;
      case 'number':
        paramValues[param.name] = 0;
        break;
      case 'select':
        paramValues[param.name] = param.options?.[0] || '';
        break;
      default:
        paramValues[param.name] = '';
        break;
    }
  }
}

/** Format a date value for query substitution */
function formatParamValue(value: unknown, type: string): string {
  if (value == null) return '';
  if (type === 'date' && value instanceof Date) {
    return value.toLocaleDateString('zh-CN');
  }
  if (type === 'daterange' && Array.isArray(value)) {
    const [start, end] = value;
    const fmt = (d: Date | string) => d instanceof Date ? d.toLocaleDateString('zh-CN') : String(d);
    return `${fmt(start)}到${fmt(end)}`;
  }
  return String(value);
}

/** Replace {paramName} placeholders with actual values */
function resolveQuery(template: QueryTemplate, values: Record<string, unknown>): string {
  let query = template.queryTemplate;
  for (const param of template.parameters) {
    const placeholder = `{${param.name}}`;
    const replacement = formatParamValue(values[param.name], param.type);
    query = query.split(placeholder).join(replacement);
  }
  return query;
}

/** Open the param dialog before use/execute if template has params */
function openParamDialog(template: QueryTemplate, action: 'use' | 'execute') {
  paramDialogTemplate.value = template;
  paramDialogAction.value = action;
  initParamDefaults(template.parameters);
  paramDialogVisible.value = true;
}

/** Handle confirm from param dialog */
function handleParamDialogConfirm(openInChat: boolean) {
  const template = paramDialogTemplate.value;
  if (!template) return;

  const resolvedQuery = resolveQuery(template, paramValues);
  paramDialogVisible.value = false;

  if (openInChat || paramDialogAction.value === 'use') {
    // Navigate to AI query page with resolved query
    router.push({
      path: '/smart-bi/query',
      query: {
        q: resolvedQuery,
        templateId: template.id?.toString()
      }
    });
  } else {
    // Execute inline
    executeTemplateQuery(template, resolvedQuery);
  }
}

// ==================== Feature 1B: One-Click Execute ====================

/** Execute a template query inline via chatAnalysis API */
async function executeTemplateQuery(template: QueryTemplate, resolvedQuery: string) {
  const id = template.id;
  if (id == null) return;

  // Set loading state and expand result panel
  executionResults.set(id, { loading: true });
  expandedTemplateId.value = id;

  try {
    const result = await chatAnalysis({
      query: resolvedQuery,
    });

    executionResults.set(id, {
      loading: false,
      result: {
        success: result.success !== false,
        answer: result.answer || (result.error ? undefined : '分析完成，暂无文本结果。'),
        error: result.error
      }
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '执行查询失败';
    executionResults.set(id, {
      loading: false,
      error: errorMsg
    });
  }
}

/** Handle "一键执行" button click */
function handleExecuteTemplate(template: QueryTemplate) {
  if (templateHasParams(template)) {
    openParamDialog(template, 'execute');
  } else {
    executeTemplateQuery(template, template.queryTemplate);
  }
}

/** Toggle expanded result panel */
function toggleExpand(id: number) {
  expandedTemplateId.value = expandedTemplateId.value === id ? null : id;
}

/** Get execution result for a template */
function getExecutionResult(id: number | undefined): ExecutionResult | undefined {
  if (id == null) return undefined;
  return executionResults.get(id);
}

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
      templates.value = (response.data || []).map((t: Record<string, unknown>) => ({
        ...t,
        parameters: typeof t.parameters === 'string' ? JSON.parse((t.parameters as string) || '[]') : (t.parameters || [])
      }));
    } else {
      ElMessage.error((response.message as string) || '加载模板失败');
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
  if (templateHasParams(template)) {
    openParamDialog(template, 'use');
  } else {
    // 跳转到 AI 问答页面，带上模板查询
    router.push({
      path: '/smart-bi/query',
      query: {
        q: template.queryTemplate,
        templateId: template.id?.toString()
      }
    });
  }
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

function getCategoryTagType(category: string): '' | 'success' | 'warning' | 'info' | 'danger' {
  const config = categoryOptions.find(c => c.value === category);
  return config ? config.tagType : 'info';
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
                <!-- Feature 1A: Hover Preview via Popover -->
                <el-popover
                  trigger="hover"
                  :show-after="300"
                  :width="420"
                  placement="top-start"
                >
                  <template #reference>
                    <div class="card-title">
                      <el-tag :type="getCategoryTagType(tpl.category)" effect="light" size="small">
                        {{ tpl.category }}
                      </el-tag>
                      <span class="template-name">{{ tpl.name }}</span>
                    </div>
                  </template>
                  <div class="preview-popover">
                    <div class="preview-section">
                      <div class="preview-label">查询模板</div>
                      <pre class="preview-query">{{ tpl.queryTemplate }}</pre>
                    </div>
                    <div v-if="tpl.parameters && tpl.parameters.length > 0" class="preview-section">
                      <div class="preview-label">参数列表</div>
                      <div class="preview-params">
                        <div v-for="(param, idx) in tpl.parameters" :key="idx" class="preview-param-item">
                          <el-tag size="small" effect="plain" type="info">{{ getParamTypeLabel(param.type) }}</el-tag>
                          <span class="preview-param-name">{{ param.label || param.name }}</span>
                          <span v-if="param.options && param.options.length > 0" class="preview-param-options">
                            ({{ param.options.join(' / ') }})
                          </span>
                        </div>
                      </div>
                    </div>
                    <div class="preview-section">
                      <div class="preview-label">预期输出</div>
                      <div class="preview-output">{{ getExpectedOutput(tpl.category) }}</div>
                    </div>
                  </div>
                </el-popover>

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
                <div class="footer-actions">
                  <!-- Feature 1B: One-Click Execute button -->
                  <el-button
                    type="success"
                    size="small"
                    :icon="VideoPlay"
                    :loading="getExecutionResult(tpl.id)?.loading"
                    @click="handleExecuteTemplate(tpl)"
                  >
                    一键执行
                  </el-button>
                  <el-button type="primary" size="small" @click="handleUseTemplate(tpl)">
                    使用模板
                  </el-button>
                </div>
              </div>

              <!-- Feature 1B: Inline Execution Results Panel -->
              <el-collapse-transition>
                <div v-if="tpl.id != null && expandedTemplateId === tpl.id && getExecutionResult(tpl.id)" class="execution-panel">
                  <div class="execution-panel-header">
                    <span class="execution-panel-title">
                      <el-icon><ChatDotRound /></el-icon>
                      执行结果
                    </span>
                    <el-button text size="small" @click="toggleExpand(tpl.id!)">
                      <el-icon><ArrowUp /></el-icon>
                      收起
                    </el-button>
                  </div>

                  <!-- Loading state -->
                  <div v-if="getExecutionResult(tpl.id)?.loading" class="execution-loading">
                    <el-icon class="is-loading"><Loading /></el-icon>
                    <span>正在分析中，请稍候...</span>
                  </div>

                  <!-- Error state -->
                  <div v-else-if="getExecutionResult(tpl.id)?.error || getExecutionResult(tpl.id)?.result?.error" class="execution-error">
                    <el-alert
                      type="error"
                      :title="getExecutionResult(tpl.id)?.error || getExecutionResult(tpl.id)?.result?.error || '执行失败'"
                      :closable="false"
                      show-icon
                    />
                  </div>

                  <!-- Success state -->
                  <div v-else-if="getExecutionResult(tpl.id)?.result?.success" class="execution-result">
                    <div class="result-answer">{{ getExecutionResult(tpl.id)?.result?.answer }}</div>
                    <div class="result-actions">
                      <el-button type="primary" text size="small" @click="handleUseTemplate(tpl)">
                        在 AI 问答中查看完整结果
                      </el-button>
                    </div>
                  </div>
                </div>
              </el-collapse-transition>

              <!-- Expand indicator when results exist but panel is collapsed -->
              <div
                v-if="tpl.id != null && expandedTemplateId !== tpl.id && getExecutionResult(tpl.id) && !getExecutionResult(tpl.id)?.loading"
                class="expand-hint"
                @click="toggleExpand(tpl.id!)"
              >
                <el-icon><ArrowDown /></el-icon>
                <span>展开执行结果</span>
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
                :model-value="param.options?.join(',') ?? ''"
                placeholder="选项(逗号分隔)"
                style="flex: 1"
                @update:model-value="(val: string) => param.options = val ? val.split(',').map(s => s.trim()) : []"
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

    <!-- Feature 1C: Parameterized Variable Form Dialog -->
    <el-dialog
      v-model="paramDialogVisible"
      :title="`${paramDialogTemplate?.name} - 填写参数`"
      width="560px"
      :close-on-click-modal="false"
    >
      <div v-if="paramDialogTemplate" class="param-form-dialog">
        <div class="param-form-hint">
          请填写以下参数，系统将自动替换模板中的占位符后执行查询。
        </div>
        <el-form label-width="120px" label-position="left">
          <el-form-item
            v-for="param in paramDialogTemplate.parameters"
            :key="param.name"
            :label="param.label || param.name"
          >
            <!-- text -->
            <el-input
              v-if="param.type === 'text'"
              v-model="paramValues[param.name] as string"
              :placeholder="`请输入${param.label || param.name}`"
              clearable
            />
            <!-- number -->
            <el-input-number
              v-else-if="param.type === 'number'"
              v-model="paramValues[param.name] as number"
              :placeholder="`请输入${param.label || param.name}`"
              controls-position="right"
              style="width: 100%"
            />
            <!-- date -->
            <el-date-picker
              v-else-if="param.type === 'date'"
              v-model="paramValues[param.name] as Date"
              type="date"
              :placeholder="`选择${param.label || param.name}`"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
            <!-- daterange -->
            <el-date-picker
              v-else-if="param.type === 'daterange'"
              v-model="paramValues[param.name] as [Date, Date]"
              type="daterange"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
            <!-- select -->
            <el-select
              v-else-if="param.type === 'select'"
              v-model="paramValues[param.name] as string"
              :placeholder="`选择${param.label || param.name}`"
              style="width: 100%"
            >
              <el-option
                v-for="opt in (param.options || [])"
                :key="opt"
                :label="opt"
                :value="opt"
              />
            </el-select>
          </el-form-item>
        </el-form>

        <!-- Preview of resolved query -->
        <div class="resolved-query-preview">
          <div class="preview-label">预览查询</div>
          <pre class="preview-query">{{ resolveQuery(paramDialogTemplate, paramValues) }}</pre>
        </div>
      </div>

      <template #footer>
        <el-button @click="paramDialogVisible = false">取消</el-button>
        <el-button @click="handleParamDialogConfirm(true)">
          <el-icon><ChatDotRound /></el-icon>
          在 AI 问答中打开
        </el-button>
        <el-button type="primary" @click="handleParamDialogConfirm(false)">
          <el-icon><VideoPlay /></el-icon>
          执行查询
        </el-button>
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
        color: var(--el-color-primary, #1B65A8);
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
    color: var(--el-text-color-primary, #303133);

    .count {
      font-size: 14px;
      color: var(--el-text-color-secondary, #909399);
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
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-3px);
  }

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
      cursor: default;

      .template-name {
        font-size: 16px;
        font-weight: 600;
        color: var(--el-text-color-primary, #303133);
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
      color: var(--el-text-color-regular, #606266);
      line-height: 1.6;
    }

    .query-preview {
      margin-bottom: 12px;
      padding: 8px 12px;
      background: #f5f7fa;
      border-radius: 6px;

      .label {
        font-size: 12px;
        color: var(--el-text-color-secondary, #909399);
        display: block;
        margin-bottom: 4px;
      }

      .query-text {
        font-size: 13px;
        color: var(--el-text-color-primary, #303133);
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
        color: var(--el-text-color-secondary, #909399);
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
      color: var(--el-text-color-secondary, #909399);
    }

    .footer-actions {
      display: flex;
      gap: 8px;
    }
  }
}

// Feature 1B: Execution Results Panel
.execution-panel {
  margin-top: 16px;
  padding: 12px;
  background: #f0f7ff;
  border-radius: 8px;
  border: 1px solid #d9ecff;

  .execution-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    .execution-panel-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--el-color-primary, #1B65A8);
    }
  }

  .execution-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 0;
    justify-content: center;
    font-size: 13px;
    color: var(--el-text-color-secondary, #909399);

    .el-icon {
      font-size: 18px;
      color: var(--el-color-primary, #1B65A8);
    }
  }

  .execution-error {
    margin: 4px 0;
  }

  .execution-result {
    .result-answer {
      font-size: 13px;
      line-height: 1.8;
      color: var(--el-text-color-primary, #303133);
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 300px;
      overflow-y: auto;
      padding: 4px 0;
    }

    .result-actions {
      margin-top: 8px;
      text-align: right;
    }
  }
}

.expand-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 8px;
  padding: 6px 0;
  cursor: pointer;
  font-size: 12px;
  color: var(--el-color-primary, #1B65A8);
  border-top: 1px dashed #dcdfe6;
  transition: color 0.2s;

  &:hover {
    color: var(--el-color-primary-light-3, #409eff);
  }
}

// Feature 1A: Hover Preview Popover
.preview-popover {
  .preview-section {
    margin-bottom: 12px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .preview-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary, #909399);
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .preview-query {
    font-size: 13px;
    font-family: 'Consolas', 'Monaco', monospace;
    background: #f5f7fa;
    padding: 10px 12px;
    border-radius: 6px;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    line-height: 1.6;
    color: var(--el-text-color-primary, #303133);
    max-height: 120px;
    overflow-y: auto;
  }

  .preview-params {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .preview-param-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;

      .preview-param-name {
        color: var(--el-text-color-primary, #303133);
        font-weight: 500;
      }

      .preview-param-options {
        font-size: 12px;
        color: var(--el-text-color-secondary, #909399);
      }
    }
  }

  .preview-output {
    font-size: 13px;
    color: var(--el-color-success, #67C23A);
    font-weight: 500;
    padding: 6px 10px;
    background: #f0f9eb;
    border-radius: 4px;
  }
}

// Feature 1C: Param Form Dialog
.param-form-dialog {
  .param-form-hint {
    font-size: 13px;
    color: var(--el-text-color-secondary, #909399);
    margin-bottom: 20px;
    padding: 10px 12px;
    background: #fdf6ec;
    border-radius: 6px;
    border-left: 3px solid #e6a23c;
  }

  .resolved-query-preview {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #ebeef5;

    .preview-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--el-text-color-secondary, #909399);
      margin-bottom: 6px;
    }

    .preview-query {
      font-size: 13px;
      font-family: 'Consolas', 'Monaco', monospace;
      background: #f5f7fa;
      padding: 10px 12px;
      border-radius: 6px;
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
      line-height: 1.6;
      color: var(--el-text-color-primary, #303133);
    }
  }
}

// 对话框样式
.form-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
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
