<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { useBusinessMode } from '@/composables/useBusinessMode';
import { get } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, Search } from '@element-plus/icons-vue';
import { formatAmount } from '@/utils/tableFormatters';
import type { TableRow } from '@/types/api';
import { RowActionMenu } from '@/components/list';
import { computeRowActions } from '@/composables/useRowActions';

const router = useRouter();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const { label } = useBusinessMode();
const factoryId = computed(() => authStore.factoryId);
const canViewPrice = computed(() => permissionStore.canViewPrice);

function deriveStockStatus(row: TableRow): string {
  const available = Number((row as any).availableQuantity ?? (row as any).producedQuantity ?? 0);
  const total = Number((row as any).producedQuantity ?? 1);
  if (available <= 0) return 'OUT_OF_STOCK';
  if (available < total * 0.2) return 'LOW_STOCK';
  return 'IN_STOCK';
}
function rowActionsFor(row: TableRow) {
  return computeRowActions(
    'inventory',
    { status: deriveStockStatus(row), id: String(row.id || '') },
    { canViewPrice: canViewPrice.value }
  );
}

// Issue #752 / #761 follow-up: view-detail 之前用 ElMessageBox.alert 占位,
// 现在跳独立 detail route (views/sales/finished-goods/detail.vue, router.name=SalesFinishedGoodsDetail).
// view-price-history 仍是 modal (后端 /finance/price-history endpoint 待接) — 显示批次单价 + 占位提示.
async function handleRowActionClick(actionId: string, row: TableRow): Promise<void> {
  const batchLabel = row.batchNumber || row.id || '-';
  switch (actionId) {
    case 'view-detail': {
      // Issue #761: 跳独立 detail route, 不再用 ElMessageBox 占位.
      router.push({
        name: 'SalesFinishedGoodsDetail',
        params: { id: String(row.id || '') },
      });
      break;
    }
    case 'transfer': {
      // Issue #749: 调拨工作流未配置时弹 confirm → 跳工作流设计器, 不再 dead-end toast.
      try {
        await ElMessageBox.confirm(
          `批次 ${batchLabel} 的调拨工作流尚未配置. 是否前去工作流设计器配置 TRANSFER 流程?`,
          '调拨工作流未配置',
          { confirmButtonText: '去配置', cancelButtonText: '取消', type: 'info' }
        );
        router.push({ path: '/system/workflow-designer', query: { entityType: 'TRANSFER' } });
      } catch {
        // user cancel — no-op
      }
      break;
    }
    case 'view-price-history': {
      // Issue #761: 价格历史 — Modal 展示当前单价 + 跳 detail 看完整历史.
      // 后端 /finance/price-history/{batchId} endpoint 待补; detail.vue 内 placeholder table.
      try {
        await ElMessageBox.confirm(
          `批次 ${batchLabel} 当前成本单价: ${row.unitPrice ?? '-'}\n\n完整价格历史 (生产记账/调价/退货) 待接 价格历史 API. 是否打开批次详情?`,
          '价格历史',
          { confirmButtonText: '打开详情', cancelButtonText: '关闭', type: 'info' }
        );
        router.push({
          name: 'SalesFinishedGoodsDetail',
          params: { id: String(row.id || '') },
        });
      } catch {
        // user closed dialog — no-op
      }
      break;
    }
    default:
      ElMessage.info(`Action: ${actionId}`);
  }
}
function openAiForRow(row: TableRow) {
  ElMessage.info(`AIChat: inventory/${row.batchNumber || row.id} — 接 AiEntryDrawer 待 Day 9`);
}

const loading = ref(false);
const tableData = ref<TableRow[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });
const searchKeyword = ref('');

onMounted(() => loadData());

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const params: TableRow = {
      page: pagination.value.page,
      size: pagination.value.size,
    };
    const kw = searchKeyword.value.trim();
    if (kw) params.keyword = kw;
    const res = await get(`/${factoryId.value}/sales/finished-goods`, { params });
    if (res.success && res.data) {
      tableData.value = res.data.content || [];
      pagination.value.total = res.data.totalElements || 0;
    } else if (res.success === false) {
      ElMessage.error(res.message || '加载成品数据失败');
    }
  } catch { /* axios interceptor already displayed error toast */ }
  finally { loading.value = false; }
}

