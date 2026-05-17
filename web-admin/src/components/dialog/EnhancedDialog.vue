<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { Minus, FullScreen, ScaleToOriginal, Close } from '@element-plus/icons-vue';

/**
 * U-DESKTOP-MODAL-1 (Sprint 4 Wave 2 Chat L) — desktop-class ElDialog with
 * 4 window operations: 最小化 (dock) / 最大化 (fullscreen) / 拉伸 (resize) /
 * 关闭. Draggable header via pointer events (no @vueuse/core dep).
 *
 * State machine: normal ⇌ minimized | normal ⇌ maximized.
 * 拉伸 is grab-corner resize (only when normal).
 *
 * Props mostly pass-through to el-dialog; show-close hidden because we own
 * the chrome via custom header.
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    /** Initial width when normal. CSS unit (default 720px). */
    width?: string;
    /** Optional minimum width/height when resizing. */
    minWidth?: number;
    minHeight?: number;
  }>(),
  {
    title: '',
    width: '720px',
    minWidth: 400,
    minHeight: 240,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void;
  (e: 'close'): void;
}>();

type WindowState = 'normal' | 'minimized' | 'maximized';

const state = ref<WindowState>('normal');
const position = ref<{ x: number; y: number } | null>(null);
const size = ref<{ w: number; h: number } | null>(null);

// Drag state (header mousedown).
const isDragging = ref(false);
const dragOffset = ref<{ x: number; y: number }>({ x: 0, y: 0 });

// Resize state (corner mousedown).
const isResizing = ref(false);
const resizeStart = ref<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });

const isMinimized = computed(() => state.value === 'minimized');
const isMaximized = computed(() => state.value === 'maximized');

const containerStyle = computed(() => {
  if (state.value === 'maximized') {
    return { width: '100vw', height: '100vh', left: '0', top: '0', transform: 'none' };
  }
  const style: Record<string, string> = { width: props.width };
  if (size.value) {
    style.width = `${size.value.w}px`;
    style.height = `${size.value.h}px`;
  }
  if (position.value) {
    style.left = `${position.value.x}px`;
    style.top = `${position.value.y}px`;
    style.transform = 'none';
  }
  return style;
});

function close(): void {
  emit('update:modelValue', false);
  emit('close');
}

function toggleMinimize(): void {
  state.value = state.value === 'minimized' ? 'normal' : 'minimized';
}

function toggleMaximize(): void {
  state.value = state.value === 'maximized' ? 'normal' : 'maximized';
}

function expandFromDock(): void {
  if (state.value === 'minimized') state.value = 'normal';
}

// --- Draggable header ---
function onHeaderPointerDown(e: PointerEvent): void {
  if (state.value !== 'normal') return;
  if ((e.target as HTMLElement).closest('.enhanced-dialog-actions')) return;
  isDragging.value = true;
  const container = (e.currentTarget as HTMLElement).closest('.enhanced-dialog-container') as HTMLElement | null;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  dragOffset.value = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  if (!position.value) position.value = { x: rect.left, y: rect.top };
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

function onPointerMove(e: PointerEvent): void {
  if (isDragging.value) {
    position.value = {
      x: e.clientX - dragOffset.value.x,
      y: e.clientY - dragOffset.value.y,
    };
  } else if (isResizing.value) {
    const dx = e.clientX - resizeStart.value.x;
    const dy = e.clientY - resizeStart.value.y;
    size.value = {
      w: Math.max(props.minWidth, resizeStart.value.w + dx),
      h: Math.max(props.minHeight, resizeStart.value.h + dy),
    };
  }
}

function onPointerUp(): void {
  isDragging.value = false;
  isResizing.value = false;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
}

// --- Resize corner ---
function onResizeStart(e: PointerEvent): void {
  if (state.value !== 'normal') return;
  e.preventDefault();
  isResizing.value = true;
  const container = (e.target as HTMLElement).closest('.enhanced-dialog-container') as HTMLElement | null;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  resizeStart.value = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height };
  if (!size.value) size.value = { w: rect.width, h: rect.height };
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      // Reset to normal each open. Position/size persist across the same lifecycle.
      state.value = 'normal';
      await nextTick();
    }
  }
);
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="enhanced-dialog-overlay" :class="{ minimized: isMinimized, maximized: isMaximized }">
      <div
        v-show="!isMinimized"
        class="enhanced-dialog-container"
        :style="containerStyle"
      >
        <header
          class="enhanced-dialog-header"
          @pointerdown="onHeaderPointerDown"
        >
          <span class="enhanced-dialog-title">{{ title }}</span>
          <div class="enhanced-dialog-actions">
            <el-button text size="small" :icon="Minus" :title="'最小化'" @click.stop="toggleMinimize" />
            <el-button
              text
              size="small"
              :icon="isMaximized ? ScaleToOriginal : FullScreen"
              :title="isMaximized ? '还原' : '最大化'"
              @click.stop="toggleMaximize"
            />
            <el-button text size="small" :icon="Close" :title="'关闭'" @click.stop="close" />
          </div>
        </header>

        <section class="enhanced-dialog-body">
          <slot />
        </section>

        <footer v-if="$slots.footer" class="enhanced-dialog-footer">
          <slot name="footer" />
        </footer>

        <!-- 拉伸 corner (only shown when normal — fullscreen has no corner) -->
        <div
          v-if="!isMaximized"
          class="enhanced-dialog-resize"
          @pointerdown="onResizeStart"
        />
      </div>

      <!-- Minimized dock pill (bottom-left) -->
      <button
        v-if="isMinimized"
        type="button"
        class="enhanced-dialog-dock"
        @click="expandFromDock"
      >
        <el-icon><FullScreen /></el-icon>
        <span>{{ title || '已最小化的对话框' }}</span>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.enhanced-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 2100;
  background: rgba(0, 0, 0, 0.32);
}
.enhanced-dialog-overlay.minimized {
  background: transparent;
  pointer-events: none;
}
.enhanced-dialog-overlay.maximized {
  background: var(--el-bg-color);
}
.enhanced-dialog-container {
  position: absolute;
  left: 50%;
  top: 10vh;
  transform: translateX(-50%);
  background: var(--el-bg-color);
  border-radius: 8px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  overflow: hidden;
  min-width: 400px;
  min-height: 240px;
}
.enhanced-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  cursor: move;
  user-select: none;
  background: var(--el-fill-color-blank);
}
.enhanced-dialog-title {
  font-weight: 600;
  font-size: 15px;
}
.enhanced-dialog-actions {
  display: flex;
  gap: 4px;
}
.enhanced-dialog-body {
  flex: 1;
  padding: 16px;
  overflow: auto;
}
.enhanced-dialog-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--el-border-color-light);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.enhanced-dialog-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 18px;
  height: 18px;
  cursor: nwse-resize;
  background: linear-gradient(
    135deg,
    transparent 50%,
    var(--el-text-color-placeholder) 50%,
    var(--el-text-color-placeholder) 60%,
    transparent 60%,
    transparent 70%,
    var(--el-text-color-placeholder) 70%,
    var(--el-text-color-placeholder) 80%,
    transparent 80%
  );
}
.enhanced-dialog-dock {
  position: fixed;
  left: 20px;
  bottom: 20px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  pointer-events: auto;
  font-size: 13px;
  z-index: 2101;
}
.enhanced-dialog-dock:hover {
  border-color: var(--el-color-primary);
}
</style>
