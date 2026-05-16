<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { useBusinessMode } from '@/composables/useBusinessMode';
import { get, post, put } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, Search, ChatDotRound } from '@element-plus/icons-vue';
import AiEntryDrawer from '@/components/ai-entry/AiEntryDrawer.vue';
import { SALES_ORDER_CONFIG } from '@/components/ai-entry/types';
import { formatAmount } from '@/utils/tableFormatters';
import { RowActionMenu } from '@/components/list';
import { computeRowActions } from '@/composables/useRowActions';
import TaxGroupInvoiceDialog from './components/TaxGroupInvoiceDialog.vue';
import CanvasDynamicFields from '@/components/canvas/CanvasDynamicFields.vue';
import CanvasAwareWrapper from '@/components/canvas/CanvasAwareWrapper.vue';
import ConceptDisambiguationAlert from '@/components/common/ConceptDisambiguationAlert.vue';
import { getFinanceSummary, type FinanceSummary } from '@/api/smartbi/gold';
import type { TableRow } from '@/types/api';
import { TableFooter } from '@/components/list';
import { useListSummary } from '@/composables/useListSummary';
import type { ListSummaryRequest } from '@/types/listSummary';

// G1: 税率分组开票对话框 (客户原话 2645-2660s)
const taxGroupInvoiceVisible = ref(false);
const taxGroupInvoiceOrder = ref<{ id: string; orderNumber: string; customerName: string; totalAmount: number | string }>({
  id: '', orderNumber: '', customerName: '', totalAmount: 0,
});
function openTaxGroupInvoice(row: TableRow) {
  taxGroupInvoiceOrder.value = {
    id: String(row.id || ''),
    orderNumber: String(row.orderNumber || ''),
    customerName: String(row.customerName || ''),
    totalAmount: (row.totalAmount as number | string) ?? 0,
  };
  taxGroupInvoiceVisible.value = true;
}

// Quick action dialogs
const deliveryDialogVisible = ref(false);
const deliveryForm = ref<Record<string, any>>({ orderId: '', customerId: '', deliveryDate: '', items: [], notes: '' });

const invoiceDialogVisible = ref(false);
const invoiceForm = ref({ orderId: '', counterpartyId: '', amount: 0, notes: '' });

const paymentDialogVisible = ref(false);
const paymentForm = ref({ orderId: '', counterpartyId: '', amount: 0, paymentMethod: 'BANK_TRANSFER', notes: '' });

const router = useRouter();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const { label } = useBusinessMode();
const factoryId = computed(() => authStore.factoryId);
// Apr 24 2026 P1-10: restaurant tenants 用 POS 账单, 无传统 B2B SO → 显提示代替空表混乱
const isRestaurantTenant = computed(() => authStore.factoryType === 'RESTAURANT');
const canWrite = computed(() => permissionStore.canWrite('sales'));

const canViewPrice = computed(() => permissionStore.canViewPrice);

/** UX-A2: secondary-action dropdown ("操作 ▾") shown last in row toolbar. */
function rowActionsFor(row: TableRow) {
  return computeRowActions(
    'salesOrder',
    { status: String(row.status || ''), id: String(row.id || '') },
    { canViewPrice: canViewPrice.value }
  );
}
function handleRowActionClick(actionId: string, row: TableRow) {
  switch (actionId) {
    case 'view-detail': goDetail(String(row.id)); break;
    case 'edit': handleEdit(row); break;
    case 'submit': case 'approve': handleAction(String(row.id), 'confirm'); break;
    case 'cancel': handleAction(String(row.id), 'cancel'); break;
    case 'print-pdf': ElMessage.info('打印 PDF 接口待 Sprint 2 收尾'); break;
    case 'copy': ElMessage.info(`复制单据 ${row.orderNumber} (待接 API)`); break;
    case 'convert-to-production': ElMessage.info('转生产任务 (待 Track E N31 集成)'); break;
    default: ElMessage.info(`Action: ${actionId}`);
  }
}
function openAiForRow(row: TableRow) {
  // Day 9: open existing AiEntryDrawer with row context. Drawer's seed-message
  // hook is owned by useAiChat — we surface the row id via console for now;
  // full availableActions surfacing waits on Track A AIChat schema.
  console.info('[RowAction AI]', { entityType: 'salesOrder', entityId: row.id, orderNumber: row.orderNumber });
  aiEntryVisible.value = true;
}

