<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { useBusinessMode } from '@/composables/useBusinessMode';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const { label } = useBusinessMode();
const factoryId = computed(() => authStore.factoryId);

const loading = ref(false);
const tableData = ref<any[]>([]);
const pagination = ref({ page: 1, size: 10, total: 0 });

onMounted(() => loadData());

async function loadData() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const res = await get(`/${factoryId.value}/sales/finished-goods`, {
      params: { page: pagination.value.page, size: pagination.value.size },
    });
    if (res.success && res.data) {
      tableData.value = res.data.content || [];
      pagination.value.total = res.data.totalElements || 0;
    }
  } catch { ElMessage.error('加载失败'); }
  finally { loading.value = false; }
}

function handlePageChange(page: number) { pagination.value.page = page; loadData(); }
function handleSizeChange(size: number) { pagination.value.size = size; pagination.value.page = 1; loadData(); }

function availableQty(row: any) {
  return (row.producedQuantity || 0) - (row.shippedQuantity || 0) - (row.reservedQuantity || 0);
}

function statusType(row: any) {
  const avail = availableQty(row);
  if (avail <= 0) return 'danger';
  if (avail < (row.producedQuantity || 1) * 0.2) return 'warning';
  return 'success';
}

function formatAmount(val: number) {
  if (val == null) return '-';
  return `¥${Number(val).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
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
            <el-button :icon="Refresh" @click="loadData">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%">
        <el-table-column prop="batchNumber" label="批次号" width="170" />
        <el-table-column label="产品" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.productType?.name || row.productTypeId || '-' }}</template>
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
        <el-table-column prop="unitPrice" label="成本单价" width="110" align="right">
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
