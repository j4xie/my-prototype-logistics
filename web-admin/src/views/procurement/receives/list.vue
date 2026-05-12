<script setup lang="ts">
/**
 * 采购入库 — 收货管理
 *
 * 六扇门 V1 §3.3 (14-requirements-matrix #9): 采购到货扫码/手动录入 + 自动更新库存.
 * Apr 26 audit: backend POST /purchase/receives + GET /receives + /receives/{id}/confirm
 * 都已 R26 P2 verified, 但缺 FE 入口. 本页补齐手动录入路径 (扫码模式 V2 backlog).
 *
 * Backend endpoints (PurchaseController):
 *   GET  /api/mobile/{factoryId}/purchase/receives?page=1&size=20
 *   POST /api/mobile/{factoryId}/purchase/receives                  (create DRAFT)
 *   GET  /api/mobile/{factoryId}/purchase/receives/{receiveId}      (detail)
 *   POST /api/mobile/{factoryId}/purchase/receives/{receiveId}/confirm  (DRAFT → CONFIRMED, 生成物料批次)
 */
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, Check, Document } from '@element-plus/icons-vue';
import ConceptDisambiguationAlert from '@/components/common/ConceptDisambiguationAlert.vue';

interface ReceiveRow {
  id: string;
  receiveNumber: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  supplierId: string;
  supplierName?: string;
  receiveDate: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  warehouseId?: string;
  remark?: string;
  itemCount?: number;
  items?: ReceiveItem[];
  createdAt: string;
  createdByName?: string;
}

interface ReceiveItem {
  id?: string;
  materialTypeId: string;
  materialName: string;
  receivedQuantity: number;
  unit: string;
  unitPrice?: number;
  qcResult?: string;
  remark?: string;
}

interface SupplierOption { id: string; name: string }
interface MaterialTypeOption { id: string; name: string; code: string; unit: string; unitPrice?: number }
interface PurchaseOrderOption { id: string; orderNumber: string; supplierName?: string; supplierId?: string; status?: string }

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('procurement'));

const loading = ref(false);
const tableData = ref<ReceiveRow[]>([]);
const pagination = ref({ page: 1, size: 20, total: 0 });

// Detail dialog
const detailVisible = ref(false);
const detailData = ref<ReceiveRow | null>(null);

// Create dialog
const createVisible = ref(false);
const submitting = ref(false);
const formRef = ref();
const form = ref({
  purchaseOrderId: '',
  supplierId: '',
  receiveDate: new Date().toISOString().slice(0, 10),
  warehouseId: '',
  remark: '',
  items: [] as ReceiveItem[],
});
const formRules = {
  supplierId: [{ required: true, message: '请选择供应商', trigger: 'change' }],
  receiveDate: [{ required: true, message: '请选择入库日期', trigger: 'change' }],
};

const supplierOptions = ref<SupplierOption[]>([]);
const materialOptions = ref<MaterialTypeOption[]>([]);
const purchaseOrderOptions = ref<PurchaseOrderOption[]>([]);

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await get<{ content: ReceiveRow[]; totalElements: number }>(
      `/${factoryId.value}/purchase/receives`,
      { params: { page: pagination.value.page, size: pagination.value.size } }
    );
    if (res.success && res.data) {
      tableData.value = res.data.content || [];
      pagination.value.total = res.data.totalElements || 0;
    }
  } catch { /* interceptor toasts */ }
  finally { loading.value = false; }
}

async function loadOptions() {
  if (!factoryId.value) return;
  try {
    const [sup, mat, po] = await Promise.all([
      get<{ content: SupplierOption[] } | SupplierOption[]>(
        `/${factoryId.value}/reference-data/suppliers?usage=active`
      ),
      get<{ content: MaterialTypeOption[] } | MaterialTypeOption[]>(
        `/${factoryId.value}/reference-data/materials?usage=active`
      ),
      get<{ content: PurchaseOrderOption[] } | PurchaseOrderOption[]>(
        `/${factoryId.value}/reference-data/purchase-orders?usage=receivable`
      ),
    ]);
    const ext = <T,>(r: any): T[] => (r?.data?.content || r?.data?.list || r?.data || []) as T[];
    supplierOptions.value = ext<SupplierOption>(sup);
    materialOptions.value = ext<MaterialTypeOption>(mat);
    purchaseOrderOptions.value = ext<PurchaseOrderOption>(po);
  } catch { /* interceptor */ }
}