const loading = ref(false);
const tableData = ref<TableRow[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const statusFilter = ref('');

// U-FOOTER-1: sticky summary stats
const summaryRequest = computed<ListSummaryRequest>(() => ({
  filterConditions: statusFilter.value ? { status: statusFilter.value } : {},
}));
const { summary: footerSummary, loading: footerLoading } = useListSummary('salesOrder', summaryRequest);

// Apr 20 Bug BR-07 fix: 客户报告"未见检索功能", 补 keyword 搜索 (订单号/客户名)
const searchKeyword = ref('');
const dialogVisible = ref(false);

// P1-6 智能筛选 tab (v1 金矿截图 49m38s 6 tab)
const activeViewTab = ref<'all' | 'unshipped' | 'partialShipped' | 'unpaid' | 'partialPaid' | 'completed'>('all');
const viewTabs = [
  { key: 'all', label: '全部订单' },
  { key: 'unshipped', label: '未出库订单' },
  { key: 'partialShipped', label: '部分出库订单' },
  { key: 'unpaid', label: '未收款订单' },
  { key: 'partialPaid', label: '部分收款订单' },
  { key: 'completed', label: '已完成订单' },
] as const;

// Client-side filter based on activeViewTab
const filteredTableData = computed(() => {
  const rows = tableData.value;
  if (activeViewTab.value === 'all') return rows;
  return rows.filter((row) => {
    const total = Number(row.totalAmount || 0);
    const shipped = Number(row.actualShippedAmount || 0);
    const paid = Number(row.paidAmount || 0);
    const status = String(row.status || '');
    switch (activeViewTab.value) {
      case 'unshipped':
        return shipped <= 0 && status !== 'CANCELLED' && status !== 'COMPLETED';
      case 'partialShipped':
        return shipped > 0 && shipped < total && status !== 'CANCELLED';
      case 'unpaid':
        return paid <= 0 && status !== 'CANCELLED';
      case 'partialPaid':
        return paid > 0 && paid < total && status !== 'CANCELLED';
      case 'completed':
        return status === 'COMPLETED';
      default:
        return true;
    }
  });
});

function tabCount(key: string): number {
  if (key === 'all') return tableData.value.length;
  const rows = tableData.value;
  return rows.filter((row) => {
    const total = Number(row.totalAmount || 0);
    const shipped = Number(row.actualShippedAmount || 0);
    const paid = Number(row.paidAmount || 0);
    const status = String(row.status || '');
    switch (key) {
      case 'unshipped': return shipped <= 0 && status !== 'CANCELLED' && status !== 'COMPLETED';
      case 'partialShipped': return shipped > 0 && shipped < total && status !== 'CANCELLED';
      case 'unpaid': return paid <= 0 && status !== 'CANCELLED';
      case 'partialPaid': return paid > 0 && paid < total && status !== 'CANCELLED';
      case 'completed': return status === 'COMPLETED';
      default: return false;
    }
  }).length;
}

interface OrderItem {
  productTypeId: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  specification?: string;
  boxQuantity?: number | null;
  // T4-D1 (issue #525): source warehouse code per line. Persists to sales_order_items.source_warehouse_code.
  // Optional/empty for legacy rows + drafts. UI label via utils/warehouse.ts:warehouseDisplayLabel.
  sourceWarehouseCode?: string;
}

const form = ref({
  customerId: '',
  requiredDeliveryDate: '',
  deliveryAddress: '',
  remark: '',
  salesperson: '',
  shippingIncluded: false,
  shippingFee: 0,
  extraFees: [] as Array<{ name: string; amount: number; remark: string }>,
  items: [{ productTypeId: '', quantity: 0, unit: 'kg', unitPrice: 0, taxRate: 13 }] as OrderItem[],
  contractFileUrl: '' as string | null,
  contractFileName: '' as string | null,
  customFields: {} as TableRow,
  version: null as number | null,  // optimistic lock — server returns 409 on stale
});

// P1-7 合同附件上传 (v1 §2.4.3, 2257s)
async function handleContractUpload(options: { file: File }) {
  if (!factoryId.value) return;
  const fd = new FormData();
  fd.append('file', options.file);
  try {
    const token = localStorage.getItem('cretas_access_token') || '';
    const res = await fetch(`/api/mobile/${factoryId.value}/upload/contract`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    const json = await res.json();
    if (json.success && json.data) {
      form.value.contractFileUrl = json.data.url;
      form.value.contractFileName = json.data.fileName || options.file.name;
      ElMessage.success(`合同上传成功: ${options.file.name}`);
    } else {
      ElMessage.error(json.message || '合同上传失败');
    }
  } catch { /* axios interceptor already displayed error toast */ }
}

function clearContract() {
  form.value.contractFileUrl = '';
  form.value.contractFileName = '';
}
const customers = ref<TableRow[]>([]);
const products = ref<TableRow[]>([]);
const salesEmployees = ref<TableRow[]>([]);

const statusMap: Record<string, { text: string; type: string }> = {
  DRAFT: { text: '草稿', type: 'info' },
  CONFIRMED: { text: '已确认', type: '' },
  PENDING_FINANCE_REVIEW: { text: '待财务审核', type: 'warning' },
  FINANCE_APPROVED: { text: '财务已批准', type: 'success' },
  FINANCE_REJECTED: { text: '财务已驳回', type: 'danger' },
  PROCESSING: { text: '处理中', type: 'warning' },
  PARTIAL_DELIVERED: { text: '部分发货', type: 'warning' },
  COMPLETED: { text: '已完成', type: 'success' },
  CANCELLED: { text: '已取消', type: 'danger' },
};

// D13: Dirty form guard — warn user before leaving with unsaved changes
const isDirty = ref(false);
watch(dialogVisible, (val) => { isDirty.value = val; });
function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (isDirty.value) { e.preventDefault(); e.returnValue = ''; }
}
// v1.2 Week 9: POS summary card — hides auto when Silver has no data (manufacturing tenants).
// Tries YTD first, falls back to last calendar year when YTD is empty so restaurant tenants
// whose POS feed is seeded with historical data still see a non-empty demo.
const goldSummary = ref<FinanceSummary | null>(null);
const goldSummaryRangeLabel = ref<string>('');
async function loadGoldSummary() {
  if (!factoryId.value) return;
  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);
  const ranges: Array<{ start: string; end: string; label: string }> = [
    { start: `${year}-01-01`, end: today, label: `${year} YTD` },
    { start: `${year - 1}-01-01`, end: `${year - 1}-12-31`, label: `${year - 1} 全年` },
  ];
  for (const rng of ranges) {
    try {
      const r = await getFinanceSummary({
        factoryId: factoryId.value, startDate: rng.start, endDate: rng.end, topNStores: 3,
      });
      if (r && r.billCount > 0) {
        goldSummary.value = r;
        goldSummaryRangeLabel.value = rng.label;
        return;
      }
    } catch { /* try next range */ }
  }
  goldSummary.value = null;
}

