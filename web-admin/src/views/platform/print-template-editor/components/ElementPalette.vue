<template>
  <div class="palette">
    <div class="palette-title">元素</div>
    <div class="palette-grid">
      <div
        v-for="opt in PALETTE_OPTIONS"
        :key="opt.type"
        class="palette-item"
        draggable="true"
        @dragstart="onDragStart(opt.type, $event)"
      >
        <el-icon class="icon"><component :is="opt.icon" /></el-icon>
        <div class="label">{{ opt.label }}</div>
      </div>
    </div>
    <div class="hint">拖拽到画布</div>
  </div>
</template>

<script setup lang="ts">
import {
  EditPen, Connection, Grid, Picture,
  PieChart, OfficeBuilding, Document,
} from '@element-plus/icons-vue'
import type { Component } from 'vue'
import type { ElementType } from '../utils/printSchemaTypes'

interface PaletteOption {
  type: ElementType
  label: string
  icon: Component
}

const PALETTE_OPTIONS: PaletteOption[] = [
  { type: 'text', label: '文本', icon: EditPen },
  { type: 'field', label: '字段绑定', icon: Connection },
  { type: 'table', label: '表格', icon: Grid },
  { type: 'qr', label: '二维码', icon: PieChart },
  { type: 'barcode', label: '条码', icon: Document },
  { type: 'image', label: '图片', icon: Picture },
  { type: 'stamp', label: '印章', icon: OfficeBuilding },
]

function onDragStart(type: ElementType, e: DragEvent) {
  if (!e.dataTransfer) return
  e.dataTransfer.setData('application/x-print-element', type)
  e.dataTransfer.effectAllowed = 'copy'
}
</script>

<style scoped>
.palette {
  padding: 12px;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.palette-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}
.palette-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.palette-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: grab;
  transition: all 0.1s;
}
.palette-item:hover {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.08);
}
.palette-item:active {
  cursor: grabbing;
}
.icon {
  font-size: 20px;
  color: #2563eb;
}
.label {
  font-size: 12px;
  color: #374151;
}
.hint {
  margin-top: 12px;
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
}
</style>
