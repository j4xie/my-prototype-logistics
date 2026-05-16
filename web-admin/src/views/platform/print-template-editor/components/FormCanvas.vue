<template>
  <div class="canvas-scroll" ref="scrollRef">
    <div
      class="canvas-page"
      :style="pageStyle"
      @click.self="onCanvasClick"
      @dragover.prevent="onDragOver"
      @drop.prevent="onDrop"
    >
      <!-- Margin guides -->
      <div class="margin-guide" :style="marginGuideStyle"></div>

      <!-- Elements -->
      <div
        v-for="el in editor.schema.value.elements"
        :key="el.id"
        class="element-wrap"
        :class="{ selected: editor.selectedElementId.value === el.id }"
        :style="elementWrapStyle(el)"
        @mousedown.stop="onElementMouseDown(el.id, $event)"
        @click.stop="editor.selectElement(el.id)"
      >
        <TextElement v-if="el.type === 'text'" :element="el" :zoom="zoom" />
        <FieldElement v-else-if="el.type === 'field'" :element="el" :zoom="zoom" :mock-data="mockData" />
        <TableElement v-else-if="el.type === 'table'" :element="el" :zoom="zoom" :mock-data="mockData" />
        <QrCodeElement v-else-if="el.type === 'qr'" :element="el" :zoom="zoom" :mock-data="mockData" />
        <BarcodeElement v-else-if="el.type === 'barcode'" :element="el" :zoom="zoom" :mock-data="mockData" />
        <ImageElement v-else-if="el.type === 'image'" :element="el" :zoom="zoom" />
        <StampElement v-else-if="el.type === 'stamp'" :element="el" :zoom="zoom" />

        <!-- Selection chrome (only shown when selected) -->
        <div v-if="editor.selectedElementId.value === el.id" class="selection-chrome">
          <button class="action-btn delete" title="删除 (Del)" @click.stop="editor.removeElement(el.id)">
            <el-icon><Delete /></el-icon>
          </button>
        </div>
      </div>

      <!-- Empty-state hint -->
      <div v-if="editor.schema.value.elements.length === 0" class="empty-hint">
        从左侧拖拽元素到此处, 或从字段树拖拽字段到此处即绑定
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import TextElement from './elements/TextElement.vue'
import FieldElement from './elements/FieldElement.vue'
import TableElement from './elements/TableElement.vue'
import QrCodeElement from './elements/QrCodeElement.vue'
import BarcodeElement from './elements/BarcodeElement.vue'
import ImageElement from './elements/ImageElement.vue'
import StampElement from './elements/StampElement.vue'
import type { PrintElement, ElementType } from '../utils/printSchemaTypes'
import { ptToPx, pxToPt } from '../utils/a4Coords'
import type { PrintEditorState } from '../composables/usePrintEditor'
import { createDefaultElement } from '../composables/usePrintEditor'

const props = defineProps<{
  editor: PrintEditorState
  mockData?: Record<string, unknown>
}>()

const scrollRef = ref<HTMLElement | null>(null)
const zoom = computed(() => props.editor.zoom.value)

const pageStyle = computed(() => ({
  width: `${ptToPx(props.editor.schema.value.canvas.width, zoom.value)}px`,
  height: `${ptToPx(props.editor.schema.value.canvas.height, zoom.value)}px`,
  position: 'relative' as const,
  background: '#ffffff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
  margin: '20px auto',
}))

const marginGuideStyle = computed(() => {
  const c = props.editor.schema.value.canvas
  return {
    position: 'absolute' as const,
    left: `${ptToPx(c.marginLeft ?? 50, zoom.value)}px`,
    top: `${ptToPx(c.marginTop ?? 40, zoom.value)}px`,
    width: `${ptToPx(c.width - (c.marginLeft ?? 50) - (c.marginRight ?? 50), zoom.value)}px`,
    height: `${ptToPx(c.height - (c.marginTop ?? 40) - (c.marginBottom ?? 40), zoom.value)}px`,
    border: '1px dashed #e5e7eb',
    pointerEvents: 'none' as const,
  }
})

function elementWrapStyle(el: PrintElement) {
  return {
    position: 'absolute' as const,
    left: `${ptToPx(el.x, zoom.value)}px`,
    top: `${ptToPx(el.y, zoom.value)}px`,
    width: el.width != null ? `${ptToPx(el.width, zoom.value)}px` : 'auto',
    minHeight: el.height != null ? `${ptToPx(el.height, zoom.value)}px` : '14px',
    cursor: 'move',
  }
}

function onCanvasClick() {
  props.editor.selectElement(null)
}

// ---- drag from palette / entity tree onto canvas ----
function onDragOver(e: DragEvent) {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function onDrop(e: DragEvent) {
  if (!scrollRef.value || !e.dataTransfer) return
  const raw = e.dataTransfer.getData('application/x-print-element')
  const fieldDrop = e.dataTransfer.getData('application/x-entity-field')
  const pageRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const xPx = e.clientX - pageRect.left
  const yPx = e.clientY - pageRect.top
  const xPt = pxToPt(xPx, zoom.value)
  const yPt = pxToPt(yPx, zoom.value)

  if (raw) {
    const type = raw as ElementType
    const def = createDefaultElement(type, xPt, yPt)
    props.editor.addElement(def)
  } else if (fieldDrop) {
    // Drop from EntityFieldTree → create a FieldElement bound to that path.
    const binding = `{{${fieldDrop}}}`
    props.editor.addElement({
      type: 'field', x: xPt, y: yPt, binding, fontSize: 12,
    })
  }
}

// ---- drag-within-canvas to reposition ----
const dragState = ref<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

function onElementMouseDown(id: string, e: MouseEvent) {
  props.editor.selectElement(id)
  const el = props.editor.schema.value.elements.find(x => x.id === id)
  if (!el) return
  dragState.value = {
    id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y,
  }
  e.preventDefault()
}

function onMouseMove(e: MouseEvent) {
  const ds = dragState.value
  if (!ds) return
  const dxPx = e.clientX - ds.startX
  const dyPx = e.clientY - ds.startY
  const newX = ds.origX + pxToPt(dxPx, zoom.value)
  const newY = ds.origY + pxToPt(dyPx, zoom.value)
  props.editor.moveElement(ds.id, newX, newY)
}

function onMouseUp() {
  dragState.value = null
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const id = props.editor.selectedElementId.value
    if (id && !isTextInputFocused()) {
      props.editor.removeElement(id)
      e.preventDefault()
    }
  } else if (e.key === 'Escape') {
    props.editor.selectElement(null)
  }
}

function isTextInputFocused(): boolean {
  const ae = document.activeElement
  if (!ae) return false
  const tag = ae.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (ae as HTMLElement).isContentEditable
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.canvas-scroll {
  height: 100%;
  overflow: auto;
  background: #f3f4f6;
}
.element-wrap {
  user-select: none;
  border: 1px solid transparent;
  box-sizing: border-box;
}
.element-wrap:hover {
  border-color: #93c5fd;
}
.element-wrap.selected {
  border: 2px solid #2563eb;
  outline: 1px solid rgba(37, 99, 235, 0.3);
  outline-offset: 2px;
}
.selection-chrome {
  position: absolute;
  top: -28px;
  right: 0;
  display: flex;
  gap: 4px;
}
.action-btn {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  color: #374151;
}
.action-btn.delete:hover {
  color: #dc2626;
  border-color: #fca5a5;
}
.empty-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 14px;
  pointer-events: none;
}
</style>
