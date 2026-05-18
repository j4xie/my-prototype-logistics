<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get } from '@/api/request';
import { Refresh, Document, View } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canHRManage = computed(() => permissionStore.canWrite('hr'));

type BalanceRow = {
  id: string;
  userId: number;
  yearMonth: string;
  earnedThisMonth: number;
  usedThisMonth: number;
  availableHours: number;
  lastCalculatedAt?: string;
};

type LedgerEntry = {
  id: string;
  userId: number;
  transactionType: 'EARN' | 'USE';
  hours: number;
  sourceType: 'OT_APPROVED' | 'LEAVE_APPROVED' | 'MANUAL_ADJUST';
  sourceRefId?: string;
  yearMonth: string;
  balanceAfterHours: number;
  note?: string;
  operatorId?: number;
  createdAt?: string;
};

const SOURCE_TYPE_LABEL: Record<string, string> = {
  OT_APPROVED: '加班审批',
  LEAVE_APPROVED: '调休假审批',
  MANUAL_ADJUST: 'HR 手工调整',
};

const TXN_TYPE_LABEL: Record<string, string> = {
  EARN: '入账',
  USE: '出账',
};

const activeTab = ref<'mine' | 'factory'>('mine');
const loading = ref(false);
const tableData = ref<BalanceRow[]>([]);

const factoryYearMonth = ref<string>(currentYearMonth());

// Ledger drill-down dialog
const ledgerDialogOpen = ref(false);
const ledgerLoading = ref(false);
const ledgerData = ref<LedgerEntry[]>([]);
const ledgerTotal = ref(0);
const ledgerPage = ref(0);
const ledgerSize = ref(50);
const ledgerForUserId = ref<number | null>(null);
const ledgerForUserLabel = ref<string>('');

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

onMounted(() => { loadMine(); });
watch(activeTab, () => { activeTab.value === 'mine' ? loadMine() : loadFactory(); });

async function loadMine(): Promise<void> {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await get<BalanceRow[]>(`/${factoryId.value}/hr/comptime-balances/mine`);
    tableData.value = res.success && Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    console.error('加载我的调休余额失败:', e);
    tableData.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadFactory(): Promise<void> {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await get<BalanceRow[]>(`/${factoryId.value}/hr/comptime-balances`, {
      params: { yearMonth: factoryYearMonth.value },
    });
    tableData.value = res.success && Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    console.error('加载工厂调休余额失败:', e);
    tableData.value = [];
  } finally {
    loading.value = false;
  }
}

async function openLedger(row: BalanceRow, isMine: boolean): Promise<void> {
  ledgerForUserId.value = row.userId;
  ledgerForUserLabel.value = isMine ? '我的明细' : `员工 ${row.userId} 明细`;
  ledgerPage.value = 0;
  ledgerDialogOpen.value = true;
  await loadLedger(isMine);
}

async function loadLedger(isMine: boolean): Promise<void> {
  if (!factoryId.value || ledgerForUserId.value == null) return;
  ledgerLoading.value = true;
  try {
    const url = isMine
      ? `/${factoryId.value}/hr/comptime-balances/mine/ledger`
      : `/${factoryId.value}/hr/comptime-balances/users/${ledgerForUserId.value}/ledger`;
    const res = await get<{ content: LedgerEntry[]; totalElements: number }>(url, {
      params: { page: ledgerPage.value, size: ledgerSize.value },
    });
    if (res.success && res.data && typeof res.data === 'object' && 'content' in res.data) {
      ledgerData.value = res.data.content;
      ledgerTotal.value = res.data.totalElements;
    } else {
      ledgerData.value = [];
      ledgerTotal.value = 0;
    }
  } catch (e) {
    console.error('加载 ledger 失败:', e);
    ledgerData.value = [];
  } finally {
    ledgerLoading.value = false;
  }
}

function onLedgerPage(page: number): void {
  ledgerPage.value = page - 1;
  // re-load with current tab context
  loadLedger(activeTab.value === 'mine');
}
</script>

