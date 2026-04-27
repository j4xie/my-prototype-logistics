<!--
  Factory provenance config admin page — 数据织网 Sub-Project C Day 27.

  Per spec 04-C v1.4 §6.4 (lines ~1133-1183).
  URL: /system/data-fabric/provenance-config
  Backend: GET + PUT /api/smartbi/factory-config/provenance.

  Three Q-cards:
    Q1 — diff_threshold slider (0.05-0.50 step 0.05, default 30%)
    Q2 — source-priority table, 6 canonical types (manual/bill_flow/...
         industry_default), each with global default (read-only) +
         optional per-factory override (1-6, lower=higher priority).
    Q3 — industry-default cost-rate table, N cuisine categories, each
         with global default (read-only) + optional per-factory override
         (0.0-1.0).

  Save sends only the OVERRIDDEN rows (factoryOverride/override != null)
  as flat dicts in the body, matching the Pydantic ProvenanceConfigBody
  shape. After a successful save, we refresh from the response so the
  "上次保存" timestamp reflects the new updated_at.

  All API responses pass through pythonFetch's transformKeys so we model
  TS interfaces in camelCase to match the post-transform shape. Day 26
  Lesson Learned — DO NOT mock snake_case in tests.
-->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { pythonFetch } from '@/api/smartbi/common';
import { useAuthStore } from '@/store/modules/auth';

interface SourcePriorityRow {
  sourceType: string;
  name: string;
  globalDefault: number;
  factoryOverride: number | null;
}

interface IndustryDefaultRow {
  category: string;
  name: string;
  globalDefault: number;
  override: number | null;
}

interface ConfigResponse {
  factoryId: string;
  diffThreshold: number;
  sourcePriorities: SourcePriorityRow[];
  industryDefaults: IndustryDefaultRow[];
  updatedAt: string | null;
  updatedBy: string | null;
}

const auth = useAuthStore();

const loading = ref<boolean>(true);
const saving = ref<boolean>(false);
const error = ref<string | null>(null);

// Last server snapshot — what the server returned on the most recent load
// or save. Used to compute the dirty flag and to revert on cancel.
const serverSnapshot = ref<ConfigResponse | null>(null);

// Editable form state. Deep-cloned from server snapshot on each load.
const formDiffThreshold = ref<number>(0.30);
const formSourcePriorities = ref<SourcePriorityRow[]>([]);
const formIndustryDefaults = ref<IndustryDefaultRow[]>([]);

const updatedAtDisplay = computed<string>(() => {
  if (!serverSnapshot.value?.updatedAt) return '尚未保存过';
  const dt = new Date(serverSnapshot.value.updatedAt);
  if (Number.isNaN(dt.getTime())) return serverSnapshot.value.updatedAt;
  return dt.toLocaleString('zh-CN');
});

const updatedByDisplay = computed<string>(() => {
  return serverSnapshot.value?.updatedBy ?? '—';
});

/**
 * Dirty = any form value differs from the server snapshot. Used to
 * disable the Save button when there's nothing to save.
 */
const isDirty = computed<boolean>(() => {
  if (!serverSnapshot.value) return false;
  if (Math.abs(formDiffThreshold.value - serverSnapshot.value.diffThreshold) > 1e-9) {
    return true;
  }
  for (let i = 0; i < formSourcePriorities.value.length; i++) {
    const a = formSourcePriorities.value[i];
    const b = serverSnapshot.value.sourcePriorities[i];
    if (!b) return true;
    if (a.factoryOverride !== b.factoryOverride) return true;
  }
  for (let i = 0; i < formIndustryDefaults.value.length; i++) {
    const a = formIndustryDefaults.value[i];
    const b = serverSnapshot.value.industryDefaults[i];
    if (!b) return true;
    if (a.override !== b.override) return true;
  }
  return false;
});

const saveDisabled = computed<boolean>(() => loading.value || saving.value || !isDirty.value);

function snapshotToForm(snap: ConfigResponse): void {
  formDiffThreshold.value = snap.diffThreshold;
  formSourcePriorities.value = snap.sourcePriorities.map((r) => ({ ...r }));
  formIndustryDefaults.value = snap.industryDefaults.map((r) => ({ ...r }));
}

