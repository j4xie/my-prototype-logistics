<script setup lang="ts">
/**
 * 税率分组开票对话框 — G1 演示杀手锏
 *
 * 客户原话 (Apr 7 会议 2645-2660s):
 *   "开票的话,我们是 9 个点的原料 + 13 个点的加工费,
 *    系统自动按税率分组聚合,一键生成两张发票"
 *
 * 调用后端: POST /api/mobile/{factoryId}/finance/invoices/request-from-order
 * 响应 data.taxBreakdown: [{taxRate, taxableAmount, taxAmount, lineCount}]
 */
import { ref, computed, watch } from 'vue';
import { usePermissionStore } from '@/store/modules/permission';
import { post } from '@/api/request';
import { ElMessage, ElMessageBox } from 'element-plus';
// Sprint 4 W2 S-INVOICE-CLIENT-1 — 防呆 R3 dropdown + R1 default preview
import { INVOICE_TYPE_OPTIONS, getInvoiceTypeOption, type InvoiceTypeValue } from '@/constants/customerEnums';

const permissionStore = usePermissionStore();
const canViewPrice = computed(() => permissionStore.canViewPrice);

interface TaxBreakdownEntry {
  taxRate: number | string;
  taxableAmount: number | string;
  taxAmount: number | string;
  lineCount: number;
}

interface InvoiceRecord {
  id?: string;
  invoiceNumber?: string;
  salesOrderId?: string;
  amount?: number | string;
  taxAmount?: number | string;
  totalAmount?: number | string;
  taxBreakdown?: TaxBreakdownEntry[];
}

const props = defineProps<{
  modelValue: boolean;
  factoryId: string;
  salesOrderId: string;
  orderNumber?: string;
  customerName?: string;
  orderTotalAmount?: number | string;
  /** Sprint 4 W2 S-INVOICE-CLIENT-1: SO 行带来的 defaultInvoiceType (后端已 prefill 自 customer).
   *  用于 R1 — dialog 打开即显默认值, 用户可改可保留. */
  defaultInvoiceType?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'success'): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const loading = ref(false);
const issued = ref(false);
const record = ref<InvoiceRecord | null>(null);
const errorMsg = ref('');
// Sprint 4 W2 S-INVOICE-CLIENT-1 — R3 dropdown 状态. 默认值来自 SO/customer, 用户可改。
const selectedInvoiceType = ref<InvoiceTypeValue>('NORMAL');
const defaultSource = computed(() => props.defaultInvoiceType
  ? `单据/客户默认: ${getInvoiceTypeOption(props.defaultInvoiceType)?.label || props.defaultInvoiceType}`
  : '系统默认: 普通发票 (客户未设默认)');

const breakdown = computed<TaxBreakdownEntry[]>(
  () => record.value?.taxBreakdown || [],
);

