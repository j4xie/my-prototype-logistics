<!--
  Cell-level lineage audit page — 数据织网 Sub-Project C Day 26.

  Per spec 04-C v1.4 §6.3 (lines 1073-1180). URL: /audit/cell?type=&id=&field=
  All query params are encodeURIComponent-safe at the caller side
  (GoldPreview.vue line ~41). Admin-only; meta.roles in router/index.ts +
  beforeEach guard in router/guards.ts enforce access.

  Renders:
    - Current authoritative value (active row, superseded_by_id IS NULL),
      prominently with TrustIndicator-style confidence + source label.
    - Full history table (active + all superseded), valid_from DESC.
    - Sentinel-aware source label (NC-4): when source_upload_id == 0 or
      file_name is null, show friendly source_type label instead.
    - Backfill flag tag for rows with is_backfill=true (Day 16 backfill).
-->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { pythonFetch } from '@/api/smartbi/common';
import { useAuthStore } from '@/store/modules/auth';
import { sourceLabel } from '@/utils/provenance-labels';

interface AuditRow {
  id: number;
  sourceType: string;
  sourceUploadId: number | null;
  fileName: string | null;
  confidence: number | null;
  validFrom: string | null;
  validTo: string | null;
  fieldValue: unknown;
  mapperMethod: string | null;
  confidenceMethod: string | null;
  createdAt: string | null;
  createdBy: string | null;
  supersededById: number | null;
  supersededReason: string | null;
  notes: string | null;
  isBackfill: boolean;
}

interface AuditResponse {
  current: AuditRow | null;
  history: AuditRow[];
  truncated?: boolean;
  historyLimit?: number;
  key: { factoryId: string; entityType: string; entityId: string; field: string };
}

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const loading = ref<boolean>(true);
const error = ref<string | null>(null);
const data = ref<AuditResponse | null>(null);

const entityType = computed<string>(() => String(route.query.type ?? ''));
const entityId = computed<string>(() => String(route.query.id ?? ''));
const fieldName = computed<string>(() => String(route.query.field ?? ''));

const headerTitle = computed<string>(() => {
  if (!entityType.value || !entityId.value || !fieldName.value) {
    return '字段血统审计';
  }
  return `字段血统: ${entityType.value} #${entityId.value} · ${fieldName.value}`;
});

/**
 * NC-4: when source_upload_id is 0 (sentinel) or file_name is null,
 * fall back to the friendly source_type label. Otherwise show
 * "<file_name> (#<upload_id>)" so admins can correlate with the upload
 * history page.
 */
function formatSource(row: AuditRow): string {
  if (row.sourceUploadId === 0 || row.sourceUploadId == null || row.fileName == null) {
    return sourceLabel(row.sourceType);
  }
  return `${row.fileName} (#${row.sourceUploadId})`;
}

/**
 * field_value is JSONB — most B-stage writers store it as a primitive
 * (number / string) but a few wrap into {v: ..., raw: ...}. Surface the
 * primitive when present, fall back to JSON.stringify so we never blank
 * the cell.
 */
function formatValue(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
    return String(v);
  }
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    if ('v' in obj && (typeof obj.v === 'number' || typeof obj.v === 'string')) {
      return String(obj.v);
    }
  }
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function formatConfidence(c: number | null): string {
  if (c == null) return '—';
  return c.toFixed(3);
}

function formatTimeWindow(row: AuditRow): string {
  const from = row.validFrom ?? '—';
  const to = row.validTo ?? '现在';
  return `${from} ~ ${to}`;
}

function tagTypeForConfidence(c: number | null): 'success' | 'warning' | 'info' {
  if (c == null) return 'info';
  if (c > 0.85) return 'success';
  if (c > 0.7) return 'warning';
  return 'info';
}

