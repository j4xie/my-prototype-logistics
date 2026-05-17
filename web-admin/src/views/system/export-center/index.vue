<template>
  <div class="export-center-page">
    <div class="page-header">
      <h2>导出中心</h2>
      <el-button type="primary" :icon="Plus" @click="openCreate">新建规则</el-button>
    </div>

    <!-- Filter row -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" @submit.prevent>
        <el-form-item label="模块">
          <el-input v-model="moduleCodeFilter" placeholder="CUSTOMER / MATERIAL ..." clearable style="width: 200px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadRules">查询</el-button>
          <el-button @click="moduleCodeFilter = ''; loadRules()">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Rules table -->
    <el-card shadow="never" style="margin-top: 12px">
      <template #header><strong>规则列表</strong></template>
      <el-table :data="rules" stripe v-loading="loadingRules" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="ruleName" label="规则名" min-width="180" />
        <el-table-column prop="moduleCode" label="模块" width="140" />
        <el-table-column prop="targetEntity" label="目标 Entity" min-width="220">
          <template #default="{ row }">
            <code class="muted">{{ shortClass(row.targetEntity) }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="format" label="格式" width="80" />
        <el-table-column label="模式" width="90">
          <template #default="{ row }">
            <el-tag :type="row.isAsync ? 'warning' : ''" size="small">
              {{ row.isAsync ? 'ASYNC' : 'SYNC' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <el-button-group>
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="onRun(row)">运行</el-button>
              <el-button size="small" @click="openEdit(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="onDelete(row)">删除</el-button>
            </template>
          </el-button-group>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="rulePageNum"
        v-model:page-size="rulePageSize"
        :total="ruleTotal"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        style="margin-top: 12px; justify-content: flex-end"
        @current-change="loadRules"
        @size-change="loadRules"
      />
    </el-card>

    <!-- Recent jobs -->
    <el-card shadow="never" style="margin-top: 12px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <strong>最近异步任务</strong>
          <el-button :icon="Refresh" link @click="loadJobs">刷新</el-button>
        </div>
      </template>
      <el-table :data="jobs" stripe v-loading="loadingJobs" border size="small">
        <el-table-column prop="id" label="Job ID" width="280">
          <template #default="{ row }"><code>{{ row.id }}</code></template>
        </el-table-column>
        <el-table-column prop="ruleId" label="规则 ID" width="90" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="jobStatusType(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="rowCount" label="行数" width="100" />
        <el-table-column label="文件大小" width="120">
          <template #default="{ row }">{{ fmtSize(row.fileSizeBytes) }}</template>
        </el-table-column>
        <el-table-column prop="completedAt" label="完成时间" width="170">
          <template #default="{ row }">{{ formatTime(row.completedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'SUCCESS'"
              size="small"
              type="primary"
              @click="onDownload(row)"
            >下载</el-button>
            <span v-else-if="row.status === 'FAILED'" class="muted" :title="row.errorMessage">失败</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Rule editor dialog -->
    <el-dialog v-model="editorOpen" :title="editorTitle" width="720px" destroy-on-close>
      <el-form :model="form" label-width="120px" :rules="formRules" ref="formRef">
        <el-form-item label="规则名" prop="ruleName">
          <el-input v-model="form.ruleName" placeholder="客户列表导出" />
        </el-form-item>
        <el-form-item label="模块代码" prop="moduleCode">
          <el-input v-model="form.moduleCode" placeholder="CUSTOMER" />
        </el-form-item>
        <el-form-item label="目标 Entity" prop="targetEntity">
          <el-input v-model="form.targetEntity" placeholder="com.cretas.aims.entity.Customer">
            <template #append>
              <el-tooltip content="JPA Entity 全限定类名. 必须含 factoryId 字段.">
                <el-icon><QuestionFilled /></el-icon>
              </el-tooltip>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="格式">
          <el-radio-group v-model="form.format">
            <el-radio value="XLSX">XLSX</el-radio>
            <el-radio value="CSV">CSV</el-radio>
            <el-radio value="PDF" disabled>PDF (TBD)</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="异步模式">
          <el-switch v-model="form.isAsync" />
          <span class="muted" style="margin-left: 8px">异步: 入 queue + 文件落盘 + 后续下载</span>
        </el-form-item>
        <el-form-item label="列定义 (JSON)" prop="columnsJson">
          <el-input
            v-model="form.columnsJson"
            type="textarea"
            :rows="6"
            placeholder='[{"field":"customerCode","header":"客户编码","width":15},{"field":"name","header":"名称","width":20}]'
          />
        </el-form-item>
        <el-form-item label="过滤表达式">
          <el-input
            v-model="form.filterExpression"
            type="textarea"
            :rows="2"
            placeholder="可选. SpEL on rowMap, e.g. #row['status'] == 'ACTIVE'"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">{{ form.id ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>

    <!-- Run dialog (runtime params input) -->
    <el-dialog v-model="runOpen" title="运行导出规则" width="560px" destroy-on-close>
      <el-alert :title="`即将运行: ${runTarget?.ruleName}`" type="info" :closable="false" style="margin-bottom: 12px" />
      <el-form label-width="120px">
        <el-form-item label="参数 (JSON)">
          <el-input
            v-model="runtimeParamsJson"
            type="textarea"
            :rows="4"
            placeholder='可选. e.g. {"startDate":"2026-01-01","endDate":"2026-12-31"}'
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="runOpen = false">取消</el-button>
        <el-button type="primary" :loading="running" @click="confirmRun">运行</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { Plus, Refresh, QuestionFilled } from '@element-plus/icons-vue';
import { useAuthStore } from '@/store/modules/auth';
import { exportRuleApi, type ExportRule, type ExportJob } from '@/api/dataCenter';

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

const moduleCodeFilter = ref('');
const rules = ref<ExportRule[]>([]);
const ruleTotal = ref(0);
const rulePageNum = ref(1);
const rulePageSize = ref(20);
const loadingRules = ref(false);

const jobs = ref<ExportJob[]>([]);
const loadingJobs = ref(false);

const editorOpen = ref(false);
const editorTitle = ref('');
const saving = ref(false);
const formRef = ref<FormInstance>();
const form = ref({
  id: undefined as number | undefined,
  ruleName: '',
  moduleCode: '',
  targetEntity: '',
  format: 'XLSX' as 'XLSX' | 'CSV' | 'PDF',
  isAsync: false,
  columnsJson: '',
  filterExpression: '',
  description: '',
});
const formRules = {
  ruleName: [{ required: true, message: '请填写规则名', trigger: 'blur' }],
  moduleCode: [{ required: true, message: '请填写模块代码', trigger: 'blur' }],
  targetEntity: [{ required: true, message: '请填写 Entity 类名', trigger: 'blur' }],
  columnsJson: [{ required: true, message: '请填写列定义', trigger: 'blur' }],
};

const runOpen = ref(false);
const runTarget = ref<ExportRule | null>(null);
const runtimeParamsJson = ref('');
const running = ref(false);

async function loadRules() {
  if (!factoryId.value) return;
  loadingRules.value = true;
  try {
    const resp = await exportRuleApi.list(
      factoryId.value,
      moduleCodeFilter.value || undefined,
      rulePageNum.value - 1,
      rulePageSize.value
    );
    rules.value = resp.data?.content || [];
    ruleTotal.value = resp.data?.totalElements || 0;
  } catch (e) {
    console.error('[ExportCenter] loadRules', e);
    ElMessage.error('加载规则失败');
  } finally {
    loadingRules.value = false;
  }
}

async function loadJobs() {
  if (!factoryId.value) return;
  loadingJobs.value = true;
  try {
    const resp = await exportRuleApi.listJobs(factoryId.value, undefined, 0, 20);
    jobs.value = resp.data?.content || [];
  } catch (e) {
    console.error('[ExportCenter] loadJobs', e);
  } finally {
    loadingJobs.value = false;
  }
}

function openCreate() {
  form.value = {
    id: undefined,
    ruleName: '',
    moduleCode: '',
    targetEntity: '',
    format: 'XLSX',
    isAsync: false,
    columnsJson: '',
    filterExpression: '',
    description: '',
  };
  editorTitle.value = '新建导出规则';
  editorOpen.value = true;
}

function openEdit(rule: ExportRule) {
  form.value = {
    id: rule.id,
    ruleName: rule.ruleName,
    moduleCode: rule.moduleCode,
    targetEntity: rule.targetEntity,
    format: rule.format,
    isAsync: rule.isAsync,
    columnsJson: JSON.stringify(rule.columns, null, 2),
    filterExpression: rule.filterExpression || '',
    description: rule.description || '',
  };
  editorTitle.value = `编辑规则 #${rule.id}`;
  editorOpen.value = true;
}

async function onSave() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;
  let columns: Array<{ field: string; header: string; width?: number }>;
  try {
    columns = JSON.parse(form.value.columnsJson);
    if (!Array.isArray(columns) || columns.length === 0) {
      throw new Error('需要至少一列');
    }
  } catch (e) {
    ElMessage.error('列定义 JSON 解析失败: ' + (e as Error).message);
    return;
  }
  saving.value = true;
  try {
    const payload = {
      factoryId: factoryId.value,
      ruleName: form.value.ruleName,
      moduleCode: form.value.moduleCode,
      targetEntity: form.value.targetEntity,
      format: form.value.format,
      isAsync: form.value.isAsync,
      rowThreshold: 10000,
      columns,
      filterExpression: form.value.filterExpression || undefined,
      description: form.value.description || undefined,
    };
    if (form.value.id) {
      await exportRuleApi.update(factoryId.value, form.value.id, payload);
      ElMessage.success('规则已更新');
    } else {
      await exportRuleApi.create(factoryId.value, payload);
      ElMessage.success('规则已创建');
    }
    editorOpen.value = false;
    loadRules();
  } catch (e) {
    console.error('[ExportCenter] save', e);
  } finally {
    saving.value = false;
  }
}

async function onDelete(rule: ExportRule) {
  try {
    await ElMessageBox.confirm(`确定删除规则 "${rule.ruleName}"?`, '删除确认', { type: 'warning' });
  } catch {
    return;
  }
  try {
    await exportRuleApi.delete(factoryId.value, rule.id!);
    ElMessage.success('规则已删除');
    loadRules();
  } catch (e) {
    console.error('[ExportCenter] delete', e);
  }
}

function onRun(rule: ExportRule) {
  runTarget.value = rule;
  runtimeParamsJson.value = '';
  runOpen.value = true;
}

async function confirmRun() {
  if (!runTarget.value) return;
  let runtimeParams: Record<string, unknown> | undefined;
  if (runtimeParamsJson.value.trim()) {
    try {
      runtimeParams = JSON.parse(runtimeParamsJson.value);
    } catch (e) {
      ElMessage.error('参数 JSON 解析失败: ' + (e as Error).message);
      return;
    }
  }
  running.value = true;
  try {
    const resp = await exportRuleApi.run(factoryId.value, runTarget.value.id!, runtimeParams);
    const result = resp.data;
    if (result?.mode === 'SYNC' && result.fileBase64) {
      // Sync 模式: 直接 download base64
      const blob = base64ToBlob(result.fileBase64);
      triggerDownload(blob, result.filename || 'export.xlsx');
      ElMessage.success(`导出完成 (${result.rowCount} 行)`);
    } else if (result?.mode === 'ASYNC') {
      ElMessage.info(`已入队. Job ID: ${result.jobId}. 在下方"最近异步任务"查看进度.`);
      loadJobs();
    }
    runOpen.value = false;
  } catch (e) {
    console.error('[ExportCenter] run', e);
  } finally {
    running.value = false;
  }
}

function onDownload(job: ExportJob) {
  const url = exportRuleApi.downloadUrl(factoryId.value, job.id);
  // 用 window.open 让 Bearer 由 interceptor 注入 — 但 <a href> 不会带 Authorization header.
  // 实际生产应该用 axios + responseType blob; 这里 v1 简化用 window.open.
  // TODO: switch to axios blob fetch for proper auth header.
  window.open(url, '_blank');
}

function base64ToBlob(b64: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'application/octet-stream' });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function jobStatusType(s: string): 'success' | 'warning' | 'danger' | 'info' | '' {
  switch (s) {
    case 'SUCCESS': return 'success';
    case 'RUNNING': return 'warning';
    case 'FAILED': return 'danger';
    default: return 'info';
  }
}

function shortClass(fqn: string): string {
  if (!fqn) return '';
  const dot = fqn.lastIndexOf('.');
  return dot < 0 ? fqn : fqn.substring(dot + 1);
}

function fmtSize(n: number | null): string {
  if (n == null) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatTime(s: string | null): string {
  if (!s) return '—';
  return s.replace('T', ' ').replace(/\.\d+$/, '');
}

onMounted(() => {
  loadRules();
  loadJobs();
});
</script>

<style scoped>
.export-center-page { padding: 16px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.page-header h2 { margin: 0; font-size: 18px; }
.filter-card :deep(.el-form-item) { margin-bottom: 0; }
.muted { color: #909399; font-size: 12px; }
</style>
