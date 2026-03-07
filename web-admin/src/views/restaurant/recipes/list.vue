<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">配方管理</span>
            <span class="data-count">共 {{ pagination.total }} 条</span>
          </div>
          <div class="header-right">
            <el-button :icon="Download" @click="handleExport">导出</el-button>
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleCreate">新增配方</el-button>
          </div>
        </div>
      </template>

      <!-- 统计卡片 -->
      <el-row :gutter="16" class="stat-row" v-if="statsLoaded">
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <span class="stat-label">配方总数</span>
            <span class="stat-value">{{ statsData.totalRecipes ?? pagination.total }}</span>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <span class="stat-label">涉及菜品</span>
            <span class="stat-value">{{ statsData.dishCount ?? 0 }}</span>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <span class="stat-label">有配方菜品</span>
            <span class="stat-value" style="color: var(--el-color-success)">{{ statsData.activeRecipes ?? 0 }}</span>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <span class="stat-label">列表总数</span>
            <span class="stat-value">{{ pagination.total }}</span>
          </div>
        </el-col>
      </el-row>

      <div class="search-bar" role="search" aria-label="配方筛选">
        <el-input v-model="filterKeyword" placeholder="搜索食材名称" clearable style="width: 180px" :prefix-icon="Search" @keyup.enter="handleSearch" />
        <el-select v-model="filterDish" placeholder="按菜品筛选" filterable clearable style="width: 180px" @change="handleSearch">
          <el-option v-for="pt in productTypes" :key="pt.id" :label="pt.name" :value="pt.id" />
        </el-select>
        <el-select v-model="filterActive" placeholder="状态" clearable style="width: 120px" @change="handleSearch">
          <el-option label="启用" :value="true" />
          <el-option label="停用" :value="false" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="tableData" row-key="id" v-loading="loading" stripe border style="width: 100%" empty-text="暂无配方数据，点击「新增配方」添加" aria-label="配方列表">
        <el-table-column prop="productTypeId" label="菜品" width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ productNameMap[row.productTypeId] || row.productTypeId }}</template>
        </el-table-column>
        <el-table-column prop="rawMaterialTypeId" label="食材" width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ materialNameMap[row.rawMaterialTypeId] || row.rawMaterialTypeId }}</template>
        </el-table-column>
        <el-table-column label="标准用量" width="120" align="right">
          <template #default="{ row }">
            {{ row.standardQuantity }} {{ row.unit }}
          </template>
        </el-table-column>
        <el-table-column label="净料率" width="100" align="center" class-name="hidden-sm-col">
          <template #default="{ row }">
            {{ row.netYieldRate ? (row.netYieldRate * 100).toFixed(1) + '%' : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="主料/辅料" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isMainIngredient ? '' : 'info'" size="small">
              {{ row.isMainIngredient ? '主料' : '辅料' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'danger'" size="small">
              {{ row.isActive ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" show-overflow-tooltip :formatter="emptyCell" />
        <el-table-column label="操作" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="showDetail(row)">查看</el-button>
            <el-button v-if="canWrite" type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button v-if="canWrite" type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :page-sizes="[10, 20, 50]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="loadData"
          @size-change="() => { pagination.page = 1; loadData(); }"
        />
      </div>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogForm.id ? '编辑配方' : '新增配方'" width="500px" :close-on-click-modal="false" destroy-on-close>
      <el-form ref="formRef" :model="dialogForm" :rules="formRules" label-width="100px">
        <el-form-item label="菜品" prop="productTypeId">
          <el-select v-model="dialogForm.productTypeId" filterable placeholder="选择菜品" style="width: 100%">
            <el-option v-for="pt in productTypes" :key="pt.id" :label="pt.name" :value="pt.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="食材" prop="rawMaterialTypeId">
          <el-select v-model="dialogForm.rawMaterialTypeId" filterable placeholder="选择食材" style="width: 100%">
            <el-option v-for="mt in materialTypes" :key="mt.id" :label="mt.name" :value="mt.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="标准用量" prop="standardQuantity">
          <el-input-number v-model="dialogForm.standardQuantity" :precision="4" :step="0.1" :min="0" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="dialogForm.unit" placeholder="kg / L / 个" style="width: 120px" />
        </el-form-item>
        <el-form-item label="净料率">
          <el-input-number v-model="dialogForm.netYieldRate" :precision="4" :step="0.05" :min="0.01" :max="1" />
        </el-form-item>
        <el-form-item label="主料">
          <el-switch v-model="dialogForm.isMainIngredient" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="dialogForm.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="submitting" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" title="配方详情" size="400px">
      <el-descriptions :column="1" border v-if="detailData">
        <el-descriptions-item label="菜品">{{ productNameMap[detailData.productTypeId] || detailData.productTypeId }}</el-descriptions-item>
        <el-descriptions-item label="食材">{{ materialNameMap[detailData.rawMaterialTypeId] || detailData.rawMaterialTypeId }}</el-descriptions-item>
        <el-descriptions-item label="标准用量">{{ detailData.standardQuantity }} {{ detailData.unit }}</el-descriptions-item>
        <el-descriptions-item label="净料率">{{ detailData.netYieldRate ? (detailData.netYieldRate * 100).toFixed(1) + '%' : '-' }}</el-descriptions-item>
        <el-descriptions-item label="主料/辅料">{{ detailData.isMainIngredient ? '主料' : '辅料' }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ detailData.isActive ? '启用' : '停用' }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ detailData.notes || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Plus, Search, Refresh, Download } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { useFactoryId } from '@/composables/useFactoryId';
import { usePermissionStore } from '@/store/modules/permission';
import { getRecipes, getRecipe, getRecipeSummary, createRecipe, updateRecipe, deleteRecipe, getProductTypesActive, getRawMaterialTypes } from '@/api/restaurant';
import { emptyCell, exportTableToExcel } from '@/utils/tableFormatters';
import type { RecipeItem } from '@/types/restaurant';

const factoryId = useFactoryId();
const permissionStore = usePermissionStore();
const canWrite = computed(() => permissionStore.canWrite('restaurant'));

const productTypes = ref<{ id: string; name: string }[]>([]);
const materialTypes = ref<{ id: string; name: string }[]>([]);
const productNameMap = computed(() => Object.fromEntries(productTypes.value.map(p => [p.id, p.name])));
const materialNameMap = computed(() => Object.fromEntries(materialTypes.value.map(m => [m.id, m.name])));

async function loadSelectOptions() {
  try {
    const [ptRes, mtRes] = await Promise.all([
      getProductTypesActive(factoryId.value),
      getRawMaterialTypes(factoryId.value)
    ]);
    if (ptRes.success && ptRes.data) {
      productTypes.value = Array.isArray(ptRes.data) ? ptRes.data : [];
    }
    if (mtRes.success && mtRes.data) {
      const d = mtRes.data as { content?: { id: string; name: string }[] } | { id: string; name: string }[];
      materialTypes.value = Array.isArray(d) ? d : d.content || [];
    }
  } catch (e) {
    console.error('Failed to load select options:', e);
  }
}

const statsLoaded = ref(false);
const statsData = ref<{ totalRecipes?: number; activeRecipes?: number; dishCount?: number; materialCount?: number }>({});

async function loadStatistics() {
  try {
    const res = await getRecipeSummary(factoryId.value);
    if (res.success && res.data) {
      const byProduct = Array.isArray(res.data.byProduct) ? res.data.byProduct : [];
      statsData.value = {
        totalRecipes: res.data.totalRecipeLines ?? res.data.totalRecipes ?? res.data.total ?? 0,
        activeRecipes: byProduct.length,
        dishCount: res.data.totalProducts ?? res.data.dishCount ?? 0,
        materialCount: res.data.materialCount ?? 0,
      };
      statsLoaded.value = true;
    }
  } catch (e) { console.error('Failed to load recipe summary:', e); }
}

const loading = ref(false);
const submitting = ref(false);
const tableData = ref<RecipeItem[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const filterActive = ref<boolean | undefined>(undefined);
const filterDish = ref('');
const filterKeyword = ref('');
const dialogVisible = ref(false);
const detailVisible = ref(false);
const detailData = ref<RecipeItem | null>(null);
const formRef = ref<FormInstance>();

const formRules = {
  productTypeId: [{ required: true, message: '请选择菜品', trigger: 'change' }],
  rawMaterialTypeId: [{ required: true, message: '请选择食材', trigger: 'change' }],
  standardQuantity: [{ required: true, message: '请输入标准用量', trigger: 'blur' }],
};

const emptyForm = () => ({
  id: '',
  productTypeId: '',
  rawMaterialTypeId: '',
  standardQuantity: 0.1,
  unit: 'kg',
  netYieldRate: 1.0,
  isMainIngredient: true,
  isActive: true,
  notes: ''
});
const dialogForm = ref(emptyForm());

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await getRecipes(factoryId.value, {
      page: pagination.value.page,
      size: pagination.value.size,
      isActive: filterActive.value,
      productTypeId: filterDish.value || undefined
    });
    if (res.success && res.data) {
      const d = res.data as { content?: unknown[]; totalElements?: number } | unknown[];
      let items = Array.isArray(d) ? d : (d as { content?: unknown[]; totalElements?: number }).content || [];
      // Client-side keyword filter (Recipe stores IDs, not names)
      const kw = filterKeyword.value?.trim().toLowerCase();
      if (kw) {
        items = (items as RecipeItem[]).filter((r) => {
          const matName = materialNameMap.value[r.rawMaterialTypeId] || '';
          const prodName = productNameMap.value[r.productTypeId] || '';
          return matName.toLowerCase().includes(kw) || prodName.toLowerCase().includes(kw) || (r.notes || '').toLowerCase().includes(kw);
        });
      }
      tableData.value = items;
      pagination.value.total = kw ? items.length : (Array.isArray(d) ? items.length : ((d as { content?: unknown[]; totalElements?: number }).totalElements ?? items.length));
    } else {
      tableData.value = [];
      pagination.value.total = 0;
    }
  } catch (e) {
    console.error('Load recipes failed:', e);
    ElMessage.error('加载配方数据失败');
    tableData.value = [];
    pagination.value.total = 0;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.value.page = 1;
  loadData();
}

function handleRefresh() {
  filterActive.value = undefined;
  filterDish.value = '';
  filterKeyword.value = '';
  pagination.value.page = 1;
  loadData();
}

function handleCreate() {
  dialogForm.value = emptyForm();
  dialogVisible.value = true;
}

function handleEdit(row: RecipeItem) {
  dialogForm.value = { ...row };
  dialogVisible.value = true;
}

async function showDetail(row: RecipeItem) {
  detailData.value = row;
  detailVisible.value = true;
  try {
    const res = await getRecipe(factoryId.value, row.id);
    if (res.success && res.data) detailData.value = res.data;
  } catch { /* keep cached row data */ }
}

async function handleDelete(row: RecipeItem) {
  try {
    await ElMessageBox.confirm('确认删除该配方？', '提示', { type: 'warning' });
    await deleteRecipe(factoryId.value, row.id);
    ElMessage.success('已删除');
    loadData();
  } catch (e) {
    if (e !== 'cancel') {
      console.error('Delete recipe failed:', e);
      ElMessage.error('删除失败');
    }
  }
}

async function submitForm() {
  if (formRef.value) {
    try { await formRef.value.validate(); } catch { return; }
  }
  submitting.value = true;
  try {
    if (dialogForm.value.id) {
      await updateRecipe(factoryId.value, dialogForm.value.id, dialogForm.value);
      ElMessage.success('更新成功');
    } else {
      await createRecipe(factoryId.value, dialogForm.value);
      ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    loadData();
  } catch (e) {
    console.error('Save recipe failed:', e);
    ElMessage.error('保存失败');
  } finally {
    submitting.value = false;
  }
}

const MAX_EXPORT = 10000;

async function handleExport() {
  let exportData: RecipeItem[] = tableData.value;
  if (pagination.value.total > pagination.value.size) {
    const exportSize = Math.min(pagination.value.total, MAX_EXPORT);
    if (pagination.value.total > MAX_EXPORT) ElMessage.warning(`数据量较大，仅导出前 ${MAX_EXPORT} 条`);
    else ElMessage.info('正在导出全部数据…');
    try {
      const res = await getRecipes(factoryId.value, { page: 1, size: exportSize });
      if (res.success && res.data) {
        const d = res.data as { content?: RecipeItem[] } | RecipeItem[];
        exportData = Array.isArray(d) ? d : (d as { content?: RecipeItem[] }).content || [];
      }
    } catch { /* fall back to current page */ }
  }
  await exportTableToExcel(exportData, [
    { label: '菜品', field: 'productTypeId', formatter: (val: string) => productNameMap.value[val] || val },
    { label: '食材', field: 'rawMaterialTypeId', formatter: (val: string) => materialNameMap.value[val] || val },
    { label: '标准用量', field: 'standardQuantity' },
    { label: '单位', field: 'unit' },
    { label: '净料率', field: 'netYieldRate', formatter: (val: number) => val ? (val * 100).toFixed(1) + '%' : '-' },
    { label: '主料/辅料', field: 'isMainIngredient', formatter: (val: boolean) => val ? '主料' : '辅料' },
    { label: '状态', field: 'isActive', formatter: (val: boolean) => val ? '启用' : '停用' },
    { label: '备注', field: 'notes' },
  ], '配方管理');
}

onMounted(() => { loadData(); loadSelectOptions(); loadStatistics(); });

// Handle full-page reload: factoryId may not be ready at mount time
watch(factoryId, (val) => { if (val) { loadData(); loadStatistics(); } });
</script>

<style scoped lang="scss">
@import '../restaurant-shared.scss';
</style>
