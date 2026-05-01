<template>
  <div class="llm-usage-page">
    <div class="page-header">
      <h2>LLM 用量监控</h2>
      <div class="controls">
        <el-select v-model="days" @change="loadAll" style="width: 140px">
          <el-option :value="1" label="今日" />
          <el-option :value="7" label="近 7 天" />
          <el-option :value="30" label="近 30 天" />
          <el-option :value="90" label="近 90 天" />
        </el-select>
        <el-button :icon="Refresh" @click="loadAll" :loading="loading">刷新</el-button>
      </div>
    </div>

    <!-- Summary cards -->
    <el-row :gutter="16" class="summary-row">
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-title">调用次数</div>
          <div class="stat-value">{{ fmt(summary?.window?.calls) }}</div>
          <div class="stat-sub">今日 {{ fmt(summary?.today?.calls) }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-title">Token 总量</div>
          <div class="stat-value">{{ fmtK(summary?.window?.total_tok) }}</div>
          <div class="stat-sub">今日 {{ fmtK(summary?.today?.total_tok) }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-title">平均延时</div>
          <div class="stat-value">{{ fmt(summary?.window?.avg_ms) }} ms</div>
          <div class="stat-sub">输入 {{ fmtK(summary?.window?.input_tok) }} / 输出 {{ fmtK(summary?.window?.output_tok) }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" :class="{ 'error-card': (summary?.window?.errors || 0) > 0 }">
          <div class="stat-title">错误次数</div>
          <div class="stat-value" :style="{ color: (summary?.window?.errors || 0) > 0 ? '#f56c6c' : '#67c23a' }">
            {{ fmt(summary?.window?.errors) }}
          </div>
          <div class="stat-sub">今日 {{ fmt(summary?.today?.errors) }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Provider Account breakdown -->
    <el-card class="section-card">
      <template #header>
        <div class="section-header">
          <span>Provider 账号分布</span>
          <el-tag size="small" type="info">按免费额度优先级: aliyun_b → aliyun_a → zhipu → deepseek</el-tag>
        </div>
      </template>
      <el-table :data="byProvider" stripe>
        <el-table-column prop="provider" label="Provider" width="150">
          <template #default="{ row }">
            <el-tag :type="providerTagType(row.provider)">{{ providerLabel(row.provider) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="calls" label="调用次数" width="110" sortable />
        <el-table-column prop="models" label="模型数" width="90" sortable />
        <el-table-column prop="total_tok" label="Token 总量" width="140" sortable>
          <template #default="{ row }">{{ fmtK(row.total_tok) }}</template>
        </el-table-column>
        <el-table-column prop="avg_ms" label="平均延时 (ms)" width="140" sortable />
        <el-table-column prop="errors" label="错误" width="100" sortable>
          <template #default="{ row }">
            <el-tag v-if="row.errors > 0" type="danger" size="small">{{ row.errors }}</el-tag>
            <span v-else style="color: #67c23a">0</span>
          </template>
        </el-table-column>
        <el-table-column label="用量比例">
          <template #default="{ row }">
            <el-progress :percentage="pct(row.total_tok)" :stroke-width="12" />
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- By Factory (用户关心 — 每个工厂消耗) -->
    <el-card class="section-card">
      <template #header>
        <div class="section-header">
          <span>按工厂消耗 (估算计费)</span>
          <el-tag size="small" type="warning">点击工厂查看模型细分</el-tag>
        </div>
      </template>
      <el-table :data="byFactory" stripe @row-click="onFactoryClick">
        <el-table-column prop="factory_id" label="工厂 ID" width="160" />
        <el-table-column prop="calls" label="调用次数" width="110" sortable />
        <el-table-column prop="total_tok" label="Token 总量" width="140" sortable>
          <template #default="{ row }">
            <strong>{{ fmtK(row.total_tok) }}</strong>
          </template>
        </el-table-column>
        <el-table-column label="输入 / 输出" width="170">
          <template #default="{ row }">
            <span style="color: #909399">
              {{ fmtK(row.input_tok) }} / {{ fmtK(row.output_tok) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="models_used" label="模型数" width="90" sortable />
        <el-table-column prop="avg_ms" label="平均延时 (ms)" width="140" sortable />
        <el-table-column prop="errors" label="错误" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.errors > 0" type="danger" size="small">{{ row.errors }}</el-tag>
            <span v-else style="color: #67c23a">0</span>
          </template>
        </el-table-column>
        <el-table-column prop="last_call_at" label="最后调用" min-width="180">
          <template #default="{ row }">{{ fmtTime(row.last_call_at) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- By Model -->
    <el-card class="section-card">
      <template #header><span>按模型分布</span></template>
      <el-table :data="byModel" stripe>
        <el-table-column prop="provider" label="Provider" width="120">
          <template #default="{ row }">
            <el-tag :type="providerTagType(row.provider)" size="small">{{ providerLabel(row.provider) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="model" label="模型 Code" min-width="200" />
        <el-table-column prop="calls" label="调用" width="90" sortable />
        <el-table-column prop="total_tok" label="Token" width="120" sortable>
          <template #default="{ row }">{{ fmtK(row.total_tok) }}</template>
        </el-table-column>
        <el-table-column prop="avg_ms" label="延时 (ms)" width="110" sortable />
        <el-table-column prop="errors" label="错误" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.errors > 0" type="danger" size="small">{{ row.errors }}</el-tag>
            <span v-else style="color: #67c23a">0</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Factory detail drawer -->
    <el-drawer v-model="drawerOpen" :title="`${selectedFactory} · 模型细分`" size="55%">
      <el-table :data="factoryDetail" stripe>
        <el-table-column prop="provider" label="Provider" width="120">
          <template #default="{ row }">
            <el-tag :type="providerTagType(row.provider)" size="small">{{ providerLabel(row.provider) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="model" label="模型" />
        <el-table-column prop="caller" label="调用位置" width="140" />
        <el-table-column prop="calls" label="次数" width="80" />
        <el-table-column prop="total_tok" label="Token" width="120">
          <template #default="{ row }">{{ fmtK(row.total_tok) }}</template>
        </el-table-column>
        <el-table-column prop="avg_ms" label="延时 ms" width="100" />
      </el-table>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import {
  llmUsageApi,
  type UsageSummary, type ByModelRow, type ByFactoryRow, type ByProviderRow,
} from '@/api/smartbi/llm-usage';

const days = ref(7);
const loading = ref(false);
const summary = ref<UsageSummary | null>(null);
const byModel = ref<ByModelRow[]>([]);
const byFactory = ref<ByFactoryRow[]>([]);
const byProvider = ref<ByProviderRow[]>([]);

const drawerOpen = ref(false);
const selectedFactory = ref('');
const factoryDetail = ref<any[]>([]);

async function loadAll() {
  loading.value = true;
  try {
    const [s, m, f, p] = await Promise.all([
      llmUsageApi.summary(days.value),
      llmUsageApi.byModel(days.value),
      llmUsageApi.byFactory(days.value),
      llmUsageApi.byProvider(days.value),
    ]);
    // R77: response interceptor (api/request.ts:166) 已 unwrap 成 ApiResponse<T>,
    // 直接访问 .data 而不用 `(s as any)?.data ?? s` band-aid.
    summary.value = s.data ?? null;
    byModel.value = m.data ?? [];
    byFactory.value = f.data ?? [];
    byProvider.value = p.data ?? [];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    ElMessage.error('加载 LLM 用量失败: ' + msg);
  } finally {
    loading.value = false;
  }
}

async function onFactoryClick(row: ByFactoryRow) {
  selectedFactory.value = row.factory_id;
  drawerOpen.value = true;
  try {
    const r = await llmUsageApi.byFactoryModel(days.value, row.factory_id);
    factoryDetail.value = r.data ?? [];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    ElMessage.error('加载工厂细分失败: ' + msg);
  }
}

function fmt(n?: number | null): string {
  if (n === null || n === undefined) return '-';
  return n.toLocaleString();
}
function fmtK(n?: number | null): string {
  if (n === null || n === undefined) return '-';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}
function fmtTime(ts?: string): string {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleString('zh-CN');
}
function pct(tok: number): number {
  const total = byProvider.value.reduce((s, r) => s + (r.total_tok || 0), 0);
  if (total === 0) return 0;
  return Math.round((tok / total) * 100);
}
function providerTagType(p: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  if (p === 'aliyun_b') return 'success';
  if (p === 'aliyun_a') return 'primary';
  if (p === 'zhipu') return 'warning';
  if (p === 'deepseek') return 'danger';
  return 'info';
}
function providerLabel(p: string): string {
  const labels: Record<string, string> = {
    aliyun_a: '阿里云 A (主)',
    aliyun_b: '阿里云 B (新)',
    zhipu: '智谱',
    deepseek: 'DeepSeek 付费',
    dashscope: 'DashScope (未分账号)',
  };
  return labels[p] || p;
}

onMounted(loadAll);
</script>

<style scoped>
.llm-usage-page { padding: 16px; }
.page-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
}
.page-header h2 { margin: 0; }
.controls { display: flex; gap: 8px; }
.summary-row { margin-bottom: 16px; }
.stat-title { color: #909399; font-size: 14px; margin-bottom: 8px; }
.stat-value { font-size: 28px; font-weight: 600; color: #303133; }
.stat-sub { color: #909399; font-size: 12px; margin-top: 4px; }
.section-card { margin-bottom: 16px; }
.section-header {
  display: flex; justify-content: space-between; align-items: center;
}
.error-card :deep(.el-card__body) { border-left: 3px solid #f56c6c; }
</style>
