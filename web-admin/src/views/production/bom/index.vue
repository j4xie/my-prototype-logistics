<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, put, del } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Edit, Delete, Download, Refresh } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('production'));

// State
const loading = ref(false);
const selectedProductTypeId = ref<string>('');
const productTypes = ref<any[]>([]);
const costSummary = ref<any>(null);

// BOM Items (原辅料)
const bomItems = ref<any[]>([]);
const bomDialogVisible = ref(false);
const bomDialogLoading = ref(false);
const isBomEdit = ref(false);
const bomForm = ref({
  id: null as number | null,
  productTypeId: '',
  materialTypeId: '',
  materialName: '',
  standardQuantity: 0,
  yieldRate: 100,
  unit: 'kg',
  unitPrice: 0,
  taxRate: 13,
  sortOrder: 0,
  notes: ''
});

// Labor Costs (人工费用)
const laborCosts = ref<any[]>([]);
const laborDialogVisible = ref(false);
const laborDialogLoading = ref(false);
const isLaborEdit = ref(false);
const laborForm = ref({
  id: null as number | null,
  productTypeId: '',
  processName: '',
  processCategory: '',
  unitPrice: 0,
  priceUnit: '元/kg',
  standardQuantity: 1,
  sortOrder: 0,
  notes: ''
});

// Overhead Costs (均摊费用)
const overheadCosts = ref<any[]>([]);
const overheadDialogVisible = ref(false);
const overheadDialogLoading = ref(false);
const isOverheadEdit = ref(false);
const overheadForm = ref({
  id: null as number | null,
  name: '',
  category: '',
  unitPrice: 0,
  priceUnit: '元/kg',
  allocationRate: 1,
  sortOrder: 0,
  notes: ''
});

// Raw material types for dropdown
const materialTypes = ref<any[]>([]);

// Process categories for dropdown
const processCategories = ['通用工序', '分割工序', '包装工序', '质检工序', '冷藏工序'];

// Overhead categories for dropdown
const overheadCategories = ['房租', '水电', '燃气', '设备折旧', '后端毛利', '其他'];

onMounted(async () => {
  await loadProductTypes();
  await loadMaterialTypes();
  await loadOverheadCosts();
  await loadAllLaborCosts();
});

watch(selectedProductTypeId, async (newVal) => {
  if (newVal) {
    await loadBomItems();
    await loadLaborCosts();
    await loadCostSummary();
  } else {
    bomItems.value = [];
    laborCosts.value = [];
    costSummary.value = null;
  }
});

// ========== Product Types ==========
async function loadProductTypes() {
  if (!factoryId.value) return;
  try {
    const response = await get(`/${factoryId.value}/product-types/active`);
    if (response.success && response.data) {
      productTypes.value = response.data;
      // Select first product if available
      if (productTypes.value.length > 0 && !selectedProductTypeId.value) {
        selectedProductTypeId.value = productTypes.value[0].id;
      }
    }
  } catch (error) {
    console.error('Failed to load product types:', error);
  }
}

async function loadMaterialTypes() {
  if (!factoryId.value) return;
  try {
    const response = await get(`/${factoryId.value}/raw-material-types`);
    if (response.success && response.data) {
      materialTypes.value = response.data.content || response.data || [];
    }
  } catch (error) {
    console.error('Failed to load material types:', error);
  }
}

// ========== BOM Items ==========
async function loadBomItems() {
  if (!factoryId.value || !selectedProductTypeId.value) return;
  loading.value = true;
  try {
    const response = await get(`/${factoryId.value}/bom/items/${selectedProductTypeId.value}`);
    if (response.success && response.data) {
      bomItems.value = response.data;
    }
  } catch (error) {
    console.error('Failed to load BOM items:', error);
    ElMessage.error('Failed to load BOM data');
  } finally {
    loading.value = false;
  }
}

function handleAddBomItem() {
  isBomEdit.value = false;
  bomForm.value = {
    id: null,
    productTypeId: selectedProductTypeId.value,
    materialTypeId: '',
    materialName: '',
    standardQuantity: 0,
    yieldRate: 100,
    unit: 'kg',
    unitPrice: 0,
    taxRate: 13,
    sortOrder: bomItems.value.length,
    notes: ''
  };
  bomDialogVisible.value = true;
}