function handleCreate() {
  form.value = {
    purchaseOrderId: '',
    supplierId: '',
    receiveDate: new Date().toISOString().slice(0, 10),
    warehouseId: '',
    remark: '',
    items: [],
  };
  loadOptions();
  createVisible.value = true;
  // Auto-populate supplier when PO selected (single-source-of-truth FE convenience)
}

function handlePoChange(poId: string) {
  if (!poId) return;
  const po = purchaseOrderOptions.value.find(p => p.id === poId);
  if (po?.supplierId) form.value.supplierId = po.supplierId;
}

function addItem() {
  form.value.items.push({
    materialTypeId: '',
    materialName: '',
    receivedQuantity: 0,
    unit: 'kg',
    unitPrice: undefined,
    qcResult: '',
    remark: '',
  });
}

function removeItem(idx: number) {
  form.value.items.splice(idx, 1);
}

function handleMaterialChange(idx: number, materialId: string) {
  const m = materialOptions.value.find(o => o.id === materialId);
  if (m) {
    form.value.items[idx].materialName = m.name;
    if (m.unit) form.value.items[idx].unit = m.unit;
    if (m.unitPrice && !form.value.items[idx].unitPrice) form.value.items[idx].unitPrice = m.unitPrice;
  }
}

async function handleSubmit() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;
  if (form.value.items.length === 0) {
    ElMessage.warning('请至少添加一行入库物料');
    return;
  }
  submitting.value = true;
  try {
    const payload = { ...form.value };
    if (!payload.purchaseOrderId) delete (payload as Record<string, unknown>).purchaseOrderId;
    const res = await post<ReceiveRow>(`/${factoryId.value}/purchase/receives`, payload);
    if (res.success && res.data) {
      ElMessage.success('入库单已创建,DRAFT 状态。点击「确认入库」生成物料批次');
      createVisible.value = false;
      loadData();
    }
  } catch (e) {
    if (e === 'cancel') return;
    const err = e as { status?: number; actionHint?: string | null } | undefined;
    if (!err || (err.status !== 409 && !err.actionHint)) {
      ElMessage.error('创建入库单失败');
    }
  } finally {
    submitting.value = false;
  }
}

async function handleConfirm(row: ReceiveRow) {
  if (row.status !== 'DRAFT') return;
  try {
    await ElMessageBox.confirm(
      `确认入库单 ${row.receiveNumber}？\n确认后将生成物料批次,无法撤销。`,
      '确认入库',
      { type: 'warning', confirmButtonText: '确认入库', cancelButtonText: '取消' }
    );
    await post(`/${factoryId.value}/purchase/receives/${row.id}/confirm`);
    ElMessage.success('已确认入库,物料批次已创建');
    loadData();
  } catch (e) {
    if (e === 'cancel') return;
    const err = e as { status?: number; actionHint?: string | null } | undefined;
    if (!err || (err.status !== 409 && !err.actionHint)) {
      ElMessage.error('确认入库失败');
    }
    if (err?.status === 409) loadData();
  }
}

async function handleDetail(row: ReceiveRow) {
  try {
    const res = await get<ReceiveRow>(`/${factoryId.value}/purchase/receives/${row.id}`);
    if (res.success && res.data) {
      detailData.value = res.data;
      detailVisible.value = true;
    }
  } catch { /* interceptor */ }
}

function statusTag(status: string): { type: string; label: string } {
  switch (status) {
    case 'DRAFT': return { type: 'info', label: '草稿' };
    case 'CONFIRMED': return { type: 'success', label: '已确认' };
    case 'CANCELLED': return { type: 'danger', label: '已取消' };
    default: return { type: '', label: status };
  }
}

