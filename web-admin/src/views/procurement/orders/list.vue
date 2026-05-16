<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { useBusinessMode } from '@/composables/useBusinessMode';
import request, { get, post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Refresh, ChatDotRound, Download } from '@element-plus/icons-vue';
import AiEntryDrawer from '@/components/ai-entry/AiEntryDrawer.vue';
import { PURCHASE_ORDER_CONFIG } from '@/components/ai-entry/types';
import { formatAmount } from '@/utils/tableFormatters';
import CanvasDynamicFields from '@/components/canvas/CanvasDynamicFields.vue';
import CanvasAwareWrapper from '@/components/canvas/CanvasAwareWrapper.vue';
import ConceptDisambiguationAlert from '@/components/common/ConceptDisambiguationAlert.vue';
import type { TableRow } from '@/types/api';
import { RowActionMenu } from '@/components/list';
import { computeRowActions } from '@/composables/useRowActions';

const router = useRouter();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const { label } = useBusinessMode();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('procurement'));

const canViewPrice = computed(() => permissionStore.canViewPrice);

function rowActionsFor(row: TableRow) {
  return computeRowActions(
    'purchaseOrder',
    { status: String(row.status || ''), id: String(row.id || '') },
    { canViewPrice: canViewPrice.value }
  );
}
function handleRowActionClick(actionId: string, row: TableRow) {
  switch (actionId) {
    case 'view-detail': goDetail(String(row.id)); break;
    case 'submit': handleAction(String(row.id), 'submit'); break;
    case 'approve': handleAction(String(row.id), 'approve'); break;
    case 'reject': handleAction(String(row.id), 'reject'); break;
    case 'cancel': handleAction(String(row.id), 'cancel'); break;
    case 'print-pdf': handleDownloadPdf(row); break;
    case 'copy': ElMessage.info(`复制采购单 ${row.orderNumber} (待接 API)`); break;
    case 'return': ElMessage.info(`发起退货 (待接 returnOrder API): ${row.id}`); break;
    default: ElMessage.info(`Action: ${actionId}`);
  }
}
function openAiForRow(row: TableRow) {
  console.info('[RowAction AI]', { entityType: 'purchaseOrder', entityId: row.id, orderNumber: row.orderNumber });
  aiEntryVisible.value = true;
}

