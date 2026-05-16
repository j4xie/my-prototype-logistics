<template>
  <div class="print-template-editor">
    <PrintTemplateToolbar
      :editor="editor"
      :saving="saving"
      @preview="onPreview"
      @save="onSave"
      @change-entity="onChangeEntity"
    />

    <div class="editor-body">
      <div class="left-pane">
        <ElementPalette />
        <el-divider style="margin: 0" />
        <EntityFieldTree :entity-type="editor.entityType.value" class="entity-tree-pane" />
      </div>

      <div class="center-pane">
        <FormCanvas :editor="editor" :mock-data="currentMockData" />
      </div>

      <div class="right-pane">
        <PropertyPanel :editor="editor" />
      </div>
    </div>

    <!-- PDF preview modal -->
    <el-dialog
      v-model="previewVisible"
      title="PDF 预览"
      width="80%"
      top="5vh"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div v-if="previewLoading" class="preview-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>生成 PDF 中...</span>
      </div>
      <iframe v-else-if="previewUrl" :src="previewUrl" class="preview-iframe"></iframe>
      <div v-else class="preview-error">预览失败</div>
      <template #footer>
        <el-button v-if="previewUrl" @click="downloadPdf">下载 PDF</el-button>
        <el-button @click="previewVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import PrintTemplateToolbar from './components/PrintTemplateToolbar.vue'
import ElementPalette from './components/ElementPalette.vue'
import EntityFieldTree from './components/EntityFieldTree.vue'
import FormCanvas from './components/FormCanvas.vue'
import PropertyPanel from './components/PropertyPanel.vue'
import { usePrintEditor } from './composables/usePrintEditor'
import { MOCK_DATA } from './utils/mockEntityData'
import type { PrintEntityType } from './utils/printSchemaTypes'
import { isValidEntityType } from './utils/printSchemaTypes'
import {
  getPrintTemplate, savePrintTemplate, previewPrintTemplate,
} from '@/api/printTemplateApi'
import { useAuthStore } from '@/store/modules/auth'

const authStore = useAuthStore()
const editor = usePrintEditor()

const saving = ref(false)
const previewVisible = ref(false)
const previewLoading = ref(false)
const previewUrl = ref<string | null>(null)
const previewBlob = ref<Blob | null>(null)

const factoryId = computed<string>(() => authStore.factoryId ?? '')

const currentMockData = computed<Record<string, unknown> | undefined>(() => {
  const et = editor.entityType.value
  if (!et) return undefined
  return MOCK_DATA[et]
})

async function onChangeEntity(et: PrintEntityType) {
  if (editor.dirty.value) {
    try {
      await ElMessageBox.confirm('当前模板未保存, 切换会丢失修改. 是否继续?', '提示', {
        type: 'warning',
        confirmButtonText: '丢弃',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
  }
  editor.resetForEntity(et)
  await loadExisting(et)
}

async function loadExisting(et: PrintEntityType) {
  if (!factoryId.value) return
  try {
    const existing = await getPrintTemplate(factoryId.value, et)
    if (existing) {
      editor.loadSchema(existing.schema, existing.id, existing.name)
      ElMessage.success(`已加载模板: ${existing.name} (v${existing.version})`)
    }
  } catch (e) {
    // 404 from request layer is handled in printTemplateApi; only log here.
    console.warn('[print-template-editor] load existing failed', e)
  }
}

async function onSave() {
  const et = editor.entityType.value
  if (!et || !isValidEntityType(et)) {
    ElMessage.warning('请先选择单据类型')
    return
  }
  if (!editor.templateName.value.trim()) {
    ElMessage.warning('请填写模板名称')
    return
  }
  if (!factoryId.value) {
    ElMessage.error('未识别工厂 — 请重新登录')
    return
  }

  saving.value = true
  try {
    const saved = await savePrintTemplate(
      factoryId.value,
      et,
      editor.templateName.value.trim(),
      editor.schema.value,
    )
    editor.templateId.value = saved.id
    editor.markClean()
    ElMessage.success(`模板已保存 (v${saved.version})`)
  } catch (e) {
    // Issue #721: surface the backend's actual message (e.g. validation
    // detail "name 已存在 / schemaJson 过大") instead of a generic fallback.
    // Sticky toast (duration:0 + showClose) so the user has time to read.
    const err = e as { response?: { data?: { message?: string } }; message?: string }
    const msg = err?.response?.data?.message
      || err?.message
      || '保存失败 — 请检查模板内容'
    ElMessage({
      message: msg,
      type: 'error',
      duration: 0,
      showClose: true,
    })
  } finally {
    saving.value = false
  }
}

async function onPreview() {
  const et = editor.entityType.value
  if (!et || !isValidEntityType(et)) {
    ElMessage.warning('请先选择单据类型')
    return
  }
  if (!factoryId.value) {
    ElMessage.error('未识别工厂 — 请重新登录')
    return
  }
  previewVisible.value = true
  previewLoading.value = true
  previewUrl.value = null
  try {
    const blob = await previewPrintTemplate(factoryId.value, {
      templateId: null,                        // use inline schema, no need to save first
      inlineSchema: editor.schema.value,
      entityType: et,
      mockData: currentMockData.value ?? null,
    })
    previewBlob.value = blob
    previewUrl.value = URL.createObjectURL(blob)
  } catch (e) {
    console.error('[print-template-editor] preview failed', e)
  } finally {
    previewLoading.value = false
  }
}

function downloadPdf() {
  if (!previewBlob.value) return
  const link = document.createElement('a')
  link.href = previewUrl.value!
  link.download = `${editor.templateName.value || 'template'}-preview.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Cleanup object URL when modal closes
watch(previewVisible, (v) => {
  if (!v && previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
    previewBlob.value = null
  }
})

// Unsaved-changes guard on route leave / page unload
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (editor.dirty.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}
onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
})
onUnmounted(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<style scoped>
.print-template-editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f3f4f6;
}
.editor-body {
  flex: 1;
  display: grid;
  grid-template-columns: 240px 1fr 320px;
  gap: 1px;
  background: #e5e7eb;
  min-height: 0;
}
.left-pane {
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.entity-tree-pane {
  flex: 1;
  overflow-y: auto;
}
.center-pane {
  background: #fff;
  overflow: hidden;
  min-height: 0;
}
.right-pane {
  background: #fff;
  overflow-y: auto;
}
.preview-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 60vh;
  color: #6b7280;
}
.preview-iframe {
  width: 100%;
  height: 70vh;
  border: 1px solid #e5e7eb;
}
.preview-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40vh;
  color: #dc2626;
}
</style>
