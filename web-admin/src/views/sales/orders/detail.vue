<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { useBusinessMode } from '@/composables/useBusinessMode';
import { get, post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';
import { formatAmount } from '@/utils/tableFormatters';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const { label } = useBusinessMode();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('sales'));
const orderId = computed(() => route.params.id as string);

const loading = ref(false);
const submitting = ref(false);
const order = ref<Record<string, unknown> | null>(null);
const deliveries = ref<Record<string, unknown>[]>([]);
const deliveryDialogVisible = ref(false);
const deliveryForm = ref<{ deliveryAddress: string; logisticsCompany: string; items: Record<string, unknown>[] }>({
  deliveryAddress: '', logisticsCompany: '', items: [],
});

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

const delStatusMap: Record<string, { text: string; type: string }> = {
  DRAFT: { text: '草稿', type: 'info' },
  PICKED: { text: '已拣货', type: '' },
  SHIPPED: { text: '已发货', type: 'warning' },
  DELIVERED: { text: '已签收', type: 'success' },
  RETURNED: { text: '已退回', type: 'danger' },
};

onMounted(() => { loadOrder(); loadDeliveries(); });

async function loadOrder() {
  if (!factoryId.value || !orderId.value) return;
  loading.value = true;
  try {
    const res = await get(`/${factoryId.value}/sales/orders/${orderId.value}`);
    if (res.success) order.value = res.data;
  } catch { ElMessage.error('加载失败'); }
  finally { loading.value = false; }
}

async function loadDeliveries() {
  if (!factoryId.value || !orderId.value) return;
  try {
    const res = await get(`/${factoryId.value}/sales/deliveries/by-order/${orderId.value}`);
    if (res.success) deliveries.value = Array.isArray(res.data) ? res.data : [];
  } catch { /* ignore */ }
}

async function handleAction(action: string) {
  if (submitting.value) return;
  const map: Record<string, { label: string; url: string }> = {
    confirm: { label: '确认订单', url: `/${factoryId.value}/sales/orders/${orderId.value}/confirm` },
    cancel: { label: '取消订单', url: `/${factoryId.value}/sales/orders/${orderId.value}/cancel` },
    'submit-for-review': { label: '提交财务审核', url: `/${factoryId.value}/sales/orders/${orderId.value}/submit-for-review` },
  };
  const a = map[action];
  if (!a) return;
  try {
    await ElMessageBox.confirm(`确认${a.label}？`, '操作确认');
  } catch { return; }
  submitting.value = true;
  try {
    const res = await post(a.url);
    if (res.success) { ElMessage.success(`${a.label}成功`); loadOrder(); }
    else { ElMessage.error(res.message || `${a.label}失败，请重试`); }
  } catch { ElMessage.error(`${a.label}失败，请检查网络`); }
  finally { submitting.value = false; }
}

async function handleFinanceAction(action: 'approve' | 'reject') {
  if (submitting.value) return;
  const isApprove = action === 'approve';
  const label = isApprove ? '审核通过' : '审核驳回';
  try {
    const { value: notes } = await ElMessageBox.prompt(
      isApprove ? '确认财务审核通过？可选填备注：' : '请填写驳回原因：',
      label,
      { confirmButtonText: label, cancelButtonText: '取消', inputPlaceholder: isApprove ? '（选填）' : '驳回原因' }
    );
    submitting.value = true;
    const url = `/${factoryId.value}/sales/orders/${orderId.value}/${isApprove ? 'finance-approve' : 'finance-reject'}`;
    const res = await post(url, { notes: notes || '' });
    if (res.success) { ElMessage.success(`${label}成功`); loadOrder(); }
    else { ElMessage.error(res.message || `${label}失败`); }
  } catch { /* cancelled */ }
  finally { submitting.value = false; }
}

function openDeliveryDialog() {
  if (!order.value?.items?.length) return;
  deliveryForm.value = {
    deliveryAddress: order.value.deliveryAddress || '',
    logisticsCompany: '',
    items: (order.value.items as Record<string, unknown>[]).map((it) => ({
      productTypeId: it.productTypeId,
      productName: it.productName,
      deliveredQuantity: it.quantity - (it.deliveredQuantity || 0),
      unit: it.unit,
      unitPrice: it.unitPrice,
    })),
  };
  deliveryDialogVisible.value = true;
}

async function handleCreateDelivery() {
  if (submitting.value) return;
  const filteredItems = deliveryForm.value.items.filter(i => i.deliveredQuantity > 0);
  if (filteredItems.length === 0) return ElMessage.warning('请至少填写一个发货数量');
  submitting.value = true;
  try {
    const res = await post(`/${factoryId.value}/sales/deliveries`, {
      salesOrderId: orderId.value,
      customerId: order.value?.customerId || '', // backend requires @NotBlank customerId
      deliveryDate: new Date().toISOString().slice(0, 10), // backend requires @NotNull deliveryDate
      deliveryAddress: deliveryForm.value.deliveryAddress,
      logisticsCompany: deliveryForm.value.logisticsCompany,
      items: filteredItems,
    });
    if (res.success) {
      ElMessage.success('发货单创建成功');
      deliveryDialogVisible.value = false;
      loadOrder(); loadDeliveries();
    } else { ElMessage.error(res.message || '创建失败，请重试'); }
  } catch { ElMessage.error('创建失败，请检查网络'); }
  finally { submitting.value = false; }
}

