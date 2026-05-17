<template>
  <div class="operation-log-page">
    <div class="page-header">
      <h2>系统操作日志</h2>
      <el-button :icon="Refresh" @click="load" :loading="loading">刷新</el-button>
    </div>

    <!-- Filters -->
    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filters" @submit.prevent>
        <el-form-item label="模块">
          <el-input v-model="filters.module" placeholder="CUSTOMER / MATERIAL ..." clearable style="width: 160px" />
        </el-form-item>
        <el-form-item label="操作">
          <el-select v-model="filters.action" placeholder="全部" clearable style="width: 130px">
            <el-option label="CREATE" value="CREATE" />
            <el-option label="UPDATE" value="UPDATE" />
            <el-option label="DELETE" value="DELETE" />
            <el-option label="EXPORT" value="EXPORT" />
            <el-option label="IMPORT" value="IMPORT" />
            <el-option label="OTHER" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="用户 ID">
          <el-input-number v-model="filters.userId" :min="1" controls-position="right" style="width: 130px" />
        </el-form-item>
        <el-form-item label="Entity 类型">
          <el-input v-model="filters.entityType" placeholder="Customer 等" clearable style="width: 150px" />
        </el-form-item>
        <el-form-item label="Entity ID">
          <el-input v-model="filters.entityId" clearable style="width: 130px" />
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width: 360px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSearch">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Table -->
    <el-card shadow="never" style="margin-top: 12px">
      <el-table :data="logs" stripe v-loading="loading" border>
        <el-table-column prop="createdAt" label="时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="用户" width="140">
          <template #default="{ row }">
            <span v-if="row.username">{{ row.username }}</span>
            <span v-else-if="row.userId" class="muted">#{{ row.userId }}</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="module" label="模块" width="130" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-tag :type="actionTagType(row.action)" size="small">{{ row.action }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Entity" min-width="200">
          <template #default="{ row }">
            <span v-if="row.entityType">
              <strong>{{ simpleName(row.entityType) }}</strong>
              <span v-if="row.entityId" class="muted"> #{{ row.entityId }}</span>
            </span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="结果" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.success" type="success" size="small">成功</el-tag>
            <el-tag v-else type="danger" size="small">失败</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="耗时" width="90">
          <template #default="{ row }">
            <span v-if="row.elapsedMs != null">{{ row.elapsedMs }} ms</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="详情" width="100">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pageNum"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50, 100, 200]"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 12px; justify-content: flex-end"
        @current-change="load"
        @size-change="load"
      />
    </el-card>

    <!-- Detail dialog -->
    <el-dialog v-model="detailOpen" title="操作日志详情" width="780px" destroy-on-close>
      <div v-if="detail" class="detail-grid">
        <div><strong>时间:</strong> {{ formatTime(detail.createdAt) }}</div>
        <div><strong>用户:</strong> {{ detail.username || '#' + detail.userId }}</div>
        <div><strong>模块:</strong> {{ detail.module }}</div>
        <div><strong>操作:</strong> <el-tag size="small">{{ detail.action }}</el-tag></div>
        <div><strong>Entity:</strong> {{ detail.entityType }} #{{ detail.entityId }}</div>
        <div><strong>结果:</strong>
          <el-tag :type="detail.success ? 'success' : 'danger'" size="small">
            {{ detail.success ? '成功' : '失败' }}
          </el-tag>
        </div>
        <div><strong>耗时:</strong> {{ detail.elapsedMs }} ms</div>
        <div><strong>IP:</strong> {{ detail.ipAddress || '—' }}</div>
        <div class="span-2"><strong>摘要:</strong> {{ detail.summary || '—' }}</div>
        <div v-if="detail.errorMessage" class="span-2" style="color: #f56c6c">
          <strong>错误:</strong> {{ detail.errorMessage }}
        </div>
      </div>

      <el-divider v-if="detail?.diff && detail.diff.length" />

      <div v-if="detail?.diff && detail.diff.length">
        <h4 style="margin: 0 0 12px">字段级变更 ({{ detail.diff.length }})</h4>
        <el-table :data="detail.diff" border size="small">
          <el-table-column prop="field" label="字段" width="180" />
          <el-table-column label="变更前">
            <template #default="{ row }">
              <code class="diff-val">{{ formatValue(row.from) }}</code>
            </template>
          </el-table-column>
          <el-table-column label="变更后">
            <template #default="{ row }">
              <code class="diff-val">{{ formatValue(row.to) }}</code>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-divider v-if="detail?.oldValue || detail?.newValue" />

      <el-collapse v-if="detail?.oldValue || detail?.newValue" accordion>
        <el-collapse-item v-if="detail.oldValue" title="变更前完整快照 (oldValue)">
          <pre class="json-pre">{{ JSON.stringify(detail.oldValue, null, 2) }}</pre>
        </el-collapse-item>
        <el-collapse-item v-if="detail.newValue" title="变更后完整快照 (newValue)">
          <pre class="json-pre">{{ JSON.stringify(detail.newValue, null, 2) }}</pre>
        </el-collapse-item>
      </el-collapse>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { useAuthStore } from '@/store/modules/auth';
