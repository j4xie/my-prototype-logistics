<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);

const activeTab = ref('overview');
const loading = ref(false);

// 概览数据
const overview = ref<any>(null);
// 交易记录
const transactions = ref<any[]>([]);
const txPagination = ref({ page: 1, size: 10, total: 0 });
const txTypeFilter = ref('');
// 账龄
const agingData = ref<any[]>([]);
const agingType = ref('CUSTOMER');

const txTypeMap: Record<string, { text: string; type: string }> = {
  AR_INVOICE: { text: '应收挂账', type: 'warning' },
  AR_PAYMENT: { text: '客户回款', type: 'success' },
  AR_ADJUSTMENT: { text: '应收调整', type: 'info' },
  AP_INVOICE: { text: '应付挂账', type: 'danger' },
  AP_PAYMENT: { text: '供应商付款', type: 'success' },
  AP_ADJUSTMENT: { text: '应付调整', type: 'info' },
};

const paymentMethodMap: Record<string, string> = {
  CASH: '现金', BANK_TRANSFER: '银行转账', WECHAT: '微信', ALIPAY: '支付宝',
  CHECK: '支票', CREDIT: '赊账', POS: 'POS', OTHER: '其他',
};

onMounted(() => {
  loadOverview();
  loadTransactions();
  loadAging();
});

async function loadOverview() {
  if (!factoryId.value) return;
  try {
    const res = await get(`/${factoryId.value}/finance/overview`);
    if (res.success) overview.value = res.data;
  } catch { /* ignore */ }
}

async function loadTransactions() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const params: any = { page: txPagination.value.page, size: txPagination.value.size };
    if (txTypeFilter.value) params.counterpartyType = txTypeFilter.value;
    const res = await get(`/${factoryId.value}/finance/transactions`, { params });
    if (res.success && res.data) {
      transactions.value = res.data.content || [];
      txPagination.value.total = res.data.totalElements || 0;
    }
  } catch { ElMessage.error('加载交易记录失败'); }
  finally { loading.value = false; }
}

async function loadAging() {
  if (!factoryId.value) return;
  try {
    const res = await get(`/${factoryId.value}/finance/aging`, { params: { counterpartyType: agingType.value } });
    if (res.success) agingData.value = Array.isArray(res.data) ? res.data : [];
  } catch { /* ignore */ }
}

function handleTxPageChange(page: number) { txPagination.value.page = page; loadTransactions(); }
function handleTxSizeChange(size: number) { txPagination.value.size = size; txPagination.value.page = 1; loadTransactions(); }
function handleTxTypeChange() { txPagination.value.page = 1; loadTransactions(); }
function handleAgingTypeChange() { loadAging(); }