/**
 * 汇总收货数量 (六扇门 May 7 transcript MINOR gap close):
 * 客户想直接在列表看到这次收了多少。
 * 多 item 同单位 → 求和; 多单位 → 显式分组显示 (e.g. "120 kg + 30 L")。
 */
function totalReceivedQuantity(row: ReceiveRow): string {
  const items = row.items || [];
  if (items.length === 0) return '-';
  // group by unit, accumulate quantity
  const byUnit = new Map<string, number>();
  for (const it of items) {
    const qty = Number(it.receivedQuantity) || 0;
    const unit = (it.unit || '').trim() || '-';
    byUnit.set(unit, (byUnit.get(unit) || 0) + qty);
  }
  // format: strip trailing zeros, max 3 decimals
  const fmt = (n: number) => {
    const s = n.toFixed(3);
    return s.replace(/\.?0+$/, '');
  };
  return Array.from(byUnit.entries())
    .map(([unit, qty]) => `${fmt(qty)} ${unit}`)
    .join(' + ');
}

function formatDate(s: string): string {
  if (!s) return '';
  return new Date(s).toLocaleString('zh-CN', { hour12: false });
}

function handleSizeChange(val: number) { pagination.value.size = val; pagination.value.page = 1; loadData(); }
function handlePageChange(val: number) { pagination.value.page = val; loadData(); }

onMounted(() => { loadData(); loadOptions(); });
</script>