async function load(): Promise<void> {
  if (!entityType.value || !entityId.value || !fieldName.value) {
    error.value = '缺少必要参数 (type / id / field)';
    loading.value = false;
    data.value = null;
    return;
  }
  if (!auth.factoryId) {
    error.value = '当前用户无 factoryId — 请重新登录';
    loading.value = false;
    data.value = null;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const qs = new URLSearchParams({
      factory_id: auth.factoryId,
      entity_type: entityType.value,
      entity_id: entityId.value,
      field: fieldName.value,
    }).toString();
    const resp = (await pythonFetch(`/api/smartbi/provenance/audit?${qs}`)) as AuditResponse;
    data.value = resp;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    error.value = msg;
    ElMessage.error(`字段血统查询失败: ${msg}`);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
// Vue's watch defaults to lazy (no `immediate: true`) — fires only on
// subsequent route-query changes (e.g. user navigates from one cell to
// another via in-app links). Single load on mount via onMounted is
// intentional; do NOT add `{ immediate: true }`.
watch([entityType, entityId, fieldName], load);

function goBack(): void {
  router.back();
}
</script>

<template>
  <div class="cell-audit-page">
    <el-page-header class="page-hdr" :content="headerTitle" @back="goBack" />

    <el-skeleton v-if="loading" :rows="6" animated />

    <el-alert
      v-else-if="error"
      type="error"
      :title="error"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <template v-else-if="data">
      <!-- Current authoritative value -->
      <el-card v-if="data.current" class="current-card" shadow="never">
        <template #header>
          <div class="current-hdr">
            <strong>当前权威值</strong>
            <el-tag
              :type="tagTypeForConfidence(data.current.confidence)"
              size="small"
              class="conf-tag"
            >
              置信度 {{ formatConfidence(data.current.confidence) }}
            </el-tag>
            <el-tag v-if="data.current.isBackfill" size="small" type="info">回填</el-tag>
          </div>
        </template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="值">{{ formatValue(data.current.fieldValue) }}</el-descriptions-item>
          <el-descriptions-item label="时间窗">{{ formatTimeWindow(data.current) }}</el-descriptions-item>
          <el-descriptions-item label="来源">{{ formatSource(data.current) }}</el-descriptions-item>
          <el-descriptions-item label="生成方式">
            {{ data.current.confidenceMethod ?? data.current.mapperMethod ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="写入时间">{{ data.current.createdAt ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="写入者">{{ data.current.createdBy ?? '—' }}</el-descriptions-item>
          <el-descriptions-item v-if="data.current.notes" label="备注" :span="2">
            {{ data.current.notes }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-empty v-else description="此字段暂无 provenance 记录" class="empty-state" />

      <!-- Full history -->
      <el-card class="history-card" shadow="never">
        <template #header>
          <div class="history-hdr">
            <strong>历史记录</strong>
            <span class="history-count">{{ data.history.length }} 条</span>
            <el-tag v-if="data.truncated" size="small" type="warning" class="history-truncated">
              仅显示最近 {{ data.historyLimit }} 条 — 完整历史请联系运维
            </el-tag>
          </div>
        </template>
        <el-table
          v-if="data.history.length > 0"
          :data="data.history"
          stripe
          size="small"
          class="history-table"
        >
          <el-table-column label="时间窗" min-width="180">
            <template #default="{ row }">{{ formatTimeWindow(row) }}</template>
          </el-table-column>
          <el-table-column label="值" min-width="120">
            <template #default="{ row }">{{ formatValue(row.fieldValue) }}</template>
          </el-table-column>
          <el-table-column label="来源" min-width="220">
            <template #default="{ row }">{{ formatSource(row) }}</template>
          </el-table-column>
          <el-table-column label="置信度" width="110" align="right">
            <template #default="{ row }">
              <el-tag
                :type="tagTypeForConfidence(row.confidence)"
                size="small"
                effect="plain"
              >
                {{ formatConfidence(row.confidence) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="标签" width="140">
            <template #default="{ row }">
              <el-tag v-if="row.isBackfill" size="small" type="info" class="row-tag">回填</el-tag>
              <el-tag v-if="row.supersededById" size="small" type="warning" class="row-tag">已替换</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="生成方式" width="120">
            <template #default="{ row }">
              {{ row.confidenceMethod ?? row.mapperMethod ?? '—' }}
            </template>
          </el-table-column>
          <el-table-column label="写入时间" min-width="170">
            <template #default="{ row }">{{ row.createdAt ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="写入者" min-width="140">
            <template #default="{ row }">{{ row.createdBy ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="替换原因" min-width="160">
            <template #default="{ row }">{{ row.supersededReason ?? '—' }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="无历史记录" :image-size="80" />
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.cell-audit-page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-hdr {
  margin-bottom: 4px;
}

.error-alert {
  margin-top: 12px;
}

.current-card,
.history-card {
  border-radius: 6px;
}

.current-hdr,
.history-hdr {
  display: flex;
  align-items: center;
  gap: 10px;
}

.history-count {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.history-truncated {
  margin-left: 8px;
}

.conf-tag {
  margin-left: 4px;
}

.row-tag + .row-tag {
  margin-left: 4px;
}

.empty-state {
  margin: 24px 0;
}
</style>
