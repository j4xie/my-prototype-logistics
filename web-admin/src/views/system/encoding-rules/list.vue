<script setup lang="ts">
/**
 * 编码规则字典管理 (encoding_rules)
 * audit P1 fix: 后端 /encoding-rules 全 CRUD 齐全, 前端零页面.
 * 控制销售订单/采购订单/生产计划编号格式 (前缀/日期/序号位数), 之前只能 SQL 改.
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
    const res = await get(`/${factoryId.value}/encoding-rules`);
    if (res.success && res.data) {
      tableData.value = res.data.content || res.data || [];
    }
  } catch (e) { console.error(e); }
  finally { loading.value = false; }
}

const dialogVisible = ref(false);
const editingId = ref<string | null>(null);
const form = ref({
  entityType: 'SALES_ORDER',
  ruleName: '',
  ruleDescription: '',
  encodingPattern: '{PREFIX}-{YYYY}{MM}{DD}-{SEQ:4}',
  prefix: '',
  dateFormat: 'yyyyMMdd',
  separator: '-',
  sequenceLength: 4,
  resetCycle: 'DAILY',
  includeFactoryCode: true,
  enabled: true,
});
const dialogTitle = computed(() => (editingId.value ? '编辑编码规则' : '新建编码规则'));
const submitting = ref(false);

// 常用 pattern 模板
const patternTemplates = [
  { label: 'PREFIX-日期-序号 (SO-20260429-0001)', value: '{PREFIX}-{YYYY}{MM}{DD}-{SEQ:4}' },
  { label: 'PREFIX-年月-序号 (SO-202604-0001)', value: '{PREFIX}-{YYYY}{MM}-{SEQ:4}' },
  { label: 'PREFIX-工厂-日期-序号', value: '{PREFIX}-{FACTORY}-{YYYY}{MM}{DD}-{SEQ:4}' },
  { label: 'PREFIX-序号 (无日期, SO-000001)', value: '{PREFIX}-{SEQ:6}' },
];

function applyTemplate(tpl: string) {
  form.value.encodingPattern = tpl;
}

function openCreate() {
  editingId.value = null;
  form.value = {
    entityType: 'SALES_ORDER',
    ruleName: '',
    ruleDescription: '',
    encodingPattern: '{PREFIX}-{YYYY}{MM}{DD}-{SEQ:4}',
    prefix: '',
    dateFormat: 'yyyyMMdd',
    separator: '-',
    sequenceLength: 4,
    resetCycle: 'DAILY',
    includeFactoryCode: true,
    enabled: true,
  };
  dialogVisible.value = true;
}

function openEdit(row: Record<string, unknown>) {
  editingId.value = String(row.id || '');
  form.value = {
    entityType: String(row.entityType || 'SALES_ORDER'),
    ruleName: String(row.ruleName || ''),
    ruleDescription: String(row.ruleDescription || ''),
    encodingPattern: String(row.encodingPattern || '{PREFIX}-{YYYY}{MM}{DD}-{SEQ:4}'),
    prefix: String(row.prefix || ''),
    dateFormat: String(row.dateFormat || 'yyyyMMdd'),
    separator: String(row.separator || '-'),
    sequenceLength: Number(row.sequenceLength || 4),
    resetCycle: String(row.resetCycle || 'DAILY'),
    includeFactoryCode: row.includeFactoryCode !== false,
    enabled: row.enabled !== false,
  };
  dialogVisible.value = true;
}

async function handleSave() {
  if (!form.value.ruleName) return ElMessage.warning('请填写规则名称');
  if (!form.value.encodingPattern) return ElMessage.warning('请填写编码模板 (如 {PREFIX}-{YYYY}{MM}{DD}-{SEQ:4})');
  submitting.value = true;
  try {
    if (editingId.value) {
      const res = await put(`/${factoryId.value}/encoding-rules/${editingId.value}`, form.value);
      if (res.success) ElMessage.success('更新成功');
    } else {
      const res = await post(`/${factoryId.value}/encoding-rules`, form.value);
      if (res.success) ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    loadData();
  } catch (e) { console.error(e); }
  finally { submitting.value = false; }
}

async function handleDelete(row: Record<string, unknown>) {
  try {
    await ElMessageBox.confirm(`确定删除规则「${row.ruleName}」?`, '删除确认', { type: 'warning' });
    const res = await del(`/${factoryId.value}/encoding-rules/${row.id}`);
    if (res.success) { ElMessage.success('删除成功'); loadData(); }
  } catch { /* cancel */ }
}