onMounted(() => {
  loadData(); loadCustomers(); loadProducts(); loadSalesEmployees();
  loadGoldSummary();
  window.addEventListener('beforeunload', handleBeforeUnload);
});
onBeforeUnmount(() => { window.removeEventListener('beforeunload', handleBeforeUnload); });

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const url = statusFilter.value
      ? `/${factoryId.value}/sales/orders/by-status`
      : `/${factoryId.value}/sales/orders`;
    // P1-6 smart tabs do client-side filter → load larger batch
    const effectiveSize = activeViewTab.value === 'all' ? pagination.value.size : 200;
    const params: TableRow = { page: pagination.value.page, size: effectiveSize };
    if (statusFilter.value) params.status = statusFilter.value;
    const res = await get(url, { params });
    if (res.success && res.data) {
      let rows = res.data.content || [];
      // Apr 20 Bug BR-07 fix: 补 keyword 搜索 (订单号 / 客户名)
      const kw = searchKeyword.value.trim();
      if (kw) {
        const lower = kw.toLowerCase();
        rows = rows.filter((r: TableRow) =>
          String(r.orderNumber || '').toLowerCase().includes(lower) ||
          String(r.customerName || '').toLowerCase().includes(lower)
        );
      }
      tableData.value = rows;
      pagination.value.total = res.data.totalElements || 0;
    } else if (res.success === false) {
      ElMessage.error(res.message || '加载订单失败');
    }
  } catch { /* axios interceptor already displayed error toast */ }
  finally { loading.value = false; }
}

function handleTabChange() {
  // Tab 切换时 reload (后端返回 top 200 以便 client-side filter)
  pagination.value.page = 1;
  loadData();
}

async function loadCustomers() {
  if (!factoryId.value) return;
  try {
    const res = await get(`/${factoryId.value}/customers`, { params: { page: 1, size: 100 }, _silent: true } as never);
    if (res.success && res.data) customers.value = res.data.content || [];
  } catch { /* dropdown optional — fail silently for roles without customer read permission */ }
}

async function loadProducts() {
  if (!factoryId.value) return;
  try {
    const res = await get(`/${factoryId.value}/product-types/active`, { _silent: true } as never);
    if (res.success && res.data) products.value = Array.isArray(res.data) ? res.data : res.data.content || [];
  } catch { /* dropdown optional — fail silently for roles without product read permission */ }
}

const salesRoles = ['sales_manager', 'factory_super_admin'];

async function loadSalesEmployees() {
  if (!factoryId.value) return;
  // Apr 24 2026: 无 hr 读权限的角色 (如 warehouse_manager) 不必调 /users 下拉.
  // 之前 _silent:true + try/catch 已经吞错了, 但 console 仍有 403 log 噪音.
  // 前置 canAccess 检查减少无效请求.
  if (!permissionStore.canAccess('hr')) return;
  try {
    const res = await get(`/${factoryId.value}/users`, { params: { page: 1, size: 200 }, _silent: true } as never);
    if (res.success && res.data) {
      const allUsers = res.data.content || [];
      salesEmployees.value = allUsers.filter(
        (u: TableRow) => salesRoles.includes(String(u.roleCode || u.role || ''))
          || String(u.departmentName || u.department || '').includes('销售')
      );
      // If no employees matched the filter, show all active employees as fallback
      if (salesEmployees.value.length === 0) {
        salesEmployees.value = allUsers.filter((u: TableRow) => u.isActive !== false);
      }
    }
  } catch { /* silently fail — user can still type manually */ }
}

function addItem() { form.value.items.push({ productTypeId: '', quantity: 0, unit: 'kg', unitPrice: 0, specification: '', boxQuantity: null, taxRate: 13, sourceWarehouseCode: '' }); }
function removeItem(idx: number) { if (form.value.items.length > 1) form.value.items.splice(idx, 1); }

function onProductSelect(item: TableRow, productId: string) {
  const p = products.value.find((x: TableRow) => x.id === productId);
  if (p) {
    item.specification = p.specification || p.packageSpec || '';
    item.unit = p.unit || item.unit || 'kg';
    if (p.unitPrice != null && (item.unitPrice == null || item.unitPrice === 0)) {
      item.unitPrice = Number(p.unitPrice);
    }
    // P1-3: spec 自动填后立即调 calcBox, 抄码品会清空 boxQuantity (内部判断)
    if (item.quantity) calcBox(item);
  }
}

/**
 * P1-3 (audio May 7 客户通话): 抄码品识别.
 * 抄码 = 餐饮/食品行业称重商品 (每箱重量不一致, 不能按箱计).
 * 双轨说明: LEGACY 实现; CANVAS 等 Phase B C-6 框架落地, 见
 * docs/superpowers/specs/2026-05-09-canvas-c6-reactive-default-framework.md
 */
/**
 * R2 fix #3: 精确匹配 trim() === '抄码', 不用 includes (避免误报).
 * 与 procurement/orders/list.vue isAbacaItem 同模式 (M-1 follow-up 抽 composable).
 */
function isAbacaItem(item: TableRow): boolean {
  return String(item.specification || '').trim() === '抄码';
}

function calcBox(item: TableRow) {
  if (isAbacaItem(item)) {
    item.boxQuantity = null;  // 抄码品: 不算箱数
    return;
  }
  const p = products.value.find((x: TableRow) => x.id === item.productTypeId);
  if (p?.boxConversionCoefficient && Number(p.boxConversionCoefficient) > 0 && Number(item.quantity) > 0) {
    item.boxQuantity = Math.round((Number(item.quantity) / Number(p.boxConversionCoefficient)) * 100) / 100;
  }
}

