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
const canWrite = computed(() => permissionStore.canWrite('sales'));
const orderId = computed(() => route.params.id as string);

const loading = ref(false);
const order = ref<any>(null);
const deliveries = ref<any[]>([]);
const deliveryDialogVisible = ref(false);
const deliveryForm = ref<{ deliveryAddress: string; logisticsCompany: string; items: any[] }>({
  deliveryAddress: '', logisticsCompany: '', items: [],
});

const statusMap: Record<string, { text: string; type: string }> = {
  DRAFT: { text: '草稿', type: 'info' },
  CONFIRMED: { text: '已确认', type: '' },
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
  const map: Record<string, { label: string; url: string }> = {
    confirm: { label: '确认订单', url: `/${factoryId.value}/sales/orders/${orderId.value}/confirm` },
    cancel: { label: '取消订单', url: `/${factoryId.value}/sales/orders/${orderId.value}/cancel` },
  };
  const a = map[action];
  if (!a) return;
  try {
    await ElMessageBox.confirm(`确认${a.label}？`, '操作确认');
    const res = await post(a.url);
    if (res.success) { ElMessage.success(`${a.label}成功`); loadOrder(); }
  } catch { /* cancelled */ }
}

function openDeliveryDialog() {
  if (!order.value?.items?.length) return;
  deliveryForm.value = {
    deliveryAddress: order.value.deliveryAddress || '',
    logisticsCompany: '',
    items: order.value.items.map((it: any) => ({
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
  try {
    const res = await post(`/${factoryId.value}/sales/deliveries`, {
      salesOrderId: orderId.value,
      deliveryAddress: deliveryForm.value.deliveryAddress,
      logisticsCompany: deliveryForm.value.logisticsCompany,
      items: deliveryForm.value.items.filter(i => i.deliveredQuantity > 0),
    });
    if (res.success) {
      ElMessage.success('发货单创建成功');
      deliveryDialogVisible.value = false;
      loadOrder(); loadDeliveries();
    }
  } catch { ElMessage.error('创建失败'); }
}

async function handleShip(deliveryId: string) {
  try {
    await ElMessageBox.confirm('确认发货？将扣减成品库存', '确认');
    const res = await post(`/${factoryId.value}/sales/deliveries/${deliveryId}/ship`);
    if (res.success) { ElMessage.success('发货成功'); loadDeliveries(); loadOrder(); }
  } catch { /* cancelled */ }
}

async function handleDelivered(deliveryId: string) {
  try {
    await ElMessageBox.confirm('确认客户已签收？', '确认');
    const res = await post(`/${factoryId.value}/sales/deliveries/${deliveryId}/delivered`);
    if (res.success) { ElMessage.success('签收确认成功'); loadDeliveries(); loadOrder(); }
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
            <el-button :icon="ArrowLeft" @click="router.push('/sales/orders')">返回</el-button>
            <span class="page-title">{{ label('salesOrder') }}详情</span>
            <el-tag v-if="order" :type="(statusMap[order.status]?.type as any) || 'info'" size="large">
              {{ statusMap[order.status]?.text || order.status }}
            </el-tag>
          </div>
          <div class="header-right" v-if="order && canWrite">
            <el-button v-if="order.status === 'DRAFT'" type="success" @click="handleAction('confirm')">确认订单</el-button>
            <el-button v-if="['CONFIRMED','PROCESSING','PARTIAL_DELIVERED'].includes(order.status)" type="primary" @click="openDeliveryDialog">{{ label('delivery') }}</el-button>
            <el-button v-if="['DRAFT','CONFIRMED'].includes(order.status)" type="danger" @click="handleAction('cancel')">取消</el-button>
          </div>
        </div>
      </template>

      <template v-if="order">
        <el-descriptions :column="3" border>
          <el-descriptions-item label="订单编号">{{ order.orderNumber }}</el-descriptions-item>
          <el-descriptions-item :label="label('customer')">{{ order.customer?.name || order.customerId }}</el-descriptions-item>
          <el-descriptions-item label="下单日期">{{ order.orderDate }}</el-descriptions-item>
          <el-descriptions-item label="交货日期">{{ order.requiredDeliveryDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="总金额">{{ formatAmount(order.totalAmount) }}</el-descriptions-item>
          <el-descriptions-item label="折扣">{{ order.discountAmount ? formatAmount(order.discountAmount) : '-' }}</el-descriptions-item>
          <el-descriptions-item label="交货地址" :span="3">{{ order.deliveryAddress || '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="3">{{ order.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h3 style="margin: 20px 0 12px">{{ label('product') }}明细</h3>
        <el-table :data="order.items || []" border stripe>
          <el-table-column prop="productName" :label="label('product')" min-width="150" />
          <el-table-column prop="quantity" label="订单数量" width="120" align="right" />
          <el-table-column prop="unit" label="单位" width="80" align="center" />
          <el-table-column prop="unitPrice" label="单价" width="120" align="right">
            <template #default="{ row }">{{ formatAmount(row.unitPrice) }}</template>
          </el-table-column>
          <el-table-column label="已发货" width="100" align="right">
            <template #default="{ row }">{{ row.deliveredQuantity || 0 }}</template>
          </el-table-column>
          <el-table-column label="小计" width="130" align="right">
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
              <el-tag :type="(delStatusMap[row.status]?.type as any) || 'info'" size="small">
                {{ delStatusMap[row.status]?.text || row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="totalAmount" label="金额" width="130" align="right">
            <template #default="{ row }">{{ formatAmount(row.totalAmount) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="150" align="center">
            <template #default="{ row }">
              <el-button v-if="['DRAFT','PICKED'].includes(row.status) && canWrite" type="warning" link size="small" @click="handleShip(row.id)">发货</el-button>
              <el-button v-if="row.status === 'SHIPPED' && canWrite" type="success" link size="small" @click="handleDelivered(row.id)">签收</el-button>
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
        <el-button type="primary" @click="handleCreateDelivery">创建发货单</el-button>
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
