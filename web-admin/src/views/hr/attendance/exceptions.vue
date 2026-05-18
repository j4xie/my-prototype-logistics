<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get, post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, Search } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canWrite = computed(() => permissionStore.canWrite('hr'));

type ExceptionRow = {
  id: string;
  factoryId: string;
  userId: number;
  workDate: string;
  shiftAssignmentId?: string;
  exceptionType: 'LATE' | 'EARLY_LEAVE' | 'ABSENT' | 'OT_OVERSCHEDULED' | 'OTHER';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  description?: string;
  processedBy?: number;
  processedAt?: string;
  notes?: string;
  deltaMinutes?: number;
  createdAt?: string;
};

// R3 防呆: 异常类型 dropdown (5 enum 值)
const EXCEPTION_TYPES = [
  { value: '', label: '全部类型' },
  { value: 'LATE', label: '迟到' },
  { value: 'EARLY_LEAVE', label: '早退' },
  { value: 'ABSENT', label: '缺勤' },
  { value: 'OT_OVERSCHEDULED', label: '超工时加班' },
  { value: 'OTHER', label: '其他' },
];
const EXCEPTION_TYPE_LABEL: Record<string, string> = {
  LATE: '迟到',
  EARLY_LEAVE: '早退',
  ABSENT: '缺勤',
  OT_OVERSCHEDULED: '超工时',
  OTHER: '其他',
};
const EXCEPTION_TYPE_TAG: Record<string, '' | 'warning' | 'danger' | 'info'> = {
  LATE: 'warning',
  EARLY_LEAVE: 'warning',
  ABSENT: 'danger',
  OT_OVERSCHEDULED: 'info',
  OTHER: 'info',
};

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '待处理' },
  { value: 'APPROVED', label: '已批准' },
  { value: 'REJECTED', label: '已驳回' },
];
const STATUS_LABEL: Record<string, string> = {
  PENDING: '待处理',
  APPROVED: '已批准',
  REJECTED: '已驳回',
};
const STATUS_TAG: Record<string, '' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

// R3 防呆: 驳回原因 dropdown
const REJECT_REASONS = [
  '员工已说明 (病假补卡)',
  '员工已说明 (公事外出)',
  '系统打卡误差',
  '排班错误',
  '其他',
];

const activeTab = ref<'pending' | 'all'>('pending');
const loading = ref(false);
const tableData = ref<ExceptionRow[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });

const searchForm = ref({
  exceptionType: '',
  status: '',
  startDate: '',
  endDate: '',
});

// === Detect dialog ===
const detectDialogVisible = ref(false);
const detectSubmitting = ref(false);
const detectYearMonth = ref<string>(currentYearMonth());
const lastDetectResult = ref<{ scanned: number; created: number; skipped: number; yearMonth?: string } | null>(null);

// === Approve / Reject dialog ===
const approveDialogVisible = ref(false);
const approveSubmitting = ref(false);
const approvingRow = ref<ExceptionRow | null>(null);
const approveNotes = ref('');

const rejectDialogVisible = ref(false);
const rejectSubmitting = ref(false);
const rejectingRow = ref<ExceptionRow | null>(null);
const rejectForm = ref({ reasonKey: '员工已说明 (病假补卡)', otherDetail: '' });

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

onMounted(() => {
  loadData();
});

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const params: Record<string, string | number> = {
      page: pagination.value.page - 1,
      size: pagination.value.size,
    };
    if (activeTab.value === 'pending') {
      params.status = 'PENDING';
    } else if (searchForm.value.status) {
      params.status = searchForm.value.status;
    }
    if (searchForm.value.startDate) params.startDate = searchForm.value.startDate;
    if (searchForm.value.endDate) params.endDate = searchForm.value.endDate;

    const res = await get(`/${factoryId.value}/hr/attendance-exceptions`, { params });
    if (res.success && res.data) {
      const data = res.data as { content?: ExceptionRow[]; totalElements?: number };
      let content = data.content || [];
      // 客户端过滤 exceptionType (后端暂未透传, 简化 MVP)
      if (searchForm.value.exceptionType) {
        content = content.filter((r) => r.exceptionType === searchForm.value.exceptionType);
      }
      tableData.value = content;
      pagination.value.total = data.totalElements || 0;
    } else {
      tableData.value = [];
      pagination.value.total = 0;
    }
  } catch (e) {
    console.error('加载考勤异常失败:', e);
    tableData.value = [];
    pagination.value.total = 0;
  } finally {
    loading.value = false;
  }
}

function switchTab(tab: 'pending' | 'all') {
  activeTab.value = tab;
  pagination.value.page = 1;
  loadData();
}

function resetSearch() {
  searchForm.value = { exceptionType: '', status: '', startDate: '', endDate: '' };
  pagination.value.page = 1;
  loadData();
}

function openDetect() {
  detectYearMonth.value = currentYearMonth();
  lastDetectResult.value = null;
  detectDialogVisible.value = true;
}

