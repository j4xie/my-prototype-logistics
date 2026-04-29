<script setup lang="ts">
/**
 * 原料类型字典管理 (raw_material_types)
 *
 * 张权 Apr 29 2026 反馈: "没有 新建的入口哦 这个入口是入库登记".
 * 仓储 → 原料 / 物料 (采购入库) 页面只有"入库登记"(material_batches CRUD),
 * 但缺一个"原料类型字典"管理页, 用户无法在 UI 里创建新原料类型 (冻猪蹄/吸塑盒).
 * 后端 /raw-material-types 全 CRUD 早齐, 只缺前端页面 — 本页补上.
 */
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, put, del } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Edit, Delete as DeleteIcon, Search, Refresh } from '@element-plus/icons-vue';
import ConceptDisambiguationAlert from '@/components/common/ConceptDisambiguationAlert.vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('warehouse'));

const loading = ref(false);
const tableData = ref<Record<string, unknown>[]>([]);
const pagination = ref({ page: 1, size: 20, total: 0 });
const searchKeyword = ref('');

onMounted(loadData);

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await get(`/${factoryId.value}/raw-material-types`, {
      params: {
        page: pagination.value.page,
        size: pagination.value.size,
        keyword: searchKeyword.value || undefined,
      },
    });
    if (res.success && res.data) {
      tableData.value = res.data.content || [];
      pagination.value.total = res.data.totalElements || 0;
    }
  } catch (e) { console.error(e); }
  finally { loading.value = false; }
}

// ==================== Create / Edit Dialog ====================
const dialogVisible = ref(false);
const editingId = ref<string | null>(null);
const form = ref({
  code: '',
  name: '',
  category: '',
  unit: 'kg',
  unitPrice: 0,
  storageType: '常温',
  shelfLifeDays: null as number | null,
  notes: '',
});
const dialogTitle = computed(() => (editingId.value ? '编辑原料类型' : '新建原料类型'));

function openCreate() {
  editingId.value = null;
  form.value = {
    code: '',
    name: '',
    category: '',
    unit: 'kg',
    unitPrice: 0,
    storageType: '常温',
    shelfLifeDays: null,
    notes: '',
  };
  dialogVisible.value = true;
}

function openEdit(row: Record<string, unknown>) {
  editingId.value = String(row.id || '');
  form.value = {
    code: String(row.code || ''),
    name: String(row.name || ''),
    category: String(row.category || ''),
    unit: String(row.unit || 'kg'),
    unitPrice: Number(row.unitPrice || 0),
    storageType: String(row.storageType || '常温'),
    shelfLifeDays: row.shelfLifeDays as number | null ?? null,
    notes: String(row.notes || ''),
  };
  dialogVisible.value = true;
}

const submitting = ref(false);
async function handleSave() {
  if (!form.value.name) return ElMessage.warning('请填写原料名称');
  if (!form.value.code) return ElMessage.warning('请填写原料编码');
  submitting.value = true;
  try {
    if (editingId.value) {
      const res = await put(`/${factoryId.value}/raw-material-types/${editingId.value}`, form.value);
      if (res.success) ElMessage.success('更新成功');
    } else {
      const res = await post(`/${factoryId.value}/raw-material-types`, form.value);
      if (res.success) ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    loadData();
  } catch (e) { console.error(e); }
  finally { submitting.value = false; }
}

async function handleDelete(row: Record<string, unknown>) {
  try {
    await ElMessageBox.confirm(
      `确定删除原料类型「${row.name}」? 该原料关联的批次仍保留, 但无法新建新批次.`,
      '删除确认',
      { type: 'warning' },
    );
    const res = await del(`/${factoryId.value}/raw-material-types/${row.id}`);
    if (res.success) {
      ElMessage.success('删除成功');
      loadData();
    }
  } catch (e) { /* user cancelled or interceptor toasted */ }
}

function handleSearch() {
  pagination.value.page = 1;
  loadData();
}
function handleRefresh() {
  searchKeyword.value = '';
  pagination.value.page = 1;
  loadData();
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
</script>

<template>
  <div class="page-wrapper">
    <ConceptDisambiguationAlert
      here-name="原料类型字典"
      here="原料的「分类抽象」（如「冻猪蹄」「吸塑盒2014-3.5」），定义后才能在采购订单 / 入库登记 / BOM 里被选择"
      other-name="仓储管理 → 原料 / 物料 (采购入库)"
      other="原料的「具体批次」，记录某次入库的数量、价格、保质期"
      other-path="/warehouse/materials"
      consequence="先在这里建原料类型, 再去入库登记里给它建批次"
    />
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">原料类型字典</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="openCreate">
              新建原料类型
            </el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索原料名称 / 编码"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
        />
        <el-button :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table v-loading="loading" :data="tableData" stripe>
        <el-table-column prop="code" label="原料编码" width="160" />
        <el-table-column prop="name" label="原料名称" min-width="180" />
        <el-table-column prop="category" label="类别" width="120" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="unitPrice" label="单价 (元)" width="120">
          <template #default="{ row }">
            {{ row.unitPrice != null ? `¥${Number(row.unitPrice).toFixed(2)}` : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="storageType" label="存储方式" width="100" />
        <el-table-column prop="shelfLifeDays" label="保质期 (天)" width="120">
          <template #default="{ row }">{{ row.shelfLifeDays ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button v-if="canWrite" link type="primary" :icon="Edit" @click="openEdit(row)">编辑</el-button>
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
        <el-form-item label="原料编码" required>
          <el-input v-model="form.code" placeholder="如 DZT001" :disabled="!!editingId" />
        </el-form-item>
        <el-form-item label="原料名称" required>
          <el-input v-model="form.name" placeholder="如 冻猪蹄" />
        </el-form-item>
        <el-form-item label="类别">
          <el-input v-model="form.category" placeholder="如 肉类 / 包材 / 调料" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="form.unit" placeholder="kg / 个 / 箱" />
        </el-form-item>
        <el-form-item label="单价 (元)">
          <el-input-number v-model="form.unitPrice" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="存储方式">
          <el-select v-model="form.storageType" style="width: 100%">
            <el-option label="常温" value="常温" />
            <el-option label="冷藏" value="冷藏" />
            <el-option label="冷冻" value="冷冻" />
          </el-select>
        </el-form-item>
        <el-form-item label="保质期 (天)">
          <el-input-number v-model="form.shelfLifeDays" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.notes" type="textarea" :rows="2" />
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