const loading = ref(false);
const tableData = ref<TableRow[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const statusFilter = ref('');
const searchKeyword = ref('');
const dateRange = ref<[string, string] | null>(null);
const dialogVisible = ref(false);

interface ProcurementOrderItem {
  materialTypeId: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  specification?: string;
  boxQuantity?: number;
}

const form = ref({
  supplierId: '',
  purchaseType: 'DIRECT',
  expectedDeliveryDate: '',
  remark: '',
  relatedSalesOrderId: '',
  items: [{ materialTypeId: '', quantity: 0, unit: 'kg', unitPrice: 0 }] as ProcurementOrderItem[],
  customFields: {} as TableRow,
});
const suppliers = ref<TableRow[]>([]);
const materials = ref<TableRow[]>([]);
const salesOrders = ref<TableRow[]>([]);

// 包装层级缓存: materialTypeId → { level1Unit, level2Unit, level3Unit, level1PerLevel2 }
// 选原料后调 /material-packaging/by-material/{id} 拉取, 用于单位下拉 + 自动算箱数 (P1-2)
const packagingCache = ref<Record<string, {
  level1Unit?: string;
  level2Unit?: string | null;
  level3Unit?: string | null;
  level1PerLevel2?: number | null;
}>>({});

async function ensurePackagingLoaded(materialId: string) {
  if (!materialId || packagingCache.value[materialId]) return;
  try {
    const res = await get<{
      level1Unit?: string;
      level2Unit?: string | null;
      level3Unit?: string | null;
      level1PerLevel2?: number | null;
    } | null>(
      `/${factoryId.value}/material-packaging/by-material/${materialId}`,
    );
    packagingCache.value[materialId] = res.data || {};
  } catch {
    packagingCache.value[materialId] = {};
  }
}

function getUnitOptionsForItem(item: TableRow): { value: string; label: string }[] {
  const matId = String(item.materialTypeId || '');
  const set = new Set<string>();
  // 优先该原料的 1/2/3 级单位
  const pkg = packagingCache.value[matId];
  if (pkg) {
    if (pkg.level1Unit) set.add(pkg.level1Unit);
    if (pkg.level2Unit) set.add(pkg.level2Unit);
    if (pkg.level3Unit) set.add(pkg.level3Unit);
  }
  // 兜底: 该原料的默认 unit (如果有 packaging 已经在内)
  const mat = materials.value.find((m) => m.id === matId);
  if (mat && mat.unit) set.add(String(mat.unit));
  // 当前已选的 unit (历史值兼容)
  const cur = String(item.unit || '');
  if (cur && !set.has(cur)) set.add(cur);
  return Array.from(set).map((u) => ({ value: u, label: u }));
}

function onItemMaterialChange(item: TableRow) {
  const matId = String(item.materialTypeId || '');
  if (!matId) return;
  ensurePackagingLoaded(matId).then(() => {
    // 选原料后默认带入该原料的一级单位 (除非用户已经填了)
    const mat = materials.value.find((m) => m.id === matId);
    if (mat && mat.unit && !item.unit) item.unit = String(mat.unit);
    recalcBoxQuantity(item);  // P1-2: packaging 拉到后立即算箱数
  });
}

/**
 * P1-2/3 (audio May 7 客户通话): 箱数自动算 + 抄码品识别.
 *
 * 客户原话: "規格寫是抄码那我在折算箱數的時候比如說那個規格是抄码,
 * 那個箱數自動會顯示抄码品, 然後就不顯示多少箱". 抄码 = 餐饮/食品行业
 * 称重商品 (每箱重量不一致, 如鲜牛肉/鲜鱼), 不能按箱计.
 *
 * 双轨说明: 这是 LEGACY 实现. CANVAS DynamicModulePage 等 Phase B C-6
 * 框架落地 (ReferenceSelector projectFields + SpEL evaluator), 见
 * docs/superpowers/specs/2026-05-09-canvas-c6-reactive-default-framework.md
 */
/**
 * R2 fix #3: 精确匹配 trim() === '抄码', 不用 includes.
 * 旧: includes 误报 — "抄码区限量款" / "抄码加工标识" 都会被识别为抄码品.
 * 客户原话 "規格寫是抄码" 暗示 spec 字面值就是 "抄码", 而非含 "抄码" 子串.
 * 后续如客户报漏匹配 (繁体 "抄碼" / 含空格), 改加 normalize: trim + lower + 简繁同义.
 */
function isAbacaItem(item: TableRow): boolean {
  return String(item.specification || '').trim() === '抄码';
}

function recalcBoxQuantity(item: TableRow) {
  if (isAbacaItem(item)) {
    item.boxQuantity = null;  // 抄码品: 不算箱数
    return;
  }
  const matId = String(item.materialTypeId || '');
  const qty = Number(item.quantity || 0);
  const pkg = packagingCache.value[matId];
  if (!pkg || qty <= 0) return;

  // I-1 reviewer fix: 用户选 1/2/3 级单位决定如何算箱数, 不再硬编码假设一级单位.
  // 旧逻辑: 任何 unit 都按 qty / level1PerLevel2 算 → 用户选"箱"时 5 箱被算成 0.5 箱.
  const unit = String(item.unit || '');
  if (!unit || unit === pkg.level1Unit) {
    // 一级单位 (如 kg) → 按转换系数算箱: box = qty / level1PerLevel2
    if (!pkg.level1PerLevel2 || Number(pkg.level1PerLevel2) <= 0) return;
    item.boxQuantity = Math.round((qty / Number(pkg.level1PerLevel2)) * 100) / 100;
  } else if (unit === pkg.level2Unit) {
    // 二级单位 (如 箱) → 数量本身就是箱数, 直接赋值
    item.boxQuantity = qty;
  }
  // 其他单位 (level3 柜 / 用户自定义 allow-create 单位) → 不自动算, 保留用户手动填值
}

const statusMap: Record<string, { text: string; type: string }> = {
  DRAFT: { text: '草稿', type: 'info' },
  SUBMITTED: { text: '已提交', type: 'warning' },
  APPROVED: { text: '已审批', type: '' },
  PARTIAL_RECEIVED: { text: '部分收货', type: 'warning' },
  COMPLETED: { text: '已完成', type: 'success' },
  CANCELLED: { text: '已取消', type: 'danger' },
  CLOSED: { text: '已关闭', type: 'info' },
};

// D13: Dirty form guard — warn user before leaving with unsaved changes
const isDirty = ref(false);
watch(dialogVisible, (val) => { isDirty.value = val; });
function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (isDirty.value) { e.preventDefault(); e.returnValue = ''; }
}
onMounted(() => {
  loadData();
  loadSuppliers();
  loadMaterials();
  loadSalesOrders();
  window.addEventListener('beforeunload', handleBeforeUnload);
});
onBeforeUnmount(() => { window.removeEventListener('beforeunload', handleBeforeUnload); });

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const url = statusFilter.value
      ? `/${factoryId.value}/purchase/orders/by-status`
      : `/${factoryId.value}/purchase/orders`;
    const params: TableRow = { page: pagination.value.page, size: pagination.value.size };
    if (statusFilter.value) params.status = statusFilter.value;
    const response = await get(url, { params });
    if (response.success && response.data) {
      let rows = response.data.content || [];
      // Client-side keyword + date filter (Apr 21 2026): backend lacks
      // keyword param on purchase/orders; filter locally on current page.
      const kw = searchKeyword.value.trim().toLowerCase();
      if (kw) {
        rows = rows.filter((r: TableRow) =>
          String(r.orderNumber || '').toLowerCase().includes(kw) ||
          String(r.supplierName || (r.supplier as TableRow)?.name || '').toLowerCase().includes(kw)
        );
      }
      if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
        const [from, to] = dateRange.value;
        rows = rows.filter((r: TableRow) => {
          const d = String(r.orderDate || '').slice(0, 10);
          return d && d >= from && d <= to;
        });
      }
      tableData.value = rows;
      pagination.value.total = response.data.totalElements || 0;
    } else if (response.success === false) {
      ElMessage.error(response.message || '加载数据失败');
    }
  } catch (error) {
    // Interceptor shows specific toast; dedupe fallback
    console.error('[失败]', error);
  } finally {
    loading.value = false;
  }
}