async function runDetect() {
  if (!detectYearMonth.value || !/^\d{4}-\d{2}$/.test(detectYearMonth.value)) {
    ElMessage.error('请输入 YYYY-MM 格式');
    return;
  }
  detectSubmitting.value = true;
  try {
    const res = await post(`/${factoryId.value}/hr/attendance-exceptions/detect`, {
      yearMonth: detectYearMonth.value,
    });
    if (res.success && res.data) {
      lastDetectResult.value = res.data as { scanned: number; created: number; skipped: number; yearMonth?: string };
      ElMessage.success(`检测完成: 扫描 ${lastDetectResult.value.scanned} 条, 新增 ${lastDetectResult.value.created}, 跳过 ${lastDetectResult.value.skipped}`);
      await loadData();
    }
  } catch (e) {
    console.error('检测失败:', e);
  } finally {
    detectSubmitting.value = false;
  }
}

// R2 防呆: 批准 dialog 显示完整异常上下文
function openApprove(row: ExceptionRow) {
  approvingRow.value = row;
  approveNotes.value = '';
  approveDialogVisible.value = true;
}

async function confirmApprove() {
  if (!approvingRow.value) return;
  approveSubmitting.value = true;
  try {
    const res = await post(
      `/${factoryId.value}/hr/attendance-exceptions/${approvingRow.value.id}/approve`,
      { notes: approveNotes.value }
    );
    if (res.success) {
      ElMessage.success('已批准');
      approveDialogVisible.value = false;
      await loadData();
    }
  } catch (e) {
    console.error('批准失败:', e);
  } finally {
    approveSubmitting.value = false;
  }
}

// R3 防呆: 驳回原因 dropdown + "其他"才展开 textarea
function openReject(row: ExceptionRow) {
  rejectingRow.value = row;
  rejectForm.value = { reasonKey: '员工已说明 (病假补卡)', otherDetail: '' };
  rejectDialogVisible.value = true;
}

async function confirmReject() {
  if (!rejectingRow.value) return;
  const finalNotes =
    rejectForm.value.reasonKey === '其他'
      ? rejectForm.value.otherDetail.trim()
      : rejectForm.value.reasonKey;
  if (!finalNotes) {
    ElMessage.error('请填写"其他"补充说明');
    return;
  }
  rejectSubmitting.value = true;
  try {
    const res = await post(
      `/${factoryId.value}/hr/attendance-exceptions/${rejectingRow.value.id}/reject`,
      { notes: finalNotes }
    );
    if (res.success) {
      ElMessage.success('已驳回');
      rejectDialogVisible.value = false;
      await loadData();
    }
  } catch (e) {
    console.error('驳回失败:', e);
  } finally {
    rejectSubmitting.value = false;
  }
}
</script>

