<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get } from '@/api/request';
import { Refresh } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('hr'));

type BalanceRow = {
  id: string;
  userId: number;
  leaveType: string;
  yearMonth: string;
  earnedHours: number;
  usedHours: number;
  balanceHours: number;
  lastCalculatedAt?: string;
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  SICK: '病假', PERSONAL: '事假', ANNUAL: '年假', MARRIAGE: '婚假',
  FUNERAL: '丧假', MATERNITY: '产假', PATERNITY: '陪产假',
  COMPTIME: '调休', OTHER: '其它',
};

const activeTab = ref<'mine' | 'factory'>('mine');
const loading = ref(false);
const tableData = ref<BalanceRow[]>([]);

const mineYearMonth = ref<string>('');  // 空 = 全部月份
const factoryYearMonth = ref<string>(currentYearMonth());
const factoryLeaveType = ref<string>('COMPTIME');

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

onMounted(() => { loadMine(); });
watch(activeTab, () => { activeTab.value === 'mine' ? loadMine() : loadFactory(); });

async function loadMine() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const params: Record<string, string> = {};
    if (mineYearMonth.value) params.yearMonth = mineYearMonth.value;
    const res = await get(`/${factoryId.value}/hr/leave-balances/mine`, { params });
    if (res.success && res.data) {
      tableData.value = res.data as BalanceRow[];
    } else {
      tableData.value = [];
    }
  } catch (e) {
    console.error('加载我的余额失败:', e);
    tableData.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadFactory() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await get(`/${factoryId.value}/hr/leave-balances`, {
      params: { leaveType: factoryLeaveType.value, yearMonth: factoryYearMonth.value }
    });
    if (res.success && res.data) {
      tableData.value = res.data as BalanceRow[];
    } else {
      tableData.value = [];
    }
  } catch (e) {
    console.error('加载工厂余额失败:', e);
    tableData.value = [];
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="leave-balances-page" style="padding: 16px;">
    <el-card>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h2 style="margin: 0;">假期余额</h2>
        <el-button :icon="Refresh" @click="activeTab === 'mine' ? loadMine() : loadFactory()">刷新</el-button>
      </div>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="我的余额" name="mine" />
        <el-tab-pane v-if="canWrite" label="工厂余额(HR)" name="factory" />
      </el-tabs>

      <!-- 我的余额 -->
      <div v-if="activeTab === 'mine'">
        <el-form inline>
          <el-form-item label="月份(留空看全部)">
            <el-input v-model="mineYearMonth" placeholder="YYYY-MM" style="width: 140px;" @change="loadMine" />
          </el-form-item>
        </el-form>
        <el-table :data="tableData" v-loading="loading" stripe>
          <el-table-column prop="yearMonth" label="月份" width="120" />
          <el-table-column prop="leaveType" label="类型" width="120">
            <template #default="{ row }">{{ LEAVE_TYPE_LABEL[row.leaveType] || row.leaveType }}</template>
          </el-table-column>
          <el-table-column prop="earnedHours" label="累计获得(h)" />
          <el-table-column prop="usedHours" label="已用(h)" />
          <el-table-column prop="balanceHours" label="剩余(h)">
            <template #default="{ row }">
              <span :style="{ color: row.balanceHours <= 0 ? '#f56c6c' : '#67c23a', fontWeight: 600 }">
                {{ row.balanceHours }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="lastCalculatedAt" label="最近计算" width="160" />
        </el-table>
      </div>

      <!-- 工厂余额 (HR) -->
      <div v-else>
        <el-form inline>
          <el-form-item label="类型">
            <el-select v-model="factoryLeaveType" style="width: 140px;" @change="loadFactory">
              <el-option v-for="(label, val) in LEAVE_TYPE_LABEL" :key="val" :label="label" :value="val" />
            </el-select>
          </el-form-item>
          <el-form-item label="月份">
            <el-input v-model="factoryYearMonth" placeholder="YYYY-MM" style="width: 140px;" @change="loadFactory" />
          </el-form-item>
        </el-form>
        <el-table :data="tableData" v-loading="loading" stripe>
          <el-table-column prop="userId" label="员工ID" width="100" />
          <el-table-column prop="yearMonth" label="月份" width="120" />
          <el-table-column prop="earnedHours" label="累计获得(h)" />
          <el-table-column prop="usedHours" label="已用(h)" />
          <el-table-column prop="balanceHours" label="剩余(h)">
            <template #default="{ row }">
              <span :style="{ color: row.balanceHours <= 0 ? '#f56c6c' : '#67c23a', fontWeight: 600 }">
                {{ row.balanceHours }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>
  </div>
</template>