function handlePageChange(page: number) { pagination.value.page = page; loadData(); }
function handleSizeChange(size: number) { pagination.value.size = size; pagination.value.page = 1; loadData(); }
function handleSearch() { pagination.value.page = 1; loadData(); }
function handleSearchClear() { searchKeyword.value = ''; handleSearch(); }

function availableQty(row: TableRow) {
  return (row.producedQuantity || 0) - (row.shippedQuantity || 0) - (row.reservedQuantity || 0);
}

function statusType(row: TableRow) {
  const avail = availableQty(row);
  if (avail <= 0) return 'danger';
  if (avail < (row.producedQuantity || 1) * 0.2) return 'warning';
  return 'success';
}
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">{{ label('finishedGoods') }}</span>
            <span class="data-count">共 {{ pagination.total }} 批</span>
          </div>
          <div class="header-right">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索批次号 / 产品名"
              clearable
              :prefix-icon="Search"
              style="width: 240px; margin-right: 12px;"
              @keyup.enter="handleSearch"
              @clear="handleSearchClear"
            />
            <el-button type="primary" @click="handleSearch">搜索</el-button>
            <el-button :icon="Refresh" @click="loadData">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" empty-text="暂无数据" stripe border style="width: 100%">
        <el-table-column prop="batchNumber" label="批次号" width="170" />
        <el-table-column label="产品" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.productName || row.productType?.name || row.productTypeId || '-' }}</template>
        </el-table-column>
        <el-table-column prop="producedQuantity" label="生产数量" width="110" align="right" />
        <el-table-column prop="shippedQuantity" label="已发货" width="100" align="right" />
        <el-table-column prop="reservedQuantity" label="已预留" width="100" align="right" />
        <el-table-column label="可用库存" width="110" align="right">
          <template #default="{ row }">
            <span :style="{ color: availableQty(row) <= 0 ? '#f56c6c' : '#303133', fontWeight: 600 }">
              {{ availableQty(row) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="unit" label="单位" width="70" align="center" />
        <el-table-column v-if="canViewPrice" prop="unitPrice" label="成本单价" width="110" align="right">
          <template #default="{ row }">{{ formatAmount(row.unitPrice) }}</template>
        </el-table-column>
        <el-table-column prop="productionDate" label="生产日期" width="120" />
        <el-table-column prop="expireDate" label="过期日期" width="120" />
        <el-table-column prop="storageLocation" label="库位" width="120" />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row)" size="small">
              {{ availableQty(row) <= 0 ? '已售罄' : availableQty(row) < (row.producedQuantity || 1) * 0.2 ? '库存低' : '充足' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center" fixed="right">
          <template #default="{ row }">
            <RowActionMenu
              :actions="rowActionsFor(row)"
              button-label="操作"
              @action-click="(id: string) => handleRowActionClick(id, row)"
              @ai-trigger="() => openAiForRow(row)"
            />
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.size"
          :page-sizes="[10, 20, 50]" :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange" @size-change="handleSizeChange" />
      </div>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.page-wrapper { height: 100%; width: 100%; display: flex; flex-direction: column; }
.page-card { flex: 1; display: flex; flex-direction: column;
  :deep(.el-card__header) { padding: 16px 20px; border-bottom: 1px solid #ebeef5; }
  :deep(.el-card__body) { flex: 1; display: flex; flex-direction: column; padding: 20px; }
}
.card-header { display: flex; justify-content: space-between; align-items: center;
  .header-left { display: flex; align-items: baseline; gap: 12px;
    .page-title { font-size: 16px; font-weight: 600; color: #303133; }
    .data-count { font-size: 13px; color: #909399; }
  }
}
.pagination-wrapper { display: flex; justify-content: flex-end; padding-top: 16px; border-top: 1px solid #ebeef5; margin-top: 16px; }
</style>
