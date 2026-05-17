<script setup lang="ts">
/**
 * Sprint4-H F-AR-1 — 财务待审销售单列表 (PC).
 *
 * 流程: 销售员 submitForFinanceReview → 状态进 PENDING_FINANCE_REVIEW →
 *       财务进本列表点详情 → 查看成本核算 → approve/reject.
 *
 * RBAC:
 *   - 显示: 进入页即可 (路由 module: 'finance')
 *   - 操作 (approve/reject): detail.vue 的 v-if="canFinanceWrite" 控制,
 *     最终由后端 @RequirePermission("finance:read_write") 强制
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { ElMessage } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import {
  listPendingFinanceReview,
  type SalesOrderSummary,
} from '@/api/salesFinanceReview';

const router = useRouter();
const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

const loading = ref(false);
const rows = ref<SalesOrderSummary[]>([]);
const pagination = ref({ page: 1, size: 20, total: 0 });

async function load() {
  if (!factoryId.value) {
    ElMessage.warning('未登录或缺少工厂上下文');
    return;
  }
  loading.value = true;
  try {
    const res = await listPendingFinanceReview(factoryId.value, {
      page: pagination.value.page,
      size: pagination.value.size,
    });
    if (res.success && res.data) {
      rows.value = res.data.content;
      pagination.value.total = res.data.totalElements;
    } else {
      rows.value = [];
      pagination.value.total = 0;
    }
  } finally {
    loading.value = false;
  }
}

function goDetail(row: SalesOrderSummary) {
  router.push({ name: 'SalesOrderFinanceReviewDetail', params: { id: row.id } });
}

function handlePageChange(page: number) {
  pagination.value.page = page;
  load();
}

function formatAmount(v: number | null | undefined): string {
  if (v == null) return '-';
  return `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

onMounted(load);
</script>

<template>
  <div class="finance-review-list">
    <div class="page-header">
      <div>
        <h2 class="title">财务待审销售单</h2>
        <p class="subtitle">销售员提交财务审核 — 待财务复核成本与利润</p>
      </div>
      <div class="actions">
        <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="rows"
      stripe
      style="width: 100%"
      empty-text="暂无待审销售单"
      @row-click="goDetail"
    >
      <el-table-column prop="orderNumber" label="订单号" min-width="180" />
      <el-table-column prop="customerName" label="客户" min-width="180">
        <template #default="{ row }">
          {{ row.customerName || row.customerId }}
        </template>
      </el-table-column>
      <el-table-column prop="totalAmount" label="总金额" min-width="140" align="right">
        <template #default="{ row }">
          {{ formatAmount(row.totalAmount) }}
        </template>
      </el-table-column>
      <el-table-column prop="orderDate" label="下单日期" min-width="120" />
      <el-table-column prop="salesperson" label="业务员" min-width="120">
        <template #default="{ row }">
          {{ row.salesperson || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="状态" min-width="120">
        <template #default>
          <el-tag type="warning" effect="light">待财审</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click.stop="goDetail(row)">审核</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-if="pagination.total > 0"
      class="pagination"
      :current-page="pagination.page"
      :page-size="pagination.size"
      :total="pagination.total"
      layout="total, prev, pager, next, jumper"
      background
      @current-change="handlePageChange"
    />
  </div>
</template>

<style scoped>
.finance-review-list {
  padding: 20px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.page-header .title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 4px;
  color: #303133;
}
.page-header .subtitle {
  font-size: 13px;
  color: #909399;
  margin: 0;
}
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
:deep(.el-table__row) {
  cursor: pointer;
}
</style>
