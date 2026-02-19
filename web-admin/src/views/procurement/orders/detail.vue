<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { useBusinessMode } from '@/composables/useBusinessMode';
import { get, post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const { label } = useBusinessMode();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('procurement'));
const orderId = computed(() => route.params.id as string);

const loading = ref(false);
const order = ref<any>(null);
const receives = ref<any[]>([]);
const receiveDialogVisible = ref(false);
const receiveForm = ref<{ items: { materialTypeId: string; receivedQuantity: number; unit: string; unitPrice: number }[] }>({ items: [] });

const statusMap: Record<string, { text: string; type: string }> = {
  DRAFT: { text: '草稿', type: 'info' },
  SUBMITTED: { text: '已提交', type: 'warning' },
  APPROVED: { text: '已审批', type: '' },
  PARTIAL_RECEIVED: { text: '部分收货', type: 'warning' },
  COMPLETED: { text: '已完成', type: 'success' },
  CANCELLED: { text: '已取消', type: 'danger' },
};

const receiveStatusMap: Record<string, { text: string; type: string }> = {
  DRAFT: { text: '草稿', type: 'info' },
  PENDING_QC: { text: '待质检', type: 'warning' },
  CONFIRMED: { text: '已确认', type: 'success' },
  REJECTED: { text: '已拒绝', type: 'danger' },
};

onMounted(() => { loadOrder(); loadReceives(); });

async function loadOrder() {
  if (!factoryId.value || !orderId.value) return;
  loading.value = true;
  try {
    const res = await get(`/${factoryId.value}/purchase/orders/${orderId.value}`);
    if (res.success) order.value = res.data;
  } catch { ElMessage.error('加载订单失败'); }
  finally { loading.value = false; }
}

async function loadReceives() {
  if (!factoryId.value || !orderId.value) return;
  try {
    const res = await get(`/${factoryId.value}/purchase/receives/by-order/${orderId.value}`);
    if (res.success) receives.value = Array.isArray(res.data) ? res.data : [];
  } catch { /* ignore */ }
}

async function handleAction(action: string) {
  const map: Record<string, { label: string; url: string }> = {
    submit: { label: '提交', url: `/${factoryId.value}/purchase/orders/${orderId.value}/submit` },
    approve: { label: '审批通过', url: `/${factoryId.value}/purchase/orders/${orderId.value}/approve` },
    cancel: { label: '取消', url: `/${factoryId.value}/purchase/orders/${orderId.value}/cancel` },
  };
  const a = map[action];
  if (!a) return;
  try {
    await ElMessageBox.confirm(`确认${a.label}？`, '操作确认');
    const res = await post(a.url);
    if (res.success) { ElMessage.success(`${a.label}成功`); loadOrder(); }
  } catch { /* cancelled */ }
}

function openReceiveDialog() {
  if (!order.value?.items?.length) return;
  receiveForm.value.items = order.value.items.map((it: any) => ({
    materialTypeId: it.materialTypeId,
    materialName: it.materialName,
    receivedQuantity: it.quantity - (it.receivedQuantity || 0),
    unit: it.unit,
    unitPrice: it.unitPrice,
  }));
  receiveDialogVisible.value = true;
}

async function handleCreateReceive() {
  try {
    const res = await post(`/${factoryId.value}/purchase/receives`, {
      purchaseOrderId: orderId.value,
      items: receiveForm.value.items.filter(i => i.receivedQuantity > 0),
    });
    if (res.success) {
      ElMessage.success('收货单创建成功');
      receiveDialogVisible.value = false;
      loadOrder(); loadReceives();
    }
  } catch { ElMessage.error('创建失败'); }
}

async function confirmReceive(receiveId: string) {
  try {
    await ElMessageBox.confirm('确认入库？将生成物料批次', '确认');
    const res = await post(`/${factoryId.value}/purchase/receives/${receiveId}/confirm`);
    if (res.success) { ElMessage.success('入库确认成功'); loadReceives(); loadOrder(); }
  } catch { /* cancelled */ }
}