<template>
  <div class="attendance-exceptions-page" style="padding: 16px;">
    <el-card>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h2 style="margin: 0;">考勤异常处理</h2>
        <div>
          <el-button v-if="canWrite" type="primary" :icon="Search" @click="openDetect">
            重新检测
          </el-button>
          <el-button :icon="Refresh" @click="loadData">刷新</el-button>
        </div>
      </div>

      <el-tabs v-model="activeTab" @tab-change="(t: string | number) => switchTab(String(t) as 'pending' | 'all')">
        <el-tab-pane label="待处理" name="pending" />
        <el-tab-pane label="全部" name="all" />
      </el-tabs>

      <!-- 搜索栏 (仅 all tab) -->
      <el-form v-if="activeTab === 'all'" :model="searchForm" inline style="margin-bottom: 12px;">
        <el-form-item label="类型">
          <el-select v-model="searchForm.exceptionType" style="width: 140px;" placeholder="全部类型">
            <el-option v-for="t in EXCEPTION_TYPES" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" style="width: 130px;" placeholder="全部状态">
            <el-option v-for="s in STATUS_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="起">
          <el-date-picker v-model="searchForm.startDate" type="date" value-format="YYYY-MM-DD"
            placeholder="开始日期" style="width: 150px;" />
        </el-form-item>
        <el-form-item label="止">
          <el-date-picker v-model="searchForm.endDate" type="date" value-format="YYYY-MM-DD"
            placeholder="结束日期" style="width: 150px;" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- R5 防呆: 空状态 + next-action button -->
      <el-empty v-if="!loading && tableData.length === 0 && activeTab === 'pending'"
        description="暂无待处理异常">
        <el-button v-if="canWrite" type="primary" :icon="Search" @click="openDetect">
          重新检测本月异常
        </el-button>
      </el-empty>

      <el-empty v-else-if="!loading && tableData.length === 0" description="无符合条件的异常记录" />

      <!-- 列表 -->
      <el-table v-else :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="workDate" label="日期" width="110" />
        <el-table-column prop="userId" label="员工 ID" width="100" />
        <el-table-column prop="exceptionType" label="异常类型" width="120">
          <template #default="{ row }">
            <el-tag :type="EXCEPTION_TYPE_TAG[row.exceptionType]" size="small">
              {{ EXCEPTION_TYPE_LABEL[row.exceptionType] || row.exceptionType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="deltaMinutes" label="差异(分)" width="100">
          <template #default="{ row }">
            <span v-if="row.deltaMinutes != null">{{ row.deltaMinutes }}</span>
            <span v-else style="color: #c0c4cc;">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="说明" show-overflow-tooltip min-width="260" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="STATUS_TAG[row.status]" size="small">
              {{ STATUS_LABEL[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="processedAt" label="处理时间" width="160" />
        <el-table-column prop="notes" label="处理备注" show-overflow-tooltip min-width="160" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <template v-if="canWrite && row.status === 'PENDING'">
              <el-button size="small" type="success" @click="openApprove(row)">批准</el-button>
              <el-button size="small" type="danger" @click="openReject(row)">驳回</el-button>
            </template>
            <span v-else style="color: #909399; font-size: 12px;">—</span>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-if="tableData.length > 0"
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        style="margin-top: 16px; justify-content: flex-end;"
        @current-change="loadData"
        @size-change="loadData" />
    </el-card>

    <!-- 重新检测 dialog -->
    <el-dialog v-model="detectDialogVisible" title="重新检测考勤异常" width="480px">
      <el-form label-width="100px">
        <el-form-item label="月份" required>
          <el-input v-model="detectYearMonth" placeholder="YYYY-MM" style="width: 200px;" />
        </el-form-item>
        <el-alert type="info" :closable="false" show-icon
          title="检测原理"
          description="扫描该月所有员工排班 vs 打卡记录, 自动识别 迟到/早退/缺勤/超工时. 同 (员工, 日期, 类型) 已有记录会跳过 (幂等)." />
        <el-alert v-if="lastDetectResult" type="success" :closable="false" show-icon
          style="margin-top: 12px;"
          :title="`上次检测 ${lastDetectResult.yearMonth || ''} 结果`"
          :description="`扫描 ${lastDetectResult.scanned} 条排班, 新增异常 ${lastDetectResult.created} 条, 跳过 (已存在) ${lastDetectResult.skipped} 条`" />
      </el-form>
      <template #footer>
        <el-button @click="detectDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="detectSubmitting" @click="runDetect">开始检测</el-button>
      </template>
    </el-dialog>

    <!-- R2 防呆: 批准 dialog 显示完整 context -->
    <el-dialog v-model="approveDialogVisible" title="批准考勤异常" width="520px">
      <div v-if="approvingRow" style="margin-bottom: 16px; padding: 12px; background: #f5f7fa; border-radius: 4px;">
        <div style="margin-bottom: 6px;">
          <el-tag :type="EXCEPTION_TYPE_TAG[approvingRow.exceptionType]" size="small">
            {{ EXCEPTION_TYPE_LABEL[approvingRow.exceptionType] }}
          </el-tag>
          <span style="margin-left: 8px; color: #606266;">
            员工 {{ approvingRow.userId }} · {{ approvingRow.workDate }}
          </span>
        </div>
        <div style="color: #303133; font-size: 13px;">{{ approvingRow.description }}</div>
      </div>
      <el-form label-width="80px">
        <el-form-item label="备注">
          <el-input v-model="approveNotes" type="textarea" :rows="3"
            placeholder="可选, 处理意见 (e.g. 已与员工沟通, 接受异常)" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveDialogVisible = false">取消</el-button>
        <el-button type="success" :loading="approveSubmitting" @click="confirmApprove">确认批准</el-button>
      </template>
    </el-dialog>

    <!-- R3 防呆: 驳回原因 dropdown + R2 context -->
    <el-dialog v-model="rejectDialogVisible" title="驳回考勤异常" width="520px">
      <div v-if="rejectingRow" style="margin-bottom: 16px; padding: 12px; background: #f5f7fa; border-radius: 4px;">
        <div style="margin-bottom: 6px;">
          <el-tag :type="EXCEPTION_TYPE_TAG[rejectingRow.exceptionType]" size="small">
            {{ EXCEPTION_TYPE_LABEL[rejectingRow.exceptionType] }}
          </el-tag>
          <span style="margin-left: 8px; color: #606266;">
            员工 {{ rejectingRow.userId }} · {{ rejectingRow.workDate }}
          </span>
        </div>
        <div style="color: #303133; font-size: 13px;">{{ rejectingRow.description }}</div>
      </div>
      <el-form :model="rejectForm" label-width="100px">
        <el-form-item label="驳回原因" required>
          <el-select v-model="rejectForm.reasonKey" style="width: 100%;">
            <el-option v-for="r in REJECT_REASONS" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="rejectForm.reasonKey === '其他'" label="补充说明" required>
          <el-input v-model="rejectForm.otherDetail" type="textarea" :rows="3"
            placeholder="请填写具体驳回原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="rejectSubmitting" @click="confirmReject">确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.attendance-exceptions-page { background: #f5f7fa; min-height: calc(100vh - 64px); }
</style>
