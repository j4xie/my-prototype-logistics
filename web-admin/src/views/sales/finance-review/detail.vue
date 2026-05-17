<script setup lang="ts">
/**
 * Sprint4-H F-AR-1 — 销售单财务审核详情页 (PC).
 *
 * 业务流程:
 *   - 加载订单 + 成本核算 (FinanceCostBreakdown)
 *   - 展示 BOM 标准成本 / 当前预估成本 / 实际成本 / 预估 vs 实际利润对比
 *   - 财务可选录入 estimatedCost 覆盖现值 → approve
 *   - reject 必填 notes
 *
 * RBAC: v-if="canFinanceWrite" 隐藏 approve/reject 按钮.
 * 后端 @RequirePermission("finance:read_write") 强制 — UI 仅是友好遮挡.
 */
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';
import {
  getOrderDetail,
  getOrderCostBreakdown,
  financeApprove,
  financeReject,
  type SalesOrderSummary,
  type FinanceCostBreakdown,
  type LineCostBreakdown,
} from '@/api/salesFinanceReview';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const permissionStore = usePermissionStore();

const factoryId = computed(() => authStore.factoryId);
const orderId = computed(() => String(route.params.id || ''));

/** 后端 @RequirePermission("finance:read_write") — UI 镜像. */
const canFinanceWrite = computed(() => permissionStore.canWrite('finance'));

const order = ref<SalesOrderSummary | null>(null);
const breakdown = ref<FinanceCostBreakdown | null>(null);
const notes = ref('');
const overrideEstimatedCost = ref<number | null>(null);
const loading = ref(false);
const submitting = ref(false);

const canReview = computed(
  () => order.value?.status === 'PENDING_FINANCE_REVIEW',
);

async function load() {
  if (!factoryId.value || !orderId.value) return;
  loading.value = true;
  try {
    const [orderRes, breakdownRes] = await Promise.all([
      getOrderDetail(factoryId.value, orderId.value),
      getOrderCostBreakdown(factoryId.value, orderId.value),
    ]);
    if (orderRes.success && orderRes.data) order.value = orderRes.data;
    if (breakdownRes.success && breakdownRes.data) {
      breakdown.value = breakdownRes.data;
      // 预填 current estimated cost 到 override 输入框
      if (breakdownRes.data.currentEstimatedCost != null) {
        overrideEstimatedCost.value = breakdownRes.data.currentEstimatedCost;
      }
    }
  } finally {
    loading.value = false;
  }
}

