<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import { Refresh, Search } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);

const loading = ref(false);
const overview = ref<any>(null);
const transactions = ref<any[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const agingData = ref<any[]>([]);
const searchType = ref('');

onMounted(() => {
  loadOverview();
  loadTransactions();
});

async function loadOverview() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const [overviewRes, arAgingRes, apAgingRes] = await Promise.allSettled([
      get(`/${factoryId.value}/finance/overview`),
      get(`/${factoryId.value}/finance/aging`, { params: { counterpartyType: 'CUSTOMER' } }),
      get(`/${factoryId.value}/finance/aging`, { params: { counterpartyType: 'SUPPLIER' } })
    ]);

    if (overviewRes.status === 'fulfilled' && overviewRes.value.success) {
      overview.value = overviewRes.value.data;
    }
    if (arAgingRes.status === 'fulfilled' && arAgingRes.value.success) {
      agingData.value = arAgingRes.value.data || [];
    }
  } catch (error) {
    console.error('加载概览失败:', error);
  } finally {
    loading.value = false;
  }
}

async function loadTransactions() {
  if (!factoryId.value) return;

  try {
    const params: any = {
      page: pagination.value.page,
      size: pagination.value.size
    };
    if (searchType.value) {
      params.counterpartyType = searchType.value;
    }

    const response = await get(`/${factoryId.value}/finance/transactions`, { params });
    if (response.success && response.data) {
      transactions.value = response.data.content || response.data.records || [];
      pagination.value.total = response.data.totalElements || response.data.total || 0;
    }
  } catch (error) {
    console.error('加载交易失败:', error);
  }
}

function handleRefresh() {
  searchType.value = '';
  loadOverview();
  loadTransactions();
}

function handleSearch() {
  pagination.value.page = 1;
  loadTransactions();
}

function handlePageChange(page: number) {
  pagination.value.page = page;
  loadTransactions();
}

function handleSizeChange(size: number) {
  pagination.value.size = size;
  pagination.value.page = 1;
  loadTransactions();
}

function formatMoney(val: any) {
  if (val === null || val === undefined) return '¥0.00';
  const n = Number(val);
  return isNaN(n) ? '¥0.00' : '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(val: string | null) {
  if (!val) return '-';
  return val.substring(0, 10);
}

function getTransactionTypeText(type: string) {
  const map: Record<string, string> = {
    RECEIVABLE: '应收挂账',
    AR_INVOICE: '应收开票',
    AR_PAYMENT: '客户付款',
    PAYABLE: '应付挂账',
    AP_INVOICE: '应付开票',
    AP_PAYMENT: '供应商付款',
    ADJUSTMENT: '手工调整'
  };
  return map[type] || type || '-';
}

function getTransactionTypeTag(type: string) {
  const map: Record<string, string> = {
    RECEIVABLE: 'warning',
    AR_INVOICE: 'warning',
    AR_PAYMENT: 'success',
    PAYABLE: 'danger',
    AP_INVOICE: 'danger',
    AP_PAYMENT: 'primary',
    ADJUSTMENT: 'info'
  };
  return map[type] || 'info';
}
</script>