async function handleCreate() {
  if (!form.value.customerId) return ElMessage.warning('请选择客户');
  if (!form.value.items || form.value.items.length === 0) return ElMessage.warning('请至少添加一个订单明细');
  // Apr 18 2026 bug #54: 用户报告"信息填写完整 无法提交 显示不为空" — 实际是前端
  // 缺 productTypeId 空值校验, 漏到后端才 reject, 用户看文案困惑。
  if (form.value.items.some((i: TableRow) => !i.productTypeId)) return ElMessage.warning('请为所有明细选择产品');
  // 数量校验: 不允许0或负数
  if (form.value.items.some((i: TableRow) => !i.quantity || Number(i.quantity) <= 0)) return ElMessage.warning('产品数量必须大于0');
  // 单位校验
  if (form.value.items.some((i: TableRow) => !i.unit)) return ElMessage.warning('请填写所有明细的单位');
  // 销售单价校验
  if (form.value.items.some((i: TableRow) => i.unitPrice == null || Number(i.unitPrice) < 0)) return ElMessage.warning('请填写所有明细的销售单价');
  // SKU 重复校验
  const productIds = form.value.items.map((i: TableRow) => i.productTypeId).filter(Boolean);
  if (new Set(productIds).size !== productIds.length) return ElMessage.warning('同一订单不能添加重复的产品');
  try {
    const res = await post(`/${factoryId.value}/sales/orders`, form.value);
    if (res.success) { ElMessage.success('创建成功'); dialogVisible.value = false; loadData(); }
    else { ElMessage.error(res.message || '创建失败'); }
  } catch { /* axios interceptor already displayed error toast */ }
}

async function handleAction(orderId: string, action: string) {
  const map: Record<string, { label: string; url: string }> = {
    confirm: { label: '确认', url: `/${factoryId.value}/sales/orders/${orderId}/confirm` },
    cancel: { label: '取消', url: `/${factoryId.value}/sales/orders/${orderId}/cancel` },
    // R23-Pre3: FINANCE_REJECTED → resubmit for finance review (backend already
    // supports CONFIRMED || FINANCE_REJECTED → PENDING_FINANCE_REVIEW transition).
    resubmit: { label: '重新提交', url: `/${factoryId.value}/sales/orders/${orderId}/submit-for-review` },
  };
  const a = map[action];
  if (!a) return;
  try {
    await ElMessageBox.confirm(`确认${a.label}此${label('salesOrder')}？`, '操作确认');
    const res = await post(a.url);
    if (res.success) { ElMessage.success(`${a.label}成功`); loadData(); }
    else { ElMessage.error(res.message || `${a.label}失败`); }
  } catch (error) { if (error !== 'cancel') ElMessage.error(`${a.label}失败`); }
}

const editingOrderId = ref<string | null>(null);

function handleEdit(row: TableRow) {
  editingOrderId.value = String(row.id);
  form.value = {
    customerId: String(row.customerId || row.customer?.id || ''),
    requiredDeliveryDate: String(row.requiredDeliveryDate || ''),
    deliveryAddress: String(row.deliveryAddress || ''),
    remark: String(row.remark || ''),
    salesperson: String(row.salesperson || ''),
    shippingIncluded: !!row.shippingIncluded,
    shippingFee: Number(row.shippingFee || 0),
    extraFees: Array.isArray(row.extraFees)
      ? (row.extraFees as Array<TableRow>).map((f) => ({
          name: String(f.name || ''),
          amount: Number(f.amount || 0),
          remark: String(f.remark || ''),
        }))
      : [],
    items: Array.isArray(row.items) && row.items.length > 0
      ? row.items.map((item: TableRow) => ({
          productTypeId: String(item.productTypeId || item.productType?.id || ''),
          quantity: Number(item.quantity || 0),
          unit: String(item.unit || 'kg'),
          unitPrice: Number(item.unitPrice || 0),
          // PR #173 reviewer follow-up M-4 (May 9 2026): preserve specification + boxQuantity
          // on edit. 旧 bug: handleEdit 重建 form.items 时漏了这两字段, 用户编辑现有订单后
          // 提交导致 specification/boxQuantity 被覆盖为空 (新 form 不含 → 后端把 null 写库).
          // 抄码品识别 + 箱数自动算依赖这两字段, 不能丢.
          specification: String(item.specification || ''),
          boxQuantity: item.boxQuantity != null ? Number(item.boxQuantity) : null,
          taxRate: item.taxRate != null ? Number(item.taxRate) : 13,
        }))
      : [{ productTypeId: '', quantity: 0, unit: 'kg', unitPrice: 0, specification: '', boxQuantity: null, taxRate: 13 }],
    contractFileUrl: (row.contractFileUrl ? String(row.contractFileUrl) : null) as string | null,
    contractFileName: (row.contractFileName ? String(row.contractFileName) : null) as string | null,
    customFields: {} as TableRow,
    version: typeof row.version === 'number' ? row.version : null,
  };
  dialogVisible.value = true;
}

async function handleSave() {
  if (editingOrderId.value) {
    // Update existing order
    if (!form.value.customerId) return ElMessage.warning('请选择客户');
    try {
      const res = await put(`/${factoryId.value}/sales/orders/${editingOrderId.value}`, form.value);
      if (res.success) { ElMessage.success('保存成功'); dialogVisible.value = false; editingOrderId.value = null; loadData(); }
      else { ElMessage.error(res.message || '保存失败'); }
    } catch (err) {
      // R24 P2 follow-up: only optimistic-lock dialog when no actionHint (vanilla 409).
      // Business 409s from R18/R21/R23 invariants carry actionHint — interceptor already
      // toasts the rich message; firing the wrong "并发编辑冲突" dialog on top would confuse.
      const e = err as { status?: number; actionHint?: string | null };
      if (e?.status === 409 && !e.actionHint) {
        try {
          await ElMessageBox.confirm(
            '此订单已被其他用户修改。点击"确定"将刷新列表并放弃当前编辑。',
            '并发编辑冲突',
            { type: 'warning', confirmButtonText: '刷新列表', cancelButtonText: '取消' }
          );
          dialogVisible.value = false; editingOrderId.value = null; loadData();
        } catch { /* user cancelled */ }
      }
      /* axios interceptor already displayed error toast for non-409 */
    }
  } else {
    await handleCreate();
  }
}

