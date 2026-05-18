<script setup lang="ts">
/**
 * CreateReturnOrderDialog — 退货单创建对话框 (#860 follow-up).
 *
 * Wires the existing backend (ReturnOrderController, 7 endpoints +
 * V20260514_03 migration). Replaces the "(待接 returnOrder API)" stub
 * toast in procurement/orders/list.vue + sales/shipments/list.vue.
 *
 * Customer business rule (第四次:956-1037, T-RTA #571):
 *   withGoods=TRUE  → 有食物退货 (库存入库总仓 + 完成时触发 AR 冲减)
 *   withGoods=FALSE → 无食物退款 (审批立即触发 AR 冲减, 无库存动作)
 *
 * Defaults TRUE per customer's primary case (实物退货).
 *
 * Pattern reference: sales/orders/detail.vue:1349-1408 already implements
 * the same dialog inline for sales order detail page. This component
 * generalizes it for procurement list + shipments list contexts.
 *
 * 防呆 R2 (context): header shows source order # + counterparty name.
 * 防呆 R1 (max boundary): per-row max = source line qty, exceeding disables submit.
 * 防呆 R4 (idempotent): backend createReturnOrder dedup'd on sourceOrderId.
 */
import { ref, computed, watch, nextTick } from 'vue';
import { ElMessage, type FormInstance } from 'element-plus';
import {
  createReturnOrder,
  type CreateReturnOrderItemRequest,
  type ReturnOrder,
  type ReturnType,
} from '@/api/returnOrder';

interface ReturnSourceItem {
  /** Stable id for v-for key. */
  id?: string | number;
  /** Either materialTypeId (purchase) or productTypeId (sales). */
  materialTypeId?: string | null;
  productTypeId?: string | null;
  /** Display name for the item row. */
  itemName: string;
  /** Unit price from source order (used to compute lineAmount). */
  unitPrice?: number | null;
  /** Cap for return quantity (purchased qty / delivered qty). */
  maxQuantity: number;
  /** Batch (if known). */
  batchNumber?: string | null;
}

const props = defineProps<{
  modelValue: boolean;
  /** Required: factory id from auth store. */
  factoryId: string;
  /** PURCHASE_RETURN for 采购退货, SALES_RETURN for 销售退货. */
  returnType: ReturnType;
  /** Source order id (PO id or SO id or shipment id). Persisted to sourceOrderId. */
  sourceOrderId: string;
  /** Source order number for header display. */
  sourceOrderNumber?: string;
  /** Counterparty id (supplier for purchase, customer for sales). */
  counterpartyId: string;
  /** Counterparty display name for header. */
  counterpartyName?: string;
  /** Pre-populated source items (caller provides). */
  items: ReturnSourceItem[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void;
  (e: 'success', returnOrder: ReturnOrder): void;
}>();

interface DialogRow {
  materialTypeId?: string | null;
  productTypeId?: string | null;
  itemName: string;
  unitPrice?: number | null;
  maxQuantity: number;
  batchNumber?: string | null;
  selected: boolean;
  quantity: number;
  reason: string;
}

const formRef = ref<FormInstance>();
const submitting = ref(false);

const form = ref<{
  returnDate: string;
  withGoods: boolean;
  reason: string;
  remark: string;
  items: DialogRow[];
}>({
  returnDate: new Date().toISOString().slice(0, 10),
  withGoods: true, // default 实物退货 per customer's primary case
  reason: '',
  remark: '',
  items: [],
});

const rules = {
  returnDate: [
    { required: true, message: '请选择退货日期', trigger: 'change' as const },
  ],
  reason: [
    { required: true, message: '请填写退货原因', trigger: 'blur' as const },
    { max: 1000, message: '退货原因不能超过1000个字符', trigger: 'blur' as const },
  ],
  remark: [
    { max: 5000, message: '备注不能超过5000个字符', trigger: 'blur' as const },
  ],
};

const typeLabel = computed(() =>
  props.returnType === 'PURCHASE_RETURN' ? '采购退货' : '销售退货',
);
const counterpartyLabel = computed(() =>
  props.returnType === 'PURCHASE_RETURN' ? '供应商' : '客户',
);

const selectedRows = computed(() =>
  form.value.items.filter((i) => i.selected && i.quantity > 0),
);

const hasOverflow = computed(() =>
  form.value.items.some(
    (i) => i.selected && i.maxQuantity > 0 && i.quantity > i.maxQuantity,
  ),
);

const canSubmit = computed(
  () =>
    !!form.value.returnDate &&
    !!form.value.reason.trim() &&
    selectedRows.value.length > 0 &&
    !hasOverflow.value,
);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      // Reset form on open; populate items from props.
      form.value = {
        returnDate: new Date().toISOString().slice(0, 10),
        withGoods: true,
        reason: '',
        remark: '',
        items: props.items.map((it) => ({
          materialTypeId: it.materialTypeId ?? null,
          productTypeId: it.productTypeId ?? null,
          itemName: it.itemName,
          unitPrice: it.unitPrice ?? null,
          maxQuantity: it.maxQuantity,
          batchNumber: it.batchNumber ?? null,
          // Default: all rows with positive max are pre-selected at full qty
          selected: it.maxQuantity > 0,
          quantity: it.maxQuantity,
          reason: '',
        })),
      };
      void nextTick(() => formRef.value?.clearValidate());
    }
  },
  { immediate: true },
);

function close(): void {
  if (submitting.value) return;
  emit('update:modelValue', false);
}

