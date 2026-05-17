<script setup lang="ts">
import { useModalDock } from './useModalDock';
import { ElIcon } from 'element-plus';
import { Open } from '@element-plus/icons-vue';

/**
 * U-DESKTOP-MODAL-1 — global dock for minimized DesktopModal instances.
 *
 * Mount once near the app root (recommended: bottom of AppLayout's default
 * slot, OR inside any view that needs dock support). Multiple mounts are
 * harmless but produce visual overlap — prefer single mount.
 *
 * 防呆 R5: every minimized modal is always restorable via its chip.
 * Chip click invokes the registered restore callback (transitions
 * the modal back to normal state).
 */
const { entries, hasEntries } = useModalDock();
</script>

<template>
  <Transition name="modal-dock-fade">
    <div v-if="hasEntries" class="modal-dock">
      <button
        v-for="entry in entries"
        :key="entry.id"
        type="button"
        class="modal-dock-chip"
        :title="entry.title"
        :aria-label="`还原对话框: ${entry.title}`"
        @click="entry.restore"
      >
        <ElIcon :size="14"><Open /></ElIcon>
        <span class="modal-dock-chip-text">{{ entry.title }}</span>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.modal-dock {
  position: fixed;
  bottom: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  z-index: 3000; /* above el-dialog mask (2100) — ensures always-clickable */
  pointer-events: none;
}
.modal-dock-chip {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 320px;
  padding: 6px 14px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-primary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.modal-dock-chip:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
}
.modal-dock-chip:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.modal-dock-chip-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.modal-dock-fade-enter-active,
.modal-dock-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-dock-fade-enter-from,
.modal-dock-fade-leave-to {
  opacity: 0;
}
</style>