function fmt(v: number | string | undefined): string {
  if (v === undefined || v === null || v === '') return '0.00';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return '0.00';
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtRate(v: number | string | undefined): string {
  if (v === undefined || v === null || v === '') return '0%';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return '0%';
  return `${n}%`;
}

function rateLabel(rate: number | string | undefined): string {
  const n = typeof rate === 'string' ? parseFloat(rate) : (rate ?? 0);
  if (n === 9) return '原料';
  if (n === 13) return '加工费';
  if (n === 6) return '服务费';
  return '其他';
}

function rateColor(rate: number | string | undefined): string {
  const n = typeof rate === 'string' ? parseFloat(rate) : (rate ?? 0);
  if (n === 9) return '#67C23A';
  if (n === 13) return '#409EFF';
  return '#909399';
}

async function generateInvoices() {
  loading.value = true;
  errorMsg.value = '';
  try {
    const res = await post<InvoiceRecord>(
      `/${props.factoryId}/finance/invoices/request-from-order`,
      {
        salesOrderId: props.salesOrderId,
        // Sprint 4 W2 S-INVOICE-CLIENT-1: dropdown 选中值, 后端 resolveInvoiceType 仍会做 fallback
        invoiceType: selectedInvoiceType.value,
        remark: `税率分组开票 — 订单 ${props.orderNumber || props.salesOrderId}`,
      },
    );
    if (res.success && res.data) {
      record.value = res.data;
      issued.value = true;
      const count = (res.data.taxBreakdown || []).length;
      ElMessage.success(
        count > 0
          ? `已按税率生成 ${count} 组开票明细`
          : '开票申请已提交',
      );
      emit('success');
    } else {
      errorMsg.value = res.message || '开票失败';
      ElMessage.error(errorMsg.value);
    }
  } catch (e) {
    // 防呆 R4 — 409 duplicate (backend Bug #2 dedup): 给用户 ElMessageBox 而非干瘪 toast.
    // 后端 BusinessException 已含 actionHint, 全局 interceptor 已 sticky toast; 此处只补 dialog 关闭逻辑.
    const err = e as { status?: number; message?: string; actionHint?: string | null };
    if (err?.status === 409) {
      try {
        await ElMessageBox.confirm(
          err.message || '该销售订单已有待处理开票申请',
          '开票申请已存在',
          {
            type: 'warning',
            confirmButtonText: '前往开票申请页查看',
            cancelButtonText: '关闭',
          },
        );
        // 用户确认 → close 此 dialog (实际跳转由父组件或全局 actionHint 处理)
        visible.value = false;
      } catch { /* user cancelled — keep dialog */ }
    }
    errorMsg.value = err?.message || '开票失败';
    // Interceptor already shows sticky toast; avoid double-toast.
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  visible.value = false;
}

// 重置 + S-INVOICE-CLIENT-1 prefill invoiceType from prop on open
watch(visible, (v) => {
  if (v) {
    issued.value = false;
    record.value = null;
    errorMsg.value = '';
    // 防呆 R1 — dialog 打开即 prefill 默认值 (来自 SO/customer 链, 后端已 prefill 到 SO)
    selectedInvoiceType.value = (props.defaultInvoiceType as InvoiceTypeValue) || 'NORMAL';
  }
});
</script>

<template>
  <el-dialog
    v-model="visible"
    title="税率分组开票 (G1 演示)"
    width="680px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <!-- 订单信息 -->
    <div class="order-info">
      <div>
        <span class="label">订单号:</span>
        <span class="value">{{ orderNumber || salesOrderId }}</span>
      </div>
      <div>
        <span class="label">客户:</span>
        <span class="value">{{ customerName || '—' }}</span>
      </div>
      <div v-if="canViewPrice">
        <span class="label">订单总额:</span>
        <span class="value amount">¥{{ fmt(orderTotalAmount) }}</span>
      </div>
    </div>

    <el-divider />

    <!-- 未生成状态 -->
    <div v-if="!issued" class="pending">
      <el-alert
        type="info"
        :closable="false"
        title="一笔订单可同时含 9% 原料 + 13% 加工费,系统将按税率自动分组拆分开票"
        show-icon
      />

      <!-- Sprint 4 W2 S-INVOICE-CLIENT-1 — R3 dropdown + R1 默认值预览 -->
      <div class="invoice-type-row">
        <label class="invoice-type-label">开票类型:</label>
        <el-select v-model="selectedInvoiceType" style="width: 220px">
          <el-option
            v-for="opt in INVOICE_TYPE_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          >
            <span style="float: left">{{ opt.label }}</span>
            <span style="float: right; color: var(--el-text-color-secondary); font-size: 12px">
              {{ opt.description }}
            </span>
          </el-option>
        </el-select>
        <span class="invoice-type-hint">{{ defaultSource }}</span>
      </div>

      <div v-if="errorMsg" class="error-box">
        <el-alert type="error" :closable="false" :title="errorMsg" />
      </div>
      <div class="actions-center">
        <el-button
          type="primary"
          size="large"
          :loading="loading"
          @click="generateInvoices"
        >
          一键按税率分组开票
        </el-button>
      </div>
    </div>

    <!-- 已生成: 展示分组 -->
    <div v-else class="result">
      <div class="result-title">
        <el-icon color="#67C23A"><svg viewBox="0 0 1024 1024" width="24" height="24"><path fill="currentColor" d="M406.656 706.944L195.84 496.256a32 32 0 10-45.248 45.248l256 256 512-512a32 32 0 00-45.248-45.248L406.592 706.944z"/></svg></el-icon>
        <span>已生成 {{ breakdown.length }} 组开票明细</span>
      </div>

      <div v-if="breakdown.length === 0 || (breakdown.length === 1 && Number(breakdown[0].taxRate) === 0)" class="empty-note">
        <el-alert
          type="warning"
          :closable="false"
          title="该订单明细未设置 tax_rate (展示为 0% 其他)"
          description="请先到销售订单详情设置行项目的税率 (原料 9% / 加工费 13%),再重新开票"
          show-icon
        />
      </div>

      <div v-else class="groups">
        <el-card
          v-for="(g, idx) in breakdown"
          :key="idx"
          class="group-card"
          :style="{ borderTop: `4px solid ${rateColor(g.taxRate)}` }"
        >
          <template #header>
            <div class="group-header">
              <el-tag
                :color="rateColor(g.taxRate)"
                effect="dark"
                size="large"
                style="font-size: 16px; font-weight: bold; color: #fff; border: none;"
              >
                {{ fmtRate(g.taxRate) }} · {{ rateLabel(g.taxRate) }}
              </el-tag>
              <span class="line-count">{{ g.lineCount }} 行明细</span>
            </div>
          </template>
          <div v-if="canViewPrice" class="group-body">
            <div class="field">
              <span class="k">不含税金额</span>
              <span class="v big">¥{{ fmt(g.taxableAmount) }}</span>
            </div>
            <div class="field">
              <span class="k">税额</span>
              <span class="v">¥{{ fmt(g.taxAmount) }}</span>
            </div>
            <div class="field total-line">
              <span class="k">发票金额</span>
              <span class="v big strong">
                ¥{{ fmt(Number(g.taxableAmount || 0) + Number(g.taxAmount || 0)) }}
              </span>
            </div>
          </div>
        </el-card>
      </div>

      <div v-if="record" class="summary">
        <div>
          <span class="label">申请单号:</span>
          <span class="value">{{ record.invoiceNumber || record.id || '—' }}</span>
        </div>
        <div v-if="canViewPrice">
          <span class="label">合计:</span>
          <span class="value amount">¥{{ fmt(record.totalAmount) }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">{{ issued ? '关闭' : '取消' }}</el-button>
      <el-button v-if="!issued" type="primary" :loading="loading" @click="generateInvoices">
        生成
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.order-info {
  display: flex;
  gap: 28px;
  padding: 8px 4px;
  flex-wrap: wrap;
}
.order-info .label {
  color: #909399;
  margin-right: 6px;
}
.order-info .value {
  color: #303133;
  font-weight: 500;
}
.order-info .amount {
  color: #E6A23C;
  font-weight: bold;
  font-size: 16px;
}
.pending {
  padding: 12px 0;
}
.error-box {
  margin-top: 12px;
}
.actions-center {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
.result-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: bold;
  color: #67C23A;
  margin-bottom: 12px;
}
.groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.group-card {
  border-radius: 6px;
}
.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.group-header .line-count {
  color: #909399;
  font-size: 13px;
}
.group-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.group-body .field {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}
.group-body .k {
  color: #606266;
}
.group-body .v {
  color: #303133;
}
.group-body .v.big {
  font-size: 20px;
  font-weight: 500;
}
.group-body .v.strong {
  color: #F56C6C;
  font-weight: bold;
}
.group-body .total-line {
  border-top: 1px dashed #dcdfe6;
  padding-top: 6px;
  margin-top: 4px;
}
.summary {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  padding: 10px 14px;
  background: #f5f7fa;
  border-radius: 4px;
}
.summary .label {
  color: #909399;
  margin-right: 6px;
}
.summary .amount {
  color: #F56C6C;
  font-size: 18px;
  font-weight: bold;
}
.empty-note {
  margin-bottom: 12px;
}

/* Sprint 4 W2 S-INVOICE-CLIENT-1 — invoice type R3 dropdown + R1 default hint */
.invoice-type-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
  padding: 10px 12px;
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 4px;
}
.invoice-type-label {
  color: #606266;
  font-size: 14px;
  font-weight: 500;
}
.invoice-type-hint {
  color: var(--text-color-secondary, #909399);
  font-size: 12px;
  margin-left: auto;
}
</style>