async function handleSubmit(): Promise<void> {
  if (!canSubmit.value || submitting.value) return;
  if (formRef.value) {
    try {
      await formRef.value.validate();
    } catch {
      return;
    }
  }

  // R1 boundary check (defense-in-depth — UI already disables submit).
  for (const it of selectedRows.value) {
    if (it.maxQuantity > 0 && it.quantity > it.maxQuantity) {
      ElMessage.warning(
        `${it.itemName} 退货数量 (${it.quantity}) 超过源单数量 (${it.maxQuantity})`,
      );
      return;
    }
  }

  submitting.value = true;
  try {
    const itemsPayload: CreateReturnOrderItemRequest[] = selectedRows.value.map(
      (it) => ({
        materialTypeId: it.materialTypeId || undefined,
        productTypeId: it.productTypeId || undefined,
        itemName: it.itemName,
        quantity: it.quantity,
        unitPrice: it.unitPrice ?? undefined,
        batchNumber: it.batchNumber || undefined,
        reason: it.reason || undefined,
      }),
    );

    const created = await createReturnOrder(props.factoryId, {
      returnType: props.returnType,
      counterpartyId: props.counterpartyId,
      sourceOrderId: props.sourceOrderId,
      returnDate: form.value.returnDate,
      reason: form.value.reason,
      remark: form.value.remark,
      withGoods: form.value.withGoods,
      items: itemsPayload,
    });

    ElMessage.success(
      `退货单已创建 (DRAFT 草稿, ${created.returnNumber}). 请到退货管理菜单提交审批.`,
    );
    emit('success', created);
    emit('update:modelValue', false);
  } catch (e: unknown) {
    // axios interceptor already shows error toast; only swallow + log
    // unexpected throws (e.g. network) so we don't pop a duplicate.
    const msg = e instanceof Error ? e.message : '创建退货单失败';
    // Don't double-toast — interceptor handles ApiError; only fall back if
    // the message looks like a generic Error (e.g. network).
    if (!msg.includes('退货')) {
      ElMessage.error(msg);
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="`申请${typeLabel}`"
    width="820px"
    :close-on-click-modal="false"
    :show-close="!submitting"
    destroy-on-close
    @update:model-value="close"
  >
    <!-- 防呆 R2: header shows source + counterparty context. -->
    <el-alert
      type="info"
      show-icon
      :closable="false"
      style="margin-bottom: 12px"
      :title="`源单: ${sourceOrderNumber || sourceOrderId} ｜ ${counterpartyLabel}: ${counterpartyName || counterpartyId}`"
      description="提交后退货单为 DRAFT 草稿. 请到 退货管理 菜单提交审批; 财务/管理员审批通过后才会触发库存或退款动作. 退货数量不能超过源单数量."
    />

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
    >
      <!-- T-RTA #571: withGoods 分支决定后端 AR 冲减 + 库存动作时机. -->
      <el-form-item label="退货类型" required>
        <el-radio-group v-model="form.withGoods">
          <el-radio :value="true">有食物退货 (库存入库总仓 → 完成时 AR 冲减)</el-radio>
          <el-radio :value="false">无食物退款 (审批立即 AR 冲减, 无库存动作)</el-radio>
        </el-radio-group>
        <div class="hint-text">
          <span v-if="form.withGoods">实物退货: 仓库收到货 → 总仓入库 (不良品状态) → 标记完成时触发 AR/AP 冲减.</span>
          <span v-else>无实物: 审批通过即触发 AR/AP 冲减, 不产生库存动作.</span>
        </div>
      </el-form-item>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="退货日期" prop="returnDate">
            <el-date-picker
              v-model="form.returnDate"
              type="date"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="退货原因" prop="reason">
            <el-input
              v-model="form.reason"
              placeholder="如: 客户验收不合格 / 包装破损 / 滞销退仓"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="2"
          maxlength="1000"
          show-word-limit
        />
      </el-form-item>

      <el-divider content-position="left">退货明细</el-divider>

      <el-table
        :data="form.items"
        border
        size="small"
        empty-text="源单无明细, 无法发起退货"
      >
        <el-table-column width="50" align="center">
          <template #default="{ row }">
            <el-checkbox v-model="row.selected" />
          </template>
        </el-table-column>
        <el-table-column
          label="品名"
          min-width="180"
          show-overflow-tooltip
        >
          <template #default="{ row }">{{ row.itemName }}</template>
        </el-table-column>
        <el-table-column label="源单数量" width="110" align="right">
          <template #default="{ row }">{{ row.maxQuantity }}</template>
        </el-table-column>
        <el-table-column label="退货数量" width="160">
          <template #default="{ row }">
            <el-input-number
              v-model="row.quantity"
              :min="0"
              :max="row.maxQuantity || undefined"
              :precision="3"
              :controls="false"
              size="small"
              style="width: 100%"
              :disabled="!row.selected"
            />
          </template>
        </el-table-column>
        <el-table-column label="行原因" min-width="180">
          <template #default="{ row }">
            <el-input
              v-model="row.reason"
              size="small"
              placeholder="(可选)"
              maxlength="500"
              :disabled="!row.selected"
            />
          </template>
        </el-table-column>
      </el-table>

      <div v-if="hasOverflow" class="overflow-hint">
        有行的退货数量超过源单数量, 请调整后再提交.
      </div>
      <div v-else-if="selectedRows.length === 0" class="overflow-hint">
        请勾选至少一行并填写退货数量.
      </div>
    </el-form>

    <template #footer>
      <el-button :disabled="submitting" @click="close">取消</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="!canSubmit"
        @click="handleSubmit"
      >
        提交退货申请
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint-text {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-top: 4px;
}
.overflow-hint {
  margin-top: 8px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
  border-radius: 4px;
}
</style>