async function handleShip(deliveryId: string) {
  if (submitting.value) return;
  try {
    await ElMessageBox.confirm('确认发货？将扣减成品库存', '确认');
  } catch { return; }
  submitting.value = true;
  try {
    const res = await post(`/${factoryId.value}/sales/deliveries/${deliveryId}/ship`);
    if (res.success) { ElMessage.success('发货成功'); loadDeliveries(); loadOrder(); }
    else { ElMessage.error(res.message || '发货失败，请重试'); }
  } catch { ElMessage.error('发货失败，请检查网络'); }
  finally { submitting.value = false; }
}

async function handleDelivered(deliveryId: string) {
  if (submitting.value) return;
  try {
    await ElMessageBox.confirm('确认客户已签收？', '确认');
  } catch { return; }
  submitting.value = true;
  try {
    const res = await post(`/${factoryId.value}/sales/deliveries/${deliveryId}/delivered`);
    if (res.success) { ElMessage.success('签收确认成功'); loadDeliveries(); loadOrder(); }
    else { ElMessage.error(res.message || '签收确认失败，请重试'); }
  } catch { ElMessage.error('签收确认失败，请检查网络'); }
  finally { submitting.value = false; }
}
</script>

<template>
  <div class="page-wrapper" v-loading="loading">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-button :icon="ArrowLeft" @click="router.push('/sales/orders')">返回</el-button>
            <span class="page-title">{{ label('salesOrder') }}详情</span>
            <el-tag v-if="order" :type="(statusMap[order.status]?.type) || 'info'" size="large">
              {{ statusMap[order.status]?.text || order.status }}
            </el-tag>
          </div>
          <div class="header-right" v-if="order && canWrite">
            <el-button v-if="order.status === 'DRAFT'" type="success" :loading="submitting" @click="handleAction('confirm')">确认订单</el-button>
            <el-button v-if="order.status === 'CONFIRMED'" type="warning" :loading="submitting" @click="handleAction('submit-for-review')">提交财务审核</el-button>
            <el-button v-if="order.status === 'PENDING_FINANCE_REVIEW'" type="success" :loading="submitting" @click="handleFinanceAction('approve')">审核通过</el-button>
            <el-button v-if="order.status === 'PENDING_FINANCE_REVIEW'" type="danger" :loading="submitting" @click="handleFinanceAction('reject')">审核驳回</el-button>
            <el-button v-if="['CONFIRMED','FINANCE_APPROVED','PROCESSING','PARTIAL_DELIVERED'].includes(order.status)" type="primary" :loading="submitting" @click="openDeliveryDialog">{{ label('delivery') }}</el-button>
            <el-button v-if="['DRAFT','CONFIRMED'].includes(order.status)" type="danger" :disabled="submitting" @click="handleAction('cancel')">取消</el-button>
          </div>
        </div>
      </template>

      <template v-if="order">
        <el-descriptions :column="3" border>
          <el-descriptions-item label="订单编号">{{ order.orderNumber }}</el-descriptions-item>
          <el-descriptions-item :label="label('customer')">{{ order.customer?.name || order.customerId }}</el-descriptions-item>
          <el-descriptions-item label="下单日期">{{ order.orderDate }}</el-descriptions-item>
          <el-descriptions-item label="业务员">{{ order.salesperson || '-' }}</el-descriptions-item>
          <el-descriptions-item label="交货日期">{{ order.requiredDeliveryDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="总金额">{{ formatAmount(order.totalAmount) }}</el-descriptions-item>
          <el-descriptions-item label="折扣">{{ order.discountAmount ? formatAmount(order.discountAmount) : '-' }}</el-descriptions-item>
          <el-descriptions-item label="含运费">{{ order.shippingIncluded ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="运费">{{ order.shippingFee ? formatAmount(order.shippingFee) : '-' }}</el-descriptions-item>
          <el-descriptions-item label="实际发货金额">{{ order.actualShippedAmount ? formatAmount(order.actualShippedAmount) : '-' }}</el-descriptions-item>
          <el-descriptions-item label="预估成本">{{ order.estimatedCost ? formatAmount(order.estimatedCost) : '-' }}</el-descriptions-item>
          <el-descriptions-item label="预估利润">{{ order.estimatedProfit ? formatAmount(order.estimatedProfit) : '-' }}</el-descriptions-item>
          <el-descriptions-item label="下单箱数">{{ order.boxQuantity || '-' }}</el-descriptions-item>
          <el-descriptions-item label="交货地址" :span="3">{{ order.deliveryAddress || '-' }}</el-descriptions-item>
          <el-descriptions-item label="交付提醒">{{ order.deliveryReminderDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="运输计划">
            <el-tag v-if="order.transportPlanStatus" size="small">{{ { NOT_PLANNED: '未定制', PLANNED: '已安排', IN_TRANSIT: '运输中', DELIVERED: '已送达' }[order.transportPlanStatus] || order.transportPlanStatus }}</el-tag>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item label="关联报价单">{{ order.quoteId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="3">{{ order.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <!-- 财务状态 -->
        <el-descriptions :column="4" border style="margin-top: 16px" title="财务状态">
          <el-descriptions-item label="开票状态">
            <el-tag :type="{ NOT_INVOICED: 'info', PARTIAL_INVOICED: 'warning', FULLY_INVOICED: 'success' }[order.invoiceStatus] || 'info'" size="small">
              {{ { NOT_INVOICED: '未开票', PARTIAL_INVOICED: '部分开票', FULLY_INVOICED: '已开票' }[order.invoiceStatus] || '未开票' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="已开票金额">{{ order.invoicedAmount ? formatAmount(order.invoicedAmount) : '0.00' }}</el-descriptions-item>
          <el-descriptions-item label="已收款金额">{{ order.paidAmount ? formatAmount(order.paidAmount) : '0.00' }}</el-descriptions-item>
          <el-descriptions-item label="是否结清">
            <el-tag :type="order.settlementFlag ? 'success' : 'danger'" size="small">{{ order.settlementFlag ? '已结清' : '未结清' }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <h3 style="margin: 20px 0 12px">{{ label('product') }}明细</h3>
        <el-table :data="order.items || []" border stripe>
          <el-table-column prop="productName" :label="label('product')" min-width="150" />
          <el-table-column prop="quantity" label="订单数量" width="120" align="right" />
          <el-table-column prop="unit" label="单位" width="80" align="center" />
          <el-table-column prop="unitPrice" label="销售单价" width="120" align="right">
            <template #default="{ row }">{{ formatAmount(row.unitPrice) }}</template>
          </el-table-column>
          <el-table-column prop="costUnitPrice" label="成本单价" width="120" align="right">
            <template #default="{ row }">{{ row.costUnitPrice ? formatAmount(row.costUnitPrice) : '-' }}</template>
          </el-table-column>
          <el-table-column prop="taxRate" label="税率" width="80" align="center">
            <template #default="{ row }">{{ row.taxRate != null ? `${row.taxRate}%` : '-' }}</template>
          </el-table-column>
          <el-table-column label="已发货" width="100" align="right">
            <template #default="{ row }">{{ row.deliveredQuantity || 0 }}</template>
          </el-table-column>
          <el-table-column label="销售小计" width="130" align="right">
            <template #default="{ row }">{{ formatAmount(row.quantity * row.unitPrice) }}</template>
          </el-table-column>
        </el-table>

        <h3 style="margin: 20px 0 12px">{{ label('delivery') }}记录</h3>
        <el-table :data="deliveries" border stripe>
          <el-table-column prop="deliveryNumber" label="发货单号" width="170" />
          <el-table-column prop="deliveryDate" label="发货日期" width="120" />
          <el-table-column prop="logisticsCompany" label="物流公司" width="120" />
          <el-table-column prop="trackingNumber" label="运单号" width="150" />
          <el-table-column prop="status" label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="(delStatusMap[row.status]?.type) || 'info'" size="small">
                {{ delStatusMap[row.status]?.text || row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="totalAmount" label="金额" width="130" align="right">
            <template #default="{ row }">{{ formatAmount(row.totalAmount) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="150" align="center">
            <template #default="{ row }">
              <el-button v-if="['DRAFT','PICKED'].includes(row.status) && canWrite" type="warning" link size="small" :disabled="submitting" @click="handleShip(row.id)">发货</el-button>
              <el-button v-if="row.status === 'SHIPPED' && canWrite" type="success" link size="small" :disabled="submitting" @click="handleDelivered(row.id)">签收</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-card>

    <el-dialog v-model="deliveryDialogVisible" :title="`创建${label('delivery')}单`" width="640px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="发货地址"><el-input v-model="deliveryForm.deliveryAddress" /></el-form-item>
        <el-form-item label="物流公司"><el-input v-model="deliveryForm.logisticsCompany" placeholder="如：顺丰冷链" /></el-form-item>
      </el-form>
      <el-table :data="deliveryForm.items" border style="margin-top: 12px">
        <el-table-column prop="productName" :label="label('product')" width="150" />
        <el-table-column label="发货数量" width="160">
          <template #default="{ row }">
            <el-input-number v-model="row.deliveredQuantity" :min="0" size="small" style="width: 130px" />
          </template>
        </el-table-column>
        <el-table-column prop="unit" label="单位" width="80" align="center" />
        <el-table-column prop="unitPrice" label="单价" width="120" align="right">
          <template #default="{ row }">{{ formatAmount(row.unitPrice) }}</template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="deliveryDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreateDelivery">创建发货单</el-button>
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
