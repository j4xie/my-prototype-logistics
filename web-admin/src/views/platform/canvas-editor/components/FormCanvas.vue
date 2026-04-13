<template>
  <div class="form-canvas">
    <div class="canvas-toolbar">
      <span class="toolbar-title">{{ props.moduleCode }} — 字段布局</span>
      <el-tag size="small" type="info">{{ fields.length }} 个字段</el-tag>
    </div>

    <draggable
      v-model="fields"
      group="fields"
      item-key="fieldCode"
      class="canvas-field-list"
      ghost-class="ghost"
      @change="onReorder"
    >
      <template #item="{ element, index }">
        <div
          class="canvas-field-item"
          :class="{ selected: selectedField?.fieldCode === element.fieldCode, dynamic: element.source === 'dynamic' }"
          @click="selectField(element)"
        >
          <el-icon class="drag-handle"><Rank /></el-icon>
          <div class="field-info">
            <span class="field-label">{{ element.label }}</span>
            <el-tag size="small" :type="element.source === 'dynamic' ? 'warning' : 'info'">
              {{ element.fieldType || element.type }}
            </el-tag>
            <el-tag v-if="element.status === 'PENDING_DDL'" size="small" type="danger">待发布</el-tag>
          </div>
          <div class="field-code">{{ element.fieldCode || element.code }}</div>
          <el-button
            v-if="element.source === 'dynamic'"
            type="danger" text size="small"
            @click.stop="$emit('remove-field', index)"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </template>
    </draggable>

    <div v-if="fields.length === 0" class="canvas-empty">
      <el-empty description="从左侧拖入字段" :image-size="80" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue'
import draggable from 'vuedraggable'
import { Rank, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { usePageEditor } from '../composables/usePageEditor'
import { useCanvasEditor } from '../composables/useCanvasEditor'
import { reorderFields } from '@/api/canvasApi'

const props = defineProps<{
  moduleCode?: string
}>()

defineEmits<{ 'remove-field': [index: number] }>()

const fields = defineModel<any[]>('fields', { required: true })

const { selectedField, selectField, setDirty } = usePageEditor()
// Round 10 Fix — pull the live config + reload helper from the canvas-editor
// composable so we can include the optimistic-lock token (rowVersion) in the
// reorder request and refresh after success.
const { factoryId, configVersion, loadVersion } = useCanvasEditor()

// Round 10 Fix C1 (post-review patch) — PROMISE lock instead of boolean
// single-flight. The previous boolean-based lock silently DROPPED rapid drops
// while a prior call was in flight — exact same data-loss class the endpoint
// was supposed to close. Now we serialize via an awaited promise chain so
// every drop eventually fires after the previous one completes.
let reorderTimer: ReturnType<typeof setTimeout> | null = null
let inflightReorder: Promise<unknown> | null = null

async function onReorder() {
  // Mark dirty + update local sortOrder so the UI reflects the new order
  // immediately. We use (i + 1) * 10 spacing so future inserts can land
  // between two existing fields without renumbering everything.
  setDirty()
  fields.value.forEach((f: any, i: number) => {
    f.sortOrder = (i + 1) * 10
  })

  // Debounce 500ms — reset on each new drop so a flurry of drags only
  // triggers one API call after the user pauses.
  if (reorderTimer) clearTimeout(reorderTimer)
  reorderTimer = setTimeout(async () => {
    if (!props.moduleCode) {
      console.warn('[FormCanvas] reorder skipped: moduleCode missing')
      return
    }
    if (!factoryId.value) {
      console.warn('[FormCanvas] reorder skipped: factoryId missing')
      return
    }

    // Wait for any in-flight reorder to complete so this one isn't dropped.
    // Ordering is preserved because calls are serialized through the chain.
    if (inflightReorder) {
      try {
        await inflightReorder
      } catch {
        /* previous call errored — still try this one */
      }
    }

    const fieldOrder = fields.value
      .map((f: any) => f.fieldCode || f.code)
      .filter((c: string | undefined): c is string => Boolean(c))
    // rowVersion is the @Version optimistic-lock counter on FactoryConfiguration.
    // Default to 0 (matches @Builder.Default in the entity) if no version loaded.
    const expectedVersion = configVersion.value?.rowVersion ?? 0

    inflightReorder = reorderFields(
      factoryId.value,
      props.moduleCode,
      fieldOrder,
      expectedVersion,
    )
    try {
      await inflightReorder
      ElMessage.success({ message: '排序已保存', duration: 1500 })
      // Backend currently saves only FactoryModuleConfig (not FactoryConfiguration),
      // so rowVersion is NOT incremented server-side. We still call loadVersion()
      // to pick up any other version drift from concurrent sessions.
      await loadVersion()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('版本冲突')) {
        try {
          await ElMessageBox.confirm(
            '其他会话已修改此配置,需要刷新后重试。点击确定自动刷新。',
            '版本冲突',
            { type: 'warning', confirmButtonText: '刷新', cancelButtonText: '取消' },
          )
          await loadVersion()
        } catch {
          /* user cancelled the refresh dialog */
        }
      } else {
        ElMessage.error('字段排序保存失败: ' + msg)
      }
    } finally {
      inflightReorder = null
    }
  }, 500)
}

// Round 10 Fix C2 (post-review patch) — clear the pending debounce timer on
// component unmount so a stale reorder callback can't fire after the component
// is gone. Note: we don't try to flush the pending call synchronously — async
// unmount handlers don't block navigation. The 500ms debounce window is the
// narrow loss surface; beforeunload guard in useCanvasEditor.ts catches the
// broader dirty-state cases.
onUnmounted(() => {
  if (reorderTimer) {
    clearTimeout(reorderTimer)
    reorderTimer = null
  }
})
</script>

<style scoped>
.form-canvas { flex: 1; padding: 16px; overflow-y: auto; }
.canvas-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.toolbar-title { font-weight: 600; font-size: 15px; }
.canvas-field-list { display: flex; flex-direction: column; gap: 4px; min-height: 200px; }
.canvas-field-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  border: 1px solid #ebeef5; border-radius: 4px; cursor: pointer; background: #fff;
  transition: all 0.2s;
}
.canvas-field-item:hover { border-color: #c0c4cc; }
.canvas-field-item.selected { border-color: #409eff; background: #ecf5ff; }
.canvas-field-item.dynamic { border-left: 3px solid #e6a23c; }
.drag-handle { cursor: grab; color: #c0c4cc; }
.field-info { flex: 1; display: flex; align-items: center; gap: 6px; }
.field-label { font-size: 13px; }
.field-code { font-size: 11px; color: #909399; font-family: monospace; }
.ghost { opacity: 0.5; background: #ecf5ff; }
.canvas-empty { padding: 40px 0; }
</style>
