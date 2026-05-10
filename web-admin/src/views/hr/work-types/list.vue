<script setup lang="ts">
/**
 * 工种字典管理 (work_types)
 *
 * 张权 Apr 29 2026 audit P0 fix: 后端 /work-types 全 CRUD 齐全, 前端零页面.
 * 13 个后端实体引用 work_type_id (TimeClockRecord/WorkSession/PieceRateRule/
 * EmployeeProcessSegment), 没工种数据 → 计件工资/打卡分类/工时统计全断.
 */
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, put, del } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Edit, Delete as DeleteIcon, Search, Refresh } from '@element-plus/icons-vue';
import type { TableRow } from '@/types/api';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('hr'));

const loading = ref(false);
const tableData = ref<TableRow[]>([]);
const pagination = ref({ page: 1, size: 20, total: 0 });
const searchKeyword = ref('');

onMounted(loadData);

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await get(`/${factoryId.value}/work-types`, {
      params: {
        page: pagination.value.page,
        size: pagination.value.size,
        keyword: searchKeyword.value || undefined,
      },
    });
    if (res.success && res.data) {
      tableData.value = res.data.content || res.data || [];
      pagination.value.total = res.data.totalElements ?? tableData.value.length;
    }
  } catch (e) { console.error(e); }
  finally { loading.value = false; }
}

const dialogVisible = ref(false);
const editingId = ref<string | null>(null);
const form = ref({
  code: '',
  name: '',
  category: '',
  department: '',
  description: '',
  hourlyRate: 0,
  billingType: 'HOURLY',
  hazardLevel: 1,
  certificationRequired: false,
  isActive: true,
});
const dialogTitle = computed(() => (editingId.value ? '编辑工种' : '新建工种'));

function openCreate() {
  editingId.value = null;
  form.value = {
    code: '',
    name: '',
    category: '',
    department: '',
    description: '',
    hourlyRate: 0,
    billingType: 'HOURLY',
    hazardLevel: 1,
    certificationRequired: false,
    isActive: true,
  };
  dialogVisible.value = true;
}

function openEdit(row: TableRow) {
  editingId.value = String(row.id || '');
  form.value = {
    code: String(row.code || ''),
    name: String(row.name || ''),
    category: String(row.category || ''),
    department: String(row.department || ''),
    description: String(row.description || ''),
    hourlyRate: Number(row.hourlyRate || 0),
    billingType: String(row.billingType || 'HOURLY'),
    hazardLevel: Number(row.hazardLevel || 1),
    certificationRequired: !!row.certificationRequired,
    isActive: row.isActive !== false,
  };
  dialogVisible.value = true;
}

const submitting = ref(false);
async function handleSave() {
  if (!form.value.name) return ElMessage.warning('请填写工种名称');
  if (!form.value.code) return ElMessage.warning('请填写工种编码');
  submitting.value = true;
  try {
    if (editingId.value) {
      const res = await put(`/${factoryId.value}/work-types/${editingId.value}`, form.value);
      if (res.success) ElMessage.success('更新成功');
    } else {
      const res = await post(`/${factoryId.value}/work-types`, form.value);
      if (res.success) ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    loadData();
  } catch (e) { console.error(e); }
  finally { submitting.value = false; }
}

async function handleDelete(row: TableRow) {
  try {
    await ElMessageBox.confirm(
      `确定删除工种「${row.name}」? 已分配此工种的员工的历史记录仍保留, 但无法新分配.`,
      '删除确认',
      { type: 'warning' },
    );
    const res = await del(`/${factoryId.value}/work-types/${row.id}`);
    if (res.success) {
      ElMessage.success('删除成功');
      loadData();
    }
  } catch { /* user cancelled */ }
}

async function handleToggleStatus(row: TableRow) {
  try {
    const res = await put(`/${factoryId.value}/work-types/${row.id}/toggle-status`, {});
    if (res.success) {
      ElMessage.success('状态已更新');
      loadData();
    }
  } catch (e) { console.error(e); }
}

function handleSearch() { pagination.value.page = 1; loadData(); }
function handleRefresh() { searchKeyword.value = ''; pagination.value.page = 1; loadData(); }
function handlePageChange(p: number) { pagination.value.page = p; loadData(); }
function handleSizeChange(s: number) { pagination.value.size = s; pagination.value.page = 1; loadData(); }

const billingTypeMap: Record<string, string> = {
  HOURLY: '小时工',
  PIECE: '计件',
  DAILY: '日薪',
  MONTHLY: '月薪',
};
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">工种字典</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="openCreate">
              新建工种
            </el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索工种名称 / 编码"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-button :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table v-loading="loading" :data="tableData" stripe>
        <el-table-column prop="code" label="工种编码" width="140" />
        <el-table-column prop="name" label="工种名称" min-width="160" />
        <el-table-column prop="department" label="所属部门" width="120" />
        <el-table-column label="计费方式" width="100">
          <template #default="{ row }">{{ billingTypeMap[row.billingType] || row.billingType || '-' }}</template>
        </el-table-column>
        <el-table-column prop="hourlyRate" label="时薪 (元)" width="120">
          <template #default="{ row }">
            {{ row.hourlyRate != null ? `¥${Number(row.hourlyRate).toFixed(2)}` : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="证书要求" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.certificationRequired" type="warning" size="small">需证书</el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.isActive" type="success" size="small">启用</el-tag>
            <el-tag v-else type="info" size="small">停用</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button v-if="canWrite" link type="primary" :icon="Edit" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="canWrite" link type="warning" @click="handleToggleStatus(row)">
              {{ row.isActive ? '停用' : '启用' }}
            </el-button>
            <el-button v-if="canWrite" link type="danger" :icon="DeleteIcon" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 16px; justify-content: flex-end"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item label="工种编码" required>
          <el-input v-model="form.code" placeholder="如 WT001" :disabled="!!editingId" />
        </el-form-item>
        <el-form-item label="工种名称" required>
          <el-input v-model="form.name" placeholder="如 卤煮工 / 包装工 / 质检员" />
        </el-form-item>
        <el-form-item label="所属部门">
          <el-input v-model="form.department" placeholder="如 生产车间 / 包装车间" />
        </el-form-item>
        <el-form-item label="计费方式">
          <el-select v-model="form.billingType" style="width: 100%">
            <el-option label="小时工 (HOURLY)" value="HOURLY" />
            <el-option label="计件 (PIECE)" value="PIECE" />
            <el-option label="日薪 (DAILY)" value="DAILY" />
            <el-option label="月薪 (MONTHLY)" value="MONTHLY" />
          </el-select>
        </el-form-item>
        <el-form-item label="时薪 (元)">
          <el-input-number v-model="form.hourlyRate" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="风险等级">
          <el-select v-model="form.hazardLevel" style="width: 100%">
            <el-option label="1 - 普通" :value="1" />
            <el-option label="2 - 较低" :value="2" />
            <el-option label="3 - 中等" :value="3" />
            <el-option label="4 - 较高" :value="4" />
            <el-option label="5 - 高危" :value="5" />
          </el-select>
        </el-form-item>
        <el-form-item label="证书要求">
          <el-switch v-model="form.certificationRequired" />
          <span style="margin-left: 12px; color: #909399; font-size: 13px">
            勾选后, 分配此工种时会校验员工是否有相应证书
          </span>
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="form.isActive" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
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
.search-bar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