import { operationLogApi, type OperationLog, type OperationLogFilters } from '@/api/dataCenter';

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

const loading = ref(false);
const logs = ref<OperationLog[]>([]);
const total = ref(0);
const pageNum = ref(1);    // Element pagination is 1-based; backend is 0-based
const pageSize = ref(50);

const filters = ref<OperationLogFilters>({});
const dateRange = ref<[string, string] | null>(null);

const detailOpen = ref(false);
const detail = ref<OperationLog | null>(null);

async function load() {
  if (!factoryId.value) {
    ElMessage.warning('无 factoryId,无法加载');
    return;
  }
  loading.value = true;
  try {
    const params: OperationLogFilters = {
      ...filters.value,
      page: pageNum.value - 1,
      size: pageSize.value,
    };
    if (dateRange.value && dateRange.value.length === 2) {
      params.start = dateRange.value[0];
      params.end = dateRange.value[1];
    }
    const resp = await operationLogApi.list(factoryId.value, params);
    // request.ts interceptor returns full ApiResponse<T>; .data holds the Page payload.
    logs.value = resp.data?.content || [];
    total.value = resp.data?.totalElements || 0;
  } catch (err) {
    console.error('[OperationLog] load failed', err);
    ElMessage.error('加载操作日志失败');
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  pageNum.value = 1;
  load();
}

function onReset() {
  filters.value = {};
  dateRange.value = null;
  pageNum.value = 1;
  load();
}

async function openDetail(row: OperationLog) {
  detail.value = row;
  detailOpen.value = true;
  // 若 diff/oldValue 没在 list 接口返回, 拉单条
  if (row.id && (row.oldValue === undefined || row.diff === undefined)) {
    try {
      const resp = await operationLogApi.get(factoryId.value, row.id);
      if (resp.data) detail.value = resp.data;
    } catch (err) {
      console.warn('[OperationLog] fetch detail failed, using list row', err);
    }
  }
}

function actionTagType(action: string): 'success' | 'warning' | 'danger' | 'info' | '' {
  switch (action) {
    case 'CREATE': return 'success';
    case 'UPDATE': return 'warning';
    case 'DELETE': return 'danger';
    case 'EXPORT':
    case 'IMPORT': return 'info';
    default: return '';
  }
}

function simpleName(fqn: string): string {
  const dot = fqn.lastIndexOf('.');
  return dot < 0 ? fqn : fqn.substring(dot + 1);
}

function formatTime(s: string | null): string {
  if (!s) return '—';
  return s.replace('T', ' ').replace(/\.\d+$/, '');
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '(null)';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

onMounted(load);
</script>

<style scoped>
.operation-log-page { padding: 16px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.page-header h2 { margin: 0; font-size: 18px; }
.filter-card :deep(.el-form-item) { margin-bottom: 8px; }
.muted { color: #909399; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
.detail-grid .span-2 { grid-column: span 2; }
.diff-val { background: #f5f7fa; padding: 2px 6px; border-radius: 3px; font-family: ui-monospace, monospace; font-size: 12px; }
.json-pre { background: #f5f7fa; padding: 12px; border-radius: 4px; max-height: 320px; overflow: auto; font-size: 12px; }
</style>