function formatAmount(val: number) {
  if (val == null) return '-';
  return `¥${Number(val).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="page-title">应收应付管理</span>
          <el-button :icon="Refresh" @click="loadOverview(); loadTransactions(); loadAging();">刷新</el-button>
        </div>
      </template>

      <el-tabs v-model="activeTab">
        <!-- 概览 Tab -->
        <el-tab-pane label="财务概览" name="overview">
          <div class="stat-cards" v-if="overview">
            <el-card class="stat-card ar" shadow="hover">
              <div class="stat-label">应收总额</div>
              <div class="stat-value">{{ formatAmount(overview.totalReceivable) }}</div>
              <div class="stat-sub">{{ overview.receivableCount || 0 }} 笔未收</div>
            </el-card>
            <el-card class="stat-card ap" shadow="hover">
              <div class="stat-label">应付总额</div>
              <div class="stat-value">{{ formatAmount(overview.totalPayable) }}</div>
              <div class="stat-sub">{{ overview.payableCount || 0 }} 笔未付</div>
            </el-card>
            <el-card class="stat-card net" shadow="hover">
              <div class="stat-label">净额 (应收-应付)</div>
              <div class="stat-value">{{ formatAmount((overview.totalReceivable || 0) - (overview.totalPayable || 0)) }}</div>
              <div class="stat-sub">{{ (overview.totalReceivable || 0) > (overview.totalPayable || 0) ? '净应收' : '净应付' }}</div>
            </el-card>
            <el-card class="stat-card overdue" shadow="hover">
              <div class="stat-label">逾期金额</div>
              <div class="stat-value">{{ formatAmount(overview.overdueAmount) }}</div>
              <div class="stat-sub">{{ overview.overdueCount || 0 }} 笔逾期</div>
            </el-card>
          </div>
          <el-empty v-else description="暂无数据" />
        </el-tab-pane>

        <!-- 应收 Tab -->
        <el-tab-pane label="应收账款" name="receivable">
          <div class="tab-toolbar">
            <el-button :icon="Refresh" @click="txTypeFilter = 'CUSTOMER'; loadTransactions()">刷新</el-button>
          </div>
          <el-table :data="transactions.filter(t => ['AR_INVOICE','AR_PAYMENT','AR_ADJUSTMENT'].includes(t.transactionType))" border stripe v-loading="loading">
            <el-table-column prop="transactionNumber" label="交易编号" width="150" />
            <el-table-column prop="counterpartyName" label="客户" min-width="140" show-overflow-tooltip />
            <el-table-column prop="transactionType" label="类型" width="120" align="center">
              <template #default="{ row }">
                <el-tag :type="(txTypeMap[row.transactionType]?.type as any) || 'info'" size="small">
                  {{ txTypeMap[row.transactionType]?.text || row.transactionType }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="amount" label="金额" width="130" align="right">
              <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
            </el-table-column>
            <el-table-column prop="balanceAfter" label="余额" width="130" align="right">
              <template #default="{ row }">{{ formatAmount(row.balanceAfter) }}</template>
            </el-table-column>
            <el-table-column prop="paymentMethod" label="支付方式" width="110" align="center">
              <template #default="{ row }">{{ row.paymentMethod ? paymentMethodMap[row.paymentMethod] || row.paymentMethod : '-' }}</template>
            </el-table-column>
            <el-table-column prop="transactionDate" label="日期" width="120" />
            <el-table-column prop="dueDate" label="到期日" width="120" />
            <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
          </el-table>
        </el-tab-pane>

        <!-- 应付 Tab -->
        <el-tab-pane label="应付账款" name="payable">
          <el-table :data="transactions.filter(t => ['AP_INVOICE','AP_PAYMENT','AP_ADJUSTMENT'].includes(t.transactionType))" border stripe v-loading="loading">
            <el-table-column prop="transactionNumber" label="交易编号" width="150" />
            <el-table-column prop="counterpartyName" label="供应商" min-width="140" show-overflow-tooltip />
            <el-table-column prop="transactionType" label="类型" width="120" align="center">
              <template #default="{ row }">
                <el-tag :type="(txTypeMap[row.transactionType]?.type as any) || 'info'" size="small">
                  {{ txTypeMap[row.transactionType]?.text || row.transactionType }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="amount" label="金额" width="130" align="right">
              <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
            </el-table-column>
            <el-table-column prop="balanceAfter" label="余额" width="130" align="right">
              <template #default="{ row }">{{ formatAmount(row.balanceAfter) }}</template>
            </el-table-column>
            <el-table-column prop="paymentMethod" label="支付方式" width="110" align="center">
              <template #default="{ row }">{{ row.paymentMethod ? paymentMethodMap[row.paymentMethod] || row.paymentMethod : '-' }}</template>
            </el-table-column>
            <el-table-column prop="transactionDate" label="日期" width="120" />
            <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
          </el-table>
        </el-tab-pane>

        <!-- 账龄 Tab -->
        <el-tab-pane label="账龄分析" name="aging">
          <div class="tab-toolbar">
            <el-radio-group v-model="agingType" @change="handleAgingTypeChange">
              <el-radio-button value="CUSTOMER">应收账龄</el-radio-button>
              <el-radio-button value="SUPPLIER">应付账龄</el-radio-button>
            </el-radio-group>
          </div>
          <el-table :data="agingData" border stripe>
            <el-table-column prop="counterpartyName" :label="agingType === 'CUSTOMER' ? '客户' : '供应商'" min-width="160" />
            <el-table-column prop="totalBalance" label="总余额" width="130" align="right">
              <template #default="{ row }">{{ formatAmount(row.totalBalance) }}</template>
            </el-table-column>
            <el-table-column prop="current" label="未到期" width="110" align="right">
              <template #default="{ row }">{{ formatAmount(row.current) }}</template>
            </el-table-column>
            <el-table-column prop="days1to30" label="1-30天" width="110" align="right">
              <template #default="{ row }">{{ formatAmount(row.days1to30) }}</template>
            </el-table-column>
            <el-table-column prop="days31to60" label="31-60天" width="110" align="right">
              <template #default="{ row }">{{ formatAmount(row.days31to60) }}</template>
            </el-table-column>
            <el-table-column prop="days61to90" label="61-90天" width="110" align="right">
              <template #default="{ row }">{{ formatAmount(row.days61to90) }}</template>
            </el-table-column>
            <el-table-column prop="days91to180" label="91-180天" width="110" align="right">
              <template #default="{ row }">{{ formatAmount(row.days91to180) }}</template>
            </el-table-column>
            <el-table-column prop="over180" label=">180天" width="110" align="right">
              <template #default="{ row }">
                <span :style="{ color: row.over180 > 0 ? '#f56c6c' : '' }">{{ formatAmount(row.over180) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>

      <!-- 交易记录分页 -->
      <div v-if="activeTab === 'receivable' || activeTab === 'payable'" class="pagination-wrapper">
        <el-pagination v-model:current-page="txPagination.page" v-model:page-size="txPagination.size"
          :page-sizes="[10, 20, 50]" :total="txPagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handleTxPageChange" @size-change="handleTxSizeChange" />
      </div>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.page-wrapper { height: 100%; width: 100%; display: flex; flex-direction: column; }
.page-card { flex: 1; display: flex; flex-direction: column;
  :deep(.el-card__header) { padding: 16px 20px; border-bottom: 1px solid #ebeef5; }
  :deep(.el-card__body) { flex: 1; display: flex; flex-direction: column; padding: 20px; }
}
.card-header { display: flex; justify-content: space-between; align-items: center;
  .page-title { font-size: 16px; font-weight: 600; color: #303133; }
}
.stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.stat-card {
  text-align: center;
  padding: 20px;
  border-radius: 8px;
  .stat-label { font-size: 13px; color: #909399; margin-bottom: 8px; }
  .stat-value { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
  .stat-sub { font-size: 12px; color: #b1b3b8; }
  &.ar .stat-value { color: #e6a23c; }
  &.ap .stat-value { color: #f56c6c; }
  &.net .stat-value { color: #409eff; }
  &.overdue .stat-value { color: #f56c6c; }
}
.tab-toolbar { display: flex; gap: 12px; margin-bottom: 16px; }
.pagination-wrapper { display: flex; justify-content: flex-end; padding-top: 16px; border-top: 1px solid #ebeef5; margin-top: 16px; }
</style>
