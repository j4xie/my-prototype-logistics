<script setup lang="ts">
/**
 * Gold Preview — reads the 5 /api/smartbi/gold/* routes side-by-side.
 *
 * Phase B v0 of Unified Data Layer v1 spec (§5). This page is the visual
 * proof the new Gold pipeline serves displayable data. Vue pages will
 * eventually cut over from legacy endpoints to these same routes once
 * the Java shadow-read divergence stabilizes.
 *
 * Intentionally unopinionated — 4 result panels, minimal styling. We're
 * not replacing the Dashboard.vue page yet.
 */
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import {
  getChannelBreakdown,
  getDailyTrend,
  getDiscountBreakdown,
  getFinanceSummary,
  getKpiSummary,
  getTopProducts,
  type ChannelBreakdown,
  type DailyTrend,
  type DiscountBreakdown,
  type FinanceSummary,
  type KpiSummary,
  type TopProducts,
} from '@/api/smartbi/gold';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import TrustIndicator from '@/components/TrustIndicator.vue';

const auth = useAuthStore();
const permissionStore = usePermissionStore();
const canViewPrice = computed(() => permissionStore.canViewPrice);
const router = useRouter();

// 数据织网 Sub-Project C Day 24-25 POC: build cell-audit URL from a
// product row. Returns undefined when entityId/fieldName missing so the
// TrustIndicator hides its 查看来源 button (matches its prop contract).
function cellAuditUrl(row: { entityId?: string | null; fieldName?: string | null }): string | undefined {
  if (!row.entityId || !row.fieldName) return undefined;
  return `/audit/cell?type=product&id=${encodeURIComponent(row.entityId)}&field=${encodeURIComponent(row.fieldName)}`;
}

function onAudit(row: { entityId?: string | null; fieldName?: string | null }): void {
  const url = cellAuditUrl(row);
  if (url) router.push(url);
}

const factoryId = ref<string>(auth.factoryId || 'F001');
const startDate = ref<string>('2025-01-01');
const endDate = ref<string>('2025-12-31');
const loading = ref<boolean>(false);
const lastLoadMs = ref<number>(0);

const kpi = ref<KpiSummary | null>(null);
const finance = ref<FinanceSummary | null>(null);
const trend = ref<DailyTrend | null>(null);
const products = ref<TopProducts | null>(null);
const channels = ref<ChannelBreakdown | null>(null);
const discounts = ref<DiscountBreakdown | null>(null);

