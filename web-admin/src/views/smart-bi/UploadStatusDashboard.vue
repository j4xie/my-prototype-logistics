<script setup lang="ts">
/**
 * 上传状态 Dashboard
 *
 * Solves ops pain: "我的店上传成功了吗 / 哪个文件卡了" without SQL.
 *
 * Data source: GET /api/smartbi/{factory_id}/uploads/list
 * Auth: factory-scoped via JWT, RLS-enforced at Python+DB layer.
 *
 * Shows for both restaurant and factory tenants (shared infra). No
 * cross-factory admin view — only the caller's own uploads.
 *
 * Phase IIa, 2026-05-14.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh, Document, CircleCheck, Loading, CircleClose } from '@element-plus/icons-vue';
import {
  listUploadStatus,
  type UploadStatusBucket,
  type UploadStatusItem,
} from '@/api/smartbi/upload-status';

// ---- State -------------------------------------------------------------

const loading = ref(false);
const errorMessage = ref('');
const uploads = ref<UploadStatusItem[]>([]);
const total = ref(0);
const windowDays = ref(7);
const limit = ref(50);
let abortController: AbortController | null = null;

// Window options offered to the user.
const DAYS_OPTIONS = [
  { label: '最近 1 天', value: 1 },
  { label: '最近 7 天', value: 7 },
  { label: '最近 30 天', value: 30 },
  { label: '最近 90 天', value: 90 },
];

// ---- Derived -----------------------------------------------------------

const countCompleted = computed(
  () => uploads.value.filter((u) => u.status === 'COMPLETED').length,
);
const countPending = computed(
  () => uploads.value.filter((u) => u.status === 'PENDING').length,
);
const countError = computed(
  () => uploads.value.filter((u) => u.status === 'ERROR').length,
);

// ---- Helpers -----------------------------------------------------------

/** Map status bucket to Element Plus tag type. */
function statusTagType(status: UploadStatusBucket): 'success' | 'warning' | 'danger' {
  if (status === 'COMPLETED') return 'success';
  if (status === 'ERROR') return 'danger';
  return 'warning';
}

function statusLabel(status: UploadStatusBucket): string {
  if (status === 'COMPLETED') return '完成';
  if (status === 'ERROR') return '失败';
  return '处理中';
}

/** Human-friendly report_type label (Chinese for known POS keywords). */
const REPORT_TYPE_LABELS: Record<string, string> = {
  daily_summary: '营业概况',
  meal_split: '堂食外卖占比',
  region_summary: '区域销售',
  bill_flow: '订单流水',
  product_summary: '商品销售',
  POS: 'POS 数据',
  unknown: '未识别',
};

function reportTypeLabel(t: string | null): string {
  if (!t) return '—';
  return REPORT_TYPE_LABELS[t] || t;
}

/** Format ISO datetime to local-friendly "YYYY-MM-DD HH:mm:ss"; null → "—". */
function formatTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    );
  } catch {
    return iso;
  }
}

/** Compute duration in seconds between two ISO timestamps; null if either missing. */
function durationSeconds(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
  return Math.round((e - s) / 1000);
}