<template>
  <div class="page-wrapper" v-loading="loading">
    <ConceptDisambiguationAlert
      here-name="采购入库"
      here="把供应商发来的物料正式收货登记，更新原料库存（采购订单的执行环节）"
      other-name="采购管理 → 采购订单"
      other="向供应商下的订单（金额、付款条款）。入库是采购订单的物流接收环节"
      other-path="/procurement/orders"
    />
    <el-card shadow="never">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:16px;font-weight:600">采购入库管理</span>
          <div style="display:flex;gap:8px">
            <el-button :icon="Refresh" @click="loadData">刷新</el-button>
            <el-button v-if="canWrite" type="primary" :icon="Plus" @click="handleCreate">新建入库单</el-button>
          </div>
        </div>
      </template>

      <el-alert
        type="info" show-icon :closable="false"
        style="margin-bottom:12px"
        title="入库流程"
        description="新建入库单 → DRAFT 状态 → 点「确认入库」生成物料批次,自动更新库存。可关联采购订单或无单入库。"
      />

      <el-table :data="tableData" empty-text="暂无入库单" stripe border style="width:100%">
        <el-table-column prop="receiveNumber" label="入库单号" width="170" show-overflow-tooltip />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status).type as any" size="small">{{ statusTag(row.status).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="采购订单" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.purchaseOrderNumber || row.purchaseOrderId || '— (无单入库)' }}</template>
        </el-table-column>
        <el-table-column label="供应商" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.supplierName || row.supplierId }}</template>
        </el-table-column>
        <el-table-column prop="receiveDate" label="入库日期" width="110" />
        <el-table-column prop="itemCount" label="物料行数" width="90" align="center">
          <template #default="{ row }">{{ row.itemCount ?? row.items?.length ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="收货数量" min-width="140" align="right" show-overflow-tooltip>
          <template #default="{ row }">{{ totalReceivedQuantity(row) }}</template>
        </el-table-column>
        <el-table-column prop="createdByName" label="创建人" width="110" show-overflow-tooltip />
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" :icon="Document" @click="handleDetail(row)">详情</el-button>
            <el-button
              v-if="canWrite && row.status === 'DRAFT'"
              type="success" size="small" :icon="Check"
              @click="handleConfirm(row)"
            >确认入库</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="pagination.total > 0"
        :current-page="pagination.page"
        :page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top:16px;justify-content:flex-end"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </el-card>

    <!-- Create dialog -->
    <el-dialog v-model="createVisible" title="新建入库单" width="900px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="采购订单" prop="purchaseOrderId">
          <el-select
            v-model="form.purchaseOrderId" placeholder="(可选) 关联已批准的采购订单"
            clearable filterable style="width:100%"
            @change="handlePoChange"
          >
            <el-option
              v-for="po in purchaseOrderOptions" :key="po.id"
              :label="`${po.orderNumber} · ${po.supplierName || ''}`"
              :value="po.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="供应商" prop="supplierId">
          <el-select v-model="form.supplierId" placeholder="选择供应商" filterable style="width:100%">
            <el-option v-for="s in supplierOptions" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="入库日期" prop="receiveDate">
          <el-date-picker v-model="form.receiveDate" type="date" value-format="YYYY-MM-DD" style="width:200px" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="入库备注(可选)" />
        </el-form-item>

        <el-divider content-position="left">入库物料</el-divider>
        <el-button size="small" :icon="Plus" @click="addItem" style="margin-bottom:8px">添加物料</el-button>
        <el-table :data="form.items" border>
          <el-table-column label="物料类型" min-width="200">
            <template #default="{ row, $index }">
              <el-select
                v-model="row.materialTypeId" placeholder="选择物料"
                filterable size="small" style="width:100%"
                @change="(val: string) => handleMaterialChange($index, val)"
              >
                <el-option v-for="m in materialOptions" :key="m.id" :label="`${m.name} (${m.code})`" :value="m.id" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="到货数量" width="120">
            <template #default="{ row }">
              <el-input-number v-model="row.receivedQuantity" :min="0.001" :precision="3" :controls="false" size="small" style="width:100%" />
            </template>
          </el-table-column>
          <el-table-column label="单位" width="80">
            <template #default="{ row }">
              <el-input v-model="row.unit" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="单价" width="120">
            <template #default="{ row }">
              <el-input-number v-model="row.unitPrice" :min="0" :precision="2" :controls="false" size="small" style="width:100%" />
            </template>
          </el-table-column>
          <el-table-column label="质检结果" width="140">
            <template #default="{ row }">
              <el-select v-model="row.qcResult" size="small" placeholder="(可选)" clearable>
                <el-option label="合格" value="PASS" />
                <el-option label="不合格" value="FAIL" />
                <el-option label="待复检" value="RECHECK" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ $index }">
              <el-button type="danger" link size="small" @click="removeItem($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">创建</el-button>
      </template>
    </el-dialog>

    <!-- Detail dialog -->
    <el-dialog v-model="detailVisible" :title="`入库单详情 — ${detailData?.receiveNumber || ''}`" width="800px">
      <el-descriptions v-if="detailData" :column="2" border>
        <el-descriptions-item label="入库单号">{{ detailData.receiveNumber }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTag(detailData.status).type as any" size="small">{{ statusTag(detailData.status).label }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="采购订单">{{ detailData.purchaseOrderNumber || detailData.purchaseOrderId || '— (无单)' }}</el-descriptions-item>
        <el-descriptions-item label="供应商">{{ detailData.supplierName || detailData.supplierId }}</el-descriptions-item>
        <el-descriptions-item label="入库日期">{{ detailData.receiveDate }}</el-descriptions-item>
        <el-descriptions-item label="创建人">{{ detailData.createdByName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ detailData.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-divider content-position="left">入库物料</el-divider>
      <el-table v-if="detailData?.items?.length" :data="detailData.items" border size="small">
        <el-table-column prop="materialName" label="物料名称" min-width="160" />
        <el-table-column prop="receivedQuantity" label="到货数量" width="110" align="right" />
        <el-table-column prop="unit" label="单位" width="80" align="center" />
        <el-table-column prop="unitPrice" label="单价" width="100" align="right" />
        <el-table-column prop="qcResult" label="质检" width="100" align="center" />
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
      </el-table>
      <el-empty v-else description="无物料明细" />
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button
          v-if="canWrite && detailData?.status === 'DRAFT'"
          type="success" :icon="Check"
          @click="() => detailData && handleConfirm(detailData)"
        >确认入库</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-wrapper {
  padding: 16px;
}
</style>