async function loadSuppliers() {
  if (!factoryId.value) return;
  try {
    const res = await get(`/${factoryId.value}/suppliers`, { params: { page: 1, size: 100 } });
    if (res.success && res.data) suppliers.value = res.data.content || [];
  } catch { /* axios interceptor already displayed error toast */ }
}

async function loadMaterials() {
  if (!factoryId.value) return;
  try {
    // Bug B3 fix: use /active endpoint (unpaginated, same source as BOM and warehouse)
    const res = await get(`/${factoryId.value}/raw-material-types/active`);
    if (res.success && res.data) materials.value = Array.isArray(res.data) ? res.data : res.data.content || [];
  } catch { /* axios interceptor already displayed error toast */ }
}

async function loadSalesOrders() {
  if (!factoryId.value) return;
  try {
    const res = await get(`/${factoryId.value}/sales/orders`, { params: { page: 1, size: 100 } });
    if (res.success && res.data) salesOrders.value = res.data.content || [];
  } catch { /* optional field, ignore errors */ }
}

function addItem() {
  form.value.items.push({ materialTypeId: '', quantity: 0, unit: 'kg', unitPrice: 0 });
}

function removeItem(index: number) {
  if (form.value.items.length > 1) form.value.items.splice(index, 1);
}

const submitting = ref(false);

