<script setup lang="ts">
/**
 * P1 #23 S-CREDIT-1 — 客户信用状态面板 (2026-05-17).
 *
 * 防呆设计:
 *   R1 (边界): 顶部 KPI 显示信用额度 / 已用 / 可用 + 进度条 + 色阶
 *   R2 (context): 卡片标题带 customerName
 *   R5 (CTA): SUSPENDED 状态显示 "联系销售管理员解除" CTA
 *
 * 用法: 在客户详情/编辑 dialog 中 mount, 自动 fetch GET /credit-status
 */
import { ref, computed, watch, onMounted } from 'vue';
import { get } from '@/api/request';
import { Warning, CircleClose, CircleCheck } from '@element-plus/icons-vue';
import { useAuthStore } from '@/store/modules/auth';

interface CreditStatusDTO {
  customerId: string;
  customerName: string;
  creditLimit: number | null;
  used: number;
  available: number | null;
  requestedAmount: number;
  exceeds: boolean;
  utilizationRate: number;
  creditStatus: 'NORMAL' | 'WARNING' | 'SUSPENDED';
  creditPeriodDays: number | null;
  suggestedAction: string;
  severity: 'green' | 'yellow' | 'red';
}

const props = defineProps<{
  customerId: string;
  requestedAmount?: number;
}>();

const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

const loading = ref(false);
const data = ref<CreditStatusDTO | null>(null);
const error = ref<string>('');

async function loadCreditStatus() {
  if (!factoryId.value || !props.customerId) return;
  loading.value = true;
  error.value = '';
  try {
    const params: Record<string, number> = {};
    if (props.requestedAmount && props.requestedAmount > 0) {
      params.requestedAmount = props.requestedAmount;
    }
    const res = await get(
      `/${factoryId.value}/customers/${props.customerId}/credit-status`,
      { params }
    );
    if (res.success && res.data) {
      data.value = res.data as CreditStatusDTO;
    } else {
      error.value = res.message || '信用信息加载失败';
    }
  } catch (e) {
    const err = e as { message?: string };
    error.value = err?.message || '信用信息加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(loadCreditStatus);

watch(
  () => [props.customerId, props.requestedAmount],
  loadCreditStatus
);

// R1: severity 颜色映射 (green/yellow/red)
const severityColor = computed(() => {
  if (!data.value) return '#909399';
  switch (data.value.severity) {
    case 'green': return '#67c23a';
    case 'yellow': return '#e6a23c';
    case 'red': return '#f56c6c';
    default: return '#909399';
  }
});

const severityIcon = computed(() => {
  if (!data.value) return CircleCheck;
  switch (data.value.severity) {
    case 'green': return CircleCheck;
    case 'yellow': return Warning;
    case 'red': return CircleClose;
    default: return CircleCheck;
  }
});

// 进度条百分比 (utilizationRate 是 0~1, 显示 0~100)
const utilizationPct = computed(() => {
  if (!data.value) return 0;
  return Math.min(100, Math.round(data.value.utilizationRate * 100));
});

const statusLabel = computed(() => {
  if (!data.value) return '';
  switch (data.value.creditStatus) {
    case 'NORMAL': return '正常';
    case 'WARNING': return '预警';
    case 'SUSPENDED': return '已冻结';
    default: return data.value.creditStatus;
  }
});

const statusTagType = computed(() => {
  if (!data.value) return 'info';
  switch (data.value.creditStatus) {
    case 'NORMAL': return 'success';
    case 'WARNING': return 'warning';
    case 'SUSPENDED': return 'danger';
    default: return 'info';
  }
});

function formatMoney(v: number | null): string {
  if (v === null || v === undefined) return '无限制';
  return '¥' + v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
</script>

<template>
  <div class="credit-panel" v-loading="loading">
    <div v-if="error" class="credit-error">
      <el-icon><CircleClose /></el-icon>
      <span>{{ error }}</span>
    </div>
    <div v-else-if="data" class="credit-content">
      <!-- 标题 + 状态 tag -->
      <div class="credit-header">
        <span class="credit-title">信用管理</span>
        <el-tag :type="statusTagType" size="small">{{ statusLabel }}</el-tag>
        <span class="credit-period">账期: {{ data.creditPeriodDays ?? '-' }} 天</span>
      </div>

      <!-- R1: KPI 横排 -->
      <div class="credit-kpi-row">
        <div class="credit-kpi">
          <div class="credit-kpi-label">信用额度</div>
          <div class="credit-kpi-value">{{ formatMoney(data.creditLimit) }}</div>
        </div>
        <div class="credit-kpi">
          <div class="credit-kpi-label">已用</div>
          <div class="credit-kpi-value">{{ formatMoney(data.used) }}</div>
        </div>
        <div class="credit-kpi">
          <div class="credit-kpi-label">可用</div>
          <div class="credit-kpi-value" :style="{ color: severityColor }">
            {{ formatMoney(data.available) }}
          </div>
        </div>
      </div>

      <!-- R1: 进度条 -->
      <div v-if="data.creditLimit !== null" class="credit-progress">
        <el-progress
          :percentage="utilizationPct"
          :color="severityColor"
          :stroke-width="10"
          :show-text="true"
          :format="(p: number) => `已用 ${p}%`"
        />
      </div>

      <!-- R2 + R5: action hint with 客户名称 context -->
      <div class="credit-hint" :style="{ color: severityColor }">
        <el-icon><component :is="severityIcon" /></el-icon>
        <span>{{ data.suggestedAction }}</span>
      </div>

      <!-- R5: SUSPENDED 状态 CTA -->
      <div v-if="data.creditStatus === 'SUSPENDED'" class="credit-cta">
        <el-button type="danger" size="small" plain disabled>
          需销售管理员在客户编辑中解除冻结
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.credit-panel {
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 6px;
  padding: 14px 16px;
  margin-bottom: 12px;
  min-height: 60px;
}

.credit-error {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-color-warning, #e6a23c);
  font-size: 13px;
}

.credit-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;

  .credit-title {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-color-primary, #303133);
  }

  .credit-period {
    margin-left: auto;
    font-size: 12px;
    color: var(--text-color-secondary, #909399);
  }
}

.credit-kpi-row {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
}

.credit-kpi {
  flex: 1;

  .credit-kpi-label {
    font-size: 12px;
    color: var(--text-color-secondary, #909399);
    margin-bottom: 4px;
  }

  .credit-kpi-value {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color-primary, #303133);
  }
}

.credit-progress {
  margin-bottom: 10px;
}

.credit-hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  line-height: 1.5;
}

.credit-cta {
  margin-top: 8px;
}
</style>
