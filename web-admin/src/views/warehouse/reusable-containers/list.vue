<template>
  <div class="reusable-containers-page">
    <el-card>
      <template #header>
        <div class="header">
          <span>周转耗材管理 (周转框)</span>
          <el-button type="primary" @click="openCreate">新建周转耗材</el-button>
        </div>
      </template>

      <el-table :data="rows" v-loading="loading" border stripe>
        <el-table-column prop="containerCode" label="编号" width="120" />
        <el-table-column prop="containerName" label="名称" min-width="160" />
        <el-table-column prop="specification" label="规格" min-width="180" />
        <el-table-column v-if="canViewPrice" prop="unitPrice" label="单价/赔偿价" width="120" />
        <el-table-column prop="totalQuantity" label="总持有" width="100" />
        <el-table-column prop="inWarehouseQuantity" label="在库" width="100" />
        <el-table-column prop="inTransitQuantity" label="在客户处" width="110" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openShipOut(row)">发出</el-button>
            <el-button size="small" type="success" @click="openReturnIn(row)">归还</el-button>
            <el-button size="small" type="warning" @click="openLoss(row)">报损</el-button>
            <el-button size="small" link @click="viewTx(row)">流水</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :total="total"
        layout="prev, pager, next, total"
        @current-change="loadList"
        style="margin-top: 12px; justify-content: flex-end"
      />
    </el-card>

    <!-- 新建 -->
    <el-dialog v-model="createVisible" title="新建周转耗材" width="520px">
      <el-form :model="createForm" label-width="110px">
        <el-form-item label="编号"><el-input v-model="createForm.containerCode" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="createForm.containerName" /></el-form-item>
        <el-form-item label="规格"><el-input v-model="createForm.specification" placeholder="60*40*30 cm / 25kg" /></el-form-item>
        <el-form-item v-if="canViewPrice" label="单价/赔偿价"><el-input-number v-model="createForm.unitPrice" :min="0" :precision="2" /></el-form-item>
        <el-form-item label="初始数量"><el-input-number v-model="createForm.totalQuantity" :min="0" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="createForm.remark" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">确认创建</el-button>
      </template>
    </el-dialog>

    <!-- 发出 / 归还 / 报损 通用 -->
    <el-dialog v-model="actionVisible" :title="actionTitle" width="500px">
      <el-form :model="actionForm" label-width="110px">
        <el-form-item label="数量">
          <el-input-number v-model="actionForm.quantity" :min="1" />
        </el-form-item>
        <el-form-item label="客户ID">
          <el-input v-model="actionForm.customerId" />
        </el-form-item>
        <el-form-item label="客户名称">
          <el-input v-model="actionForm.customerName" />
        </el-form-item>
        <el-form-item v-if="actionType === 'shipOut'" label="发货单ID">
          <el-input v-model="actionForm.salesDeliveryId" />
        </el-form-item>
        <el-form-item v-if="actionType === 'loss' && canViewPrice" label="赔偿金额">
          <el-input-number v-model="actionForm.compensationAmount" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="actionForm.remark" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="actionVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAction">确认</el-button>
      </template>
    </el-dialog>

    <!-- 流水 -->
    <el-dialog v-model="txVisible" title="流水记录" width="780px">
      <el-table :data="txRows" v-loading="txLoading" border>
        <el-table-column prop="createdAt" label="时间" width="170" />
        <el-table-column prop="transactionType" label="类型" width="100" />
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column prop="customerName" label="客户" min-width="140" />
        <el-table-column v-if="canViewPrice" prop="compensationAmount" label="赔偿金额" width="110" />
        <el-table-column prop="remark" label="备注" min-width="160" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { get, post } from '@/api/request';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canViewPrice = computed(() => permissionStore.canViewPrice);

const loading = ref(false);
const rows = ref<any[]>([]);
const page = ref(1);
const size = ref(20);
const total = ref(0);

const baseUrl = computed(() => `/${factoryId.value}/reusable-containers`);

async function loadList() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res: any = await get(baseUrl.value, {
      params: { page: page.value - 1, size: size.value },
    });
    const data = res?.data ?? res;
    rows.value = data?.content || [];
    total.value = data?.totalElements || 0;
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

// 创建
const createVisible = ref(false);
const createForm = ref<any>({});
function openCreate() {
  createForm.value = { totalQuantity: 0, unitPrice: 0 };
  createVisible.value = true;
}
async function submitCreate() {
  // 前端必填校验 — 防止静默提交空表单
  if (!createForm.value.containerCode || !createForm.value.containerCode.trim()) {
    ElMessage.warning('请填写编号');
    return;
  }
  if (!createForm.value.containerName || !createForm.value.containerName.trim()) {
    ElMessage.warning('请填写名称');
    return;
  }
  if (!factoryId.value) {
    ElMessage.error('工厂信息未就绪，请重新登录');
    return;
  }
  try {
    const res: any = await post(baseUrl.value, createForm.value);
    if (res && res.success === false) {
      throw new Error(res.message || '创建失败');
    }
    ElMessage.success('创建成功');
    createVisible.value = false;
    // 重置到首页以确保新建行可见 (按 createdAt desc 排序时)
    page.value = 1;
    await loadList();
  } catch (e: any) {
    ElMessage.error(e?.message || e?.response?.data?.message || '创建失败');
  }
}

// 发出/归还/报损
const actionVisible = ref(false);
const actionType = ref<'shipOut' | 'returnIn' | 'loss'>('shipOut');
const actionForm = ref<any>({});
const currentRow = ref<any>(null);
const actionTitle = computed(() => ({
  shipOut: '发出周转框',
  returnIn: '客户归还',
  loss: '登记丢失/赔偿',
}[actionType.value]));

function openShipOut(row: any) { currentRow.value = row; actionType.value = 'shipOut'; actionForm.value = { quantity: 1 }; actionVisible.value = true; }
function openReturnIn(row: any) { currentRow.value = row; actionType.value = 'returnIn'; actionForm.value = { quantity: 1 }; actionVisible.value = true; }
function openLoss(row: any) { currentRow.value = row; actionType.value = 'loss'; actionForm.value = { quantity: 1, compensationAmount: row.unitPrice || 0 }; actionVisible.value = true; }

async function submitAction() {
  try {
    const path = { shipOut: 'ship-out', returnIn: 'return-in', loss: 'loss' }[actionType.value];
    await post(`${baseUrl.value}/${currentRow.value.id}/${path}`, actionForm.value);
    ElMessage.success('操作成功');
    actionVisible.value = false;
    await loadList();
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败');
  }
}

// 流水
const txVisible = ref(false);
const txRows = ref<any[]>([]);
const txLoading = ref(false);
async function viewTx(row: any) {
  txVisible.value = true;
  txLoading.value = true;
  try {
    const res: any = await get(`${baseUrl.value}/${row.id}/transactions`);
    txRows.value = res?.data ?? res ?? [];
  } catch (e: any) {
    ElMessage.error(e?.message || '加载流水失败');
  } finally {
    txLoading.value = false;
  }
}

onMounted(loadList);
</script>

<style scoped>
.reusable-containers-page { padding: 16px; }
.header { display: flex; justify-content: space-between; align-items: center; }
</style>
