// U-NEW-1 Sprint 4 Wave 2 Chat L — create-mode selector + batch-create dialog.
export { default as CreateModeSelector } from './CreateModeSelector.vue';
export { default as BatchCreateDialog } from './BatchCreateDialog.vue';
// U-DESKTOP-MODAL-1 Sprint 4 Wave 2 Chat L — desktop-class draggable / resizable dialog.
export { default as EnhancedDialog } from './EnhancedDialog.vue';
// U-DESKTOP-MODAL-1 Sprint 4 Wave 2 followup — el-dialog wrapper variant
// (delegates a11y/animation to ElDialog) + global multi-modal dock.
export { default as DesktopModal } from './DesktopModal.vue';
export { default as ModalDock } from './ModalDock.vue';
export {
  useModalDock,
  generateModalId,
  registerMinimized,
  unregisterMinimized,
  type MinimizedModalEntry,
} from './useModalDock';
