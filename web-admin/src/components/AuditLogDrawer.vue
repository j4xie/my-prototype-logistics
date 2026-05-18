<script setup lang="ts">
// PR #861 (Sprint 4 Wave 2 follow-up) — entity-scoped operation log viewer.
//
// Right-side drawer rendering Spring Page<OperationLog> as an el-timeline.
// Hooked to backend OperationLogController (V20260525_03 migration + @Loggable
// AOP); entity scope is fixed via props (entityType / entityId) so the timeline
// shows only this row's history (vs the standalone OperationLog.vue page which
// is global with full filters).
//
// Expand semantics (v1, minimal): per-entry el-collapse reveals the raw
// oldValue / newValue / diff JSON. Future polish (PR follow-up): pretty-print
// field-level diff with vue-diff-viewer, role-based field redaction. Out of
// scope here.
//
// Pagination: el-pagination at bottom. page size fixed at 20 (denser than
// the backend default 50, since drawer width is constrained).
import { ref, watch, computed } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { listOperationLogs, type OperationLog } from '@/api/auditLog';

const props = defineProps<{
  visible: boolean;
  entityType: string;
  entityId: string;
  /** Human-readable header label, e.g. order number. */
  entityLabel?: string;
  /** Friendly display for entityType, e.g. "采购单" / "销售订单". */
  entityTypeLabel?: string;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

const loading = ref(false);
const logs = ref<OperationLog[]>([]);
const total = ref(0);
const page = ref(0); // 0-based to match Spring
const pageSize = 20;
const expandedIds = ref<Set<number>>(new Set());

const drawerVisible = computed({
  get: () => props.visible,
  set: (v: boolean) => emit('update:visible', v),
});

const header = computed(() => {
  const t = props.entityTypeLabel || props.entityType;
  return props.entityLabel ? `操作记录 — ${t} #${props.entityLabel}` : `操作记录 — ${t}`;
});

async function loadLogs(): Promise<void> {
  if (!props.entityId || !factoryId.value) {
    logs.value = [];
    total.value = 0;
    return;
  }
  loading.value = true;
  try {
    const res = await listOperationLogs(factoryId.value, {
      entityType: props.entityType,
      entityId: props.entityId,
      page: page.value,
      size: pageSize,
    });
    logs.value = res.content;
    total.value = res.totalElements;
  } finally {
    loading.value = false;
  }
}

// Refetch whenever the drawer becomes visible OR the target entity changes.
// The 2-arg watch (visible + entityId) prevents an extra fetch when the
// parent unmounts the drawer.
watch(
  () => [props.visible, props.entityId, props.entityType] as const,
  ([v]) => {
    if (v) {
      page.value = 0;
      expandedIds.value = new Set();
      void loadLogs();
    }
  },
  { immediate: true }
);

function onPageChange(p: number): void {
  // el-pagination is 1-based; backend is 0-based.
  page.value = Math.max(0, p - 1);
  void loadLogs();
}

function toggleExpand(id: number): void {
  const next = new Set(expandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedIds.value = next;
}

function isExpanded(id: number): boolean {
  return expandedIds.value.has(id);
}

function actionTagType(action: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' {
  switch (action) {
    case 'CREATE':
      return 'success';
    case 'UPDATE':
      return 'warning';
    case 'DELETE':
      return 'danger';
    case 'EXPORT':
    case 'IMPORT':
      return 'info';
    default:
      return 'primary';
  }
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    CREATE: '新建',
    UPDATE: '修改',
    DELETE: '删除',
    EXPORT: '导出',
    IMPORT: '导入',
    OTHER: '其他',
  };
  return map[action] || action;
}

function formatTime(ts?: string | null): string {
  if (!ts) return '-';
  // Backend returns ISO-8601 without timezone (LocalDateTime).
  // Display in user's locale, second-level precision.
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return ts;
  }
}

function prettyJson(v: unknown): string {
  if (v == null) return '(空)';
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    :title="header"
    direction="rtl"
    size="600px"
    destroy-on-close
  >
    <div v-loading="loading" class="audit-drawer-body">
      <el-empty
        v-if="!loading && logs.length === 0"
        description="暂无操作记录"
      />
      <el-timeline v-else>
        <el-timeline-item
          v-for="log in logs"
          :key="log.id"
          :timestamp="formatTime(log.createdAt)"
          placement="top"
          :type="log.success ? 'primary' : 'danger'"
        >
          <div class="audit-entry-header">
            <el-tag :type="actionTagType(log.action)" size="small" effect="plain">
              {{ actionLabel(log.action) }}
            </el-tag>
            <span class="audit-entry-user">{{ log.username || '系统' }}</span>
            <span v-if="log.ipAddress" class="audit-entry-meta">IP {{ log.ipAddress }}</span>
            <span v-if="log.elapsedMs != null" class="audit-entry-meta">耗时 {{ log.elapsedMs }}ms</span>
            <el-tag v-if="!log.success" type="danger" size="small">失败</el-tag>
          </div>
          <div v-if="log.summary" class="audit-entry-summary">{{ log.summary }}</div>
          <div v-if="log.errorMessage" class="audit-entry-error">
            <el-text type="danger" size="small">错误: {{ log.errorMessage }}</el-text>
          </div>
          <div class="audit-entry-actions">
            <el-button
              type="primary"
              link
              size="small"
              @click="toggleExpand(log.id)"
            >{{ isExpanded(log.id) ? '收起详情' : '查看变更详情' }}</el-button>
          </div>
          <div v-if="isExpanded(log.id)" class="audit-entry-detail">
            <el-collapse>
              <el-collapse-item v-if="log.diff && log.diff.length" title="字段变更" name="diff">
                <pre class="audit-json">{{ prettyJson(log.diff) }}</pre>
              </el-collapse-item>
              <el-collapse-item v-if="log.oldValue" title="变更前快照" name="old">
                <pre class="audit-json">{{ prettyJson(log.oldValue) }}</pre>
              </el-collapse-item>
              <el-collapse-item v-if="log.newValue" title="变更后快照" name="new">
                <pre class="audit-json">{{ prettyJson(log.newValue) }}</pre>
              </el-collapse-item>
            </el-collapse>
          </div>
        </el-timeline-item>
      </el-timeline>

      <div v-if="total > pageSize" class="audit-pagination">
        <el-pagination
          background
          layout="prev, pager, next, total"
          :current-page="page + 1"
          :page-size="pageSize"
          :total="total"
          @current-change="onPageChange"
        />
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.audit-drawer-body {
  padding: 4px 0 16px;
  min-height: 200px;
}
.audit-entry-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.audit-entry-user {
  font-weight: 500;
  color: var(--el-text-color-primary);
  font-size: 13px;
}
.audit-entry-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.audit-entry-summary {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin: 4px 0;
}
.audit-entry-error {
  margin: 4px 0;
}
.audit-entry-actions {
  margin-top: 4px;
}
.audit-entry-detail {
  margin-top: 8px;
}
.audit-json {
  background: var(--el-fill-color-light);
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
  font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
  max-height: 260px;
  overflow: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.audit-pagination {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
