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
const canWrite = computed(() => permissionStore.canWrite('warehouse'));
const transferId = computed(() => route.params.id as string);

const loading = ref(false);
const transfer = ref<any>(null);

const statusMap: Record<string, { text: string; type: string }> = {
  DRAFT: { text: '草稿', type: 'info' },
  REQUESTED: { text: '已申请', type: 'warning' },
  APPROVED: { text: '已批准', type: '' },
  REJECTED: { text: '已驳回', type: 'danger' },
  SHIPPED: { text: '已发运', type: 'warning' },
  RECEIVED: { text: '已签收', type: '' },
  CONFIRMED: { text: '已确认', type: 'success' },
  CANCELLED: { text: '已取消', type: 'info' },
};

// 状态流转步骤
const statusSteps = ['DRAFT', 'REQUESTED', 'APPROVED', 'SHIPPED', 'RECEIVED', 'CONFIRMED'];

onMounted(() => loadTransfer());

async function loadTransfer() {
  if (!factoryId.value || !transferId.value) return;
  loading.value = true;
  try {
    const res = await get(`/${factoryId.value}/transfers/${transferId.value}`);
    if (res.success) transfer.value = res.data;
  } catch { ElMessage.error('加载失败'); }
  finally { loading.value = false; }
}

function currentStep() {
  if (!transfer.value) return 0;
  const idx = statusSteps.indexOf(transfer.value.status);
  return idx >= 0 ? idx : 0;
}

const isOutbound = computed(() => transfer.value?.sourceFactoryId === factoryId.value);

async function handleAction(action: string, reasonRequired = false) {
  const map: Record<string, { label: string; url: string }> = {
    request: { label: '提交申请', url: `/${factoryId.value}/transfers/${transferId.value}/request` },
    approve: { label: '审批通过', url: `/${factoryId.value}/transfers/${transferId.value}/approve` },
    reject: { label: '驳回', url: `/${factoryId.value}/transfers/${transferId.value}/reject` },
    ship: { label: '确认发运', url: `/${factoryId.value}/transfers/${transferId.value}/ship` },
    receive: { label: '确认签收', url: `/${factoryId.value}/transfers/${transferId.value}/receive` },
    confirm: { label: '确认入库', url: `/${factoryId.value}/transfers/${transferId.value}/confirm` },
    cancel: { label: '取消', url: `/${factoryId.value}/transfers/${transferId.value}/cancel` },
  };
  const a = map[action];
  if (!a) return;
  try {
    await ElMessageBox.confirm(`确认${a.label}？`, '操作确认');
    const res = await post(a.url);
    if (res.success) { ElMessage.success(`${a.label}成功`); loadTransfer(); }
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
            <el-button :icon="ArrowLeft" @click="router.push('/transfer/list')">返回</el-button>
            <span class="page-title">{{ label('transfer') }}详情</span>
            <el-tag v-if="transfer" :type="(statusMap[transfer.status]?.type as any) || 'info'" size="large">
              {{ statusMap[transfer.status]?.text || transfer.status }}
            </el-tag>
          </div>
          <div class="header-right" v-if="transfer && canWrite">
            <el-button v-if="transfer.status === 'DRAFT'" type="warning" @click="handleAction('request')">提交申请</el-button>
            <el-button v-if="transfer.status === 'REQUESTED'" type="success" @click="handleAction('approve')">审批通过</el-button>
            <el-button v-if="transfer.status === 'REQUESTED'" type="danger" @click="handleAction('reject')">驳回</el-button>
            <el-button v-if="transfer.status === 'APPROVED' && isOutbound" type="primary" @click="handleAction('ship')">确认发运</el-button>
            <el-button v-if="transfer.status === 'SHIPPED' && !isOutbound" type="primary" @click="handleAction('receive')">确认签收</el-button>
            <el-button v-if="transfer.status === 'RECEIVED' && !isOutbound" type="success" @click="handleAction('confirm')">确认入库</el-button>
            <el-button v-if="['DRAFT','REQUESTED'].includes(transfer.status)" @click="handleAction('cancel')">取消</el-button>
          </div>
        </div>
      </template>

      <template v-if="transfer">
        <!-- 状态流程 -->
        <el-steps :active="currentStep()" finish-status="success" style="margin-bottom: 24px">
          <el-step title="草稿" />
          <el-step title="已申请" />
          <el-step title="已批准" />
          <el-step title="已发运" />
          <el-step title="已签收" />
          <el-step title="已确认" />
        </el-steps>

        <el-descriptions :column="3" border>
          <el-descriptions-item label="调拨编号">{{ transfer.transferNumber }}</el-descriptions-item>
          <el-descriptions-item label="调拨类型">
            {{ transfer.transferType === 'HQ_TO_BRANCH' ? '总部→分部' : transfer.transferType === 'BRANCH_TO_BRANCH' ? '分部→分部' : '分部→总部' }}
          </el-descriptions-item>
          <el-descriptions-item label="总金额">{{ formatAmount(transfer.totalAmount) }}</el-descriptions-item>
          <el-descriptions-item label="调出方">{{ transfer.sourceFactory?.name || transfer.sourceFactoryId }}</el-descriptions-item>
          <el-descriptions-item label="调入方">{{ transfer.targetFactory?.name || transfer.targetFactoryId }}</el-descriptions-item>
          <el-descriptions-item label="调拨日期">{{ transfer.transferDate }}</el-descriptions-item>
          <el-descriptions-item label="预计到达">{{ transfer.expectedArrivalDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="申请人">{{ transfer.requestedBy || '-' }}</el-descriptions-item>
          <el-descriptions-item label="审批人">{{ transfer.approvedBy || '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="3">{{ transfer.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h3 style="margin: 20px 0 12px">调拨明细</h3>
        <el-table :data="transfer.items || []" border stripe>
          <el-table-column label="类型" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.itemType === 'RAW_MATERIAL' ? '' : 'success'" size="small">
                {{ row.itemType === 'RAW_MATERIAL' ? '原料' : '成品' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="品名" min-width="150">
            <template #default="{ row }">
              {{ row.materialType?.name || row.productType?.name || row.materialTypeId || row.productTypeId || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="quantity" label="调拨数量" width="120" align="right" />
          <el-table-column label="已收数量" width="120" align="right">
            <template #default="{ row }">{{ row.receivedQuantity || 0 }}</template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="80" align="center" />
          <el-table-column prop="unitPrice" label="单价" width="120" align="right">
            <template #default="{ row }">{{ formatAmount(row.unitPrice) }}</template>
          </el-table-column>
          <el-table-column label="小计" width="130" align="right">
            <template #default="{ row }">{{ formatAmount(row.quantity * row.unitPrice) }}</template>
          </el-table-column>
        </el-table>
      </template>
    </el-card>
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