<template>
  <div class="page-wrapper" v-loading="loading" empty-text="暂无数据">
    <!-- 财务概览 KPI -->
    <div class="kpi-row" v-if="overview">
      <div class="kpi-card receivable">
        <div class="kpi-label">应收总额</div>
        <div class="kpi-value">{{ formatMoney(overview.totalReceivable) }}</div>
        <div class="kpi-sub">逾期: {{ formatMoney(overview.overdueReceivable) }}</div>
      </div>
      <div class="kpi-card payable">
        <div class="kpi-label">应付总额</div>
        <div class="kpi-value">{{ formatMoney(overview.totalPayable) }}</div>
        <div class="kpi-sub">逾期: {{ formatMoney(overview.overduePayable) }}</div>
      </div>
      <div class="kpi-card net">
        <div class="kpi-label">净额 (应收-应付)</div>
        <div class="kpi-value" :class="{
          'positive': (overview.totalReceivable - overview.totalPayable) >= 0,
          'negative': (overview.totalReceivable - overview.totalPayable) < 0
        }">
          {{ formatMoney((overview.totalReceivable || 0) - (overview.totalPayable || 0)) }}
        </div>
      </div>
      <div class="kpi-card count">
        <div class="kpi-label">本月交易笔数</div>
        <div class="kpi-value">{{ overview.monthlyTransactionCount || 0 }}</div>
        <div class="kpi-sub">客户: {{ overview.customerCount || 0 }} / 供应商: {{ overview.supplierCount || 0 }}</div>
      </div>
    </div>

    <!-- 无数据时的概览占位 -->
    <div class="kpi-row" v-else-if="!loading">
      <div class="kpi-card receivable">
        <div class="kpi-label">应收总额</div>
        <div class="kpi-value">¥0.00</div>
      </div>
      <div class="kpi-card payable">
        <div class="kpi-label">应付总额</div>
        <div class="kpi-value">¥0.00</div>
      </div>
      <div class="kpi-card net">
        <div class="kpi-label">净额</div>
        <div class="kpi-value">¥0.00</div>
      </div>
      <div class="kpi-card count">
        <div class="kpi-label">交易笔数</div>
        <div class="kpi-value">0</div>
      </div>
    </div>

    <!-- 交易记录表格 -->
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">交易记录</span>
            <span class="data-count">共 {{ pagination.total }} 条记录</span>
          </div>
          <div class="header-right">
            <el-button :icon="Refresh" @click="handleRefresh">刷新</el-button>
          </div>
        </div>
      </template>

      <div class="search-bar">
        <el-select v-model="searchType" placeholder="全部类型" clearable style="width: 150px">
          <el-option label="客户 (应收)" value="CUSTOMER" />
          <el-option label="供应商 (应付)" value="SUPPLIER" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
      </div>

      <el-table :data="transactions" stripe border style="width: 100%">
        <el-table-column prop="transactionNumber" label="交易编号" width="160" />
        <el-table-column prop="transactionType" label="类型" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getTransactionTypeTag(row.transactionType)" size="small">
              {{ getTransactionTypeText(row.transactionType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="counterpartyName" label="客户/供应商" min-width="150" show-overflow-tooltip />
        <el-table-column prop="amount" label="金额" width="130" align="right">
          <template #default="{ row }">
            <span :class="{ 'text-income': row.transactionType === 'AR_PAYMENT', 'text-expense': row.transactionType === 'PAYABLE' }">
              {{ formatMoney(row.amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="balanceAfter" label="余额" width="130" align="right">
          <template #default="{ row }">
            {{ formatMoney(row.balanceAfter) }}
          </template>
        </el-table-column>
        <el-table-column prop="transactionDate" label="交易日期" width="120">
          <template #default="{ row }">
            {{ formatDate(row.transactionDate || row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="dueDate" label="到期日" width="120">
          <template #default="{ row }">
            {{ formatDate(row.dueDate) }}
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.page-wrapper {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding: 0;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.kpi-card {
  background: #fff;
  border: 1px solid var(--border-color-lighter, #ebeef5);
  border-radius: 8px;
  padding: 20px;
  text-align: center;

  .kpi-label {
    font-size: 13px;
    color: var(--text-color-secondary, #909399);
    margin-bottom: 8px;
  }

  .kpi-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--text-color-primary, #303133);
    line-height: 1.3;
  }

  .kpi-sub {
    font-size: 12px;
    color: var(--text-color-secondary, #909399);
    margin-top: 6px;
  }

  &.receivable {
    border-top: 3px solid #E6A23C;
    .kpi-value { color: #E6A23C; }
  }

  &.payable {
    border-top: 3px solid #F56C6C;
    .kpi-value { color: #F56C6C; }
  }

  &.net {
    border-top: 3px solid #409EFF;
    .positive { color: #67C23A; }
    .negative { color: #F56C6C; }
  }

  &.count {
    border-top: 3px solid #67C23A;
    .kpi-value { color: #67C23A; }
  }
}

.page-card {
  flex: 1;
  display: flex;
  flex-direction: column;

  :deep(.el-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color-lighter, #ebeef5);
  }

  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .header-left {
    display: flex;
    align-items: baseline;
    gap: 12px;

    .page-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-primary, #303133);
    }

    .data-count {
      font-size: 13px;
      color: var(--text-color-secondary, #909399);
    }
  }
}

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.el-table {
  flex: 1;
}

.text-income { color: #67C23A; font-weight: 600; }
.text-expense { color: #F56C6C; font-weight: 600; }

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--border-color-lighter, #ebeef5);
  margin-top: 16px;
}

@media (max-width: 1200px) {
  .kpi-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .kpi-row {
    grid-template-columns: 1fr;
  }
}
</style>