function handleEditBomItem(row: any) {
  isBomEdit.value = true;
  bomForm.value = {
    id: row.id,
    productTypeId: row.productTypeId,
    materialTypeId: row.materialTypeId,
    materialName: row.materialName,
    standardQuantity: row.standardQuantity || 0,
    yieldRate: row.yieldRate || 100,
    unit: row.unit || 'kg',
    unitPrice: row.unitPrice || 0,
    taxRate: row.taxRate || 13,
    sortOrder: row.sortOrder || 0,
    notes: row.notes || ''
  };
  bomDialogVisible.value = true;
}

async function submitBomForm() {
  if (!bomForm.value.materialName) {
    ElMessage.warning('Please enter material name');
    return;
  }
  bomDialogLoading.value = true;
  try {
    let response;
    if (isBomEdit.value && bomForm.value.id) {
      response = await put(`/${factoryId.value}/bom/items/${bomForm.value.id}`, bomForm.value);
    } else {
      response = await post(`/${factoryId.value}/bom/items`, bomForm.value);
    }
    if (response.success) {
      ElMessage.success(isBomEdit.value ? 'Updated successfully' : 'Added successfully');
      bomDialogVisible.value = false;
      await loadBomItems();
      await loadCostSummary();
    }
  } catch (error) {
    ElMessage.error('Operation failed');
  } finally {
    bomDialogLoading.value = false;
  }
}

async function handleDeleteBomItem(row: any) {
  try {
    await ElMessageBox.confirm('Are you sure you want to delete this item?', 'Confirm', { type: 'warning' });
    const response = await del(`/${factoryId.value}/bom/items/${row.id}`);
    if (response.success) {
      ElMessage.success('Deleted successfully');
      await loadBomItems();
      await loadCostSummary();
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Delete failed');
    }
  }
}

// ========== Labor Costs ==========
async function loadLaborCosts() {
  if (!factoryId.value || !selectedProductTypeId.value) return;
  try {
    const response = await get(`/${factoryId.value}/bom/labor`, {
      params: { productTypeId: selectedProductTypeId.value }
    });
    if (response.success && response.data) {
      laborCosts.value = response.data;
    }
  } catch (error) {
    console.error('Failed to load labor costs:', error);
  }
}

async function loadAllLaborCosts() {
  if (!factoryId.value) return;
  try {
    const response = await get(`/${factoryId.value}/bom/labor/all`);
    if (response.success && response.data) {
      // Store all labor costs for reference
    }
  } catch (error) {
    console.error('Failed to load all labor costs:', error);
  }
}

function handleAddLaborCost() {
  isLaborEdit.value = false;
  laborForm.value = {
    id: null,
    productTypeId: selectedProductTypeId.value,
    processName: '',
    processCategory: '',
    unitPrice: 0,
    priceUnit: '元/kg',
    standardQuantity: 1,
    sortOrder: laborCosts.value.length,
    notes: ''
  };
  laborDialogVisible.value = true;
}

function handleEditLaborCost(row: any) {
  isLaborEdit.value = true;
  laborForm.value = {
    id: row.id,
    productTypeId: row.productTypeId,
    processName: row.processName,
    processCategory: row.processCategory || '',
    unitPrice: row.unitPrice || 0,
    priceUnit: row.priceUnit || '元/kg',
    standardQuantity: row.standardQuantity || 1,
    sortOrder: row.sortOrder || 0,
    notes: row.notes || ''
  };
  laborDialogVisible.value = true;
}

async function submitLaborForm() {
  if (!laborForm.value.processName) {
    ElMessage.warning('Please enter process name');
    return;
  }
  laborDialogLoading.value = true;
  try {
    let response;
    if (isLaborEdit.value && laborForm.value.id) {
      response = await put(`/${factoryId.value}/bom/labor/${laborForm.value.id}`, laborForm.value);
    } else {
      response = await post(`/${factoryId.value}/bom/labor`, laborForm.value);
    }
    if (response.success) {
      ElMessage.success(isLaborEdit.value ? 'Updated successfully' : 'Added successfully');
      laborDialogVisible.value = false;
      await loadLaborCosts();
      await loadCostSummary();
    }
  } catch (error) {
    ElMessage.error('Operation failed');
  } finally {
    laborDialogLoading.value = false;
  }
}

async function handleDeleteLaborCost(row: any) {
  try {
    await ElMessageBox.confirm('Are you sure you want to delete this item?', 'Confirm', { type: 'warning' });
    const response = await del(`/${factoryId.value}/bom/labor/${row.id}`);
    if (response.success) {
      ElMessage.success('Deleted successfully');
      await loadLaborCosts();
      await loadCostSummary();
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Delete failed');
    }
  }
}

