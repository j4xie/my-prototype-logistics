<script setup lang="ts">
/**
 * AI 配额规则管理 (ai_quota_configs)
 * audit P1 fix: 后端 /ai-quota-configs 全 CRUD 齐全, 前端零页面.
 * 控制各类问题的 AI 调用配额 (问题类型 → 每周限额 / 单次成本), 之前只能 SQL 改.
 */
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, put, del } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Edit, Delete as DeleteIcon, Refresh } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('system'));

const loading = ref(false);
const tableData = ref<Record<string, unknown>[]>([]);

onMounted(loadData);

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await get(`/${factoryId.value}/ai-quota-configs`);
    if (res.success && res.data) {
      // 后端返回 { factoryConfigs, globalConfigs, total }, factory 配置 + 平台全局兜底
      const d = res.data;
      const factory = Array.isArray(d.factoryConfigs) ? d.factoryConfigs : [];
      const global = Array.isArray(d.globalConfigs) ? d.globalConfigs : [];
      // 兼容多种格式: factoryConfigs / content / 直接 array
      tableData.value = factory.length || global.length
        ? [...factory, ...global.map((g: Record<string, unknown>) => ({ ...g, _isGlobal: true }))]
        : (Array.isArray(d) ? d : (d.content || []));
    }
  } catch (e) { console.error(e); }
  finally { loading.value = false; }
}

const dialogVisible = ref(false);
const editingId = ref<string | null>(null);
const form = ref({
  questionType: '',
  quotaCost: 1,
  weeklyLimit: 100,
  description: '',
  priority: 0,
  enabled: true,
});
const dialogTitle = computed(() => (editingId.value ? '编辑配额规则' : '新建配额规则'));
const submitting = ref(false);

function openCreate() {
  editingId.value = null;
  form.value = { questionType: '', quotaCost: 1, weeklyLimit: 100, description: '', priority: 0, enabled: true };
  dialogVisible.value = true;
}

function openEdit(row: Record<string, unknown>) {
  editingId.value = String(row.id || '');
  form.value = {
    questionType: String(row.questionType || ''),
    quotaCost: Number(row.quotaCost || 1),
    weeklyLimit: Number(row.weeklyLimit || 100),
    description: String(row.description || ''),
    priority: Number(row.priority || 0),
    enabled: row.enabled !== false,
  };
  dialogVisible.value = true;
}

async function handleSave() {
  if (!form.value.questionType) return ElMessage.warning('请填写问题类型');
  submitting.value = true;
  try {
    if (editingId.value) {
      const res = await put(`/${factoryId.value}/ai-quota-configs/${editingId.value}`, form.value);
      if (res.success) ElMessage.success('更新成功');
    } else {
      const res = await post(`/${factoryId.value}/ai-quota-configs`, form.value);
      if (res.success) ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    loadData();
  } catch (e) { console.error(e); }
  finally { submitting.value = false; }
}

async function handleDelete(row: Record<string, unknown>) {
  try {
    await ElMessageBox.confirm(`确定删除配额规则「${row.questionType}」?`, '删除确认', { type: 'warning' });
    const res = await del(`/${factoryId.value}/ai-quota-configs/${row.id}`);
    if (res.success) { ElMessage.success('删除成功'); loadData(); }
  } catch { /* cancel */ }
}
</script>

<template>
  <div class="page-wrapper">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">AI 配额规则</span>
            <span class="data-count">控制各类问题的每周调用配额 / 单次成本</span>
          </div>
          <div class="header-right">
            <el-button :icon="Refresh" @click="loadData">刷新</el-button>
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="openCreate">新建配额规则</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="tableData" stripe>
        <el-table-column prop="questionType" label="问题类型" width="200" />
        <el-table-column prop="quotaCost" label="单次成本" width="100" align="center" />
        <el-table-column prop="weeklyLimit" label="每周限额" width="120" align="center" />
        <el-table-column prop="description" label="说明" min-width="200" show-overflow-tooltip />
        <el-table-column prop="priority" label="优先级" width="80" align="center" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.enabled" type="success" size="small">启用</el-tag>
            <el-tag v-else type="info" size="small">停用</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button v-if="canWrite" link type="primary" :icon="Edit" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="canWrite" link type="danger" :icon="DeleteIcon" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item label="问题类型" required>
          <el-input v-model="form.questionType" placeholder="如 SMARTBI_QUERY / FORECAST / DATA_EXPORT" />
        </el-form-item>
        <el-form-item label="单次成本">
          <el-input-number v-model="form.quotaCost" :min="0" :max="100" style="width: 100%" />
          <span style="font-size: 12px; color: #909399; margin-left: 8px">每次调用消耗的配额数</span>
        </el-form-item>
        <el-form-item label="每周限额">
          <el-input-number v-model="form.weeklyLimit" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="优先级">
          <el-input-number v-model="form.priority" :min="0" :max="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="如 SmartBI 自然语言查询 - 每次扣 1, 每周 200" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-wrapper { padding: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.header-left { display: flex; align-items: baseline; gap: 12px; }
.page-title { font-size: 18px; font-weight: 600; }
.data-count { font-size: 13px; color: #909399; }
</style>
