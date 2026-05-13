<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post, put, del } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Edit, Delete, Download, Refresh } from '@element-plus/icons-vue';
import BomChangeLog from './BomChangeLog.vue'
import CanvasAwareWrapper from '@/components/canvas/CanvasAwareWrapper.vue'
import ConceptDisambiguationAlert from '@/components/common/ConceptDisambiguationAlert.vue'
import type { TableRow } from '@/types/api';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('production'));
const canViewPrice = computed(() => permissionStore.canViewPrice);

// State
const loading = ref(false);
const changeLogVisible = ref(false)
const selectedProductTypeId = ref<string>('');
const productTypes = ref<TableRow[]>([]);
const costSummary = ref<TableRow | null>(null);

// BOM Items (原辅料)
interface BomItemRow {
  id?: number | null;
  productTypeId?: string;
  materialTypeId?: string;
  materialName?: string;
  standardQuantity?: number;
  yieldRate?: number;
  unit?: string;
  unitPrice?: number;
  taxRate?: number;
  sortOrder?: number;
  notes?: string;
  [k: string]: unknown;
}
interface LaborCostRow {
  id?: number | null;
  productTypeId?: string;
  processName?: string;
  processCategory?: string;
  unitPrice?: number;
  priceUnit?: string;
  standardQuantity?: number;
  sortOrder?: number;
  notes?: string;
  [k: string]: unknown;
}
interface OverheadCostRow {
  id?: number | null;
  name?: string;
  category?: string;
  unitPrice?: number;
  priceUnit?: string;
  allocationRate?: number;
  sortOrder?: number;
  notes?: string;
  [k: string]: unknown;
}
const bomItems = ref<BomItemRow[]>([]);
const bomDialogVisible = ref(false);
const bomDialogLoading = ref(false);
const isBomEdit = ref(false);
// D3 (2026-05-10 客户会议): BOM 配方层默认用 g, 仓库 / 调拨层用 kg, 后台 1:1000 自动换算
const bomForm = ref({
  id: null as number | null,
  productTypeId: '',
  materialTypeId: '',
  materialName: '',
  materialCategory: 'RAW',
  standardQuantity: 0,
  yieldRate: 100,
  unit: 'g',
  unitPrice: 0,
  taxRate: 13,
  sortOrder: 0,
  notes: ''
});

// D2 (2026-05-10 客户会议): 实时计算实际原料用量 = 成品含量 / (出成率/100)
// 镜像后端 BomItem.getActualQuantity()
const computedActualQuantity = computed(() => {
  const sq = Number(bomForm.value.standardQuantity) || 0;
  const yr = (Number(bomForm.value.yieldRate) || 100) / 100;
  if (yr <= 0 || sq <= 0) return 0;
  return Number((sq / yr).toFixed(4));
});

// Labor Costs (人工费用)
const laborCosts = ref<LaborCostRow[]>([]);
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
const overheadCosts = ref<OverheadCostRow[]>([]);
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
const materialTypes = ref<TableRow[]>([]);

// Per-serving cost calculation
const standardServingWeight = ref<number>(0.5); // kg per serving, user-adjustable

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
      // Issue 7: Only show finished products in BOM dropdown
      productTypes.value = (response.data as TableRow[]).filter(
        (p: TableRow) => p.productCategory === 'FINISHED_PRODUCT' || p.category === '成品' || !p.productCategory
      );
      // Select first product if available
      if (productTypes.value.length > 0 && !selectedProductTypeId.value) {
        selectedProductTypeId.value = productTypes.value[0].id;
      }
    }
  } catch (error: any) {
    console.error('Failed to load product types:', error);
    if (!error?.actionHint) ElMessage.error('加载产品类型失败');
  }
}

