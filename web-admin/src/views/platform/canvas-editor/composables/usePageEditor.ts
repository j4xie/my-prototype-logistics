import { ref } from 'vue'
import type { DynamicField, DynamicFieldType } from '@/types/canvas'

export interface PaletteItem {
  type: DynamicFieldType
  label: string
  icon: string
  category: 'basic' | 'extended' | 'layout'
}

export const FIELD_PALETTE: PaletteItem[] = [
  { type: 'TEXT', label: '文本', icon: 'EditPen', category: 'basic' },
  { type: 'NUMBER', label: '数字', icon: 'Odometer', category: 'basic' },
  { type: 'DECIMAL', label: '金额', icon: 'Money', category: 'basic' },
  { type: 'DATE', label: '日期', icon: 'Calendar', category: 'basic' },
  { type: 'SELECT', label: '下拉选择', icon: 'ArrowDown', category: 'basic' },
  { type: 'ATTACHMENT', label: '附件', icon: 'Paperclip', category: 'extended' },
  { type: 'SUB_TABLE', label: '子表', icon: 'Grid', category: 'extended' },
]

const selectedField = ref<DynamicField | null>(null)
const previewMode = ref<'desktop' | 'mobile'>('desktop')
const previewRole = ref<string>('factory_super_admin')
const isDirty = ref(false)

export function usePageEditor() {
  function selectField(field: DynamicField | null) {
    selectedField.value = field
  }

  function setDirty() {
    isDirty.value = true
  }

  function clearDirty() {
    isDirty.value = false
  }

  return {
    selectedField,
    previewMode,
    previewRole,
    isDirty,
    selectField,
    setDirty,
    clearDirty,
    FIELD_PALETTE,
  }
}