async function openCreateDialog() {
  editingOrderId.value = null;
  form.value = {
    customerId: '',
    requiredDeliveryDate: '',
    deliveryAddress: '',
    remark: '',
    salesperson: '',
    shippingIncluded: false,
    shippingFee: 0,
    extraFees: [] as Array<{ name: string; amount: number; remark: string }>,
    items: [{ productTypeId: '', quantity: 0, unit: 'kg', unitPrice: 0, taxRate: 13 }] as OrderItem[],
    customFields: {} as TableRow,
    contractFileUrl: null,
    contractFileName: null,
    version: null,
  };
  // 张权 Apr 28 反馈: 新建对话框 dropdown 显示 onMounted 时的旧 cache.
  // 强制刷新让用户刚建的客户/产品立即可选.
  await Promise.all([loadCustomers(), loadProducts(), loadSalesEmployees()]);
  dialogVisible.value = true;
}

function addExtraFee() {
  form.value.extraFees.push({ name: '', amount: 0, remark: '' });
}
function removeExtraFee(idx: number) {
  form.value.extraFees.splice(idx, 1);
}

function goDetail(id: string) { router.push(`/sales/orders/${id}`); }
function handlePageChange(page: number) { pagination.value.page = page; loadData(); }
function handleSizeChange(size: number) { pagination.value.size = size; pagination.value.page = 1; loadData(); }
function handleStatusChange() { pagination.value.page = 1; loadData(); }
function handleRefresh() { statusFilter.value = ''; searchKeyword.value = ''; pagination.value.page = 1; loadData(); }

// ==================== AI Entry ====================
const aiEntryVisible = ref(false);

function handleAiFill(params: TableRow) {
  // Match customerName to customerId
  const customerName = String(params.customerName || '');
  const matched = customers.value.find(
    (c: TableRow) => String(c.name || '').includes(customerName) || customerName.includes(String(c.name || ''))
  );

  form.value.customerId = matched ? String(matched.id) : '';
  form.value.requiredDeliveryDate = String(params.requiredDeliveryDate || '');
  form.value.deliveryAddress = String(params.deliveryAddress || '');
  form.value.remark = String(params.remark || '');

  if (Array.isArray(params.items) && params.items.length > 0) {
    form.value.items = (params.items as TableRow[]).map((item) => {
      const prodName = String(item.productName || '');
      const prodMatch = products.value.find(
        (p: TableRow) => String(p.name || '').includes(prodName) || prodName.includes(String(p.name || ''))
      );
      return {
        productTypeId: prodMatch ? String(prodMatch.id) : '',
        quantity: Number(item.quantity || 0),
        unit: String(item.unit || 'kg'),
        unitPrice: Number(item.unitPrice || 0),
        taxRate: item.taxRate != null ? Number(item.taxRate) : 13,
      };
    });
  }

  dialogVisible.value = true;
}

async function handleQuickDelivery(row: TableRow) {
  const today = new Date().toISOString().slice(0, 10);
  // Build items from order items (each with productTypeId, deliveredQuantity, unit)
  let items: TableRow[] = [];
  if (row.items && row.items.length > 0) {
    items = row.items
      .filter((item: TableRow) => item.productTypeId || item.productType?.id)
      .map((item: TableRow) => ({
        productTypeId: item.productTypeId || item.productType?.id,
        productName: item.productName || item.productType?.name,
        deliveredQuantity: item.quantity || 0,
        unit: item.unit || 'kg',
        unitPrice: Number(item.unitPrice || 0),
      }));
  }
  if (items.length === 0) {
    return ElMessage.warning('订单缺少产品信息，无法快速出库');
  }
  deliveryForm.value = {
    salesOrderId: row.id,
    customerId: row.customerId || row.customer?.id || '',
    deliveryDate: today,
    deliveryAddress: row.deliveryAddress || row.customer?.shippingAddress || '',
    items,
    remark: `销售订单 ${row.orderNumber || ''} 快速出库`,
  };
  deliveryDialogVisible.value = true;
}

async function submitQuickDelivery() {
  if (!deliveryForm.value.customerId) return ElMessage.warning('缺少客户信息');
  if (!deliveryForm.value.deliveryDate) return ElMessage.warning('请选择发货日期');
  try {
    const res = await post(`/${factoryId.value}/sales/deliveries`, deliveryForm.value);
    if (res.success) {
      ElMessage.success('出库成功');
      deliveryDialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(res.message || '出库失败');
    }
  } catch { /* axios interceptor already displayed error toast */ }
}

async function handleQuickInvoice(row: TableRow) {
  invoiceForm.value = {
    orderId: row.id,
    counterpartyId: row.customerId || row.customer?.id || '',
    amount: row.totalAmount || 0,
    notes: `销售订单 ${row.orderNumber || ''} 开票`,
  };
  invoiceDialogVisible.value = true;
}