const entityTypeMap: Record<string, string> = {
  SALES_ORDER: '销售订单',
  PURCHASE_ORDER: '采购订单',
  PRODUCTION_PLAN: '生产计划',
  PRODUCTION_BATCH: '生产批次',
  MATERIAL_BATCH: '原材料批次',
  SHIPMENT: '出货单',
  TRANSFER: '调拨单',
  QUALITY_INSPECTION: '质检记录',
};
</script>

<template>
  <div class="page-wrapper">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">编码规则字典</span>
            <span class="data-count">控制各业务单据编号格式 (前缀+日期+序号)</span>
          </div>
          <div class="header-right">
            <el-button :icon="Refresh" @click="loadData">刷新</el-button>
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="openCreate">新建规则</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="tableData" stripe>
        <el-table-column label="单据类型" width="140">
          <template #default="{ row }">{{ entityTypeMap[row.entityType] || row.entityType }}</template>
        </el-table-column>
        <el-table-column prop="ruleName" label="规则名称" min-width="160" />
        <el-table-column prop="prefix" label="前缀" width="100" />
        <el-table-column prop="dateFormat" label="日期格式" width="120" />
        <el-table-column prop="sequenceLength" label="序号位数" width="100" align="center" />
        <el-table-column prop="resetCycle" label="重置周期" width="100" />
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item label="单据类型" required>
          <el-select v-model="form.entityType" style="width: 100%" :disabled="!!editingId">
            <el-option v-for="(v, k) in entityTypeMap" :key="k" :label="`${v} (${k})`" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="规则名称" required>
          <el-input v-model="form.ruleName" placeholder="如 销售订单编号规则" />
        </el-form-item>
        <el-form-item label="编码模板" required>
          <el-input v-model="form.encodingPattern" placeholder="如 {PREFIX}-{YYYY}{MM}{DD}-{SEQ:4}" />
          <div style="margin-top: 6px; font-size: 12px; color: #909399; line-height: 1.6">
            占位符: <code>{PREFIX}</code> 前缀 / <code>{FACTORY}</code> 工厂码 /
            <code>{YYYY}{MM}{DD}</code> 日期 / <code>{SEQ:4}</code> 4位序号
          </div>
          <div style="margin-top: 8px;">
            <span style="font-size: 12px; color: #606266; margin-right: 8px">常用模板:</span>
            <el-button
              v-for="t in patternTemplates"
              :key="t.value"
              size="small"
              link
              type="primary"
              @click="applyTemplate(t.value)"
            >{{ t.label }}</el-button>
          </div>
        </el-form-item>
        <el-form-item label="前缀">
          <el-input v-model="form.prefix" placeholder="如 SO / PO / PP" />
        </el-form-item>
        <el-form-item label="日期格式">
          <el-select v-model="form.dateFormat" style="width: 100%">
            <el-option label="yyyyMMdd (20260429)" value="yyyyMMdd" />
            <el-option label="yyyyMM (202604)" value="yyyyMM" />
            <el-option label="yyMMdd (260429)" value="yyMMdd" />
            <el-option label="无日期" value="" />
          </el-select>
        </el-form-item>
        <el-form-item label="分隔符">
          <el-input v-model="form.separator" placeholder="-" maxlength="3" />
        </el-form-item>
        <el-form-item label="序号位数">
          <el-input-number v-model="form.sequenceLength" :min="1" :max="10" style="width: 100%" />
        </el-form-item>
        <el-form-item label="重置周期">
          <el-select v-model="form.resetCycle" style="width: 100%">
            <el-option label="每天 (DAILY)" value="DAILY" />
            <el-option label="每月 (MONTHLY)" value="MONTHLY" />
            <el-option label="每年 (YEARLY)" value="YEARLY" />
            <el-option label="不重置 (NONE)" value="NONE" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.ruleDescription" type="textarea" :rows="2" />
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