function formatAmount(val: number) {
  if (val == null) return '-';
  return `¥${Number(val).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
</script>

<template>
  <div class="page-wrapper" v-loading="loading">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-button :icon="ArrowLeft" @click="router.push('/procurement/orders')">返回</el-button>
            <span class="page-title">{{ label('purchaseOrder') }}详情</span>
            <el-tag v-if="order" :type="(statusMap[order.status]?.type as any) || 'info'" size="large">
              {{ statusMap[order.status]?.text || order.status }}
            </el-tag>
          </div>
          <div class="header-right" v-if="order && canWrite">
            <el-button v-if="order.status === 'DRAFT'" type="warning" @click="handleAction('submit')">提交审批</el-button>
            <el-button v-if="order.status === 'SUBMITTED'" type="success" @click="handleAction('approve')">审批通过</el-button>
            <el-button v-if="['APPROVED','PARTIAL_RECEIVED'].includes(order.status)" type="primary" @click="openReceiveDialog">{{ label('receive') }}</el-button>
            <el-button v-if="['DRAFT','SUBMITTED'].includes(order.status)" type="danger" @click="handleAction('cancel')">取消</el-button>
          </div>
        </div>
      </template>

      <template v-if="order">
        <el-descriptions :column="3" border>
          <el-descriptions-item label="订单编号">{{ order.orderNumber }}</el-descriptions-item>
          <el-descriptions-item :label="label('supplier')">{{ order.supplier?.name || order.supplierId }}</el-descriptions-item>
          <el-descriptions-item label="采购类型">{{ order.purchaseType === 'DIRECT' ? '直接采购' : order.purchaseType === 'URGENT' ? '紧急采购' : '总部统采' }}</el-descriptions-item>
          <el-descriptions-item label="下单日期">{{ order.orderDate }}</el-descriptions-item>
          <el-descriptions-item label="期望交货">{{ order.expectedDeliveryDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="总金额">{{ formatAmount(order.totalAmount) }}</el-descriptions-item>
          <el-descriptions-item label="税额">{{ formatAmount(order.taxAmount) }}</el-descriptions-item>
          <el-descriptions-item label="审批人">{{ order.approvedBy || '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="3">{{ order.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h3 style="margin: 20px 0 12px">{{ label('rawMaterial') }}明细</h3>
        <el-table :data="order.items || []" border stripe>
          <el-table-column prop="materialName" :label="label('rawMaterial')" min-width="150" />
          <el-table-column prop="quantity" label="采购数量" width="120" align="right" />
          <el-table-column prop="unit" label="单位" width="80" align="center" />
          <el-table-column prop="unitPrice" label="单价" width="120" align="right">
            <template #default="{ row }">{{ formatAmount(row.unitPrice) }}</template>
          </el-table-column>
          <el-table-column label="已收货" width="120" align="right">
            <template #default="{ row }">{{ row.receivedQuantity || 0 }}</template>
          </el-table-column>
          <el-table-column label="小计" width="130" align="right">
            <template #default="{ row }">{{ formatAmount(row.quantity * row.unitPrice) }}</template>
          </el-table-column>
        </el-table>

        <h3 style="margin: 20px 0 12px">{{ label('receive') }}记录</h3>
        <el-table :data="receives" border stripe>
          <el-table-column prop="receiveNumber" label="收货单号" width="170" />
          <el-table-column prop="receiveDate" label="收货日期" width="120" />
          <el-table-column prop="status" label="状态" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="(receiveStatusMap[row.status]?.type as any) || 'info'" size="small">
                {{ receiveStatusMap[row.status]?.text || row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="totalAmount" label="金额" width="130" align="right">
            <template #default="{ row }">{{ formatAmount(row.totalAmount) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center">
            <template #default="{ row }">
              <el-button v-if="row.status === 'DRAFT' && canWrite" type="success" link size="small" @click="confirmReceive(row.id)">确认入库</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-card>

    <el-dialog v-model="receiveDialogVisible" title="创建收货单" width="640px" destroy-on-close>
      <el-table :data="receiveForm.items" border>
        <el-table-column prop="materialName" :label="label('rawMaterial')" width="150" />
        <el-table-column label="收货数量" width="160">
          <template #default="{ row }">
            <el-input-number v-model="row.receivedQuantity" :min="0" size="small" style="width: 130px" />
          </template>
        </el-table-column>
        <el-table-column prop="unit" label="单位" width="80" align="center" />
        <el-table-column prop="unitPrice" label="单价" width="120" align="right">
          <template #default="{ row }">{{ formatAmount(row.unitPrice) }}</template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="receiveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateReceive">创建收货单</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.page-wrapper { height: 100%; width: 100%; display: flex; flex-direction: column; }
.page-card { flex: 1; display: flex; flex-direction: column;
  :deep(.el-card__header) { padding: 16px 20px; border-bottom: 1px solid #ebeef5; }
  :deep(.el-card__body) { flex: 1; padding: 20px; overflow-y: auto; }
}
.card-header { display: flex; justify-content: space-between; align-items: center;
  .header-left { display: flex; align-items: center; gap: 12px;
    .page-title { font-size: 16px; font-weight: 600; color: #303133; }
  }
  .header-right { display: flex; gap: 8px; }
}
</style>
