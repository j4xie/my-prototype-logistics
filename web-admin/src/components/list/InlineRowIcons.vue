<script setup lang="ts">
import { computed } from 'vue';
import type { RowAction, EntityType } from '@/types/rowActions';
import {
  type InlineIconId,
  computeInlineIconStates,
} from '@/types/inlineIcons';

/**
 * U-ICON-1 — inline 7-icon row toolbar (hover-on-row).
 *
 * Renders 7 small icon buttons in the row末 cell. Visible on row hover via
 * parent's :class="{ 'row-hover': true }" + CSS opacity. Coexists with the
 * "更多 ▾" RowActionMenu (PR #678) — this is inline-primary, that is
 * dropdown-secondary.
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

const states = computed(() => computeInlineIconStates(props.rowActions, props.entityType));

function handle(id: InlineIconId, enabled: boolean): void {
  if (!enabled) return;
  emit('icon-click', id);
}
</script>

<template>
  <div class="inline-row-icons" role="toolbar" aria-label="行操作">
    <el-tooltip
      v-for="state in states"
      :key="state.def.id"
      :content="state.enabled ? state.def.label : (state.disabledReason || state.def.label)"
      placement="top"
      :show-after="150"
    >
      <button
        type="button"
        class="inline-row-icon-btn"
        :class="{ disabled: !state.enabled, danger: state.def.danger }"
        :aria-label="state.def.label"
        :disabled="!state.enabled"
        :tabindex="state.enabled ? 0 : -1"
        @click.stop="handle(state.def.id, state.enabled)"
      >
        <span class="inline-row-icon">{{ state.def.icon }}</span>
      </button>
    </el-tooltip>
  </div>
</template>

<style scoped>
.inline-row-icons {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  /* Parent row should set opacity via `.el-table__row:hover .inline-row-icons`
     for hover-reveal. Standalone use shows always-on. */
}
.inline-row-icon-btn {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 2px 5px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: background-color 0.12s ease, border-color 0.12s ease;
}
.inline-row-icon-btn:hover:not(.disabled) {
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color-light);
}
.inline-row-icon-btn.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.inline-row-icon-btn.danger:hover:not(.disabled) {
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-5);
}
.inline-row-icon {
  display: inline-block;
}
</style>
