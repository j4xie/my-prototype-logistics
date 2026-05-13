<script setup lang="ts">
/**
 * QHJ 收入管理报表 — 青花椒 / R_*_REAL restaurant chains.
 *
 * Spec: docs/qa-specs/2026-05-12-qhj-revenue-report-design.md §9 (Phase I)
 * Plan: docs/superpowers/plans/2026-05-12-qhj-revenue-report.md Task I2
 *
 * Single SFC matching project's mega-component norm (FinanceAnalysis 2949 LOC,
 * RestaurantV2Dashboard 2320 LOC). Block 1/2/3/4 preview tables + xlsx download
 * + audit log tab.
 *
 * Visible only to RESTAURANT-type factories (hideForFactoryTypes:['FACTORY']
 * in router meta + sidebar).
 */
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessage, ElAlert } from 'element-plus';
import type { UploadUserFile } from 'element-plus';
import {
  uploadPosFiles,
  prepare,
  generateAndDownload,
  listStores,
  getAuditLog,
  type RevenueReportParams,
  type StoreEntry,
  type UploadResultItem,
  type AuditLogEntry,
} from '@/api/smartbi/revenue-report';
import { useAuthStore } from '@/stores/auth';
import SmartBIUploader from '@/components/smartbi/SmartBIUploader.vue';

const authStore = useAuthStore();
const activeTab = ref<'generate' | 'audit'>('generate');

// ─── Stores list (loaded once at mount) ───────────────────────────────
const stores = ref<StoreEntry[]>([]);
const storesLoading = ref(false);

// ─── Filter form ──────────────────────────────────────────────────────
const dateRange = ref<[string, string] | null>(null);
const selectedStoreNames = ref<string[]>([]);
const selectedMealPeriods = ref<string[]>([]);

// localStorage key per spec §9 audit X — restore filters on tab switch
const filterStorageKey = computed(() =>
  `revenue-report-filters-${authStore.factoryId ?? 'anon'}`,
);

// ─── Upload state ─────────────────────────────────────────────────────
const uploadFiles = ref<UploadUserFile[]>([]);
const uploading = ref(false);
const uploadResults = ref<UploadResultItem[]>([]);

// ─── Generation state ─────────────────────────────────────────────────
const generating = ref(false);
const elapsedSec = ref(0);
let elapsedTimer: number | null = null;
const lastDownloadInfo = ref<{
  filename: string;
  cacheHit: boolean;
  storeCount: number;
  goldMaterializedAt: string;
  isStale: boolean;
} | null>(null);

// ─── Preview (block previews after /prepare) ──────────────────────────
const previewSummary = ref<{
  store_count: number;
  date_range: string;
  gold_materialized_at: string;
  file_size_bytes: number;
  cache_hit: boolean;
  is_stale: boolean;
} | null>(null);

// ─── Audit log tab ────────────────────────────────────────────────────
const auditRows = ref<AuditLogEntry[]>([]);
const auditLoading = ref(false);

// ─── Date shortcuts ───────────────────────────────────────────────────
const dateShortcuts = [
  {
    text: '上周',
    value: () => {
      const today = new Date();
      const dayOfWeek = today.getDay() || 7; // 1..7 (Mon..Sun, treat Sun as 7)
      const lastSun = new Date(today);
      lastSun.setDate(today.getDate() - dayOfWeek);
      const lastMon = new Date(lastSun);
      lastMon.setDate(lastSun.getDate() - 6);
      return [lastMon, lastSun] as [Date, Date];
    },
  },
  {
    text: '本月',
    value: () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return [start, today] as [Date, Date];
    },
  },
  {
    text: '上月',
    value: () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return [start, end] as [Date, Date];
    },
  },
  {
    text: '近 30 天',
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);
      return [start, end] as [Date, Date];
    },
  },
];

// ─── Lifecycle ────────────────────────────────────────────────────────
onMounted(async () => {
  await loadStores();
  loadFiltersFromStorage();
  await loadAuditLog();
});

watch([dateRange, selectedStoreNames, selectedMealPeriods], () => {
  saveFiltersToStorage();
});