function formatDuration(start: string | null, end: string | null): string {
  const sec = durationSeconds(start, end);
  if (sec === null) return '—';
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

/** Truncate a long error message for table display; full text on hover. */
function truncate(s: string | null, max = 60): string {
  if (!s) return '—';
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

// ---- Load --------------------------------------------------------------

async function loadData() {
  if (abortController) abortController.abort();
  abortController = new AbortController();
  loading.value = true;
  errorMessage.value = '';

  try {
    const res = await listUploadStatus({
      limit: limit.value,
      days: windowDays.value,
      signal: abortController.signal,
    });
    uploads.value = res.uploads || [];
    total.value = res.total || 0;
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[upload-status] load failed:', e);
    errorMessage.value = `加载失败: ${msg}`;
    ElMessage.error('上传状态加载失败');
  } finally {
    loading.value = false;
  }
}

function handleDaysChange(v: number) {
  windowDays.value = v;
  loadData();
}

// ---- Lifecycle ---------------------------------------------------------

onMounted(() => {
  loadData();
});

onUnmounted(() => {
  if (abortController) abortController.abort();
});
</script>

<template>
  <div class="upload-status-dashboard">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/smart-bi/dashboard' }">Smart BI</el-breadcrumb-item>
          <el-breadcrumb-item>上传状态</el-breadcrumb-item>
        </el-breadcrumb>
        <h2>上传状态</h2>
        <p class="page-subtitle">查看 POS / Excel 上传情况，无需 SQL 查询。</p>
      </div>
      <div class="header-right">
        <el-select
          :model-value="windowDays"
          @update:model-value="handleDaysChange"
          style="width: 140px; margin-right: 12px"
        >
          <el-option
            v-for="opt in DAYS_OPTIONS"
            :key="opt.value"
            :value="opt.value"
            :label="opt.label"
          />
        </el-select>
        <el-button :icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
      </div>
    </div>

    <!-- Error banner -->
    <el-alert
      v-if="errorMessage && !loading"
      type="warning"
      :title="errorMessage"
      show-icon
      closable
      style="margin-bottom: 16px"
      @close="errorMessage = ''"
    >
      <el-button size="small" type="primary" @click="loadData" style="margin-top: 8px">重试</el-button>
    </el-alert>

    <!-- Summary cards -->
    <div class="summary-grid">
      <div class="summary-card summary-total">
        <div class="summary-card-icon"><el-icon :size="28"><Document /></el-icon></div>
        <div class="summary-card-body">
          <div class="summary-card-value">{{ total }}</div>
          <div class="summary-card-label">总上传数 (窗口内)</div>
        </div>
      </div>
      <div class="summary-card summary-completed">
        <div class="summary-card-icon"><el-icon :size="28"><CircleCheck /></el-icon></div>
        <div class="summary-card-body">
          <div class="summary-card-value">{{ countCompleted }}</div>
          <div class="summary-card-label">已完成</div>
        </div>
      </div>
      <div class="summary-card summary-pending">
        <div class="summary-card-icon"><el-icon :size="28"><Loading /></el-icon></div>
        <div class="summary-card-body">
          <div class="summary-card-value">{{ countPending }}</div>
          <div class="summary-card-label">处理中</div>
        </div>
      </div>
      <div class="summary-card summary-error">
        <div class="summary-card-icon"><el-icon :size="28"><CircleClose /></el-icon></div>
        <div class="summary-card-body">
          <div class="summary-card-value">{{ countError }}</div>
          <div class="summary-card-label">失败</div>
        </div>
      </div>
    </div>

    <!-- Main table -->
    <div class="table-section" v-loading="loading">
      <el-table
        :data="uploads"
        stripe
        :max-height="640"
        empty-text="窗口内暂无上传记录"
        size="small"
      >
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-detail">
              <div class="expand-row">
                <span class="expand-label">完整文件名:</span>
                <span class="expand-value">{{ row.filename || '—' }}</span>
              </div>
              <div class="expand-row">
                <span class="expand-label">Upload ID:</span>
                <span class="expand-value">{{ row.uploadId }}</span>
              </div>
              <div class="expand-row">
                <span class="expand-label">报表类型:</span>
                <span class="expand-value">
                  {{ reportTypeLabel(row.reportType) }}
                  <span class="text-muted" style="margin-left: 8px">({{ row.reportType }})</span>
                </span>
              </div>
              <div class="expand-row">
                <span class="expand-label">上传时间:</span>
                <span class="expand-value">{{ formatTime(row.uploadedAt) }}</span>
              </div>
              <div class="expand-row">
                <span class="expand-label">完成时间:</span>
                <span class="expand-value">{{ formatTime(row.completedAt) }}</span>
              </div>
              <div class="expand-row">
                <span class="expand-label">处理时长:</span>
                <span class="expand-value">{{ formatDuration(row.uploadedAt, row.completedAt) }}</span>
              </div>
              <div class="expand-row">
                <span class="expand-label">Bronze 行数:</span>
                <span class="expand-value">{{ row.bronzeRows ?? '—' }}</span>
              </div>
              <div class="expand-row">
                <span class="expand-label">Silver 行数:</span>
                <span class="expand-value">{{ row.silverRows ?? '—' }}</span>
              </div>
              <div v-if="row.errorMessage" class="expand-row expand-error">
                <span class="expand-label">错误详情:</span>
                <pre class="expand-error-text">{{ row.errorMessage }}</pre>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="文件名" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="filename-cell">{{ row.filename || '—' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="报表类型" width="140">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ reportTypeLabel(row.reportType) }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="上传时间" width="170">
          <template #default="{ row }">
            <span class="time-cell">{{ formatTime(row.uploadedAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small" effect="light">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="Bronze 行数" width="110" align="right">
          <template #default="{ row }">
            <span class="num-cell">{{ row.bronzeRows ?? '—' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="Silver 行数" width="110" align="right">
          <template #default="{ row }">
            <span class="num-cell">{{ row.silverRows ?? '—' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="错误消息" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tooltip
              v-if="row.errorMessage"
              :content="row.errorMessage"
              placement="top"
              effect="dark"
              :show-after="200"
            >
              <span class="error-cell">{{ truncate(row.errorMessage) }}</span>
            </el-tooltip>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer-note">
        <span class="text-muted">
          显示最近 {{ uploads.length }} 条 (上限 {{ limit }})；点击行展开查看详情。
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.upload-status-dashboard {
  padding: var(--page-padding, 20px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;

  .header-left {
    h2 {
      margin: 12px 0 4px;
      font-size: 20px;
      color: var(--el-text-color-primary, #303133);
    }
    .page-subtitle {
      margin: 0;
      font-size: 13px;
      color: var(--el-text-color-secondary, #909399);
    }
  }
  .header-right {
    display: flex;
    align-items: center;
  }
}

// Summary cards
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border-left: 4px solid var(--el-color-info, #909399);

  &.summary-total {
    border-left-color: var(--el-color-primary, #2D8B57);
  }
  &.summary-completed {
    border-left-color: var(--el-color-success, #10b981);
  }
  &.summary-pending {
    border-left-color: var(--el-color-warning, #f59e0b);
  }
  &.summary-error {
    border-left-color: var(--el-color-danger, #ef4444);
  }

  .summary-card-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f7fa;
    color: var(--el-text-color-secondary, #909399);
  }
  &.summary-total .summary-card-icon { color: var(--el-color-primary, #2D8B57); }
  &.summary-completed .summary-card-icon { color: var(--el-color-success, #10b981); }
  &.summary-pending .summary-card-icon { color: var(--el-color-warning, #f59e0b); }
  &.summary-error .summary-card-icon { color: var(--el-color-danger, #ef4444); }

  .summary-card-body {
    flex: 1;
    min-width: 0;
  }

  .summary-card-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--el-text-color-primary, #303133);
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }

  .summary-card-label {
    font-size: 13px;
    color: var(--el-text-color-secondary, #909399);
    margin-top: 4px;
  }
}

// Table
.table-section {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.filename-cell {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  color: var(--el-text-color-primary, #303133);
}

.time-cell {
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: var(--el-text-color-regular, #606266);
}

.num-cell {
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  color: var(--el-text-color-primary, #303133);
}

.error-cell {
  color: var(--el-color-danger, #ef4444);
  font-size: 12px;
}

.text-muted {
  color: var(--el-text-color-placeholder, #c0c4cc);
}

.table-footer-note {
  padding: 8px 4px 0;
  font-size: 12px;
}

// Expand row
.expand-detail {
  padding: 12px 24px;
  background: #fafafa;
  border-radius: 6px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 24px;
}

.expand-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 1.6;

  &.expand-error {
    grid-column: 1 / -1;
    flex-direction: column;
    gap: 4px;
    padding-top: 8px;
    border-top: 1px solid #ebeef5;
    margin-top: 4px;
  }
}

.expand-label {
  color: var(--el-text-color-secondary, #909399);
  flex-shrink: 0;
  min-width: 84px;
}

.expand-value {
  color: var(--el-text-color-primary, #303133);
  word-break: break-all;
}

.expand-error-text {
  margin: 0;
  padding: 8px 12px;
  background: #fef2f2;
  border-left: 3px solid var(--el-color-danger, #ef4444);
  border-radius: 4px;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  color: var(--el-color-danger-dark-2, #b91c1c);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 240px;
  overflow-y: auto;
  width: 100%;
}
</style>