async function handleCreate() {
  if (submitting.value) return; // P-2: prevent double-submit
  if (!form.value.supplierId) return ElMessage.warning('请选择供应商');
  if (form.value.items.some(i => !i.materialTypeId)) return ElMessage.warning('请选择所有原料');
  if (form.value.items.some(i => !i.unit)) return ElMessage.warning('请填写所有明细的单位');
  submitting.value = true;
  try {
    // W-12 fix (Round 15): previously relatedSalesOrderId was stripped from payload
    // and only embedded as "[关联销售订单: SO-XXX]" in remark. Now that the backend has
    // a proper sales_order_id column + filter (V20260424_03 + PurchaseService fix),
    // pass it through as salesOrderId. Keep the remark text for backward-compat
    // readability — users who view old POs will still see the ref.
    let remark = form.value.remark || '';
    const salesOrderId = form.value.relatedSalesOrderId || null;
    if (form.value.relatedSalesOrderId) {
      const so = salesOrders.value.find((o: TableRow) => o.id === form.value.relatedSalesOrderId);
      const soRef = so ? `[关联销售订单: ${so.orderNumber}]` : '';
      remark = soRef ? (remark ? `${soRef} ${remark}` : soRef) : remark;
    }
    const { relatedSalesOrderId: _unused, ...formData } = form.value;
    const payload = {
      ...formData,
      remark,
      salesOrderId,
      orderDate: new Date().toISOString().slice(0, 10), // backend requires @NotNull orderDate
    };
    const res = await post(`/${factoryId.value}/purchase/orders`, payload);
    if (res.success) {
      ElMessage.success('创建成功');
      dialogVisible.value = false;
      resetForm();
      loadData();
    } else {
      ElMessage.error(res.message || '创建失败');
    }
  } catch (error) {
    // Interceptor shows specific toast; dedupe fallback
    console.error('[失败]', error);
  } finally {
    submitting.value = false;
  }
}

function resetForm() {
  form.value = { supplierId: '', purchaseType: 'DIRECT', expectedDeliveryDate: '', remark: '', relatedSalesOrderId: '', items: [{ materialTypeId: '', quantity: 0, unit: 'kg', unitPrice: 0 }], customFields: {} as TableRow };
}

// 张权 Apr 28 反馈: "基础数据已经新建了 但是采购订单 下拉没有选项"
// — 用户先打开本页, dropdown 已加载; 然后跳到基础数据页新建供应商/原料;
// 切回本页打开新建对话框时, dropdown 仍是旧 cache. 修复: 每次打开对话框
// 强制刷新 3 个 dropdown 数据源.
async function openCreateDialog() {
  resetForm();
  await Promise.all([loadSuppliers(), loadMaterials(), loadSalesOrders()]);
  dialogVisible.value = true;
}

async function handleAction(orderId: string, action: string) {
  const actionMap: Record<string, { label: string; url: string }> = {
    submit: { label: '提交', url: `/${factoryId.value}/purchase/orders/${orderId}/submit` },
    approve: { label: '审批', url: `/${factoryId.value}/purchase/orders/${orderId}/approve` },
    cancel: { label: '取消', url: `/${factoryId.value}/purchase/orders/${orderId}/cancel` },
  };
  const a = actionMap[action];
  if (!a) return;
  try {
    await ElMessageBox.confirm(`确认${a.label}此${label('purchaseOrder')}？`, '操作确认');
    const res = await post(a.url);
    if (res.success) {
      ElMessage.success(`${a.label}成功`);
      loadData();
    } else {
      ElMessage.error(res.message || `${a.label}失败`);
    }
  } catch (error) { if (error !== 'cancel') ElMessage.error(`${a.label}失败`); }
}