async function loadStores() {
  storesLoading.value = true;
  try {
    stores.value = await listStores(true);
  } catch (e: any) {
    ElMessage.error(`门店列表加载失败: ${e?.message || e}`);
  } finally {
    storesLoading.value = false;
  }
}

function loadFiltersFromStorage() {
  try {
    const raw = localStorage.getItem(filterStorageKey.value);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.dateRange) dateRange.value = parsed.dateRange;
    if (parsed.selectedStoreNames) selectedStoreNames.value = parsed.selectedStoreNames;
    if (parsed.selectedMealPeriods) selectedMealPeriods.value = parsed.selectedMealPeriods;
  } catch {
    // Ignore malformed cache.
  }
}

function saveFiltersToStorage() {
  try {
    localStorage.setItem(
      filterStorageKey.value,
      JSON.stringify({
        dateRange: dateRange.value,
        selectedStoreNames: selectedStoreNames.value,
        selectedMealPeriods: selectedMealPeriods.value,
      }),
    );
  } catch {
    // Ignore quota errors.
  }
}

// ─── Upload handler ───────────────────────────────────────────────────
async function handleFilesChange(files: UploadUserFile[]) {
  uploadFiles.value = files;
}

async function handleUpload() {
  if (uploading.value) return;
  const raws = uploadFiles.value
    .map((f) => f.raw)
    .filter((r): r is File => !!r);
  if (raws.length === 0) {
    ElMessage.warning('请先选择文件');
    return;
  }
  uploading.value = true;
  uploadResults.value = [];
  try {
    const res = await uploadPosFiles(raws);
    uploadResults.value = res.files;
    const ok = res.files.filter((f) => f.status === 'ok').length;
    const dup = res.files.filter((f) => f.status === 'duplicate').length;
    const unk = res.files.filter((f) => f.status === 'unknown').length;
    let msg = `上传完成: ${ok} 成功`;
    if (dup) msg += ` / ${dup} 重复（已跳过）`;
    if (unk) msg += ` / ${unk} 无法识别`;
    if (unk > 0) ElMessage.warning(msg);
    else ElMessage.success(msg);
  } catch (e: any) {
    ElMessage.error(`上传失败: ${e?.response?.data?.message || e?.message || e}`);
  } finally {
    uploading.value = false;
  }
}

// ─── Generate handler ─────────────────────────────────────────────────
function buildParams(): RevenueReportParams | null {
  if (!dateRange.value) {
    ElMessage.warning('请选择日期范围');
    return null;
  }
  const [from, to] = dateRange.value;
  return {
    store_names: selectedStoreNames.value,
    date_from: from,
    date_to: to,
    meal_periods: selectedMealPeriods.value,
  };
}

function startElapsedTimer() {
  elapsedSec.value = 0;
  if (elapsedTimer !== null) clearInterval(elapsedTimer);
  elapsedTimer = window.setInterval(() => {
    elapsedSec.value++;
  }, 1000) as unknown as number;
}