// ========== Overhead Costs ==========
async function loadOverheadCosts() {
  if (!factoryId.value) return;
  try {
    const response = await get(`/${factoryId.value}/bom/overhead`);
    if (response.success && response.data) {
      overheadCosts.value = response.data;
    }
  } catch (error) {
    console.error('Failed to load overhead costs:', error);
  }
}

function handleAddOverheadCost() {
  isOverheadEdit.value = false;
  overheadForm.value = {
    id: null,
    name: '',
    category: '',
    unitPrice: 0,
    priceUnit: '元/kg',
    allocationRate: 1,
    sortOrder: overheadCosts.value.length,
    notes: ''
  };
  overheadDialogVisible.value = true;
}

function handleEditOverheadCost(row: any) {
  isOverheadEdit.value = true;
  overheadForm.value = {
    id: row.id,
    name: row.name,
    category: row.category || '',
    unitPrice: row.unitPrice || 0,
    priceUnit: row.priceUnit || '元/kg',
    allocationRate: row.allocationRate || 1,
    sortOrder: row.sortOrder || 0,
    notes: row.notes || ''
  };
  overheadDialogVisible.value = true;
}

async function submitOverheadForm() {
  if (!overheadForm.value.name) {
    ElMessage.warning('Please enter cost name');
    return;
  }
  overheadDialogLoading.value = true;
  try {
    let response;
    if (isOverheadEdit.value && overheadForm.value.id) {
      response = await put(`/${factoryId.value}/bom/overhead/${overheadForm.value.id}`, overheadForm.value);
    } else {
      response = await post(`/${factoryId.value}/bom/overhead`, overheadForm.value);
    }
    if (response.success) {
      ElMessage.success(isOverheadEdit.value ? 'Updated successfully' : 'Added successfully');
      overheadDialogVisible.value = false;
      await loadOverheadCosts();
      await loadCostSummary();
    }
  } catch (error) {
    ElMessage.error('Operation failed');
  } finally {
    overheadDialogLoading.value = false;
  }
}

async function handleDeleteOverheadCost(row: any) {
  try {
    await ElMessageBox.confirm('Are you sure you want to delete this item?', 'Confirm', { type: 'warning' });
    const response = await del(`/${factoryId.value}/bom/overhead/${row.id}`);
    if (response.success) {
      ElMessage.success('Deleted successfully');
      await loadOverheadCosts();
      await loadCostSummary();
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Delete failed');
    }
  }
}

// ========== Cost Summary ==========
async function loadCostSummary() {
  if (!factoryId.value || !selectedProductTypeId.value) return;
  try {
    const response = await get(`/${factoryId.value}/bom/cost-summary/${selectedProductTypeId.value}`);
    if (response.success && response.data) {
      costSummary.value = response.data;
    }
  } catch (error) {
    console.error('Failed to load cost summary:', error);
  }
}

// ========== Computed ==========
const materialCostTotal = computed(() => {
  return bomItems.value.reduce((sum, item) => {
    const qty = item.standardQuantity || 0;
    const yieldRate = (item.yieldRate || 100) / 100;
    const price = item.unitPrice || 0;
    return sum + (yieldRate > 0 ? (qty / yieldRate) * price : 0);
  }, 0);
});

const laborCostTotal = computed(() => {
  return laborCosts.value.reduce((sum, item) => {
    return sum + (item.unitPrice || 0) * (item.standardQuantity || 1);
  }, 0);
});

const overheadCostTotal = computed(() => {
  return overheadCosts.value.reduce((sum, item) => {
    return sum + (item.unitPrice || 0) * (item.allocationRate || 1);
  }, 0);
});

const totalCost = computed(() => {
  return materialCostTotal.value + laborCostTotal.value + overheadCostTotal.value;
});

// ========== Export ==========
function exportToExcel(type: string) {
  ElMessage.info('Export functionality coming soon');
}

function refreshData() {
  loadBomItems();
  loadLaborCosts();
  loadOverheadCosts();
  loadCostSummary();
}
</script>