function goDetail(id: string) {
  router.push(`/procurement/orders/${id}`);
}

// P0 (六扇门 May 7 transcript): 列表行内直接下载 PDF 供货单
const pdfDownloadingIds = ref<Set<string>>(new Set());
async function handleDownloadPdf(row: TableRow) {
  if (!factoryId.value || !row.id) return;
  const id = String(row.id);
  if (pdfDownloadingIds.value.has(id)) return;
  pdfDownloadingIds.value.add(id);
  try {
    const response = await request.get(
      `/${factoryId.value}/purchase/orders/${id}/pdf`,
      { responseType: 'blob' }
    );
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `供货单_${row.orderNumber || id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    ElMessage.success('PDF 下载成功');
  } catch (e) {
    console.error('[PDF 下载失败]', e);
    ElMessage.error('PDF 下载失败,请稍后重试');
  } finally {
    pdfDownloadingIds.value.delete(id);
  }
}

function handlePageChange(page: number) { pagination.value.page = page; loadData(); }
function handleSizeChange(size: number) { pagination.value.size = size; pagination.value.page = 1; loadData(); }
function handleStatusChange() { pagination.value.page = 1; loadData(); }
function handleSearch() { pagination.value.page = 1; loadData(); }
function handleRefresh() {
  statusFilter.value = '';
  searchKeyword.value = '';
  dateRange.value = null;
  pagination.value.page = 1;
  loadData();
}

// ==================== AI Entry ====================
const aiEntryVisible = ref(false);

function handleAiFill(params: TableRow) {
  // Match supplierName to supplierId
  const supplierName = String(params.supplierName || '');
  const matched = suppliers.value.find(
    (s: TableRow) => String(s.name || '').includes(supplierName) || supplierName.includes(String(s.name || ''))
  );

  form.value.supplierId = matched ? String(matched.id) : '';
  form.value.purchaseType = String(params.purchaseType || 'DIRECT');
  form.value.expectedDeliveryDate = String(params.expectedDeliveryDate || '');
  form.value.remark = String(params.remark || '');

  if (Array.isArray(params.items) && params.items.length > 0) {
    form.value.items = (params.items as TableRow[]).map((item) => {
      // Try to match materialName to materialTypeId
      const matName = String(item.materialName || '');
      const matMatch = materials.value.find(
        (m: TableRow) => String(m.name || '').includes(matName) || matName.includes(String(m.name || ''))
      );
      return {
        materialTypeId: matMatch ? String(matMatch.id) : '',
        quantity: Number(item.quantity || 0),
        unit: String(item.unit || 'kg'),
        unitPrice: Number(item.unitPrice || 0),
      };
    });
  }

  dialogVisible.value = true;
}
</script>

<template>
  <CanvasAwareWrapper module-code="purchase_order">
  <div class="page-wrapper">
    <ConceptDisambiguationAlert
      here-name="采购订单"
      here="我们向供应商下的订单（进货方向、应付账款）"
      other-name="销售管理 → 销售订单"
      other="客户向我们下的订单（出货方向、应收账款）"
      other-path="/sales/orders"
    />
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">{{ label('purchaseOrder') }}管理</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button v-if="canWrite" type="success" :icon="ChatDotRound" @click="aiEntryVisible = true">
              AI录入
            </el-button>
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="openCreateDialog">
              新建{{ label('purchaseOrder') }}
            </el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索 订单号 / 供应商"
          clearable
          style="width: 220px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="下单起始"
          end-placeholder="下单结束"
          value-format="YYYY-MM-DD"
          style="width: 280px"
          @change="handleSearch"
        />
        <el-select v-model="statusFilter" placeholder="按状态筛选" clearable style="width: 160px" @change="handleStatusChange">
          <el-option v-for="(v, k) in statusMap" :key="k" :label="v.text" :value="k" />
        </el-select>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="tableData" v-loading="loading" empty-text="暂无数据" stripe border style="width: 100%">
        <el-table-column prop="orderNumber" label="订单编号" width="170" />
        <el-table-column label="供应商" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.supplierName || row.supplier?.name || row.supplierId || '-' }}</template>
        </el-table-column>
        <el-table-column prop="purchaseType" label="类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.purchaseType === 'URGENT' ? 'danger' : ''">
              {{ row.purchaseType === 'DIRECT' ? '直接' : row.purchaseType === 'URGENT' ? '紧急' : '统一' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="orderDate" label="下单日期" width="120" />
        <!--
          RBAC defense-in-depth (PR #415 Option B 2026-05-12 + P3 column-hide fix):
          backend PriceFieldResponseAdvice strips totalAmount → null for roles
          lacking procurement:price:view. v-if on the column itself hides BOTH
          the header and cells for non-whitelisted roles (warehouse_manager etc).
          Without v-if on <el-table-column>, Element Plus still renders the
          column header even when every cell template returns nothing → E2E
          flagged 总金额 header visible despite null cells (misleading UX).
        -->
        <el-table-column
          v-if="canViewPrice"
          prop="totalAmount"
          label="总金额"
          width="130"
          align="right"
        >
          <template #default="{ row }">
            <span v-if="row.totalAmount != null">{{ formatAmount(row.totalAmount) }}</span>
            <span v-else class="price-masked">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="(statusMap[row.status]?.type) || 'info'" size="small">
              {{ statusMap[row.status]?.text || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="goDetail(row.id)">详情</el-button>
            <!-- P0 (六扇门 May 7 transcript): 下载 PDF 供货单 (含 Code128 + QR 条码) -->
            <el-button type="info" link size="small" :icon="Download"
              :loading="pdfDownloadingIds.has(String(row.id))"
              @click="handleDownloadPdf(row)">PDF</el-button>
            <el-button v-if="row.status === 'DRAFT' && canWrite" type="warning" link size="small" @click="handleAction(row.id, 'submit')">提交</el-button>
            <el-button v-if="row.status === 'SUBMITTED' && canWrite" type="success" link size="small" @click="handleAction(row.id, 'approve')">审批</el-button>
            <el-button v-if="['DRAFT','SUBMITTED'].includes(row.status) && canWrite" type="danger" link size="small" @click="handleAction(row.id, 'cancel')">取消</el-button>
            <RowActionMenu
              :actions="rowActionsFor(row)"
              button-label="更多"
              @action-click="(id: string) => handleRowActionClick(id, row)"
              @ai-trigger="() => openAiForRow(row)"
            />
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.size"
          :page-sizes="[10, 20, 50]" :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange" @size-change="handleSizeChange" />
      </div>
    </el-card>

    <!-- May 7 2026 用户反馈: "新建采购订单需要把页面放大,要不然很多明细的话是很小的".
         改全屏 dialog (full-screen modal),明细行有充足空间. -->
    <el-dialog v-model="dialogVisible" :title="`新建${label('purchaseOrder')}`" fullscreen destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item :label="label('supplier')">
          <el-select v-model="form.supplierId" placeholder="请选择" filterable style="width: 100%">
            <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="采购类型">
          <el-radio-group v-model="form.purchaseType">
            <el-radio value="DIRECT">直接采购</el-radio>
            <el-radio value="HQ_UNIFIED">总部统采</el-radio>
            <el-radio value="URGENT">紧急采购</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="关联销售订单">
          <el-select v-model="form.relatedSalesOrderId" placeholder="可选 - 选择关联的销售订单" filterable clearable style="width: 100%">
            <el-option
              v-for="so in salesOrders"
              :key="so.id"
              :label="`${so.orderNumber} - ${so.customerName || so.customer?.name || ''}`"
              :value="so.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="期望交货">
          <el-date-picker v-model="form.expectedDeliveryDate" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
        <CanvasDynamicFields v-model="form.customFields" module-code="purchase_order" />
        <el-divider>{{ label('rawMaterial') }}明细</el-divider>
        <div class="item-row item-header">
          <!-- May 7 2026 用户反馈: 数量/单价/箱数 input-number 控件 -/+ 占两端,
               value 字段被挤压看不到数字. fullscreen dialog 1200px+ 有充足空间,
               把所有列加宽确保 3 位以上数字 + 小数点 + -/+ 控件都能完整显示. -->
          <span style="width: 220px">原料名称</span>
          <span style="width: 140px">规格</span>
          <span style="width: 140px">数量</span>
          <span style="width: 130px">单位</span>
          <span style="width: 160px">单价</span>
          <span style="width: 140px">箱数</span>
          <span style="width: 70px">操作</span>
        </div>
        <div v-for="(item, idx) in form.items" :key="idx" class="item-row">
          <el-select
            v-model="item.materialTypeId"
            placeholder="选择原料"
            filterable
            style="width: 220px"
            @change="onItemMaterialChange(item)"
          >
            <el-option v-for="m in materials" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
          <el-input v-model="item.specification" placeholder="规格" style="width: 140px" @change="recalcBoxQuantity(item)" />
          <el-input-number v-model="item.quantity" :min="1" placeholder="数量" style="width: 140px" @change="recalcBoxQuantity(item)" />
          <!-- 单位下拉: 选定原料后显示该原料的 1/2/3 级单位; 未选时退化空选项 -->
          <!-- M-2 reviewer fix: @change 触发箱数重算, 用户切单位时同步更新 boxQuantity -->
          <el-select
            v-model="item.unit"
            placeholder="单位"
            :disabled="!item.materialTypeId"
            style="width: 130px"
            filterable
            allow-create
            default-first-option
            @change="recalcBoxQuantity(item)"
          >
            <el-option
              v-for="opt in getUnitOptionsForItem(item)"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <el-input-number v-model="item.unitPrice" :min="0" :precision="2" placeholder="单价" style="width: 160px" />
          <!-- P1-2/3 R2 fix: el-tag 替换 inline-styled div, 跟随 Element Plus 主题 + 暗模式 -->
          <el-tag v-if="isAbacaItem(item)" type="warning" effect="light" size="default" style="width: 140px; text-align: center;">抄码品</el-tag>
          <el-input-number v-else v-model="item.boxQuantity" :min="0" :precision="2" placeholder="箱" style="width: 140px" />
          <el-button type="danger" link @click="removeItem(idx)" :disabled="form.items.length <= 1" style="width: 70px">删除</el-button>
        </div>
        <el-button style="width: 100%; margin-top: 8px" @click="addItem">+ 添加行</el-button>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- AI 对话录入 -->
    <AiEntryDrawer
      v-model="aiEntryVisible"
      :config="PURCHASE_ORDER_CONFIG"
      @fill-form="handleAiFill"
    />
  </div>
  </CanvasAwareWrapper>
</template>

<style lang="scss" scoped>
.page-wrapper { height: 100%; width: 100%; display: flex; flex-direction: column; }
.page-card { flex: 1; display: flex; flex-direction: column;
  :deep(.el-card__header) { padding: 16px 20px; border-bottom: 1px solid #ebeef5; }
  :deep(.el-card__body) { flex: 1; display: flex; flex-direction: column; padding: 20px; }
}
.card-header { display: flex; justify-content: space-between; align-items: center;
  .header-left { display: flex; align-items: baseline; gap: 12px;
    .page-title { font-size: 16px; font-weight: 600; color: #303133; }
    .data-count { font-size: 13px; color: #909399; }
  }
}
.search-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.pagination-wrapper { display: flex; justify-content: flex-end; padding-top: 16px; border-top: 1px solid #ebeef5; margin-top: 16px; }
.item-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.item-header { font-size: 13px; font-weight: 600; color: #606266; margin-bottom: 4px;
  span { text-align: center; display: inline-block; }
}
</style>
