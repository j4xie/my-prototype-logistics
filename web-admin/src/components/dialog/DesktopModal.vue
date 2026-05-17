<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount, useSlots } from 'vue';
import { ElDialog, ElButton, ElIcon } from 'element-plus';
import { Minus, FullScreen, ScaleToOriginal, Close } from '@element-plus/icons-vue';
import {
  generateModalId,
  registerMinimized,
  unregisterMinimized,
} from './useModalDock';

/**
 * U-DESKTOP-MODAL-1 (Sprint 4 Wave 2 followup to Chat L) — el-dialog wrapper
 * that adds the 4 layui-layer-style desktop window operations on top of
 * Element Plus el-dialog. Compared to sibling EnhancedDialog (from-scratch
 * Teleport overlay), this wrapper:
 *
 *  - delegates show/hide + focus-trap + a11y + animations to el-dialog
 *  - hooks into el-dialog's built-in `fullscreen` prop for 最大化
 *  - hooks into el-dialog's built-in `draggable` prop for header drag
 *  - adds a top-right action row (最小化 / 最大化 / 关闭) replacing the default X
 *  - cooperates with global ModalDock for multi-modal min-state taskbar
 *  - bakes 防呆 R2 (context identity in title) + R5 (dock always restorable)
 *
 * 4 ops:
 *   1. 最小化 — emit minimize, register with ModalDock, dialog closes visually
 *      but state.minimized=true; dock chip restores via expand callback
 *   2. 最大化 — toggles el-dialog `fullscreen` prop
 *   3. 拖拽   — el-dialog `draggable` + `overflow` props (zero custom code)
 *   4. 关闭   — emit update:modelValue=false + close
 *
 * Stacking: two+ modals open concurrently each get incremented z-index from
 * el-dialog's built-in `z-index` allocator. Each registers its own dock
 * entry independently.
 */
const props = withDefaults(
  defineProps<{
    /** v-model open state. */
    modelValue: boolean;
    /** Action verb (e.g. "编辑", "完成生产"). Combines with contextLabel
     *  to form dialog title — 防呆 R2 rule (action — entity (id)). */
    action?: string;
    /** Context identity for 防呆 R2. e.g. "上海六腾门 (CUS-001)" or
     *  "叮咚好食光卤猪蹄 200g (SO-20260516-0123)". REQUIRED for write
     *  operations; pass empty string for read-only display dialogs. */
    contextLabel?: string;
    /** Optional explicit title override (skip action+contextLabel join). */
    title?: string;
    /** el-dialog width pass-through. */
    width?: string | number;
    /** Whether to render dock chip when minimized. Set false to opt out
     *  of global ModalDock (e.g. transient toast-like dialogs). */
    dockable?: boolean;
    /** Close on click overlay. Default false (desktop-class modals usually
     *  require explicit close — 防呆 R5 against accidental dismiss). */
    closeOnClickModal?: boolean;
    /** Close on ESC. */
    closeOnPressEscape?: boolean;
  }>(),
  {
    action: '',
    contextLabel: '',
    title: '',
    width: '720px',
    dockable: true,
    closeOnClickModal: false,
    closeOnPressEscape: true,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void;
  (e: 'minimize'): void;
  (e: 'maximize'): void;
  (e: 'restore'): void;
  (e: 'close'): void;
}>();

const slots = useSlots();

type WindowState = 'normal' | 'minimized' | 'maximized';
const state = ref<WindowState>('normal');
const modalId = generateModalId();

// Computed title — 防呆 R2 "action — entity (id)" pattern.
const fullTitle = computed<string>(() => {
  if (props.title) return props.title;
  if (props.action && props.contextLabel) {
    return `${props.action} — ${props.contextLabel}`;
  }
  return props.action || props.contextLabel || '';
});

const isMinimized = computed<boolean>(() => state.value === 'minimized');
const isMaximized = computed<boolean>(() => state.value === 'maximized');

// el-dialog v-model wrapper. When minimized we hide the dialog visually
// while keeping our modelValue true (so parent state is preserved).
const dialogVisible = computed<boolean>({
  get: () => props.modelValue && !isMinimized.value,
  set: (v: boolean) => {
    if (!v && !isMinimized.value) {
      // User dismissed via overlay/ESC/built-in close.
      emit('update:modelValue', false);
      emit('close');
    }
  },
});

function close(): void {
  // Unregister dock entry if minimized when closed.
  if (isMinimized.value) unregisterMinimized(modalId);
  state.value = 'normal';
  emit('update:modelValue', false);
  emit('close');
}

function toggleMinimize(): void {
  if (state.value === 'minimized') {
    state.value = 'normal';
    unregisterMinimized(modalId);
    emit('restore');
  } else {
    state.value = 'minimized';
    if (props.dockable) {
      registerMinimized({
        id: modalId,
        title: fullTitle.value || '已最小化对话框',
        contextLabel: props.contextLabel,
        restore: () => {
          state.value = 'normal';
          unregisterMinimized(modalId);
          emit('restore');
        },
      });
    }
    emit('minimize');
  }
}

function toggleMaximize(): void {
  if (state.value === 'maximized') {
    state.value = 'normal';
    emit('restore');
  } else {
    state.value = 'maximized';
    emit('maximize');
  }
}

// Reset to normal each time the dialog opens fresh.
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      state.value = 'normal';
    } else if (isMinimized.value) {
      // Parent flipped modelValue=false while we were minimized — clean up.
      unregisterMinimized(modalId);
      state.value = 'normal';
    }
  }
);

