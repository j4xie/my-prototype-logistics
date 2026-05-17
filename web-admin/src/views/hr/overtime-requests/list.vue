<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('hr'));

type OvtRow = {
  id: string;
  userId: number;
  overtimeType: 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';
  startTime: string;
  endTime: string;
  hours: number;
  compensationType: 'CASH' | 'COMPTIME';
  reason?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  submittedAt?: string;
  approvedAt?: string;
  rejectReason?: string;
};

const OVT_TYPE_LABEL: Record<string, string> = {
  WEEKDAY: '工作日加班', WEEKEND: '周末加班', HOLIDAY: '节假日加班',
};
const COMP_LABEL: Record<string, string> = { CASH: '加班工资', COMPTIME: '调休' };
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿', SUBMITTED: '待审批', APPROVED: '已批准',
  REJECTED: '已拒绝', CANCELLED: '已撤回',
};
const STATUS_TAG_TYPE: Record<string, '' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'success',
  REJECTED: 'danger', CANCELLED: 'info',
};

const activeTab = ref<'mine' | 'pending' | 'all' | 'summary'>('mine');
const loading = ref(false);
const tableData = ref<OvtRow[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const summaryData = ref<Record<string, number>>({});
const summaryYearMonth = ref<string>(currentYearMonth());

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

onMounted(() => { loadData(); });
watch(activeTab, () => {
  pagination.value.page = 1;
  if (activeTab.value === 'summary') loadSummary(); else loadData();
});

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const endpoint = activeTab.value === 'mine'
      ? `/${factoryId.value}/hr/overtime-requests/mine`
      : activeTab.value === 'pending'
        ? `/${factoryId.value}/hr/overtime-requests/pending`
        : `/${factoryId.value}/hr/overtime-requests`;
    const res = await get(endpoint, {
      params: { page: pagination.value.page - 1, size: pagination.value.size }
    });
    if (res.success && res.data) {
      const data = res.data as { content?: OvtRow[]; totalElements?: number };
      tableData.value = data.content || [];
      pagination.value.total = data.totalElements || 0;
    } else {
      tableData.value = [];
      pagination.value.total = 0;
    }
  } catch (e) {
    console.error('加载加班申请失败:', e);
    tableData.value = [];
    pagination.value.total = 0;
  } finally {
    loading.value = false;
  }
}

async function loadSummary() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await get(`/${factoryId.value}/hr/overtime-requests/summary`, {
      params: { yearMonth: summaryYearMonth.value }
    });
    if (res.success && res.data) summaryData.value = res.data as Record<string, number>;
  } catch (e) {
    console.error('加载月汇总失败:', e);
  } finally {
    loading.value = false;
  }
}

async function approveRow(row: OvtRow) {
  try {
    await ElMessageBox.confirm(`批准 ${row.hours}小时 ${OVT_TYPE_LABEL[row.overtimeType]} (${COMP_LABEL[row.compensationType]})?`, '确认');
    const res = await post(`/${factoryId.value}/hr/overtime-requests/${row.id}/approve`);
    if (res.success) { ElMessage.success('已批准'); await loadData(); }
  } catch (e) { if (e !== 'cancel') console.error(e); }
}

async function rejectRow(row: OvtRow) {
  try {
    const { value } = await ElMessageBox.prompt('拒绝原因?', '拒绝', {
      inputPattern: /.+/, inputErrorMessage: '请填写原因'
    });
    const res = await post(`/${factoryId.value}/hr/overtime-requests/${row.id}/reject`, { reason: value });
    if (res.success) { ElMessage.success('已拒绝'); await loadData(); }
  } catch (e) { if (e !== 'cancel') console.error(e); }
}

async function cancelRow(row: OvtRow) {
  try {
    await ElMessageBox.confirm('撤回此申请?', '确认');
    const res = await post(`/${factoryId.value}/hr/overtime-requests/${row.id}/cancel`);
    if (res.success) { ElMessage.success('已撤回'); await loadData(); }
  } catch (e) { if (e !== 'cancel') console.error(e); }
}
</script>

<template>
  <div class="overtime-requests-page" style="padding: 16px;">
    <el-card>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h2 style="margin: 0;">加班/调休申请</h2>
        <el-button :icon="Refresh" @click="activeTab === 'summary' ? loadSummary() : loadData()">刷新</el-button>
      </div>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="我的申请" name="mine" />
        <el-tab-pane v-if="canWrite" label="待审批" name="pending" />
        <el-tab-pane v-if="canWrite" label="全部" name="all" />
        <el-tab-pane v-if="canWrite" label="月汇总" name="summary" />
      </el-tabs>

      <div v-if="activeTab === 'summary'">
        <el-form inline>
          <el-form-item label="月份">
            <el-input v-model="summaryYearMonth" placeholder="YYYY-MM" style="width: 140px;" @change="loadSummary" />
          </el-form-item>
        </el-form>
        <el-table :data="Object.entries(summaryData).map(([k, v]) => ({ compType: k, hours: v }))" v-loading="loading">
          <el-table-column prop="compType" label="补偿方式" width="200">
            <template #default="{ row }">{{ COMP_LABEL[row.compType] || row.compType }}</template>
          </el-table-column>
          <el-table-column prop="hours" label="总小时数" />
        </el-table>
      </div>

      <div v-else>
        <el-table :data="tableData" v-loading="loading" stripe>
          <el-table-column prop="overtimeType" label="加班类型" width="120">
            <template #default="{ row }">{{ OVT_TYPE_LABEL[row.overtimeType] }}</template>
          </el-table-column>
          <el-table-column v-if="activeTab !== 'mine'" prop="userId" label="申请人" width="100" />
          <el-table-column prop="startTime" label="开始" width="160" />
          <el-table-column prop="endTime" label="结束" width="160" />
          <el-table-column prop="hours" label="时长(h)" width="100" />
          <el-table-column prop="compensationType" label="补偿" width="100">
            <template #default="{ row }">{{ COMP_LABEL[row.compensationType] }}</template>
          </el-table-column>
          <el-table-column prop="reason" label="原因" show-overflow-tooltip />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="STATUS_TAG_TYPE[row.status]">{{ STATUS_LABEL[row.status] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <template v-if="activeTab === 'mine' && (row.status === 'DRAFT' || row.status === 'SUBMITTED')">
                <el-button size="small" type="danger" @click="cancelRow(row)">撤回</el-button>
              </template>
              <template v-if="activeTab === 'pending' && canWrite && row.status === 'SUBMITTED'">
                <el-button size="small" type="success" @click="approveRow(row)">批准</el-button>
                <el-button size="small" type="danger" @click="rejectRow(row)">拒绝</el-button>
              </template>
              <span v-if="row.status === 'REJECTED' && row.rejectReason" style="color: #f56c6c; font-size: 12px;">
                拒绝: {{ row.rejectReason }}
              </span>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          style="margin-top: 16px; justify-content: flex-end;"
          @current-change="loadData"
          @size-change="loadData"
        />
      </div>
    </el-card>
  </div>
</template>