<template>
  <div class="comptime-balance-page" style="padding: 16px;">
    <el-card>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div>
          <h2 style="margin: 0;">调休账单</h2>
          <p style="margin: 4px 0 0 0; color: #909399; font-size: 13px;">
            加班审批通过后自动入账 (EARN), 调休假审批通过后自动出账 (USE). 跨月累计.
          </p>
        </div>
        <el-button :icon="Refresh" @click="activeTab === 'mine' ? loadMine() : loadFactory()">刷新</el-button>
      </div>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="我的余额" name="mine" />
        <el-tab-pane v-if="canHRManage" label="工厂余额(HR)" name="factory" />
      </el-tabs>

      <!-- 我的余额 -->
      <div v-if="activeTab === 'mine'">
        <el-table :data="tableData" v-loading="loading" stripe>
          <el-table-column prop="yearMonth" label="月份" width="120" />
          <el-table-column prop="earnedThisMonth" label="本月入账(h)" width="140">
            <template #default="{ row }">
              <span style="color: #67c23a; font-weight: 500;">+{{ row.earnedThisMonth }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="usedThisMonth" label="本月出账(h)" width="140">
            <template #default="{ row }">
              <span style="color: #e6a23c; font-weight: 500;">-{{ row.usedThisMonth }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="availableHours" label="累计可用(h)" width="140">
            <template #default="{ row }">
              <span :style="{
                color: row.availableHours <= 0 ? '#f56c6c' : '#67c23a',
                fontWeight: 600,
                fontSize: '15px'
              }">
                {{ row.availableHours }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="lastCalculatedAt" label="最近更新" width="180" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button link size="small" :icon="Document" @click="openLedger(row, true)">明细</el-button>
            </template>
          </el-table-column>
          <!-- 防呆 R5: empty state with CTA -->
          <template #empty>
            <div style="padding: 40px 20px; text-align: center;">
              <el-icon :size="48" color="#c0c4cc"><Document /></el-icon>
              <p style="color: #909399; margin: 16px 0 8px 0;">暂无累计调休</p>
              <p style="color: #c0c4cc; font-size: 13px; margin: 0;">
                提交加班申请累积调休 credit (加班审批通过后自动入账)
              </p>
            </div>
          </template>
        </el-table>
      </div>

      <!-- 工厂余额 (HR) -->
      <div v-else>
        <el-form inline>
          <el-form-item label="月份">
            <el-input v-model="factoryYearMonth" placeholder="YYYY-MM" style="width: 140px;" @change="loadFactory" />
          </el-form-item>
        </el-form>
        <el-table :data="tableData" v-loading="loading" stripe>
          <el-table-column prop="userId" label="员工ID" width="100" />
          <el-table-column prop="yearMonth" label="月份" width="120" />
          <el-table-column prop="earnedThisMonth" label="本月入账(h)" width="140">
            <template #default="{ row }">
              <span style="color: #67c23a; font-weight: 500;">+{{ row.earnedThisMonth }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="usedThisMonth" label="本月出账(h)" width="140">
            <template #default="{ row }">
              <span style="color: #e6a23c; font-weight: 500;">-{{ row.usedThisMonth }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="availableHours" label="累计可用(h)" width="140">
            <template #default="{ row }">
              <span :style="{
                color: row.availableHours <= 0 ? '#f56c6c' : '#67c23a',
                fontWeight: 600,
                fontSize: '15px'
              }">
                {{ row.availableHours }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button link size="small" :icon="View" @click="openLedger(row, false)">明细</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- Ledger drill-down dialog -->
    <el-dialog v-model="ledgerDialogOpen" :title="`调休账户明细 — ${ledgerForUserLabel}`" width="900px" destroy-on-close>
      <el-table :data="ledgerData" v-loading="ledgerLoading" stripe size="small">
        <el-table-column prop="createdAt" label="时间" width="170" />
        <el-table-column prop="transactionType" label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.transactionType === 'EARN' ? 'success' : 'warning'" size="small">
              {{ TXN_TYPE_LABEL[row.transactionType] || row.transactionType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="hours" label="小时" width="100">
          <template #default="{ row }">
            <span :style="{
              color: row.transactionType === 'EARN' ? '#67c23a' : '#e6a23c',
              fontWeight: 500
            }">
              {{ row.transactionType === 'EARN' ? '+' : '-' }}{{ row.hours }}h
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="balanceAfterHours" label="入账后余额" width="120">
          <template #default="{ row }">
            <span style="font-weight: 600;">{{ row.balanceAfterHours }}h</span>
          </template>
        </el-table-column>
        <el-table-column prop="sourceType" label="来源" width="120">
          <template #default="{ row }">
            {{ SOURCE_TYPE_LABEL[row.sourceType] || row.sourceType }}
          </template>
        </el-table-column>
        <el-table-column prop="sourceRefId" label="原单号" width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <code style="font-size: 12px; color: #606266;">{{ row.sourceRefId || '-' }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="note" label="备注" show-overflow-tooltip />
        <template #empty>
          <div style="padding: 24px; color: #909399;">暂无明细</div>
        </template>
      </el-table>
      <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
        <el-pagination
          v-model:current-page="ledgerPage"
          :page-size="ledgerSize"
          :total="ledgerTotal"
          layout="total, prev, pager, next"
          @current-change="onLedgerPage"
        />
      </div>
    </el-dialog>
  </div>
</template>