function formatThresholdTooltip(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

async function load(): Promise<void> {
  if (!auth.factoryId) {
    error.value = '当前用户无 factoryId — 请重新登录';
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const qs = new URLSearchParams({ factory_id: auth.factoryId }).toString();
    const resp = (await pythonFetch(
      `/api/smartbi/factory-config/provenance?${qs}`,
    )) as ConfigResponse;
    serverSnapshot.value = resp;
    snapshotToForm(resp);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    error.value = msg;
    ElMessage.error(`Provenance 配置读取失败: ${msg}`);
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  if (!auth.factoryId) {
    ElMessage.error('当前用户无 factoryId — 请重新登录');
    return;
  }
  saving.value = true;
  try {
    // Only send rows that have an explicit override. Null entries mean
    // "use the global default", which the server expresses by absence
    // from the JSONB.
    const sourcePriorities: Record<string, number> = {};
    for (const row of formSourcePriorities.value) {
      if (row.factoryOverride !== null && row.factoryOverride !== undefined) {
        sourcePriorities[row.sourceType] = row.factoryOverride;
      }
    }
    const industryDefaults: Record<string, number> = {};
    for (const row of formIndustryDefaults.value) {
      if (row.override !== null && row.override !== undefined) {
        industryDefaults[row.category] = row.override;
      }
    }

    // PUT body keys are camelCase to match the FastAPI Pydantic model
    // (ProvenanceConfigBody). transformKeys is OUTBOUND-only on response;
    // request bodies pass through verbatim.
    const body = {
      factoryId: auth.factoryId,
      diffThreshold: formDiffThreshold.value,
      sourcePriorities,
      industryDefaults,
    };

    const resp = (await pythonFetch(
      '/api/smartbi/factory-config/provenance',
      {
        method: 'PUT',
        body: JSON.stringify(body),
      },
    )) as ConfigResponse;

    serverSnapshot.value = resp;
    snapshotToForm(resp);
    ElMessage.success('配置已保存');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ElMessage.error(`配置保存失败: ${msg}`);
  } finally {
    saving.value = false;
  }
}

function cancel(): void {
  // Re-load from server (user may have made local edits and changed mind).
  load();
}

onMounted(load);
</script>

<template>
  <div class="provenance-config-page">
    <el-page-header class="page-hdr" content="Provenance 配置">
      <template #extra>
        <span class="hdr-meta">
          上次保存: {{ updatedAtDisplay }} 由 {{ updatedByDisplay }}
        </span>
      </template>
    </el-page-header>

    <el-skeleton v-if="loading" :rows="10" animated />

    <el-alert
      v-else-if="error"
      type="error"
      :title="error"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <template v-else>
      <!-- Q1: diff threshold -->
      <el-card class="q-card" shadow="never">
        <template #header>
          <strong>差异阈值 (Q1)</strong>
        </template>
        <p class="q-desc">
          新数据与现有值差异超过此比例 → 弹审, 不直接覆盖.
        </p>
        <el-slider
          v-model="formDiffThreshold"
          :min="0.05"
          :max="0.5"
          :step="0.05"
          :format-tooltip="formatThresholdTooltip"
        />
        <p class="q-current">
          当前: {{ (formDiffThreshold * 100).toFixed(0) }}% (默认 30%)
        </p>
      </el-card>

      <!-- Q2: source priorities -->
      <el-card class="q-card" shadow="never">
        <template #header>
          <strong>来源优先级 (Q2)</strong>
        </template>
        <p class="q-desc">
          多源数据冲突时, 系统按此优先级决定听谁的 (数字小 = 优先级高).
        </p>
        <el-table
          :data="formSourcePriorities"
          stripe
          size="small"
          class="q-table"
        >
          <el-table-column prop="name" label="数据来源" min-width="160" />
          <el-table-column prop="globalDefault" label="全局默认" width="120" align="center" />
          <el-table-column label="本 factory 设置" min-width="180">
            <template #default="{ row }">
              <el-input-number
                v-model="row.factoryOverride"
                :min="1"
                :max="6"
                :step="1"
                :precision="0"
                size="small"
                placeholder="(用全局)"
                controls-position="right"
                style="width: 140px"
              />
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- Q3: industry defaults -->
      <el-card class="q-card" shadow="never">
        <template #header>
          <strong>行业默认成本率 (Q3)</strong>
        </template>
        <p class="q-desc">
          菜品无配方时, 按品类用此默认值估算成本.
        </p>
        <el-table
          :data="formIndustryDefaults"
          stripe
          size="small"
          class="q-table"
        >
          <el-table-column prop="category" label="品类" min-width="160" />
          <el-table-column prop="globalDefault" label="行业平均" width="140" align="center">
            <template #default="{ row }">
              {{ (row.globalDefault * 100).toFixed(0) }}%
            </template>
          </el-table-column>
          <el-table-column label="本 factory 自定义" min-width="200">
            <template #default="{ row }">
              <el-input-number
                v-model="row.override"
                :min="0"
                :max="1"
                :step="0.01"
                :precision="2"
                size="small"
                placeholder="(用全局)"
                controls-position="right"
                style="width: 160px"
              />
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- Footer -->
      <div class="footer-bar">
        <el-button :disabled="saveDisabled" :loading="saving" type="primary" @click="save">
          保存
        </el-button>
        <el-button :disabled="loading || saving" @click="cancel">
          取消
        </el-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.provenance-config-page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-hdr {
  margin-bottom: 4px;
}

.hdr-meta {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.error-alert {
  margin-top: 12px;
}

.q-card {
  border-radius: 6px;
}

.q-desc {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: 0 0 12px;
}

.q-current {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-top: 8px;
}

.q-table {
  margin-top: 8px;
}

.footer-bar {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 12px 0;
}
</style>