const rmb = (n: number | null | undefined): string => {
  if (n == null) return '—';
  return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const trendSummary = computed(() => {
  if (!trend.value || trend.value.points.length === 0) return { count: 0, avg: 0 };
  const count = trend.value.points.length;
  const total = trend.value.points.reduce((s, p) => s + p.revenue, 0);
  return { count, avg: total / count };
});

async function loadAll(): Promise<void> {
  if (!factoryId.value || !startDate.value || !endDate.value) {
    ElMessage.warning('请填写 factory_id 和日期区间');
    return;
  }
  loading.value = true;
  const t0 = performance.now();
  try {
    const args = {
      factoryId: factoryId.value,
      startDate: startDate.value,
      endDate: endDate.value,
    };
    // Fire all 6 in parallel — independent Gold reads.
    const [kpiR, financeR, trendR, productsR, channelsR, discountsR] = await Promise.all([
      getKpiSummary(args),
      getFinanceSummary({ ...args, topNStores: 5 }),
      getDailyTrend(args),
      getTopProducts({ ...args, topN: 10 }),
      getChannelBreakdown({ ...args, topN: 10 }),
      getDiscountBreakdown({ ...args, topN: 10 }),
    ]);
    kpi.value = kpiR;
    finance.value = financeR;
    trend.value = trendR;
    products.value = productsR;
    channels.value = channelsR;
    discounts.value = discountsR;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ElMessage.error(`Gold 查询失败: ${msg}`);
  } finally {
    lastLoadMs.value = Math.round(performance.now() - t0);
    loading.value = false;
  }
}

onMounted(() => {
  loadAll();
});
</script>

<template>
  <div class="gold-preview">
    <el-card class="filter-card" shadow="never">
      <template #header>
        <div class="header-row">
          <span class="title">Gold Layer Preview</span>
          <span class="subtitle">Phase B v0 · 直接读 agg_* · 绕过 legacy Java 路径</span>
        </div>
      </template>
      <el-form :inline="true" size="default">
        <el-form-item label="Factory">
          <el-input v-model="factoryId" style="width: 140px" />
        </el-form-item>
        <el-form-item label="开始">
          <el-date-picker v-model="startDate" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="结束">
          <el-date-picker v-model="endDate" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="loadAll">刷新 5 路 Gold 查询</el-button>
          <span v-if="lastLoadMs" class="timing">上次耗时 {{ lastLoadMs }} ms</span>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="16" class="kpi-row">
      <el-col v-if="canViewPrice" :span="6">
        <el-statistic title="总营收" :value="kpi?.revenue ?? 0" :precision="2" :formatter="(v: number) => rmb(v)" />
      </el-col>
      <el-col :span="6">
        <el-statistic title="账单数" :value="kpi?.billCount ?? 0" />
      </el-col>
      <el-col v-if="canViewPrice" :span="6">
        <el-statistic title="客单价" :value="kpi?.avgBillValue ?? 0" :precision="2" :formatter="(v: number) => rmb(v)" />
      </el-col>
      <el-col v-if="canViewPrice" :span="6">
        <el-statistic title="人均消费" :value="kpi?.avgPerCapita ?? 0" :precision="2" :formatter="(v: number) => rmb(v)" />
      </el-col>
    </el-row>

    <el-row :gutter="16" class="kpi-row">
      <el-col :span="6">
        <el-statistic title="商品数/单" :value="kpi?.itemsPerBill ?? 0" :precision="2" />
      </el-col>
      <el-col :span="6">
        <el-statistic title="门店数" :value="kpi?.storeCount ?? 0" />
      </el-col>
      <el-col :span="6">
        <el-statistic title="活跃天数" :value="kpi?.dayCount ?? 0" />
      </el-col>
      <el-col :span="6">
        <el-statistic title="顾客总数" :value="kpi?.customerCount ?? 0" />
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-header">
              <span>门店 Top 5 (finance_summary)</span>
              <span class="meta">{{ finance?.topStores?.length ?? 0 }} rows</span>
            </div>
          </template>
          <el-table :data="finance?.topStores ?? []" size="small" stripe>
            <el-table-column label="门店" prop="storeName" min-width="200" />
            <el-table-column v-if="canViewPrice" label="营收" align="right" width="140">
              <template #default="{ row }">{{ rmb(row.revenue) }}</template>
            </el-table-column>
            <el-table-column label="账单" prop="billCount" align="right" width="90" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-header">
              <span>商品 Top 10 (top_products)</span>
              <span class="meta">{{ products?.topProducts?.length ?? 0 }} rows · {{ products?.startMonth }} — {{ products?.endMonth }}</span>
            </div>
          </template>
          <el-table :data="products?.topProducts ?? []" size="small" stripe max-height="320">
            <el-table-column label="商品" prop="productName" min-width="200" />
            <el-table-column label="销量" prop="qtySold" align="right" width="90" />
            <el-table-column v-if="canViewPrice" label="营收" align="right" width="120">
              <template #default="{ row }">{{ rmb(row.revenue) }}</template>
            </el-table-column>
            <el-table-column label="数据置信度" width="240">
              <template #default="{ row }">
                <TrustIndicator
                  v-if="row.confidence != null"
                  :confidence="row.confidence"
                  :source="row.source ?? ''"
                  :cell-audit-url="cellAuditUrl(row)"
                  @audit="onAudit(row)"
                />
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-header">
              <span>支付渠道 (channel_breakdown)</span>
              <span class="meta">{{ channels?.channels?.length ?? 0 }} rows<span v-if="canViewPrice"> · total {{ rmb(channels?.totalAmount ?? 0) }}</span></span>
            </div>
          </template>
          <el-table :data="channels?.channels ?? []" size="small" stripe max-height="320">
            <el-table-column label="渠道" prop="channelName" min-width="150" />
            <el-table-column v-if="canViewPrice" label="金额" align="right" width="130">
              <template #default="{ row }">{{ rmb(row.amount) }}</template>
            </el-table-column>
            <el-table-column label="占比" align="right" width="80">
              <template #default="{ row }">{{ (row.sharePct ?? 0).toFixed(2) }}%</template>
            </el-table-column>
            <el-table-column label="账单" prop="billCount" align="right" width="80" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-header">
              <span>折扣/代金券 (discount_breakdown)</span>
              <span class="meta">{{ discounts?.discounts?.length ?? 0 }} rows<span v-if="canViewPrice"> · total {{ rmb(discounts?.totalAmount ?? 0) }}</span></span>
            </div>
          </template>
          <el-table :data="discounts?.discounts ?? []" size="small" stripe max-height="320">
            <el-table-column label="折扣类型" prop="discountName" min-width="200" />
            <el-table-column v-if="canViewPrice" label="金额" align="right" width="130">
              <template #default="{ row }">{{ rmb(row.amount) }}</template>
            </el-table-column>
            <el-table-column label="占比" align="right" width="80">
              <template #default="{ row }">{{ (row.sharePct ?? 0).toFixed(2) }}%</template>
            </el-table-column>
            <el-table-column label="账单" prop="billCount" align="right" width="80" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="24">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-header">
              <span>日趋势 (daily_trend)</span>
              <span class="meta">{{ trendSummary.count }} 天 · 日均 {{ rmb(trendSummary.avg) }}</span>
            </div>
          </template>
          <el-table :data="trend?.points ?? []" size="small" stripe max-height="320">
            <el-table-column label="日期" prop="date" width="110" />
            <el-table-column label="营收" align="right" width="140">
              <template #default="{ row }">{{ rmb(row.revenue) }}</template>
            </el-table-column>
            <el-table-column label="账单" prop="billCount" align="right" width="100" />
            <el-table-column label="客单" align="right" width="120">
              <template #default="{ row }">{{ rmb(row.avgBillValue) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.gold-preview {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card .header-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.filter-card .title {
  font-size: 16px;
  font-weight: 600;
}

.filter-card .subtitle {
  font-size: 12px;
  color: #909399;
}

.timing {
  margin-left: 12px;
  color: #909399;
  font-size: 12px;
}

.kpi-row {
  background: #fafafa;
  padding: 12px 16px;
  border-radius: 4px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.panel-header .meta {
  font-size: 12px;
  color: #909399;
}

.panel {
  margin-bottom: 16px;
}

.muted {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
