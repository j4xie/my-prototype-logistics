<script setup lang="ts">
/**
 * Issue #761 (P3 follow-up #752): 成品库存批次详情页.
 *
 * PR #756 把 list.vue 的 view-detail dead-stub 接成 ElMessageBox.alert,
 * 客户反馈仍想要独立 detail route. 本页提供:
 *   - 基础字段 (batchNumber / product / 数量 / 库位 / 日期)
 *   - 价格信息 (canViewPrice 网控)
 *   - 价格历史 占位 table (后端 /price-history endpoint 待接, P3 follow-up)
 *
 * 后端 endpoint: GET /api/mobile/{factoryId}/sales/finished-goods/{batchId} 待补.
 * 当前 fallback: list 列表已有的全部字段都通过 router.push 的 state 或 batch
 *               GET /sales/finished-goods?keyword=batchNumber 来取.
 */
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import { ArrowLeft, Refresh } from '@element-plus/icons-vue';
import { formatAmount } from '@/utils/tableFormatters';
import type { TableRow } from '@/types/api';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();

const factoryId = computed(() => authStore.factoryId);
const batchId = computed(() => String(route.params.id || ''));
const canViewPrice = computed(() => permissionStore.canViewPrice);

const loading = ref(false);
const batch = ref<TableRow | null>(null);
// Issue #761 价格历史 — 后端 endpoint 待接, 当前 fallback 显示 batch 自身的 unitPrice
const priceHistory = ref<Array<{ date: string; price: number; source: string }>>([]);
const priceHistoryLoading = ref(false);

onMounted(() => {
  loadBatch();
});

async function loadBatch() {
  if (!factoryId.value || !batchId.value) return;
  loading.value = true;
  try {
    // 后端尚无 /finished-goods/{id} 独立 detail endpoint
    // (per SalesController.java 仅 listFinishedGoods + getAvailableBatches).
    // 临时方案: 拉列表 + 客户端 filter — TODO 后端补 GET /finished-goods/{id} 后改单查.
    const res = await get(`/${factoryId.value}/sales/finished-goods`, {
      params: { page: 1, size: 200 },
    });
    if (res.success && res.data) {
      const all = (res.data.content || []) as TableRow[];
      batch.value = all.find((r) => String(r.id || '') === batchId.value) || null;
      if (!batch.value) {
        ElMessage.warning('未找到该成品批次 (可能已被删除)');
      } else {
        // Seed price-history with at least current entry
        seedPriceHistory();
      }
    }
  } catch {
    /* interceptor */
  } finally {
    loading.value = false;
  }
}

function seedPriceHistory() {
  if (!batch.value) return;
  const cur = batch.value.unitPrice;
  if (cur != null) {
    priceHistory.value = [
      {
        date: String(batch.value.productionDate || batch.value.createdAt || ''),
        price: Number(cur),
        source: '当前成本单价',
      },
    ];
  } else {
    priceHistory.value = [];
  }
}

function goBack() {
  router.push('/sales/finished-goods');
}

function availableQty(row: TableRow) {
  return (
    (Number(row.producedQuantity) || 0) -
    (Number(row.shippedQuantity) || 0) -
    (Number(row.reservedQuantity) || 0)
  );
}

function statusType(row: TableRow): 'success' | 'warning' | 'danger' {
  const avail = availableQty(row);
  if (avail <= 0) return 'danger';
  if (avail < (Number(row.producedQuantity) || 1) * 0.2) return 'warning';
  return 'success';
}

function statusText(row: TableRow): string {
  const avail = availableQty(row);
  if (avail <= 0) return '已售罄';
  if (avail < (Number(row.producedQuantity) || 1) * 0.2) return '库存低';
  return '充足';
}
</script>

<template>
  <div class="page-wrapper" v-loading="loading">
    <el-card v-if="!loading && !batch" shadow="never">
      <el-empty description="成品批次数据不存在">
        <el-button @click="goBack">返回列表</el-button>
      </el-empty>
    </el-card>

    <template v-if="batch">
      <div class="detail-header">
        <div class="header-left">
          <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
          <h2 class="page-title">{{ batch.batchNumber || batch.id }}</h2>
          <el-tag :type="statusType(batch)" size="large">{{ statusText(batch) }}</el-tag>
        </div>
        <el-button :icon="Refresh" @click="loadBatch">刷新</el-button>
      </div>

      <!-- 基础信息 -->
      <el-card class="section-card" shadow="never">
        <template #header>
          <span class="section-title">基本信息</span>
        </template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="批次号">{{ batch.batchNumber || '-' }}</el-descriptions-item>
          <el-descriptions-item label="产品">
            {{ batch.productName || batch.productType?.name || batch.productTypeId || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="生产数量">
            {{ batch.producedQuantity ?? '-' }} {{ batch.unit || '' }}
          </el-descriptions-item>
          <el-descriptions-item label="已发货">
            {{ batch.shippedQuantity ?? 0 }} {{ batch.unit || '' }}
          </el-descriptions-item>
          <el-descriptions-item label="已预留">
            {{ batch.reservedQuantity ?? 0 }} {{ batch.unit || '' }}
          </el-descriptions-item>
          <el-descriptions-item label="可用库存">
            <span :style="{ fontWeight: 600, color: availableQty(batch) <= 0 ? '#f56c6c' : '#303133' }">
              {{ availableQty(batch) }} {{ batch.unit || '' }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="生产日期">{{ batch.productionDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="过期日期">{{ batch.expireDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="库位">{{ batch.storageLocation || '-' }}</el-descriptions-item>
          <el-descriptions-item v-if="canViewPrice" label="成本单价">
            {{ batch.unitPrice != null ? formatAmount(batch.unitPrice) : '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 价格历史 (canViewPrice gated) -->
      <el-card v-if="canViewPrice" class="section-card" shadow="never">
        <template #header>
          <div class="section-header">
            <span class="section-title">价格历史</span>
            <el-tag size="small" type="info">{{ priceHistory.length }} 条</el-tag>
          </div>
        </template>
        <el-alert
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 12px"
          title="价格历史 API 待接"
          description="当前只显示批次记录的单价。完整价格变更轨迹 (生产记账 / 调价 / 退货返还) 接 /finance/price-history/{batchId} 后呈现。"
        />
        <el-table
          v-loading="priceHistoryLoading"
          :data="priceHistory"
          empty-text="暂无价格历史"
          stripe
          border
          size="small"
          style="width: 100%"
        >
          <el-table-column prop="date" label="日期" width="160" />
          <el-table-column label="价格" width="140" align="right">
            <template #default="{ row }">{{ formatAmount(row.price) }}</template>
          </el-table-column>
          <el-table-column prop="source" label="来源" min-width="160" />
        </el-table>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.page-wrapper {
  padding: 16px 20px;
}
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.page-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #303133;
}
.section-card {
  margin-bottom: 16px;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
