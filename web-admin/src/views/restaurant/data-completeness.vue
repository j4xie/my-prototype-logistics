<!--
  餐饮数据完整度页 — Task 2.2 (Restaurant Phase A-2).

  URL: /restaurant/data-completeness
  Visible: RESTAURANT factory only (sidebar gated by hideForFactoryTypes: ['FACTORY'])

  Shows overall completeness ring chart + 6 module cards with coverage
  progress bars.  Missing-data modules surface an upload CTA that routes
  to /smart-bi/excel-upload.

  Uses pythonFetch (W0.4 finding 6 — snake→camel auto-convert).
  No `as any` — all types imported from @/api/restaurant/completeness.
-->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import {
  fetchCompleteness,
  type CompletenessModule,
  type CompletenessResponse,
} from '@/api/restaurant/completeness';

// ── Router / auth ──────────────────────────────────────────────────────
const router = useRouter();
const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

// ── State ──────────────────────────────────────────────────────────────
const loading = ref<boolean>(false);
const errorMsg = ref<string>('');
const data = ref<CompletenessResponse | null>(null);

// ── Derived ────────────────────────────────────────────────────────────
const overallPercent = computed(() =>
  data.value ? Math.round(data.value.overallCompleteness) : 0
);

const ringDasharray = computed(() => {
  const pct = overallPercent.value;
  const circumference = 2 * Math.PI * 45; // r=45
  const filled = (pct / 100) * circumference;
  return `${filled.toFixed(1)} ${(circumference - filled).toFixed(1)}`;
});

const ringColor = computed(() => {
  const pct = overallPercent.value;
  if (pct >= 70) return '#67c23a'; // green
  if (pct >= 30) return '#e6a23c'; // yellow
  return '#f56c6c';                // red
});

const isCacheHit = computed(() => data.value?.cachedAt === 'hit');

// ── Helpers ────────────────────────────────────────────────────────────
function coverageColor(coverage: number): string {
  if (coverage >= 70) return '#67c23a'; // green
  if (coverage >= 30) return '#e6a23c'; // yellow
  return '#f56c6c';                     // red
}

function formatLastUpdated(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function firstHint(mod: CompletenessModule): string {
  return mod.missingHints.length > 0 ? mod.missingHints[0] : '';
}

function goUpload(): void {
  router.push('/smart-bi/excel-upload');
}

// ── Data loading ───────────────────────────────────────────────────────
async function load(): Promise<void> {
  errorMsg.value = '';
  const fid = factoryId.value;
  if (!fid) {
    errorMsg.value = '当前用户无 factoryId — 请重新登录';
    return;
  }
  loading.value = true;
  try {
    data.value = await fetchCompleteness(fid);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errorMsg.value = msg || '数据加载失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="completeness-page">
    <!-- ── Loading skeleton ── -->
    <el-skeleton v-if="loading" :rows="6" animated />

    <!-- ── Error state ── -->
    <el-alert
      v-else-if="errorMsg"
      :title="errorMsg"
      type="error"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <!-- ── Main content ── -->
    <template v-else-if="data">
      <!-- Header card -->
      <el-card class="header-card" shadow="never">
        <div class="header-inner">
          <!-- Ring chart (SVG) -->
          <div class="ring-wrap">
            <svg viewBox="0 0 100 100" class="ring-svg">
              <!-- background track -->
              <circle cx="50" cy="50" r="45" fill="none" stroke="#e4e7ed" stroke-width="10" />
              <!-- progress arc -->
              <circle
                cx="50" cy="50" r="45"
                fill="none"
                :stroke="ringColor"
                stroke-width="10"
                stroke-linecap="round"
                :stroke-dasharray="ringDasharray"
                stroke-dashoffset="0"
                transform="rotate(-90 50 50)"
              />
              <!-- center text -->
              <text x="50" y="50" text-anchor="middle" dominant-baseline="central"
                    class="ring-text" :fill="ringColor">
                {{ overallPercent }}%
              </text>
            </svg>
            <p class="ring-label">整体完整度</p>
          </div>

          <!-- Factory info -->
          <div class="factory-info">
            <h2 class="factory-name">{{ data.factoryName }}</h2>
            <div class="tags">
              <el-tag type="info" size="small">
                建档 {{ data.factoryAgeDays }} 天
              </el-tag>
              <el-tag
                v-if="isCacheHit"
                type="success"
                size="small"
              >
                缓存命中
              </el-tag>
              <el-tag v-else type="warning" size="small">实时计算</el-tag>
            </div>
            <p v-if="!isCacheHit && data.cachedAt" class="updated-at">
              更新于 {{ formatLastUpdated(data.cachedAt) }}
            </p>
          </div>

          <!-- Refresh -->
          <div class="header-actions">
            <el-button :loading="loading" @click="load" size="small">
              刷新
            </el-button>
          </div>
        </div>
      </el-card>

      <!-- Module cards grid -->
      <div class="modules-grid">
        <el-card
          v-for="mod in data.modules"
          :key="mod.id"
          class="module-card"
          shadow="hover"
        >
          <!-- Card header: name + status tag -->
          <template #header>
            <div class="module-header">
              <span class="module-name">{{ mod.name }}</span>
              <el-tag
                :type="mod.hasData ? 'success' : 'info'"
                size="small"
              >
                {{ mod.hasData ? '有数据' : '暂无数据' }}
              </el-tag>
            </div>
          </template>

          <!-- Coverage progress bar -->
          <div class="coverage-row">
            <el-progress
              :percentage="Math.round(mod.coverage)"
              :color="coverageColor(mod.coverage)"
              :show-text="true"
              :stroke-width="12"
              status="success"
            />
          </div>

          <!-- Stats line -->
          <div class="stats-row">
            <span class="stat-item">记录数：{{ mod.recordCount.toLocaleString() }}</span>
            <span class="stat-sep">·</span>
            <span class="stat-item">
              最近更新：{{ formatLastUpdated(mod.lastUpdated) }}
            </span>
          </div>

          <!-- Missing hint + upload CTA -->
          <div v-if="!mod.hasData" class="missing-row">
            <p v-if="firstHint(mod)" class="missing-hint">{{ firstHint(mod) }}</p>
            <el-button type="primary" size="small" plain @click="goUpload">
              上传缺失数据
            </el-button>
          </div>
        </el-card>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.completeness-page {
  padding: 20px;
}

.error-alert {
  margin-bottom: 20px;
}

/* Header */
.header-card {
  margin-bottom: 20px;
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 24px;
}

.ring-wrap {
  flex: 0 0 120px;
  text-align: center;
}

.ring-svg {
  width: 120px;
  height: 120px;
  overflow: visible;
}

.ring-text {
  font-size: 16px;
  font-weight: 700;
}

.ring-label {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}

.factory-info {
  flex: 1;
}

.factory-name {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary, #303133);
}

.tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.updated-at {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}

.header-actions {
  flex: 0 0 auto;
}

/* Modules grid */
.modules-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.module-card {
  :deep(.el-card__header) {
    padding: 12px 16px;
  }

  :deep(.el-card__body) {
    padding: 12px 16px;
  }
}

.module-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.module-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary, #303133);
}

.coverage-row {
  margin-bottom: 10px;
}

.stats-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
  margin-bottom: 10px;
}

.stat-sep {
  color: var(--el-border-color, #dcdfe6);
}

.missing-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.missing-hint {
  margin: 0;
  font-size: 12px;
  color: var(--el-color-warning, #e6a23c);
}
</style>