async function submitQuickInvoice() {
  if (!invoiceForm.value.counterpartyId) return ElMessage.warning('缺少客户信息');
  try {
    const res = await post(`/${factoryId.value}/finance/receivable`, invoiceForm.value);
    if (res.success) {
      ElMessage.success('开票成功');
      invoiceDialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(res.message || '开票失败');
    }
  } catch { /* axios interceptor already displayed error toast */ }
}

async function handleQuickPayment(row: TableRow) {
  // Issue #317 fix: include orderId so AR_PAYMENT persists salesOrderId. Was
  // orphan-receipt: SO.paidAmount stayed null + SO 收款记录 tab '暂无数据'.
  paymentForm.value = {
    orderId: row.id,
    counterpartyId: row.customerId || row.customer?.id || '',
    amount: row.totalAmount || 0,
    paymentMethod: 'BANK_TRANSFER',
    notes: `销售订单 ${row.orderNumber || ''} 收款`,
  };
  paymentDialogVisible.value = true;
}

async function submitQuickPayment() {
  if (!paymentForm.value.counterpartyId) return ElMessage.warning('缺少客户信息');
  try {
    const res = await post(`/${factoryId.value}/finance/receivable/payment`, paymentForm.value);
    if (res.success) {
      ElMessage.success('收款成功');
      paymentDialogVisible.value = false;
      loadData();
    } else {
      ElMessage.error(res.message || '收款失败');
    }
  } catch { /* axios interceptor already displayed error toast */ }
}
</script>