async function loadMaterialTypes() {
  if (!factoryId.value) return;
  try {
    // Issue 8: Fetch ALL active materials to stay in sync with material master
    const response = await get(`/${factoryId.value}/raw-material-types/active`);
    if (response.success && response.data) {
      materialTypes.value = Array.isArray(response.data) ? response.data : (response.data.content || []);
    }
  } catch (error: any) {
    console.error('Failed to load material types:', error);
    if (!error?.actionHint) ElMessage.error('加载原料类型失败');
  }
}

// B8 fix (2026-05-10): 关联原料下拉 @change handler, 自动回填名称/单位.
// Ref: docs/qa-audits/2026-05-10-customer-meeting-9bug-audit.md §B8
function onMaterialLink(materialTypeId: string) {
  if (!materialTypeId) return;
  const material = materialTypes.value.find((m: Record<string, unknown>) => m.id === materialTypeId);
  if (material) {
    if (material.name) bomForm.value.materialName = String(material.name);
    if (material.unit) bomForm.value.unit = String(material.unit);
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
  } catch (error: any) {
    console.error('Failed to load BOM items:', error);
    if (!error?.actionHint) ElMessage.error('Failed to load BOM data');
  } finally {
    loading.value = false;
  }
}

function handleAddBomItem() {
  isBomEdit.value = false;
  // D3: 新建 BOM 默认单位为 g (克), 后台调拨时自动换算为 kg (千克)
  bomForm.value = {
    id: null,
    productTypeId: selectedProductTypeId.value,
    materialTypeId: '',
    materialName: '',
    materialCategory: activeCategoryTab.value,
    standardQuantity: 0,
    yieldRate: 100,
    unit: 'g',
    unitPrice: 0,
    taxRate: 13,
    sortOrder: bomItems.value.length,
    notes: ''
  };
  bomDialogVisible.value = true;
}

function handleEditBomItem(row: TableRow) {
  isBomEdit.value = true;
  bomForm.value = {
    id: row.id,
    productTypeId: row.productTypeId,
    materialTypeId: row.materialTypeId,
    materialName: row.materialName,
    materialCategory: (row.materialCategory as string) || 'RAW',
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
      // BUG-4 fix (depth-e2e qa-v2.4, PR #370): strip phantom `id: null` from POST body.
      // handleAddBomItem 设 `id: null` 给 form 一致性, 但 POST 不应携带 id (Jackson 当前默默 drop,
      // 但在未来 FAIL_ON_UNKNOWN_PROPERTIES strict mode 会爆 400).
      const { id, ...payload } = bomForm.value;
      response = await post(`/${factoryId.value}/bom/items`, payload);
    }
    if (response.success) {
      ElMessage.success(isBomEdit.value ? 'Updated successfully' : 'Added successfully');
      bomDialogVisible.value = false;
      await loadBomItems();
      await loadCostSummary();
    } else {
      ElMessage.error(response.message || 'Operation failed');
    }
  } catch (error: any) {
    if (!error?.actionHint) ElMessage.error('Operation failed');
  } finally {
    bomDialogLoading.value = false;
  }
}

