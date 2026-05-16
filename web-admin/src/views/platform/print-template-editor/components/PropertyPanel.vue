<template>
  <div class="property-panel">
    <div v-if="!el" class="empty">
      <el-empty description="点击画布元素编辑属性" :image-size="60" />
    </div>
    <template v-else>
      <div class="panel-title">{{ TYPE_LABELS[el.type] }}</div>

      <!-- Common: position + size -->
      <el-form label-position="top" label-width="auto" size="small">
        <div class="row-pair">
          <el-form-item label="X (pt)">
            <el-input-number :model-value="el.x" :min="0" :step="1" controls-position="right"
              @update:model-value="(v: number) => patch({ x: v ?? 0 })" />
          </el-form-item>
          <el-form-item label="Y (pt)">
            <el-input-number :model-value="el.y" :min="0" :step="1" controls-position="right"
              @update:model-value="(v: number) => patch({ y: v ?? 0 })" />
          </el-form-item>
        </div>
        <div class="row-pair" v-if="hasSize(el)">
          <el-form-item label="宽 (pt)">
            <el-input-number :model-value="el.width ?? 100" :min="10" :step="5" controls-position="right"
              @update:model-value="(v: number) => patch({ width: v ?? 100 })" />
          </el-form-item>
          <el-form-item label="高 (pt)">
            <el-input-number :model-value="el.height ?? 20" :min="10" :step="5" controls-position="right"
              @update:model-value="(v: number) => patch({ height: v ?? 20 })" />
          </el-form-item>
        </div>

        <!-- Text-specific -->
        <template v-if="el.type === 'text'">
          <el-form-item label="文本内容">
            <el-input type="textarea" :rows="2" :model-value="el.text"
              @update:model-value="(v: string) => patch({ text: v })" />
          </el-form-item>
          <div class="row-pair">
            <el-form-item label="字号 (pt)">
              <el-input-number :model-value="el.fontSize" :min="6" :max="48"
                @update:model-value="(v: number) => patch({ fontSize: v ?? 12 })" />
            </el-form-item>
            <el-form-item label="颜色">
              <el-color-picker :model-value="el.color ?? '#1f2937'"
                @update:model-value="(v: string) => patch({ color: v })" />
            </el-form-item>
          </div>
          <div class="row-pair">
            <el-form-item label="对齐">
              <el-select :model-value="el.align ?? 'left'" @update:model-value="(v: any) => patch({ align: v })">
                <el-option label="左" value="left" />
                <el-option label="中" value="center" />
                <el-option label="右" value="right" />
              </el-select>
            </el-form-item>
            <el-form-item label="加粗">
              <el-switch :model-value="!!el.bold" @update:model-value="(v: boolean) => patch({ bold: v })" />
            </el-form-item>
          </div>
        </template>

        <!-- Field-specific -->
        <template v-if="el.type === 'field'">
          <el-form-item label="绑定表达式">
            <el-input :model-value="el.binding"
              placeholder="{{entity.field}} 或 {{format.currency(entity.amount)}}"
              @update:model-value="(v: string) => patch({ binding: v })" />
          </el-form-item>
          <div class="row-pair">
            <el-form-item label="字号 (pt)">
              <el-input-number :model-value="el.fontSize" :min="6" :max="48"
                @update:model-value="(v: number) => patch({ fontSize: v ?? 12 })" />
            </el-form-item>
            <el-form-item label="对齐">
              <el-select :model-value="el.align ?? 'left'" @update:model-value="(v: any) => patch({ align: v })">
                <el-option label="左" value="left" />
                <el-option label="中" value="center" />
                <el-option label="右" value="right" />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item label="无值时显示">
            <el-input :model-value="el.emptyText ?? ''" placeholder="-"
              @update:model-value="(v: string) => patch({ emptyText: v })" />
          </el-form-item>
        </template>

        <!-- QR -->
        <template v-if="el.type === 'qr'">
          <el-form-item label="二维码内容">
            <el-input :model-value="el.content" placeholder="PO:{{factoryId}}:{{order.id}}"
              @update:model-value="(v: string) => patch({ content: v })" />
          </el-form-item>
          <el-form-item label="大小 (pt)">
            <el-input-number :model-value="el.size" :min="20" :step="5"
              @update:model-value="(v: number) => patch({ size: v ?? 80 })" />
          </el-form-item>
        </template>

        <!-- Barcode -->
        <template v-if="el.type === 'barcode'">
          <el-form-item label="条码内容">
            <el-input :model-value="el.content"
              @update:model-value="(v: string) => patch({ content: v })" />
          </el-form-item>
          <el-form-item label="格式">
            <el-select :model-value="el.format ?? 'CODE128'"
              @update:model-value="(v: any) => patch({ format: v })">
              <el-option label="CODE128" value="CODE128" />
              <el-option label="EAN13" value="EAN13" />
            </el-select>
          </el-form-item>
        </template>

        <!-- Image -->
        <template v-if="el.type === 'image'">
          <el-form-item label="图片 URL / Data URI">
            <el-input :model-value="el.src" placeholder="/logos/factory-1.png 或 data:image/..."
              @update:model-value="(v: string) => patch({ src: v })" />
          </el-form-item>
        </template>

        <!-- Stamp -->
        <template v-if="el.type === 'stamp'">
          <el-form-item label="印章 ID">
            <el-input :model-value="el.stampId" placeholder="default"
              @update:model-value="(v: string) => patch({ stampId: v })" />
          </el-form-item>
          <div class="row-pair">
            <el-form-item label="大小 (pt)">
              <el-input-number :model-value="el.size" :min="30" :step="5"
                @update:model-value="(v: number) => patch({ size: v ?? 100 })" />
            </el-form-item>
            <el-form-item label="透明度">
              <el-slider :model-value="el.opacity ?? 0.8" :min="0.1" :max="1" :step="0.1"
                @update:model-value="(v: any) => patch({ opacity: Number(v) })" />
            </el-form-item>
          </div>
        </template>

        <!-- Table -->
        <template v-if="el.type === 'table'">
          <el-form-item label="数组绑定">
            <el-input :model-value="el.binding" placeholder="{{entity.items}}"
              @update:model-value="(v: string) => patch({ binding: v })" />
          </el-form-item>
          <el-form-item label="行高 (pt)">
            <el-input-number :model-value="el.rowHeight" :min="14" :step="2"
              @update:model-value="(v: number) => patch({ rowHeight: v ?? 24 })" />
          </el-form-item>
          <el-divider>列</el-divider>
          <div v-for="(col, i) in el.columns" :key="i" class="col-row">
            <el-input :model-value="col.header" placeholder="表头"
              @update:model-value="(v: string) => patchCol(i, { header: v })" />
            <el-input :model-value="col.binding" placeholder="{{item.field}}"
              @update:model-value="(v: string) => patchCol(i, { binding: v })" />
            <el-input-number :model-value="col.width" :min="20" :step="5" controls-position="right"
              @update:model-value="(v: number) => patchCol(i, { width: v ?? 100 })" />
            <el-button link size="small" type="danger" @click="removeCol(i)">×</el-button>
          </div>
          <el-button size="small" plain @click="addCol">+ 加列</el-button>
        </template>
      </el-form>

      <div class="actions">
        <el-button size="small" plain @click="editor.duplicateElement(el.id)">复制</el-button>
        <el-button size="small" plain type="danger" @click="editor.removeElement(el.id)">删除</el-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PrintElement, TableElement, TableColumn } from '../utils/printSchemaTypes'