function formatAmount(v: number | null | undefined): string {
  if (v == null) return '-';
  return `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(v: number | null | undefined): string {
  if (v == null) return '-';
  return `${v.toFixed(2)}%`;
}

function profitClass(p: number | null | undefined): string {
  if (p == null) return '';
  if (p > 0) return 'profit-positive';
  if (p < 0) return 'profit-negative';
  return '';
}

function lineRowClassName({ row }: { row: LineCostBreakdown }): string {
  // BOM 标准与实际偏差 > 15% 时标红 (财务关注偏差大的行)
  if (row.bomStandardLineCost != null && row.actualLineCost != null) {
    const std = row.bomStandardLineCost;
    if (std > 0) {
      const dev = Math.abs((row.actualLineCost - std) / std);
      if (dev > 0.15) return 'cost-deviation-row';
    }
  }
  return '';
}

async function handleApprove() {
  try {
    await ElMessageBox.confirm(
      `确认通过销售单 ${order.value?.orderNumber} 的财务审核?`,
      '财务审核通过',
      { type: 'success', confirmButtonText: '确认通过', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  submitting.value = true;
  try {
    const res = await financeApprove(factoryId.value, orderId.value, {
      notes: notes.value || undefined,
      estimatedCost: overrideEstimatedCost.value ?? undefined,
    });
    if (res.success) {
      ElMessage.success('财务审核已通过');
      router.back();
    }
  } finally {
    submitting.value = false;
  }
}

async function handleReject() {
  if (!notes.value.trim()) {
    ElMessage.warning('驳回必须填写备注说明原因');
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确认驳回销售单 ${order.value?.orderNumber}? 备注: ${notes.value}`,
      '财务驳回',
      { type: 'warning', confirmButtonText: '确认驳回', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  submitting.value = true;
  try {
    const res = await financeReject(factoryId.value, orderId.value, notes.value);
    if (res.success) {
      ElMessage.success('已驳回, 订单退回销售员');
      router.back();
    }
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div v-loading="loading" class="finance-review-detail">
    <div class="page-header">
      <el-button :icon="ArrowLeft" link @click="router.back()">返回</el-button>
      <h2 class="title">销售财务审核 · {{ order?.orderNumber || '—' }}</h2>
    </div>

    <!-- 摘要 -->
    <el-card v-if="order" shadow="never" class="summary-card">
      <div class="summary-grid">
        <div>
          <div class="label">订单号</div>
          <div class="value">{{ order.orderNumber }}</div>
        </div>
        <div>
          <div class="label">客户</div>
          <div class="value">{{ order.customerName || order.customerId }}</div>
        </div>
        <div>
          <div class="label">总金额</div>
          <div class="value">{{ formatAmount(order.totalAmount) }}</div>
        </div>
        <div>
          <div class="label">下单日期</div>
          <div class="value">{{ order.orderDate }}</div>
        </div>
        <div>
          <div class="label">业务员</div>
          <div class="value">{{ order.salesperson || '-' }}</div>
        </div>
        <div>
          <div class="label">状态</div>
          <div class="value">
            <el-tag :type="canReview ? 'warning' : 'info'">{{ order.status }}</el-tag>
          </div>
        </div>
      </div>
      <el-alert
        v-if="!canReview"
        type="info"
        :closable="false"
        :title="`仅 PENDING_FINANCE_REVIEW 状态可审核 (当前: ${order.status})`"
        style="margin-top: 12px"
      />
    </el-card>

    <!-- 成本核算汇总 -->
    <el-card v-if="breakdown" shadow="never" class="summary-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">成本核算</span>
          <span v-if="breakdown.dataSourceHint" class="card-subtitle">
            {{ breakdown.dataSourceHint }}
          </span>
        </div>
      </template>
      <div class="cost-grid">
        <div class="cost-cell">
          <div class="label">订单总额</div>
          <div class="value-lg">{{ formatAmount(breakdown.totalAmount) }}</div>
        </div>
        <div class="cost-cell">
          <div class="label">BOM 标准成本</div>
          <div class="value-lg">{{ formatAmount(breakdown.bomStandardCost) }}</div>
        </div>
        <div class="cost-cell">
          <div class="label">当前预估成本</div>
          <div class="value-lg">{{ formatAmount(breakdown.currentEstimatedCost) }}</div>
        </div>
        <div class="cost-cell">
          <div class="label">实际成本</div>
          <div class="value-lg">{{ formatAmount(breakdown.actualCost) }}</div>
        </div>
        <div class="cost-cell">
          <div class="label">预估利润</div>
          <div :class="['value-lg', profitClass(breakdown.currentEstimatedProfit)]">
            {{ formatAmount(breakdown.currentEstimatedProfit) }}
            <span class="margin-pct">({{ formatPercent(breakdown.profitMarginEstimated) }})</span>
          </div>
        </div>
        <div class="cost-cell">
          <div class="label">实际利润</div>
          <div :class="['value-lg', profitClass(breakdown.actualProfit)]">
            {{ formatAmount(breakdown.actualProfit) }}
            <span class="margin-pct">({{ formatPercent(breakdown.profitMarginActual) }})</span>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 行级成本明细 -->
    <el-card v-if="breakdown && breakdown.lines.length > 0" shadow="never" class="comparison-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">行级成本明细</span>
          <span class="card-subtitle">{{ breakdown.lines.length }} 项</span>
        </div>
      </template>
      <el-table
        :data="breakdown.lines"
        :row-class-name="lineRowClassName"
        stripe
        empty-text="无明细"
      >
        <el-table-column prop="productName" label="产品" min-width="180">
          <template #default="{ row }">
            {{ row.productName || row.productId || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="数量" align="right" min-width="100">
          <template #default="{ row }">{{ row.quantity ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="销售单价" align="right" min-width="120">
          <template #default="{ row }">{{ formatAmount(row.unitPrice) }}</template>
        </el-table-column>
        <el-table-column label="销售小计" align="right" min-width="130">
          <template #default="{ row }">{{ formatAmount(row.lineAmount) }}</template>
        </el-table-column>
        <el-table-column label="BOM 标准单位成本" align="right" min-width="150">
          <template #default="{ row }">{{ formatAmount(row.bomStandardUnitCost) }}</template>
        </el-table-column>
        <el-table-column label="BOM 标准行成本" align="right" min-width="150">
          <template #default="{ row }">{{ formatAmount(row.bomStandardLineCost) }}</template>
        </el-table-column>
        <el-table-column label="实际行成本" align="right" min-width="130">
          <template #default="{ row }">{{ formatAmount(row.actualLineCost) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 审核操作 -->
    <el-card v-if="canReview && canFinanceWrite" shadow="never" class="action-card">
      <template #header>
        <span class="card-title">审核意见</span>
      </template>
      <el-form label-position="top">
        <el-form-item label="预估成本 (财务核定, 覆盖系统当前值)">
          <el-input-number
            v-model="overrideEstimatedCost"
            :min="0"
            :precision="2"
            :step="100"
            placeholder="留空则保持当前值不变"
            style="width: 240px"
            :disabled="submitting"
          />
        </el-form-item>
        <el-form-item label="审核备注 (驳回必填, 通过可选)">
          <el-input
            v-model="notes"
            type="textarea"
            :rows="3"
            placeholder="驳回必填, 通过可选"
            maxlength="500"
            show-word-limit
            :disabled="submitting"
          />
        </el-form-item>
      </el-form>
      <div class="action-row">
        <el-button
          plain
          type="danger"
          :loading="submitting"
          @click="handleReject"
        >
          驳回
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="handleApprove"
        >
          通过
        </el-button>
      </div>
    </el-card>

    <!-- 非审核状态: 显示历史审核 -->
    <el-card
      v-if="!canReview && order?.financeReviewNotes"
      shadow="never"
      class="action-card"
    >
      <template #header>
        <span class="card-title">历史审核意见</span>
      </template>
      <p class="history-notes">{{ order.financeReviewNotes }}</p>
      <p v-if="order.financeReviewedAt" class="history-meta">
        审核于 {{ order.financeReviewedAt }}
      </p>
    </el-card>

    <!-- 非审核可见但当前角色无权写: 提示 -->
    <el-alert
      v-if="canReview && !canFinanceWrite"
      type="warning"
      :closable="false"
      title="当前角色无财务写权限, 仅可查看"
      description="approve/reject 需要 finance:read_write (后端 @RequirePermission 强制)"
      style="margin-top: 12px"
    />
  </div>
</template>

<style scoped>
.finance-review-detail {
  padding: 20px;
}
.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.page-header .title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: #303133;
}
.summary-card,
.comparison-card,
.action-card {
  margin-bottom: 16px;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}
.cost-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
.cost-cell {
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
}
.summary-grid .label,
.cost-cell .label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.summary-grid .value {
  font-size: 15px;
  color: #303133;
  font-weight: 500;
}
.value-lg {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}
.margin-pct {
  font-size: 13px;
  font-weight: 400;
  color: #909399;
  margin-left: 6px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.card-subtitle {
  font-size: 12px;
  color: #909399;
}
.action-row {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
.history-notes {
  margin: 0;
  color: #303133;
  white-space: pre-wrap;
}
.history-meta {
  margin: 8px 0 0;
  font-size: 12px;
  color: #909399;
}
.profit-positive {
  color: #67c23a;
}
.profit-negative {
  color: #c62828;
}
:deep(.cost-deviation-row) {
  background-color: #fff7e6 !important;
}
:deep(.cost-deviation-row td) {
  background-color: #fff7e6 !important;
}
</style>