async function handleDeleteBomItem(row: TableRow) {
  try {
    await ElMessageBox.confirm('Are you sure you want to delete this item?', 'Confirm', { type: 'warning' });
    const response = await del(`/${factoryId.value}/bom/items/${row.id}`);
    if (response.success) {
      ElMessage.success('Deleted successfully');
      await loadBomItems();
      await loadCostSummary();
    } else {
      ElMessage.error(response.message || 'Delete failed');
    }
  } catch (error: any) {
    if (error !== 'cancel' && !error?.actionHint) {
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
  } catch (error: any) {
    console.error('Failed to load labor costs:', error);
    if (!error?.actionHint) ElMessage.error('加载人工费用失败');
  }
}

async function loadAllLaborCosts() {
  if (!factoryId.value) return;
  try {
    const response = await get(`/${factoryId.value}/bom/labor/all`);
    if (response.success && response.data) {
      // Store all labor costs for reference
    }
  } catch (error: any) {
    console.error('Failed to load all labor costs:', error);
    if (!error?.actionHint) ElMessage.error('加载人工费用汇总失败');
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

function handleEditLaborCost(row: TableRow) {
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
    } else {
      ElMessage.error(response.message || 'Operation failed');
    }
  } catch (error: any) {
    if (!error?.actionHint) ElMessage.error('Operation failed');
  } finally {
    laborDialogLoading.value = false;
  }
}

async function handleDeleteLaborCost(row: TableRow) {
  try {
    await ElMessageBox.confirm('Are you sure you want to delete this item?', 'Confirm', { type: 'warning' });
    const response = await del(`/${factoryId.value}/bom/labor/${row.id}`);
    if (response.success) {
      ElMessage.success('Deleted successfully');
      await loadLaborCosts();
      await loadCostSummary();
    } else {
      ElMessage.error(response.message || 'Delete failed');
    }
  } catch (error: any) {
    if (error !== 'cancel' && !error?.actionHint) {
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
  } catch (error: any) {
    console.error('Failed to load overhead costs:', error);
    if (!error?.actionHint) ElMessage.error('加载均摊费用失败');
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

function handleEditOverheadCost(row: TableRow) {
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
    } else {
      ElMessage.error(response.message || 'Operation failed');
    }
  } catch (error: any) {
    if (!error?.actionHint) ElMessage.error('Operation failed');
  } finally {
    overheadDialogLoading.value = false;
  }
}

async function handleDeleteOverheadCost(row: TableRow) {
  try {
    await ElMessageBox.confirm('Are you sure you want to delete this item?', 'Confirm', { type: 'warning' });
    const response = await del(`/${factoryId.value}/bom/overhead/${row.id}`);
    if (response.success) {
      ElMessage.success('Deleted successfully');
      await loadOverheadCosts();
      await loadCostSummary();
    } else {
      ElMessage.error(response.message || 'Delete failed');
    }
  } catch (error: any) {
    if (error !== 'cancel' && !error?.actionHint) {
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
  } catch (error: any) {
    console.error('Failed to load cost summary:', error);
    if (!error?.actionHint) ElMessage.error('加载成本汇总失败');
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

// Issue 12: Group BOM items by material category
const groupedBomItems = computed(() => {
  const groups: { category: string; items: TableRow[] }[] = [];
  const categoryMap = new Map<string, TableRow[]>();
  const categoryOrder = ['原材料', '辅料', '包材', '调味料', '其他'];

  for (const item of bomItems.value) {
    // Try to get category from linked material or fall back
    const cat = String(item.materialCategory || item.category || '其他');
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(item);
  }

  // Sort by predefined order
  for (const cat of categoryOrder) {
    if (categoryMap.has(cat)) {
      groups.push({ category: cat, items: categoryMap.get(cat)! });
      categoryMap.delete(cat);
    }
  }
  // Any remaining categories
  for (const [cat, items] of categoryMap) {
    groups.push({ category: cat, items });
  }

  return groups;
});

const hasMultipleCategories = computed(() => groupedBomItems.value.length > 1);

// P0-14: Tab filtering by materialCategory (RAW/AUXILIARY/PACKAGING)
const activeCategoryTab = ref<'RAW' | 'AUXILIARY' | 'PACKAGING'>('RAW');
function matchCategory(row: TableRow, code: 'RAW' | 'AUXILIARY' | 'PACKAGING') {
  const c = String(row.materialCategory || row.category || '').toUpperCase();
  if (code === 'RAW') return c === 'RAW' || c === '原材料' || c === '' || c === '其他';
  if (code === 'AUXILIARY') return c === 'AUXILIARY' || c === '辅料' || c === '调味料';
  if (code === 'PACKAGING') return c === 'PACKAGING' || c === '包材';
  return false;
}
const rawItems = computed(() => bomItems.value.filter((i: TableRow) => matchCategory(i, 'RAW')));
const auxiliaryItems = computed(() => bomItems.value.filter((i: TableRow) => matchCategory(i, 'AUXILIARY')));
const packagingItems = computed(() => bomItems.value.filter((i: TableRow) => matchCategory(i, 'PACKAGING')));
const currentTabItems = computed(() => {
  if (activeCategoryTab.value === 'RAW') return rawItems.value;
  if (activeCategoryTab.value === 'AUXILIARY') return auxiliaryItems.value;
  return packagingItems.value;
});

// Issue 11: Cost per serving
const costPerServing = computed(() => {
  if (standardServingWeight.value <= 0) return 0;
  return totalCost.value * standardServingWeight.value;
});

// ========== Export ==========
function exportToExcel(type: string) {
  let headers: string[];
  let rows: string[][];
  if (type === 'material') {
    if (bomItems.value.length === 0) { ElMessage.warning('暂无BOM数据可导出'); return; }
    headers = ['物料名称', '物料编号', '数量', '单位', '单价(元)', '小计(元)', '备注'];
    rows = bomItems.value.map((item: TableRow) => [
      item.materialName || '', item.materialCode || '', String(item.quantity ?? ''),
      item.unit || '', String(item.unitPrice ?? ''),
      String(((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)), item.notes || ''
    ]);
  } else if (type === 'labor') {
    if (laborCosts.value.length === 0) { ElMessage.warning('暂无人工成本数据'); return; }
    headers = ['工序名称', '工时(分钟)', '单价(元/时)', '费用(元)'];
    rows = laborCosts.value.map((item: TableRow) => [
      item.processName || '', String(item.duration ?? ''), String(item.unitPrice ?? ''),
      String(((item.duration || 0) / 60 * (item.unitPrice || 0)).toFixed(2))
    ]);
  } else {
    if (overheadCosts.value.length === 0) { ElMessage.warning('暂无制造费用数据'); return; }
    headers = ['费用名称', '金额(元)', '分摊率', '分摊金额(元)'];
    rows = overheadCosts.value.map((item: TableRow) => [
      item.name || '', String(item.unitPrice ?? ''), String(item.allocationRate ?? 1),
      String(((item.unitPrice || 0) * (item.allocationRate || 1)).toFixed(2))
    ]);
  }
  const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `BOM_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  ElMessage.success('导出成功');
}

function refreshData() {
  loadBomItems();
  loadLaborCosts();
  loadOverheadCosts();
  loadCostSummary();
}
</script>

<template>
  <CanvasAwareWrapper module-code="bom">
  <div class="bom-page">
    <!-- D4 Path B (2026-05-10 customer meeting, PR #309 A2=B): BomExpansionService 现已优先读 bom_items 表. -->
    <!-- BOM 编辑保存后立即对生产计划生效, 无需再手动同步到转换率配置. -->
    <!-- RPF (MaterialProductConversion) 仅作 fallback (老工厂数据无 BOM 配置时沿用). -->
    <!-- 详见 docs/architecture/2026-05-10-rpf-vs-bomitem-divergence.md §7 -->
    <el-alert
      type="success"
      :closable="false"
      show-icon
      style="margin-bottom: 12px;"
    >
      <template #title>
        BOM 已对接生产计划, 录入即生效
      </template>
      <template #default>
        本页录入的 BOM 配方 (含成品含量 + 出成率% + 单位) 保存后立即被生产计划自动展开使用,
        无需再同步「转换率配置」(RPF)。RPF 表保留作为老工厂数据的 fallback。
      </template>
    </el-alert>
    <ConceptDisambiguationAlert
      here-name="BOM 成本管理"
      here="一个成品需要哪些原料、各多少量、成本如何拆分（多对多结构 + 成本核算）"
      other-name="生产管理 → 转换率配置"
      other="单一原料 → 单一成品的「出成率」（如 1kg 冻猪蹄 → 600g 卤猪蹄，60%）"
      other-path="/production/conversions"
      consequence="复杂配方用 BOM，简单出成率用转换率"
    />
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
          <el-button style="margin-left: 12px;" @click="changeLogVisible = true" :disabled="!selectedProductTypeId">变更记录</el-button>
        </div>
        <div v-if="canViewPrice" class="header-right">
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
              <!-- Issue 11: Per-serving cost -->
              <div class="cost-item serving">
                <el-input-number
                  v-model="standardServingWeight"
                  :min="0.01" :max="100" :precision="2" :step="0.1"
                  size="small"
                  style="width: 90px;"
                />
                <span class="cost-label" style="margin-left: 4px;">kg/份</span>
                <span class="cost-value" style="margin-left: 8px;">{{ costPerServing.toFixed(2) }} 元/份</span>
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
        <el-tabs v-model="activeCategoryTab" class="bom-category-tabs">
          <el-tab-pane name="RAW" :label="`原料 (${rawItems.length})`" />
          <el-tab-pane name="AUXILIARY" :label="`辅料 (${auxiliaryItems.length})`" />
          <el-tab-pane name="PACKAGING" :label="`包材 (${packagingItems.length})`" />
        </el-tabs>
        <el-table empty-text="暂无数据" :data="currentTabItems" v-loading="loading" stripe border size="small" style="width: 100%"
          :row-class-name="({ row }: { row: TableRow }) => row._isCategoryHeader ? 'category-header-row' : ''">
          <!-- Issue 12: Show material category column -->
          <el-table-column prop="materialCategory" label="类型" width="70" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="row.materialCategory === '原材料' ? '' : row.materialCategory === '包材' ? 'warning' : 'info'" disable-transitions>
                {{ row.materialCategory || row.category || '-' }}
              </el-tag>
            </template>
          </el-table-column>
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
          <!-- Issue 13: Conversion rate inline -->
          <el-table-column label="转换率" width="80" align="right">
            <template #default="{ row }">
              {{ row.conversionRate ? row.conversionRate.toFixed(4) : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="原料投量/份" width="100" align="right">
            <template #default="{ row }">
              {{ row.conversionRate
                ? ((row.standardQuantity || 0) / row.conversionRate).toFixed(4)
                : ((row.standardQuantity || 0) / ((row.yieldRate || 100) / 100)).toFixed(4) }}
            </template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="60" align="center" />
          <el-table-column v-if="canViewPrice" prop="unitPrice" label="单价(含税)" width="90" align="right">
            <template #default="{ row }">
              {{ (row.unitPrice || 0).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column v-if="canViewPrice" prop="taxRate" label="税率%" width="70" align="right">
            <template #default="{ row }">
              {{ (row.taxRate || 0).toFixed(0) }}%
            </template>
          </el-table-column>
          <el-table-column v-if="canViewPrice" label="小计" width="90" align="right">
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
        <div v-if="canViewPrice" class="table-footer">
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
          <el-table-column v-if="canViewPrice" prop="unitPrice" label="工序单价" width="90" align="right">
            <template #default="{ row }">
              {{ (row.unitPrice || 0).toFixed(4) }}
            </template>
          </el-table-column>
          <el-table-column v-if="canViewPrice" prop="priceUnit" label="工序单位" width="80" align="center" />
          <el-table-column prop="standardQuantity" label="操作量" width="80" align="right">
            <template #default="{ row }">
              {{ (row.standardQuantity || 1).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column v-if="canViewPrice" label="费用小计" width="100" align="right">
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
        <div v-if="canViewPrice" class="table-footer">
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
          <el-table-column v-if="canViewPrice" prop="unitPrice" label="单价" width="90" align="right">
            <template #default="{ row }">
              {{ (row.unitPrice || 0).toFixed(4) }}
            </template>
          </el-table-column>
          <el-table-column v-if="canViewPrice" prop="priceUnit" label="分摊单位" width="80" align="center" />
          <el-table-column prop="allocationRate" label="分摊量" width="80" align="right">
            <template #default="{ row }">
              {{ (row.allocationRate || 1).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column v-if="canViewPrice" label="费用小计" width="100" align="right">
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
        <div v-if="canViewPrice" class="table-footer">
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
        <el-form-item label="物料类别" required>
          <el-select v-model="bomForm.materialCategory" style="width: 100%">
            <el-option label="原料" value="RAW" />
            <el-option label="辅料" value="AUXILIARY" />
            <el-option label="包材" value="PACKAGING" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联原料">
          <el-select v-model="bomForm.materialTypeId" placeholder="选择原料类型(可选)" clearable style="width: 100%" @change="onMaterialLink">
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
          <div class="form-tip">D2: 输入一份成品的标准用量, 系统按出成率自动算所需原料</div>
        </el-form-item>
        <el-form-item label="出成率%">
          <el-input-number v-model="bomForm.yieldRate" :min="0" :max="100" :precision="2" :step="1" style="width: 100%" />
          <div class="form-tip">输入百分比数值,如61表示61%</div>
        </el-form-item>
        <!-- D2: 实时显示实际原料用量 (考虑出成率) -->
        <el-form-item label="实际原料用量">
          <div class="bom-computed-quantity">
            {{ computedActualQuantity.toFixed(4) }} {{ bomForm.unit || 'g' }}
          </div>
          <div class="form-tip">
            = 成品含量 ÷ (出成率/100) | 示例: 200g 成品 × 58% 出成率 → 自动算原料 344.83g
          </div>
        </el-form-item>
        <el-form-item label="计量单位">
          <el-select v-model="bomForm.unit" placeholder="选择单位" style="width: 100%">
            <el-option label="克 (g)" value="g" />
            <el-option label="千克 (kg)" value="kg" />
            <el-option label="毫升 (mL)" value="mL" />
            <el-option label="升 (L)" value="L" />
            <el-option label="件 (pcs)" value="pcs" />
          </el-select>
          <div class="form-tip">D3: 建议选 g (克), 系统调拨时自动按 1:1000 换算为 kg (千克)</div>
        </el-form-item>
        <el-form-item v-if="canViewPrice" label="单价（含税）">
          <el-input-number v-model="bomForm.unitPrice" :min="0" :precision="4" :step="0.1" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="canViewPrice" label="税率%">
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
        <el-form-item v-if="canViewPrice" label="工序单价" required>
          <el-input-number v-model="laborForm.unitPrice" :min="0" :precision="4" :step="0.01" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="canViewPrice" label="工序单位">
          <el-input v-model="laborForm.priceUnit" placeholder="如: 元/kg" />
        </el-form-item>
        <el-form-item label="操作量">
          <el-input-number v-model="laborForm.standardQuantity" :min="0" :precision="2" :step="0.1" style="width: 100%" />
        </el-form-item>
        <!-- Issue 10: Real-time subtotal calculation -->
        <el-form-item v-if="canViewPrice" label="费用小计">
          <div class="labor-subtotal">
            {{ ((laborForm.unitPrice || 0) * (laborForm.standardQuantity || 1)).toFixed(4) }} 元
          </div>
          <div class="form-tip">= 工序单价 × 操作量</div>
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
        <el-form-item v-if="canViewPrice" label="单价" required>
          <el-input-number v-model="overheadForm.unitPrice" :min="0" :precision="4" :step="0.01" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="canViewPrice" label="分摊单位">
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

    <!-- BOM Change Log Drawer (P1-9) -->
    <BomChangeLog v-model:visible="changeLogVisible" :factory-id="factoryId" :product-type-id="selectedProductTypeId" />
  </div>
  </CanvasAwareWrapper>
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

.labor-subtotal {
  font-size: 16px;
  font-weight: 600;
  color: #e6a23c;
  line-height: 32px;
}

/* D2: 实际原料用量实时计算显示 */
.bom-computed-quantity {
  font-size: 16px;
  font-weight: 600;
  color: #67c23a;
  line-height: 32px;
}

.cost-item.serving {
  display: flex;
  align-items: center;

  .cost-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.75);
  }

  .cost-value {
    font-size: 15px;
    font-weight: 600;
    color: #90ee90;
  }
}
</style>