<template>
  <div class="bom-page">
    <!-- Header -->
    <el-card class="header-card" shadow="never">
      <div class="header-content">
        <div class="header-left">
          <h2 class="page-title">BOM成本管理</h2>
          <el-select
            v-model="selectedProductTypeId"
            placeholder="选择产品"
            style="width: 280px; margin-left: 20px;"
            filterable
          >
            <el-option
              v-for="product in productTypes"
              :key="product.id"
              :label="product.name"
              :value="product.id"
            />
          </el-select>
          <el-button :icon="Refresh" style="margin-left: 12px;" @click="refreshData">刷新</el-button>
        </div>
        <div class="header-right">
          <el-card class="cost-summary-card" shadow="never">
            <div class="cost-summary">
              <div class="cost-item">
                <span class="cost-label">原料成本:</span>
                <span class="cost-value">{{ materialCostTotal.toFixed(2) }}</span>
              </div>
              <div class="cost-item">
                <span class="cost-label">人工成本:</span>
                <span class="cost-value">{{ laborCostTotal.toFixed(2) }}</span>
              </div>
              <div class="cost-item">
                <span class="cost-label">均摊费用:</span>
                <span class="cost-value">{{ overheadCostTotal.toFixed(2) }}</span>
              </div>
              <div class="cost-item total">
                <span class="cost-label">总成本:</span>
                <span class="cost-value">{{ totalCost.toFixed(2) }} 元/kg</span>
              </div>
            </div>
          </el-card>
        </div>
      </div>
    </el-card>

    <!-- Main Content -->
    <div class="tables-container">
      <!-- BOM Items Table (原辅料需求明细表) -->
      <el-card class="table-card" shadow="never">
        <template #header>
          <div class="table-header">
            <span class="table-title">原辅料需求明细表</span>
            <div class="table-actions">
              <el-button v-if="canWrite" type="primary" size="small" :icon="Plus" @click="handleAddBomItem">
                添加
              </el-button>
              <el-button size="small" :icon="Download" @click="exportToExcel('material')">导出</el-button>
            </div>
          </div>
        </template>
        <el-table :data="bomItems" v-loading="loading" stripe border size="small" style="width: 100%">
          <el-table-column prop="materialName" label="物料名称" min-width="120" show-overflow-tooltip />
          <el-table-column prop="standardQuantity" label="成品含量" width="90" align="right">
            <template #default="{ row }">
              {{ (row.standardQuantity || 0).toFixed(4) }}
            </template>
          </el-table-column>
          <el-table-column prop="yieldRate" label="出成率%" width="80" align="right">
            <template #default="{ row }">
              {{ (row.yieldRate || 100).toFixed(2) }}%
            </template>
          </el-table-column>
          <el-table-column label="原料投量/份" width="100" align="right">
            <template #default="{ row }">
              {{ ((row.standardQuantity || 0) / ((row.yieldRate || 100) / 100)).toFixed(4) }}
            </template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="60" align="center" />
          <el-table-column prop="unitPrice" label="单价" width="80" align="right">
            <template #default="{ row }">
              {{ (row.unitPrice || 0).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column prop="taxRate" label="税率%" width="70" align="right">
            <template #default="{ row }">
              {{ (row.taxRate || 0).toFixed(0) }}%
            </template>
          </el-table-column>
          <el-table-column label="小计" width="90" align="right">
            <template #default="{ row }">
              {{ (((row.standardQuantity || 0) / ((row.yieldRate || 100) / 100)) * (row.unitPrice || 0)).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right" align="center">
            <template #default="{ row }">
              <el-button v-if="canWrite" type="primary" link size="small" :icon="Edit" @click="handleEditBomItem(row)" />
              <el-button v-if="canWrite" type="danger" link size="small" :icon="Delete" @click="handleDeleteBomItem(row)" />
            </template>
          </el-table-column>
        </el-table>
        <div class="table-footer">
          <span class="total-label">原料成本合计:</span>
          <span class="total-value">{{ materialCostTotal.toFixed(2) }} 元</span>
        </div>
      </el-card>

      <!-- Labor Cost Table (人工费用表) -->
      <el-card class="table-card" shadow="never">
        <template #header>
          <div class="table-header">
            <span class="table-title">人工费用表</span>
            <div class="table-actions">
              <el-button v-if="canWrite" type="primary" size="small" :icon="Plus" @click="handleAddLaborCost">
                添加
              </el-button>
              <el-button size="small" :icon="Download" @click="exportToExcel('labor')">导出</el-button>
            </div>
          </div>
        </template>
        <el-table :data="laborCosts" stripe border size="small" style="width: 100%">
          <el-table-column prop="processName" label="工序名称" min-width="120" show-overflow-tooltip />
          <el-table-column prop="unitPrice" label="工序单价" width="90" align="right">
            <template #default="{ row }">
              {{ (row.unitPrice || 0).toFixed(4) }}
            </template>
          </el-table-column>
          <el-table-column prop="priceUnit" label="工序单位" width="80" align="center" />
          <el-table-column prop="standardQuantity" label="操作量" width="80" align="right">
            <template #default="{ row }">
              {{ (row.standardQuantity || 1).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column label="费用小计" width="100" align="right">
            <template #default="{ row }">
              {{ ((row.unitPrice || 0) * (row.standardQuantity || 1)).toFixed(4) }}
            </template>
          </el-table-column>
          <el-table-column prop="processCategory" label="工序大类" width="100" show-overflow-tooltip />
          <el-table-column label="操作" width="100" fixed="right" align="center">
            <template #default="{ row }">
              <el-button v-if="canWrite" type="primary" link size="small" :icon="Edit" @click="handleEditLaborCost(row)" />
              <el-button v-if="canWrite" type="danger" link size="small" :icon="Delete" @click="handleDeleteLaborCost(row)" />
            </template>
          </el-table-column>
        </el-table>
        <div class="table-footer">
          <span class="total-label">人工费用合计:</span>
          <span class="total-value">{{ laborCostTotal.toFixed(4) }} 元</span>
        </div>
      </el-card>

      <!-- Overhead Cost Table (均摊费用表) -->
      <el-card class="table-card" shadow="never">
        <template #header>
          <div class="table-header">
            <span class="table-title">均摊费用表</span>
            <div class="table-actions">
              <el-button v-if="canWrite" type="primary" size="small" :icon="Plus" @click="handleAddOverheadCost">
                添加
              </el-button>
              <el-button size="small" :icon="Download" @click="exportToExcel('overhead')">导出</el-button>
            </div>
          </div>
        </template>
        <el-table :data="overheadCosts" stripe border size="small" style="width: 100%">
          <el-table-column prop="name" label="名称" min-width="120" show-overflow-tooltip />
          <el-table-column prop="unitPrice" label="单价" width="90" align="right">
            <template #default="{ row }">
              {{ (row.unitPrice || 0).toFixed(4) }}
            </template>
          </el-table-column>
          <el-table-column prop="priceUnit" label="分摊单位" width="80" align="center" />
          <el-table-column prop="allocationRate" label="分摊量" width="80" align="right">
            <template #default="{ row }">
              {{ (row.allocationRate || 1).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column label="费用小计" width="100" align="right">
            <template #default="{ row }">
              {{ ((row.unitPrice || 0) * (row.allocationRate || 1)).toFixed(4) }}
            </template>
          </el-table-column>
          <el-table-column prop="category" label="费用类别" width="100" show-overflow-tooltip />
          <el-table-column label="操作" width="100" fixed="right" align="center">
            <template #default="{ row }">
              <el-button v-if="canWrite" type="primary" link size="small" :icon="Edit" @click="handleEditOverheadCost(row)" />
              <el-button v-if="canWrite" type="danger" link size="small" :icon="Delete" @click="handleDeleteOverheadCost(row)" />
            </template>
          </el-table-column>
        </el-table>
        <div class="table-footer">
          <span class="total-label">均摊费用合计:</span>
          <span class="total-value">{{ overheadCostTotal.toFixed(4) }} 元</span>
        </div>
      </el-card>
    </div>

    <!-- BOM Item Dialog -->
    <el-dialog v-model="bomDialogVisible" :title="isBomEdit ? '编辑原辅料' : '添加原辅料'" width="550px">
      <el-form :model="bomForm" label-width="100px">
        <el-form-item label="物料名称" required>
          <el-input v-model="bomForm.materialName" placeholder="请输入物料名称" />
        </el-form-item>
        <el-form-item label="关联原料">
          <el-select v-model="bomForm.materialTypeId" placeholder="选择原料类型(可选)" clearable style="width: 100%">
            <el-option
              v-for="item in materialTypes"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="成品含量" required>
          <el-input-number v-model="bomForm.standardQuantity" :min="0" :precision="4" :step="0.01" style="width: 100%" />
        </el-form-item>
        <el-form-item label="出成率%">
          <el-input-number v-model="bomForm.yieldRate" :min="0" :max="100" :precision="2" :step="1" style="width: 100%" />
          <div class="form-tip">输入百分比数值,如61表示61%</div>
        </el-form-item>
        <el-form-item label="计量单位">
          <el-input v-model="bomForm.unit" placeholder="如: kg" />
        </el-form-item>
        <el-form-item label="单价">
          <el-input-number v-model="bomForm.unitPrice" :min="0" :precision="4" :step="0.1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="税率%">
          <el-input-number v-model="bomForm.taxRate" :min="0" :max="100" :precision="0" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="bomForm.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bomDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="bomDialogLoading" @click="submitBomForm">确定</el-button>
      </template>
    </el-dialog>

    <!-- Labor Cost Dialog -->
    <el-dialog v-model="laborDialogVisible" :title="isLaborEdit ? '编辑人工费用' : '添加人工费用'" width="500px">
      <el-form :model="laborForm" label-width="100px">
        <el-form-item label="工序名称" required>
          <el-input v-model="laborForm.processName" placeholder="请输入工序名称" />
        </el-form-item>
        <el-form-item label="工序大类">
          <el-select v-model="laborForm.processCategory" placeholder="选择工序类别" clearable style="width: 100%">
            <el-option v-for="cat in processCategories" :key="cat" :label="cat" :value="cat" />
          </el-select>
        </el-form-item>
        <el-form-item label="工序单价" required>
          <el-input-number v-model="laborForm.unitPrice" :min="0" :precision="4" :step="0.01" style="width: 100%" />
        </el-form-item>
        <el-form-item label="工序单位">
          <el-input v-model="laborForm.priceUnit" placeholder="如: 元/kg" />
        </el-form-item>
        <el-form-item label="操作量">
          <el-input-number v-model="laborForm.standardQuantity" :min="0" :precision="2" :step="0.1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="laborForm.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="laborDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="laborDialogLoading" @click="submitLaborForm">确定</el-button>
      </template>
    </el-dialog>

    <!-- Overhead Cost Dialog -->
    <el-dialog v-model="overheadDialogVisible" :title="isOverheadEdit ? '编辑均摊费用' : '添加均摊费用'" width="500px">
      <el-form :model="overheadForm" label-width="100px">
        <el-form-item label="费用名称" required>
          <el-input v-model="overheadForm.name" placeholder="请输入费用名称" />
        </el-form-item>
        <el-form-item label="费用类别">
          <el-select v-model="overheadForm.category" placeholder="选择费用类别" clearable style="width: 100%">
            <el-option v-for="cat in overheadCategories" :key="cat" :label="cat" :value="cat" />
          </el-select>
        </el-form-item>
        <el-form-item label="单价" required>
          <el-input-number v-model="overheadForm.unitPrice" :min="0" :precision="4" :step="0.01" style="width: 100%" />
        </el-form-item>
        <el-form-item label="分摊单位">
          <el-input v-model="overheadForm.priceUnit" placeholder="如: 元/kg" />
        </el-form-item>
        <el-form-item label="分摊量">
          <el-input-number v-model="overheadForm.allocationRate" :min="0" :precision="2" :step="0.1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="overheadForm.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="overheadDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="overheadDialogLoading" @click="submitOverheadForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.bom-page {
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: auto;
}

.header-card {
  flex-shrink: 0;

  :deep(.el-card__body) {
    padding: 16px 20px;
  }
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.cost-summary-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;

  :deep(.el-card__body) {
    padding: 12px 16px;
  }
}

.cost-summary {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.cost-item {
  display: flex;
  align-items: center;
  gap: 6px;

  .cost-label {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.85);
  }

  .cost-value {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }

  &.total {
    padding-left: 16px;
    border-left: 1px solid rgba(255, 255, 255, 0.3);

    .cost-label {
      font-size: 14px;
      color: #fff;
    }

    .cost-value {
      font-size: 18px;
      color: #ffd700;
    }
  }
}

.tables-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.table-card {
  flex-shrink: 0;

  :deep(.el-card__header) {
    padding: 12px 16px;
    background: #fafafa;
    border-bottom: 1px solid #ebeef5;
  }

  :deep(.el-card__body) {
    padding: 16px;
  }
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.table-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.table-actions {
  display: flex;
  gap: 8px;
}

.table-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px solid #ebeef5;

  .total-label {
    font-size: 14px;
    color: #606266;
    margin-right: 8px;
  }

  .total-value {
    font-size: 16px;
    font-weight: 600;
    color: #e6a23c;
  }
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