// Defensive cleanup if component unmounts mid-minimize.
onBeforeUnmount(() => {
  unregisterMinimized(modalId);
});
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    :width="width"
    :fullscreen="isMaximized"
    draggable
    overflow
    :show-close="false"
    :close-on-click-modal="closeOnClickModal"
    :close-on-press-escape="closeOnPressEscape"
    :modal="!isMinimized"
    class="desktop-modal"
    :class="{ 'desktop-modal--maximized': isMaximized }"
    @close="close"
  >
    <template #header="{ titleId, titleClass }">
      <div class="desktop-modal-header">
        <div :id="titleId" :class="titleClass" class="desktop-modal-title">
          <!-- 防呆 R2: action — context identity, always visible -->
          <span class="desktop-modal-title-text">{{ fullTitle }}</span>
          <span v-if="contextLabel && action" class="desktop-modal-title-badge">
            {{ contextLabel }}
          </span>
        </div>
        <div class="desktop-modal-actions" @pointerdown.stop>
          <ElButton
            text
            size="small"
            :icon="Minus"
            title="最小化"
            aria-label="最小化"
            @click="toggleMinimize"
          />
          <ElButton
            text
            size="small"
            :icon="isMaximized ? ScaleToOriginal : FullScreen"
            :title="isMaximized ? '还原' : '最大化'"
            :aria-label="isMaximized ? '还原' : '最大化'"
            @click="toggleMaximize"
          />
          <ElButton
            text
            size="small"
            :icon="Close"
            title="关闭"
            aria-label="关闭"
            @click="close"
          />
        </div>
      </div>
    </template>

    <slot />

    <template v-if="slots.footer" #footer>
      <slot name="footer" />
    </template>
  </ElDialog>
</template>

<style scoped>
.desktop-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 12px;
}
.desktop-modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.desktop-modal-title-text {
  font-weight: 600;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.desktop-modal-title-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.desktop-modal-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
</style>

<style>
/* Unscoped — needs to override el-dialog default padding when maximized. */
.desktop-modal--maximized .el-dialog {
  border-radius: 0;
  margin: 0 !important;
}
.desktop-modal--maximized .el-dialog__body {
  height: calc(100vh - 110px);
  overflow: auto;
}
</style>
