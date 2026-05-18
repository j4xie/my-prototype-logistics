<script setup lang="ts">
import { computed } from 'vue';
import type { RowAction, EntityType } from '@/types/rowActions';
import {
  type InlineIconId,
  type InlineIconDef,
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
// → 用户不知道每个干啥, 看到一堆灰色图标以为不能用。修法 (PR #858 + PR #859):
//   1. RBAC/状态 disabled 的 → 不渲染 (per 防呆 Rule 5 "Dead-end 改导航")
//   2. 改纯文字 chip, 去掉 emoji (二次反馈)
//   3. 后端 API 未实现的 (pending) → 渲染但 disabled, 后接 " (开发中)" 暗示 roadmap
const visibleStates = computed(() =>
  computeInlineIconStates(props.rowActions, props.entityType).filter((s) => s.enabled)
);

function handle(state: { def: InlineIconDef; pending: boolean }): void {
  if (state.pending) return; // disabled chip — no-op
  emit('icon-click', state.def.id);
}
</script>

<template>
  <div class="inline-row-icons" role="toolbar" aria-label="行操作">
    <template v-for="state in visibleStates" :key="state.def.id">
      <el-tooltip
        v-if="state.pending"
        content="此功能 API 开发中, 暂未上线"
        placement="top"
        :show-after="200"
      >
        <button
          type="button"
          class="inline-row-icon-btn pending"
          :class="{ danger: state.def.danger }"
          :aria-label="state.def.label + ' (开发中)'"
          :disabled="true"
        >{{ state.def.label }} <span class="pending-tag">(开发中)</span></button>
      </el-tooltip>
      <button
        v-else
        type="button"
        class="inline-row-icon-btn"
        :class="{ danger: state.def.danger }"
        :aria-label="state.def.label"
        @click.stop="handle(state)"
      >{{ state.def.label }}</button>
    </template>
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
.inline-row-icon-btn.pending {
  color: var(--el-text-color-disabled);
  cursor: not-allowed;
}
.inline-row-icon-btn.pending:hover {
  color: var(--el-text-color-disabled);
  text-decoration: none;
}
.pending-tag {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