import type { PrintEditorState } from '../composables/usePrintEditor'

const props = defineProps<{ editor: PrintEditorState }>()

const el = computed<PrintElement | null>(() => props.editor.selectedElement.value)

const TYPE_LABELS: Record<PrintElement['type'], string> = {
  text: '文本属性',
  field: '字段绑定属性',
  table: '表格属性',
  qr: '二维码属性',
  barcode: '条码属性',
  image: '图片属性',
  stamp: '印章属性',
}

function hasSize(e: PrintElement): boolean {
  return e.type !== 'text' && e.type !== 'field'
}

function patch(p: Partial<PrintElement>) {
  if (!el.value) return
  props.editor.updateElement(el.value.id, p)
}

function patchCol(i: number, p: Partial<TableColumn>) {
  if (!el.value || el.value.type !== 'table') return
  const t = el.value as TableElement
  const cols = [...t.columns]
  cols[i] = { ...cols[i], ...p }
  patch({ columns: cols } as Partial<PrintElement>)
}

function addCol() {
  if (!el.value || el.value.type !== 'table') return
  const t = el.value as TableElement
  patch({
    columns: [...t.columns, { header: '新列', binding: '{{item.field}}', width: 80, align: 'left' }],
  } as Partial<PrintElement>)
}

function removeCol(i: number) {
  if (!el.value || el.value.type !== 'table') return
  const t = el.value as TableElement
  patch({ columns: t.columns.filter((_, idx) => idx !== i) } as Partial<PrintElement>)
}
</script>

<style scoped>
.property-panel {
  padding: 12px;
  height: 100%;
  overflow-y: auto;
}
.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60%;
}
.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f3f4f6;
}
.row-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.col-row {
  display: grid;
  grid-template-columns: 1fr 1.4fr 80px 28px;
  gap: 4px;
  margin-bottom: 6px;
  align-items: center;
}
.actions {
  margin-top: 12px;
  display: flex;
  gap: 6px;
}
</style>
