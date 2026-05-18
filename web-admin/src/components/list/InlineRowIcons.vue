<script setup lang="ts">
import { computed } from 'vue';
import type { RowAction, EntityType } from '@/types/rowActions';
import {
  type InlineIconId,
  computeInlineIconStates,
} from '@/types/inlineIcons';

/**
 * U-ICON-1 — inline action toolbar (text-only chips).
 *
 * 2026-05-18 redesign: emoji icons + hover-tooltip replaced with plain text
 * chips, and disabled entries no longer render at all (was opacity 0.35).
 * Coexists with the "更多 ▾" RowActionMenu (PR #678) — this is inline-primary,
 * that is dropdown-secondary.
 *
 * Props:
 *   - rowActions: output of computeRowActions for the row (status + RBAC filtered)
 *   - entityType: forwarded for future per-entity overrides
 *
 * Emits:
 *   - icon-click(id): parent dispatches by id (same id space as COMMON_ACTIONS
 *     for 4 shared ids, plus inline-only ids mark/forward/audit)
 */
const props = defineProps<{
  rowActions: RowAction[];
  entityType?: EntityType;
}>();

const emit = defineEmits<{
  (e: 'icon-click', id: InlineIconId): void;
}>();

// 客户反馈 (2026-05-18, F006 admin): 7 emoji icons 永驻 + 无文字 + disabled 也渲染
// → 用户不知道每个干啥, 看到一堆灰色图标以为不能用。修法:
//   1. 过滤 disabled — 只渲染 enabled 的, 当前状态不允许的直接不显示
//   2. 去掉 emoji icon, 纯文字 label, 更直接 (per 用户 2026-05-18 二次反馈)
// 防呆设计 Rule 5 — "用户犯错前阻止" 而不是 disabled 灰掉让用户猜。
const enabledStates = computed(() =>
  computeInlineIconStates(props.rowActions, props.entityType).filter((s) => s.enabled)
);

function handle(id: InlineIconId): void {
  emit('icon-click', id);
}
</script>

<template>
  <div class="inline-row-icons" role="toolbar" aria-label="行操作">
    <button
      v-for="state in enabledStates"
      :key="state.def.id"
      type="button"
      class="inline-row-icon-btn"
      :class="{ danger: state.def.danger }"
      :aria-label="state.def.label"
      @click.stop="handle(state.def.id)"
    >{{ state.def.label }}</button>
  </div>
</template>

<style scoped>
.inline-row-icons {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  row-gap: 4px;
}
.inline-row-icon-btn {
  background: transparent;
  border: none;
  padding: 0 2px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.4;
  color: var(--el-color-primary);
  transition: color 0.12s ease;
}
.inline-row-icon-btn:hover {
  color: var(--el-color-primary-light-3);
  text-decoration: underline;
}
.inline-row-icon-btn.danger {
  color: var(--el-color-danger);
}
.inline-row-icon-btn.danger:hover {
  color: var(--el-color-danger-light-3);
}
</style>