function stopElapsedTimer() {
  if (elapsedTimer !== null) {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
}

async function handlePreview() {
  if (generating.value) return;
  const params = buildParams();
  if (!params) return;
  generating.value = true;
  startElapsedTimer();
  try {
    const res = await prepare(params);
    previewSummary.value = res.summary;
    ElMessage.success(
      `数据已生成${res.summary.cache_hit ? '（缓存命中）' : ''}，` +
        `点 "下载 Excel" 获取文件`,
    );
  } catch (e: any) {
    ElMessage.error(`预览失败: ${e?.response?.data?.message || e?.message || e}`);
  } finally {
    generating.value = false;
    stopElapsedTimer();
  }
}

async function handleDownload() {
  if (generating.value) return;
  const params = buildParams();
  if (!params) return;
  generating.value = true;
  startElapsedTimer();
  try {
    const result = await generateAndDownload(params);
    const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
    const safeRange = `${params.date_from}_${params.date_to}`;
    const filename = isFirefox
      ? `revenue_report_${safeRange}.xlsx`
      : `收入管理报表_${safeRange}.xlsx`;
    const url = URL.createObjectURL(
      new Blob([result.blob], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    lastDownloadInfo.value = {
      filename,
      cacheHit: result.cacheHit,
      storeCount: result.storeCount,
      goldMaterializedAt: result.goldMaterializedAt,
      isStale: result.isStale,
    };
    ElMessage.success(`下载完成${result.cacheHit ? '（缓存命中）' : ''}`);
    // Refresh audit log so the new generation appears immediately.
    await loadAuditLog();
  } catch (e: any) {
    ElMessage.error(`下载失败: ${e?.response?.data?.message || e?.message || e}`);
  } finally {
    generating.value = false;
    stopElapsedTimer();
  }
}

// ─── Audit log ────────────────────────────────────────────────────────
async function loadAuditLog() {
  auditLoading.value = true;
  try {
    auditRows.value = await getAuditLog(20);
  } catch (e: any) {
    ElMessage.error(`历史记录加载失败: ${e?.message || e}`);
  } finally {
    auditLoading.value = false;
  }
}

function fmtFileSize(bytes: number | null | undefined) {
  if (!bytes) return '—';
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function fmtDuration(ms: number | null | undefined) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
</script>

<template>
  <div class="revenue-report-page">
    <h1 class="page-title">收入管理报表</h1>
    <p class="page-subtitle">
      青花椒 / 餐饮真实门店 — 同比 / 环比 / 堂食外卖占比 / 客单人数分析
    </p>

    <!-- Stale-data warning banner (spec §11.4) -->
    <el-alert
      v-if="previewSummary?.is_stale || lastDownloadInfo?.isStale"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    >
      数据延迟：最新截至 {{ previewSummary?.gold_materialized_at || lastDownloadInfo?.goldMaterializedAt }}，
      可能不含最近一次上传的数据。
    </el-alert>

    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane name="generate" label="上传 & 生成">
        <!-- ─── Upload block ──────────────────────────────────── -->
        <section class="card">
          <h3 class="card-title">上传二维火 POS 文件</h3>
          <p class="card-help">
            支持
            <code>详细日报表</code> /
            <code>营业概况报表</code> /
            <code>堂食外卖占比表</code> /
            <code>商品销售明细表</code>
            等。zip / xlsx / xls / csv 均可，文件名识别后自动派发到对应 Silver 写入路径。
          </p>
          <SmartBIUploader
            :canUpload="true"
            :historyLoading="false"
            :uploading="uploading"
            :maxCount="0"
            accept=".zip,.xlsx,.xls,.csv"
            @files-change="handleFilesChange"
            @upload="handleUpload"
          />
          <el-button
            v-if="uploadFiles.length > 0 && !uploading"
            type="primary"
            size="large"
            :loading="uploading"
            @click="handleUpload"
            style="margin-top: 16px"
          >
            开始上传 {{ uploadFiles.length }} 个文件
          </el-button>

          <!-- Upload results table -->
          <el-table
            v-if="uploadResults.length > 0"
            :data="uploadResults"
            style="margin-top: 16px"
            stripe
          >
            <el-table-column prop="filename" label="文件名" />
            <el-table-column prop="status" label="状态" width="120">
              <template #default="{ row }">
                <el-tag
                  :type="
                    row.status === 'ok'
                      ? 'success'
                      : row.status === 'duplicate'
                        ? 'warning'
                        : 'danger'
                  "
                >
                  {{
                    row.status === 'ok'
                      ? '成功'
                      : row.status === 'duplicate'
                        ? '重复'
                        : '无法识别'
                  }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="识别类型" width="200">
              <template #default="{ row }">
                {{ row.report_types?.join(', ') || '—' }}
              </template>
            </el-table-column>
            <el-table-column label="详情">
              <template #default="{ row }">
                <span v-if="row.status === 'duplicate' && row.existing_upload_id">
                  已存在 upload_id={{ row.existing_upload_id }}
                </span>
                <span v-else-if="row.preview_headers">
                  Preview: {{ row.preview_headers?.slice(0, 1).join(' / ') }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </section>

        <!-- ─── Generate block ─────────────────────────────────── -->
        <section class="card" style="margin-top: 24px">
          <h3 class="card-title">生成报表</h3>

          <el-form label-width="100px" label-position="left">
            <el-form-item label="日期范围" required>
              <el-date-picker
                v-model="dateRange"
                type="daterange"
                value-format="YYYY-MM-DD"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                :shortcuts="dateShortcuts"
                style="width: 320px"
              />
            </el-form-item>

            <el-form-item label="门店">
              <el-select
                v-model="selectedStoreNames"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                :loading="storesLoading"
                placeholder="不选 = 全部门店"
                style="width: 480px"
              >
                <el-option
                  v-for="s in stores"
                  :key="s.store_id"
                  :label="s.name"
                  :value="s.name"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="班次">
              <el-checkbox-group v-model="selectedMealPeriods">
                <el-checkbox label="午市" />
                <el-checkbox label="晚市" />
              </el-checkbox-group>
              <span class="hint">未勾选 = 全班次</span>
            </el-form-item>

            <el-form-item>
              <el-button
                type="default"
                :loading="generating"
                :disabled="generating"
                @click="handlePreview"
              >
                预览数据
              </el-button>
              <el-button
                type="primary"
                :loading="generating"
                :disabled="generating"
                @click="handleDownload"
              >
                下载 Excel
              </el-button>
              <span v-if="generating" class="elapsed">已等待 {{ elapsedSec }} 秒...</span>
            </el-form-item>
          </el-form>

          <!-- Preview summary card -->
          <div v-if="previewSummary" class="summary-card">
            <div class="summary-row">
              <span class="summary-label">门店数：</span>
              <strong>{{ previewSummary.store_count }}</strong>
            </div>
            <div class="summary-row">
              <span class="summary-label">日期范围：</span>
              <strong>{{ previewSummary.date_range }}</strong>
            </div>
            <div class="summary-row">
              <span class="summary-label">数据新鲜度：</span>
              <strong>{{ previewSummary.gold_materialized_at }}</strong>
            </div>
            <div class="summary-row">
              <span class="summary-label">文件大小：</span>
              <strong>{{ fmtFileSize(previewSummary.file_size_bytes) }}</strong>
            </div>
            <div class="summary-row">
              <span class="summary-label">缓存命中：</span>
              <strong>{{ previewSummary.cache_hit ? '是' : '否' }}</strong>
            </div>
          </div>
        </section>
      </el-tab-pane>

      <el-tab-pane name="audit" label="历史记录">
        <section class="card">
          <h3 class="card-title">最近 20 次生成</h3>
          <el-table :data="auditRows" v-loading="auditLoading" stripe>
            <el-table-column prop="generated_at" label="时间" width="180" />
            <el-table-column prop="generated_by" label="用户" width="180" />
            <el-table-column label="参数">
              <template #default="{ row }">
                <code>{{ JSON.stringify(row.params_snapshot) }}</code>
              </template>
            </el-table-column>
            <el-table-column label="文件大小" width="100">
              <template #default="{ row }">{{ fmtFileSize(row.file_size_bytes) }}</template>
            </el-table-column>
            <el-table-column label="耗时" width="100">
              <template #default="{ row }">{{ fmtDuration(row.duration_ms) }}</template>
            </el-table-column>
            <el-table-column label="缓存" width="80">
              <template #default="{ row }">
                <el-tag :type="row.cache_hit ? 'success' : 'info'" size="small">
                  {{ row.cache_hit ? '命中' : '未命中' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 'ok' ? 'success' : 'danger'" size="small">
                  {{ row.status === 'ok' ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.revenue-report-page {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  margin: 0 0 4px;
}

.page-subtitle {
  color: #86909c;
  margin: 0 0 24px;
  font-size: 14px;
}

.card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 24px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 12px;
}

.card-help {
  color: #86909c;
  font-size: 13px;
  margin: 0 0 16px;
}

.card-help code {
  background: #f4f4f5;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
}

.hint {
  margin-left: 12px;
  color: #86909c;
  font-size: 12px;
}

.elapsed {
  margin-left: 16px;
  color: #86909c;
  font-size: 12px;
}

.summary-card {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 16px 20px;
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px 24px;
}

.summary-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.summary-label {
  color: #86909c;
  font-size: 13px;
}
</style>
