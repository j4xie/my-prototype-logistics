<script setup lang="ts">
/**
 * ForwardShareDialog — 转发 / 分享链接对话框 (PR #872 follow-up to #860).
 *
 * Steve 2026-05-18 decision: NO email service. Backend generates the URL,
 * frontend copies it to clipboard via navigator.clipboard.writeText.
 *
 * Two-stage UX:
 *   1. Configure stage — pick expiry (radio: 7/30/90/permanent, default 30)
 *      + toggle 价格 (switch, default ON) → "生成链接" button.
 *   2. Result stage — show readonly URL + copy button + expiry display.
 *
 * Props are typed and reactive; v-model:visible drives ElDialog open state.
 *
 * 防呆 Rule 2 (context): dialog header shows entity type + label (order #).
 * 防呆 Rule 4 (idempotent-friendly): each click of "生成链接" creates a new
 *   token row (intentional — admin may want multiple shares with different
 *   expiry / price settings). 后端会写 N 行但不报错.
 */
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { CopyDocument, Link } from '@element-plus/icons-vue';
import {
  createShareLink,
  type ShareLinkEntityType,
  type ShareLinkResponse,
} from '@/api/shareLink';

const props = defineProps<{
  visible: boolean;
  factoryId: string;
  entityType: ShareLinkEntityType;
  entityId: string;
  /** Display label, e.g. 订单编号. */
  entityLabel?: string;
  /** Friendly type name e.g. "采购单" / "销售订单". */
  entityTypeLabel?: string;
}>();

const emit = defineEmits<{
  (e: 'update:visible', open: boolean): void;
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (v: boolean) => emit('update:visible', v),
});

const headerLabel = computed(() => {
  const t = props.entityTypeLabel || (props.entityType === 'PurchaseOrder' ? '采购单' : '销售订单');
  return props.entityLabel ? `转发 — ${t} #${props.entityLabel}` : `转发 — ${t}`;
});

// Configure stage state
type ExpiryPreset = 7 | 30 | 90 | 0; // 0 = 永久
const expiryDays = ref<ExpiryPreset>(30);
const includePrice = ref(true);
const submitting = ref(false);

// Result stage state
const result = ref<ShareLinkResponse | null>(null);

function resetState(): void {
  expiryDays.value = 30;
  includePrice.value = true;
  submitting.value = false;
  result.value = null;
}

// Reset state whenever dialog re-opens (so a 2nd share doesn't show stale URL).
watch(
  () => props.visible,
  (open) => {
    if (open) {
      resetState();
    }
  }
);

async function generateLink(): Promise<void> {
  if (!props.factoryId || !props.entityId) {
    ElMessage.error('缺少 factoryId 或 entityId, 无法生成分享链接');
    return;
  }
  submitting.value = true;
  try {
    const res = await createShareLink(props.factoryId, {
      entityType: props.entityType,
      entityId: props.entityId,
      expiresDays: expiryDays.value,
      includePrice: includePrice.value,
    });
    result.value = res;
    ElMessage.success('分享链接已生成');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '生成分享链接失败';
    ElMessage.error(msg);
  } finally {
    submitting.value = false;
  }
}

async function copyUrl(): Promise<void> {
  if (!result.value?.url) return;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(result.value.url);
      ElMessage.success('链接已复制到剪贴板');
    } else {
      // Fallback: legacy approach for non-secure / older browsers
      const ta = document.createElement('textarea');
      ta.value = result.value.url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      ElMessage.success('链接已复制到剪贴板');
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '复制失败, 请手动选择文本复制';
    ElMessage.warning(msg);
  }
}

function formatExpiry(iso: string | null, permanent: boolean): string {
  if (permanent || !iso) return '永不过期';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch {
    return iso;
  }
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="headerLabel"
    width="520px"
    :close-on-click-modal="false"
    append-to-body
    destroy-on-close
  >
    <!-- Stage 1: configure -->
    <div v-if="!result" class="forward-config">
      <el-form label-width="100px">
        <el-form-item label="链接有效期">
          <el-radio-group v-model="expiryDays">
            <el-radio :value="7">7 天</el-radio>
            <el-radio :value="30">30 天</el-radio>
            <el-radio :value="90">90 天</el-radio>
            <el-radio :value="0">永久</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="包含价格">
          <el-switch v-model="includePrice" active-text="显示" inactive-text="隐藏" />
          <div class="hint-text">
            关闭后, 查看者将看不到单价 / 总金额 / 税额等价格字段
          </div>
        </el-form-item>
      </el-form>
    </div>

    <!-- Stage 2: result -->
    <div v-else class="forward-result">
      <div class="success-banner">
        <el-icon><Link /></el-icon>
        <span>链接已生成, 任何拥有此链接的人均可只读访问</span>
      </div>
      <el-form label-width="100px">
        <el-form-item label="分享链接">
          <el-input
            v-model="result.url"
            readonly
            class="url-input"
          >
            <template #append>
              <el-button :icon="CopyDocument" @click="copyUrl">复制</el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="过期时间">
          <span>{{ formatExpiry(result.expiresAt, result.permanent) }}</span>
        </el-form-item>
        <el-form-item label="价格可见">
          <el-tag :type="includePrice ? 'success' : 'info'" size="small">
            {{ includePrice ? '显示' : '隐藏' }}
          </el-tag>
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="dialogVisible = false">
          {{ result ? '关闭' : '取消' }}
        </el-button>
        <el-button
          v-if="!result"
          type="primary"
          :loading="submitting"
          @click="generateLink"
        >
          生成链接
        </el-button>
        <el-button v-else type="primary" @click="copyUrl">
          再次复制
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style lang="scss" scoped>
.forward-config {
  padding: 8px 0;
  .hint-text {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
    line-height: 1.4;
  }
}

.forward-result {
  padding: 8px 0;
  .success-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: #f0f9ff;
    border-left: 3px solid #67c23a;
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 13px;
    color: #67c23a;
  }
  .url-input :deep(.el-input__inner) {
    font-family: monospace;
    font-size: 12px;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