<template>
  <!-- v1.2 Week 9: POS 交易概览 (restaurant tenants). Placed OUTSIDE CanvasAwareWrapper
       so it renders in both LEGACY and DYNAMIC/CANVAS rendering modes. Auto-hides
       when Silver empty (manufacturing tenants). -->
  <el-card
    v-show="goldSummary"
    class="gold-pos-summary"
    style="margin: 12px; border-top: 3px solid #67C23A;"
    shadow="never"
  >
    <template #header>
      <div style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
        <span>🧾 POS 交易概览</span>
        <el-tag size="small" type="success">Gold · finance_summary</el-tag>
        <span v-if="goldSummaryRangeLabel" style="color: #909399; font-size: 12px; margin-left: auto;">
          {{ goldSummaryRangeLabel }}
        </span>
      </div>
    </template>
    <el-row v-if="goldSummary" :gutter="16">
      <el-col :span="6">
        <el-statistic :value="goldSummary.totalRevenue" title="总营收" :precision="2" prefix="¥" />
      </el-col>
      <el-col :span="6">
        <el-statistic :value="goldSummary.billCount" title="POS 账单数" />
      </el-col>
      <el-col :span="6">
        <el-statistic :value="goldSummary.avgBillValue ?? 0" title="客单价" :precision="2" prefix="¥" />
      </el-col>
      <el-col :span="6">
        <el-statistic :value="goldSummary.storeCount" title="门店数" />
      </el-col>
    </el-row>
  </el-card>

  <!-- P1-10: restaurant tenants 无 B2B SO,下面空表只是功能残留 -->
  <el-alert
    v-if="isRestaurantTenant"
    type="info"
    :closable="false"
    show-icon
    style="margin: 0 12px 12px 12px;"
    title="餐饮门店的 POS 账单已在上方「POS 交易概览」汇总。销售订单 (B2B) 本页下方通常为空,如有企业订餐/团购/外送合同才需新建。"
  />

  <CanvasAwareWrapper module-code="sales_order">
  <div class="page-wrapper">
    <ConceptDisambiguationAlert
      here-name="销售订单"
      here="客户向我们下的订单（出货方向、应收账款）"
      other-name="采购管理 → 采购订单"
      other="我们向供应商下的订单（进货方向、应付账款）"
      other-path="/procurement/orders"
    />
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">{{ label('salesOrder') }}管理</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button v-if="canWrite" type="success" :icon="ChatDotRound" @click="aiEntryVisible = true">
              AI录入
            </el-button>
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="openCreateDialog">新建{{ label('salesOrder') }}</el-button>
          </div>
        </div>
      </template>

      <!-- P1-6 智能筛选 tab (v1 金矿截图 49m38s) -->
      <el-radio-group v-model="activeViewTab" size="default" @change="handleTabChange" style="margin-bottom: 12px">
        <el-radio-button v-for="tab in viewTabs" :key="tab.key" :value="tab.key">
          {{ tab.label }} <span v-if="tabCount(tab.key) > 0" class="tab-count">{{ tabCount(tab.key) }}</span>
        </el-radio-button>
      </el-radio-group>

      <div class="search-bar">
        <!-- Apr 20 Bug BR-07 fix: 加 keyword 搜索 (订单号/客户名) -->
        <el-input v-model="searchKeyword" placeholder="搜索 订单号/客户" clearable style="width: 240px" @keyup.enter="loadData" />
        <el-select v-model="statusFilter" placeholder="按状态筛选" clearable style="width: 160px" @change="handleStatusChange">
          <el-option v-for="(v, k) in statusMap" :key="k" :label="v.text" :value="k" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="loadData">搜索</el-button>
        <el-button :icon="Refresh" @click="handleRefresh">重置</el-button>
      </div>

      <el-table :data="filteredTableData" v-loading="loading" empty-text="暂无数据" stripe border style="width: 100%">
        <el-table-column prop="orderNumber" label="订单编号" width="170" />
        <el-table-column label="客户" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.customerName || row.customer?.name || row.customerId || '-' }}</template>
        </el-table-column>
        <el-table-column prop="salesperson" label="业务员" width="100" show-overflow-tooltip />
        <el-table-column prop="orderDate" label="下单日期" width="120" />
        <!--
          RBAC defense-in-depth (PR #415 Option B 2026-05-12 + P3 column-hide fix):
          backend PriceFieldResponseAdvice strips totalAmount / discountAmount /
          taxAmount / shippingFee to null for roles lacking procurement:price:view.
          v-if on the column itself hides BOTH the header and cells for
          non-whitelisted roles (warehouse_manager etc). Without v-if on
          <el-table-column>, Element Plus still renders 总金额 / 运费 / 折扣
          headers even when all cells are null/blank — E2E flagged misleading UX.
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
        <el-table-column
          v-if="canViewPrice"
          prop="shippingFee"
          label="运费"
          width="100"
          align="right"
        >
          <template #default="{ row }">{{ row.shippingFee ? formatAmount(row.shippingFee) : '-' }}</template>
        </el-table-column>
        <el-table-column
          v-if="canViewPrice"
          prop="discountAmount"
          label="折扣"
          width="100"
          align="right"
        >
          <template #default="{ row }">
            <span v-if="row.discountAmount != null && row.discountAmount">{{ formatAmount(row.discountAmount) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="(statusMap[row.status]?.type) || 'info'" size="small">
              {{ statusMap[row.status]?.text || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="goDetail(row.id)">详情</el-button>
            <el-button v-if="row.status === 'DRAFT' && canWrite" type="warning" link size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button v-if="row.status === 'DRAFT' && canWrite" type="success" link size="small" @click="handleAction(row.id, 'confirm')">确认</el-button>
            <el-button v-if="['DRAFT','CONFIRMED'].includes(row.status) && canWrite" type="danger" link size="small" @click="handleAction(row.id, 'cancel')">取消</el-button>
            <el-button v-if="row.status === 'FINANCE_REJECTED' && canWrite" type="success" link size="small" @click="handleAction(row.id, 'resubmit')">重新提交</el-button>
            <el-button
              v-if="(row.status === 'CONFIRMED' || row.status === 'PROCESSING') && canWrite"
              type="warning"
              link
              size="small"
              @click="handleQuickDelivery(row)"
            >出库</el-button>
            <el-button
              v-if="(row.status === 'CONFIRMED' || row.status === 'PROCESSING' || row.status === 'SHIPPED') && canWrite"
              type="success"
              link
              size="small"
              @click="handleQuickInvoice(row)"
            >开票</el-button>
            <el-button
              v-if="(row.status === 'CONFIRMED' || row.status === 'PROCESSING' || row.status === 'SHIPPED' || row.status === 'COMPLETED') && canWrite"
              type="success"
              link
              size="small"
              @click="openTaxGroupInvoice(row)"
            >税率分组开票</el-button>
            <el-button
              v-if="(row.status === 'CONFIRMED' || row.status === 'PROCESSING' || row.status === 'SHIPPED') && canWrite"
              type="primary"
              link
              size="small"
              @click="handleQuickPayment(row)"
            >收款</el-button>
            <RowActionMenu
              :actions="rowActionsFor(row)"
              button-label="更多"
              @action-click="(id: string) => handleRowActionClick(id, row)"
              @ai-trigger="() => openAiForRow(row)"
            />
          </template>
        </el-table-column>
      </el-table>

      <TableFooter
        :stats="footerSummary?.stats ?? []"
        :loading="footerLoading"
        :show-export="false"
        @ai-analyze="() => { /* TODO Day 7: SmartBI deep link */ }"
      />

      <div class="pagination-wrapper">
        <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.size"
          :page-sizes="[10, 20, 50]" :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange" @size-change="handleSizeChange" />
      </div>
    </el-card>

    <!-- 出库对话框 -->
    <el-dialog v-model="deliveryDialogVisible" title="快速出库" width="500px">
      <el-form :model="deliveryForm" label-width="80px">
        <el-form-item label="发货日期">
          <el-date-picker v-model="deliveryForm.deliveryDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="发货明细">
          <div v-for="(item, idx) in deliveryForm.items" :key="idx" style="margin-bottom: 4px">
            {{ Number(idx) + 1 }}. 数量: <el-input-number v-model="item.deliveredQuantity" :min="1" size="small" style="width: 120px" /> {{ item.unit }}
          </div>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="deliveryForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deliveryDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitQuickDelivery">确认出库</el-button>
      </template>
    </el-dialog>

    <!-- 开票对话框 -->
    <el-dialog v-model="invoiceDialogVisible" title="快速开票" width="400px">
      <el-form :model="invoiceForm" label-width="80px">
        <el-form-item label="开票金额">
          <el-input-number v-model="invoiceForm.amount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="invoiceForm.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="invoiceDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitQuickInvoice">确认开票</el-button>
      </template>
    </el-dialog>

    <!-- 收款对话框 -->
    <el-dialog v-model="paymentDialogVisible" title="快速收款" width="400px">
      <el-form :model="paymentForm" label-width="80px">
        <el-form-item label="收款金额">
          <el-input-number v-model="paymentForm.amount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="收款方式">
          <el-select v-model="paymentForm.paymentMethod" style="width: 100%">
            <el-option label="银行转账" value="BANK_TRANSFER" />
            <el-option label="现金" value="CASH" />
            <el-option label="支票" value="CHECK" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="paymentForm.notes" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="paymentDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitQuickPayment">确认收款</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dialogVisible" :title="editingOrderId ? `编辑${label('salesOrder')}` : `新建${label('salesOrder')}`" width="80%" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item :label="label('customer')">
          <el-select v-model="form.customerId" placeholder="请选择" filterable style="width: 100%">
            <el-option v-for="c in customers" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="交货日期"><el-date-picker v-model="form.requiredDeliveryDate" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="交货地址"><el-input v-model="form.deliveryAddress" /></el-form-item>
        <el-form-item label="业务员">
          <el-select v-model="form.salesperson" placeholder="请选择业务员" filterable allow-create style="width: 100%">
            <el-option v-for="emp in salesEmployees" :key="emp.id" :label="emp.fullName" :value="emp.fullName" />
          </el-select>
        </el-form-item>
        <el-form-item label="含运费">
          <el-switch v-model="form.shippingIncluded" />
          <el-input-number v-if="form.shippingIncluded" v-model="form.shippingFee" :min="0" :precision="2" placeholder="运费金额" style="width: 180px; margin-left: 12px" />
        </el-form-item>
        <el-form-item label="其他费用">
          <div style="width: 100%">
            <div v-for="(fee, idx) in form.extraFees" :key="idx" style="display: flex; gap: 8px; margin-bottom: 6px">
              <el-input v-model="fee.name" placeholder="费用名称 (如装卸费)" style="width: 200px" />
              <el-input-number v-model="fee.amount" :min="0" :precision="2" placeholder="金额" style="width: 140px" />
              <el-input v-model="fee.remark" placeholder="备注" style="flex: 1" />
              <el-button type="danger" link @click="removeExtraFee(idx)">删除</el-button>
            </div>
            <el-button size="small" @click="addExtraFee">+ 添加费用项</el-button>
          </div>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="预订合同">
          <!-- P1-7 合同附件上传 (v1 §2.4.3, 客户 2257s) -->
          <div v-if="form.contractFileUrl" style="display:flex;gap:8px;align-items:center">
            <el-tag type="success" size="small">已上传: {{ form.contractFileName }}</el-tag>
            <el-button size="small" type="danger" link @click="clearContract">移除</el-button>
          </div>
          <el-upload
            v-else
            :auto-upload="true"
            :http-request="handleContractUpload as any"
            :limit="1"
            :show-file-list="false"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          >
            <el-button size="small">上传合同 (PDF/图片/Word, ≤20MB)</el-button>
          </el-upload>
        </el-form-item>
        <CanvasDynamicFields v-model="form.customFields" module-code="sales_order" />
        <el-divider>{{ label('product') }}明细</el-divider>
        <div class="item-row item-header">
          <span style="width: 200px">品名</span>
          <span style="width: 120px">规格</span>
          <span style="width: 100px">下单数量</span>
          <span style="width: 80px">单位</span>
          <span style="width: 100px">单价</span>
          <span style="width: 80px">箱数</span>
          <span style="width: 90px" title="税率 (开票 G1 按此分组): 9=原料, 13=加工, 6=服务">税率(%)</span>
          <!-- T4-D1 (issue #525): 来源仓库 — F006 客户反馈 "成品会调回总仓, 总仓再安排发货".
               Customer wants to record per-line source warehouse (WH-LOG 总仓 / WH-WKS 线边仓). -->
          <span style="width: 110px">来源仓库</span>
          <span style="width: 40px">操作</span>
        </div>
        <div v-for="(item, idx) in form.items" :key="idx" class="item-row">
          <el-select v-model="item.productTypeId" placeholder="选择产品" filterable style="width: 200px" @change="(v: string) => onProductSelect(item, v)">
            <el-option v-for="p in products" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
          <el-input v-model="item.specification" placeholder="规格" style="width: 120px" @change="calcBox(item)" />
          <el-input-number v-model="item.quantity" :min="1" style="width: 100px" @change="() => calcBox(item)" />
          <el-input v-model="item.unit" style="width: 80px" />
          <el-input-number v-model="item.unitPrice" :min="0" :precision="2" style="width: 100px" />
          <!-- P1-3 R2 fix: el-tag 替换 inline-styled div, 跟随 Element Plus 主题 -->
          <el-tag v-if="isAbacaItem(item)" type="warning" effect="light" size="default" style="width: 80px; text-align: center;">抄码品</el-tag>
          <el-input-number v-else v-model="item.boxQuantity" :min="0" :precision="2" style="width: 80px" placeholder="箱" />
          <el-select v-model="item.taxRate" placeholder="税率" style="width: 90px" size="default">
            <el-option :value="0" label="0% 免税" />
            <el-option :value="3" label="3% 小规模" />
            <el-option :value="6" label="6% 服务" />
            <el-option :value="9" label="9% 原料" />
            <el-option :value="13" label="13% 加工" />
          </el-select>
          <!-- T4-D1 (issue #525): 来源仓库 select — labels 总仓 / 线边仓 per utils/warehouse.ts. -->
          <el-select v-model="item.sourceWarehouseCode" placeholder="选择" clearable style="width: 110px" size="default">
            <el-option label="总仓 (WH-LOG)" value="WH-LOG" />
            <el-option label="线边仓 (WH-WKS)" value="WH-WKS" />
          </el-select>
          <el-button type="danger" link @click="removeItem(idx)" :disabled="form.items.length <= 1">删除</el-button>
        </div>
        <el-button style="width: 100%; margin-top: 8px" @click="addItem">+ 添加行</el-button>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">{{ editingOrderId ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>

    <!-- AI 对话录入 -->
    <AiEntryDrawer
      v-model="aiEntryVisible"
      :config="SALES_ORDER_CONFIG"
      @fill-form="handleAiFill"
    />

    <!-- G1: 税率分组开票对话框 -->
    <TaxGroupInvoiceDialog
      v-model="taxGroupInvoiceVisible"
      :factory-id="factoryId || ''"
      :sales-order-id="taxGroupInvoiceOrder.id"
      :order-number="taxGroupInvoiceOrder.orderNumber"
      :customer-name="taxGroupInvoiceOrder.customerName"
      :order-total-amount="taxGroupInvoiceOrder.totalAmount"
      @success="loadData"
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
